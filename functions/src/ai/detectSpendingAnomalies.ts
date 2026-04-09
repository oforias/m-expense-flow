import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

interface DetectSpendingAnomaliesData {
  userId: string;
  period?: 'monthly' | 'weekly' | 'semester';
  categories?: string[];
}

interface SpendingAnomaly {
  category: string;
  currentAmount: number;
  averageAmount: number;
  deviationPercentage: number;
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestions: string[];
  detectedAt: string;
}

interface CategoryStats {
  category: string;
  amounts: number[];
  average: number;
  standardDeviation: number;
  currentAmount: number;
}

export const detectSpendingAnomalies = functions.https.onCall(
  async (data: DetectSpendingAnomaliesData, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { userId, period = 'monthly', categories } = data;
    
    // Verify user can only analyze their own data
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Cannot analyze other users data');
    }

    try {
      const db = admin.firestore();
      
      // Calculate date ranges for comparison
      const now = new Date();
      const periodDays = getPeriodDays(period);
      
      // Historical periods for comparison (last 6 periods)
      const historicalPeriodStart = new Date(now.getTime() - 6 * periodDays * 24 * 60 * 60 * 1000);

      // Get transactions for analysis
      const transactionsSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('transactions')
        .where('date', '>=', historicalPeriodStart)
        .where('type', '==', 'expense')
        .get();

      if (transactionsSnapshot.empty) {
        return {
          anomalies: [],
          message: 'Not enough transaction data for anomaly detection',
          period
        };
      }

      // Group transactions by period and category
      const periodData = groupTransactionsByPeriod(
        transactionsSnapshot.docs.map(doc => ({
          ...doc.data(),
          date: doc.data().date.toDate()
        })),
        periodDays,
        now
      );

      // Calculate category statistics
      const categoryStats = calculateCategoryStats(periodData, categories);

      // Detect anomalies
      const anomalies = detectAnomalies(categoryStats);

      // Save anomalies to Firestore for tracking
      if (anomalies.length > 0) {
        const batch = db.batch();
        anomalies.forEach(anomaly => {
          const docRef = db.collection('users').doc(userId).collection('spending_anomalies').doc();
          batch.set(docRef, {
            ...anomaly,
            detectedAt: admin.firestore.FieldValue.serverTimestamp(),
            period,
            isResolved: false
          });
        });
        await batch.commit();
      }

      return {
        anomalies,
        period,
        detectedAt: new Date().toISOString(),
        totalAnomalies: anomalies.length
      };

    } catch (error) {
      console.error('Error detecting spending anomalies:', error);
      throw new functions.https.HttpsError('internal', 'Failed to detect spending anomalies');
    }
  }
);

function getPeriodDays(period: string): number {
  switch (period) {
    case 'weekly': return 7;
    case 'semester': return 120;
    default: return 30; // monthly
  }
}

function groupTransactionsByPeriod(
  transactions: any[],
  periodDays: number,
  currentDate: Date
): Map<number, Map<string, number>> {
  const periodData = new Map<number, Map<string, number>>();

  transactions.forEach(transaction => {
    const transactionDate = transaction.date;
    const daysDiff = Math.floor((currentDate.getTime() - transactionDate.getTime()) / (24 * 60 * 60 * 1000));
    const periodIndex = Math.floor(daysDiff / periodDays);

    if (periodIndex >= 6) return; // Only keep last 6 periods

    if (!periodData.has(periodIndex)) {
      periodData.set(periodIndex, new Map<string, number>());
    }

    const categoryMap = periodData.get(periodIndex)!;
    const category = transaction.category;
    const amount = transaction.amount;

    categoryMap.set(category, (categoryMap.get(category) || 0) + amount);
  });

  return periodData;
}

function calculateCategoryStats(
  periodData: Map<number, Map<string, number>>,
  targetCategories?: string[]
): CategoryStats[] {
  const categoryStats = new Map<string, number[]>();

  // Collect amounts for each category across all periods
  for (let period = 1; period < 6; period++) { // Periods 1-5 (historical)
    const periodMap = periodData.get(period) || new Map();
    
    // Get all categories from all periods
    const allCategories = new Set<string>();
    periodData.forEach(pMap => {
      pMap.forEach((_, category) => allCategories.add(category));
    });

    allCategories.forEach(category => {
      if (targetCategories && !targetCategories.includes(category)) return;
      
      if (!categoryStats.has(category)) {
        categoryStats.set(category, []);
      }
      
      const amount = periodMap.get(category) || 0;
      categoryStats.get(category)!.push(amount);
    });
  }

  // Calculate statistics for each category
  const stats: CategoryStats[] = [];
  const currentPeriodMap = periodData.get(0) || new Map(); // Current period

  categoryStats.forEach((amounts, category) => {
    if (amounts.length < 3) return; // Need at least 3 historical periods

    const average = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - average, 2), 0) / amounts.length;
    const standardDeviation = Math.sqrt(variance);
    const currentAmount = currentPeriodMap.get(category) || 0;

    stats.push({
      category,
      amounts,
      average,
      standardDeviation,
      currentAmount
    });
  });

  return stats;
}

function detectAnomalies(categoryStats: CategoryStats[]): SpendingAnomaly[] {
  const anomalies: SpendingAnomaly[] = [];

  categoryStats.forEach(stats => {
    const { category, average, standardDeviation, currentAmount } = stats;

    // Skip if no variation in historical data
    if (standardDeviation === 0) return;

    // Calculate Z-score
    const zScore = Math.abs((currentAmount - average) / standardDeviation);
    
    // Determine if it's an anomaly (threshold: 2 standard deviations)
    if (zScore >= 2) {
      const deviationPercentage = ((currentAmount - average) / average) * 100;
      const isIncrease = currentAmount > average;
      
      let severity: 'low' | 'medium' | 'high';
      if (zScore >= 3) severity = 'high';
      else if (zScore >= 2.5) severity = 'medium';
      else severity = 'low';

      const anomaly: SpendingAnomaly = {
        category,
        currentAmount,
        averageAmount: average,
        deviationPercentage,
        severity,
        message: generateAnomalyMessage(category, isIncrease, Math.abs(deviationPercentage), severity),
        suggestions: generateSuggestions(category, isIncrease, severity),
        detectedAt: new Date().toISOString()
      };

      anomalies.push(anomaly);
    }
  });

  return anomalies.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}

function generateAnomalyMessage(
  category: string,
  isIncrease: boolean,
  deviationPercentage: number,
  severity: 'low' | 'medium' | 'high'
): string {
  const direction = isIncrease ? 'increased' : 'decreased';
  const emoji = isIncrease ? '📈' : '📉';
  
  const severityMessages = {
    high: 'significantly',
    medium: 'notably',
    low: 'somewhat'
  };

  return `${emoji} Your ${category} spending has ${severityMessages[severity]} ${direction} by ${deviationPercentage.toFixed(1)}% compared to your usual pattern.`;
}

function generateSuggestions(
  category: string,
  isIncrease: boolean,
  severity: 'low' | 'medium' | 'high'
): string[] {
  if (!isIncrease) {
    return [`Great job reducing your ${category} spending! Keep up the good work.`];
  }

  const ghanaSpecificSuggestions: { [key: string]: string[] } = {
    'Uber/Bolt': [
      'Consider using trotro for regular routes to save money',
      'Plan your trips to reduce multiple short rides',
      'Share rides with friends when possible'
    ],
    'Restaurant/Café': [
      'Try cooking more meals at home or with friends',
      'Pack lunch instead of buying food on campus',
      'Look for student discounts at local eateries'
    ],
    'Data Bundles': [
      'Switch to midnight bundles (12am-6am) for cheaper rates',
      'Consider unlimited plans if you\'re a heavy user',
      'Use campus WiFi more often'
    ],
    'Parties & Clubs': [
      'Set a weekly entertainment budget and stick to it',
      'Pre-drink responsibly to reduce club expenses',
      'Look for student night discounts'
    ],
    'Situationship Spending': [
      'Set clear boundaries on relationship expenses',
      'Suggest free or low-cost date activities',
      'Remember that meaningful relationships don\'t require expensive gifts'
    ],
    'Impulse/TikTok Buys': [
      'Use the 24-hour rule before making non-essential purchases',
      'Unfollow accounts that trigger impulse buying',
      'Set a monthly limit for impulse purchases'
    ]
  };

  const generalSuggestions = [
    `Review your recent ${category} transactions to identify the cause`,
    `Set a budget limit for ${category} to control future spending`,
    `Track this category more closely for the next few weeks`
  ];

  return ghanaSpecificSuggestions[category] || generalSuggestions;
}