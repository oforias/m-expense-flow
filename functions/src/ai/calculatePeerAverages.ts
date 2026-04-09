import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

interface PeerAverageData {
  category: string;
  averagePercentage: number;
  medianAmount: number;
  sampleSize: number;
}

// Scheduled function to calculate peer averages daily
export const calculatePeerAverages = functions.pubsub
  .schedule('0 2 * * *') // Run daily at 2 AM
  .timeZone('Africa/Accra')
  .onRun(async (context) => {
    const db = admin.firestore();
    
    try {
      // Calculate for all periods
      await Promise.all([
        calculatePeerAveragesForPeriod(db, 'weekly'),
        calculatePeerAveragesForPeriod(db, 'monthly'),
        calculatePeerAveragesForPeriod(db, 'semester')
      ]);
      
      console.log('Peer averages calculated successfully');
    } catch (error) {
      console.error('Error calculating peer averages:', error);
      throw error;
    }
  });

// Manual trigger for calculating peer averages
export const triggerPeerAveragesCalculation = functions.https.onCall(
  async (data: { period?: string }, context) => {
    // Verify admin access (in production, you'd check for admin role)
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const db = admin.firestore();
    const { period } = data;

    try {
      if (period) {
        await calculatePeerAveragesForPeriod(db, period);
      } else {
        await Promise.all([
          calculatePeerAveragesForPeriod(db, 'weekly'),
          calculatePeerAveragesForPeriod(db, 'monthly'),
          calculatePeerAveragesForPeriod(db, 'semester')
        ]);
      }

      return {
        success: true,
        message: `Peer averages calculated for ${period || 'all periods'}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error calculating peer averages:', error);
      throw new functions.https.HttpsError('internal', 'Failed to calculate peer averages');
    }
  }
);

async function calculatePeerAveragesForPeriod(
  db: admin.firestore.Firestore,
  period: string
): Promise<void> {
  console.log(`Calculating peer averages for period: ${period}`);
  
  const periodDays = getPeriodDays(period);
  const now = new Date();
  const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Get all users (in production, this would be paginated)
  const usersSnapshot = await db.collection('users').get();
  
  const categoryData = new Map<string, {
    totalAmounts: number[];
    percentages: number[];
    userCount: number;
  }>();

  let processedUsers = 0;
  const batchSize = 50;

  // Process users in batches to avoid memory issues
  for (let i = 0; i < usersSnapshot.docs.length; i += batchSize) {
    const batch = usersSnapshot.docs.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (userDoc) => {
      const userId = userDoc.id;
      
      try {
        // Get user's transactions for the period
        const transactionsSnapshot = await db
          .collection('users')
          .doc(userId)
          .collection('transactions')
          .where('date', '>=', startDate)
          .where('type', '==', 'expense')
          .get();

        if (transactionsSnapshot.empty) return;

        const userCategoryTotals = new Map<string, number>();
        let userTotalSpent = 0;

        transactionsSnapshot.docs.forEach(doc => {
          const transaction = doc.data();
          const category = transaction.category;
          const amount = transaction.amount;
          
          userTotalSpent += amount;
          userCategoryTotals.set(category, (userCategoryTotals.get(category) || 0) + amount);
        });

        // Only include users with meaningful spending (>= GHS 10)
        if (userTotalSpent < 10) return;

        // Calculate percentages for this user
        userCategoryTotals.forEach((amount, category) => {
          const percentage = (amount / userTotalSpent) * 100;
          
          if (!categoryData.has(category)) {
            categoryData.set(category, {
              totalAmounts: [],
              percentages: [],
              userCount: 0
            });
          }
          
          const data = categoryData.get(category)!;
          data.totalAmounts.push(amount);
          data.percentages.push(percentage);
          data.userCount = new Set([...data.totalAmounts.keys()]).size;
        });

        processedUsers++;
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
      }
    }));
  }

  console.log(`Processed ${processedUsers} users for ${period} period`);

  // Calculate averages and save to Firestore
  const batch = db.batch();
  const peerAveragesRef = db.collection('global').doc('peer_averages').collection(period);
  
  // Clear existing data
  const existingDocs = await peerAveragesRef.get();
  existingDocs.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  categoryData.forEach((data, category) => {
    // Need at least 10 users for meaningful average
    if (data.userCount < 10) return;
    
    const averagePercentage = data.percentages.reduce((sum, p) => sum + p, 0) / data.percentages.length;
    const medianAmount = calculateMedian(data.totalAmounts);
    
    const peerData: PeerAverageData = {
      category,
      averagePercentage,
      medianAmount,
      sampleSize: data.userCount
    };
    
    const docRef = peerAveragesRef.doc(category);
    batch.set(docRef, {
      ...peerData,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      period
    });
  });

  await batch.commit();
  console.log(`Saved peer averages for ${categoryData.size} categories in ${period} period`);
}

function getPeriodDays(period: string): number {
  switch (period) {
    case 'weekly': return 7;
    case 'semester': return 120;
    default: return 30; // monthly
  }
}

function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  } else {
    return sorted[middle];
  }
}