"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkTrialExpiration = exports.upgradeFromTrial = exports.scheduleTrialReminder = exports.cancelTrialOnUpgrade = exports.startFreeTrial = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
/**
 * Start 14-day free trial for a user
 * Validates eligibility and creates trial record
 */
exports.startFreeTrial = functions.https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { userId } = data;
    // Verify user can only start their own trial
    if (context.auth.uid !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Cannot start trial for other users');
    }
    try {
        const db = admin.firestore();
        // Get user document
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }
        const userData = userDoc.data();
        // Check if user has already used trial
        if (userData.hasUsedFreeTrial) {
            throw new functions.https.HttpsError('failed-precondition', 'User has already used free trial');
        }
        // Check if user is already premium
        if (userData.isPremium) {
            throw new functions.https.HttpsError('failed-precondition', 'User is already premium');
        }
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
        const trialId = `trial_${userId}_${now.getTime()}`;
        const trialStatus = {
            userId: userId,
            isActive: true,
            startDate: now.toISOString(),
            endDate: trialEnd.toISOString(),
            remainingDays: 14,
            hasUsedTrial: true,
            trialId: trialId,
        };
        const batch = db.batch();
        // Create trial document
        const trialRef = db.collection('users').doc(userId).collection('trials').doc(trialId);
        batch.set(trialRef, Object.assign(Object.assign({}, trialStatus), { createdAt: now }));
        // Update user document
        const userRef = db.collection('users').doc(userId);
        batch.update(userRef, {
            hasUsedFreeTrial: true,
            trialStatus: trialStatus,
            trialStartDate: now.toISOString(),
            trialEndDate: trialEnd.toISOString(),
            updatedAt: now,
        });
        await batch.commit();
        // Schedule trial expiration reminders
        await scheduleTrialReminders(userId, trialEnd);
        return {
            success: true,
            message: 'Free trial started successfully',
            trialStatus: trialStatus,
        };
    }
    catch (error) {
        console.error('Error starting free trial:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', `Failed to start free trial: ${error.message}`);
    }
});
/**
 * Cancel trial when user upgrades to premium
 * Updates trial status to inactive
 */
exports.cancelTrialOnUpgrade = functions.https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { userId, reason } = data;
    // Verify user can only cancel their own trial
    if (context.auth.uid !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Cannot cancel trial for other users');
    }
    try {
        const db = admin.firestore();
        // Get user document
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }
        const userData = userDoc.data();
        const trialStatus = userData.trialStatus;
        if (!trialStatus || !trialStatus.isActive) {
            return {
                success: true,
                message: 'No active trial to cancel',
            };
        }
        const batch = db.batch();
        // Update trial document
        if (trialStatus.trialId) {
            const trialRef = db.collection('users').doc(userId).collection('trials').doc(trialStatus.trialId);
            batch.update(trialRef, {
                isActive: false,
                cancelledAt: new Date(),
                cancelReason: reason || 'upgraded_to_premium',
                updatedAt: new Date(),
            });
        }
        // Update user document
        const userRef = db.collection('users').doc(userId);
        batch.update(userRef, {
            'trialStatus.isActive': false,
            updatedAt: new Date(),
        });
        await batch.commit();
        return {
            success: true,
            message: 'Trial cancelled successfully',
        };
    }
    catch (error) {
        console.error('Error cancelling trial:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', `Failed to cancel trial: ${error.message}`);
    }
});
/**
 * Schedule trial expiration reminder
 * Sends notification 3 days before trial ends
 */
exports.scheduleTrialReminder = functions.https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { userId, reminderDate, trialEndDate } = data;
    // Verify user can only schedule their own reminders
    if (context.auth.uid !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Cannot schedule reminders for other users');
    }
    try {
        const db = admin.firestore();
        // Store reminder schedule
        await db.collection('users').doc(userId).collection('trial_reminders').doc('schedule').set({
            reminderDate: reminderDate,
            trialEndDate: trialEndDate,
            createdAt: new Date().toISOString(),
        });
        return {
            success: true,
            message: 'Trial reminder scheduled successfully',
        };
    }
    catch (error) {
        console.error('Error scheduling trial reminder:', error);
        throw new functions.https.HttpsError('internal', `Failed to schedule reminder: ${error.message}`);
    }
});
/**
 * Upgrade from trial to premium subscription
 * Seamlessly transitions user from trial to paid subscription
 */
exports.upgradeFromTrial = functions.https.onCall(async (data, context) => {
    var _a, _b;
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { userId, planType, paymentReference } = data;
    // Verify user can only upgrade their own account
    if (context.auth.uid !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Cannot upgrade other users');
    }
    try {
        const db = admin.firestore();
        // Get user document
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }
        const userData = userDoc.data();
        const trialStatus = userData.trialStatus;
        // Verify payment was successful
        const paymentDoc = await db.collection('pending_payments').doc(paymentReference).get();
        if (!paymentDoc.exists || ((_a = paymentDoc.data()) === null || _a === void 0 ? void 0 : _a.status) !== 'completed') {
            throw new functions.https.HttpsError('failed-precondition', 'Payment not completed');
        }
        // Calculate expiry date
        const now = new Date();
        const expiryDate = new Date(now);
        switch (planType) {
            case 'monthly':
                expiryDate.setMonth(expiryDate.getMonth() + 1);
                break;
            case 'semester':
                expiryDate.setMonth(expiryDate.getMonth() + 6);
                break;
            case 'yearly':
                expiryDate.setFullYear(expiryDate.getFullYear() + 1);
                break;
        }
        const batch = db.batch();
        // Cancel trial if active
        if (trialStatus && trialStatus.isActive && trialStatus.trialId) {
            const trialRef = db.collection('users').doc(userId).collection('trials').doc(trialStatus.trialId);
            batch.update(trialRef, {
                isActive: false,
                cancelledAt: now,
                cancelReason: 'upgraded_to_premium',
                updatedAt: now,
            });
        }
        // Update user to premium
        const userRef = db.collection('users').doc(userId);
        batch.update(userRef, {
            isPremium: true,
            premiumExpiryDate: expiryDate,
            subscriptionId: `sub_${paymentReference}`,
            subscriptionPlan: 'premium',
            subscriptionDuration: planType,
            'trialStatus.isActive': false,
            lastPaymentDate: now,
            upgradedFromTrial: true,
            updatedAt: now,
        });
        // Award premium achievement if not already unlocked
        const achievementDoc = await db.collection('users').doc(userId)
            .collection('achievements').doc('premium_upgrade').get();
        if (!achievementDoc.exists || !((_b = achievementDoc.data()) === null || _b === void 0 ? void 0 : _b.unlocked)) {
            const achievementRef = db.collection('users').doc(userId)
                .collection('achievements').doc('premium_upgrade');
            batch.set(achievementRef, {
                achievementId: 'premium_upgrade',
                userId: userId,
                unlocked: true,
                unlockedDate: now,
                xpAwarded: 100,
            });
            // Award XP
            batch.update(userRef, {
                xp: (userData.xp || 0) + 100,
            });
        }
        await batch.commit();
        return {
            success: true,
            message: 'Successfully upgraded to premium from trial',
            subscriptionStatus: {
                isActive: true,
                expiryDate: expiryDate.toISOString(),
                plan: 'premium',
                duration: planType,
            },
        };
    }
    catch (error) {
        console.error('Error upgrading from trial:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', `Failed to upgrade from trial: ${error.message}`);
    }
});
/**
 * Check trial expiration and handle expired trials
 * Scheduled function that runs daily
 */
exports.checkTrialExpiration = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date();
    try {
        // Get all users with active trials
        const usersSnapshot = await db.collection('users')
            .where('trialStatus.isActive', '==', true)
            .get();
        const batch = db.batch();
        let expiredCount = 0;
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const trialStatus = userData.trialStatus;
            if (!trialStatus || !trialStatus.endDate) {
                continue;
            }
            const trialEndDate = new Date(trialStatus.endDate);
            // Check if trial has expired
            if (now > trialEndDate) {
                // Update trial document
                if (trialStatus.trialId) {
                    const trialRef = db.collection('users').doc(userDoc.id)
                        .collection('trials').doc(trialStatus.trialId);
                    batch.update(trialRef, {
                        isActive: false,
                        expiredAt: now,
                        updatedAt: now,
                    });
                }
                // Update user document
                batch.update(userDoc.ref, {
                    'trialStatus.isActive': false,
                    updatedAt: now,
                });
                // Send expiration notification
                await db.collection('users').doc(userDoc.id).collection('notifications').add({
                    type: 'trial_expired',
                    title: 'Trial Expired',
                    body: 'Your 14-day free trial has ended. Upgrade to premium to continue enjoying all features!',
                    data: {
                        action: 'upgrade',
                    },
                    createdAt: now,
                    read: false,
                });
                expiredCount++;
            }
        }
        if (expiredCount > 0) {
            await batch.commit();
            console.log(`Expired ${expiredCount} trials`);
        }
        return null;
    }
    catch (error) {
        console.error('Error checking trial expiration:', error);
        return null;
    }
});
/**
 * Helper function to schedule trial reminders
 */
async function scheduleTrialReminders(userId, trialEndDate) {
    const db = admin.firestore();
    // Calculate reminder dates
    const threeDaysBefore = new Date(trialEndDate.getTime() - 3 * 24 * 60 * 60 * 1000);
    const oneDayBefore = new Date(trialEndDate.getTime() - 1 * 24 * 60 * 60 * 1000);
    // Store reminder schedule
    await db.collection('users').doc(userId).collection('trial_reminders').doc('schedule').set({
        reminders: [
            {
                date: threeDaysBefore.toISOString(),
                type: '3_days_before',
                sent: false,
            },
            {
                date: oneDayBefore.toISOString(),
                type: '1_day_before',
                sent: false,
            },
            {
                date: trialEndDate.toISOString(),
                type: 'expiration_day',
                sent: false,
            },
        ],
        createdAt: new Date().toISOString(),
    });
}
//# sourceMappingURL=trialManagement.js.map