# 🚀 Test Gemini AI - Quick Start

Your Gemini AI is configured and ready to test! The emulator is already running.

## ✅ Current Status

- ✅ Firebase emulator running on port 5001
- ✅ API Key configured: `AIzaSyANzvo3AlXnri6bp555GBUWLE4bxXAmN3E`
- ✅ Model: `gemini-pro`
- ✅ Functions loaded: `explainAnomaly`, `testGeminiAI`

## 🧪 Test Methods

### Method 1: HTML Test Page (Easiest)

1. **Run the batch file:**
   ```bash
   test_gemini_ai.bat
   ```

2. **Or open directly:**
   - Double-click `test_gemini_local.html`
   - Click "Run AI Test" button
   - Wait 10-15 seconds for results

### Method 2: Node.js Script

```bash
node test_gemini.js
```

For anomaly test only:
```bash
node test_gemini.js --anomaly
```

### Method 3: Direct API Call (curl)

```bash
curl -X POST http://127.0.0.1:5001/expense-flow-2e9f7/us-central1/testGeminiAI ^
  -H "Content-Type: application/json" ^
  -d "{\"data\":{}}"
```

## 📊 What Gets Tested

The test will verify 3 AI capabilities:

1. **Anomaly Explanation** - AI explains unusual spending
   - Example: "You spent GHS 500 on Shopping (usually GHS 150)"
   - AI provides personalized advice

2. **Financial Insights** - AI analyzes spending patterns
   - Reviews monthly spending across categories
   - Identifies budget overruns
   - Suggests improvements

3. **Goal Advice** - AI helps with savings goals
   - Calculates realistic savings plans
   - Provides actionable steps
   - Encourages progress

## ✅ Expected Results

If everything works, you'll see:

```
✅ All AI tests passed! 🎉

📊 Test Results:

1️⃣ Anomaly Explanation:
   [AI-generated explanation about the unusual spending]

2️⃣ Financial Insight:
   [AI-generated analysis of spending patterns]

3️⃣ Goal Advice:
   [AI-generated advice for achieving savings goals]

🔑 API Key: Configured ✅
🤖 Model: gemini-pro
```

## ❌ Troubleshooting

### Error: "Gemini API key not configured"
- Check `functions/.runtimeconfig.json` exists
- Verify API key is present

### Error: "Rate limit exceeded"
- Gemini free tier: 15 requests/minute
- Wait 1 minute and try again

### Error: "Invalid API key"
- Verify key at: https://makersuite.google.com/app/apikey
- Update in `functions/.runtimeconfig.json`

### Error: "Cannot connect to emulator"
- Ensure emulator is running: `firebase emulators:start --only functions`
- Check port 5001 is not blocked

## 🎯 Next Steps After Testing

Once tests pass:

1. **Integrate with Isolation Forest**
   - Anomaly detection → AI explanation
   - Smart + Human-like advice

2. **Deploy to Production**
   - Upgrade to Blaze plan (still FREE for your usage)
   - Run: `firebase deploy --only functions`

3. **Add to Flutter App**
   - Call `explainAnomaly` when anomalies detected
   - Display AI insights in UI

## 💰 Cost Reminder

**FREE Tier (Current):**
- 1,500 requests/day
- 15 requests/minute
- Your usage: ~500 requests/day
- **Cost: $0/month** ✅

## 📝 Test Data

The test uses realistic student data:
- Monthly income: GHS 800
- Spending: Food (GHS 450), Transport (GHS 200)
- Budget overrun: Food budget exceeded
- Savings goal: Laptop (GHS 2000)

This mirrors real usage patterns!

## 🚀 Ready to Test?

Run this now:
```bash
test_gemini_ai.bat
```

Or open `test_gemini_local.html` in your browser!
