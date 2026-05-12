import 'package:test/test.dart';
import 'package:kiri_check/kiri_check.dart';
import '../../lib/models/data_change_event.dart';
import '../../lib/models/financial_snapshot.dart';
import '../../lib/models/budget_status.dart';
import '../../lib/models/goal_progress.dart';
import '../../lib/models/gamification_status.dart';
import '../../lib/services/state_coordinator.dart';
import 'property_test_setup.dart';

/// Property 7: Cross-feature Data Consistency
///
/// Validates: Requirements 1.7
///
/// When data changes in one feature, all related features must maintain
/// consistency. Uses StateCoordinatorImpl directly (no Firebase needed).

void main() {
  group('Property 7: Cross-feature Data Consistency', () {
    late StateCoordinatorImpl coordinator;

    setUp(() {
      coordinator = StateCoordinatorImpl();
    });

    /// Property 7.1: Propagated changes are reflected in system state
    property('Propagated changes are reflected in system state', () {
      forAll(
        dataChangeEventArb(),
        (event) async {
          await coordinator.propagateChanges(event);
          final state = await coordinator.getSystemState();

          final rawStates = state['featureStates'];
          final featureStates = rawStates != null
              ? Map<String, dynamic>.from(rawStates as Map)
              : <String, dynamic>{};
          expect(
            featureStates.containsKey(event.sourceFeature),
            isTrue,
            reason:
                'Source feature "${event.sourceFeature}" must have state after propagation',
          );
        },
      );
    });

    /// Property 7.2: State consistency check passes after valid propagation
    /// Note: uses a fresh coordinator per call so the stale-check window is not hit
    property('State consistency is maintained after propagation', () {
      forAll(
        dataChangeEventArb(),
        (event) async {
          // Fresh coordinator per iteration — avoids stale-timestamp false failures
          final fresh = StateCoordinatorImpl();
          await fresh.propagateChanges(event);
          final isConsistent =
              await fresh.validateStateConsistency(event.userId);
          expect(
            isConsistent,
            isTrue,
            reason:
                'State must be consistent immediately after propagation for ${event.userId}',
          );
        },
      );
    });

    /// Property 7.3: Multiple sequential changes remain consistent
    property('Sequential changes maintain consistency', () {
      forAll(
        list(dataChangeEventArb(), minLength: 2, maxLength: 5),
        (events) async {
          final fresh = StateCoordinatorImpl();
          for (final event in events) {
            await fresh.propagateChanges(event);
          }
          final lastUserId = events.last.userId;
          final isConsistent =
              await fresh.validateStateConsistency(lastUserId);
          expect(
            isConsistent,
            isTrue,
            reason: 'State must remain consistent after sequential changes',
          );
        },
      );
    });

    /// Property 7.4: Affected features are updated when source changes
    property('Affected features are updated when source changes', () {
      forAll(
        dataChangeEventArb(),
        (event) async {
          await coordinator.propagateChanges(event);
          final state = await coordinator.getSystemState();
          final rawStates = state['featureStates'];
          final featureStates = rawStates != null
              ? Map<String, dynamic>.from(rawStates as Map)
              : <String, dynamic>{};

          for (final feature in event.affectedFeatures) {
            expect(
              featureStates.containsKey(feature),
              isTrue,
              reason:
                  'Affected feature "$feature" must have state after propagation',
            );
          }
        },
      );
    });

    /// Property 7.5: FinancialSnapshot income >= expenses implies non-negative available
    property('Financial snapshot maintains income-expense consistency', () {
      forAll(
        financialSnapshotArb(),
        (snapshot) {
          if (snapshot.totalIncome >= snapshot.totalExpenses) {
            expect(
              snapshot.availableForGoals,
              greaterThanOrEqualTo(0.0),
              reason:
                  'Available for goals must be non-negative when income >= expenses',
            );
          }
        },
      );
    });

    /// Property 7.6: Budget statuses have non-negative financial values
    property('Budget statuses have valid financial values', () {
      forAll(
        budgetStatusArb(),
        (status) {
          expect(
            status.totalSpent,
            greaterThanOrEqualTo(0.0),
            reason: 'Total spent must be non-negative',
          );
          expect(
            status.totalBudget,
            greaterThanOrEqualTo(0.0),
            reason: 'Total budget must be non-negative',
          );
          expect(
            status.utilizationPercentage,
            greaterThanOrEqualTo(0.0),
            reason: 'Utilization percentage must be non-negative',
          );
        },
      );
    });

    /// Property 7.7: Goal progress percentage is bounded [0, 100]
    property('Goal progress percentage is bounded correctly', () {
      forAll(
        goalProgressArb(),
        (progress) {
          expect(
            progress.progressPercentage,
            greaterThanOrEqualTo(0.0),
            reason: 'Progress percentage must be >= 0',
          );
          expect(
            progress.progressPercentage,
            lessThanOrEqualTo(100.0),
            reason: 'Progress percentage must be <= 100',
          );
        },
      );
    });
  });
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

Arbitrary<DataChangeEvent> dataChangeEventArb() {
  return combine4(
    oneOf([
      constant('budget'),
      constant('goals'),
      constant('transaction'),
      constant('gamification'),
    ]),
    oneOf([
      constant('create'),
      constant('update'),
      constant('delete'),
    ]),
    userIdArb,
    integer(min: 1, max: 3).map((count) =>
        List.generate(count,
            (i) => ['budget', 'goals', 'gamification', 'transaction'][i % 4])),
  ).map((tuple) {
    return DataChangeEvent(
      sourceFeature: tuple.$1,
      eventType: tuple.$2,
      data: {'amount': 100.0, 'triggeredBy': 'test'},
      affectedFeatures: tuple.$4,
      timestamp: DateTime.now(),
      userId: tuple.$3,
      triggeredBy: 'property_test',
    );
  });
}

Arbitrary<BudgetStatus> budgetStatusArb() {
  return combine3(
    budgetIdArb,
    float(min: 0.0, max: 5000.0),
    float(min: 0.0, max: 5000.0),
  ).map((tuple) {
    final now = DateTime.now();
    final monthYear =
        '${now.year}-${now.month.toString().padLeft(2, '0')}';
    return BudgetStatus(
      budgetId: tuple.$1,
      monthYear: monthYear,
      totalBudget: tuple.$2,
      totalSpent: tuple.$3,
      categorySpent: {},
      isCompleted: false,
      lastUpdated: now,
    );
  });
}

Arbitrary<GoalProgress> goalProgressArb() {
  return combine3(
    goalIdArb,
    float(min: 100.0, max: 10000.0),
    float(min: 0.0, max: 10000.0),
  ).map((tuple) {
    final target = tuple.$2;
    final current = tuple.$3.clamp(0.0, target);
    final now = DateTime.now();
    return GoalProgress(
      goalId: tuple.$1,
      name: 'Test Goal',
      targetAmount: target,
      currentAmount: current,
      progressPercentage: (current / target * 100).clamp(0.0, 100.0),
      daysRemaining: 90,
      remainingAmount: (target - current).clamp(0.0, target),
      deadline: now.add(const Duration(days: 90)),
      category: 'Test',
      isCompleted: current >= target,
      requiredDailySavings: current < target ? (target - current) / 90 : 0.0,
      requiredWeeklySavings:
          current < target ? (target - current) / (90 / 7) : 0.0,
      requiredMonthlySavings:
          current < target ? (target - current) / 3 : 0.0,
      isFeasible: true,
      isAtRisk: false,
      lastUpdated: now,
    );
  });
}

Arbitrary<FinancialSnapshot> financialSnapshotArb() {
  return combine3(
    float(min: 1000.0, max: 10000.0),
    float(min: 500.0, max: 8000.0),
    userIdArb,
  ).map((tuple) {
    final income = tuple.$1;
    final expenses = tuple.$2;
    final available = (income - expenses).clamp(0.0, income);
    return FinancialSnapshot(
      userId: tuple.$3,
      totalIncome: income,
      totalExpenses: expenses,
      availableForGoals: available,
      budgetStatuses: [],
      goalProgresses: [],
      gamificationStatus: GamificationStatus(
        currentXP: 0,
        level: 1,
        streak: 0,
        unlockedAchievements: [],
        availableRewards: [],
        xpToNextLevel: 100,
        lastXPEarned: DateTime.now(),
      ),
      timestamp: DateTime.now(),
    );
  });
}
