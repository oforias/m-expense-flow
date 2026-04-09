import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { getGeminiClient } from './geminiClient';
import { isGeminiEnabled } from './geminiConfig';

interface AnalyzeSpendingPatternsData {
  userId: string;
  period?: 'monthly' | 'weekly' | 'semester';
  useAI?: boolean; // Optional flag to force AI usage
}

interface SpendingPattern {
  category: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  averageAmount: number;
}

interface AIInsight {
  title: string;
  message: string;
  type: 'warning' | 'success' | 'info' | 'tip';
  category: string;
  priority: 'high' | 'medium' | 'low';
  isPremium: boolean;
}

export const analyzeSpendingPatterns = functions.https.onCall(
  async (data: AnalyzeSpendingPatternsData, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { userId, period = 'monthly' } = data;
    
    // Verify user can only analyze their own data
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Cannot analyze other users data');
    }

    try {
      const db = admin.firestore();
      
      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case 'weekly':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'semester':
          startDate = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000); // ~4 months
          break;
        default: // monthly
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get user's transactions for the period
      const transactionsSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('transactions')
        .where('date', '>=', startDate)
        .where('type', '==', 'expense')
        .get();

      if (transactionsSnapshot.empty) {
        return {
          patterns: [],
          insights: [{
            title: 'Start Your Financial Journey',
            message: 'Add some transactions to get personalized insights about your spending patterns!',
            type: 'info',
            category: 'general',
            priority: 'medium',
            isPremium: false
          }],
          totalSpent: 0,
          period
        };
      }

      // Analyze spending patterns by category
      const categoryTotals = new Map<string, { amount: number; count: number }>();
      let totalSpent = 0;

      transactionsSnapshot.docs.forEach(doc => {
        const transaction = doc.data();
        const category = transaction.category;
        const amount = transaction.amount;
        
        totalSpent += amount;
        
        if (categoryTotals.has(category)) {
          const existing = categoryTotals.get(category)!;
          categoryTotals.set(category, {
            amount: existing.amount + amount,
            count: existing.count + 1
          });
        } else {
          categoryTotals.set(category, { amount, count: 1 });
        }
      });

      // Convert to spending patterns
      const patterns: SpendingPattern[] = Array.from(categoryTotals.entries()).map(([category, data]) => ({
        category,
        amount: data.amount,
        percentage: (data.amount / totalSpent) * 100,
        transactionCount: data.count,
        averageAmount: data.amount / data.count
      })).sort((a, b) => b.amount - a.amount);

      // Generate insights based on patterns
      const insights = await generateInsights(
        patterns, 
        totalSpent, 
        period, 
        userId, 
        data.useAI
      );

      // Save insights to Firestore
      const insightPromises = insights.map(insight => 
        db.collection('users')
          .doc(userId)
          .collection('ai_insights')
          .add({
            ...insight,
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
            isRead: false
          })
      );
      
      await Promise.all(insightPromises);

      return {
        patterns,
        insights,
        totalSpent,
        period
      };

    } catch (error) {
      console.error('Error analyzing spending patterns:', error);
      throw new functions.https.HttpsError('internal', 'Failed to analyze spending patterns');
    }
  }
);

async function generateInsights(
  patterns: SpendingPattern[], 
  totalSpent: number, 
  period: string,
  userId: string,
  useAI?: boolean
): Promise<AIInsight[]> {
  // Try AI-powered insights first if enabled
  if ((useAI || isGeminiEnabled()) && patterns.length > 0) {
    try {
      const aiInsights = await generateAIInsights(patterns, totalSpent, period, userId);
      if (aiInsights.length > 0) {
        console.log(`Generated ${aiInsights.length} AI-powered insights for user ${userId}`);
        return aiInsights;
      }
    } catch (error) {
      console.warn('AI insights generation failed, falling back to rule-based:', error);
      // Fall through to rule-based insights
    }
  }

  // Fallback to rule-based insights
  return generateRuleBasedInsights(patterns, totalSpent, period);
}

/**
 * Generate AI-powered insights using Gemini.
 * Returns structured per-category insights, not a single blob.
 */
async function generateAIInsights(
  patterns: SpendingPattern[],
  totalSpent: number,
  period: string,
  userId: string
): Promise<AIInsight[]> {
  const db = admin.firestore();

  const [userDoc, budgetsSnapshot, goalsSnapshot] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('users').doc(userId).collection('budgets').where('isActive', '==', true).get(),
    db.collection('users').doc(userId).collection('savings_goals').where('isCompleted', '==', false).get(),
  ]);

  const userData = userDoc.data();
  const monthlyIncome = userData?.weeklyIncome ? userData.weeklyIncome * 4.33 : undefined;

  const budgets = budgetsSnapshot.docs.map(doc => {
    const b = doc.data();
    return { category: b.category, limit: b.amount, spent: b.spent || 0 };
  });

  const goals = goalsSnapshot.docs.map(doc => {
    const g = doc.data();
    return { name: g.name, target: g.targetAmount, current: g.currentAmount || 0 };
  });

  const spendingLines = patterns
    .map(p => `  - ${p.category}: GHS ${p.amount.toFixed(2)} (${p.percentage.toFixed(1)}%, ${p.transactionCount} transactions, avg GHS ${p.averageAmount.toFixed(2)})`)
    .join('\n');

  const budgetLines = budgets.length > 0
    ? budgets.map(b => `  - ${b.category}: GHS ${b.spent.toFixed(2)} / GHS ${b.limit.toFixed(2)}`).join('\n')
    : '  None';

  const goalLines = goals.length > 0
    ? goals.map(g => `  - ${g.name}: GHS ${g.current.toFixed(2)} / GHS ${g.target.toFixed(2)}`).join('\n')
    : '  None';

  const prompt =
    `Analyze this student's ${period} spending in Ghana and return specific insights.\n\n` +
    `Income: ${monthlyIncome ? `GHS ${monthlyIncome.toFixed(2)}/month` : 'unknown'}\n` +
    `Total spent: GHS ${totalSpent.toFixed(2)}\n\n` +
    `Spending by category:\n${spendingLines}\n\n` +
    `Budgets:\n${budgetLines}\n\n` +
    `Savings goals:\n${goalLines}\n\n` +
    `Rules:\n` +
    `- Reference actual GHS amounts from the data above\n` +
    `- No generic advice — every insight must be specific to this data\n` +
    `- Ghana context: trotro vs Uber, midnight data bundles, campus food, situationship spending\n` +
    `- Return ONLY a JSON array, no markdown, no extra text:\n` +
    `[\n` +
    `  {\n` +
    `    "title": "short title",\n` +
    `    "message": "specific insight with actual numbers",\n` +
    `    "type": "warning|success|info|tip",\n` +
    `    "category": "category name",\n` +
    `    "priority": "high|medium|low",\n` +
    `    "isPremium": false\n` +
    `  }\n` +
    `]`;

  const geminiClient = getGeminiClient();
  const raw = await geminiClient.generateContent(prompt);
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed: any[];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Gemini did not return valid JSON');
    parsed = JSON.parse(match[0]);
  }

  return parsed.map((r: any) => ({
    title: r.title || 'Financial Insight',
    message: r.message || '',
    type: ['warning', 'success', 'info', 'tip'].includes(r.type) ? r.type : 'info',
    category: r.category || 'general',
    priority: ['high', 'medium', 'low'].includes(r.priority) ? r.priority : 'medium',
    isPremium: r.isPremium === true,
  }));
}

/**
 * Generate rule-based insights (fallback)
 */
function generateRuleBasedInsights(
  patterns: SpendingPattern[],
  totalSpent: number,
  period: string
): AIInsight[] {
  const insights: AIInsight[] = [];

  // High spending category insights (>30% of total)
  const highSpendingCategories = patterns.filter(p => p.percentage > 30);
  highSpendingCategories.forEach(pattern => {
    insights.push({
      title: `High ${pattern.category} Spending`,
      message: getHighSpendingMessage(pattern.category, pattern.percentage),
      type: 'warning',
      category: pattern.category,
      priority: 'high',
      isPremium: false
    });
  });

  // Frequent small transactions
  const frequentSmallSpending = patterns.filter(p => p.averageAmount < 10 && p.transactionCount > 5);
  frequentSmallSpending.forEach(pattern => {
    const semesterProjection = (pattern.amount / getDaysInPeriod(period)) * 120; // 4 months
    insights.push({
      title: `Small ${pattern.category} Expenses Add Up`,
      message: `Your ${pattern.transactionCount} small ${pattern.category} purchases (avg GHS ${pattern.averageAmount.toFixed(2)}) could cost GHS ${semesterProjection.toFixed(2)} per semester. Consider budgeting for these!`,
      type: 'info',
      category: pattern.category,
      priority: 'medium',
      isPremium: false
    });
  });

  // Ghana-specific transport insights
  const transportCategories = ['Uber/Bolt', 'Trotro & Transport'];
  const transportSpending = patterns.filter(p => transportCategories.includes(p.category));
  if (transportSpending.length > 0) {
    const totalTransport = transportSpending.reduce((sum, p) => sum + p.amount, 0);
    const transportPercentage = (totalTransport / totalSpent) * 100;
    
    if (transportPercentage > 20) {
      insights.push({
        title: 'Transport Spending Alert',
        message: `You're spending ${transportPercentage.toFixed(1)}% on transport. Consider mixing trotro with Uber/Bolt to save money - trotro for regular routes, Uber for emergencies or late nights.`,
        type: 'tip',
        category: 'transport',
        priority: 'medium',
        isPremium: false
      });
    }
  }

  // Data bundle insights
  const dataPattern = patterns.find(p => p.category === 'Data Bundles');
  if (dataPattern && dataPattern.percentage > 15) {
    insights.push({
      title: 'Data Bundle Optimization',
      message: `You're spending ${dataPattern.percentage.toFixed(1)}% on data. Try midnight bundles (12am-6am) for cheaper rates, or consider unlimited plans if you're a heavy user.`,
      type: 'tip',
      category: 'Data Bundles',
      priority: 'medium',
      isPremium: false
    });
  }

  // Situationship spending insight
  const situationshipPattern = patterns.find(p => p.category === 'Situationship Spending');
  if (situationshipPattern && situationshipPattern.percentage > 10) {
    insights.push({
      title: 'Relationship Spending Check',
      message: `You've spent ${situationshipPattern.percentage.toFixed(1)}% on situationship expenses. Remember to set boundaries and budget for relationship costs to avoid overspending.`,
      type: 'warning',
      category: 'Situationship Spending',
      priority: 'medium',
      isPremium: false
    });
  }

  // Impulse buying insight
  const impulsePattern = patterns.find(p => p.category === 'Impulse/TikTok Buys');
  if (impulsePattern) {
    insights.push({
      title: 'Impulse Purchase Awareness',
      message: `TikTok made you buy it, didn't it? 😅 You've spent GHS ${impulsePattern.amount.toFixed(2)} on impulse purchases. Try the 24-hour rule: wait a day before buying non-essentials.`,
      type: 'tip',
      category: 'Impulse/TikTok Buys',
      priority: 'medium',
      isPremium: false
    });
  }

  // General budgeting advice
  if (insights.length < 3) {
    insights.push({
      title: 'Great Spending Balance!',
      message: `Your spending looks well-distributed across categories. Keep tracking to maintain this healthy pattern and consider setting savings goals for your future plans.`,
      type: 'success',
      category: 'general',
      priority: 'low',
      isPremium: false
    });
  }

  // Limit to 8-10 insights as per requirements
  return insights.slice(0, 10);
}

function getHighSpendingMessage(category: string, percentage: number): string {
  const ghanaSpecificMessages: { [key: string]: string } = {
    'Restaurant/Café': `You're spending ${percentage.toFixed(1)}% on eating out. Consider packing lunch more often or cooking with friends to split costs.`,
    'Uber/Bolt': `${percentage.toFixed(1)}% on ride-hailing is quite high. Mix in some trotro rides for regular routes to save money.`,
    'Parties & Clubs': `${percentage.toFixed(1)}% on parties and clubs. Remember to set a night-out budget and stick to it - your future self will thank you!`,
    'Fashion & Clothes': `${percentage.toFixed(1)}% on fashion. Consider shopping during sales or at second-hand markets for better deals.`,
    'Data Bundles': `${percentage.toFixed(1)}% on data is significant. Look into unlimited plans or midnight bundles for better value.`,
    'Situationship Spending': `${percentage.toFixed(1)}% on situationship expenses. Set clear boundaries and budget limits for relationship spending.`
  };

  return ghanaSpecificMessages[category] || 
    `You're spending ${percentage.toFixed(1)}% on ${category}. Consider if this aligns with your financial priorities and look for ways to optimize.`;
}

function getDaysInPeriod(period: string): number {
  switch (period) {
    case 'weekly': return 7;
    case 'semester': return 120;
    default: return 30; // monthly
  }
}