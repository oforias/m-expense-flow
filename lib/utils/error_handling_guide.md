# Error Handling Guide for M-Expense Flow

This guide explains how to use the comprehensive error handling system implemented in the M-Expense Flow app.

## Overview

The error handling system provides:
- Centralized error processing and categorization
- User-friendly error messages
- Automatic retry mechanisms
- Graceful failure handling
- Consistent error UI components

## Key Components

### 1. ErrorHandler (lib/utils/error_handler.dart)
Central utility for processing and displaying errors.

### 2. BaseProvider (lib/providers/base_provider.dart)
Base class for all providers with built-in error handling.

### 3. Error Boundary Widgets (lib/widgets/error_boundary_widget.dart)
UI components for displaying errors gracefully.

### 4. RetryService (lib/services/retry_service.dart)
Service for handling retry logic with exponential backoff.

## Usage Examples

### For Providers

```dart
// Extend BaseProvider instead of ChangeNotifier
class MyProvider extends BaseProvider with ConnectivityAwareMixin {
  
  // Use executeWithErrorHandling for operations
  Future<void> loadData() async {
    await executeWithErrorHandling(
      () async {
        final data = await repository.getData();
        // Process data...
      },
      context: 'Loading user data',
      maxRetries: 3,
    );
  }
  
  // Use executeWithValidation for operations that need validation
  Future<bool> saveData(Map<String, dynamic> data) async {
    final result = await executeWithValidation(
      () async {
        await repository.saveData(data);
        return true;
      },
      validator: () => _validateData(data) == null,
      validationMessage: _validateData(data) ?? '',
      context: 'Saving data',
    );
    
    return result ?? false;
  }
}
```

### For UI Screens

```dart
// Use LoadingWithErrorWidget for loading states
LoadingWithErrorWidget(
  isLoading: provider.isLoading,
  error: provider.error,
  onRetry: provider.canRetryLastError ? () => provider.retryLastOperation() : null,
  child: YourContentWidget(),
)

// Use InlineErrorWidget for inline errors
if (provider.hasError)
  InlineErrorWidget(
    message: provider.error!,
    onRetry: provider.canRetryLastError ? () => provider.retryLastOperation() : null,
  )

// Handle errors in async operations
try {
  await someOperation();
} catch (error) {
  final errorInfo = ErrorHandler.processError(error, context: 'Operation Name');
  ErrorHandler.showError(
    context,
    errorInfo,
    onRetry: errorInfo.canRetry ? () => someOperation() : null,
  );
}
```

### For Network Operations

```dart
// Use RetryService for network operations
final result = await RetryConfig.network.execute(() async {
  return await apiCall();
});

// Or with custom retry logic
final result = await RetryService.executeWithRetry(
  () async => await apiCall(),
  maxRetries: 3,
  shouldRetry: (error) => error is SocketException,
  onRetry: (attempt, error) => print('Retry attempt $attempt: $error'),
);
```

## Error Severity Levels

- **Low**: Info/warning messages (shown in snackbar)
- **Medium**: Standard errors (shown in snackbar with retry)
- **High**: Important errors (shown in dialog)
- **Critical**: Critical errors (shown in dialog with restart option)

## Best Practices

1. **Always use BaseProvider**: Extend BaseProvider for consistent error handling
2. **Validate input**: Use executeWithValidation for operations that need validation
3. **Handle network errors**: Use ConnectivityAwareMixin for network-aware operations
4. **Don't block gamification**: Use GamificationErrorMixin to handle gamification errors safely
5. **Provide context**: Always provide meaningful context strings for error logging
6. **Use appropriate UI**: Choose the right error widget for your use case
7. **Enable retry**: Provide retry options for retryable errors
8. **Log errors**: All errors are automatically logged for debugging

## Error Categories

### Firebase Errors
- Authentication errors (wrong password, user not found, etc.)
- Firestore errors (permission denied, not found, etc.)
- Network errors (connection failed, timeout, etc.)

### Validation Errors
- Invalid input data
- Missing required fields
- Format errors

### Network Errors
- Connection timeout
- No internet connection
- Server unavailable

### Application Errors
- State errors
- Unexpected exceptions
- Critical system errors

## Testing Error Handling

The error handling system includes comprehensive testing support:

```dart
// Test error processing
final errorInfo = ErrorHandler.processError(testError);
expect(errorInfo.severity, ErrorSeverity.medium);
expect(errorInfo.canRetry, true);

// Test provider error handling
await provider.executeWithErrorHandling(() => throw testError);
expect(provider.hasError, true);
expect(provider.error, contains('expected message'));
```

## Configuration

Error handling behavior can be configured through:
- Retry policies in RetryService
- Error message constants in AppConstants
- Feature flags for different error handling strategies

## Monitoring and Analytics

All errors are logged with context information for debugging and monitoring:
- Error type and message
- Context where error occurred
- User actions leading to error
- Device and app state information

This information helps improve the app's reliability and user experience.