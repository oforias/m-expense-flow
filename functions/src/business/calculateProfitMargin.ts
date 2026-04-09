import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface CalculateProfitMarginData {
  userId: string;
  period: string;
  timestamp: string;
}

interface BusinessTransaction {
  transactionId: string;
  userId: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  isBusinessTransaction: boolean;
}

export const calculateProfitMargin = async (
  data: CalculateProfitMarginData,
  context: functions.https.CallableContext
): Promise<any> => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Verify user ID matches authenticated user
  if (context.auth.uid !== data.userId) {
    throw new functions.https.HttpsError('permission-denied', 'User can only access their own data');
  }

  try {
    const { userId, period } = data;

    // Check if user is premium
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data()!;
    if (!userData.isPremium) {
      throw new functions.https.HttpsError('permission-denied', 'Business Mode is a Premium feature');
    }

    // Check if business mode is enabled
    if (!userData.businessModeEnabled) {
      throw new functions.https.HttpsError('failed-precondition', 'Business Mode is not enabled');
    }

    // Calculate date range based on period
    const dateRange = calculateDateRange(period);
    
    // Get business transactions for the period
    const transactionsQuery = db
      .collection('users')
      .doc(userId)
      .collection('business_transactions')
      .where('date', '>=', admin.firestore.Timestamp.fromDate(dateRange.start))
      .where('date', '<=', admin.firestore.Timestamp.fromDate(dateRange.end))
      .orderBy('date', 'desc');

    const transactionsSnapshot = await transactionsQuery.get();
    const transactions: BusinessTransaction[] = transactionsSnapshot.docs.map((doc: any) => 
      doc.data() as BusinessTransaction
    );

    // Calculate revenue (income transactions)
    const revenue = transactions
      .filter(transaction => transaction.type === 'income')
      .reduce((total, transaction) => total + transaction.amount, 0);

    // Calculate expenses (expense transactions)
    const expenses = transactions
      .filter(transaction => transaction.type === 'expense')
      .reduce((total, transaction) => total + transaction.amount, 0);

    // Calculate net profit
    const netProfit = revenue - expenses;

    // Calculate profit margin percentage
    const profitMargin = revenue > 0 ? (netProfit / revenue * 100) : 0;

    // Calculate category breakdown for expenses
    const categoryBreakdown: { [key: string]: number } = {};
    const categoryPercentages: { [key: string]: number } = {};
    
    transactions
      .filter(transaction => transaction.type === 'expense')
      .forEach(transaction => {
        categoryBreakdown[transaction.category] = 
          (categoryBreakdown[transaction.category] || 0) + transaction.amount;
      });

    // Calculate category percentages
    Object.keys(categoryBreakdown).forEach(category => {
      categoryPercentages[category] = expenses > 0 ? 
        (categoryBreakdown[category] / expenses * 100) : 0;
    });

    // Calculate income breakdown
    const incomeBreakdown: { [key: string]: number } = {};
    const incomePercentages: { [key: string]: number } = {};
    
    transactions
      .filter(transaction => transaction.type === 'income')
      .forEach(transaction => {
        incomeBreakdown[transaction.category] = 
          (incomeBreakdown[transaction.category] || 0) + transaction.amount;
      });

    // Calculate income percentages
    Object.keys(incomeBreakdown).forEach(category => {
      incomePercentages[category] = revenue > 0 ? 
        (incomeBreakdown[category] / revenue * 100) : 0;
    });

    // Calculate transaction counts
    const totalTransactions = transactions.length;
    const incomeTransactions = transactions.filter(t => t.type === 'income').length;
    const expenseTransactions = transactions.filter(t => t.type === 'expense').length;

    // Calculate average transaction amounts
    const averageIncomeAmount = incomeTransactions > 0 ? revenue / incomeTransactions : 0;
    const averageExpenseAmount = expenseTransactions > 0 ? expenses / expenseTransactions : 0;
    const averageTransactionAmount = totalTransactions > 0 ? (revenue + expenses) / totalTransactions : 0;

    // Calculate daily averages
    const daysDiff = Math.max(1, Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)));
    const dailyRevenue = revenue / daysDiff;
    const dailyExpenses = expenses / daysDiff;
    const dailyProfit = netProfit / daysDiff;

    // Get business profile for context
    const businessProfileDoc = await db
      .collection('users')
      .doc(userId)
      .collection('business_profile')
      .doc('profile')
      .get();

    let businessType = 'Unknown';
    if (businessProfileDoc.exists) {
      const profileData = businessProfileDoc.data()!;
      businessType = profileData.businessType || 'Unknown';
    }

    // Performance indicators
    const isProfit = netProfit > 0;
    const profitMarginHealth = profitMargin >= 15 ? 'Excellent' : 
                              profitMargin >= 10 ? 'Good' : 
                              profitMargin >= 5 ? 'Fair' : 'Poor';

    // Log the calculation
    await db
      .collection('users')
      .doc(userId)
      .collection('activity_log')
      .add({
        action: 'profit_margin_calculated',
        period,
        revenue,
        expenses,
        netProfit,
        profitMargin,
        timestamp: admin.firestore.Timestamp.now(),
        details: `Calculated profit margin for ${period} period`,
      });

    return {
      success: true,
      period,
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        days: daysDiff,
      },
      businessType,
      financial: {
        revenue,
        expenses,
        netProfit,
        profitMargin: Math.round(profitMargin * 100) / 100, // Round to 2 decimal places
        isProfit,
        profitMarginHealth,
      },
      breakdown: {
        categoryBreakdown,
        categoryPercentages,
        incomeBreakdown,
        incomePercentages,
      },
      transactions: {
        total: totalTransactions,
        income: incomeTransactions,
        expense: expenseTransactions,
      },
      averages: {
        dailyRevenue: Math.round(dailyRevenue * 100) / 100,
        dailyExpenses: Math.round(dailyExpenses * 100) / 100,
        dailyProfit: Math.round(dailyProfit * 100) / 100,
        averageIncomeAmount: Math.round(averageIncomeAmount * 100) / 100,
        averageExpenseAmount: Math.round(averageExpenseAmount * 100) / 100,
        averageTransactionAmount: Math.round(averageTransactionAmount * 100) / 100,
      },
      calculatedAt: new Date().toISOString(),
    };

  } catch (error) {
    console.error('Error calculating profit margin:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to calculate profit margin');
  }
};

function calculateDateRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  
  switch (period.toLowerCase()) {
    case 'weekly':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(now);
      weekEnd.setHours(23, 59, 59, 999);
      
      return { start: weekStart, end: weekEnd };

    case 'monthly':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      return { start: monthStart, end: monthEnd };

    case 'quarterly':
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0, 23, 59, 59, 999);
      
      return { start: quarterStart, end: quarterEnd };

    case 'yearly':
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      
      return { start: yearStart, end: yearEnd };

    case 'all_time':
      const allTimeStart = new Date(2020, 0, 1); // Reasonable start date
      const allTimeEnd = new Date(now.getFullYear() + 1, 11, 31, 23, 59, 59, 999);
      
      return { start: allTimeStart, end: allTimeEnd };

    default:
      throw new functions.https.HttpsError('invalid-argument', 
        'Invalid period. Valid periods are: weekly, monthly, quarterly, yearly, all_time');
  }
}