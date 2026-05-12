import 'package:test/test.dart';
import 'package:kiri_check/kiri_check.dart';
import '../../lib/models/budget_surplus.dart';
import '../../lib/models/savings_goal.dart';
import '../../lib/models/goal_allocation.dart';
import '../../lib/models/goal_feasibility.dart';
import '../../lib/models/income_pattern.dart';
import '../../lib/models/enhanced_user_profile.dart';
import '../../lib/models/onboarding_status.dart';
import '../../lib/models/financial_snapshot.dart';
import '../../lib/models/recommendation.dart';
import 'mock_repositories.dart';
import '../../lib/services/interconnection_engine_impl.dart';
import '../../lib/services/event_bus.dart';
import '../../lib/services/data_integrator.dart';
import '../../lib/services/recommendation_generator.dart';
import '../../lib/services/state_coordinator.dart';

/// Property-based testing setup for the interconnected financial experience
/// 
/// This file contains generators (arbitraries) for creating test data
/// and utility functions for property-based testing.

/// Generator for creating random budget surplus amounts
final surplusAmountArb = float(min: 1.0, max: 10000.0);

/// Generator for creating random goal amounts
final goalAmountArb = float(min: 100.0, max: 50000.0);

/// Generator for creating random income amounts
final incomeAmountArb = float(min: 500.0, max: 20000.0);

/// Generator for creating random percentages
final percentageArb = float(min: 0.0, max: 100.0);

/// Generator for creating random XP amounts
final xpAmountArb = integer(min: 0, max: 10000);

/// Generator for creating random user IDs
final userIdArb = string(minLength: 8, maxLength: 8);

/// Generator for creating random goal IDs
final goalIdArb = string(minLength: 12, maxLength: 12);

/// Generator for creating random budget IDs
final budgetIdArb = string(minLength: 10, maxLength: 10);

/// Generator for creating random dates within the last year
Arbitrary<DateTime> recentDateArb() {
  return integer(min: 1, max: 365).map((daysAgo) {
    final now = DateTime.now();
    return now.subtract(Duration(days: daysAgo));
  });
}

/// Generator for creating random future dates (for goals)
Arbitrary<DateTime> futureDateArb() {
  return integer(min: 1, max: 365).map((daysFromNow) {
    final now = DateTime.now();
    return now.add(Duration(days: daysFromNow));
  });
}

/// Generator for creating random savings goals
Arbitrary<SavingsGoal> savingsGoalArb() {
  return combine5(
    goalIdArb,
    userIdArb,
    goalAmountArb,
    float(min: 0.0, max: 1000.0),
    futureDateArb(),
  ).map((tuple) {
    final goalId = tuple.$1;
    final userId = tuple.$2;
    final targetAmount = tuple.$3;
    final currentAmount = tuple.$4;
    final deadline = tuple.$5;
    final now = DateTime.now();
    
    return SavingsGoal(
      goalId: goalId,
      userId: userId,
      name: 'Test Goal $goalId',
      targetAmount: targetAmount,
      currentAmount: currentAmount,
      deadline: deadline,
      category: 'Test',
      createdAt: now,
      updatedAt: now,
    );
  });
}

/// Generator for creating lists of savings goals
Arbitrary<List<SavingsGoal>> savingsGoalListArb() {
  return list(savingsGoalArb(), minLength: 1, maxLength: 5);
}

/// Generator for creating goal allocations
Arbitrary<GoalAllocation> goalAllocationArb() {
  return combine4(
    goalIdArb,
    float(min: 10.0, max: 1000.0),
    float(min: 0.0, max: 1.0),
    float(min: 0.0, max: 1.0),
  ).map((tuple) {
    final goalId = tuple.$1;
    final amount = tuple.$2;
    final priority = tuple.$3;
    final impactScore = tuple.$4;
    
    return GoalAllocation(
      goalId: goalId,
      goalName: 'Test Goal $goalId',
      amount: amount,
      priority: priority,
      reason: 'Test allocation reason',
      impactScore: impactScore,
      goal: SavingsGoal(
        goalId: goalId,
        userId: 'test_user',
        name: 'Test Goal $goalId',
        targetAmount: amount * 2,
        currentAmount: 0.0,
        deadline: DateTime.now().add(Duration(days: 180)),
        category: 'Test',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      ),
    );
  });
}

/// Generator for creating budget surplus
Arbitrary<BudgetSurplus> budgetSurplusArb() {
  return combine3(
    budgetIdArb,
    surplusAmountArb,
    list(goalAllocationArb(), minLength: 0, maxLength: 3),
  ).map((tuple) {
    final budgetId = tuple.$1;
    final surplusAmount = tuple.$2;
    final allocations = tuple.$3;
    final now = DateTime.now();
    
    return BudgetSurplus(
      budgetId: budgetId,
      userId: 'test_user',
      surplusAmount: surplusAmount,
      periodEnd: now,
      recommendedAllocations: allocations,
      reason: 'Budget completed with surplus',
      calculatedAt: now,
    );
  });
}

/// Generator for creating income patterns
Arbitrary<IncomePattern> incomePatternArb() {
  return combine2(
    incomeAmountArb,
    float(min: 0.0, max: 50.0),
  ).map((tuple) {
    final weeklyIncome = tuple.$1;
    final incomeVariability = tuple.$2;
    final monthlyIncome = weeklyIncome * 4.33;
    final yearlyIncome = monthlyIncome * 12;
    
    return IncomePattern(
      weeklyIncome: weeklyIncome,
      monthlyIncome: monthlyIncome,
      yearlyIncome: yearlyIncome,
      stability: IncomeStability.stable,
      sources: [],
      lastUpdated: DateTime.now(),
      historicalData: {},
      averageMonthlyIncome: monthlyIncome,
      incomeVariability: incomeVariability,
    );
  });
}

/// Generator for creating goal feasibility data
Arbitrary<GoalFeasibility> goalFeasibilityArb() {
  return combine3(
    goalIdArb,
    float(min: 10.0, max: 500.0),
    boolean(),
  ).map((tuple) {
    final goalId = tuple.$1;
    final requiredWeekly = tuple.$2;
    final isFeasible = tuple.$3;
    final requiredDaily = requiredWeekly / 7.0;
    final requiredMonthly = requiredWeekly * 4.33;
    
    return GoalFeasibility(
      goalId: goalId,
      isFeasible: isFeasible,
      requiredDailySavings: requiredDaily,
      requiredWeeklySavings: requiredWeekly,
      requiredMonthlySavings: requiredMonthly,
      feasibilityFactors: ['Test factor'],
      suggestions: [],
      confidenceScore: 0.8,
      calculatedAt: DateTime.now(),
      analysisData: {},
    );
  });
}

/// Utility function to check if two doubles are approximately equal
bool approximatelyEqual(double a, double b, {double tolerance = 0.01}) {
  return (a - b).abs() <= tolerance;
}

/// Utility function to validate mathematical consistency
bool isMathematicallyConsistent(List<double> values, double expectedSum, {double tolerance = 0.01}) {
  final actualSum = values.fold(0.0, (sum, value) => sum + value);
  return approximatelyEqual(actualSum, expectedSum, tolerance: tolerance);
}

/// Create a fully configured InterconnectionEngine with mock dependencies
InterconnectionEngineImpl createMockInterconnectionEngine() {
  final eventBus = EventBus();
  final dataIntegrator = DataIntegratorImpl();
  final recommendationGenerator = RecommendationGeneratorImpl();
  final stateCoordinator = StateCoordinatorImpl();
  
  // Create mock repositories and services
  final budgetRepository = MockBudgetRepository();
  final transactionRepository = MockTransactionRepository();
  final userRepository = MockUserRepository();
  final gamificationService = MockGamificationService();
  final aiService = MockAIService();
  
  return InterconnectionEngineImpl(
    eventBus: eventBus,
    dataIntegrator: dataIntegrator,
    recommendationGenerator: recommendationGenerator,
    stateCoordinator: stateCoordinator,
    budgetRepository: budgetRepository as dynamic,
    transactionRepository: transactionRepository as dynamic,
    userRepository: userRepository as dynamic,
    gamificationService: gamificationService as dynamic,
    aiService: aiService as dynamic,
  );
}

/// Create mock repositories for testing
class MockTestServices {
  final MockBudgetRepository budgetRepository;
  final MockTransactionRepository transactionRepository;
  final MockUserRepository userRepository;
  final MockGamificationService gamificationService;
  final MockAIService aiService;
  
  MockTestServices()
      : budgetRepository = MockBudgetRepository(),
        transactionRepository = MockTransactionRepository(),
        userRepository = MockUserRepository(),
        gamificationService = MockGamificationService(),
        aiService = MockAIService();
}
