/**
 * Direct Gemini API Test
 * Tests the Gemini API endpoint directly (bypasses Firebase)
 */

const https = require('https');

const API_KEY = 'AIzaSyANzvo3AlXnri6bp555GBUWLE4bxXAmN3E';
const MODEL = 'gemini-1.5-flash';
const ENDPOINT = 'generativelanguage.googleapis.com';

async function testGeminiDirect() {
    console.log('🧪 Testing Gemini API directly...\n');
    console.log('Endpoint:', ENDPOINT);
    console.log('Model:', MODEL);
    console.log('API Key:', API_KEY.substring(0, 10) + '...\n');
    
    const requestData = {
        contents: [{
            role: 'user',
            parts: [{ 
                text: 'You are a financial advisor. A student spent GHS 500 on Shopping, but usually spends GHS 150. Explain why this is unusual in 2 sentences and give 1 suggestion.' 
            }]
        }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 200,
        }
    };
    
    const postData = JSON.stringify(requestData);
    
    const options = {
        hostname: ENDPOINT,
        port: 443,
        path: `/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    return new Promise((resolve, reject) => {
        console.log('📡 Sending request to Gemini API...\n');
        
        const req = https.request(options, (res) => {
            let body = '';
            
            console.log('Status Code:', res.statusCode);
            console.log('Headers:', JSON.stringify(res.headers, null, 2), '\n');
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    
                    if (res.statusCode === 200) {
                        console.log('✅ SUCCESS!\n');
                        
                        if (result.candidates && result.candidates[0]) {
                            const text = result.candidates[0].content.parts[0].text;
                            console.log('🤖 AI Response:');
                            console.log('─'.repeat(60));
                            console.log(text);
                            console.log('─'.repeat(60));
                            console.log('\n✅ Gemini API is working correctly!');
                            console.log('Your Firebase functions should work too.\n');
                        } else {
                            console.log('⚠️  Unexpected response format:');
                            console.log(JSON.stringify(result, null, 2));
                        }
                        
                        resolve(result);
                    } else {
                        console.log('❌ ERROR Response:');
                        console.log(JSON.stringify(result, null, 2));
                        
                        if (res.statusCode === 400) {
                            console.log('\n💡 This might be an API key or request format issue.');
                        } else if (res.statusCode === 403) {
                            console.log('\n💡 API key might not have permission or is invalid.');
                        } else if (res.statusCode === 404) {
                            console.log('\n💡 Endpoint or model name might be incorrect.');
                        } else if (res.statusCode === 429) {
                            console.log('\n💡 Rate limit exceeded. Wait a minute and try again.');
                        }
                        
                        reject(new Error(`HTTP ${res.statusCode}: ${result.error?.message || 'Unknown error'}`));
                    }
                } catch (error) {
                    console.error('❌ Failed to parse response:', body);
                    reject(error);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('❌ Request failed:', error.message);
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}

// Run the test
testGeminiDirect()
    .then(() => {
        console.log('\n🎉 Test completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Test failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('   1. Check API key at: https://makersuite.google.com/app/apikey');
        console.log('   2. Ensure Gemini API is enabled in your Google Cloud project');
        console.log('   3. Check your internet connection');
        process.exit(1);
    });
