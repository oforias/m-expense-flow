import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface EnforceTrackerLimitsData {
  userId: string;
  action: 'check' | 'create' | 'delete';
  trackerId?: string;
  categoryId?: string;
}

export const enforceTrackerLimits = functions.https.onCall(
  async (data: EnforceTrackerLimitsData, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { userId, action, trackerId, categoryId } = data;
    
    // Verify user can only manage their own trackers
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Cannot manage other users trackers');
    }

    try {
      const db = admin.firestore();
      
      // Get user document to check premium status
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found');
      }

      const userData = userDoc.data()!;
      const isPremium = userData.isPremium || false;
      
      // Check if premium subscription is still valid
      let validPremium = isPremium;
      if (isPremium && userData.premiumExpiryDate) {
        const expiryDate = userData.premiumExpiryDate.toDate();
        if (expiryDate < new Date()) {
          validPremium = false;
          // Update user status to reflect expired premium
          await userDoc.ref.update({
            isPremium: false,
            premiumExpiryDate: null,
            updatedAt: new Date()
          });
        }
      }

      // Get current tracker count
      const trackersSnapshot = await db.collection('users').doc(userId)
        .collection('overspending_trackers')
        .where('isActive', '==', true)
        .get();

      const currentCount = trackersSnapshot.size;
      const maxAllowed = validPremium ? 999 : 1; // Unlimited for premium, 1 for free

      switch (action) {
        case 'check':
          return {
            canCreate: currentCount < maxAllowed,
            currentCount,
            maxAllowed: validPremium ? -1 : maxAllowed, // -1 indicates unlimited
            isPremium: validPremium,
            message: validPremium 
              ? `You have ${currentCount} active trackers (unlimited allowed)`
              : `You have ${currentCount}/${maxAllowed} active trackers`
          };

        case 'create':
          if (!categoryId) {
            throw new functions.https.HttpsError('invalid-argument', 'Category ID required for creating tracker');
          }

          // Check if user already has a tracker for this category
          const existingTracker = await db.collection('users').doc(userId)
            .collection('overspending_trackers')
            .where('category', '==', categoryId)
            .where('isActive', '==', true)
            .get();

          if (!existingTracker.empty) {
            throw new functions.https.HttpsError('already-exists', 'Tracker already exists for this category');
          }

          if (currentCount >= maxAllowed) {
            return {
              canCreate: false,
              currentCount,
              maxAllowed: validPremium ? -1 : maxAllowed,
              isPremium: validPremium,
              message: validPremium 
                ? 'Error: Unable to create tracker'
                : `You've reached the limit of ${maxAllowed} tracker${maxAllowed === 1 ? '' : 's'}. Upgrade to Premium for unlimited trackers.`
            };
          }

          // Create the tracker
          const newTrackerId = `tracker_${Date.now()}`;
          await db.collection('users').doc(userId)
            .collection('overspending_trackers').doc(newTrackerId).set({
              trackerId: newTrackerId,
              userId: userId,
              category: categoryId,
              createdAt: new Date(),
              updatedAt: new Date(),
              isActive: true,
              dailyAggregates: [],
              weeklyAggregates: [],
              hasEnoughDataForDaily: false,
              hasEnoughDataForWeekly: false,
              categoryType: getCategoryType(categoryId)
            });

          return {
            canCreate: true,
            currentCount: currentCount + 1,
            maxAllowed: validPremium ? -1 : maxAllowed,
            isPremium: validPremium,
            message: `Tracker created successfully for ${categoryId}`
          };

        case 'delete':
          if (!trackerId) {
            throw new functions.https.HttpsError('invalid-argument', 'Tracker ID required for deletion');
          }

          // Delete the tracker
          await db.collection('users').doc(userId)
            .collection('overspending_trackers').doc(trackerId).update({
              isActive: false,
              updatedAt: new Date()
            });

          return {
            canCreate: true,
            currentCount: Math.max(0, currentCount - 1),
            maxAllowed: validPremium ? -1 : maxAllowed,
            isPremium: validPremium,
            message: 'Tracker deleted successfully'
          };

        default:
          throw new functions.https.HttpsError('invalid-argument', 'Invalid action specified');
      }

    } catch (error) {
      console.error('Error enforcing tracker limits:', error);
      throw new functions.https.HttpsError('internal', 'Failed to enforce tracker limits');
    }
  }
);

// Helper function to classify categories
function getCategoryType(categoryId: string): 'want' | 'need' | 'hybrid' {
  const wantCategories = [
    'Restaurant/Café', 'Parties & Clubs', 'Situationship Spending', 
    'Impulse/TikTok Buys', 'Fashion & Clothes', 'Entertainment', 
    'Beauty & Grooming', 'Alcohol & Smoking', 'Gaming', 'Hobbies', 
    'Subscriptions', 'Snacks & Treats', 'Social Media Shopping'
  ];

  const needCategories = [
    'Uber/Bolt', 'Trotro & Transport', 'Data Bundles', 'Groceries', 
    'Medicine & Health', 'Academic Materials', 'Rent & Utilities', 
    'Emergency Expenses'
  ];

  const hybridCategories = [
    'App Payments', 'Gym Membership', 'Tech Repairs', 'Gifts & Family Support'
  ];

  if (wantCategories.includes(categoryId)) return 'want';
  if (needCategories.includes(categoryId)) return 'need';
  if (hybridCategories.includes(categoryId)) return 'hybrid';
  
  // Default to hybrid for unknown categories
  return 'hybrid';
}