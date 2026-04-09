# Property-Based Testing for Interconnected Financial Experience

This directory contains property-based tests that validate the correctness properties defined in the design document. Property-based testing helps ensure that the interconnected financial system maintains mathematical consistency and logical correctness across all possible inputs.

## Overview

Property-based testing (PBT) is a powerful testing methodology where instead of writing specific test cases, we define **properties** that should hold true for all valid inputs. The testing framework then generates hundreds or thousands of random inputs to verify these properties.

## Properties Implemented

### ✅ Property 1: Budget Surplus Allocation Consistency
**File:** `budget_surplus_allocation_test.dart`  
**Validates:** Requirements 1.1

Ensures that budget surplus allocations:
- Sum to exactly the surplus amount
- Only recommend allocation to active, unfunded goals
- Maintain mathematical consistency
- Respect goal priority ordering

### ✅ Property 2: Goal Feasibility Mathematical Accuracy
**File:** `goal_feasibility_test.dart`  
**Validates:** Requirements 1.2

Ensures that goal feasibility calculations:
- Match mathematical reality based on income and expenses
- Maintain consistency between daily, weekly, and monthly savings
- Handle edge cases (completed goals, expired deadlines)
- Reflect income reliability in confidence scores

### ⏳ Property 3: AI Insights Data-Driven Generation
**File:** `ai_insights_test.dart` (to be implemented)  
**Validates:** Requirements 1.3

Will ensure that AI insights:
- Reference actual user transaction data
- Are specific to user's spending patterns
- Contain no generic/template responses
- Provide actionable recommendations

### ⏳ Property 4: Free Trial Access Control
**File:** `free_trial_test.dart` (to be implemented)  
**Validates:** Requirements 1.4

Will ensure that trial access:
- Correctly manages feature access during trial
- Handles trial expiration properly
- Maintains data integrity during transitions
- Respects premium feature boundaries

### ⏳ Property 5: XP Calculation Consistency
**File:** `xp_calculation_test.dart` (to be implemented)  
**Validates:** Requirements 1.5

Will ensure that XP calculations:
- Award positive XP for valid actions
- Accumulate correctly over time
- Unlock achievements at correct thresholds
- Maintain consistency across sessions

### ⏳ Property 6: Onboarding Data Integrity
**File:** `onboarding_test.dart` (to be implemented)  
**Validates:** Requirements 1.6

Will ensure that onboarding:
- Captures and stores income data correctly
- Tracks completion status accurately
- Makes data available for calculations
- Maintains data consistency

### ⏳ Property 7: Cross-Feature Data Consistency
**File:** `cross_feature_consistency_test.dart` (to be implemented)  
**Validates:** Requirements 1.7

Will ensure that data changes:
- Propagate to all affected features
- Maintain consistency across features
- Handle concurrent updates properly
- Preserve referential integrity

### ⏳ Property 8: Recommendation Relevance
**File:** `recommendation_relevance_test.dart` (to be implemented)  
**Validates:** Requirements 1.8

Will ensure that recommendations:
- Are based on actual user data
- Include actionable steps
- Have positive potential impact
- Address urgent issues with high priority

## Running Property Tests

### Local Development
```bash
# Run all property tests with default iterations (100)
dart test/property_tests/run_property_tests.dart

# Run with more iterations for thorough testing
dart test/property_tests/run_property_tests.dart 500

# Run with verbose output
dart test/property_tests/run_property_tests.dart 100 --verbose

# Run with fail-fast mode
dart test/property_tests/run_property_tests.dart 100 --fail-fast
```

### Individual Test Files
```bash
# Run specific property test
dart test test/property_tests/budget_surplus_allocation_test.dart

# Run with Flutter test runner
flutter test test/property_tests/goal_feasibility_test.dart
```

### CI/CD Integration
Property tests run automatically on:
- Every push to main/develop branches
- Every pull request
- Daily at 2 AM UTC (extended tests with 1000 iterations)

## Test Data Generators

The `property_test_setup.dart` file contains generators for creating random test data:

- `surplusAmountGen` - Random budget surplus amounts
- `savingsGoalGen` - Random savings goals with realistic parameters
- `incomePatternGen` - Random income patterns with various stability levels
- `goalFeasibilityGen` - Random goal feasibility data
- `financialSnapshotGen` - Random financial snapshots

## Writing New Property Tests

When adding new properties:

1. **Define the Property**: Clearly state what should always be true
2. **Create Generators**: Build generators for relevant test data
3. **Write the Test**: Use `runPropertyTest()` helper function
4. **Validate Edge Cases**: Include tests for boundary conditions
5. **Add to CI**: Update the workflow to include new tests

Example:
```dart
runPropertyTest(
  'Property description',
  (data) {
    // Extract test data
    final input = data['input'];
    
    // Run the function under test
    final result = functionUnderTest(input);
    
    // Assert the property holds
    return result.satisfiesProperty();
  },
  testDataGenerator,
  iterations: 100,
);
```

## Debugging Property Test Failures

When a property test fails:

1. **Check the Error Message**: Look for specific values that caused failure
2. **Reduce Iterations**: Run with fewer iterations to isolate the issue
3. **Add Logging**: Use print statements to trace execution
4. **Create Unit Test**: Convert the failing case to a specific unit test
5. **Fix the Implementation**: Address the underlying issue

## Performance Considerations

- Default iterations (100) provide good coverage for development
- CI runs use 50-200 iterations for faster feedback
- Nightly runs use 1000 iterations to catch rare edge cases
- Complex properties may need fewer iterations to avoid timeouts

## Integration with Existing Tests

Property tests complement but don't replace:
- **Unit Tests**: Test specific scenarios and edge cases
- **Integration Tests**: Test feature interactions
- **Widget Tests**: Test UI behavior
- **End-to-End Tests**: Test complete user workflows

Property tests focus on **mathematical correctness** and **logical consistency** across the entire input space.