/**
 * Test Gemini AI Integration
 * Run this with: node test_gemini.js
 */

const https = require('https');

const EMULATOR_URL = 'http://127.0.0.1:5001/expense-flow-2e9f7/us-central1';

async function testGemini() {
    console.log('🤖 Testing Gemini AI Integration...\n');
    
    try {
        const result = await callFunction('testGeminiAI', {});
        
        if (result.success) {
            console.log('✅', result.message);
            console.log('\n📊 Test Results:\n');
            
            if (result.tests.anomalyExplanation) {
                console.log('1️⃣  Anomaly Explanation:');
                console.log('   ', result.tests.anomalyExplanation.response);
                console.log('    Length:', result.tests.anomalyExplanation.length, 'chars\n');
            }
            
            if (result.tests.financialInsight) {
                console.log('2️⃣  Financial Insight:');
                console.log('   ', result.tests.financialInsight.response);
                console.log('    Length:', result.tests.financialInsight.length, 'chars\n');
            }
            
            if (result.tests.goalAdvice) {
                console.log('3️⃣  Goal Advice:');
                console.log('   ', result.tests.goalAdvice.response);
                console.log('    Length:', result.tests.goalAdvice.length, 'chars\n');
            }
            
            console.log('🔑 API Key:', result.apiKey);
            console.log('🤖 Model:', result.model);
        } else {
            console.error('❌ Test Failed');
            console.error('Error:', result.error);
            
            if (result.troubleshooting) {
                console.log('\n🔧 Troubleshooting:');
                for (const [key, value] of Object.entries(result.troubleshooting)) {
                    console.log(`   ${key}: ${value}`);
                }
            }
            
            if (result.details) {
                console.log('\n📝 Details:');
                console.log(result.details);
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n💡 Make sure:');
        console.log('   1. Firebase emulator is running: firebase emulators:start --only functions');
        console.log('   2. API key is configured in functions/.runtimeconfig.json');
    }
}

async function testAnomalyExplanation() {
    console.log('🔍 Testing Anomaly Explanation...\n');
    
    try {
        const result = await callFunction('explainAnomaly', {
            userId: 'test-user',
            transactionId: 'test-transaction',
            amount: 500,
            category: 'Shopping',
            averageAmount: 150,
            anomalyScore: 0.85
        });
        
        if (result.success) {
            console.log('✅ Anomaly Explanation:\n');
            console.log(result.explanation);
            console.log('\n💡 Suggestions:');
            result.suggestions.forEach((s, i) => {
                console.log(`   ${i + 1}. ${s}`);
            });
            console.log('\n📊 Details:');
            console.log('   Amount: GHS', result.amount);
            console.log('   Category:', result.category);
            console.log('   Severity:', result.severity);
            console.log('   AI-Powered:', result.isAIPowered ? 'Yes ✅' : 'No (Rule-based)');
        } else {
            console.error('❌ Failed:', result.error);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

function callFunction(functionName, data) {
    return new Promise((resolve, reject) => {
        const url = `${EMULATOR_URL}/${functionName}`;
        const postData = JSON.stringify({ data });
        
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        // Parse URL
        const urlObj = new URL(url);
        options.hostname = urlObj.hostname;
        options.port = urlObj.port;
        options.path = urlObj.pathname;
        options.protocol = urlObj.protocol;
        
        const protocol = urlObj.protocol === 'https:' ? https : require('http');
        
        const req = protocol.request(options, (res) => {
            let body = '';
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    resolve(result.result || result);
                } catch (error) {
                    reject(new Error(`Failed to parse response: ${body}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}

// Run tests
const args = process.argv.slice(2);

if (args.includes('--anomaly')) {
    testAnomalyExplanation();
} else {
    testGemini();
}
