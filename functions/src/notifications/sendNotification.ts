import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Cloud Function to send push notifications
 * Triggered when a new notification document is created
 */
export const sendNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    try {
      const notificationData = snap.data();
      
      if (!notificationData || notificationData.sent) {
        console.log('Notification already sent or invalid data');
        return;
      }

      const {
        userId,
        fcmToken,
        title,
        body,
        data,
        type
      } = notificationData;

      if (!fcmToken) {
        console.log('No FCM token found for user:', userId);
        await snap.ref.update({ 
          sent: true, 
          error: 'No FCM token',
          sentAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return;
      }

      // Prepare the message
      const message: admin.messaging.Message = {
        token: fcmToken,
        notification: {
          title: title,
          body: body,
        },
        data: {
          ...data,
          type: type,
          notificationId: context.params.notificationId,
        },
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#2E7D32', // Ghana green
            channelId: getChannelId(type),
            priority: getPriority(type),
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: title,
                body: body,
              },
              badge: 1,
              sound: 'default',
              category: type,
            },
          },
        },
      };

      // Send the message
      const response = await messaging.send(message);
      console.log('Successfully sent message:', response);

      // Mark notification as sent
      await snap.ref.update({
        sent: true,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        messageId: response,
      });

      // Update user's notification stats
      await updateUserNotificationStats(userId, type);

    } catch (error) {
      console.error('Error sending notification:', error);
      
      // Mark notification as failed
      await snap.ref.update({
        sent: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

/**
 * Get Android notification channel ID based on notification type
 */
function getChannelId(type: string): string {
  switch (type) {
    case 'achievement_unlock':
      return 'achievements';
    case 'budget_alert':
      return 'budget_alerts';
    case 'streak_reminder':
      return 'streak_reminders';
    case 'challenge_completion':
      return 'challenges';
    case 'savings_goal_completion':
      return 'savings_goals';
    case 'overspending_alert':
      return 'overspending_alerts';
    default:
      return 'default';
  }
}

/**
 * Get notification priority based on type
 */
function getPriority(type: string): 'min' | 'low' | 'default' | 'high' | 'max' {
  switch (type) {
    case 'budget_alert':
    case 'overspending_alert':
      return 'high';
    case 'achievement_unlock':
    case 'challenge_completion':
    case 'savings_goal_completion':
      return 'default';
    case 'streak_reminder':
      return 'low';
    default:
      return 'default';
  }
}

/**
 * Update user's notification statistics
 */
async function updateUserNotificationStats(userId: string, type: string): Promise<void> {
  try {
    const userRef = db.collection('users').doc(userId);
    const statsField = `notificationStats.${type}`;
    
    await userRef.update({
      [statsField]: admin.firestore.FieldValue.increment(1),
      'notificationStats.total': admin.firestore.FieldValue.increment(1),
      'notificationStats.lastSent': admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating notification stats:', error);
  }
}

/**
 * Cloud Function to send streak reminder notifications
 * Runs daily at 8 PM Ghana time to remind users to maintain their streak
 */
export const sendStreakReminders = functions.pubsub
  .schedule('0 20 * * *') // 8 PM daily
  .timeZone('Africa/Accra') // Ghana timezone
  .onRun(async (context) => {
    try {
      console.log('Starting streak reminder job...');
      
      // Get all users with active streaks
      const usersSnapshot = await db.collection('users')
        .where('streak', '>', 0)
        .where('lastActiveDate', '<', getYesterdayDate())
        .get();

      const batch = db.batch();
      let reminderCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;
        const streak = userData.streak || 0;
        const fcmToken = userData.fcmToken;

        if (!fcmToken) {
          console.log(`No FCM token for user ${userId}, skipping...`);
          continue;
        }

        // Create notification document
        const notificationRef = db.collection('notifications').doc();
        batch.set(notificationRef, {
          userId: userId,
          fcmToken: fcmToken,
          title: '🔥 Keep Your Streak Alive!',
          body: `You're on a ${streak}-day streak! Log a transaction to keep it going.`,
          data: {
            currentStreak: streak.toString(),
            reminderType: 'daily',
          },
          type: 'streak_reminder',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          sent: false,
        });

        reminderCount++;
      }

      // Commit all notifications
      await batch.commit();
      console.log(`Created ${reminderCount} streak reminder notifications`);

      return { success: true, reminderCount };
    } catch (error) {
      console.error('Error in streak reminder job:', error);
      throw error;
    }
  });

/**
 * Cloud Function to send streak risk notifications
 * Runs every 2 hours during the day to warn users their streak is at risk
 */
export const sendStreakRiskReminders = functions.pubsub
  .schedule('0 */2 * * *') // Every 2 hours
  .timeZone('Africa/Accra') // Ghana timezone
  .onRun(async (context) => {
    try {
      const currentHour = new Date().getHours();
      
      // Only send during reasonable hours (8 AM to 10 PM)
      if (currentHour < 8 || currentHour > 22) {
        console.log('Outside notification hours, skipping...');
        return { success: true, skipped: true };
      }

      console.log('Starting streak risk reminder job...');
      
      // Get users who haven't been active today and have streaks > 3 days
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const usersSnapshot = await db.collection('users')
        .where('streak', '>', 3)
        .where('lastActiveDate', '<', todayStart.toISOString())
        .get();

      const batch = db.batch();
      let reminderCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;
        const streak = userData.streak || 0;
        const fcmToken = userData.fcmToken;

        if (!fcmToken) {
          continue;
        }

        // Check if we already sent a risk reminder today
        const existingReminder = await db.collection('notifications')
          .where('userId', '==', userId)
          .where('type', '==', 'streak_reminder')
          .where('data.reminderType', '==', 'risk')
          .where('createdAt', '>=', todayStart)
          .limit(1)
          .get();

        if (!existingReminder.empty) {
          continue; // Already sent today
        }

        // Create risk notification
        const notificationRef = db.collection('notifications').doc();
        batch.set(notificationRef, {
          userId: userId,
          fcmToken: fcmToken,
          title: '⏰ Streak at Risk!',
          body: `Your ${streak}-day streak is about to break! Open the app to maintain it.`,
          data: {
            currentStreak: streak.toString(),
            reminderType: 'risk',
          },
          type: 'streak_reminder',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          sent: false,
        });

        reminderCount++;
      }

      await batch.commit();
      console.log(`Created ${reminderCount} streak risk notifications`);

      return { success: true, reminderCount };
    } catch (error) {
      console.error('Error in streak risk reminder job:', error);
      throw error;
    }
  });

/**
 * Helper function to get yesterday's date
 */
function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);
  return yesterday.toISOString();
}

/**
 * Cloud Function to clean up old notifications
 * Runs daily at 2 AM to remove notifications older than 30 days
 */
export const cleanupOldNotifications = functions.pubsub
  .schedule('0 2 * * *') // 2 AM daily
  .timeZone('Africa/Accra')
  .onRun(async (context) => {
    try {
      console.log('Starting notification cleanup job...');
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const oldNotifications = await db.collection('notifications')
        .where('createdAt', '<', thirtyDaysAgo)
        .limit(500) // Process in batches
        .get();

      if (oldNotifications.empty) {
        console.log('No old notifications to clean up');
        return { success: true, deletedCount: 0 };
      }

      const batch = db.batch();
      oldNotifications.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Deleted ${oldNotifications.size} old notifications`);

      return { success: true, deletedCount: oldNotifications.size };
    } catch (error) {
      console.error('Error in notification cleanup job:', error);
      throw error;
    }
  });