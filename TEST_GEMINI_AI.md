# 🧪 Testing Gemini AI Integration

## Quick Test (5 Minutes)

### Step 1: Deploy Functions
```bash
test_gemini_ai.bat
```

This will:
- Build TypeScript
- Deploy AI functions to Firebase
- Take 2-3 minutes

### Step 2: Test in Flutter App

**Option A: Use Test Screen (Easiest)**

1. Add test screen to your app:
```dart
// In your main.dart or routes
import 'widgets/test_gemini_ai_button.dart';

// Add route
'/test-ai': (context) => TestGeminiAIScreen(),
```

2. Navigate to test screen:
```dart
Navigator.pushNamed(context, '/test-ai');
```

3. Tap "Test Gemini AI" button

4. See results! ✅

**Option B: Test Directly in Code**

```dart
import 'package:cloud_functions/cloud_functions.dart';

Future<void> testGeminiAI() async {
  try {
    final callable = FirebaseFunctions.instance
        .httpsCallable('testGeminiAI');
    
    final result = await callable.call();
    final data = result.data as Map<String, dynamic>;
    
    if (data['success']) {
      print('✅ AI Working!');
      print('Anomaly Test: ${data['tests']['anomalyExplanation']['response']}');
      print('Insight Test: ${data['tests']['financialInsight']['response']}');
      print('Goal Test: ${data['tests']['goalAdvice']['response']}');
    } else {
      print('❌ AI Failed: ${data['error']}');
    }
  } catch (e) {
    print('Error: $e');
  }
}
```

---

## What You'll See

### ✅ Success Response

```
✅ All AI Tests Passed!

🔍 Anomaly Explanation Test:
"Whoa! That GHS 500 shopping expense is 3.3x your usual GHS 150! 
With only GHS 180 left in your budget and GHS 800 monthly income, 
this is a significant hit. If this was a one-time thing (maybe new 
semester supplies?), you're okay. But if you're planning more shopping, 
pause and review your goals..."

💡 Financial Insight Test:
"Hey! You're spending GHS 450 on food this month - that's 56% of your 
GHS 800 income! Most of it seems to be from restaurants (30 transactions). 
Try cooking at home 3-4 times a week and you could save GHS 150/month..."

🎯 Goal Advice Test:
"Let's talk about your GHS 2000 laptop goal! You currently have GHS 500 
saved. With GHS 800 income and GHS 650 expenses, you have GHS 150/month 
to save. At this rate, you'll hit your goal in 10 months..."

API Key: Configured ✅
Model: gemini-pro
```

### ❌ Error Response

```
❌ AI Test Failed

Error: Gemini API key not configured

Troubleshooting:
- Check functions/.runtimeconfig.json
- Check https://console.cloud.google.com/
- Run: firebase functions:log
```

---

## Testing Real Anomaly Detection

Once the test passes, test with real data:

### 1. Test Anomaly Explanation

```dart
Future<void> testRealAnomaly() async {
  final callable = FirebaseFunctions.instance
      .httpsCallable('explainAnomaly');
  
  final result = await callable.call({
    'userId': 'your-real-user-id',
    'transactionId': 'test-tx-123',
    'amount': 500.0,
    'category': 'Shopping',
    'anomalyScore': 0.85,
    'averageAmount': 150.0,
  });
  
  final explanation = result.data['explanation'];
  final suggestions = result.data['suggestions'];
  final severity = result.data['severity'];
  
  print('Explanation: $explanation');
  print('Suggestions: $suggestions');
  print('Severity: $severity');
}
```

### 2. Test Spending Analysis

```dart
Future<void> testSpendingAnalysis() async {
  final callable = FirebaseFunctions.instance
      .httpsCallable('analyzeSpendingPatterns');
  
  final result = await callable.call({
    'userId': 'your-real-user-id',
    'period': 'monthly',
    'useAI': true, // Enable AI!
  });
  
  final insights = result.data['insights'] as List;
  
  for (var insight in insights) {
    print('${insight['title']}: ${insight['message']}');
  }
}
```

---

## Integration with Isolation Forest

Here's how to integrate AI explanations with your ML anomaly detection:

```dart
// In your overspending detection service
Future<void> handleAnomalyDetection(
  Transaction transaction,
  double anomalyScore,
  double averageAmount,
) async {
  if (anomalyScore > 0.7) {
    // Anomaly detected by Isolation Forest!
    
    // Get AI explanation
    final callable = FirebaseFunctions.instance
        .httpsCallable('explainAnomaly');
    
    try {
      final result = await callable.call({
        'userId': transaction.userId,
        'transactionId': transaction.id,
        'amount': transaction.amount,
        'category': transaction.category,
        'anomalyScore': anomalyScore,
        'averageAmount': averageAmount,
      });
      
      // Show AI explanation to user
      final explanation = result.data['explanation'];
      final suggestions = result.data['suggestions'] as List;
      
      _showAnomalyAlert(
        transaction: transaction,
        explanation: explanation,
        suggestions: suggestions.cast<String>(),
      );
    } catch (e) {
      // Fallback to simple alert if AI fails
      _showSimpleAnomalyAlert(transaction, anomalyScore);
    }
  }
}

void _showAnomalyAlert({
  required Transaction transaction,
  required String explanation,
  required List<String> suggestions,
}) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: Row(
        children: [
          Icon(Icons.warning, color: Colors.orange),
          SizedBox(width: 8),
          Text('Unusual Spending Detected'),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(explanation),
          SizedBox(height: 16),
          Text(
            'Suggestions:',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          ...suggestions.map((s) => Padding(
            padding: EdgeInsets.only(top: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('• '),
                Expanded(child: Text(s)),
              ],
            ),
          )),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('Got it'),
        ),
      ],
    ),
  );
}
```

---

## Monitoring AI Usage

### Check Function Logs
```bash
# Real-time logs
firebase functions:log --only testGeminiAI

# Last hour
firebase functions:log --since 1h
```

### Check API Usage
1. Go to: https://console.cloud.google.com/
2. Navigate to: APIs & Services → Generative Language API
3. View usage metrics

### Expected Usage
- Test function: 3 API calls per test
- Real usage: 1 API call per anomaly explanation
- Free tier: 1,500 calls/day

---

## Troubleshooting

### Issue: "API key not configured"
**Solution:**
```bash
# Check if config file exists
dir functions\.runtimeconfig.json

# If missing, it should contain:
{
  "gemini": {
    "api_key": "AIzaSyANzvo3AlXnri6bp555GBUWLE4bxXAmN3E"
  }
}
```

### Issue: "Rate limit exceeded"
**Solution:**
- You've used more than 1,500 requests today
- Wait until tomorrow (resets at midnight UTC)
- Or upgrade to paid tier

### Issue: "Function not found"
**Solution:**
```bash
# Redeploy functions
firebase deploy --only functions
```

### Issue: "Invalid API key"
**Solution:**
1. Go to: https://makersuite.google.com/app/apikey
2. Verify your key is active
3. Update functions/.runtimeconfig.json
4. Redeploy

---

## Success Criteria

Your AI is working correctly when:

✅ Test function returns success
✅ All 3 tests pass (anomaly, insight, goal)
✅ Responses are personalized and relevant
✅ Response time is under 3 seconds
✅ No API errors in logs

---

## Next Steps

1. **Deploy:** Run `test_gemini_ai.bat`
2. **Test:** Use test screen or call function directly
3. **Integrate:** Add AI explanations to your anomaly detection
4. **Monitor:** Check usage and costs
5. **Iterate:** Adjust AI prompts if needed

---

## Quick Commands

```bash
# Deploy and test
test_gemini_ai.bat

# View logs
firebase functions:log

# Check config
firebase functions:config:get

# Redeploy specific function
firebase deploy --only functions:testGeminiAI
```

---

**Ready to test? Run `test_gemini_ai.bat` now!** 🚀
