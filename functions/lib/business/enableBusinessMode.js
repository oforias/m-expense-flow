"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enableBusinessMode = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.enableBusinessMode = functions.https.onCall(async (data, context) => {
    var _a;
    try {
        const { userId, businessName, businessType, description = '' } = data;
        if (!userId || !businessName || !businessType) {
            throw new functions.https.HttpsError('invalid-argument', 'User ID, business name, and business type are required');
        }
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        if (context.auth.uid !== userId) {
            throw new functions.https.HttpsError('permission-denied', 'User can only access their own data');
        }
        const db = admin.firestore();
        // Check if user has premium access
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }
        const userData = userDoc.data();
        if (!(userData === null || userData === void 0 ? void 0 : userData.isPremium)) {
            throw new functions.https.HttpsError('permission-denied', 'Premium subscription required for Business Mode');
        }
        // Validate business type
        const validBusinessTypes = [
            'Fashion Reseller',
            'Food Vendor',
            'Digital Services',
            'Hair & Beauty',
            'Tutoring Services',
            'E-commerce'
        ];
        if (!validBusinessTypes.includes(businessType)) {
            throw new functions.https.HttpsError('invalid-argument', `Invalid business type. Valid types are: ${validBusinessTypes.join(', ')}`);
        }
        // Check if business mode is already enabled
        const existingBusinessProfile = await db
            .collection('users')
            .doc(userId)
            .collection('business_profile')
            .doc('profile')
            .get();
        if (existingBusinessProfile.exists && ((_a = existingBusinessProfile.data()) === null || _a === void 0 ? void 0 : _a.isActive)) {
            throw new functions.https.HttpsError('already-exists', 'Business Mode is already enabled for this user');
        }
        const now = admin.firestore.Timestamp.now();
        // Create business profile
        const businessProfile = {
            userId,
            businessName: businessName.trim(),
            businessType,
            description: description.trim(),
            startDate: now,
            isActive: true,
            createdAt: now,
            updatedAt: now
        };
        // Save business profile
        await db
            .collection('users')
            .doc(userId)
            .collection('business_profile')
            .doc('profile')
            .set(businessProfile);
        // Update user document to indicate business mode is enabled
        await db.collection('users').doc(userId).update({
            businessModeEnabled: true,
            businessType,
            updatedAt: now
        });
        // Award XP for enabling business mode
        const currentXP = userData.xp || 0;
        const xpReward = 50; // XP for enabling business mode
        const newXP = currentXP + xpReward;
        const newLevel = Math.floor(newXP / 100) + 1;
        await db.collection('users').doc(userId).update({
            xp: newXP,
            level: newLevel
        });
        // Check for business mode achievement
        const achievementId = 'business_mode_enabled';
        const userAchievementRef = db
            .collection('users')
            .doc(userId)
            .collection('achievements')
            .doc(achievementId);
        const achievementDoc = await userAchievementRef.get();
        if (!achievementDoc.exists) {
            await userAchievementRef.set({
                achievementId,
                userId,
                unlocked: true,
                unlockedDate: now,
                xpAwarded: 25
            });
            // Award additional XP for achievement
            await db.collection('users').doc(userId).update({
                xp: newXP + 25,
                level: Math.floor((newXP + 25) / 100) + 1
            });
        }
        // Create initial business categories based on business type
        const businessCategories = getBusinessCategories(businessType);
        // Log the business mode activation
        await db
            .collection('users')
            .doc(userId)
            .collection('activity_log')
            .add({
            action: 'business_mode_enabled',
            businessType,
            businessName,
            timestamp: now,
            details: `Business Mode enabled for ${businessType}: ${businessName}`
        });
        functions.logger.info(`Business Mode enabled for user ${userId}: ${businessName} (${businessType})`);
        return {
            success: true,
            businessProfile: Object.assign(Object.assign({}, businessProfile), { startDate: businessProfile.startDate.toDate().toISOString(), createdAt: businessProfile.createdAt.toDate().toISOString(), updatedAt: businessProfile.updatedAt.toDate().toISOString() }),
            xpAwarded: xpReward,
            achievementUnlocked: !achievementDoc.exists,
            businessCategories,
            message: `Business Mode successfully enabled for ${businessName}`
        };
    }
    catch (error) {
        functions.logger.error('Error enabling business mode:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to enable Business Mode');
    }
});
function getBusinessCategories(businessType) {
    const categoryMap = {
        'Fashion Reseller': [
            'Inventory Purchase',
            'Marketing & Advertising',
            'Shipping & Delivery',
            'Platform Fees',
            'Photography',
            'Packaging Materials'
        ],
        'Food Vendor': [
            'Ingredients & Supplies',
            'Packaging & Containers',
            'Equipment & Utensils',
            'Transportation',
            'Marketing',
            'Permits & Licenses'
        ],
        'Digital Services': [
            'Software & Tools',
            'Internet & Data',
            'Marketing & Advertising',
            'Equipment & Hardware',
            'Training & Courses',
            'Client Entertainment'
        ],
        'Hair & Beauty': [
            'Products & Supplies',
            'Equipment & Tools',
            'Rent & Utilities',
            'Marketing',
            'Training & Certification',
            'Transportation'
        ],
        'Tutoring Services': [
            'Learning Materials',
            'Transportation',
            'Marketing',
            'Equipment & Supplies',
            'Venue Rental',
            'Certification & Training'
        ],
        'E-commerce': [
            'Product Sourcing',
            'Platform Fees',
            'Shipping & Logistics',
            'Marketing & Advertising',
            'Packaging',
            'Customer Service Tools'
        ]
    };
    return categoryMap[businessType] || [
        'Business Expenses',
        'Marketing',
        'Equipment',
        'Transportation',
        'Supplies',
        'Other'
    ];
}
//# sourceMappingURL=enableBusinessMode.js.map