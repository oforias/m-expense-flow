# Error Recovery Usage Guide

This guide shows how to use the error recovery system to provide user-friendly error messages and recovery suggestions.

## Quick Start

### 1. Using Error Recovery Dialog

Show a full dialog with error details and recovery suggestions:

```dart
import 'package:expense_flow/utils/error_recovery_extensions.dart';

// In your widget
try {
  await someOperation();
} catch (error) {
  await context.showErrorRecovery(
    error: error,
    onRetry: () {
      // Retry the operation
      someOperation();
    },
  );
}
```

### 2. Using Error Recovery Snackbar

Show a quick snackbar for less critical errors:

```dart
try {
  await someOperation();
} catch (error) {
  context.showErrorSnackbar(
    error: error,
    onRetry: () => someOperation(),
  );
}
```

### 3. Using Future Extensions

Automatically handle errors with extensions:

```dart
// With dialog
await someOperation().withErrorRecovery(
  context,
  onRetry: () => someOperation(),
);

// With snackbar
await someOperation().withErrorSnackbar(
  context,
  onRetry: () => someOperation(),
);
```

## Advanced Usage

### Custom Error Messages

Get user-friendly messages programmatically:

```dart
import 'package:expense_flow/services/error_message_service.dart';

final message = ErrorMessageService.getUserFriendlyMessage(error);
final suggestions = ErrorMessageService.getRecoverySuggestions(error);
final category = ErrorMessageService.categorizeError(error);
```

### Error Categories

The system categorizes errors for appropriate UI treatment:

- **Critical**: Serious errors that require immediate attention
- **System Unavailable**: Circuit breaker open, system temporarily down
- **Recoverable**: Errors that can be retried
- **Network**: Connection issues
- **Timeout**: Operations that took too long
- **Permission**: Authorization failures
- **Unknown**: Uncategorized errors

### Recovery Actions

Available recovery actions:

- `retry`: Try the operation again
- `refresh`: Refresh the data
- `wait`: Wait for system recovery
- `checkConnection`: Check internet connection
- `manualSync`: Manually sync data
- `continueWithoutFeature`: Continue without the failed feature
- `tryLater`: Try again later
- `restartApp`: Restart the application
- `enableOfflineMode`: Switch to offline mode
- `viewStatus`: View system status
- `contactSupport`: Contact support team

## Examples

### Example 1: Budget Event with Error Recovery

```dart
Future<void> handleBudgetCompletion() async {
  try {
    await budgetService.completeBudget(budgetId);
    
    // Show success message
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Budget completed successfully!')),
    );
  } catch (error) {
    // Show error recovery dialog
    await context.showErrorRecovery(
      error: error,
      onRetry: () => handleBudgetCompletion(),
    );
  }
}
```

### Example 2: Goal Creation with Snackbar

```dart
Future<void> createGoal(Goal goal) async {
  await goalService
      .createGoal(goal)
      .withErrorSnackbar(
        context,
        onRetry: () => createGoal(goal),
      );
}
```

### Example 3: Data Sync with Custom Handling

```dart
Future<void> syncData() async {
  try {
    await dataService.syncAll();
  } catch (error) {
    final category = ErrorMessageService.categorizeError(error);
    
    if (category == ErrorCategory.network) {
      // Handle network errors specially
      context.showErrorSnackbar(
        error: error,
        onRetry: () => syncData(),
      );
    } else {
      // Show full dialog for other errors
      await context.showErrorRecovery(
        error: error,
        onRetry: () => syncData(),
      );
    }
  }
}
```

### Example 4: Interconnection Engine Error Handling

```dart
import 'package:expense_flow/models/interconnection_exception.dart';

Future<void> processEvent() async {
  try {
    await interconnectionEngine.handleBudgetEvent(event);
  } on InterconnectionException catch (error) {
    if (error.type == InterconnectionErrorType.circuitBreakerOpen) {
      // Circuit breaker is open - show wait message
      await context.showErrorRecovery(
        error: error,
        onRetry: null, // No retry button for circuit breaker
      );
    } else if (error.recoverable) {
      // Recoverable error - allow retry
      await context.showErrorRecovery(
        error: error,
        onRetry: () => processEvent(),
      );
    } else {
      // Non-recoverable error - show critical error
      await context.showErrorRecovery(
        error: error,
        onRetry: null,
      );
    }
  }
}
```

## Best Practices

### 1. Choose the Right UI

- Use **dialogs** for critical errors that need user attention
- Use **snackbars** for minor errors that don't block workflow
- Use **inline messages** for form validation errors

### 2. Provide Retry Options

Always provide a retry option for recoverable errors:

```dart
await context.showErrorRecovery(
  error: error,
  onRetry: () => retryOperation(),
);
```

### 3. Log Errors

Always log errors for debugging:

```dart
try {
  await operation();
} catch (error, stackTrace) {
  debugPrint('Operation failed: $error');
  debugPrint('Stack trace: $stackTrace');
  
  await context.showErrorRecovery(error: error);
}
```

### 4. Handle Specific Error Types

Handle specific error types differently:

```dart
try {
  await operation();
} on InterconnectionException catch (error) {
  // Handle interconnection errors
  await context.showErrorRecovery(error: error);
} on TimeoutException catch (error) {
  // Handle timeout errors
  context.showErrorSnackbar(error: error);
} catch (error) {
  // Handle all other errors
  await context.showErrorRecovery(error: error);
}
```

### 5. Provide Context

Add context to error messages when possible:

```dart
try {
  await budgetService.updateBudget(budget);
} catch (error) {
  await context.showErrorRecovery(
    error: error,
    onRetry: () => budgetService.updateBudget(budget),
    onDismiss: () {
      // Navigate back or show alternative
      Navigator.of(context).pop();
    },
  );
}
```

## Testing

Test error recovery in your widgets:

```dart
testWidgets('shows error recovery dialog on failure', (tester) async {
  // Setup
  when(mockService.operation()).thenThrow(Exception('Test error'));
  
  await tester.pumpWidget(MyWidget());
  
  // Trigger error
  await tester.tap(find.byType(ElevatedButton));
  await tester.pumpAndSettle();
  
  // Verify error dialog is shown
  expect(find.byType(ErrorRecoveryDialog), findsOneWidget);
  expect(find.text('Something went wrong'), findsOneWidget);
  
  // Test retry button
  await tester.tap(find.text('Try Again'));
  await tester.pumpAndSettle();
  
  verify(mockService.operation()).called(2); // Initial + retry
});
```

## Debugging

Enable debug logging to see error recovery in action:

```dart
// In main.dart
void main() {
  debugPrint('Error recovery system initialized');
  runApp(MyApp());
}
```

The error recovery system automatically logs:
- Error messages
- Recovery attempts
- User actions
- System status

Check the console for messages like:
- `🔄 Starting cross-feature operation: ...`
- `⚠️ Retry attempt X for ...`
- `✅ Cross-feature operation completed: ...`
- `❌ Cross-feature operation failed: ...`
- `🔧 Attempting recovery ...`
- `↩️ Rolling back operation: ...`
