# Design Document

## Overview

M-Expense Flow is a Flutter-based gamified financial tracking application specifically designed for Ghanaian university students. The system combines comprehensive expense tracking, AI-powered financial insights, machine learning-based overspending detection, gamification elements, and business management tools to help students understand their spending patterns, build better money habits, and manage both personal finances and side hustles.

The application features a freemium model with Ghana-specific expense categories, student-focused AI recommendations, and premium features including unlimited overspending trackers and business budgeting. The gamification system includes 104 achievements, XP progression through 25 levels, daily streaks, challenges, missions, and real-time student leaderboards to make financial management engaging and habit-forming.

The intelligent overspending detection uses local Z-score statistical analysis to identify spending anomalies in user-selected categories. The system learns individual spending patterns over time and provides real-time alerts when spending deviates significantly from normal behavior, helping students become more conscious of their financial habits without requiring server-side processing.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Presentation Layer                     │
│    (Flutter Widgets, Screens, Gamification UI)          │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  State Management Layer                  │
│   (Provider: Auth, Transaction, Budget, Gamification,   │
│              AI, Premium, Business, Leaderboard)        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   Business Logic Layer                   │
│  (Services: Gamification, AI Engine, Premium Manager,   │
│           MoMo Integration, Business Analytics)          │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┘
│                      Data Layer                          │
│   (Repositories: User, Transaction, Budget, Achievement, │
│              Leaderboard, AI Insights, Business)        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   Firebase Backend                       │
│  (Authentication, Firestore, Cloud Functions, Storage,  │
│              Cloud Messaging, Analytics)                │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   External Services                      │
│     (MoMo APIs, Payment Processing, Push Notifications) │
└──────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

1. **User Interaction**: User interacts with gamified Flutter widgets
2. **State Update**: Provider notifies listeners and triggers gamification checks
3. **Business Logic**: Services process financial rules, XP calculations, and achievement unlocks
4. **Data Persistence**: Repositories handle Firebase operations with offline support
5. **Cloud Processing**: Cloud Functions handle AI analysis, leaderboard updates, and premium verification
6. **Real-time Updates**: Firestore provides real-time leaderboard and achievement updates

## Components and Interfaces

### 1. Authentication Module

**AuthService**
- `signUp(name, email, password)`: Creates new student account in Firebase Auth and Firestore
- `signIn(email, password)`: Authenticates user and loads profile from Firestore
- `signOut()`: Clears session and resets state
- `resetPassword(email)`: Sends password reset email via Firebase Auth
- `getCurrentUser()`: Returns current authenticated user
- `authStateChanges()`: Stream of authentication state changes

**AuthProvider**
- Manages authentication state and user profile from Firestore
- Handles first-time user setup with default achievements in Firestore
- Manages session persistence with Firebase Auth

### 2. User Profile Module

**UserRepository**
- `createUserDocument(userId, userData)`: Creates user document in Firestore with gamification data
- `getUserData(userId)`: Retrieves user profile from Firestore
- `updateUserProfile(userId, updates)`: Updates user profile fields in Firestore
- `uploadProfilePicture(userId, imageFile)`: Uploads image to Firebase Storage
- `deleteProfilePicture(userId)`: Removes profile picture from Firebase Storage

**ProfileProvider**
- Manages user profile state from Firestore
- Handles profile picture upload/delete operations with Firebase Storage
- Syncs profile changes with Firestore in real-time

### 3. Transaction Management Module

**TransactionRepository**
- `createTransaction(userId, transactionData)`: Adds transaction to Firestore and triggers XP award
- `getTransactions(userId, filters)`: Retrieves transactions from Firestore with optional filters
- `updateTransaction(userId, transactionId, updates)`: Modifies existing transaction in Firestore
- `deleteTransaction(userId, transactionId)`: Removes transaction from Firestore
- `getTransactionsByCategory(userId, category)`: Category-specific Firestore queries
- `getTransactionsByDateRange(userId, start, end)`: Date-filtered Firestore queries

**TransactionProvider**
- Manages transaction list state from Firestore
- Handles CRUD operations with gamification integration
- Provides filtering and aggregation methods
- Triggers achievement checks via Cloud Functions

### 4. Budget Management Module

**BudgetRepository**
- `createQuickBudget(userId, budgetData)`: Creates budget in Firestore with freemium limits
- `createSavingsGoal(userId, goalData)`: Creates savings goal in Firestore with freemium limits
- `createComprehensiveBudget(userId, budgetData)`: Premium-only comprehensive budgeting in Firestore
- `updateBudget(userId, budgetId, updates)`: Modifies budget in Firestore
- `deleteBudget(userId, budgetId)`: Removes budget from Firestore
- `calculateProgress(userId, budgetId)`: Computes spending vs budget progress from Firestore data with fallback calculation for date range issues
- `_calculateProgressFallback(userId, budget)`: Fallback method that queries all transactions in category without date filtering to ensure accurate progress when date range queries fail

**BudgetProvider**
- Manages budget state from Firestore with real-time updates
- Calculates progress percentages and alert levels
- Handles savings goal contributions with Firestore transactions
- Provides budget vs actual comparisons

### 5. Gamification System

**GamificationRepository**
- `awardXP(userId, amount, reason)`: Awards XP and updates user document in Firestore
- `unlockAchievement(userId, achievementId)`: Unlocks achievement in Firestore and awards bonus XP
- `updateStreak(userId)`: Updates daily streak in Firestore user document
- `updateChallenge(userId, challengeId, progress)`: Updates challenge progress in Firestore
- `getUserAchievements(userId)`: Retrieves user's achievement status from Firestore
- `getLeaderboardData(period)`: Queries Firestore for leaderboard rankings

**GamificationService**
- `checkAchievements(userId, context)`: Evaluates achievement unlock conditions via Cloud Function
- `generateChallenges(userId, period)`: Creates daily/weekly/monthly challenges via Cloud Function
- `calculateLevel(totalXP)`: Computes user level from XP
- `updateLeaderboard(userId, xpGained, period)`: Updates leaderboard via Cloud Function

**Achievement Categories** (stored in Firestore):
- Transaction Achievements (20): First transaction, milestones, time-based
- Budget Achievements (18): Budget creation, staying under budget, perfect balance
- Savings Achievements (16): Goal creation, completion, amount milestones
- Streak Achievements (14): Daily streak milestones (3, 7, 14, 30, 50, 100, 365 days)
- Category Master Achievements (15): Category-specific usage milestones
- Special Achievements (10): Premium upgrade, MoMo connection, business mode
- Meta Achievements (11): Completionist milestones, perfect weeks, year tracking

**GamificationProvider**
- Manages XP, level, streak, and achievement state from Firestore
- Handles challenge progress tracking with real-time updates
- Provides leaderboard data with real-time Firestore streams
- Triggers celebration animations for unlocks

### 6. Leaderboard System

**LeaderboardRepository**
- `getWeeklyLeaderboard()`: Queries Firestore for top 100 weekly XP earners
- `getMonthlyLeaderboard()`: Queries Firestore for top 500 monthly XP earners
- `getAllTimeLeaderboard()`: Queries Firestore for top 1000 all-time XP earners
- `getUserRank(userId, period)`: Gets user's current rank in specified period
- `updateUserLeaderboardData(userId, xpGained)`: Updates user's leaderboard stats

**LeaderboardProvider**
- Manages leaderboard state with real-time Firestore streams
- Handles leaderboard period resets via Cloud Functions
- Provides user rank highlighting and position tracking
- Manages anonymous username display for privacy

### 7. AI Recommendation Engine

**AIRepository**
- `saveInsights(userId, insights)`: Stores AI-generated insights in Firestore
- `getInsights(userId, period)`: Retrieves insights from Firestore
- `getUserSpendingPatterns(userId)`: Aggregates user spending data from Firestore
- `getPeerAverages(category)`: Gets anonymized peer spending averages (Premium only)
- `saveComparativeAnalysis(userId, analysis)`: Stores premium comparative analysis

**AIService (Cloud Functions)**
- `analyzeSpendingPatterns(userId)`: Analyzes historical spending data from Firestore
- `generateStudentRecommendations(userId)`: Creates Ghana-specific advice via Cloud Function
- `detectSpendingAnomalies(userId)`: Identifies unusual patterns via Cloud Function
- `generateComparativeInsights(userId)`: Premium peer comparison via Cloud Function
- `calculateCategoryTrends(userId, category)`: Trend analysis via Cloud Function
- `generateBudgetSuggestions(userId)`: Recommended budget allocations via Cloud Function

**Student-Specific Recommendations**:
- Transport optimization (Uber vs Trotro suggestions)
- Data bundle savings (midnight bundle recommendations)
- Food budget tips (pack lunch frequency)
- Situationship spending reality checks
- Small expense awareness (semester projections)
- Subscription sharing strategies

**AIProvider**
- Manages AI insights state from Firestore
- Handles recommendation generation via Cloud Functions
- Provides basic insights for free users
- Unlocks advanced comparative analysis for premium users

### 8. Premium Management Module

**PremiumRepository**
- `checkPremiumStatus(userId)`: Verifies subscription status in Firestore
- `upgradeToPremium(userId, subscriptionData)`: Updates premium status in Firestore
- `updateSubscription(userId, subscriptionData)`: Manages subscription details
- `getPremiumFeatures(userId)`: Returns available features based on subscription

**PremiumService**
- `processPayment(paymentData)`: Handles payment processing via Cloud Functions
- `verifySubscription(userId)`: Server-side subscription verification
- `unlockPremiumFeatures(userId)`: Enables premium functionality in Firestore
- `enforceLimits(userId, feature)`: Applies freemium restrictions based on Firestore data
- `generateUpgradePrompts(context)`: Context-aware upgrade suggestions

**Premium Features**:
- Unlimited budgets and savings goals
- Advanced AI comparative analysis
- Business Mode with 6 templates
- Unlimited overspending trackers
- Data export (Excel/CSV)
- Comprehensive budgets
- Priority support

**PremiumProvider**
- Manages subscription state from Firestore
- Handles feature access control based on Firestore premium status
- Displays upgrade prompts and paywalls
- Manages premium badge display

### 9. Business Management Module (Premium Only)

**BusinessRepository**
- `createBusinessProfile(userId, businessData)`: Creates business profile in Firestore
- `createBusinessTransaction(userId, transactionData)`: Adds business transaction to Firestore
- `getBusinessTransactions(userId, filters)`: Retrieves business transactions from Firestore
- `createBusinessBudget(userId, template)`: Creates business budget using template
- `getBusinessAnalytics(userId, period)`: Calculates business metrics from Firestore data

**BusinessService**
- `enableBusinessMode(userId)`: Activates business tracking in Firestore
- `applyBusinessTemplate(userId, templateId)`: Applies pre-built template via Cloud Function
- `calculateProfitMargin(userId, period)`: Business analytics via Cloud Function
- `generateBusinessInsights(userId)`: Business-specific AI recommendations via Cloud Function

**Business Templates** (stored in Firestore):
1. Fashion Reseller (50% inventory, 20% profit)
2. Food Vendor (40% ingredients, 20% profit)
3. Digital Services (40% profit, 15% tools)
4. Hair & Beauty (35% supplies, 20% profit)
5. Tutoring Services (40% profit, 15% materials)
6. E-commerce/Dropshipping (45% sourcing, 15% profit)

**BusinessProvider**
- Manages business transaction state from Firestore
- Handles template application
- Provides business analytics from Firestore data
- Separates personal vs business finances

### 10. Intelligent Overspending Detection Module

**OverspendingRepository**
- `createTracker(userId, trackerData)`: Creates overspending tracker in Firestore with freemium limits, baseline initialization, and mode selection
- `getTrackers(userId)`: Retrieves user's active trackers from Firestore
- `updateTracker(userId, trackerId, updates)`: Updates tracker configuration in Firestore
- `deleteTracker(userId, trackerId)`: Removes tracker from Firestore
- `saveAnomalyAlert(userId, trackerId, alertData)`: Stores anomaly detection results
- `getTrackerHistory(userId, trackerId, period)`: Retrieves historical anomaly data
- `getCategoryBaselines(category)`: Retrieves Ghana-specific baseline suggestions for category
- `updateTrackerBaseline(userId, trackerId, newBaseline)`: Updates user-confirmed baseline thresholds
- `updateTrackerMode(userId, trackerId, newMode)`: Switches tracker between Conservative and Quick Start modes
- `savePatternValidation(userId, trackerId, validationData)`: Stores user's "typical" or "unusual" pattern confirmation
- `saveContextualPeriod(userId, trackerId, periodData)`: Stores marked unusual periods (exams, holidays)
- `updateBaselineRejectionCount(userId, trackerId, count)`: Tracks how many times user rejected baseline increases
- `getTrackerPerformanceMetrics(userId, trackerId)`: Retrieves alert accuracy and user satisfaction data

**OverspendingService**
- `getGhanaBaselines(category)`: Returns Ghana-specific reasonable spending amounts for category
- `createTrackerWithMode(userId, category, mode)`: Creates tracker with Conservative or Quick Start mode
- `validateSpendingPatterns(userId, trackerId, day14Check)`: Prompts user to confirm if patterns feel "typical" or "unusual"
- `detectDailyAnomaly(spendingData, currentAmount, baseline, mode, daysSinceCreation)`: Z-score analysis with mode-specific thresholds
- `detectWeeklyAnomaly(weeklyData, currentWeekAmount, baseline, mode)`: Z-score analysis for weekly trends with mode considerations
- `filterLearningPeriodAnomalies(spendingData, creationDate)`: Excludes spending spikes from first 21 days from baseline calculations
- `calculateSeverityLevel(zScore, mode, daysSinceCreation)`: Determines alert severity with mode-specific adjustments
- `classifyCategory(category)`: Hardcoded classification as Want, Need, or Hybrid
- `generateAnomalyInsight(anomalyData, categoryType, mode)`: Creates contextual alert messages with mode disclaimers
- `checkTrainingProgress(trackerData, mode)`: Monitors data collection progress (7 days Quick Start, 21 days Conservative)
- `suggestBaselineAdjustment(historicalData, currentBaseline, mode)`: ML-based baseline adjustment suggestions with mode considerations
- `validateBaselineIncrease(currentBaseline, suggestedBaseline, rejectionCount)`: Ensures sustainability and handles repeated rejections
- `detectContextualPatterns(spendingData, userId)`: Identifies weekend/weekday patterns, exam periods, holidays
- `handleModeSwitch(userId, trackerId, fromMode, toMode)`: Manages switching between Conservative and Quick Start modes
- `generateModeRecommendation(trackerData, alertHistory)`: Suggests mode switches based on performance
- `applyContextualThresholds(baseThreshold, context)`: Adjusts thresholds for weekends, exam periods, etc.
- `trackHabitImprovement(userId, trackerId, spendingTrend)`: Monitors and celebrates spending improvements
- `resetToConservativeMode(userId, trackerId)`: Resets tracker to baseline-only detection when requested

**Ghana-Specific Category Baselines** (hardcoded defaults):
- **Transport**: Trotro & Transport (GHS 40-60/week), Uber/Bolt (GHS 80-120/week)
- **Food**: Groceries (GHS 60-100/week), Restaurant/Café (GHS 40-80/week)
- **Communication**: Data Bundles (GHS 20-40/week), Airtime (GHS 15-30/week)
- **Education**: Academic Materials (GHS 30-60/month), Printing (GHS 10-25/week)
- **Entertainment**: Parties & Clubs (GHS 50-100/week), Movies (GHS 20-40/week)
- **Personal**: Beauty & Grooming (GHS 30-60/week), Fashion & Clothes (GHS 50-150/month)

**Hybrid Baseline Initialization Process**:
1. User selects category to track
2. System presents two setup modes: "Conservative (Recommended)" and "Quick Start"
3. System presents Ghana-specific baseline suggestion with context
4. User adjusts baseline using slider controls ("This seems right for me")
5. System stores user-confirmed baseline as initial threshold
6. ML learns patterns around this baseline using selected mode approach

**Conservative Mode (Recommended)**:
- 21-day baseline-only period with 3+ std dev detection
- User confirmation at day 14: "Do your patterns feel typical or unusual?"
- If "unusual," extends to 28-day baseline-only period
- Gradual ML integration: 10% week 4, 25% week 5, 50% week 6, 75% week 7, 100% week 8
- Maximum protection against learning bad habits
- Automatic overspending lockout if spending consistently 40%+ above baseline in first 3 weeks

**Quick Start Mode**:
- 7-day baseline-only period with warning about immediate learning
- 50% ML learning starts day 8, 100% by day 14
- Gentler alerts with "Still learning your patterns" disclaimer
- Safety net: offers "Reset to Conservative Mode" if problems detected in first 2 weeks
- Smart suggestions to switch modes if frequent false alerts occur

**Enhanced Anomaly Detection Logic**:
- **Conservative Period**: Use baseline thresholds with 3+ std dev only
- **Adaptive Period**: Use baseline + ML learning with 2.5+ std dev for medium, 3+ for high
- **Weekly Detection**: Compare current week vs baseline-adjusted weekly patterns
- **Learning Period Anomaly Filtering**: Flag and exclude spending spikes in first 21 days from baseline calculations
- **Contextual Intelligence**: Different thresholds for weekends vs weekdays, exam periods, holidays
- **Baseline Adjustment**: ML can suggest increases but requires user confirmation with trend visualization
- **Sustainability Check**: If increases exceed 30% from original, requires "Does this feel sustainable?" confirmation
- **Conservative Override**: If user rejects increases 3+ times, maintains strict thresholds
- **Adaptive Period** (14+ days): Use baseline + ML learning with 2.5+ std dev for medium, 3+ for high
- **Weekly Detection** (4+ weeks): Compare current week vs baseline-adjusted weekly patterns
- **Baseline Adjustment**: ML can suggest increases but requires user confirmation
- **Maximum Adjustment**: 20% increase per month to prevent normalization of overspending

**Category Classifications** (hardcoded):
- **Want Categories** (13): Restaurant/Café, Parties & Clubs, Situationship Spending, Impulse/TikTok Buys, Fashion & Clothes, Entertainment, Beauty & Grooming, etc.
- **Need Categories** (8): Uber/Bolt, Trotro & Transport, Data Bundles, Groceries, Medicine & Health, Academic Materials, etc.
- **Hybrid Categories** (4): App Payments, Gym Membership, Tech Repairs, Gifts & Family Support

**OverspendingProvider**
- Manages tracker state from Firestore with real-time updates
- Handles baseline initialization and user confirmation
- Provides Ghana-specific baseline suggestions with context
- Manages dual-mode system (Conservative vs Quick Start) with mode selection UI
- Handles hybrid anomaly detection (baseline + ML learning) with mode-specific logic
- Provides training progress tracking (7-day Quick Start, 21-day Conservative requirement)
- Manages freemium limits (1 tracker for free users)
- Displays contextual alerts based on category classification and mode
- Handles baseline adjustment suggestions and user approval with trend visualization
- Manages pattern validation prompts ("Do your patterns feel typical?")
- Provides mode switching functionality with appropriate warnings
- Handles contextual period marking (exams, holidays, unusual spending periods)
- Tracks and displays habit improvement progress
- Manages baseline rejection tracking and conservative override
- Provides mode recommendation suggestions based on performance

### 11. Analytics and Reporting Module

**AnalyticsRepository**
- `getUserAnalytics(userId, period)`: Retrieves user analytics data from Firestore
- `generateReportData(userId, filters)`: Aggregates data for reports from Firestore
- `saveExportRequest(userId, exportData)`: Stores export request for processing
- `getChartData(userId, chartType, period)`: Retrieves chart data from Firestore

**AnalyticsService**
- `generateDashboardData(userId)`: Creates dashboard summary from Firestore data
- `generateCategoryBreakdown(userId, period)`: Category distribution analysis
- `generateSpendingTrends(userId, period)`: Time-based spending analysis
- `exportData(userId, format)`: Premium data export via Cloud Functions

**ChartDataProvider**
- Transforms Firestore data for visualization
- Provides pie chart data (category distribution)
- Provides line chart data (spending trends)
- Handles date grouping and aggregation

### 12. Settings and Preferences Module

**SettingsRepository**
- `updateUserSettings(userId, settings)`: Updates user preferences in Firestore
- `getUserSettings(userId)`: Retrieves user settings from Firestore
- `deleteUserAccount(userId)`: Permanently removes all user data from Firestore and Storage

**SettingsService**
- `updateTheme(userId, darkMode)`: Toggles dark/light mode in Firestore
- `updateProfile(userId, updates)`: Modifies user profile in Firestore
- `exportUserData(userId)`: Premium data export via Cloud Functions
- `processAccountDeletion(userId)`: Handles complete account deletion via Cloud Functions

**SettingsProvider**
- Manages app preferences from Firestore
- Handles theme switching with real-time sync
- Provides account management
- Manages data export requests

## Data Models

### Firestore Collections Structure

```
users/{userId}
├── profile: UserProfile
├── transactions/{transactionId}: Transaction
├── budgets/{budgetId}: QuickBudget
├── savings_goals/{goalId}: SavingsGoal
├── comprehensive_budgets/{budgetId}: ComprehensiveBudget
├── overspending_trackers/{trackerId}: OverspendingTracker
├── anomaly_alerts/{alertId}: AnomalyAlert
├── achievements/{achievementId}: UserAchievement
├── challenges/{challengeId}: Challenge
├── missions/{missionId}: Mission
├── ai_insights/{insightId}: AIInsight
├── business_profile: BusinessProfile (Premium only)
├── business_transactions/{transactionId}: BusinessTransaction (Premium only)
└── settings: UserSettings

leaderboards/
├── weekly/{userId}: LeaderboardEntry
├── monthly/{userId}: LeaderboardEntry
└── all_time/{userId}: LeaderboardEntry

global/
├── achievements: Achievement[] (master list)
├── business_templates: BusinessTemplate[]
├── categories: CategoryDefinition[]
├── category_classifications: CategoryClassification[] (Want/Need/Hybrid)
└── peer_averages: PeerSpendingData (for comparative analysis)
```

### User Profile Model
```dart
class UserProfile {
  final String userId;
  final String name;
  final String email;
  final String? profilePictureUrl; // Firebase Storage URL
  final String currency; // Default: "GHS"
  final int level; // Gamification level (1-25)
  final int xp; // Experience points
  final int streak; // Daily streak count
  final DateTime lastActiveDate; // For streak tracking
  final DateTime joinDate;
  final bool darkMode;
  final bool isPremium; // Premium subscription status
  final DateTime? premiumExpiryDate;
  final Map<String, bool> notificationSettings;
  final DateTime createdAt;
  final DateTime updatedAt;
}
```

### Transaction Model
```dart
class Transaction {
  final String transactionId;
  final String userId;
  final String type; // 'income' | 'expense'
  final double amount; // In GHS
  final String category; // One of 29 categories
  final String description; // User note
  final DateTime date;
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool isBusinessTransaction; // For business mode
}
```

### Quick Budget Model
```dart
class QuickBudget {
  final String budgetId;
  final String userId;
  final String category; // Matches transaction category
  final double limit; // Budget limit in GHS
  final String period; // 'monthly' | 'weekly' | 'semester'
  final String monthYear; // Format: YYYY-MM
  final DateTime createdAt;
  final DateTime updatedAt;
}
```

### Savings Goal Model
```dart
class SavingsGoal {
  final String goalId;
  final String userId;
  final String name; // e.g., "iPhone 15", "Semester Fees"
  final double targetAmount;
  final double currentAmount;
  final DateTime deadline;
  final String category; // 'Event', 'Emergency Fund', 'Purchase', 'Trip'
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool isCompleted;
  final DateTime? completedDate;
}
```

### Comprehensive Budget Model (Premium Only)
```dart
class ComprehensiveBudget {
  final String budgetId;
  final String userId;
  final String period; // 'monthly' | 'semester'
  final double totalIncome;
  final double savingsPercentage;
  final double savingsAmount;
  final List<CategoryAllocation> categoryAllocations;
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool isActive; // Only one active at a time
}

class CategoryAllocation {
  final String category;
  final double amount;
  final double percentage;
}
```

### User Achievement Model
```dart
class UserAchievement {
  final String achievementId;
  final String userId;
  final bool unlocked;
  final DateTime? unlockedDate;
  final int xpAwarded; // XP awarded when unlocked
}
```

### Achievement Master Model (Global Collection)
```dart
class Achievement {
  final String achievementId;
  final String title;
  final String description;
  final String icon; // Emoji
  final String category; // Achievement category
  final int xpReward; // XP awarded when unlocked
  final String rarity; // 'common' | 'rare' | 'epic' | 'legendary'
  final Map<String, dynamic> unlockConditions; // Flexible conditions
}
```

### Challenge Model
```dart
class Challenge {
  final String challengeId;
  final String userId;
  final String title;
  final String description;
  final String period; // 'daily' | 'weekly' | 'monthly'
  final int xpReward;
  final int progress; // Current progress
  final int target; // Target to complete
  final bool completed;
  final DateTime deadline; // When challenge expires
  final DateTime createdAt;
}
```

### Mission Model
```dart
class Mission {
  final String missionId;
  final String userId;
  final String title;
  final String description;
  final List<MissionStep> steps;
  final int totalXpReward;
  final String badgeIcon;
  final bool completed;
  final DateTime? completedDate;
  final DateTime createdAt;
}

class MissionStep {
  final String stepId;
  final String description;
  final bool completed;
  final DateTime? completedDate;
}
```

### AI Insight Model
```dart
class AIInsight {
  final String insightId;
  final String userId;
  final String title;
  final String message;
  final String type; // 'warning' | 'success' | 'info' | 'tip'
  final String category; // Related category
  final String priority; // 'high' | 'medium' | 'low'
  final DateTime generatedAt;
  final bool isPremium; // Premium-only insight
  final bool isRead;
}
```

### Leaderboard Entry Model
```dart
class LeaderboardEntry {
  final String userId;
  final String anonymousUsername; // Generated anonymous name
  final String? university; // Optional university affiliation
  final int level;
  final int xp; // XP for the period
  final int totalXp; // All-time XP
  final int streak;
  final int rank; // Calculated rank
  final DateTime lastUpdated;
}
```

### Business Profile Model (Premium Only)
```dart
class BusinessProfile {
  final String userId;
  final String businessName;
  final String businessType; // Template type
  final String description;
  final DateTime startDate;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;
}
```

### Business Transaction Model (Premium Only)
```dart
class BusinessTransaction {
  final String transactionId;
  final String userId;
  final String type; // 'income' | 'expense'
  final double amount;
  final String category; // Business-specific categories
  final String description;
  final DateTime date;
  final String businessTemplate; // Which template this belongs to
  final DateTime createdAt;
}
```

### Business Template Model (Global Collection)
```dart
class BusinessTemplate {
  final String templateId;
  final String name; // e.g., "Fashion Reseller"
  final String description;
  final Map<String, double> categoryPercentages; // Category -> Percentage
  final double targetProfitMargin;
  final List<String> suggestedCategories;
}
```

### Overspending Tracker Model
```dart
class OverspendingTracker {
  final String trackerId;
  final String userId;
  final String category; // Matches transaction category
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool isActive;
  final String mode; // 'conservative' | 'quick_start'
  final double weeklyBaseline; // User-confirmed baseline amount per week
  final double dailyBaseline; // Calculated from weekly baseline
  final DateTime baselineSetDate; // When user confirmed baseline
  final DateTime? lastBaselineAdjustment; // Last ML-suggested adjustment
  final DateTime? patternValidationDate; // When user confirmed patterns as "typical" or "unusual"
  final String? patternValidationResponse; // 'typical' | 'unusual'
  final int baselineRejectionCount; // How many times user rejected ML increases
  final bool conservativeOverride; // User prefers strict detection (3+ rejections)
  final List<DailyAggregate> dailyAggregates; // For daily anomaly detection
  final List<WeeklyAggregate> weeklyAggregates; // For weekly anomaly detection
  final List<ContextualPeriod> contextualPeriods; // Marked unusual periods (exams, holidays)
  final bool hasEnoughDataForDaily; // Mode-dependent: 7+ days Quick Start, 21+ days Conservative
  final bool hasEnoughDataForWeekly; // 4+ weeks
  final String categoryType; // 'want' | 'need' | 'hybrid'
  final bool userApprovedBaseline; // User confirmed the baseline amount
  final double mlLearningWeight; // Current ML influence percentage (0-100%)
  final DateTime? mlActivationDate; // When ML learning began
  final bool isInLearningPeriod; // Still in baseline-only period
  final List<String> learningPeriodAnomalies; // Transaction IDs flagged as learning period spikes
}

class DailyAggregate {
  final DateTime date;
  final double totalAmount;
  final int transactionCount;
  final bool hasAnomaly;
  final double? zScore; // Calculated against baseline + historical variance
  final String? severityLevel; // 'safe' | 'medium' | 'high'
  final double? baselineUsed; // Baseline amount used for this calculation
  final bool isWeekend; // Different thresholds for weekends
  final bool isExamPeriod; // Marked as exam/unusual period
  final bool excludedFromLearning; // Flagged as learning period anomaly
}

class WeeklyAggregate {
  final DateTime weekStart;
  final DateTime weekEnd;
  final double totalAmount;
  final int transactionCount;
  final bool hasAnomaly;
  final double? zScore; // Calculated against weekly baseline + historical variance
  final String? severityLevel; // 'safe' | 'medium' | 'high'
  final double? baselineUsed; // Weekly baseline used for this calculation
  final bool excludedFromLearning; // Flagged as learning period anomaly
}

class ContextualPeriod {
  final String periodId;
  final DateTime startDate;
  final DateTime endDate;
  final String periodType; // 'exam' | 'holiday' | 'unusual' | 'emergency'
  final String description; // User-provided description
  final bool excludeFromLearning; // Whether to exclude from ML pattern learning
  final DateTime markedAt; // When user marked this period
}
```

### Anomaly Alert Model
```dart
class AnomalyAlert {
  final String alertId;
  final String userId;
  final String trackerId;
  final String category;
  final String type; // 'daily' | 'weekly'
  final double amount;
  final double zScore;
  final String severityLevel; // 'safe' | 'medium' | 'high'
  final String message; // Contextual alert message
  final String categoryType; // 'want' | 'need' | 'hybrid'
  final String trackerMode; // 'conservative' | 'quick_start'
  final bool isLearningPeriod; // Whether tracker was still learning
  final String? learningDisclaimer; // "Still learning your patterns" for Quick Start
  final DateTime detectedAt;
  final bool isRead;
  final bool wasAccurate; // User feedback on alert accuracy (optional)
}
```

### MoMo Account Model (Premium Only)
```dart
class MoMoAccount {
  final String accountId;
  final String userId;
  final String provider; // 'MTN' | 'Vodafone' | 'AirtelTigo'
  final String phoneNumber; // Encrypted
  final bool connected;
  final DateTime? lastSyncDate;
  final double? cachedBalance;
  final DateTime createdAt;
  final DateTime updatedAt;
}
```

### User Settings Model
```dart
class UserSettings {
  final String userId;
  final bool darkMode;
  final String currency;
  final Map<String, bool> notificationSettings;
  final String language; // Default: 'en'
  final bool dataExportEnabled; // Premium only
  final DateTime updatedAt;
}
```

### Category Classification Model (Global Collection)
```dart
class CategoryClassification {
  final String categoryId;
  final String name;
  final String type; // 'want' | 'need' | 'hybrid'
  final String reasoning; // Why this category is classified this way
  final List<String> examples; // Example transactions for this category
}
```

### Peer Spending Data Model (Global Collection)
```dart
class PeerSpendingData {
  final String categoryId;
  final double averagePercentage; // Average % spent in this category
  final double medianAmount; // Median amount spent
  final int sampleSize; // Number of users in calculation
  final DateTime lastUpdated;
  final String period; // 'monthly' | 'weekly'
}
```

### Category Definition Model (Global Collection)
```dart
class CategoryDefinition {
  final String categoryId;
  final String name;
  final String icon; // Emoji
  final String color; // Hex color code
  final String type; // 'expense' | 'income'
  final bool isGhanaSpecific; // True for categories like "Trotro & Transport"
  final int sortOrder;
}
```

### Firestore Security Rules Structure
```javascript
// Users can only access their own data
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
  
  // Subcollections inherit parent permissions
  match /{document=**} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
}

// Leaderboards are read-only for authenticated users
match /leaderboards/{period}/{userId} {
  allow read: if request.auth != null;
  allow write: if false; // Only Cloud Functions can write
}

// Global collections are read-only
match /global/{document} {
  allow read: if request.auth != null;
  allow write: if false; // Only admin can write
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: User profile creation with defaults
*For any* valid name and email combination, creating a new user profile should result in a profile with Level 1, 0 XP, 0 streak, GHS currency, and darkMode false.
**Validates: Requirements 1.1, 1.5**

### Property 2: Input validation rejection
*For any* invalid input (empty names, malformed emails, zero/negative amounts, missing required fields), the system should reject the operation and display appropriate validation errors.
**Validates: Requirements 1.3, 2.2, 2.3, 2.4, 4.3, 5.3**

### Property 3: Transaction creation with XP award
*For any* valid transaction data, creating a transaction should store it with a unique timestamp-based ID, award 5 XP, and trigger achievement checks.
**Validates: Requirements 2.1, 2.5**

### Property 4: Category system completeness
*For any* expense transaction, the system should allow selection from exactly 25 predefined Ghana-specific categories; for income transactions, exactly 4 income categories should be available.
**Validates: Requirements 3.1, 3.2**

### Property 5: Transaction filtering accuracy
*For any* set of transactions and filter criteria (category, date range, search terms), filtering should return only transactions that match all specified criteria.
**Validates: Requirements 3.4, 18.2, 18.3, 18.4**

### Property 6: Freemium limits enforcement
*For any* free user attempting to create more than 3 budgets or 3 savings goals, the system should block the creation and display premium upgrade prompts.
**Validates: Requirements 4.1, 5.1, 20.4**

### Property 7: Premium feature access
*For any* premium user, the system should allow unlimited budgets/goals, comprehensive budgets, business mode, MoMo integration, and advanced AI insights.
**Validates: Requirements 4.2, 5.2, 6.2, 14.2**

### Property 8: Budget progress calculation with fallback resilience
*For any* budget with spending data, the progress percentage should equal (total spent in category / budget limit) × 100, with appropriate warning indicators at 80% and alert indicators above 100%. When date range filtering fails, the system should use fallback calculation that queries all transactions in the category to ensure accurate progress display.
**Validates: Requirements 4.4, 4.5, 4.6**

### Property 9: Savings goal contribution tracking
*For any* savings goal and contribution amount, adding the contribution should increase the current amount and recalculate the progress percentage accurately.
**Validates: Requirements 5.4**

### Property 10: Comprehensive budget allocation validation
*For any* comprehensive budget allocation, the sum of all category percentages should equal 100% of available income after savings.
**Validates: Requirements 6.3**

### Property 11: XP and level calculation consistency
*For any* user action that awards XP (transactions: +5, budgets: +15, goals: +20, achievements: +25-100), the total XP should increase correctly and level should equal (Total XP ÷ 100) + 1.
**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 12: Achievement unlocking system
*For any* achievement trigger condition being met, the system should unlock the appropriate achievement, award bonus XP, and display celebration.
**Validates: Requirements 1.2, 5.5, 7.5, 10.3**

### Property 13: Daily streak management
*For any* user opening the app daily, the streak should increment; missing a day should reset streak to 1; reaching milestones (7, 14, 30, 50, 100, 365) should unlock streak achievements.
**Validates: Requirements 8.1, 8.2, 8.3**

### Property 14: Challenge completion rewards
*For any* completed challenge, the system should award the specified XP (20-200 based on difficulty), mark as complete, and check for challenge-related achievements.
**Validates: Requirements 9.2, 9.5**

### Property 15: Mission progression logic
*For any* mission step completion, the system should automatically advance to the next step; completing all steps should award large XP bonus (100-300) and exclusive badge.
**Validates: Requirements 10.2, 10.3**

### Property 16: Leaderboard ranking accuracy
*For any* leaderboard period (weekly, monthly, all-time), users should be ranked correctly by XP earned in that period, with the current user's position always highlighted.
**Validates: Requirements 11.1, 11.2, 11.3, 11.4**

### Property 17: AI recommendation generation
*For any* user with sufficient transaction history, the AI should generate 8-10 personalized recommendations with Ghana-specific context and student-friendly language.
**Validates: Requirements 12.1, 12.4**

### Property 18: AI pattern detection
*For any* category with spending >30% of total or frequent small transactions, the AI should detect the pattern and provide specific reduction suggestions with semester projections.
**Validates: Requirements 12.2, 12.3**

### Property 19: Premium AI comparative analysis
*For any* premium user requesting comparative analysis, the system should compare their spending percentages to anonymized peer averages and provide category-by-category differences.
**Validates: Requirements 13.1, 13.2, 13.4**

### Property 20: Business mode calculations
*For any* business transactions in business mode, the system should calculate monthly revenue, expenses, net profit, and profit margin percentage accurately.
**Validates: Requirements 14.4, 14.5**

### Property 21: Overspending tracker creation and limits
*For any* free user attempting to create more than 1 overspending tracker, the system should block creation and display premium upgrade prompt; premium users should be able to create unlimited trackers.
**Validates: Requirements 15.2, 15.3**

### Property 22: Anomaly detection accuracy
*For any* spending data with sufficient history (7+ days), the Z-score anomaly detection should correctly identify spending that deviates 2.5+ standard deviations from the mean as medium severity, and 3+ standard deviations as high severity.
**Validates: Requirements 15.5, 15.6, 15.7**

### Property 23: Category classification consistency
*For any* Ghana-specific expense category, the system should consistently classify it as Want, Need, or Hybrid according to predefined rules, with different alert messages for each type.
**Validates: Requirements 15.8**

### Property 24: Training progress tracking
*For any* new overspending tracker with insufficient data, the system should display accurate progress indicators showing days collected out of 7 required, and activate detection once threshold is met.
**Validates: Requirements 15.4, 15.5**

### Property 25: Bill split calculation accuracy
*For any* bill amount and number of people, the split calculator should compute equal shares or custom amounts correctly, with each person's share summing to the total bill.
**Validates: Requirements 16.1, 16.2**

### Property 26: Dashboard data completeness
*For any* user accessing the dashboard, it should display current balance (income - expenses), monthly spending chart, top 5 categories, streak count, level progress, and recent achievements.
**Validates: Requirements 17.1, 17.2**

### Property 27: Transaction history sorting and pagination
*For any* user's transaction history, transactions should be sorted by date descending, with pagination implemented for more than 20 items.
**Validates: Requirements 18.1, 18.5**

### Property 28: Settings persistence
*For any* settings change (dark mode toggle, profile updates), the changes should be immediately applied and persisted locally for offline access.
**Validates: Requirements 19.1, 19.2, 19.5**

### Property 29: Premium upgrade effects
*For any* user upgrading to premium, all premium features should unlock immediately, the "Premium Member" achievement should be awarded, and premium badges should display throughout the app.
**Validates: Requirements 20.2, 20.5**

### Property 30: Offline data synchronization
*For any* data created or modified offline, when connectivity is restored, the system should automatically synchronize changes using last-write-wins conflict resolution.
**Validates: Requirements 21.2, 21.3, 21.5**

### Property 31: Data access authorization
*For any* user attempting to access data, the system should verify the user owns the requested information and block access to other users' data.
**Validates: Requirements 22.2**

### Property 32: Data deletion completeness
*For any* user requesting account deletion, the system should permanently remove all associated data (profile, transactions, budgets, achievements) with no possibility of recovery.
**Validates: Requirements 22.5**

### Property 33: Overspending tracker mode behavior
*For any* overspending tracker created in Conservative mode, the system should use baseline-only detection for 21 days with gradual ML integration (10% week 4, 25% week 5, 50% week 6, 75% week 7, 100% week 8); for Quick Start mode, baseline-only for 7 days with 50% ML by day 8 and 100% by day 14.
**Validates: Requirements 15.6, 15.9, 23.8, 25.2, 25.4**

### Property 34: Learning period anomaly exclusion
*For any* spending spike detected in the first 21 days of a tracker, the system should flag it as a "learning period anomaly" and exclude it from baseline calculations and ML pattern learning.
**Validates: Requirements 24.1, 23.4**

### Property 35: Pattern validation prompts
*For any* tracker reaching 14 days of data, the system should prompt the user to confirm if patterns feel "typical" or "unusual"; if marked "unusual," extend conservative period to 28 days.
**Validates: Requirements 15.7, 15.8, 23.5, 23.6**

### Property 36: Baseline adjustment approval
*For any* ML-suggested baseline increase, the system should require explicit user approval with trend visualization; if increases exceed 30% from original, require sustainability confirmation; if user rejects 3+ times, maintain conservative thresholds.
**Validates: Requirements 15.14, 15.15, 23.9, 23.10, 23.11**

### Property 37: Contextual spending exclusion
*For any* transaction marked as "one-time expense," "emergency," or during marked "unusual periods" (exams, holidays), the system should exclude these from ML pattern learning while still tracking them for budgets.
**Validates: Requirements 24.7, 24.8, 24.9**

### Property 38: Mode switching functionality
*For any* user switching from Quick Start to Conservative mode, the system should reset to baseline-only detection for 21 days; switching should be offered when Quick Start shows frequent false alerts.
**Validates: Requirements 25.6, 25.7, 25.9**

### Property 39: Habit improvement recognition
*For any* user consistently spending below baseline for 4+ weeks, the system should congratulate progress and offer to lock in improved baselines; consistently spending below should trigger baseline reduction offers.
**Validates: Requirements 24.3, 24.10**

### Property 40: Budget calculation fallback resilience
*For any* budget progress calculation that encounters date range filtering issues, the system should automatically use fallback calculation that queries all transactions in the category, returning accurate progress data with a 'fallbackUsed' flag.
**Validates: Requirements 25.1, 25.2, 25.3**

## Error Handling

### Input Validation Errors
- **Invalid amounts**: Display user-friendly message for zero/negative amounts
- **Missing required fields**: Show inline field-level errors before submission
- **Invalid email formats**: Provide clear validation message with format requirements
- **Empty names**: Display required field validation

### Freemium Limit Errors
- **Budget/Goal limits exceeded**: Show upgrade modal with premium benefits
- **Premium feature access**: Display paywall with feature comparison and pricing
- **Business mode access**: Show premium upgrade prompt with business benefits
- **MoMo integration access**: Display premium requirement with MoMo benefits

### Gamification Errors
- **Achievement unlock failures**: Log error but continue normal operation
- **XP calculation errors**: Fall back to manual calculation, log for debugging
- **Streak calculation errors**: Reset to safe state, notify user of streak reset
- **Challenge generation failures**: Use default challenges, log error

### AI Engine Errors
- **Insufficient data**: Display message indicating more history needed (minimum 3 months)
- **Recommendation generation failures**: Fall back to basic insights, log error
- **Comparative analysis errors**: Show basic recommendations instead of comparisons
- **Pattern detection failures**: Skip advanced insights, provide basic recommendations

### Data Persistence Errors
- **Local storage full**: Implement data cleanup, notify user of storage issues
- **Data corruption**: Attempt recovery from backup, offer data reset option
- **Sync failures**: Queue for retry, show sync pending indicator
- **Export failures**: Show error message, allow retry with different format
- **Budget calculation date range failures**: Automatically use fallback calculation that queries all transactions in category without date filtering to ensure accurate progress display

### Overspending Detection Errors
- **Insufficient training data**: Display progress indicator with days remaining until activation
- **Anomaly calculation errors**: Fall back to basic spending alerts, log error for debugging
- **Tracker creation limit exceeded**: Show premium upgrade modal with overspending tracker benefits
- **Category classification errors**: Default to "Hybrid" classification, log error
- **Historical data corruption**: Reset tracker training period, notify user of restart

### Network and Connectivity Errors
- **Offline mode**: Show offline indicator, queue operations for sync
- **Leaderboard sync failures**: Show cached data with last update timestamp
- **Premium verification failures**: Allow offline premium features, verify on reconnect

### Business Mode Errors
- **Template application failures**: Fall back to manual budget creation
- **Profit calculation errors**: Show warning, allow manual correction
- **Business transaction categorization errors**: Default to "Other" category
- **Business analytics failures**: Show basic transaction list instead

### General Error Strategy
- All errors logged to console in development
- User-facing errors are friendly and actionable
- Critical errors trigger error boundary with recovery options
- Network errors distinguished from application errors
- Gamification errors never block core financial functionality

## Testing Strategy

### Unit Testing Framework
- **Framework**: Flutter's built-in `test` package with custom property test utilities
- **Coverage target**: 80% for business logic, gamification, and AI engine
- **Focus areas**: Services, data models, gamification logic, AI algorithms, premium feature enforcement

### Property-Based Testing Framework
- **Framework**: Custom generator-based approach using `test_api` (Dart lacks mature PBT library)
- **Minimum iterations**: 100 runs per property test
- **Focus areas**: Data validation, XP calculations, achievement unlocks, AI recommendations, freemium limits

### Unit Test Coverage

**Authentication and Profile Tests**
- Test account creation with default gamification data
- Test profile updates and persistence
- Test premium status management

**Transaction Management Tests**
- Test CRUD operations with XP awarding
- Test validation rules (amount > 0, required fields)
- Test Ghana-specific category system (25 expense, 4 income)
- Test filtering by date, category, search terms

**Budget and Goals Tests**
- Test Quick Budget creation with freemium limits (3 max for free users)
- Test Savings Goal creation and contribution tracking
- Test Comprehensive Budget allocation validation (Premium only)
- Test progress calculations and alert thresholds

**Gamification System Tests**
- Test XP awarding for different actions (transactions: +5, budgets: +15, goals: +20)
- Test level calculation: Level = (Total XP ÷ 100) + 1
- Test achievement unlocking for all 104 achievements
- Test daily streak management and milestone rewards
- Test challenge generation and completion
- Test mission progression and completion rewards

**AI Engine Tests**
- Test recommendation generation with Ghana-specific advice
- Test pattern detection (high spending >30%, frequent small transactions)
- Test comparative analysis for premium users
- Test student-friendly language and local context

**Premium Features Tests**
- Test freemium limit enforcement (3 budgets/goals, 1 overspending tracker for free users)
- Test premium feature unlocking (unlimited budgets, business mode, unlimited trackers)
- Test business mode calculations and templates
- Test overspending tracker creation and anomaly detection

**Bill Split Calculator Tests**
- Test equal split calculations
- Test custom amount splits
- Test split result accuracy and sharing

### Property-Based Test Coverage

Each property test must include a comment tag in this format: `// Feature: expense-tracking-ai-budgeting, Property X: [property description]`

**Property Test 1: User profile creation with defaults**
- Generate random valid names and emails
- Create profiles and verify default values (Level 1, 0 XP, 0 streak, GHS currency)
- **Feature: expense-tracking-ai-budgeting, Property 1: User profile creation with defaults**
- **Validates: Requirements 1.1, 1.5**

**Property Test 2: Input validation rejection**
- Generate invalid inputs (empty names, malformed emails, zero/negative amounts)
- Verify all invalid inputs are rejected with appropriate errors
- **Feature: expense-tracking-ai-budgeting, Property 2: Input validation rejection**
- **Validates: Requirements 1.3, 2.2, 2.3, 2.4, 4.3, 5.3**

**Property Test 3: Transaction creation with XP award**
- Generate random valid transaction data
- Create transactions and verify storage, ID generation, and 5 XP award
- **Feature: expense-tracking-ai-budgeting, Property 3: Transaction creation with XP award**
- **Validates: Requirements 2.1, 2.5**

**Property Test 6: Freemium limits enforcement**
- Generate attempts to create >3 budgets/goals for free users
- Verify all attempts beyond limit are blocked with upgrade prompts
- **Feature: expense-tracking-ai-budgeting, Property 6: Freemium limits enforcement**
- **Validates: Requirements 4.1, 5.1, 20.4**

**Property Test 8: Budget progress calculation with fallback resilience**
- Generate random expenses and budget limits
- Verify progress percentage calculation and alert thresholds
- Test fallback calculation when date range filtering encounters issues
- **Feature: expense-tracking-ai-budgeting, Property 8: Budget progress calculation with fallback resilience**
- **Validates: Requirements 4.4, 4.5, 4.6**

**Property Test 11: XP and level calculation consistency**
- Generate various user actions that award XP
- Verify XP totals and level calculations are accurate
- **Feature: expense-tracking-ai-budgeting, Property 11: XP and level calculation consistency**
- **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

**Property Test 13: Daily streak management**
- Generate daily app usage patterns with gaps
- Verify streak increments, resets, and milestone achievements
- **Feature: expense-tracking-ai-budgeting, Property 13: Daily streak management**
- **Validates: Requirements 8.1, 8.2, 8.3**

**Property Test 16: Leaderboard ranking accuracy**
- Generate random user XP data for different periods
- Verify ranking accuracy and current user highlighting
- **Feature: expense-tracking-ai-budgeting, Property 16: Leaderboard ranking accuracy**
- **Validates: Requirements 11.1, 11.2, 11.3, 11.4**

**Property Test 22: Anomaly detection accuracy**
- Generate spending data with known patterns and outliers
- Verify Z-score calculations and severity level assignments
- **Feature: expense-tracking-ai-budgeting, Property 22: Anomaly detection accuracy**
- **Validates: Requirements 15.5, 15.6, 15.7**

**Property Test 23: Category classification consistency**
- Generate all Ghana-specific categories
- Verify consistent Want/Need/Hybrid classification
- **Feature: expense-tracking-ai-budgeting, Property 23: Category classification consistency**
- **Validates: Requirements 15.8**

**Property Test 24: Training progress tracking**
- Generate trackers with varying amounts of historical data
- Verify progress indicators and activation thresholds
- **Feature: expense-tracking-ai-budgeting, Property 24: Training progress tracking**
- **Validates: Requirements 15.4, 15.5**

**Property Test 25: Bill split calculation accuracy**
- Generate random bill amounts and person counts
- Verify split calculations sum to total bill amount
- **Feature: expense-tracking-ai-budgeting, Property 22: Bill split calculation accuracy**
- **Validates: Requirements 16.1, 16.2**

**Property Test 30: Offline data synchronization**
- Generate data modifications while offline
- Restore connectivity and verify synchronization occurs
- **Feature: expense-tracking-ai-budgeting, Property 30: Offline data synchronization**
- **Validates: Requirements 21.2, 21.3, 21.5**

### Integration Testing
- Test complete user flows (signup → add transaction → create budget → view dashboard → earn achievements)
- Test gamification integration (XP awarding, achievement unlocks, level progression)
- Test premium upgrade flow and feature unlocking
- Test offline-to-online sync scenarios
- Test AI recommendation generation end-to-end

### Widget Testing
- Test UI components render correctly with gamification elements
- Test user interactions trigger correct state changes and XP awards
- Test navigation flows between all screens
- Test form validation displays correctly
- Test premium paywalls and upgrade prompts

### Performance Testing
- Verify dashboard loads within 2 seconds with 1000+ transactions
- Verify AI recommendations generate within 5 seconds
- Test app responsiveness with large achievement datasets
- Monitor memory usage during extended gamified sessions

### Gamification Testing
- Test all 104 achievements can be unlocked
- Test XP progression through all 25 levels
- Test daily streak tracking accuracy
- Test challenge generation and completion
- Test leaderboard ranking with large user datasets
- Test mission progression and completion rewards
