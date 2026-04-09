# M-Expense Flow

> AI-powered personal finance management for Ghanaian university students.

M-Expense Flow is a Flutter mobile application that helps Ghanaian university students track expenses, manage budgets, and build savings habits — with culturally relevant categories (Trotro, Chop Money, Midnight Data Bundles), machine learning anomaly detection, Gemini AI-powered insights, and a gamification system designed to keep users engaged long-term.

---

## Key Features

- **Interconnection Engine** — an event-driven coordination layer that creates intelligent relationships between features. When a budget period ends with a surplus, the engine automatically surfaces a recommendation to allocate it to an active savings goal with a single tap.
- **ML Anomaly Detection** — Isolation Forest algorithm (implemented in TypeScript) detects unusual spending patterns and flags them in real time. Uses a hybrid general/personalized model architecture to handle the cold-start problem for new users.
- **Gemini AI Insights** — Google Gemini 1.5 Flash generates plain-language explanations of detected anomalies and provides contextual spending pattern analysis via Firebase Cloud Functions.
- **Financial Health Score** — a composite score (0–100) computed from budget adherence, savings rate, goal progress, spending consistency, and emergency fund status.
- **Savings Goals with Feasibility Validation** — real-time calculation of required weekly savings vs available income, with a colour-coded feasibility indicator on the goal creation screen.
- **Gamification** — 104 achievements, XP progression across 25 levels, daily/weekly challenges, and multi-step missions grounded in Self-Determination Theory.
- **Premium Subscription & Free Trial** — 14-day free trial, monthly/semester/yearly plans with student discount, payment processing via Paystack.
- **Property-Based Testing** — 8 formal correctness properties defined using `kiri_check`; 5 fully validated with 32 passing test cases covering budget surplus allocation, AI insight generation, access control, XP calculation, and onboarding data integrity.
- **Offline-First** — core features (transaction entry, budget viewing, goal tracking) work without internet; data syncs automatically when connectivity is restored.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile frontend | Flutter / Dart |
| State management | Provider |
| Cloud database | Firebase Firestore |
| Authentication | Firebase Authentication |
| Backend functions | Firebase Cloud Functions (TypeScript) |
| AI insights | Google Gemini 1.5 Flash API |
| Anomaly detection | Isolation Forest (TypeScript) + scikit-learn (Python) |
| Payment processing | Paystack |
| Push notifications | Firebase Cloud Messaging |
| Charts | fl_chart |
| Property-based testing | kiri_check (Dart) |

---

## Project Structure

```
lib/
  models/          # Data models (Transaction, Budget, SavingsGoal, etc.)
  repositories/    # Firestore data access layer
  services/        # Business logic, Interconnection Engine, ML, AI
  providers/       # Provider-pattern state management
  screens/         # UI screens
  widgets/         # Reusable UI components
  utils/           # Theme, constants, error handling

functions/src/
  ai/              # Gemini AI Cloud Functions
  ml/              # Isolation Forest TypeScript implementation + Python KMeans
  gamification/    # XP, achievements, challenges Cloud Functions
  premium/         # Subscription, trial management, Paystack webhook
  notifications/   # FCM push notification functions

test/
  property_tests/  # kiri_check property-based tests (8 properties)
  integration/     # Cross-feature workflow integration tests
```

---

## Running Locally

### Prerequisites

- Flutter SDK (^3.8.1)
- Android Studio or VS Code with Flutter extension
- Firebase CLI (`npm install -g firebase-tools`)
- Node.js 18+ (for Cloud Functions)
- A Firebase project on the Blaze plan (required for Cloud Functions)

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/YOUR_USERNAME/m-expense-flow.git
   cd m-expense-flow
   ```

2. **Firebase configuration**

   Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com), then:
   ```bash
   flutterfire configure
   ```
   This generates `lib/firebase_options.dart` and `android/app/google-services.json` — these are gitignored and must be generated per environment.

3. **Install Flutter dependencies**
   ```bash
   flutter pub get
   ```

4. **Install Cloud Functions dependencies**
   ```bash
   cd functions
   npm install
   ```

5. **Configure Cloud Functions secrets**

   Create `functions/.runtimeconfig.json` (gitignored):
   ```json
   {
     "gemini": {
       "api_key": "YOUR_GEMINI_API_KEY",
       "model": "gemini-1.5-flash"
     },
     "paystack": {
       "secret_key": "YOUR_PAYSTACK_SECRET_KEY"
     }
   }
   ```

6. **Deploy Cloud Functions** (requires Blaze plan)
   ```bash
   firebase deploy --only functions
   ```

7. **Run the app**
   ```bash
   flutter run
   ```

### Running Tests

```bash
# Property-based tests
flutter test test/property_tests/

# Integration tests
flutter test test/integration/

# All tests
flutter test
```

---

## Architecture Highlight — The Interconnection Engine

The central architectural innovation is the **Interconnection Engine**, an event-driven coordination layer built on Dart's `StreamController` with broadcast streams. It consists of four components:

- **EventBus** — publish-subscribe pattern with priority-ordered async queue and circuit breaker (opens after 5 consecutive errors, recovers after 60s)
- **DataIntegrator** — aggregates budget, transaction, and user data into a `FinancialSnapshot` with per-source timeout protection
- **CrossFeatureRecommendationSystem** — generates ranked recommendations spanning budgets, goals, and AI insights from the snapshot
- **StateCoordinator** — propagates `DataChangeEvent`s to all registered feature listeners

This enables workflows like: budget period ends → surplus detected → goal allocation recommendation surfaced → user confirms with one tap → both budget and goal records updated atomically.

---

## Known Limitations

- Two `StateCoordinator` methods (`_updateBudgetFromTransaction`, `_updateGoalsFromIncome`) are implemented as stubs; user-facing functionality is unaffected as updates occur through direct provider paths
- Properties 2, 7, and 8 in the property-based test suite are blocked by library migration issues, not logic failures
- Full end-to-end ML personalized recommendation pipeline requires production deployment with real user data
- Firebase Cloud Functions require the Blaze (pay-as-you-go) plan; the free tier covers expected usage at no cost

---

## Capstone Project

Built as an undergraduate capstone project at Ashesi University, Department of Computer Science, April 2026.
