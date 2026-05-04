# Feature Tour Overlay System - Technical Documentation

## Overview

The **Feature Tour Overlay** is an interactive tutorial system that guides users through app features by:
- **Spotlighting** specific UI widgets with a glowing border
- **Pointing** to widgets using GlobalKeys for precise targeting
- **Explaining** each feature with animated tooltip cards
- **Auto-scrolling** to off-screen widgets
- **Persisting** tour completion state

This is the "skeleton pointer" system you asked about — it creates an overlay that highlights widgets and shows explanatory cards.

---

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Feature Tour System                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │  TourStep    │───▶│FeatureTour   │───▶│ TourService  │ │
│  │  (Data)      │    │ (Controller) │    │ (Persistence)│ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         │                    │                    │         │
│         ▼                    ▼                    ▼         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           _TourController (State Manager)            │  │
│  │  • Manages step progression                          │  │
│  │  • Handles animations                                │  │
│  │  • Measures widget positions                         │  │
│  │  • Auto-scrolls to targets                           │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            _TourOverlay (UI Layer)                    │  │
│  │  • Renders dark overlay                              │  │
│  │  • Draws spotlight cutout                            │  │
│  │  • Shows tooltip card                                │  │
│  │  • Displays progress indicators                      │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        _SpotlightPainter (Custom Painter)            │  │
│  │  • Paints dark overlay with cutout                   │  │
│  │  • Draws glowing border around target               │  │
│  │  • Uses PathFillType.evenOdd for cutout             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. TourStep - The Data Model

Each step in the tour is defined by a `TourStep` object:

```dart
class TourStep {
  final GlobalKey? targetKey;           // Widget to spotlight (null = centered card)
  final ScrollController? scrollController; // For auto-scrolling
  final String title;                   // Step title
  final String description;             // Step explanation
  final IconData icon;                  // Icon for the card
  final double spotlightPadding;        // Extra space around spotlight
  final int extraDelayMs;               // Extra delay after scroll
}
```

**Key Features:**
- **GlobalKey targeting**: Uses Flutter's GlobalKey to find exact widget position
- **Optional scrolling**: Can auto-scroll to off-screen widgets
- **Flexible spotlight**: Adjustable padding around target widget
- **Timing control**: Extra delays for complex layouts

---

### 2. FeatureTour - The Controller

Static class that manages the overlay lifecycle:

```dart
class FeatureTour {
  static OverlayEntry? _entry;
  
  static void show(BuildContext context, {
    required List<TourStep> steps,
    required VoidCallback onComplete,
  }) {
    // Creates overlay entry and inserts into root overlay
    _entry = OverlayEntry(
      builder: (_) => _TourController(steps: steps, onComplete: onComplete),
    );
    Overlay.of(context, rootOverlay: true).insert(_entry!);
  }
  
  static void dismiss() {
    _entry?.remove();
    _entry = null;
  }
}
```

**Why Root Overlay?**
- Renders above ALL app content (including AppBar, FAB, etc.)
- Ensures spotlight is always visible
- Prevents interference from other overlays

---

### 3. _TourController - The State Manager

Manages tour progression, animations, and widget measurement:

```dart
class _TourControllerState extends State<_TourController> 
    with SingleTickerProviderStateMixin {
  int _step = 0;                    // Current step index
  Rect? _displayRect;               // Current spotlight position
  bool _visible = false;            // Fade in/out control
  
  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;
  
  Rect? _animFrom;                  // Animation start position
  Rect? _animTo;                    // Animation end position
}
```

**Key Responsibilities:**

#### A. Widget Position Measurement
```dart
Rect? _measureRect(TourStep step) {
  final ctx = step.targetKey?.currentContext;
  if (ctx == null) return null;
  
  final box = ctx.findRenderObject() as RenderBox?;
  if (box == null || !box.hasSize) return null;
  
  // Convert local coordinates to global screen coordinates
  Offset origin = box.localToGlobal(Offset.zero);
  final size = box.size;
  
  // Add padding around the widget
  final pad = step.spotlightPadding;
  return Rect.fromLTWH(
    origin.dx - pad,
    origin.dy - pad,
    size.width + pad * 2,
    size.height + pad * 2,
  );
}
```

**Measurement Strategy:**
1. Get widget's RenderBox from GlobalKey
2. Convert local position to global screen coordinates
3. Add padding for visual breathing room
4. Retry up to 8 times if widget not ready (handles async layouts)

#### B. Auto-Scrolling to Targets
```dart
Future<void> _goToStep(int index, {bool isFirst = false}) async {
  final step = widget.steps[index];
  
  // 1. Scroll target into view if needed
  if (step.scrollController != null) {
    final ctx = step.targetKey?.currentContext;
    if (ctx != null) {
      await Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOut,
        alignment: 0.15,  // Position at 15% from top
      );
    }
    await _waitMs(650);  // Wait for scroll animation
  }
  
  // 2. Extra delay for complex layouts
  if (step.extraDelayMs > 0) await _waitMs(step.extraDelayMs);
  
  // 3. Measure widget position (with retries)
  Rect? rect;
  for (int attempt = 0; attempt < 8; attempt++) {
    rect = _measureRect(step);
    if (rect != null) break;
    await _waitMs(attempt < 3 ? 80 : 200);
  }
  
  // 4. Animate spotlight to new position
  setState(() {
    _step = index;
    _animFrom = _displayRect;
    _animTo = rect;
    _animCtrl.forward(from: 0);
  });
}
```

**Scrolling Strategy:**
- Uses Flutter's `Scrollable.ensureVisible()` for smooth scrolling
- Waits for scroll animation to complete
- Retries measurement to handle layout delays
- Animates spotlight smoothly between positions

#### C. Smooth Spotlight Animation
```dart
_animCtrl.addListener(() {
  if (_animFrom != null && _animTo != null && mounted) {
    setState(() {
      // Interpolate between old and new spotlight positions
      _displayRect = Rect.lerp(_animFrom, _animTo, _animCtrl.value);
    });
  }
});
```

**Animation Features:**
- 350ms duration with easeOut curve
- Smooth interpolation between spotlight positions
- Fade in/out for tour start/end
- No jarring jumps between steps

---

### 4. _TourOverlay - The UI Layer

Renders the visual tour interface:

```dart
Widget build(BuildContext context) {
  return Material(
    color: Colors.transparent,
    child: GestureDetector(
      onTap: onNext,  // Tap anywhere to advance
      child: SizedBox.expand(
        child: CustomPaint(
          painter: _SpotlightPainter(spotlightRect: spotlightRect),
          child: Stack(
            children: [
              _TooltipCard(...),      // Explanation card
              Positioned(             // Skip button
                top: safePadding.top + 8,
                right: 16,
                child: GestureDetector(
                  onTap: onSkip,
                  child: Container(...),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
```

**UI Components:**
1. **Dark overlay** with spotlight cutout (via CustomPaint)
2. **Tooltip card** with step info (auto-positioned)
3. **Skip button** (top-right corner)
4. **Progress indicators** (dots showing current step)

---

### 5. _TooltipCard - The Explanation Card

Smart positioning system that avoids covering the spotlight:

```dart
Widget _buildTooltipCard() {
  const cardMargin = 16.0;
  const gap = 16.0;
  const estimatedCardHeight = 220.0;
  
  double top;
  
  if (spotlightRect == null) {
    // No spotlight → center the card
    top = screenSize.height / 2 - estimatedCardHeight / 2;
  } else {
    // Calculate space above and below spotlight
    final spaceBelow = screenSize.height - spotlightRect!.bottom - gap - safePadding.bottom;
    final spaceAbove = spotlightRect!.top - gap - safePadding.top - 52;
    
    // Prefer below, fallback to above
    if (spaceBelow >= estimatedCardHeight) {
      top = spotlightRect!.bottom + gap;
    } else if (spaceAbove >= estimatedCardHeight) {
      top = spotlightRect!.top - gap - estimatedCardHeight;
    } else {
      // Not enough space either way → choose the better option
      top = spaceBelow >= spaceAbove
          ? spotlightRect!.bottom + gap
          : spotlightRect!.top - gap - estimatedCardHeight;
    }
  }
  
  // Clamp to safe area
  final minTop = safePadding.top + 56.0;
  final maxTop = screenSize.height - estimatedCardHeight - safePadding.bottom - cardMargin;
  top = top.clamp(minTop, maxTop);
  
  return Positioned(left: cardMargin, right: cardMargin, top: top, child: ...);
}
```

**Positioning Logic:**
1. **Measure available space** above and below spotlight
2. **Prefer below** spotlight (more natural reading flow)
3. **Fallback to above** if not enough space below
4. **Clamp to safe area** (avoid notches, status bar, etc.)
5. **Always visible** even if spotlight is at screen edge

**Card Contents:**
- **Progress dots** (animated width for current step)
- **Icon + Title** (step identification)
- **Description** (feature explanation)
- **Step counter** (e.g., "3/5")
- **Next/Finish button** (context-aware label)

---

### 6. _SpotlightPainter - The Custom Painter

Draws the dark overlay with a glowing cutout:

```dart
class _SpotlightPainter extends CustomPainter {
  final Rect? spotlightRect;
  
  @override
  void paint(Canvas canvas, Size size) {
    final overlayPaint = Paint()..color = Colors.black.withOpacity(0.75);
    
    if (spotlightRect == null) {
      // No spotlight → full dark overlay
      canvas.drawRect(Offset.zero & size, overlayPaint);
      return;
    }
    
    // Create rounded rectangle for spotlight
    final rrect = RRect.fromRectAndRadius(
      spotlightRect!,
      const Radius.circular(14),
    );
    
    // Draw overlay with cutout using evenOdd fill rule
    canvas.drawPath(
      Path()
        ..addRect(Offset.zero & size)  // Full screen rectangle
        ..addRRect(rrect)               // Spotlight rectangle
        ..fillType = PathFillType.evenOdd,  // Cutout magic!
      overlayPaint,
    );
    
    // Draw glowing border around spotlight
    canvas.drawRRect(
      rrect,
      Paint()
        ..color = Colors.white.withOpacity(0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),  // Glow effect
    );
    
    // Draw crisp inner border
    canvas.drawRRect(
      rrect,
      Paint()
        ..color = Colors.white.withOpacity(0.9)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
  }
  
  @override
  bool shouldRepaint(_SpotlightPainter old) => old.spotlightRect != spotlightRect;
}
```

**Rendering Technique:**
1. **PathFillType.evenOdd**: Creates cutout by overlapping paths
   - Full screen rectangle + spotlight rectangle = cutout effect
2. **Glowing border**: Two-layer approach
   - Outer blur layer (soft glow)
   - Inner crisp layer (sharp edge)
3. **Rounded corners**: 14px radius for modern look
4. **Efficient repainting**: Only repaints when spotlight moves

---

### 7. TourService - Persistence Layer

Tracks which tours the user has completed:

```dart
class TourService {
  static const _prefix = 'tour_seen_';
  
  Future<bool> hasSeenTour(String tourId) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('$_prefix$tourId') ?? false;
  }
  
  Future<void> markTourSeen(String tourId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('$_prefix$tourId', true);
  }
  
  Future<void> resetTour(String tourId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('$_prefix$tourId');
  }
}
```

**Storage Strategy:**
- Uses SharedPreferences for local persistence
- Prefixed keys prevent collisions
- Per-tour tracking (dashboard, analytics, forecast, etc.)
- Reset capability for testing

---

## Usage Examples

### Example 1: Dashboard Tour

```dart
class _DashboardScreenState extends State<DashboardScreen> {
  final TourService _tourService = TourService();
  final _scrollController = ScrollController();
  
  // GlobalKeys for spotlight targets
  final _balanceKey = GlobalKey();
  final _budgetKey = GlobalKey();
  final _recentTxKey = GlobalKey();
  final _aiInsightKey = GlobalKey();
  final _fabKey = GlobalKey();
  
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAndShowTour();
    });
  }
  
  Future<void> _checkAndShowTour() async {
    final seen = await _tourService.hasSeenTour('dashboard_v1');
    if (!seen && mounted) {
      await Future.delayed(const Duration(milliseconds: 800));
      if (mounted) _showTour();
    }
  }
  
  void _showTour() {
    FeatureTour.show(
      context,
      steps: [
        TourStep(
          title: 'Income & Spending',
          description: 'Your income and total spending this month at a glance.',
          icon: Icons.account_balance_wallet_outlined,
          targetKey: _balanceKey,
          spotlightPadding: 12,
          extraDelayMs: 200,
        ),
        TourStep(
          title: 'Budget Tracker',
          description: 'These are the budgets set up during onboarding.',
          icon: Icons.pie_chart_outline,
          targetKey: _budgetKey,
          scrollController: _scrollController,  // Auto-scroll to this widget
          extraDelayMs: 100,
        ),
        TourStep(
          title: 'Recent Transactions',
          description: 'Every expense or income you log shows up here.',
          icon: Icons.receipt_long_outlined,
          targetKey: _recentTxKey,
          scrollController: _scrollController,
          extraDelayMs: 100,
        ),
        TourStep(
          title: 'AI Insights',
          description: 'Personalised tips powered by Gemini AI.',
          icon: Icons.auto_awesome,
          targetKey: _aiInsightKey,
          scrollController: _scrollController,
          extraDelayMs: 100,
        ),
        TourStep(
          title: 'Add a Transaction',
          description: 'Tap this any time you spend or receive money.',
          icon: Icons.add_circle_outline,
          targetKey: _fabKey,
          spotlightPadding: 14,
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
    return Scaffold(
      body: CustomScrollView(
        controller: _scrollController,  // Pass to tour for auto-scroll
        slivers: [
          // ... app bar
          SliverList(
            delegate: SliverChildListDelegate([
              KeyedSubtree(
                key: _balanceKey,  // Attach key to target widget
                child: _buildMonthSummaryRow(),
              ),
              _buildBudgetSnapshot(key: _budgetKey),
              _buildRecentTransactions(key: _recentTxKey),
              _buildAIInsights(key: _aiInsightKey),
            ]),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        key: _fabKey,  // Attach key to FAB
        onPressed: () => ...,
        child: Icon(Icons.add),
      ),
    );
  }
}
```

**Key Points:**
1. **GlobalKeys** attached to widgets you want to spotlight
2. **ScrollController** passed to tour for auto-scrolling
3. **Check tour status** on screen init
4. **Mark complete** when tour finishes
5. **Delay before showing** to ensure layout is ready

---

### Example 2: Analytics Tour

```dart
void _showTour() {
  FeatureTour.show(
    context,
    steps: [
      TourStep(
        targetKey: _periodKey,
        title: 'Change Time Period',
        description: 'Tap any chip to switch between 7 days, 30 days, or up to a year.',
        icon: Icons.date_range_outlined,
      ),
      TourStep(
        targetKey: _pieChartKey,
        title: 'Spending by Category',
        description: 'This pie chart shows where your money actually goes.',
        icon: Icons.pie_chart_outline,
        scrollController: _scrollController,
        extraDelayMs: 150,
      ),
      TourStep(
        targetKey: _barChartKey,
        title: 'Income vs Expenses',
        description: 'Each pair of bars is one month — green is income, red is spending.',
        icon: Icons.bar_chart,
        scrollController: _scrollController,
        extraDelayMs: 150,
      ),
      TourStep(
        targetKey: _insightsKey,
        title: 'Quick Insights',
        description: 'Your top spending category, average transaction size, and activity.',
        icon: Icons.lightbulb_outline,
        scrollController: _scrollController,
        extraDelayMs: 150,
      ),
    ],
    onComplete: () async => _tourService.markTourSeen('analytics_v1'),
  );
}
```

---

## Technical Challenges & Solutions

### Challenge 1: Widget Not Ready for Measurement

**Problem:** Widgets may not be laid out when tour starts, causing measurement to fail.

**Solution:** Multi-layered retry strategy
```dart
// 1. Initial delay before starting tour
await Future.delayed(const Duration(milliseconds: 800));

// 2. Wait for frames after scroll
Future<void> _waitFrames(int count) async {
  for (int i = 0; i < count; i++) {
    final c = Completer<void>();
    SchedulerBinding.instance.addPostFrameCallback((_) => c.complete());
    await c.future;
  }
}

// 3. Retry measurement up to 8 times
for (int attempt = 0; attempt < 8; attempt++) {
  rect = _measureRect(step);
  if (rect != null) break;
  await _waitMs(attempt < 3 ? 80 : 200);  // Exponential backoff
}
```

---

### Challenge 2: Tooltip Covering Spotlight

**Problem:** Tooltip card might overlap the spotlighted widget.

**Solution:** Smart positioning algorithm
- Calculate space above and below spotlight
- Prefer below (natural reading flow)
- Fallback to above if needed
- Clamp to safe area boundaries
- Always leave gap between spotlight and card

---

### Challenge 3: Smooth Spotlight Transitions

**Problem:** Spotlight jumping between positions looks jarring.

**Solution:** Animated interpolation
```dart
_animCtrl.addListener(() {
  setState(() {
    _displayRect = Rect.lerp(_animFrom, _animTo, _animCtrl.value);
  });
});
```
- Interpolate between old and new positions
- 350ms duration with easeOut curve
- Smooth, professional transitions

---

### Challenge 4: Spotlighting FAB (Outside Scroll View)

**Problem:** FloatingActionButton is outside the scrollable area.

**Solution:** Conditional scroll controller
```dart
TourStep(
  targetKey: _fabKey,
  scrollController: null,  // No scroll controller for FAB
  extraDelayMs: 200,       // Extra delay for Scaffold to render FAB
)
```

---

### Challenge 5: Tour Showing Too Early

**Problem:** Tour starts before data loads, spotlighting empty widgets.

**Solution:** Delay until providers initialize
```dart
void _initializeProviders() {
  // ... load data
  if (mounted) {
    setState(() => _hasInitialized = true);
    // Only show tour after data is loaded
    await Future.delayed(const Duration(milliseconds: 800));
    if (mounted) _checkAndShowTour();
  }
}
```

---

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Opens Screen                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              TourService.hasSeenTour('screen_v1')           │
│                    Check if tour completed                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                    ┌────┴────┐
                    │         │
              Already Seen   Not Seen
                    │         │
                    │         ▼
                    │    ┌─────────────────────────────────┐
                    │    │  Delay 800ms (layout ready)     │
                    │    └────────────┬────────────────────┘
                    │                 │
                    │                 ▼
                    │    ┌─────────────────────────────────┐
                    │    │  FeatureTour.show()             │
                    │    │  • Create overlay entry         │
                    │    │  • Insert into root overlay     │
                    │    └────────────┬────────────────────┘
                    │                 │
                    │                 ▼
                    │    ┌─────────────────────────────────┐
                    │    │  _TourController.initState()    │
                    │    │  • Setup animation controller   │
                    │    │  • Delay 600ms                  │
                    │    │  • Go to step 0                 │
                    │    └────────────┬────────────────────┘
                    │                 │
                    │                 ▼
                    │    ┌─────────────────────────────────┐
                    │    │  _goToStep(index)               │
                    │    │  1. Auto-scroll if needed       │
                    │    │  2. Wait for scroll animation   │
                    │    │  3. Measure widget position     │
                    │    │  4. Animate spotlight           │
                    │    └────────────┬────────────────────┘
                    │                 │
                    │                 ▼
                    │    ┌─────────────────────────────────┐
                    │    │  _TourOverlay.build()           │
                    │    │  • Dark overlay                 │
                    │    │  • Spotlight cutout             │
                    │    │  • Tooltip card                 │
                    │    │  • Skip button                  │
                    │    └────────────┬────────────────────┘
                    │                 │
                    │            ┌────┴────┐
                    │            │         │
                    │        User Taps  User Taps
                    │         Next       Skip
                    │            │         │
                    │            ▼         │
                    │    ┌─────────────────┴───────────────┐
                    │    │  More steps?                    │
                    │    └────────────┬────────────────────┘
                    │                 │
                    │            ┌────┴────┐
                    │            │         │
                    │          Yes        No
                    │            │         │
                    │            │         ▼
                    │            │    ┌─────────────────────┐
                    │            │    │  onComplete()       │
                    │            │    │  • Mark tour seen   │
                    │            │    │  • Remove overlay   │
                    │            │    └─────────────────────┘
                    │            │
                    │            └──────┐
                    │                   │
                    │                   ▼
                    │         Go to next step (loop)
                    │
                    ▼
            Skip tour (no overlay)
```

---

## Demo Talking Points

### For Viva Defense

**"How does the feature tour work?"**

> "The feature tour uses Flutter's GlobalKey system to precisely locate UI widgets on screen. When a user first opens a screen, we check SharedPreferences to see if they've completed the tour. If not, we create a root overlay that renders above all content.
>
> The tour controller measures each target widget's position using RenderBox coordinates, then draws a dark overlay with a spotlight cutout using CustomPaint and PathFillType.evenOdd. A tooltip card is intelligently positioned above or below the spotlight to avoid covering it.
>
> For off-screen widgets, we use Flutter's Scrollable.ensureVisible() to auto-scroll them into view before spotlighting. The spotlight animates smoothly between steps using Rect.lerp interpolation over 350ms.
>
> Once the user completes the tour, we persist that state so they don't see it again. This creates a seamless onboarding experience that guides users through complex features without overwhelming them."

**"Why use GlobalKeys instead of coordinates?"**

> "GlobalKeys give us precise, dynamic widget positions that update automatically when the layout changes. If we used hardcoded coordinates, the tour would break on different screen sizes or when the UI updates. GlobalKeys also let us verify the widget exists before trying to spotlight it, preventing crashes."

**"How do you handle widgets that aren't visible yet?"**

> "We use a multi-layered retry strategy. First, we delay the tour start by 800ms to let the initial layout complete. Then, for each step, we retry measurement up to 8 times with exponential backoff. If a widget needs scrolling, we use Scrollable.ensureVisible() and wait for the scroll animation to finish before measuring. This handles async data loading, complex layouts, and animation delays."

**"What makes the spotlight glow?"**

> "The glow effect uses a two-layer border technique in the CustomPainter. The outer layer has a MaskFilter.blur with a 5px radius and semi-transparent white, creating the soft glow. The inner layer is a crisp 1.5px stroke with higher opacity for a sharp edge. Combined with the rounded rectangle cutout, this creates a professional, attention-grabbing spotlight."

---

## Files Reference

### Core Implementation
- **`lib/widgets/feature_tour_overlay.dart`** - Main tour system (TourStep, FeatureTour, _TourController, _TourOverlay, _SpotlightPainter)
- **`lib/services/tour_service.dart`** - Persistence layer (SharedPreferences)

### Usage Examples
- **`lib/screens/dashboard_screen.dart`** - 5-step tour (balance, budgets, transactions, AI insights, FAB)
- **`lib/screens/analytics_screen.dart`** - 4-step tour (period selector, pie chart, bar chart, insights)
- **`lib/screens/financial_forecast_screen.dart`** - Tour implementation (not shown in current code)

---

## Key Metrics

- **Lines of Code**: ~450 lines (feature_tour_overlay.dart)
- **Animation Duration**: 350ms (spotlight transitions)
- **Measurement Retries**: Up to 8 attempts with exponential backoff
- **Scroll Delay**: 650ms after auto-scroll
- **Initial Delay**: 600-800ms before tour starts
- **Spotlight Padding**: 12-14px around target widget
- **Overlay Opacity**: 75% black
- **Glow Blur Radius**: 5px

---

## Conclusion

The Feature Tour Overlay is a sophisticated onboarding system that combines:
- **Precise widget targeting** via GlobalKeys
- **Smooth animations** via AnimationController
- **Smart positioning** via geometric calculations
- **Auto-scrolling** via Scrollable.ensureVisible
- **Custom rendering** via CustomPainter
- **State persistence** via SharedPreferences

This creates a professional, user-friendly tutorial experience that guides users through complex features without overwhelming them. The system is reusable across all screens and handles edge cases like off-screen widgets, layout delays, and different screen sizes.
