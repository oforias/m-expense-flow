import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import '../services/auth_service.dart';
import '../services/gamification_service.dart';
import '../services/notification_service.dart';
import '../services/streak_service.dart';
import '../repositories/user_repository.dart';
import '../models/user.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService;
  final UserRepository _userRepository;
  final NotificationService _notificationService;
  final StreakService _streakService;
  
  // Authentication state
  firebase_auth.User? _firebaseUser;
  UserProfile? _user;
  bool _isLoading = false;
  String? _error;

  AuthProvider({
    AuthService? authService,
    UserRepository? userRepository,
    NotificationService? notificationService,
    StreakService? streakService,
  }) : _authService = authService ?? AuthService(),
        _userRepository = userRepository ?? UserRepository(),
        _notificationService = notificationService ?? NotificationService(),
        _streakService = streakService ?? StreakService() {
    _initializeAuthListener();
  }
  
  StreamSubscription<firebase_auth.User?>? _authStateSubscription;

  // Getters
  firebase_auth.User? get firebaseUser => _firebaseUser;
  UserProfile? get user => _user;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _firebaseUser != null;

  /// Initialize authentication state listener
  void _initializeAuthListener() {
    print('DEBUG: Initializing auth state...');
    _authStateSubscription = _authService.authStateChanges().listen(
      (firebase_auth.User? firebaseUser) async {
        print('DEBUG: Auth state changed - user: ${firebaseUser?.uid}');
        _firebaseUser = firebaseUser;
        
        if (firebaseUser != null) {
          // User is signed in, load user data from Firestore
          print('DEBUG: User signed in, loading user data...');
          await _loadUserData(firebaseUser.uid);
          
          // Save FCM token for notifications
          await _notificationService.saveTokenForUser(firebaseUser.uid);
          
          // Initialize streak monitoring
          _streakService.initializeForUser(firebaseUser.uid);
          
          // Update streak once on sign-in (fire-and-forget)
          GamificationService().updateStreakWithMilestones(firebaseUser.uid).catchError((e) {
            print('DEBUG: Streak update on login failed: $e');
          });
        } else {
          // User is signed out, clear user data and remove FCM token
          print('DEBUG: User signed out, clearing user data');
          if (_user != null) {
            await _notificationService.removeTokenForUser(_user!.userId);
          }
          
          // Stop streak monitoring
          _streakService.stopMonitoring();
          
          _user = null;
          _clearError();
        }
        
        print('DEBUG: Notifying listeners...');
        notifyListeners();
      },
      onError: (error) {
        print('DEBUG: Auth state error: $error');
        _setError('Authentication state error: $error');
      },
    );
  }

  /// Force refresh user data (useful for retry scenarios)
  Future<void> refreshUserData() async {
    if (_firebaseUser != null) {
      print('DEBUG: Force refreshing user data...');
      await _loadUserData(_firebaseUser!.uid);
      notifyListeners();
    }
  }

  /// Load user data from Firestore with retry on transient errors
  Future<void> _loadUserData(String userId) async {
    // If we already have cached user data and Firestore is unavailable,
    // we can continue showing the cached data rather than blanking the screen.
    final cachedUser = _user;

    // Retry up to 3 times with exponential backoff for transient errors
    const maxAttempts = 3;
    const retryDelays = [1000, 2000, 4000]; // ms

    for (int attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        print('DEBUG: Loading user data for userId: $userId (attempt ${attempt + 1})');
        _user = await _userRepository.getUserData(userId);
        print('DEBUG: User data loaded successfully: ${_user?.name}');

        // Fix displayName if it's missing but we have a name in Firestore
        if (_firebaseUser != null && _user != null) {
          final firebaseDisplayName = _firebaseUser!.displayName;
          final firestoreName = _user!.name;
          if ((firebaseDisplayName == null || firebaseDisplayName.isEmpty) &&
              firestoreName.isNotEmpty) {
            try {
              print('DEBUG: Fixing missing Firebase displayName with: $firestoreName');
              await _firebaseUser!.updateDisplayName(firestoreName);
              await _firebaseUser!.reload();
              _firebaseUser = firebase_auth.FirebaseAuth.instance.currentUser;
              print('DEBUG: Firebase displayName updated successfully');
            } catch (e) {
              print('DEBUG: Failed to update Firebase displayName: $e');
            }
          }
        }

        _clearError();
        return; // success — exit retry loop

      } catch (e) {
        final errorStr = e.toString();
        print('DEBUG: Error loading user data (attempt ${attempt + 1}): $e');

        // ── Transient / unavailable error ─────────────────────────────────
        final isUnavailable = errorStr.contains('unavailable') ||
            errorStr.contains('UNAVAILABLE') ||
            errorStr.contains('network-request-failed') ||
            errorStr.contains('Failed to get document because the client is offline');

        if (isUnavailable) {
          if (cachedUser != null) {
            // Serve cached data silently — user won't notice
            _user = cachedUser;
            _clearError();
            print('DEBUG: Firestore unavailable — serving cached user data');
            return;
          }
          if (attempt < maxAttempts - 1) {
            // Wait and retry
            print('DEBUG: Firestore unavailable — retrying in ${retryDelays[attempt]}ms');
            await Future.delayed(Duration(milliseconds: retryDelays[attempt]));
            continue;
          }
          // All retries exhausted, no cache — show friendly message
          _user = cachedUser; // keep whatever we had (may be null)
          _setError('Having trouble connecting. Some data may be outdated.');
          return;
        }

        // ── Permission denied ──────────────────────────────────────────────
        if (errorStr.contains('permission-denied') ||
            errorStr.contains('Missing or insufficient permissions')) {
          print('DEBUG: Permission denied - attempting to create user document');
          try {
            final firebaseUser = _firebaseUser;
            if (firebaseUser != null) {
              print('DEBUG: Creating user document for: ${firebaseUser.uid}');
              await _userRepository.createUserDocument(firebaseUser.uid, {
                'name': firebaseUser.displayName ?? 'User',
                'email': firebaseUser.email ?? '',
              });
              print('DEBUG: User document created, loading again...');
              _user = await _userRepository.getUserData(userId);
              print('DEBUG: User data loaded after creation: ${_user?.name}');
              _clearError();
              return;
            }
          } catch (createError) {
            print('DEBUG: Failed to create user document: $createError');
            _setError('Permission error: Please check your internet connection and try again.');
            return;
          }
        }

        // ── Document not found ─────────────────────────────────────────────
        if (errorStr.contains('User document not found') ||
            errorStr.contains('document does not exist')) {
          try {
            print('DEBUG: User document not found, creating new document...');
            final firebaseUser = _firebaseUser;
            if (firebaseUser != null) {
              await _userRepository.createUserDocument(firebaseUser.uid, {
                'name': firebaseUser.displayName ?? 'User',
                'email': firebaseUser.email ?? '',
              });
              print('DEBUG: User document created, loading again...');
              _user = await _userRepository.getUserData(userId);
              print('DEBUG: User data loaded after creation: ${_user?.name}');
              _clearError();
              return;
            }
          } catch (createError) {
            print('DEBUG: Failed to create user document: $createError');
            if (_firebaseUser != null) {
              _setError('User profile incomplete. Some features may be limited.');
              return;
            }
          }
        }

        // ── All other errors ───────────────────────────────────────────────
        _setError('Failed to load user profile: $errorStr');
        return;
      }
    }
  }

  /// Sign up a new user with name, email and password
  /// Creates user document in Firestore with default gamification data
  Future<bool> signUp(String name, String email, String password) async {
    _setLoading(true);
    _clearError();
    
    try {
      // Create Firebase Auth account and Firestore document
      await _authService.signUp(name, email, password);
      
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }

  /// Sign in an existing user
  Future<bool> signIn(String email, String password) async {
    _setLoading(true);
    _clearError();
    
    try {
      await _authService.signIn(email, password);
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }

  /// Sign out the current user
  Future<bool> signOut() async {
    _setLoading(true);
    _clearError();
    
    try {
      await _authService.signOut();
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }

  /// Send password reset email
  Future<bool> resetPassword(String email) async {
    _setLoading(true);
    _clearError();
    
    try {
      await _authService.resetPassword(email);
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }

  /// Update user profile
  Future<bool> updateProfile(Map<String, dynamic> updates) async {
    if (_firebaseUser == null) {
      _setError('No authenticated user');
      return false;
    }
    
    _setLoading(true);
    _clearError();
    
    try {
      // Update Firestore user document
      await _userRepository.updateUserProfile(_firebaseUser!.uid, updates);
      
      // If name is being updated, also update Firebase Auth displayName
      if (updates.containsKey('name') && updates['name'] != null) {
        final newName = updates['name'] as String;
        if (newName.isNotEmpty) {
          await _firebaseUser!.updateDisplayName(newName);
          await _firebaseUser!.reload();
          print('DEBUG: Updated Firebase Auth displayName to: $newName');
        }
      }
      
      // Reload user data to reflect changes
      await _loadUserData(_firebaseUser!.uid);
      
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }

  /// Set loading state
  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  /// Set error message
  void _setError(String error) {
    _error = error;
    notifyListeners();
  }

  /// Clear error message
  void _clearError() {
    _error = null;
    notifyListeners();
  }

  /// Clear error manually (for UI to dismiss error messages)
  void clearError() {
    _clearError();
  }

  @override
  void dispose() {
    _authStateSubscription?.cancel();
    _streakService.dispose();
    super.dispose();
  }
}