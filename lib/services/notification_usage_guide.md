# Push Notifications Implementation Guide

## Overview

The M-Expense Flow app now includes comprehensive push notification support using Firebase Cloud Messaging (FCM). This implementation covers all the notification types specified in task 18.3:

- Achievement unlock notifications
- Budget alert notifications  
- Streak reminder notifications
- Challenge completion notifications
- Savings goal completion notifications
- Overspending alert notifications

## Architecture

### Client-Side Components

1. **NotificationService** (`lib/services/notification_service.dart`)
   - Handles FCM initialization and token management
   - Provides methods to send different types of notifications
   - Manages notification permissions and settings

2. **StreakService** (`lib/services/streak_service.dart`)
   - Monitors user streak status
   - Sends streak reminder notifications at appropriate times
   - Manages streak milestone notifications

3. **Provider Integration**
   - AuthProvider: Manages FCM token lifecycle (save on login, remove on logout)
   - GamificationProvider: Sends achievement and challenge notifications
   - BudgetProvider: Sends budget alert and savings goal notifications
   - OverspendingProvider: Sends overspending alert notifications

### Server-Side Components

1. **Cloud Functions** (`functions/src/notifications/sendNotification.ts`)
   - `sendNotification`: Triggered when notification documents are created
   - `sendStreakReminders`: Daily job to send streak reminders
   - `sendStreakRiskReminders`: Periodic job for streak risk alerts
   - `cleanupOldNotifications`: Maintenance job to clean old notifications

### Android Configuration

1. **Notification Channels** (`android/app/src/main/kotlin/.../MainActivity.kt`)
   - Creates notification channels for different notification types
   - Configures importance levels, vibration, and LED colors

2. **Resources** (`android/app/src/main/res/`)
   - Notification channel definitions
   - Notification icon resources

## Usage Examples

### Sending Achievement Notifications

```dart
// In GamificationProvider
await _notificationService.sendAchievementNotification(
  userId: userId,
  achievement: achievement,
);
```

### Sending Budget Alerts

```dart
// In BudgetProvider
await _notificationService.sendBudgetAlertNotification(
  userId: userId,
  budget: budget,
  spentAmount: spentAmount,
  percentage: percentage,
  alertType: 'warning', // or 'alert'
);
```

### Sending Streak Reminders

```dart
// In StreakService (automatic)
await _notificationService.sendStreakReminderNotification(
  userId: userId,
  currentStreak: currentStreak,
  reminderType: 'daily', // 'daily', 'risk', or 'milestone'
);
```

### Sending Overspending Alerts

```dart
// In OverspendingProvider
await _notificationService.sendOverspendingAlertNotification(
  userId: userId,
  category: category,
  amount: amount,
  severityLevel: severityLevel,
  categoryType: categoryType,
);
```

## Notification Types and Channels

| Type | Channel ID | Priority | Description |
|------|------------|----------|-------------|
| Achievement Unlock | `achievements` | Default | When user unlocks achievements |
| Budget Alert | `budget_alerts` | High | Budget warnings and overspending |
| Streak Reminder | `streak_reminders` | Low | Daily streak maintenance |
| Challenge Completion | `challenges` | Default | Challenge completion rewards |
| Savings Goal | `savings_goals` | Default | Savings goal achievements |
| Overspending Alert | `overspending_alerts` | High | ML-detected spending anomalies |

## Notification Flow

1. **Client Action**: User performs an action (transaction, achievement unlock, etc.)
2. **Provider Logic**: Relevant provider detects the event and calls NotificationService
3. **Queue Creation**: NotificationService creates a document in Firestore `notifications` collection
4. **Cloud Function**: `sendNotification` function is triggered by the new document
5. **FCM Delivery**: Cloud Function sends the notification via Firebase Cloud Messaging
6. **Client Handling**: App receives notification and handles tap actions

## Automatic Notifications

### Streak Reminders
- **Daily Reminders**: Sent at 8 PM Ghana time if user hasn't been active
- **Risk Reminders**: Sent every 2 hours (8 AM - 10 PM) for users with streaks > 3 days
- **Milestone Reminders**: Sent when approaching streak milestones (3, 7, 14, 30, etc.)

### Budget Alerts
- **Warning**: Sent when spending reaches 80% of budget limit
- **Alert**: Sent when spending exceeds 100% of budget limit
- Only sent when alert level changes (no duplicate notifications)

### Overspending Alerts
- **Medium Severity**: 2.5+ standard deviations from normal spending
- **High Severity**: 3+ standard deviations from normal spending
- Contextual messages based on category type (Want/Need/Hybrid)

## Testing

The notification system includes unit tests in `test/notification_service_test.dart` that verify:
- Service initialization
- Notification data structure creation
- Error handling without Firebase setup

## Configuration

### Firebase Setup
1. Ensure Firebase Cloud Messaging is enabled in Firebase Console
2. Add the service account key for Cloud Functions
3. Configure notification settings in Firebase Console

### Android Setup
1. Notification channels are automatically created in MainActivity
2. Notification icon is included in drawable resources
3. Permissions are handled automatically by Firebase Messaging

### iOS Setup (Future)
- iOS notification configuration would be added to `ios/Runner/AppDelegate.swift`
- APNs certificates would need to be configured in Firebase Console

## Maintenance

### Cleanup Jobs
- Old notifications (>30 days) are automatically cleaned up daily at 2 AM Ghana time
- Streak reminder records are cleaned up (>30 days) when users log in

### Monitoring
- Notification delivery status is tracked in Firestore
- Failed notifications are logged with error messages
- User notification statistics are maintained in user documents

## Security

- FCM tokens are stored securely in Firestore user documents
- Only authenticated users can receive notifications
- Notification content is validated before sending
- Personal data is not included in notification payloads (only IDs and public info)

## Performance

- Notifications are queued in Firestore for reliable delivery
- Cloud Functions handle the actual sending to avoid blocking the client
- Batch operations are used for cleanup jobs
- Notification channels optimize Android delivery performance