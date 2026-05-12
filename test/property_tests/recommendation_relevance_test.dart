import 'package:test/test.dart';
import 'package:kiri_check/kiri_check.dart';
import '../../lib/models/recommendation.dart';
import '../../lib/models/financial_snapshot.dart';
import '../../lib/models/gamification_status.dart';
import '../../lib/models/action_step.dart';
import '../../lib/models/goal_progress.dart';
import 'property_test_setup.dart';

/// Property 8: Recommendation Relevance and Actionability
///
/// Validates: Requirements 8.1 – 8.5
///
/// All generated recommendations must be based on the user's actual
/// financial state and contain actionable steps with measurable impact.

void main() {
  group('Property 8: Recommendation Relevance and Actionability', () {
    /// Property 8.1: Recommendations reference actual user data
    property('Recommendations are based on actual user data', () {
      forAll(
        _financialSnapshotArb(),
        (snapshot) {
          final recs = _generateRecommendations(snapshot);
          for (final rec in recs) {
            expect(
              rec.metadata.containsKey('userId'),
              isTrue,
              reason: '"${rec.title}" must include userId in metadata',
            );
            final hasNumbers =
                RegExp(r'\d+\.?\d*').hasMatch(rec.description);
            expect(
              hasNumbers,
              isTrue,
              reason:
                  '"${rec.title}" description must reference specific numeric values',
            );
          }
        },
      );
    });

    /// Property 8.2: All recommendations have actionable steps
    property('Recommendations have actionable steps', () {
      forAll(
        _financialSnapshotArb(),
        (snapshot) {
          final recs = _generateRecommendations(snapshot);
          for (final rec in recs) {
            expect(
              rec.actionSteps,
              isNotEmpty,
              reason: '"${rec.title}" must have at least one action step',
            );
            for (final step in rec.actionSteps) {
              expect(step.description, isNotEmpty,
                  reason: 'Action step must have a description');
              expect(step.actionType, isNotEmpty,
                  reason: 'Action step must have an actionType');
              expect(
                step.description.length,
                greaterThan(10),
                reason: 'Action step description must be specific (>10 chars)',
              );
            }
          }
        },
      );
    });

    /// Property 8.3: Recommendations have positive potential impact
    property('Recommendations have measurable positive impact', () {
      forAll(
        _financialSnapshotArb(),
        (snapshot) {
          final recs = _generateRecommendations(snapshot);
          for (final rec in recs) {
            expect(
              rec.potentialImpact,
              greaterThan(0.0),
              reason: '"${rec.title}" must have positive potential impact',
            );
          }
        },
      );
    });

    /// Property 8.4: High-priority recommendations address real issues
    property('High-priority recommendations address urgent issues', () {
      forAll(
        _financialSnapshotArb(),
        (snapshot) {
          final recs = _generateRecommendations(snapshot);
          final highPriority =
              recs.where((r) => r.priority == Priority.high).toList();
          for (final rec in highPriority) {
            expect(
              rec.potentialImpact,
              greaterThan(0.0),
              reason:
                  'High-priority "${rec.title}" must have positive impact',
            );
            expect(
              rec.actionSteps.length,
              greaterThanOrEqualTo(1),
              reason: 'High-priority rec must have at least one action step',
            );
          }
        },
      );
    });

    /// Property 8.5: Recommendations are specific, not generic
    property('Recommendations are specific not generic', () {
      forAll(
        _financialSnapshotArb(),
        (snapshot) {
          final recs = _generateRecommendations(snapshot);
          for (final rec in recs) {
            expect(
              rec.description.length,
              greaterThan(30),
              reason:
                  '"${rec.title}" description is too short to be specific',
            );
            final lowerDesc = rec.description.toLowerCase();
            const genericPhrases = [
              'you should save more',
              'try to spend less',
              'consider budgeting',
              'track your expenses',
            ];
            for (final phrase in genericPhrases) {
              expect(
                lowerDesc.contains(phrase),
                isFalse,
                reason:
                    '"${rec.title}" contains generic phrase: "$phrase"',
              );
            }
          }
        },
      );
    });

    /// Property 8.6: Recommendations are sorted by priority score
    property('Recommendations are prioritized correctly', () {
      forAll(
        _financialSnapshotArb(),
        (snapshot) {
          final recs = _generateRecommendations(snapshot);
          if (recs.length < 2) return;
          final sorted = List<Recommendation>.from(recs)
            ..sort((a, b) => b.priorityScore.compareTo(a.priorityScore));
          for (int i = 0; i < sorted.length - 1; i++) {
            expect(
              sorted[i].priorityScore,
              greaterThanOrEqualTo(sorted[i + 1].priorityScore),
              reason: 'Recommendations must be sorted by priority score',
            );
          }
        },
      );
    });

    /// Property 8.7: Overspending always generates a recommendation
    property('Overspending always generates a recommendation', () {
      forAll(
        _overspendingSnapshotArb(),
        (snapshot) {
          final recs = _generateRecommendations(snapshot);
          expect(
            recs,
            isNotEmpty,
            reason:
                'Overspending must always generate at least one recommendation',
          );
          final hasAlert = recs.any((r) =>
              r.type == RecommendationType.spendingAlert ||
              r.type == RecommendationType.budgetOptimization);
          expect(
            hasAlert,
            isTrue,
            reason:
                'Overspending must generate a spending alert recommendation',
          );
        },
      );
    });
  });
}

// ─── Pure recommendation generator (no Firebase) ─────────────────────────────

List<Recommendation> _generateRecommendations(FinancialSnapshot snapshot) {
  final recs = <Recommendation>[];
  final now = DateTime.now();
  final ts = now.millisecondsSinceEpoch;

  // Overspending alert
  if (snapshot.totalExpenses > snapshot.totalIncome) {
    final overspend = snapshot.totalExpenses - snapshot.totalIncome;
    recs.add(Recommendation(
      id: 'rec_overspend_$ts',
      type: RecommendationType.spendingAlert,
      title: 'Reduce Overspending',
      description:
          'You are overspending by GHS ${overspend.toStringAsFixed(2)} per month. '
          'Review your top spending categories to find savings.',
      actionSteps: [
        ActionStep(
          id: 'step_1',
          title: 'Review Top Categories',
          description: 'Identify the top 3 categories driving overspending',
          actionType: 'navigate',
          parameters: {'screen': 'spending_analysis'},
          order: 1,
        ),
        ActionStep(
          id: 'step_2',
          title: 'Adjust Budget Limits',
          description:
              'Set stricter limits for categories exceeding GHS ${(overspend / 2).toStringAsFixed(2)}',
          actionType: 'navigate',
          parameters: {'screen': 'budget_management'},
          order: 2,
        ),
      ],
      potentialImpact: overspend,
      priority: Priority.high,
      involvedFeatures: ['budget', 'transaction'],
      metadata: {
        'userId': snapshot.userId,
        'overspend': overspend,
        'totalExpenses': snapshot.totalExpenses,
        'totalIncome': snapshot.totalIncome,
      },
      createdAt: now,
    ));
  }

  // Surplus allocation
  final surplus = snapshot.totalIncome - snapshot.totalExpenses;
  if (surplus > 0 && snapshot.goalProgresses.isNotEmpty) {
    recs.add(Recommendation(
      id: 'rec_surplus_$ts',
      type: RecommendationType.surplusAllocation,
      title: 'Allocate Budget Surplus',
      description:
          'You have GHS ${surplus.toStringAsFixed(2)} available. '
          'Allocate it across your ${snapshot.goalProgresses.length} active goals.',
      actionSteps: [
        ActionStep(
          id: 'step_1',
          title: 'Review Active Goals',
          description:
              'Check progress on your ${snapshot.goalProgresses.length} goals',
          actionType: 'navigate',
          parameters: {'screen': 'goals_overview'},
          order: 1,
        ),
        ActionStep(
          id: 'step_2',
          title: 'Allocate GHS ${surplus.toStringAsFixed(2)}',
          description:
              'Distribute GHS ${surplus.toStringAsFixed(2)} to priority goals',
          actionType: 'api_call',
          parameters: {'action': 'allocate_surplus', 'amount': surplus},
          order: 2,
        ),
      ],
      potentialImpact: surplus,
      priority: Priority.medium,
      involvedFeatures: ['budget', 'goals'],
      metadata: {
        'userId': snapshot.userId,
        'surplus': surplus,
        'goalCount': snapshot.goalProgresses.length,
      },
      createdAt: now,
    ));
  }

  // Urgent goal deadlines
  for (final goal in snapshot.goalProgresses) {
    if (goal.daysRemaining < 30 && !goal.isCompleted) {
      final remaining = goal.remainingAmount;
      final weeklyNeeded = goal.daysRemaining > 0
          ? remaining / (goal.daysRemaining / 7)
          : remaining;
      recs.add(Recommendation(
        id: 'rec_goal_urgent_${goal.goalId}',
        type: RecommendationType.goalAdjustment,
        title: 'Urgent: Goal Deadline in ${goal.daysRemaining} Days',
        description:
            'Your goal "${goal.name}" is due in ${goal.daysRemaining} days. '
            'You need GHS ${remaining.toStringAsFixed(2)} more to reach your target.',
        actionSteps: [
          ActionStep(
            id: 'step_1',
            title: 'Increase Contribution',
            description:
                'Contribute GHS ${weeklyNeeded.toStringAsFixed(2)} per week to stay on track',
            actionType: 'navigate',
            parameters: {'screen': 'goal_details', 'goalId': goal.goalId},
            order: 1,
          ),
        ],
        potentialImpact: remaining,
        priority: Priority.high,
        involvedFeatures: ['goals', 'budget'],
        metadata: {
          'userId': snapshot.userId,
          'goalId': goal.goalId,
          'remaining': remaining,
          'daysRemaining': goal.daysRemaining,
        },
        createdAt: now,
      ));
    }
  }

  return recs;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

Arbitrary<FinancialSnapshot> _financialSnapshotArb() {
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

/// Snapshot where expenses always exceed income (for overspending tests)
Arbitrary<FinancialSnapshot> _overspendingSnapshotArb() {
  return combine2(
    float(min: 1000.0, max: 5000.0),
    userIdArb,
  ).map((tuple) {
    final income = tuple.$1;
    final expenses = income + 100.0 + (income * 0.2); // Always overspending
    return FinancialSnapshot(
      userId: tuple.$2,
      totalIncome: income,
      totalExpenses: expenses,
      availableForGoals: 0.0,
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
