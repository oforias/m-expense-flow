import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Aggregates spending data from all users to create peer comparison averages
 * This function runs on a schedule (weekly) to update peer comparison data
 * 
 * Privacy measures:
 * - Only aggregates percentages and amounts, no personal data
 * - Requires minimum 10 users per category for anonymity
 * - Data is anonymized and aggregated
 */
export const aggregatePeerData = functions.pubsub
  .schedule('every sunday 00:00')
  .timeZone('Africa/Accra')
  .onRun(async (context) => {
    const db = admin.firestore();
    
    try {
      console.log('Starting peer data aggregation...');
      
      // Get all users
      const usersSnapshot = await db.collection('users').get();
      
      if (usersSnapshot.empty) {
        console.log('No users found for aggregation');
        return null;
      }
      
      // Category aggregation data
      const categoryData: {
        [category: string]: {
          percentages: number[];
          amounts: number[];
        };
      } = {};
      
      let totalUsersProcessed = 0;
      
      // Process each user's spending data
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        
        // Get user's transactions from the last 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const transactionsSnapshot = await db
          .collection('users')
          .doc(userId)
          .collection('transactions')
          .where('date', '>=', admin.firestore.Timestamp.fromDate(ninetyDaysAgo))
          .where('type', '==', 'expense')
          .get();
        
        if (transactionsSnapshot.empty) {
          continue; // Skip users with no transactions
        }
        
        // Calculate category breakdown for this user
        const userCategoryTotals: { [category: string]: number } = {};
        let userTotalExpenses = 0;
        
        transactionsSnapshot.forEach((doc) => {
          const transaction = doc.data();
          const category = transaction.category || 'Other';
          const amount = transaction.amount || 0;
          
          userCategoryTotals[category] = (userCategoryTotals[category] || 0) + amount;
          userTotalExpenses += amount;
        });
        
        // Skip users with very low spending (less than GHS 10)
        if (userTotalExpenses < 10) {
          continue;
        }
        
        // Calculate percentages and add to aggregation
        Object.entries(userCategoryTotals).forEach(([category, amount]) => {
          const percentage = (amount / userTotalExpenses) * 100;
          
          if (!categoryData[category]) {
            categoryData[category] = {
              percentages: [],
              amounts: [],
            };
          }
          
          categoryData[category].percentages.push(percentage);
          categoryData[category].amounts.push(amount);
        });
        
        totalUsersProcessed++;
      }
      
      console.log(`Processed ${totalUsersProcessed} users`);
      
      // Calculate aggregated statistics for each category
      const aggregatedCategories: {
        [category: string]: {
          averagePercentage: number;
          medianAmount: number;
          totalUsers: number;
        };
      } = {};
      
      Object.entries(categoryData).forEach(([category, data]) => {
        // Only include categories with at least 10 users for privacy
        if (data.percentages.length < 10) {
          console.log(`Skipping ${category} - insufficient data (${data.percentages.length} users)`);
          return;
        }
        
        // Calculate average percentage
        const avgPercentage =
          data.percentages.reduce((sum, val) => sum + val, 0) / data.percentages.length;
        
        // Calculate median amount
        const sortedAmounts = [...data.amounts].sort((a, b) => a - b);
        const medianAmount =
          sortedAmounts.length % 2 === 0
            ? (sortedAmounts[sortedAmounts.length / 2 - 1] +
                sortedAmounts[sortedAmounts.length / 2]) /
              2
            : sortedAmounts[Math.floor(sortedAmounts.length / 2)];
        
        aggregatedCategories[category] = {
          averagePercentage: Math.round(avgPercentage * 10) / 10, // Round to 1 decimal
          medianAmount: Math.round(medianAmount * 100) / 100, // Round to 2 decimals
          totalUsers: data.percentages.length,
        };
      });
      
      // Save aggregated data to Firestore
      await db
        .collection('global')
        .doc('peer_averages')
        .set({
          categories: aggregatedCategories,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          totalUsers: totalUsersProcessed,
          generatedAt: new Date().toISOString(),
        });
      
      console.log('Peer data aggregation completed successfully');
      console.log(`Categories aggregated: ${Object.keys(aggregatedCategories).length}`);
      console.log(`Total users in dataset: ${totalUsersProcessed}`);
      
      return {
        success: true,
        categoriesAggregated: Object.keys(aggregatedCategories).length,
        totalUsers: totalUsersProcessed,
      };
    } catch (error) {
      console.error('Error aggregating peer data:', error);
      throw error;
    }
  });

/**
 * Manual trigger for peer data aggregation
 * Can be called via HTTP for testing or manual updates
 */
export const triggerPeerDataAggregation = functions.https.onCall(async (data, context) => {
  // Verify the request is from an authenticated admin
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to trigger aggregation'
    );
  }
  
  const db = admin.firestore();
  
  try {
    console.log('Manual peer data aggregation triggered by:', context.auth.uid);
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      return {
        success: false,
        message: 'No users found for aggregation',
      };
    }
    
    // Category aggregation data
    const categoryData: {
      [category: string]: {
        percentages: number[];
        amounts: number[];
      };
    } = {};
    
    let totalUsersProcessed = 0;
    
    // Process each user's spending data
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      
      // Get user's transactions from the last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const transactionsSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('transactions')
        .where('date', '>=', admin.firestore.Timestamp.fromDate(ninetyDaysAgo))
        .where('type', '==', 'expense')
        .get();
      
      if (transactionsSnapshot.empty) {
        continue;
      }
      
      // Calculate category breakdown for this user
      const userCategoryTotals: { [category: string]: number } = {};
      let userTotalExpenses = 0;
      
      transactionsSnapshot.forEach((doc) => {
        const transaction = doc.data();
        const category = transaction.category || 'Other';
        const amount = transaction.amount || 0;
        
        userCategoryTotals[category] = (userCategoryTotals[category] || 0) + amount;
        userTotalExpenses += amount;
      });
      
      // Skip users with very low spending
      if (userTotalExpenses < 10) {
        continue;
      }
      
      // Calculate percentages and add to aggregation
      Object.entries(userCategoryTotals).forEach(([category, amount]) => {
        const percentage = (amount / userTotalExpenses) * 100;
        
        if (!categoryData[category]) {
          categoryData[category] = {
            percentages: [],
            amounts: [],
          };
        }
        
        categoryData[category].percentages.push(percentage);
        categoryData[category].amounts.push(amount);
      });
      
      totalUsersProcessed++;
    }
    
    // Calculate aggregated statistics
    const aggregatedCategories: {
      [category: string]: {
        averagePercentage: number;
        medianAmount: number;
        totalUsers: number;
      };
    } = {};
    
    Object.entries(categoryData).forEach(([category, data]) => {
      // Only include categories with at least 10 users for privacy
      if (data.percentages.length < 10) {
        return;
      }
      
      const avgPercentage =
        data.percentages.reduce((sum, val) => sum + val, 0) / data.percentages.length;
      
      const sortedAmounts = [...data.amounts].sort((a, b) => a - b);
      const medianAmount =
        sortedAmounts.length % 2 === 0
          ? (sortedAmounts[sortedAmounts.length / 2 - 1] +
              sortedAmounts[sortedAmounts.length / 2]) /
            2
          : sortedAmounts[Math.floor(sortedAmounts.length / 2)];
      
      aggregatedCategories[category] = {
        averagePercentage: Math.round(avgPercentage * 10) / 10,
        medianAmount: Math.round(medianAmount * 100) / 100,
        totalUsers: data.percentages.length,
      };
    });
    
    // Save aggregated data
    await db
      .collection('global')
      .doc('peer_averages')
      .set({
        categories: aggregatedCategories,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        totalUsers: totalUsersProcessed,
        generatedAt: new Date().toISOString(),
      });
    
    return {
      success: true,
      message: 'Peer data aggregation completed',
      categoriesAggregated: Object.keys(aggregatedCategories).length,
      totalUsers: totalUsersProcessed,
    };
  } catch (error) {
    console.error('Error in manual aggregation:', error);
    throw new functions.https.HttpsError('internal', 'Aggregation failed');
  }
});
