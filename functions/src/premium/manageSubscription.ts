import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface ManageSubscriptionData {
  userId: string;
  action: 'upgrade' | 'downgrade' | 'cancel' | 'renew';
  subscriptionData?: {
    plan: 'premium';
    paymentToken: string;
    duration: 'monthly' | 'yearly';
  };
}

export const manageSubscription = functions.https.onCall(
  async (data: ManageSubscriptionData, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { userId, action, subscriptionData } = data;
    
    // Verify user can only manage their own subscription
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Cannot manage other users subscription');
    }

    try {
      const db = admin.firestore();
      
      // Get user document
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found');
      }

      const userData = userDoc.data()!;

      switch (action) {
        case 'upgrade':
          if (!subscriptionData) {
            throw new functions.https.HttpsError('invalid-argument', 'Subscription data required for upgrade');
          }

          // In a real implementation, process payment with payment provider
          // For now, simulate successful payment
          const expiryDate = new Date();
          if (subscriptionData.duration === 'yearly') {
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
          } else {
            expiryDate.setMonth(expiryDate.getMonth() + 1);
          }

          await userDoc.ref.update({
            isPremium: true,
            premiumExpiryDate: expiryDate,
            subscriptionId: `sub_${Date.now()}`,
            subscriptionPlan: subscriptionData.plan,
            subscriptionDuration: subscriptionData.duration,
            updatedAt: new Date()
          });

          // Award premium achievement if not already unlocked
          const achievementDoc = await db.collection('users').doc(userId)
            .collection('achievements').doc('premium_upgrade').get();
          
          if (!achievementDoc.exists || !achievementDoc.data()?.unlocked) {
            await db.collection('users').doc(userId).collection('achievements').doc('premium_upgrade').set({
              achievementId: 'premium_upgrade',
              userId: userId,
              unlocked: true,
              unlockedDate: new Date(),
              xpAwarded: 100
            });

            // Award XP
            await userDoc.ref.update({
              xp: (userData.xp || 0) + 100
            });
          }

          return {
            success: true,
            message: 'Successfully upgraded to Premium!',
            subscriptionStatus: {
              isActive: true,
              expiryDate: expiryDate,
              plan: 'premium' as const
            }
          };

        case 'cancel':
          await userDoc.ref.update({
            isPremium: false,
            premiumExpiryDate: null,
            subscriptionId: null,
            subscriptionPlan: null,
            subscriptionDuration: null,
            updatedAt: new Date()
          });

          return {
            success: true,
            message: 'Subscription cancelled successfully',
            subscriptionStatus: {
              isActive: false,
              expiryDate: null,
              plan: 'free' as const
            }
          };

        case 'renew':
          if (!userData.isPremium) {
            throw new functions.https.HttpsError('failed-precondition', 'No active subscription to renew');
          }

          const currentExpiry = userData.premiumExpiryDate ? userData.premiumExpiryDate.toDate() : new Date();
          const newExpiryDate = new Date(currentExpiry);
          
          // Extend by one month from current expiry
          newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);

          await userDoc.ref.update({
            premiumExpiryDate: newExpiryDate,
            updatedAt: new Date()
          });

          return {
            success: true,
            message: 'Subscription renewed successfully',
            subscriptionStatus: {
              isActive: true,
              expiryDate: newExpiryDate,
              plan: 'premium' as const
            }
          };

        case 'downgrade':
          // Keep premium until expiry, but don't auto-renew
          await userDoc.ref.update({
            subscriptionAutoRenew: false,
            updatedAt: new Date()
          });

          return {
            success: true,
            message: 'Subscription will not auto-renew. Premium features will remain active until expiry.',
            subscriptionStatus: {
              isActive: userData.isPremium || false,
              expiryDate: userData.premiumExpiryDate ? userData.premiumExpiryDate.toDate() : null,
              plan: userData.isPremium ? 'premium' as const : 'free' as const
            }
          };

        default:
          throw new functions.https.HttpsError('invalid-argument', 'Invalid action specified');
      }

    } catch (error) {
      console.error('Error managing subscription:', error);
      throw new functions.https.HttpsError('internal', 'Failed to manage subscription');
    }
  }
);