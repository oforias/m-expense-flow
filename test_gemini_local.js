// Test Gemini AI locally using Firebase callable function
const axios = require('axios');

async function testGemini() {
  try {
    console.log('Testing Gemini AI integration...\n');
    
    const response = await axios.post(
      'http://127.0.0.1:5001/expense-flow-2e9f7/us-central1/testGeminiAI',
      {
        data: {} // Callable functions expect data in this format
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const result = response.data.result;
    
    if (result.success) {
      console.log('✅ SUCCESS! Gemini AI is working!\n');
      console.log('📊 Test Results:');
      console.log('================\n');
      
      console.log('1️⃣ Anomaly Explanation Test:');
      console.log(result.tests.anomalyExplanation.response);
      console.log(`   Length: ${result.tests.anomalyExplanation.length} characters\n`);
      
      console.log('2️⃣ Financial Insight Test:');
      console.log(result.tests.financialInsight.response);
      console.log(`   Length: ${result.tests.financialInsight.length} characters\n`);
      
      console.log('3️⃣ Goal Advice Test:');
      console.log(result.tests.goalAdvice.response);
      console.log(`   Length: ${result.tests.goalAdvice.length} characters\n`);
      
      console.log('🎉 All tests passed!');
      console.log(`Model: ${result.model}`);
      console.log(`API Key: ${result.apiKey}`);
    } else {
      console.log('❌ FAILED:', result.error);
      console.log('\n🔧 Troubleshooting:');
      if (result.troubleshooting) {
        Object.entries(result.troubleshooting).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Error calling function:', error.response?.data || error.message);
  }
}

testGemini();
