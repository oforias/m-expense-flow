import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/transaction_provider.dart';
import '../providers/budget_provider.dart';
import '../providers/gamification_provider.dart';
import '../providers/ai_provider.dart';
import '../providers/premium_provider.dart';
import '../services/performance_service.dart';
import '../services/tour_service.dart';
import '../models/expense_category.dart';
import '../widgets/offline_indicator.dart';
import '../widgets/error_boundary_widget.dart';
import '../widgets/skeleton_screens.dart';
import '../widgets/feature_tour_overlay.dart';
import '../utils/error_handler.dart';
import '../utils/app_theme.dart';
import '../widgets/achievement_celebration.dart';
import '../widgets/financial_health_score_card.dart';
import 'add_edit_transaction_screen.dart';
import 'analytics_screen.dart';
import 'recommendations_screen.dart';
import 'premium_features_screen.dart';
import 'overspending_detection_screen.dart';
import 'financial_forecast_screen.dart';
import '../main.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _hasInitialized = false;
  Timer? _timeoutTimer;
  Timer? _insightRotationTimer;
  final PageController _insightPageController = PageController();
  int _currentInsightPage = 0;
  final PerformanceService _performanceService = PerformanceService();
  final TourService _tourService = TourService();

  // ScrollController so the tour can scroll to off-screen targets
  final _scrollController = ScrollController();

  // GlobalKeys for tour spotlight targets
  final _balanceKey = GlobalKey();
  final _budgetKey = GlobalKey();
  final _recentTxKey = GlobalKey();
  final _aiInsightKey = GlobalKey();
  final _fabKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    PerformanceMonitor.startMeasurement('dashboard_init');
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializeProviders();
    });
    _timeoutTimer = Timer(const Duration(milliseconds: 500), () {
      if (mounted && !_hasInitialized) {
        setState(() => _hasInitialized = true);
        PerformanceMonitor.endMeasurement('dashboard_init');
      }
    });
  }

  @override
  void dispose() {
    _timeoutTimer?.cancel();
    _insightRotationTimer?.cancel();
    _insightPageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _initializeProviders() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (authProvider.firebaseUser == null) return;
    final userId = authProvider.firebaseUser!.uid;
    try {
      PerformanceMonitor.startMeasurement('providers_init');
      _performanceService.debounce('init_providers', () async {
        try {
          await Future.wait([
            Provider.of<TransactionProvider>(context, listen: false).loadTransactions(userId),
            Provider.of<BudgetProvider>(context, listen: false).initialize(userId),
            Provider.of<GamificationProvider>(context, listen: false).initializeForUser(userId),
            Provider.of<AIProvider>(context, listen: false).initializeForUser(userId),
          ]).timeout(const Duration(seconds: 5));
        } catch (e) {
          ErrorHandler.logError(e, context: 'Dashboard - Provider Initialization');
        }
        PerformanceMonitor.endMeasurement('providers_init');
        if (mounted) {
          setState(() => _hasInitialized = true);
          PerformanceMonitor.endMeasurement('dashboard_init');
          // Refresh user data to ensure name is loaded (fixes "good afternoon user" on new accounts)
          Provider.of<AuthProvider>(context, listen: false).refreshUserData();
          // Only show tour after providers are loaded — delay so layout is complete
          await Future.delayed(const Duration(milliseconds: 800));
          if (mounted) _checkAndShowTour();
        }
      });
    } catch (e) {
      ErrorHandler.logError(e, context: 'Dashboard - Provider Initialization Setup');
    }
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  Future<void> _checkAndShowTour() async {
    final seen = await _tourService.hasSeenTour('dashboard_v1');
    if (!seen && mounted) {
      // Extra delay so the scroll view is fully laid out
      await Future.delayed(const Duration(milliseconds: 300));
      if (mounted) _showTour();
    }
  }

  void _showTour() {
    FeatureTour.show(
      context,
      steps: [
        TourStep(
          title: 'Income & Spending',
          description:
              'Your income and total spending this month at a glance. The balance in the header above updates every time you log a transaction.',
          icon: Icons.account_balance_wallet_outlined,
          targetKey: _balanceKey,
          spotlightPadding: 12,
          extraDelayMs: 200,
        ),
        TourStep(
          title: 'Budget Tracker',
          description:
              'These are the budgets set up during onboarding. The bar shows how much of each budget you\'ve used this month. Red = overspent.',
          icon: Icons.pie_chart_outline,
          targetKey: _budgetKey,
          scrollController: _scrollController,
          extraDelayMs: 100,
        ),
        TourStep(
          title: 'Recent Transactions',
          description:
              'Every expense or income you log shows up here. Tap "See all" to browse your full history.',
          icon: Icons.receipt_long_outlined,
          targetKey: _recentTxKey,
          scrollController: _scrollController,
          extraDelayMs: 100,
        ),
        TourStep(
          title: 'AI Insights',
          description:
              'Personalised tips powered by Gemini AI — based on your actual spending patterns. Tap to see all recommendations.',
          icon: Icons.auto_awesome,
          targetKey: _aiInsightKey,
          scrollController: _scrollController,
          extraDelayMs: 100,
        ),
        TourStep(
          title: 'Add a Transaction',
          description:
              'Tap this any time you spend or receive money. The more you log, the smarter your insights get.',
          icon: Icons.add_circle_outline,
          targetKey: _fabKey,
          spotlightPadding: 14,
          // FAB is outside the scroll view — no scrollController needed.
          // Extra delay ensures Scaffold has rendered the FAB.
          extraDelayMs: 200,
        ),
      ],
      onComplete: () async {
        await _tourService.markTourSeen('dashboard_v1');
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final scaffold = Scaffold(
      backgroundColor: const Color(0xFFF5F6FA),
      body: OfflineIndicator(
        child: Consumer<AuthProvider>(
          builder: (context, authProvider, _) {
            // For transient connectivity errors where we still have user data,
            // show the dashboard with a non-blocking banner instead of a blank screen
            final isTransientError = authProvider.error != null &&
                (authProvider.error!.contains('Having trouble connecting') ||
                 authProvider.error!.contains('may be outdated'));

            if (authProvider.error != null && !isTransientError) {
              final errorInfo = ErrorHandler.processError(
                authProvider.error!,
                context: 'Dashboard',
              );
              return InlineErrorWidget(
                message: errorInfo.message,
                onRetry: errorInfo.canRetry
                    ? () {
                        authProvider.clearError();
                        _initializeProviders();
                      }
                    : null,
              );
            }
            if (!_hasInitialized) return SkeletonScreens.dashboard();
            return RefreshIndicator(
              color: AppTheme.primaryGreen,
              onRefresh: () async => _initializeProviders(),
              child: CustomScrollView(
                controller: _scrollController,
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverAppBar(
                    expandedHeight: 190,
                    pinned: true,
                    backgroundColor: const Color(0xFF1A1F36),
                    flexibleSpace: FlexibleSpaceBar(
                      background: _buildHeroHeader(authProvider),
                    ),
                    actions: [
                      const OfflineStatusChip(),
                      IconButton(
                        icon: const Icon(Icons.logout, color: Colors.white70),
                        onPressed: () async {
                          final authProvider = Provider.of<AuthProvider>(context, listen: false);
                          final success = await authProvider.signOut();
                          if (success && mounted) {
                            // Force navigation to login screen
                            Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
                          }
                        },
                      ),
                    ],
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 100),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
                        // Transient connectivity banner (non-blocking)
                        if (authProvider.error != null)
                          Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: Colors.orange.shade50,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: Colors.orange.shade200),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.wifi_off_rounded,
                                    size: 16, color: Colors.orange.shade700),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    authProvider.error!,
                                    style: TextStyle(
                                        fontSize: 12,
                                        color: Colors.orange.shade800),
                                  ),
                                ),
                                GestureDetector(
                                  onTap: () {
                                    authProvider.clearError();
                                    _initializeProviders();
                                  },
                                  child: Text('Retry',
                                      style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.orange.shade800)),
                                ),
                              ],
                            ),
                          ),
                        _buildMonthSummaryRow(),
                        const SizedBox(height: 20),
                        _buildRecurringReminders(),
                        _buildAIInsightStrip(),
                        const SizedBox(height: 20),
                        _buildBudgetSnapshot(),
                        const SizedBox(height: 20),
                        const FinancialHealthScoreCard(),
                        const SizedBox(height: 20),
                        _buildFeatureCards(),
                        const SizedBox(height: 20),
                        _buildRecentTransactions(),
                        const SizedBox(height: 20),
                        _buildTopSpendingCategories(),
                        const SizedBox(height: 20),
                        _buildQuickActions(),
                      ]),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        key: _fabKey,
        heroTag: 'dashboard_fab',
        backgroundColor: const Color(0xFF1A1F36),
        foregroundColor: Colors.white,
        elevation: 4,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add', style: TextStyle(fontWeight: FontWeight.w600, letterSpacing: 0.3)),
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const AddEditTransactionScreen()),
        ),
      ),
    );
    return Consumer<GamificationProvider>(
      builder: (context, gamProvider, _) {
        // Show achievement celebration when a new one unlocks
        final pending = gamProvider.pendingCelebrationAchievement;
        if (pending != null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              AchievementCelebration.show(context, achievement: pending);
              gamProvider.clearCelebration();
            }
          });
        }
        return scaffold;
      },
    );
  }

  // ── Hero header ────────────────────────────────────────────────────────────
  Widget _buildHeroHeader(AuthProvider authProvider) {
    return Consumer2<TransactionProvider, GamificationProvider>(
      builder: (context, txProvider, gamProvider, _) {
        final user = authProvider.user;
        final firebaseUser = authProvider.firebaseUser;
        final name = (user?.name ?? firebaseUser?.displayName ?? 'there').split(' ').first;
        final balance = txProvider.getAllTimeNetBalance();
        final streak = user?.streak ?? 0;
        final level = user?.level ?? 1;
        final isPremium = user?.isPremium ?? false;

        return Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF1A1F36), Color(0xFF2D3561)],
            ),
          ),
          padding: EdgeInsets.fromLTRB(
              20, MediaQuery.of(context).padding.top + 12, 20, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${_greeting()}, $name 👋',
                        style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 13,
                            fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'M-Expense Flow',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 19,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.3),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      if (streak > 0) ...[
                        _StatPill(
                            icon: Icons.local_fire_department,
                            iconColor: Colors.orange,
                            label: '${streak}d'),
                        const SizedBox(width: 6),
                      ],
                      _StatPill(
                          icon: Icons.star,
                          iconColor: Colors.amber,
                          label: 'Lv $level'),
                      if (isPremium) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            gradient: AppTheme.goldGradient,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text('👑',
                              style: TextStyle(fontSize: 12)),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
              const Spacer(),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Total Balance',
                      style: TextStyle(color: Colors.white54, fontSize: 12)),
                  const SizedBox(height: 4),
                  Text(
                    'GHS ${balance.toStringAsFixed(2)}',
                    style: TextStyle(
                      color: balance >= 0 ? Colors.white : Colors.red.shade300,
                      fontSize: 30,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.5,
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  // ── Recurring reminders ────────────────────────────────────────────────────
  Widget _buildRecurringReminders() {
    return Consumer2<TransactionProvider, AuthProvider>(
      builder: (context, tp, auth, _) {
        final now = DateTime.now();
        final today = DateTime(now.year, now.month, now.day);

        // Find recurring transactions that are due today or overdue
        final due = tp.allTransactions.where((t) {
          if (!t.isRecurring || t.nextDueDate == null) return false;
          final due = DateTime(
              t.nextDueDate!.year, t.nextDueDate!.month, t.nextDueDate!.day);
          return !due.isAfter(today);
        }).toList();

        if (due.isEmpty) return const SizedBox.shrink();

        return Padding(
          padding: const EdgeInsets.only(bottom: 20),
          child: Column(
            children: due.map((t) {
              final cat = Categories.getCategoryById(t.category);
              return _RecurringReminderCard(
                transaction: t,
                onConfirm: () async {
                  final userId = auth.firebaseUser?.uid;
                  if (userId == null) return;
                  final nextDue = _nextDueFrom(t.nextDueDate!, t.recurringInterval!);
                  // Log the new transaction
                  await tp.createTransaction(userId, {
                    'type': t.type,
                    'amount': t.amount,
                    'category': t.category,
                    'description': t.description,
                    'date': now,
                    'isBusinessTransaction': t.isBusinessTransaction,
                    'isRecurring': true,
                    'recurringInterval': t.recurringInterval,
                    'nextDueDate': nextDue,
                  });
                  // Update the original template's nextDueDate
                  await tp.updateTransaction(userId, t.transactionId, {
                    'nextDueDate': nextDue,
                  });
                },
                onSkip: () async {
                  final userId = auth.firebaseUser?.uid;
                  if (userId == null) return;
                  final nextDue = _nextDueFrom(t.nextDueDate!, t.recurringInterval!);
                  await tp.updateTransaction(userId, t.transactionId, {
                    'nextDueDate': nextDue,
                  });
                },
              );
            }).toList(),
          ),
        );
      },
    );
  }

  DateTime _nextDueFrom(DateTime from, String interval) {
    switch (interval) {
      case 'daily':
        return from.add(const Duration(days: 1));
      case 'weekly':
        return from.add(const Duration(days: 7));
      default:
        return DateTime(from.year, from.month + 1, from.day);
    }
  }

  // ── Month summary row ──────────────────────────────────────────────────────
  Widget _buildMonthSummaryRow() {
    return Consumer<TransactionProvider>(
      builder: (context, txProvider, _) {
        final breakdown = txProvider.getCurrentMonthIncomeExpenseBreakdown();
        final income = breakdown['income'] ?? 0.0;
        final expenses = breakdown['expense'] ?? 0.0;
        const months = [
          'Jan','Feb','Mar','Apr','May','Jun',
          'Jul','Aug','Sep','Oct','Nov','Dec'
        ];
        final now = DateTime.now();
        final label = '${months[now.month - 1]} ${now.year}';
        // _balanceKey lives here — in normal scroll content, reliable for tour spotlight
        return KeyedSubtree(
          key: _balanceKey,
          child: Row(
            children: [
              Expanded(
                child: _SummaryTile(
                  label: 'Income',
                  sublabel: label,
                  amount: income,
                  icon: Icons.arrow_downward_rounded,
                  iconBg: const Color(0xFFE8F5E9),
                  iconColor: const Color(0xFF2E7D32),
                  amountColor: const Color(0xFF2E7D32),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _SummaryTile(
                  label: 'Spent',
                  sublabel: label,
                  amount: expenses,
                  icon: Icons.arrow_upward_rounded,
                  iconBg: const Color(0xFFFFEBEE),
                  iconColor: const Color(0xFFC62828),
                  amountColor: const Color(0xFFC62828),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // ── Budget snapshot ────────────────────────────────────────────────────────
  Widget _buildBudgetSnapshot() {
    return Consumer<BudgetProvider>(
      builder: (context, budgetProvider, _) {
        final budgets = budgetProvider.quickBudgets;
        final alerts = budgetProvider.getBudgetsWithAlerts();
        final warnings = budgetProvider.getBudgetsWithWarnings();

        return _SectionCard(
          key: _budgetKey,
          title: 'Budgets',
          trailing: TextButton(
            onPressed: () => MainAppWrapper.switchToTab(context, 2),
            child: const Text('See all'),
          ),
          child: budgets.isEmpty
              ? _EmptyHint(
                  icon: Icons.account_balance_wallet_outlined,
                  text: 'No budgets yet — tap to create one',
                  onTap: () => MainAppWrapper.switchToTab(context, 2),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (alerts.isNotEmpty || warnings.isNotEmpty) ...[
                      _StatusBanner(
                        isAlert: alerts.isNotEmpty,
                        count: alerts.isNotEmpty
                            ? alerts.length
                            : warnings.length,
                      ),
                      const SizedBox(height: 12),
                    ],
                    ...budgets.take(3).map((b) {
                      final p = budgetProvider.getBudgetProgress(b.budgetId);
                      final pct = ((p?['progressPercentage'] as double?) ?? 0.0)
                          .clamp(0.0, 100.0);
                      final spent = (p?['spent'] as double?) ?? 0.0;
                      final alert =
                          budgetProvider.getBudgetAlertLevel(b.budgetId);
                      final barColor = alert == 'alert'
                          ? Colors.red
                          : alert == 'warning'
                              ? Colors.orange
                              : AppTheme.primaryGreen;
                      final cat = Categories.getCategoryById(b.category);
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    Text(cat?.icon ?? '📦',
                                        style: const TextStyle(fontSize: 16)),
                                    const SizedBox(width: 6),
                                    Text(
                                      cat?.name ?? b.category,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                          fontSize: 13),
                                    ),
                                  ],
                                ),
                                Text(
                                  'GHS ${spent.toStringAsFixed(0)} / ${b.limit.toStringAsFixed(0)}',
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey.shade600),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: pct / 100,
                                minHeight: 6,
                                backgroundColor: Colors.grey.shade200,
                                color: barColor,
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                    if (budgets.length > 3)
                      Text(
                        '+${budgets.length - 3} more',
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey.shade500),
                      ),
                  ],
                ),
        );
      },
    );
  }

  // ── Recent transactions ────────────────────────────────────────────────────
  Widget _buildRecentTransactions() {
    return Consumer<TransactionProvider>(
      builder: (context, txProvider, _) {
        final recent = txProvider.getRecentTransactions(5);
        return _SectionCard(
          key: _recentTxKey,
          title: 'Recent Transactions',
          trailing: TextButton(
            onPressed: () => MainAppWrapper.switchToTab(context, 1),
            child: const Text('See all'),
          ),
          child: recent.isEmpty
              ? _EmptyHint(
                  icon: Icons.receipt_long_outlined,
                  text: 'No transactions yet',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                        builder: (_) => const AddEditTransactionScreen()),
                  ),
                )
              : Column(
                  children: recent.take(4).map((tx) {
                    final cat = Categories.getCategoryById(tx.category);
                    final isIncome = tx.type == 'income';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: isIncome
                                  ? const Color(0xFFE8F5E9)
                                  : const Color(0xFFFCE4EC),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Center(
                              child: Text(cat?.icon ?? '💰',
                                  style: const TextStyle(fontSize: 18)),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  tx.description.isNotEmpty
                                      ? tx.description
                                      : (cat?.name ?? 'Transaction'),
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  cat?.name ?? tx.category,
                                  style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.grey.shade500),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '${isIncome ? '+' : '-'}GHS ${tx.amount.toStringAsFixed(2)}',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                              color: isIncome
                                  ? const Color(0xFF2E7D32)
                                  : const Color(0xFFC62828),
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
        );
      },
    );
  }

  // ── Top spending categories ────────────────────────────────────────────────
  Widget _buildTopSpendingCategories() {
    return Consumer<TransactionProvider>(
      builder: (context, txProvider, _) {
        final top = txProvider.getTopSpendingCategories(4);
        final total = txProvider.getTotalExpenses();
        if (top.isEmpty) return const SizedBox.shrink();

        const barColors = [
          Color(0xFF7C4DFF),
          Color(0xFF448AFF),
          Color(0xFFFF6E40),
          Color(0xFFFF4081),
        ];

        return _SectionCard(
          title: 'Where Your Money Goes',
          child: Column(
            children: List.generate(top.length, (idx) {
              final item = top[idx];
              final cat = Categories.getCategoryById(item['category'] as String);
              final amount = item['amount'] as double;
              final pct = total > 0 ? (amount / total * 100) : 0.0;
              final barColor = barColors[idx % barColors.length];

              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: barColor.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Center(
                        child: Text(cat?.icon ?? '💰',
                            style: const TextStyle(fontSize: 16)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                cat?.name ?? (item['category'] as String),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600, fontSize: 13),
                              ),
                              Text(
                                'GHS ${amount.toStringAsFixed(0)}',
                                style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: barColor),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: (pct / 100).clamp(0.0, 1.0),
                              minHeight: 5,
                              backgroundColor: Colors.grey.shade200,
                              color: barColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${pct.toStringAsFixed(0)}%',
                      style: TextStyle(
                          fontSize: 11, color: Colors.grey.shade500),
                    ),
                  ],
                ),
              );
            }),
          ),
        );
      },
    );
  }

  // ── AI insight strip ───────────────────────────────────────────────────────
  Widget _buildAIInsightStrip() {
    return Consumer2<AIProvider, AuthProvider>(
      builder: (context, aiProvider, authProvider, _) {
        final insights = aiProvider.getAvailableInsights().take(3).toList();
        final isGenerating = aiProvider.isGeneratingInsights || aiProvider.isLoading;
        final userId = authProvider.firebaseUser?.uid;

        // Start/stop auto-rotation based on insight count
        if (insights.length > 1 && _insightRotationTimer == null) {
          _insightRotationTimer =
              Timer.periodic(const Duration(seconds: 4), (_) {
            if (!mounted || insights.isEmpty) return;
            // Guard against controller not being attached to a PageView
            if (!_insightPageController.hasClients) return;
            final next = (_currentInsightPage + 1) % insights.length;
            _insightPageController.animateToPage(
              next,
              duration: const Duration(milliseconds: 400),
              curve: Curves.easeInOut,
            );
            setState(() => _currentInsightPage = next);
          });
        } else if (insights.length <= 1) {
          _insightRotationTimer?.cancel();
          _insightRotationTimer = null;
        }

        return GestureDetector(
          key: _aiInsightKey,
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const RecommendationsScreen()),
          ),
          child: Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: AppTheme.purpleGradient,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header row
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.auto_awesome,
                          color: Colors.white, size: 18),
                    ),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text('AI Insights',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 15)),
                    ),
                    const Icon(Icons.chevron_right, color: Colors.white70),
                  ],
                ),
                const SizedBox(height: 12),

                // Content
                if (isGenerating)
                  Row(children: [
                    const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white70)),
                    const SizedBox(width: 10),
                    Text('Analysing your spending patterns…',
                        style: TextStyle(
                            color: Colors.white.withOpacity(0.8),
                            fontSize: 13)),
                  ])
                else if (insights.isEmpty)
                  Row(children: [
                    Expanded(
                      child: Text(
                          'Personalised tips powered by Gemini AI — tap to generate your first analysis',
                          style: TextStyle(
                              color: Colors.white.withOpacity(0.85),
                              fontSize: 13)),
                    ),
                    const SizedBox(width: 8),
                    if (userId != null)
                      GestureDetector(
                        onTap: () => aiProvider.generateRecommendations(userId),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Text('Generate',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600)),
                        ),
                      ),
                  ])
                else ...[
                  // Carousel
                  SizedBox(
                    height: 60,
                    child: PageView.builder(
                      controller: _insightPageController,
                      itemCount: insights.length,
                      onPageChanged: (i) =>
                          setState(() => _currentInsightPage = i),
                      itemBuilder: (_, i) => Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(insights[i].title,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13)),
                          const SizedBox(height: 4),
                          Text(insights[i].message,
                              style: TextStyle(
                                  color: Colors.white.withOpacity(0.85),
                                  fontSize: 12),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis),
                        ],
                      ),
                    ),
                  ),
                  // Dot indicators (only when >1 insight)
                  if (insights.length > 1) ...[
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(
                        insights.length,
                        (i) => AnimatedContainer(
                          duration: const Duration(milliseconds: 250),
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          width: _currentInsightPage == i ? 16 : 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: _currentInsightPage == i
                                ? Colors.white
                                : Colors.white.withOpacity(0.4),
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  // ── Feature showcase cards ─────────────────────────────────────────────────
  Widget _buildFeatureCards() {
    return Consumer<PremiumProvider>(
      builder: (context, premiumProvider, _) {
        final isPremium = premiumProvider.isPremium;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Features', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            const SizedBox(height: 12),
            Row(
              children: [
                // Financial Forecast
                Expanded(
                  child: _FeatureCard(
                    icon: Icons.trending_up,
                    title: 'Forecast',
                    subtitle: 'See where you\'re headed',
                    gradient: const LinearGradient(
                      colors: [Color(0xFF00C853), Color(0xFF00E676)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const FinancialForecastScreen()),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                // Overspending Detection
                Expanded(
                  child: _FeatureCard(
                    icon: Icons.shield_outlined,
                    title: 'Overspending',
                    subtitle: 'Detect risky patterns',
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFF6E40), Color(0xFFFF9E80)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const OverspendingDetectionScreen()),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Premium banner for free users
            if (!isPremium)
              GestureDetector(
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const PremiumFeaturesScreen()),
                ),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: AppTheme.goldGradient,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.25),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Text('👑', style: TextStyle(fontSize: 18)),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Upgrade to Premium',
                                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                            Text('Unlimited budgets, AI insights & peer comparison',
                                style: TextStyle(color: Colors.white, fontSize: 12)),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: Colors.white),
                    ],
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  // ── Quick actions grid ─────────────────────────────────────────────────────
  Widget _buildQuickActions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Quick Actions', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 12),
        GridView.count(
          crossAxisCount: 4,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          children: [
            _ActionTile(
              icon: Icons.analytics_outlined,
              label: 'Analytics',
              color: AppTheme.accentPurple,
              onTap: () => Navigator.pushNamed(context, '/analytics'),
            ),
            _ActionTile(
              icon: Icons.emoji_events_outlined,
              label: 'Rewards',
              color: AppTheme.accentOrange,
              onTap: () => MainAppWrapper.switchToTab(context, 3),
            ),
            _ActionTile(
              icon: Icons.business_center_outlined,
              label: 'Business',
              color: AppTheme.primaryGreen,
              onTap: () => Navigator.pushNamed(context, '/business-mode'),
            ),
          ],
        ),
      ],
    );
  }
}

// ── Reusable helper widgets ────────────────────────────────────────────────

class _FeatureCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final LinearGradient gradient;
  final VoidCallback onTap;

  const _FeatureCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.gradient,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: gradient,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: Colors.white, size: 20),
            ),
            const SizedBox(height: 10),
            Text(title,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 2),
            Text(subtitle,
                style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 11)),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final Widget child;
  final Widget? trailing;

  const _SectionCard({
    super.key,
    required this.title,
    required this.child,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15),
                ),
                if (trailing != null) trailing!,
              ],
            ),
            const SizedBox(height: 14),
            child,
          ],
        ),
      ),
    );
  }
}

class _SummaryTile extends StatelessWidget {
  final String label;
  final String sublabel;
  final double amount;
  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final Color amountColor;

  const _SummaryTile({
    required this.label,
    required this.sublabel,
    required this.amount,
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.amountColor,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF9E9E9E),
                        fontWeight: FontWeight.w500)),
                const SizedBox(height: 2),
                Text(
                  'GHS ${amount.toStringAsFixed(0)}',
                  style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: amountColor),
                ),
                Text(sublabel,
                    style: const TextStyle(
                        fontSize: 10, color: Color(0xFFBDBDBD))),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }
}

class _StatPill extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;

  const _StatPill(
      {required this.icon, required this.iconColor, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: iconColor, size: 14),
          const SizedBox(width: 4),
          Text(label,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionTile({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Card(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyHint extends StatelessWidget {
  final IconData icon;
  final String text;
  final VoidCallback? onTap;

  const _EmptyHint({required this.icon, required this.text, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: Colors.grey.shade400, size: 20),
            const SizedBox(width: 8),
            Text(text,
                style:
                    TextStyle(color: Colors.grey.shade500, fontSize: 13)),
          ],
        ),
      ),
    );
  }
}

class _StatusBanner extends StatelessWidget {
  final bool isAlert;
  final int count;

  const _StatusBanner({required this.isAlert, required this.count});

  @override
  Widget build(BuildContext context) {
    final color = isAlert ? Colors.red : Colors.orange;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(
            isAlert
                ? Icons.warning_rounded
                : Icons.warning_amber_rounded,
            color: color,
            size: 16,
          ),
          const SizedBox(width: 8),
          Text(
            '$count budget${count > 1 ? 's' : ''} ${isAlert ? 'exceeded' : 'near limit'}',
            style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}


class _RecurringReminderCard extends StatelessWidget {
  final dynamic transaction; // Transaction
  final VoidCallback onConfirm;
  final VoidCallback onSkip;

  const _RecurringReminderCard({
    required this.transaction,
    required this.onConfirm,
    required this.onSkip,
  });

  @override
  Widget build(BuildContext context) {
    final cat = Categories.getCategoryById(transaction.category as String);
    final isExpense = transaction.type == 'expense';
    final color = isExpense ? const Color(0xFFEF5350) : const Color(0xFF4CAF50);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(cat?.icon ?? '🔄',
                  style: const TextStyle(fontSize: 18)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.repeat, size: 12, color: Colors.grey),
                    const SizedBox(width: 4),
                    Text(
                      'Recurring due',
                      style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey.shade600,
                          fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  transaction.description.isNotEmpty
                      ? transaction.description as String
                      : (cat?.name ?? transaction.category as String),
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 13),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Text(
            'GHS ${(transaction.amount as double).toStringAsFixed(2)}',
            style: TextStyle(
                fontWeight: FontWeight.bold, fontSize: 13, color: color),
          ),
          const SizedBox(width: 10),
          // Confirm button
          GestureDetector(
            onTap: onConfirm,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text('Log it',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w600)),
            ),
          ),
          const SizedBox(width: 6),
          // Skip button
          GestureDetector(
            onTap: onSkip,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.grey.withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text('Skip',
                  style: TextStyle(
                      color: Colors.grey.shade600,
                      fontSize: 12,
                      fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}
