# Feature Tour Overlay - Visual Diagrams

## 1. Screen Layout with Tour Active

```
┌─────────────────────────────────────────────────────────────┐
│                     📱 Phone Screen                          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Status Bar (20:15, WiFi, Battery)          [Skip]│    │
│  ├────────────────────────────────────────────────────┤    │
│  │                                                     │    │
│  │  ████████████████████████████████████████████████  │    │
│  │  ████████████████████████████████████████████████  │    │
│  │  ████  Dark Overlay (75% black opacity)  ████████  │    │
│  │  ████████████████████████████████████████████████  │    │
│  │  ████████████████████████████████████████████████  │    │
│  │  ████████████████████████████████████████████████  │    │
│  │  ████                                        ████  │    │
│  │  ████  ┌──────────────────────────────┐    ████  │    │
│  │  ████  │  ✨ Spotlighted Widget      │    ████  │    │
│  │  ████  │  (Glowing white border)      │    ████  │    │
│  │  ████  │  • Clear, fully visible      │    ████  │    │
│  │  ████  │  • Rounded corners (14px)    │    ████  │    │
│  │  ████  └──────────────────────────────┘    ████  │    │
│  │  ████                                        ████  │    │
│  │  ████████████████████████████████████████████████  │    │
│  │  ████                                        ████  │    │
│  │  ████  ┌──────────────────────────────┐    ████  │    │
│  │  ████  │  💬 Tooltip Card             │    ████  │    │
│  │  ████  │  ┌─┬─┬─┬─┬─┐ Progress dots   │    ████  │    │
│  │  ████  │  ●─○─○─○─○  (1/5)            │    ████  │    │
│  │  ████  │                               │    ████  │    │
│  │  ████  │  📊 Budget Tracker            │    ████  │    │
│  │  ████  │                               │    ████  │    │
│  │  ████  │  These are the budgets set   │    ████  │    │
│  │  ████  │  up during onboarding. The   │    ████  │    │
│  │  ████  │  bar shows how much you've   │    ████  │    │
│  │  ████  │  used this month.             │    ████  │    │
│  │  ████  │                               │    ████  │    │
│  │  ████  │  [ Next → ]                   │    ████  │    │
│  │  ████  └──────────────────────────────┘    ████  │    │
│  │  ████                                        ████  │    │
│  │  ████████████████████████████████████████████████  │    │
│  │  ████████████████████████████████████████████████  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Spotlight Rendering Technique

### PathFillType.evenOdd Magic

```
Step 1: Draw full screen rectangle
┌─────────────────────────────────────┐
│█████████████████████████████████████│
│█████████████████████████████████████│
│█████████████████████████████████████│
│█████████████████████████████████████│
│█████████████████████████████████████│
│█████████████████████████████████████│
│█████████████████████████████████████│
└─────────────────────────────────────┘

Step 2: Add spotlight rectangle
┌─────────────────────────────────────┐
│█████████████████████████████████████│
│█████████████████████████████████████│
│█████████┌───────────┐███████████████│
│█████████│           │███████████████│
│█████████│  Spotlight│███████████████│
│█████████│           │███████████████│
│█████████└───────────┘███████████████│
│█████████████████████████████████████│
└─────────────────────────────────────┘

Step 3: Apply PathFillType.evenOdd
(Overlapping areas become transparent)
┌─────────────────────────────────────┐
│█████████████████████████████████████│
│█████████████████████████████████████│
│█████████┌───────────┐███████████████│
│█████████│           │███████████████│  ← Cutout!
│█████████│  CLEAR    │███████████████│
│█████████│           │███████████████│
│█████████└───────────┘███████████████│
│█████████████████████████████████████│
└─────────────────────────────────────┘

Step 4: Add glowing border
┌─────────────────────────────────────┐
│█████████████████████████████████████│
│█████████████████████████████████████│
│█████████╔═══════════╗███████████████│  ← Glow layer
│█████████║           ║███████████████│
│█████████║  CLEAR    ║███████████████│
│█████████║           ║███████████████│
│█████████╚═══════════╝███████████████│
│█████████████████████████████████████│
└─────────────────────────────────────┘
```

---

## 3. Tooltip Card Positioning Logic

### Scenario A: Spotlight at Top (Card Below)

```
┌─────────────────────────────────────┐
│  Status Bar                          │
├─────────────────────────────────────┤
│  ████████████████████████████████   │
│  ████████████████████████████████   │
│  ████  ┌──────────────┐  ████████   │
│  ████  │  Spotlight   │  ████████   │  ← Target widget
│  ████  └──────────────┘  ████████   │
│  ████         ↓ gap (16px)          │
│  ████  ┌──────────────┐  ████████   │
│  ████  │  Tooltip     │  ████████   │  ← Card positioned below
│  ████  │  Card        │  ████████   │
│  ████  └──────────────┘  ████████   │
│  ████████████████████████████████   │
│  ████████████████████████████████   │
└─────────────────────────────────────┘
```

### Scenario B: Spotlight at Bottom (Card Above)

```
┌─────────────────────────────────────┐
│  ████████████████████████████████   │
│  ████████████████████████████████   │
│  ████  ┌──────────────┐  ████████   │
│  ████  │  Tooltip     │  ████████   │  ← Card positioned above
│  ████  │  Card        │  ████████   │
│  ████  └──────────────┘  ████████   │
│  ████         ↓ gap (16px)          │
│  ████  ┌──────────────┐  ████████   │
│  ████  │  Spotlight   │  ████████   │  ← Target widget
│  ████  └──────────────┘  ████████   │
│  ████████████████████████████████   │
│  ████████████████████████████████   │
└─────────────────────────────────────┘
```

### Scenario C: Spotlight in Middle (Prefer Below)

```
┌─────────────────────────────────────┐
│  ████████████████████████████████   │
│  ████████████████████████████████   │
│  ████████████████████████████████   │
│  ████  ┌──────────────┐  ████████   │
│  ████  │  Spotlight   │  ████████   │  ← Target widget
│  ████  └──────────────┘  ████████   │
│  ████         ↓ gap (16px)          │
│  ████  ┌──────────────┐  ████████   │
│  ████  │  Tooltip     │  ████████   │  ← Card below (preferred)
│  ████  │  Card        │  ████████   │
│  ████  └──────────────┘  ████████   │
│  ████████████████████████████████   │
└─────────────────────────────────────┘
```

---

## 4. Auto-Scroll Behavior

### Before Scroll (Target Off-Screen)

```
┌─────────────────────────────────────┐
│  Visible Area                        │
│  ┌────────────────────────────────┐ │
│  │  Widget A (visible)            │ │
│  │  Widget B (visible)            │ │
│  │  Widget C (visible)            │ │
│  └────────────────────────────────┘ │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  Below fold (not visible)            │
│  ┌────────────────────────────────┐ │
│  │  Widget D (TARGET) ⭐          │ │  ← Need to scroll here
│  │  Widget E                      │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### During Scroll (Animated)

```
┌─────────────────────────────────────┐
│  Visible Area                        │
│  ┌────────────────────────────────┐ │
│  │  Widget B (scrolling up)       │ │  ↑
│  │  Widget C (scrolling up)       │ │  ↑
│  │  Widget D (TARGET) ⭐          │ │  ↑ Scrolling
│  └────────────────────────────────┘ │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  Below fold                          │
│  ┌────────────────────────────────┐ │
│  │  Widget E                      │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### After Scroll (Target Visible at 15% from Top)

```
┌─────────────────────────────────────┐
│  Visible Area                        │
│  ┌────────────────────────────────┐ │
│  │  ← 15% from top                │ │
│  │  ┌──────────────────────────┐ │ │
│  │  │  Widget D (TARGET) ⭐    │ │ │  ← Now visible!
│  │  └──────────────────────────┘ │ │
│  │  Widget E                      │ │
│  │  Widget F                      │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 5. Spotlight Animation Between Steps

### Step 1 → Step 2 Transition

```
Frame 1 (t=0ms):
┌─────────────────────────────────────┐
│  ████████████████████████████████   │
│  ████  ┌──────────┐  ████████████   │
│  ████  │ Step 1   │  ████████████   │  ← Current spotlight
│  ████  └──────────┘  ████████████   │
│  ████████████████████████████████   │
│  ████████████████████████████████   │
│  ████████████████████████████████   │
│  ████████████████████████████████   │
└─────────────────────────────────────┘

Frame 2 (t=100ms):
┌─────────────────────────────────────┐
│  ████████████████████████████████   │
│  ████  ┌──────────┐  ████████████   │
│  ████  │ Step 1   │  ████████████   │  ← Fading out
│  ████  └──────────┘  ████████████   │
│  ████████████████████████████████   │
│  ████  ┌──────────┐  ████████████   │
│  ████  │ Step 2   │  ████████████   │  ← Fading in
│  ████  └──────────┘  ████████████   │
└─────────────────────────────────────┘

Frame 3 (t=200ms):
┌─────────────────────────────────────┐
│  ████████████████████████████████   │
│  ████████████████████████████████   │
│  ████████████████████████████████   │
│  ████████████████████████████████   │
│  ████████████████████████████████   │
│  ████  ┌──────────┐  ████████████   │
│  ████  │ Step 2   │  ████████████   │  ← Interpolating
│  ████  └──────────┘  ████████████   │
└─────────────────────────────────────┘

Frame 4 (t=350ms):
┌─────────────────────────────────────┐
│  ████████████████████████████████   │
│  ████████████████████████████████   │
│  ████████████████████████████████   │
│  ████████████████████████████████   │
│  ████████████████████████████████   │
│  ████  ┌──────────┐  ████████████   │
│  ████  │ Step 2   │  ████████████   │  ← New spotlight
│  ████  └──────────┘  ████████████   │
└─────────────────────────────────────┘
```

**Animation Details:**
- Duration: 350ms
- Curve: Curves.easeOut
- Method: Rect.lerp() interpolation
- Smooth, professional transition

---

## 6. Tooltip Card Anatomy

```
┌─────────────────────────────────────────────────┐
│  ┌─┬─┬─┬─┬─┐                            3/5    │  ← Progress + Counter
│  ●─●─●─○─○                                     │
│                                                 │
│  ┌───┐                                          │
│  │ 📊│  Budget Tracker                         │  ← Icon + Title
│  └───┘                                          │
│                                                 │
│  These are the budgets set up during           │  ← Description
│  onboarding. The bar shows how much of         │
│  each budget you've used this month.           │
│  Red = overspent.                              │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │          Next  →                         │  │  ← Action Button
│  └─────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Card Features:**
- **White background** with shadow
- **Rounded corners** (20px radius)
- **Padding**: 20px all around
- **Progress dots**: Animated width (8px → 22px for current)
- **Icon badge**: Colored background matching theme
- **Button**: Full-width, changes to "Let's go 🚀" on last step

---

## 7. Dashboard Tour Flow

```
Step 1: Income & Spending
┌─────────────────────────────────────┐
│  ┌──────────────────────────────┐  │
│  │  Income        Spent          │  │  ← Spotlighted
│  │  GHS 1000      GHS 700        │  │
│  └──────────────────────────────┘  │
│  ████████████████████████████████  │
│  ████████████████████████████████  │
└─────────────────────────────────────┘

Step 2: Budget Tracker (Auto-scroll)
┌─────────────────────────────────────┐
│  ████████████████████████████████  │
│  ┌──────────────────────────────┐  │
│  │  Budgets                      │  │  ← Spotlighted
│  │  Food: ████████░░ 80%         │  │
│  │  Transport: ████░░░░ 40%      │  │
│  └──────────────────────────────┘  │
│  ████████████████████████████████  │
└─────────────────────────────────────┘

Step 3: Recent Transactions (Auto-scroll)
┌─────────────────────────────────────┐
│  ████████████████████████████████  │
│  ┌──────────────────────────────┐  │
│  │  Recent Transactions          │  │  ← Spotlighted
│  │  🍔 Lunch      -GHS 15        │  │
│  │  🚌 Bus fare   -GHS 5         │  │
│  └──────────────────────────────┘  │
│  ████████████████████████████████  │
└─────────────────────────────────────┘

Step 4: AI Insights (Auto-scroll)
┌─────────────────────────────────────┐
│  ████████████████████████████████  │
│  ┌──────────────────────────────┐  │
│  │  ✨ AI Insights               │  │  ← Spotlighted
│  │  Your food spending is 20%    │  │
│  │  higher than similar users    │  │
│  └──────────────────────────────┘  │
│  ████████████████████████████████  │
└─────────────────────────────────────┘

Step 5: Add Transaction FAB
┌─────────────────────────────────────┐
│  ████████████████████████████████  │
│  ████████████████████████████████  │
│  ████████████████████████████████  │
│  ████████████████████████████████  │
│  ████████████████████████████████  │
│  ████████████████████████  ┌───┐  │
│  ████████████████████████  │ + │  │  ← Spotlighted FAB
│  ████████████████████████  └───┘  │
└─────────────────────────────────────┘
```

---

## 8. GlobalKey Attachment Pattern

### Code Structure

```dart
class _DashboardScreenState extends State<DashboardScreen> {
  // 1. Declare GlobalKeys
  final _balanceKey = GlobalKey();
  final _budgetKey = GlobalKey();
  final _recentTxKey = GlobalKey();
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverList(
            delegate: SliverChildListDelegate([
              // 2. Attach keys to widgets
              KeyedSubtree(
                key: _balanceKey,  // ← Attach here
                child: _buildMonthSummaryRow(),
              ),
              _buildBudgetSnapshot(key: _budgetKey),  // ← Or here
              _buildRecentTransactions(key: _recentTxKey),
            ]),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        key: _fabKey,  // ← Or directly on widget
        onPressed: () => ...,
      ),
    );
  }
  
  void _showTour() {
    FeatureTour.show(
      context,
      steps: [
        TourStep(
          targetKey: _balanceKey,  // ← Reference in tour
          title: 'Income & Spending',
          description: '...',
          icon: Icons.account_balance_wallet_outlined,
        ),
        // ... more steps
      ],
      onComplete: () => ...,
    );
  }
}
```

### Visual Mapping

```
Widget Tree                    GlobalKey Mapping
─────────────                  ─────────────────
Scaffold                       
  └─ CustomScrollView          
      └─ SliverList            
          ├─ KeyedSubtree ──────────▶ _balanceKey
          │   └─ MonthSummary        
          ├─ BudgetSnapshot ─────────▶ _budgetKey
          ├─ RecentTx ───────────────▶ _recentTxKey
          └─ AIInsights ─────────────▶ _aiInsightKey
  └─ FAB ────────────────────────────▶ _fabKey
```

---

## 9. Measurement Retry Strategy

```
Attempt 1 (0ms):
┌─────────────────────────────────────┐
│  Widget not ready yet...             │
│  RenderBox = null                    │
└─────────────────────────────────────┘
         ↓ Wait 80ms

Attempt 2 (80ms):
┌─────────────────────────────────────┐
│  Widget still not ready...           │
│  RenderBox exists but hasSize=false │
└─────────────────────────────────────┘
         ↓ Wait 80ms

Attempt 3 (160ms):
┌─────────────────────────────────────┐
│  Widget still not ready...           │
│  Size = (0, 0)                       │
└─────────────────────────────────────┘
         ↓ Wait 80ms

Attempt 4 (240ms):
┌─────────────────────────────────────┐
│  Widget ready! ✓                     │
│  Position: (50, 200)                 │
│  Size: (300, 80)                     │
│  → Spotlight can be drawn            │
└─────────────────────────────────────┘
```

**Retry Logic:**
- Attempts 1-3: Wait 80ms between retries
- Attempts 4-8: Wait 200ms between retries (exponential backoff)
- Max 8 attempts before giving up
- Handles async data loading, animations, complex layouts

---

## 10. Tour Persistence Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    SharedPreferences                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Key: "tour_seen_dashboard_v1"    Value: false         │ │
│  │  Key: "tour_seen_analytics_v1"    Value: false         │ │
│  │  Key: "tour_seen_forecast_v1"     Value: false         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │  User opens Dashboard         │
         └───────────────┬───────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │  hasSeenTour('dashboard_v1')? │
         └───────────────┬───────────────┘
                         │
                    ┌────┴────┐
                    │         │
                  false      true
                    │         │
                    │         └──▶ Skip tour
                    │
                    ▼
         ┌───────────────────────────────┐
         │  Show tour                    │
         └───────────────┬───────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │  User completes tour          │
         └───────────────┬───────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │  markTourSeen('dashboard_v1') │
         └───────────────┬───────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    SharedPreferences                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Key: "tour_seen_dashboard_v1"    Value: true ✓        │ │
│  │  Key: "tour_seen_analytics_v1"    Value: false         │ │
│  │  Key: "tour_seen_forecast_v1"     Value: false         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Complete Tour Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Tour Lifecycle                            │
└─────────────────────────────────────────────────────────────┘

1. Screen Init
   └─▶ WidgetsBinding.instance.addPostFrameCallback(...)
       └─▶ _checkAndShowTour()

2. Check Tour Status
   └─▶ TourService.hasSeenTour('screen_v1')
       ├─▶ true  → Skip tour
       └─▶ false → Continue

3. Delay for Layout
   └─▶ await Future.delayed(Duration(milliseconds: 800))

4. Show Tour
   └─▶ FeatureTour.show(context, steps: [...], onComplete: ...)
       └─▶ Create OverlayEntry
           └─▶ Insert into root overlay

5. Tour Controller Init
   └─▶ _TourControllerState.initState()
       ├─▶ Setup AnimationController
       ├─▶ Delay 600ms
       └─▶ _goToStep(0, isFirst: true)

6. For Each Step
   └─▶ _goToStep(index)
       ├─▶ Auto-scroll if needed
       ├─▶ Wait for scroll animation
       ├─▶ Measure widget position (with retries)
       └─▶ Animate spotlight to position

7. User Interaction
   ├─▶ Tap Next → _next()
   │   ├─▶ More steps? → _goToStep(index + 1)
   │   └─▶ Last step? → onComplete()
   └─▶ Tap Skip → _skip()
       └─▶ onComplete()

8. Tour Complete
   └─▶ onComplete()
       ├─▶ TourService.markTourSeen('screen_v1')
       ├─▶ _animCtrl.reverse()
       └─▶ Remove overlay entry

9. Next Visit
   └─▶ hasSeenTour('screen_v1') returns true
       └─▶ Tour skipped automatically
```

---

## Summary

The Feature Tour Overlay system creates a professional onboarding experience through:

1. **Precise targeting** via GlobalKeys
2. **Smart positioning** via geometric calculations
3. **Smooth animations** via AnimationController
4. **Auto-scrolling** via Scrollable.ensureVisible
5. **Custom rendering** via CustomPainter
6. **State persistence** via SharedPreferences

This creates an intuitive, non-intrusive tutorial that guides users through complex features without overwhelming them.
