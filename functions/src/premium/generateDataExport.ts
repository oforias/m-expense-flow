import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface GenerateDataExportData {
  userId: string;
  format: 'csv' | 'json' | 'excel';
  dataTypes: ('transactions' | 'budgets' | 'savings_goals' | 'achievements' | 'insights')[];
  dateRange?: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
}

export const generateDataExport = functions.https.onCall(
  async (data: GenerateDataExportData, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { userId, format, dataTypes, dateRange } = data;
    
    // Verify user can only export their own data
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Cannot export other users data');
    }

    try {
      const db = admin.firestore();
      
      // Check if user has premium access
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found');
      }

      const userData = userDoc.data()!;
      
      // Verify premium status and expiry
      let validPremium = userData.isPremium || false;
      if (validPremium && userData.premiumExpiryDate) {
        const expiryDate = userData.premiumExpiryDate.toDate();
        if (expiryDate < new Date()) {
          validPremium = false;
        }
      }

      if (!validPremium) {
        throw new functions.https.HttpsError('permission-denied', 'Premium subscription required for data export');
      }

      // Prepare date filters
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      
      if (dateRange) {
        startDate = new Date(dateRange.start);
        endDate = new Date(dateRange.end);
      }

      const exportData: any = {
        exportInfo: {
          userId: userId,
          userName: userData.name,
          exportDate: new Date().toISOString(),
          format: format,
          dateRange: dateRange || 'all_time'
        },
        data: {}
      };

      // Export transactions
      if (dataTypes.includes('transactions')) {
        let transactionsQuery = db.collection('users').doc(userId).collection('transactions').orderBy('date', 'desc');
        
        if (startDate && endDate) {
          transactionsQuery = transactionsQuery
            .where('date', '>=', startDate)
            .where('date', '<=', endDate) as any;
        }

        const transactionsSnapshot = await transactionsQuery.get();
        exportData.data.transactions = transactionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date.toDate().toISOString(),
          createdAt: doc.data().createdAt.toDate().toISOString(),
          updatedAt: doc.data().updatedAt.toDate().toISOString()
        }));
      }

      // Export budgets
      if (dataTypes.includes('budgets')) {
        const budgetsSnapshot = await db.collection('users').doc(userId).collection('budgets').get();
        exportData.data.budgets = budgetsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate().toISOString(),
          updatedAt: doc.data().updatedAt.toDate().toISOString()
        }));

        // Also export comprehensive budgets if they exist
        const comprehensiveBudgetsSnapshot = await db.collection('users').doc(userId).collection('comprehensive_budgets').get();
        exportData.data.comprehensiveBudgets = comprehensiveBudgetsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate().toISOString(),
          updatedAt: doc.data().updatedAt.toDate().toISOString()
        }));
      }

      // Export savings goals
      if (dataTypes.includes('savings_goals')) {
        const savingsGoalsSnapshot = await db.collection('users').doc(userId).collection('savings_goals').get();
        exportData.data.savingsGoals = savingsGoalsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          deadline: doc.data().deadline.toDate().toISOString(),
          createdAt: doc.data().createdAt.toDate().toISOString(),
          updatedAt: doc.data().updatedAt.toDate().toISOString(),
          completedDate: doc.data().completedDate ? doc.data().completedDate.toDate().toISOString() : null
        }));
      }

      // Export achievements
      if (dataTypes.includes('achievements')) {
        const achievementsSnapshot = await db.collection('users').doc(userId).collection('achievements').get();
        exportData.data.achievements = achievementsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          unlockedDate: doc.data().unlockedDate ? doc.data().unlockedDate.toDate().toISOString() : null
        }));
      }

      // Export AI insights
      if (dataTypes.includes('insights')) {
        const insightsSnapshot = await db.collection('users').doc(userId).collection('ai_insights').get();
        exportData.data.insights = insightsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          generatedAt: doc.data().generatedAt.toDate().toISOString()
        }));
      }

      // Convert to requested format
      let fileContent: string;
      let fileName: string;
      let contentType: string;

      switch (format) {
        case 'json':
          fileContent = JSON.stringify(exportData, null, 2);
          fileName = `m-expense-flow-export-${userId}-${Date.now()}.json`;
          contentType = 'application/json';
          break;

        case 'csv':
          // For CSV, we'll export transactions as the main data
          if (exportData.data.transactions) {
            const transactions = exportData.data.transactions;
            const csvHeaders = 'Date,Type,Amount,Category,Description,Created At\n';
            const csvRows = transactions.map((t: any) => 
              `${t.date},${t.type},${t.amount},${t.category},"${t.description}",${t.createdAt}`
            ).join('\n');
            fileContent = csvHeaders + csvRows;
          } else {
            fileContent = 'No transaction data to export\n';
          }
          fileName = `m-expense-flow-transactions-${userId}-${Date.now()}.csv`;
          contentType = 'text/csv';
          break;

        case 'excel':
          // For Excel format, we'll return JSON that can be converted to Excel on the client
          fileContent = JSON.stringify(exportData, null, 2);
          fileName = `m-expense-flow-export-${userId}-${Date.now()}.xlsx`;
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;

        default:
          throw new functions.https.HttpsError('invalid-argument', 'Unsupported export format');
      }

      // In a real implementation, you would upload this to Firebase Storage
      // and return a download URL. For now, we'll simulate this process.
      
      const bucket = admin.storage().bucket();
      const file = bucket.file(`exports/${fileName}`);
      
      await file.save(fileContent, {
        metadata: {
          contentType: contentType,
          metadata: {
            userId: userId,
            exportDate: new Date().toISOString(),
            dataTypes: dataTypes.join(',')
          }
        }
      });

      // Generate signed URL for download (expires in 24 hours)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const [downloadUrl] = await file.getSignedUrl({
        action: 'read',
        expires: expiresAt
      });

      // Log the export for audit purposes
      await db.collection('users').doc(userId).collection('export_logs').add({
        fileName: fileName,
        format: format,
        dataTypes: dataTypes,
        dateRange: dateRange || null,
        exportedAt: new Date(),
        fileSize: Buffer.byteLength(fileContent, 'utf8'),
        downloadUrl: downloadUrl
      });

      return {
        success: true,
        downloadUrl: downloadUrl,
        fileName: fileName,
        fileSize: Buffer.byteLength(fileContent, 'utf8'),
        expiresAt: expiresAt,
        message: `Data export generated successfully. Download link expires in 24 hours.`
      };

    } catch (error) {
      console.error('Error generating data export:', error);
      throw new functions.https.HttpsError('internal', 'Failed to generate data export');
    }
  }
);