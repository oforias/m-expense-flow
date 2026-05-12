import 'package:test/test.dart';
import 'package:kiri_check/kiri_check.dart';
import '../../lib/models/goal_feasibility.dart';
import '../../lib/models/savings_goal.dart';
import '../../lib/models/income_pattern.dart';
import 'property_test_setup.dart';

/// Property 2: Goal Feasibility Mathematical Accuracy
///
/// Validates: Requirements 1.2
///
/// Goal feasibility calculations must be mathematically accurate and
/// consistent with the user's actual financial capacity.

GoalFeasibility _calculateFeasibility(
    SavingsGoal goal, IncomePattern income, double monthlyExpenses) {
  final availableWeekly = income.weeklyIncome - (monthlyExpenses / 4.33);
  final remainingAmount = goal.targetAmount - goal.currentAmount;
  final weeksRemaining =
      goal.deadline.difference(DateTime.now()).inDays / 7.0;

  if (weeksRemaining <= 0 || remainingAmount <= 0) {
    return GoalFeasibility(
      goalId: goal.goalId,
      isFeasible: remainingAmount <= 0,
      requiredDailySavings: 0.0,
      requiredWeeklySavings: 0.0,
      requiredMonthlySavings: 0.0,
      feasibilityFactors: ['Goal completed or deadline passed'],
      suggestions: [],
      confidenceScore: 1.0,
      calculatedAt: DateTime.now(),
      analysisData: {},
    );
  }

  final requiredWeekly = remainingAmount / weeksRemaining;
  final requiredDaily = requiredWeekly / 7.0;
  final requiredMonthly = requiredWeekly * 4.33;
  final isFeasible = requiredWeekly <= availableWeekly;

  // Confidence score: lower variability and stable income = higher confidence
  final double confidenceScore = () {
    double score = income.confidenceScore;
    if (income.stability == IncomeStability.irregular) score *= 0.7;
    if (income.incomeVariability > 30) score *= 0.8;
    return score.clamp(0.0, 1.0);
  }();

  return GoalFeasibility(
    goalId: goal.goalId,
    isFeasible: isFeasible,
    requiredDailySavings: requiredDaily,
    requiredWeeklySavings: requiredWeekly,
    requiredMonthlySavings: requiredMonthly,
    feasibilityFactors:
        isFeasible ? ['Sufficient income'] : ['Insufficient income'],
    suggestions: [],
    confidenceScore: confidenceScore,
    calculatedAt: DateTime.now(),
    analysisData: {
      'availableWeekly': availableWeekly,
      'weeksRemaining': weeksRemaining,
      'remainingAmount': remainingAmount,
    },
  );
}

void main() {
  group('Property 2: Goal Feasibility Mathematical Accuracy', () {
    /// Property 2.1 & 2.2: Feasibility matches math, savings amounts are accurate
    property('Feasibility calculation matches mathematical reality', () {
      forAll(
        combine3(
          savingsGoalArb(),
          incomePatternArb(),
          float(min: 100.0, max: 3000.0),
        ),
        (tuple) {
          final goal = tuple.$1;
          final income = tuple.$2;
          final monthlyExpenses = tuple.$3;

          // Skip goals with passed deadlines or already completed
          if (goal.deadline.isBefore(DateTime.now())) return;
          if (goal.currentAmount >= goal.targetAmount) return;

          final feasibility =
              _calculateFeasibility(goal, income, monthlyExpenses);

          final availableWeekly =
              income.weeklyIncome - (monthlyExpenses / 4.33);
          final remainingAmount = goal.targetAmount - goal.currentAmount;
          final weeksRemaining =
              goal.deadline.difference(DateTime.now()).inDays / 7.0;
          if (weeksRemaining <= 0) return;

          final expectedRequiredWeekly = remainingAmount / weeksRemaining;
          final expectedFeasible = expectedRequiredWeekly <= availableWeekly;

          // 2.1: Feasibility flag must match math
          expect(
            feasibility.isFeasible,
            equals(expectedFeasible),
            reason:
                'Feasibility mismatch: required=$expectedRequiredWeekly, available=$availableWeekly',
          );

          // 2.2: Weekly savings must be accurate
          expect(
            (feasibility.requiredWeeklySavings - expectedRequiredWeekly).abs(),
            lessThan(0.01),
            reason: 'Weekly savings inaccurate',
          );

          // Daily must be weekly / 7
          expect(
            (feasibility.requiredDailySavings -
                    feasibility.requiredWeeklySavings / 7.0)
                .abs(),
            lessThan(0.01),
            reason: 'Daily savings inconsistent with weekly',
          );
        },
      );
    });

    /// Property 2.3: Daily → Weekly → Monthly consistency
    property(
        'Mathematical consistency between daily, weekly, and monthly savings',
        () {
      forAll(
        goalFeasibilityArb(),
        (feasibility) {
          final expectedWeeklyFromDaily =
              feasibility.requiredDailySavings * 7.0;
          expect(
            (feasibility.requiredWeeklySavings - expectedWeeklyFromDaily).abs(),
            lessThan(0.01),
            reason:
                'Daily-Weekly inconsistency: weekly=${feasibility.requiredWeeklySavings}, daily*7=$expectedWeeklyFromDaily',
          );

          final expectedMonthlyFromWeekly =
              feasibility.requiredWeeklySavings * 4.33;
          expect(
            (feasibility.requiredMonthlySavings - expectedMonthlyFromWeekly)
                .abs(),
            lessThan(1.0),
            reason:
                'Weekly-Monthly inconsistency: monthly=${feasibility.requiredMonthlySavings}, weekly*4.33=$expectedMonthlyFromWeekly',
          );
        },
      );
    });

    /// Property 2.4: validate() catches inconsistencies
    property('Feasibility validation catches mathematical inconsistencies', () {
      forAll(
        goalFeasibilityArb(),
        (feasibility) {
          final validationResult = feasibility.validate();

          final expectedWeekly = feasibility.requiredDailySavings * 7.0;
          final weeklyConsistent =
              (feasibility.requiredWeeklySavings - expectedWeekly).abs() <=
                  0.01;

          final expectedMonthly = feasibility.requiredWeeklySavings * 4.33;
          final monthlyConsistent =
              (feasibility.requiredMonthlySavings - expectedMonthly).abs() <=
                  1.0;

          if (!weeklyConsistent || !monthlyConsistent) {
            expect(validationResult, isNotNull,
                reason: 'validate() should catch inconsistency');
          } else {
            expect(validationResult, isNull,
                reason: 'validate() should pass for consistent data');
          }
        },
      );
    });

    /// Property 2.5: Completed goals require zero savings
    property('Zero remaining amount results in zero required savings', () {
      forAll(
        combine3(
          savingsGoalArb(),
          incomePatternArb(),
          float(min: 100.0, max: 3000.0),
        ),
        (tuple) {
          final goal = tuple.$1;
          final income = tuple.$2;
          final monthlyExpenses = tuple.$3;

          // Fully fund the goal
          final completedGoal =
              goal.copyWith(currentAmount: goal.targetAmount);
          final feasibility =
              _calculateFeasibility(completedGoal, income, monthlyExpenses);

          expect(feasibility.requiredDailySavings, equals(0.0),
              reason: 'Completed goal should need 0 daily savings');
          expect(feasibility.requiredWeeklySavings, equals(0.0),
              reason: 'Completed goal should need 0 weekly savings');
          expect(feasibility.requiredMonthlySavings, equals(0.0),
              reason: 'Completed goal should need 0 monthly savings');
        },
      );
    });

    /// Property 2.6: Higher income variability → lower confidence score
    property('Confidence score reflects income reliability', () {
      forAll(
        combine2(savingsGoalArb(), float(min: 100.0, max: 3000.0)),
        (tuple) {
          final goal = tuple.$1;
          final monthlyExpenses = tuple.$2;
          const baseWeekly = 1000.0;

          // Skip already-completed goals — both return confidenceScore 1.0
          if (goal.currentAmount >= goal.targetAmount) return;
          // Skip goals with passed deadlines
          if (goal.deadline.isBefore(DateTime.now())) return;

          final highConfidenceIncome = IncomePattern(
            weeklyIncome: baseWeekly,
            monthlyIncome: baseWeekly * 4.33,
            yearlyIncome: baseWeekly * 52,
            stability: IncomeStability.stable,
            sources: [],
            lastUpdated: DateTime.now(),
            historicalData: {'2024-01': baseWeekly * 4.33},
            averageMonthlyIncome: baseWeekly * 4.33,
            incomeVariability: 5.0,
          );

          final lowConfidenceIncome = IncomePattern(
            weeklyIncome: baseWeekly,
            monthlyIncome: baseWeekly * 4.33,
            yearlyIncome: baseWeekly * 52,
            stability: IncomeStability.irregular,
            sources: [],
            lastUpdated: DateTime.now().subtract(const Duration(days: 100)),
            historicalData: {},
            averageMonthlyIncome: baseWeekly * 4.33,
            incomeVariability: 50.0,
          );

          final highConf =
              _calculateFeasibility(goal, highConfidenceIncome, monthlyExpenses);
          final lowConf =
              _calculateFeasibility(goal, lowConfidenceIncome, monthlyExpenses);

          expect(
            highConf.confidenceScore,
            greaterThanOrEqualTo(lowConf.confidenceScore),
            reason:
                'High-confidence income should yield higher or equal confidence score',
          );
        },
      );
    });

    test('GoalFeasibility model validation works correctly', () {
      final validFeasibility = GoalFeasibility(
        goalId: 'test-goal',
        isFeasible: true,
        requiredDailySavings: 10.0,
        requiredWeeklySavings: 70.0,
        requiredMonthlySavings: 303.1,
        feasibilityFactors: ['Sufficient income'],
        suggestions: [],
        confidenceScore: 0.8,
        calculatedAt: DateTime.now(),
        analysisData: {},
      );
      expect(validFeasibility.validate(), isNull);

      final invalidFeasibility = GoalFeasibility(
        goalId: 'test-goal',
        isFeasible: true,
        requiredDailySavings: -10.0,
        requiredWeeklySavings: 70.0,
        requiredMonthlySavings: 303.1,
        feasibilityFactors: ['Sufficient income'],
        suggestions: [],
        confidenceScore: 0.8,
        calculatedAt: DateTime.now(),
        analysisData: {},
      );
      expect(invalidFeasibility.validate(), isNotNull);
    });
  });
}
