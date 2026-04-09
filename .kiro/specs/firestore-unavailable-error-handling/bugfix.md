# Bugfix Requirements Document

## Introduction

When Firestore is temporarily unavailable (e.g., transient network interruption or service outage), the Dashboard screen completely fails to load the user profile and renders a blank screen with only a "Try Again" button. The error message exposed to the user is the raw internal exception string: `"Failed to load user profile: Exception: Failed to get user data: [cloud_firestore/unavailable] The service is currently unavailable."` This is a poor user experience because the failure is transient — the app should either serve cached data, retry automatically with backoff, or at minimum degrade gracefully so the rest of the dashboard remains usable.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN Firestore returns a `cloud_firestore/unavailable` error during user profile loading THEN the system sets a raw exception string as the error state and renders a blank dashboard with only a "Try Again" button

1.2 WHEN Firestore is temporarily unavailable during user profile loading THEN the system does not attempt any automatic retry and requires manual user intervention to recover

1.3 WHEN Firestore is temporarily unavailable during user profile loading THEN the system displays the raw internal exception message (`[cloud_firestore/unavailable] The service is currently unavailable...`) directly to the user

1.4 WHEN Firestore is temporarily unavailable and a previously loaded user profile exists in memory THEN the system discards the cached in-memory profile and replaces the dashboard with a blank error screen

1.5 WHEN Firestore is temporarily unavailable during user profile loading THEN the system blocks all other dashboard content (transactions, budgets, AI insights) from rendering, even though those providers may have loaded successfully

### Expected Behavior (Correct)

2.1 WHEN Firestore returns a `cloud_firestore/unavailable` error during user profile loading THEN the system SHALL detect the transient error code and handle it separately from permanent errors (e.g., permission-denied)

2.2 WHEN Firestore is temporarily unavailable during user profile loading THEN the system SHALL automatically retry the request using exponential backoff (e.g., 1s, 2s, 4s) for a configurable number of attempts before surfacing an error to the user

2.3 WHEN Firestore is temporarily unavailable and a previously loaded user profile exists in memory THEN the system SHALL continue to display the dashboard using the cached profile data rather than replacing it with a blank error screen

2.4 WHEN all automatic retry attempts are exhausted and Firestore remains unavailable THEN the system SHALL display a user-friendly, non-technical message (e.g., "Having trouble connecting. Some data may be outdated.") rather than the raw exception string

2.5 WHEN Firestore is temporarily unavailable THEN the system SHALL allow the rest of the dashboard (transactions, budgets) to remain visible and functional if those providers loaded successfully

### Unchanged Behavior (Regression Prevention)

3.1 WHEN Firestore is available and returns user data successfully THEN the system SHALL CONTINUE TO load and display the user profile without any delay or change in behavior

3.2 WHEN Firestore returns a `permission-denied` error THEN the system SHALL CONTINUE TO handle it with the existing permission-denied recovery flow (attempt to create user document)

3.3 WHEN Firestore returns a `document-not-found` error THEN the system SHALL CONTINUE TO handle it with the existing document-creation fallback flow

3.4 WHEN the user taps the "Try Again" button after a Firestore unavailable error THEN the system SHALL CONTINUE TO trigger a manual reload of the user profile

3.5 WHEN the user is not authenticated THEN the system SHALL CONTINUE TO skip user profile loading and redirect to the login screen
