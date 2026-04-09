import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { getGeminiClient } from './geminiClient';
import { isGeminiEnabled } from './geminiConfig';

interface ExplainAnomalyData {
  userId: string;
  transactionId: string;
  amount: number;
  category: string;
  anomalyScore: number;
  averageAmount?: number;
}

interface AnomalyExplanation {
  explanation: string;
  suggestions: string[];
  severity: 'low' | 'medium' | 'high';
  isAIPowered: boolean;
}

/**
 * Explain spending anomaly detected by Isolation Forest
 * Integrates with ML anomaly detection to provide human-readable explanations
 */
export const explainAnomaly = functions.https.onCall(
  async (data: ExplainAnomalyData, context) => {
    // For testing in emulator, allow unauthenticated requests
    const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
    
    // Verify authentication (skip in emulator for testing)
    if (!context.auth && !isEmulator) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { userId, transactionId, amount, category, anomalyScore, averageAmount } = data;
    
    // Verify user can only explain their own anomalies (skip in emulator)
    if (context.auth && context.auth.uid !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Cannot explain other users anomalies');
    }

    try {
      const db = admin.firestore();
      
      // Get user data for context (optional in emulator)
      let userIncome: number | undefined;
      const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
      
      if (!isEmulator) {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
          throw new functions.https.HttpsError('not-found', 'User not found');
        }
        
        const userData = userDoc.data()!;
        userIncome = userData.weeklyIncome ? userData.weeklyIncome * 4.33 : undefined;
      }
      
      // Get budget for this category (optional in emulator)
      let budgetRemaining: number | undefined;
      
      if (!isEmulator) {
        const budgetSnapshot = await db
          .collection('users')
          .doc(userId)
          .collection('budgets')
          .where('category', '==', category)
          .where('isActive', '==', true)
          .limit(1)
          .get();
        
        if (!budgetSnapshot.empty) {
          const budget = budgetSnapshot.docs[0].data();
          budgetRemaining = budget.amount - (budget.spent || 0);
        }
      }
      
      // Determine severity based on anomaly score
      const severity = anomalyScore > 0.8 ? 'high' : anomalyScore > 0.5 ? 'medium' : 'low';
      
      let explanation: AnomalyExplanation;
      
      // Try AI-powered explanation first
      if (isGeminiEnabled()) {
        try {
          explanation = await generateAIExplanation({
            amount,
            category,
            averageAmount: averageAmount || amount / 2,
            userIncome,
            budgetRemaining,
            anomalyScore,
            severity,
          });
        } catch (error) {
          console.warn('AI explanation failed, using rule-based:', error);
          explanation = generateRuleBasedExplanation({
            amount,
            category,
            averageAmount: averageAmount || amount / 2,
            budgetRemaining,
            severity,
          });
        }
      } else {
        explanation = generateRuleBasedExplanation({
          amount,
          category,
          averageAmount: averageAmount || amount / 2,
          budgetRemaining,
          severity,
        });
      }
      
      // Store explanation in Firestore (skip in emulator)
      if (!isEmulator) {
        await db
          .collection('users')
          .doc(userId)
          .collection('anomaly_explanations')
          .add({
            transactionId,
            amount,
            category,
            anomalyScore,
            explanation: explanation.explanation,
            suggestions: explanation.suggestions,
            severity: explanation.severity,
            isAIPowered: explanation.isAIPowered,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
      }
      
      return {
        success: true,
        amount,
        category,
        ...explanation,
      };
      
    } catch (error: any) {
      console.error('Error explaining anomaly:', error);
      throw new functions.https.HttpsError('internal', `Failed to explain anomaly: ${error.message}`);
    }
  }
);

/**
 * Generate AI-powered anomaly explanation using Gemini
 */
async function generateAIExplanation(data: {
  amount: number;
  category: string;
  averageAmount: number;
  userIncome?: number;
  budgetRemaining?: number;
  anomalyScore: number;
  severity: string;
}): Promise<AnomalyExplanation> {
  const geminiClient = getGeminiClient();
  
  const aiResponse = await geminiClient.explainAnomaly(data);
  
  // Parse AI response into structured format
  // Extract suggestions (lines starting with -, •, or numbers)
  const lines = aiResponse.split('\n').filter(line => line.trim());
  const suggestions: string[] = [];
  let explanation = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^[-•\d.]/)) {
      // This looks like a suggestion
      suggestions.push(trimmed.replace(/^[-•\d.]\s*/, ''));
    } else if (!explanation && trimmed.length > 20) {
      // First substantial line is the explanation
      explanation = trimmed;
    }
  }
  
  // If no structured suggestions found, use the whole response as explanation
  if (suggestions.length === 0) {
    explanation = aiResponse;
    suggestions.push('Review your budget and adjust spending if needed');
    suggestions.push('Consider if this was a necessary expense');
  }
  
  return {
    explanation: explanation || aiResponse,
    suggestions: suggestions.slice(0, 3), // Limit to 3 suggestions
    severity: data.severity as 'low' | 'medium' | 'high',
    isAIPowered: true,
  };
}

/**
 * Generate rule-based anomaly explanation (fallback)
 */
function generateRuleBasedExplanation(data: {
  amount: number;
  category: string;
  averageAmount: number;
  budgetRemaining?: number;
  severity: string;
}): AnomalyExplanation {
  const multiplier = (data.amount / data.averageAmount).toFixed(1);
  
  let explanation = `This GHS ${data.amount.toFixed(2)} expense on ${data.category} is ${multiplier}x your usual spending in this category.`;
  
  const suggestions: string[] = [];
  
  // Add context-specific suggestions
  if (data.budgetRemaining !== undefined) {
    if (data.budgetRemaining < 0) {
      explanation += ` You've exceeded your ${data.category} budget.`;
      suggestions.push('Review your budget limits for this category');
      suggestions.push('Consider cutting back on non-essential expenses');
    } else if (data.budgetRemaining < data.amount) {
      explanation += ` You have GHS ${data.budgetRemaining.toFixed(2)} left in your budget.`;
      suggestions.push('Monitor remaining budget carefully');
    }
  }
  
  // Category-specific suggestions
  const categorySuggestions: { [key: string]: string[] } = {
    'Restaurant/Café': [
      'Try cooking at home more often',
      'Pack lunch for campus to save money',
      'Set a weekly eating-out budget',
    ],
    'Uber/Bolt': [
      'Consider using trotro for regular routes',
      'Share rides with friends to split costs',
      'Plan trips to reduce unnecessary rides',
    ],
    'Shopping': [
      'Wait 24 hours before making non-essential purchases',
      'Check if you really need this item',
      'Look for sales or second-hand alternatives',
    ],
    'Parties & Clubs': [
      'Set a night-out budget and stick to it',
      'Pre-drink at home to save money',
      'Limit club visits to special occasions',
    ],
  };
  
  const specificSuggestions = categorySuggestions[data.category];
  if (specificSuggestions) {
    suggestions.push(...specificSuggestions.slice(0, 2));
  } else {
    suggestions.push('Review if this expense aligns with your financial goals');
    suggestions.push('Consider if this was a one-time or recurring expense');
  }
  
  return {
    explanation,
    suggestions: suggestions.slice(0, 3),
    severity: data.severity as 'low' | 'medium' | 'high',
    isAIPowered: false,
  };
}
