import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface VerifySubscriptionData {
  userId: string;
  subscriptionId?: string;
  paymentToken?: string;
}

export const verifySubscription = functions.https.onCall(
  async (data: VerifySubscriptionData, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { userId, subscriptionId, paymentToken } = data;
    
    // Verify user can only verify their own subscription
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Cannot verify other users subscription');
    }

    try {
      const db = admin.firestore();
      
      // Get user document
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found');
      }

      const userData = userDoc.data()!;
      
      // If payment token is provided, this is a new subscription
      if (paymentToken) {
        // In a real implementation, you would verify the payment with your payment provider
        // For now, we'll simulate successful payment verification
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 month subscription
        
        // Update user to premium status
        await userDoc.ref.update({
          isPremium: true,
          premiumExpiryDate: expiryDate,
          subscriptionId: subscriptionId || `sub_${Date.now()}`,
          updatedAt: new Date()
        });

        // Award premium upgrade achievement
        await db.collection('users').doc(userId).collection('achievements').doc('premium_upgrade').set({
          achievementId: 'premium_upgrade',
          userId: userId,
          unlocked: true,
          unlockedDate: new Date(),
          xpAwarded: 100
        });

        // Award XP for premium upgrade
        await userDoc.ref.update({
          xp: (userData.xp || 0) + 100
        });

        return {
          isActive: true,
          expiryDate: expiryDate,
          subscriptionId: subscriptionId || `sub_${Date.now()}`,
          plan: 'premium' as const,
          features: [
            'unlimited_budgets',
            'unlimited_savings_goals',
            'unlimited_overspending_trackers',
            'business_mode',
            'advanced_ai_insights',
            'comparative_analysis',
            'data_export',
            'comprehensive_budgets'
          ]
        };
      }

      // Check existing subscription status
      const isPremium = userData.isPremium || false;
      const expiryDate = userData.premiumExpiryDate ? userData.premiumExpiryDate.toDate() : null;
      const currentSubscriptionId = userData.subscriptionId || null;

      // Check if subscription has expired
      if (isPremium && expiryDate && expiryDate < new Date()) {
        // Subscription expired, downgrade to free
        await userDoc.ref.update({
          isPremium: false,
          premiumExpiryDate: null,
          updatedAt: new Date()
        });

        return {
          isActive: false,
          expiryDate: null,
          subscriptionId: currentSubscriptionId,
          plan: 'free' as const,
          features: [
            'basic_budgets', // 3 max
            'basic_savings_goals', // 3 max
            'basic_overspending_tracker', // 1 max
            'basic_ai_insights'
          ]
        };
      }

      return {
        isActive: isPremium,
        expiryDate: expiryDate,
        subscriptionId: currentSubscriptionId,
        plan: isPremium ? 'premium' as const : 'free' as const,
        features: isPremium ? [
          'unlimited_budgets',
          'unlimited_savings_goals',
          'unlimited_overspending_trackers',
          'business_mode',
          'advanced_ai_insights',
          'comparative_analysis',
          'data_export',
          'comprehensive_budgets'
        ] : [
          'basic_budgets',
          'basic_savings_goals',
          'basic_overspending_tracker',
          'basic_ai_insights'
        ]
      };

    } catch (error) {
      console.error('Error verifying subscription:', error);
      throw new functions.https.HttpsError('internal', 'Failed to verify subscription');
    }
  }
);