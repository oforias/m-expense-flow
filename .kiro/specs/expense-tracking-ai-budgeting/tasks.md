# Implementation Plan: M-Expense Flow

## Overview

This implementation plan transforms the basic expense tracker into a comprehensive gamified financial app for Ghanaian university students. The approach builds core functionality first, then adds gamification, premium features, and advanced integrations progressively.

## Tasks

- [x] 1. Set up Firebase project and core dependencies
- [x] 1.1 Configure Firebase project with Authentication, Firestore, Storage, and Functions
  - Create Firebase project for M-Expense Flow
  - Enable Authentication (email/password), Firestore, Storage, Cloud Functions
  - Add Firebase configuration to Flutter project
  - Set up Firestore security rules for user data protection
  - _Requirements: 1.1, 22.1, 22.2_

- [ ]* 1.2 Write property test for Firebase connection
  - **Property 1: User profile creation with defaults**
  - Generate random valid names and emails, create profiles, verify defaults
  - **Validates: Requirements 1.1, 1.5**

- [x] 1.3 Add Flutter dependencies for comprehensive features
  - Add firebase_core, firebase_auth, cloud_firestore, firebase_storage
  - Add provider for state management, intl for localization
  - Add fl_chart for analytics, pdf/excel for exports
  - Add shared_preferences for local settings cache
  - _Requirements: All_

- [x] 2. Implement authentication and user profile system
- [x] 2.1 Create AuthService with Firebase Authentication
  - Implement signUp(name, email, password) with Firebase Auth
  - Implement signIn(email, password) with Firebase Auth
  - Implement signOut() and resetPassword(email) methods
  - Create user document in Firestore on successful signup
  - Initialize default gamification data (Level 1, 0 XP, 0 streak)
  - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [ ]* 2.2 Write property test for input validation
  - **Property 2: Input validation rejection**
  - Generate invalid inputs (empty names, malformed emails), verify rejection
  - **Validates: Requirements 1.3, 2.2, 2.3, 2.4**

- [x] 2.3 Create UserRepository for Firestore operations
  - Implement createUserDocument(userId, userData) in Firestore
  - Implement getUserData(userId) from Firestore
  - Implement updateUserProfile(userId, updates) in Firestore
  - Implement uploadProfilePicture(userId, imageFile) to Firebase Storage
  - Implement deleteProfilePicture(userId) from Firebase Storage
  - _Requirements: 1.4, 19.2_

- [x] 2.4 Create AuthProvider for state management
  - Manage authentication state with ChangeNotifier
  - Handle user profile loading from Firestore
  - Manage session persistence with Firebase Auth
  - _Requirements: 1.1, 1.4_

- [x] 3. Implement core data models
- [x] 3.1 Create comprehensive data models
  - Create UserProfile model with gamification fields (level, xp, streak, isPremium)
  - Create Transaction model with Ghana-specific categories
  - Create QuickBudget and SavingsGoal models with freemium limits
  - Create Achievement, Challenge, and Mission models
  - Add toJson() and fromJson() methods for Firestore serialization
  - _Requirements: 1.5, 2.1, 4.1, 5.1, 7.1_

- [ ]* 3.2 Write property test for data model serialization
  - **Property: Data model round-trip serialization**
  - Generate random model instances, serialize to JSON, deserialize, verify equality
  - **Validates: Requirements 1.4, 2.1**

- [x] 3.3 Create category system with Ghana-specific categories
  - Define 25 expense categories (Uber/Bolt, Trotro & Transport, Situationship Spending, etc.)
  - Define 4 income categories (Allowance, Part-time Job, Business Income, Other)
  - Create CategoryDefinition model with icons and colors
  - Store category definitions in Firestore global collection
  - _Requirements: 3.1, 3.2_

- [x] 4. Implement transaction management system
- [x] 4.1 Create TransactionRepository for Firestore operations
  - Implement createTransaction(userId, transactionData) in Firestore
  - Implement getTransactions(userId, filters) with Firestore queries
  - Implement updateTransaction(userId, transactionId, updates)
  - Implement deleteTransaction(userId, transactionId)
  - Implement filtering by category, date range, and search terms
  - _Requirements: 2.1, 2.2, 18.1, 18.2, 18.3, 18.4_

- [ ]* 4.2 Write property test for transaction creation
  - **Property 3: Transaction creation with XP award**
  - Generate random transaction data, create transaction, verify storage and XP award
  - **Validates: Requirements 2.1, 2.5**

- [x] 4.3 Create TransactionProvider for state management
  - Manage transaction list state from Firestore with real-time updates
  - Handle CRUD operations with validation
  - Provide filtering and aggregation methods
  - Trigger gamification checks on transaction creation
  - _Requirements: 2.1, 2.5, 3.4, 3.5_

- [ ]* 4.4 Write property test for transaction filtering
  - **Property 5: Transaction filtering accuracy**
  - Generate transactions across categories and dates, verify filtering accuracy
  - **Validates: Requirements 3.4, 18.2, 18.3, 18.4**

- [x] 5. Implement budget and savings goal management
- [x] 5.1 Create BudgetRepository for Firestore operations
  - Implement createQuickBudget(userId, budgetData) with freemium limits
  - Implement createSavingsGoal(userId, goalData) with freemium limits
  - Implement createComprehensiveBudget(userId, budgetData) for Premium users
  - Implement budget progress calculations from Firestore transaction data with fallback calculation for date range issues
  - Implement savings goal contribution tracking
  - _Requirements: 4.1, 4.2, 4.6, 5.1, 5.2, 6.2_

- [ ]* 5.2 Write property test for freemium limits
  - **Property 6: Freemium limits enforcement**
  - Generate attempts to create >3 budgets/goals for free users, verify blocking
  - **Validates: Requirements 4.1, 5.1, 20.4**

- [x] 5.3 Create BudgetProvider for state management
  - Manage budget and savings goal state from Firestore
  - Calculate progress percentages and alert levels (80% warning, 100% alert)
  - Handle savings goal contributions with Firestore transactions
  - Enforce freemium limits (3 budgets/goals max for free users)
  - Implement fallback calculation resilience for date range filtering issues
  - _Requirements: 4.4, 4.5, 4.6, 5.4, 5.5, 25.1, 25.4_

- [ ]* 5.4 Write property test for budget progress calculation with fallback resilience
  - **Property 8: Budget progress calculation with fallback resilience**
  - Generate random expenses and budget limits, verify progress calculation
  - Test fallback calculation when date range filtering encounters issues
  - **Validates: Requirements 4.4, 4.5, 4.6**

- [x] 6. Checkpoint - Core functionality complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement gamification system
- [x] 7.1 Create Achievement system in Firestore
  - Create global achievements collection with 104 achievements
  - Organize achievements into categories (Transaction, Budget, Savings, Streak, etc.)
  - Create user achievements subcollection to track unlock status
  - Implement achievement unlock conditions and XP rewards
  - _Requirements: 7.1, 7.5, 12.1_

- [x] 7.2 Create GamificationRepository for Firestore operations
  - Implement awardXP(userId, amount, reason) in Firestore
  - Implement unlockAchievement(userId, achievementId) in Firestore
  - Implement updateStreak(userId) in Firestore user document
  - Implement getUserAchievements(userId) from Firestore
  - Implement getLeaderboardData(period) from Firestore
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 11.1_

- [x] 7.3 Create GamificationService for business logic
  - Implement checkAchievements(userId, context) via Cloud Function
  - Implement calculateLevel(totalXP) using formula: Level = (Total XP ÷ 100) + 1
  - Implement streak management with milestone rewards
  - Implement challenge generation and completion tracking
  - _Requirements: 7.4, 8.1, 8.2, 8.3, 9.1, 9.2_

- [ ]* 7.4 Write property test for XP and level calculation
  - **Property 11: XP and level calculation consistency**
  - Generate various XP amounts, verify level calculation and XP awarding
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [x] 7.5 Create GamificationProvider for state management
  - Manage XP, level, streak, and achievement state from Firestore
  - Handle real-time achievement unlocks with celebration animations
  - Provide challenge progress tracking
  - Manage leaderboard data with real-time updates
  - _Requirements: 7.5, 8.3, 9.2, 11.4_

- [ ]* 7.6 Write property test for daily streak management
  - **Property 13: Daily streak management**
  - Generate daily usage patterns with gaps, verify streak logic
  - **Validates: Requirements 8.1, 8.2, 8.3**

- [x] 8. Implement leaderboard system
- [x] 8.1 Create LeaderboardRepository for Firestore operations
  - Implement getWeeklyLeaderboard() from Firestore
  - Implement getMonthlyLeaderboard() from Firestore  
  - Implement getAllTimeLeaderboard() from Firestore
  - Implement getUserRank(userId, period) calculations
  - Implement updateUserLeaderboardData(userId, xpGained) via Cloud Function
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ]* 8.2 Write property test for leaderboard ranking
  - **Property 16: Leaderboard ranking accuracy**
  - Generate random user XP data, verify ranking accuracy and user highlighting
  - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**

- [x] 8.3 Create LeaderboardProvider for state management
  - Manage leaderboard state with real-time Firestore streams
  - Handle leaderboard period resets via Cloud Functions
  - Provide user rank highlighting and position tracking
  - Manage anonymous username display for privacy
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 9. Implement AI recommendation engine
- [x] 9.1 Create AIRepository for Firestore operations
  - Implement saveInsights(userId, insights) in Firestore
  - Implement getInsights(userId, period) from Firestore
  - Implement getUserSpendingPatterns(userId) aggregation from Firestore
  - Implement getPeerAverages(category) for Premium comparative analysis
  - _Requirements: 12.1, 12.5, 13.1_

- [x] 9.2 Create AIService with Cloud Functions
  - Implement analyzeSpendingPatterns(userId) via Cloud Function
  - Implement generateStudentRecommendations(userId) with Ghana-specific advice
  - Implement detectSpendingAnomalies(userId) for pattern detection
  - Implement generateComparativeInsights(userId) for Premium users
  - Include student-friendly language and local context (trotro vs Uber, midnight bundles)
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 13.1, 13.2_

- [ ]* 9.3 Write property test for AI recommendation generation
  - **Property 17: AI recommendation generation**
  - Generate spending patterns, verify 8-10 personalized recommendations
  - **Validates: Requirements 12.1, 12.4**

- [x] 9.4 Create AIProvider for state management
  - Manage AI insights state from Firestore
  - Handle recommendation generation via Cloud Functions
  - Provide basic insights for free users
  - Unlock advanced comparative analysis for Premium users
  - _Requirements: 12.5, 13.4, 13.5_

- [ ]* 9.5 Write property test for AI pattern detection
  - **Property 18: AI pattern detection**
  - Generate high spending scenarios (>30%), verify pattern detection and suggestions
  - **Validates: Requirements 12.2, 12.3**

- [x] 10. Implement premium subscription system
- [x] 10.1 Create PremiumRepository for Firestore operations
  - Implement checkPremiumStatus(userId) from Firestore
  - Implement upgradeToPremium(userId, subscriptionData) in Firestore
  - Implement updateSubscription(userId, subscriptionData)
  - Implement getPremiumFeatures(userId) based on subscription status
  - _Requirements: 20.1, 20.2, 20.5_

- [x] 10.2 Create PremiumService with Cloud Functions
  - Implement processPayment(paymentData) via Cloud Function
  - Implement verifySubscription(userId) server-side verification
  - Implement unlockPremiumFeatures(userId) in Firestore
  - Implement enforceLimits(userId, feature) based on Firestore premium status
  - _Requirements: 20.2, 20.4_

- [x] 10.3 Create PremiumProvider for state management
  - Manage subscription state from Firestore
  - Handle feature access control based on premium status
  - Display upgrade prompts and paywalls for free users
  - Manage premium badge display throughout app
  - _Requirements: 20.1, 20.3, 20.5_

- [ ]* 10.4 Write property test for premium upgrade effects
  - **Property 26: Premium upgrade effects**
  - Upgrade users to premium, verify feature unlocks and badge display
  - **Validates: Requirements 20.2, 20.5**

- [-] 11. Implement business mode (Premium feature)
- [x] 11.1 Create BusinessRepository for Firestore operations
  - Implement createBusinessProfile(userId, businessData) in Firestore
  - Implement createBusinessTransaction(userId, transactionData) in Firestore
  - Implement getBusinessTransactions(userId, filters) from Firestore
  - Implement createBusinessBudget(userId, template) using pre-built templates
  - Implement getBusinessAnalytics(userId, period) calculations
  - _Requirements: 14.2, 14.3, 14.4, 14.5_

- [x] 11.2 Create BusinessService with Cloud Functions
  - Implement enableBusinessMode(userId) in Firestore
  - Implement applyBusinessTemplate(userId, templateId) via Cloud Function
  - Implement calculateProfitMargin(userId, period) via Cloud Function
  - Implement generateBusinessInsights(userId) via Cloud Function
  - Create 6 business templates (Fashion Reseller, Food Vendor, Digital Services, etc.)
  - _Requirements: 14.2, 14.3, 14.4, 14.5_

- [ ]* 11.3 Write property test for business calculations
  - **Property 20: Business mode calculations**
  - Generate business transactions, verify profit margin and analytics calculations
  - **Validates: Requirements 14.4, 14.5**

- [x] 11.4 Create BusinessProvider for state management
  - Manage business transaction state from Firestore
  - Handle template application and business analytics
  - Provide business insights and profit tracking
  - Separate personal vs business finances
  - _Requirements: 14.2, 14.4, 14.5_

- [-] 12. Implement intelligent overspending detection with dual-mode system
- [x] 12.1 Create enhanced OverspendingRepository for Firestore operations
  - Implement createTracker(userId, trackerData) in Firestore with mode selection (Conservative/Quick Start) and freemium limits
  - Implement updateTrackerMode(userId, trackerId, newMode) for mode switching
  - Implement savePatternValidation(userId, trackerId, validationData) for user pattern confirmation
  - Implement saveContextualPeriod(userId, trackerId, periodData) for marking unusual periods
  - Implement updateBaselineRejectionCount(userId, trackerId, count) for tracking user rejections
  - Implement getTrackerPerformanceMetrics(userId, trackerId) for mode recommendation analysis
  - _Requirements: 15.1, 15.2, 15.3, 23.4, 25.1_

- [x] 12.2 Create enhanced OverspendingService with dual-mode logic
  - Implement createTrackerWithMode(userId, category, mode) with Ghana-specific baseline suggestions
  - Implement validateSpendingPatterns(userId, trackerId, day14Check) for pattern validation prompts
  - Implement filterLearningPeriodAnomalies(spendingData, creationDate) to exclude first 21-day spikes
  - Implement detectDailyAnomaly() with mode-specific thresholds and ML weight progression
  - Implement handleModeSwitch(userId, trackerId, fromMode, toMode) for Conservative/Quick Start switching
  - Implement applyContextualThresholds(baseThreshold, context) for weekend/exam period adjustments
  - Implement trackHabitImprovement(userId, trackerId, spendingTrend) for celebrating progress
  - _Requirements: 15.6, 15.7, 15.9, 23.5, 24.1, 24.3, 25.2, 25.4_

- [x]* 12.3 Write property test for dual-mode behavior
  - **Property 33: Overspending tracker mode behavior**
  - Create trackers in both modes, verify Conservative (21-day) vs Quick Start (7-day) timelines
  - **Validates: Requirements 15.6, 15.9, 25.2, 25.4**

- [ ]* 12.4 Write property test for learning period anomaly exclusion
  - **Property 34: Learning period anomaly exclusion**
  - Generate spending spikes in first 21 days, verify exclusion from baseline calculations
  - **Validates: Requirements 24.1, 23.4**

- [x] 12.5 Create enhanced OverspendingProvider with pattern validation
  - Manage dual-mode tracker state from Firestore with mode selection UI
  - Handle pattern validation prompts at day 14 ("Do patterns feel typical?")
  - Provide mode switching functionality with appropriate warnings and reset logic
  - Manage contextual period marking (exams, holidays, unusual spending periods)
  - Handle baseline adjustment suggestions with trend visualization and sustainability checks
  - Track and display habit improvement progress with congratulations
  - _Requirements: 15.7, 15.8, 23.5, 24.4, 24.10, 25.6, 25.9_

- [ ]* 12.6 Write property test for pattern validation prompts
  - **Property 35: Pattern validation prompts**
  - Create trackers reaching 14 days, verify pattern validation prompts and period extensions
  - **Validates: Requirements 15.7, 15.8, 23.5, 23.6**

- [ ]* 12.7 Write property test for baseline adjustment approval
  - **Property 36: Baseline adjustment approval**
  - Generate ML baseline increase suggestions, verify user approval requirements and sustainability checks
  - **Validates: Requirements 15.14, 15.15, 23.9, 23.10, 23.11**

- [ ]* 12.8 Write property test for contextual spending exclusion
  - **Property 37: Contextual spending exclusion**
  - Mark transactions as one-time/emergency/unusual periods, verify exclusion from ML learning
  - **Validates: Requirements 24.7, 24.8, 24.9**

- [ ]* 12.9 Write property test for mode switching functionality
  - **Property 38: Mode switching functionality**
  - Switch between modes, verify reset behavior and appropriate warnings
  - **Validates: Requirements 25.6, 25.7, 25.9**

- [ ]* 12.10 Write property test for habit improvement recognition
  - **Property 39: Habit improvement recognition**
  - Generate consistent below-baseline spending, verify progress recognition and baseline reduction offers
  - **Validates: Requirements 24.3, 24.10**

- [ ]* 5.5 Write property test for budget calculation fallback resilience
  - **Property 40: Budget calculation fallback resilience**
  - Generate budget scenarios with date range filtering issues, verify automatic fallback
  - Verify accurate progress calculation and 'fallbackUsed' flag
  - **Validates: Requirements 25.1, 25.2, 25.3**

- [x] 13. Implement bill split calculator
- [x] 13.1 Create SplitCalculatorService
  - Implement calculateEqualSplit(totalAmount, numberOfPeople)
  - Implement calculateCustomSplit(totalAmount, customAmounts)
  - Implement validateSplitAmounts(totalAmount, splitAmounts)
  - Implement generateSplitSummary(splitData)
  - _Requirements: 16.1, 16.2_

- [x]* 13.2 Write property test for bill split calculations
  - **Property 22: Bill split calculation accuracy**
  - Generate random bill amounts and splits, verify calculations sum to total
  - **Validates: Requirements 16.1, 16.2**

- [x] 13.3 Create SplitCalculatorProvider for state management
  - Manage split calculation state
  - Handle split result sharing and saving
  - Track split usage for achievements
  - Provide option to add user's portion as transaction
  - _Requirements: 16.2, 16.3, 16.4, 16.5_

- [-] 14. Implement comprehensive UI screens
- [x] 14.1 Create Authentication screens
  - Create Login screen with email/password fields and validation
  - Create SignUp screen with name/email/password fields and validation
  - Implement navigation between login/signup screens
  - Display validation errors and loading states
  - Navigate to Dashboard on successful authentication
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 14.2 Create Dashboard screen with gamification
  - Display current balance (Income - Expenses) and monthly spending chart
  - Show streak count with fire emoji, level progress bar, and recent achievements
  - Display top 5 spending categories and budget health indicators
  - Show recent transactions (last 5) with category badges
  - Include quick action buttons for adding transactions and creating budgets
  - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [ ]* 14.3 Write property test for dashboard data completeness
  - **Property 23: Dashboard data completeness**
  - Generate user data, verify dashboard displays all required elements
  - **Validates: Requirements 17.1, 17.2**

- [x] 14.4 Create Add/Edit Transaction screen
  - Implement type toggle (Income/Expense) with Ghana-specific categories
  - Add amount input with validation (must be > 0)
  - Include category dropdown with 25 expense or 4 income categories
  - Add description text field and date picker
  - Display validation errors and award 5 XP on successful creation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2_

- [x] 14.5 Create Budget Management screen
  - Create Quick Budgets tab with freemium limits (3 max for free users)
  - Create Savings Goals tab with freemium limits (3 max for free users)
  - Create Comprehensive Budget tab (Premium only) with upgrade prompts
  - Display budget progress bars with color coding (green/yellow/red)
  - Show savings goal progress circles and contribution options
  - _Requirements: 4.1, 4.2, 4.4, 5.1, 5.2, 6.1, 6.2_

- [x] 14.6 Create Gamification screens (Rewards tab)
  - Create Overview tab with level display, XP progress, and streak count
  - Create Challenges tab with daily/weekly/monthly challenges and progress
  - Create Achievements tab with grid layout of 104 achievements
  - Create Leaderboard tab with weekly/monthly/all-time rankings
  - Include celebration animations for achievement unlocks
  - _Requirements: 7.4, 7.5, 8.3, 9.2, 9.4, 11.1, 11.4_

- [x] 14.7 Create Transaction History screen
  - Display all transactions sorted by date descending
  - Implement search bar and filter dropdowns (type, date range, category)
  - Add pagination (20 transactions per page) for performance
  - Include transaction cards with amount, category badge, and description
  - Provide edit/delete options for each transaction
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [x] 14.8 Create AI Insights screen
  - Display AI-generated recommendations with Ghana-specific context
  - Show basic insights for free users, advanced comparative analysis for Premium
  - Include spending alerts and pattern detection warnings
  - Display insights with icons, priorities, and actionable suggestions
  - Show upgrade prompts for Premium-only comparative features
  - _Requirements: 12.1, 12.4, 12.5, 13.1, 13.2, 13.5_

- [x] 14.9 Create Premium Features screen
  - Display feature comparison table (Free vs Premium)
  - Show pricing (GHS 19/month with 35% student discount)
  - Include funny motivational quotes for free users
  - List all premium benefits (unlimited budgets, AI insights, Business Mode, unlimited overspending trackers)
  - Implement upgrade flow with payment processing
  - _Requirements: 20.1, 20.2, 20.3, 20.4_

- [x] 14.10 Create Business Mode screen (Premium only)
  - Display premium paywall for free users
  - Show business dashboard with revenue, expenses, profit margin
  - Provide 6 business templates for budget creation
  - Include business transaction tracking separate from personal
  - Display business analytics and AI insights
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 14.11 Create enhanced Overspending Detection screen with dual-mode system
  - Display mode selection UI: "Conservative (Recommended)" vs "Quick Start" with explanations
  - Show Ghana-specific baseline suggestions with slider controls and "This seems right for me" confirmation
  - Include pattern validation prompts at day 14: "Do your spending patterns feel typical or unusual?"
  - Display training progress indicators (7 days Quick Start, 21 days Conservative) with ML weight progression
  - Show active anomaly alerts with mode-specific disclaimers ("Still learning your patterns" for Quick Start)
  - Provide mode switching functionality with warnings and reset confirmations
  - Include contextual period marking UI (exams, holidays, unusual spending periods)
  - Display baseline adjustment suggestions with trend visualization and sustainability confirmation
  - Show habit improvement progress and congratulations for consistent below-baseline spending
  - Handle freemium limits (1 tracker for free users) with upgrade prompts for unlimited trackers
  - _Requirements: 15.6, 15.7, 23.4, 23.5, 24.4, 25.1, 25.6, 25.8_

- [x] 14.12 Create Bill Split Calculator screen
  - Input section for total bill amount and number of people
  - Toggle between equal split and custom amounts
  - Display split results with each person's share
  - Include copy/share functionality and save to transactions option
  - Track usage for "Split Master" achievements
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 14.13 Create Settings screen
  - Profile section with name/email editing and profile picture upload
  - Preferences section with dark mode toggle and currency selection
  - Account section with subscription status and premium badge
  - Data management section with export options (Premium) and account deletion
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [x] 15. Implement offline functionality and data synchronization
- [x] 15.1 Configure Firestore offline persistence
  - Enable Firestore offline persistence in Firebase initialization
  - Configure cache size and offline settings
  - Implement offline indicators in UI
  - _Requirements: 21.1, 21.4_

- [ ]* 15.2 Write property test for offline data synchronization
  - **Property 30: Offline data synchronization**
  - Create data offline, restore connectivity, verify synchronization
  - **Validates: Requirements 21.2, 21.3, 21.5**

- [x] 15.3 Implement offline state management
  - Show offline indicators when connectivity is lost
  - Queue operations for sync when connectivity is restored
  - Display sync pending indicators for offline changes
  - Handle sync conflicts using last-write-wins strategy
  - _Requirements: 21.2, 21.3, 21.4, 21.5_

- [x] 16. Implement Cloud Functions for server-side processing
- [x] 16.1 Create gamification Cloud Functions
  - Implement achievement checking and unlocking
  - Implement leaderboard updates and ranking calculations
  - Implement challenge generation and completion tracking
  - Implement XP awarding and level calculations
  - _Requirements: 7.1, 7.5, 8.3, 9.2, 11.5_

- [x] 16.2 Create AI analysis Cloud Functions
  - Implement spending pattern analysis
  - Implement recommendation generation with Ghana-specific context
  - Implement comparative analysis for Premium users
  - Implement peer average calculations for benchmarking
  - _Requirements: 12.1, 12.2, 13.1, 13.2_

- [x] 16.3 Create premium and business Cloud Functions
  - Implement subscription verification and management
  - Implement business analytics and profit calculations
  - Implement overspending tracker limit enforcement
  - Implement data export generation for Premium users
  - _Requirements: 14.4, 15.2, 19.3, 20.2_

- [-] 17. Implement security and data protection
- [x] 17.1 Create comprehensive Firestore security rules
  - Implement user data access restrictions (users can only access their own data)
  - Create leaderboard read-only access for authenticated users
  - Implement global collection read-only access
  - Add premium feature access validation in security rules
  - _Requirements: 22.1, 22.2_

- [ ]* 17.2 Write property test for data access authorization
  - **Property 28: Data access authorization**
  - Attempt to access other users' data, verify access is blocked
  - **Validates: Requirements 22.2**

- [x] 17.3 Create Firebase Storage security rules
  - Implement profile picture access restrictions to owner only
  - Add authentication checks for file uploads and downloads
  - _Requirements: 22.1_

- [x] 17.4 Implement data encryption and privacy protection
  - Encrypt sensitive MoMo account details in Firestore
  - Implement anonymous usernames for leaderboards
  - Ensure peer comparison data is aggregated and anonymous
  - _Requirements: 13.3, 22.4_

- [ ]* 17.5 Write property test for data deletion completeness
  - **Property 32: Data deletion completeness**
  - Request account deletion, verify all associated data is permanently removed
  - **Validates: Requirements 22.5**

- [-] 18. Final integration and testing
- [x] 18.1 Create main app structure with navigation
  - Set up MaterialApp with light/dark themes
  - Configure routing between all screens
  - Set up Provider hierarchy for all state management
  - Implement authentication-based routing (login vs main app)
  - _Requirements: 19.1_

- [x] 18.2 Implement comprehensive error handling
  - Add error boundaries for graceful failure handling
  - Implement retry mechanisms for network errors
  - Add user-friendly error messages throughout the app
  - Handle gamification errors without blocking core functionality
  - _Requirements: All error handling_

- [x] 18.3 Implement push notifications (optional)
  - Set up Firebase Cloud Messaging
  - Send achievement unlock notifications
  - Send budget alert notifications
  - Send streak reminder notifications
  - _Requirements: Achievement celebrations, budget alerts_

- [x] 18.4 Performance optimization and testing
  - Implement lazy loading for heavy screens
  - Optimize Firestore queries with proper indexing
  - Add loading states and skeleton screens
  - Test app performance with large datasets (1000+ transactions)
  - _Requirements: 17.5_

- [x] 19. Final checkpoint - Complete system testing
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and user feedback
- Property tests validate universal correctness properties across all inputs
- The implementation follows a progressive approach: core functionality → gamification → premium features
- Firebase provides real-time updates, cross-device sync, and secure premium feature management
- Cloud Functions handle heavy processing (AI analysis, leaderboard updates, premium verification)
- Enhanced overspending detection uses dual-mode system:
  - **Conservative Mode**: 21-day baseline-only period with gradual ML integration for maximum accuracy
  - **Quick Start Mode**: 7-day baseline period with immediate ML learning for faster feedback
  - Multiple protection layers prevent AI from learning bad spending habits during initial period
  - Pattern validation, contextual intelligence, and habit improvement recognition included
- Local Z-score analysis ensures privacy while providing intelligent anomaly detection
- **Budget Calculation Resilience**: Current implementation uses fallback calculation to ensure accurate progress display. The fallback bypasses date range filtering and queries all transactions in the category. Future optimization should re-enable proper date range calculation once date issues are resolved.
- Cloud Functions handle heavy processing (AI analysis, leaderboard updates, premium verification)
- Enhanced overspending detection uses dual-mode system:
  - **Conservative Mode**: 21-day baseline-only period with gradual ML integration for maximum accuracy
  - **Quick Start Mode**: 7-day baseline period with immediate ML learning for faster feedback
  - Multiple protection layers prevent AI from learning bad spending habits during initial period
  - Pattern validation, contextual intelligence, and habit improvement recognition included
- Local Z-score analysis ensures privacy while providing intelligent anomaly detection
