"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testGeminiAI = void 0;
const functions = require("firebase-functions");
const geminiClient_1 = require("./geminiClient");
const geminiConfig_1 = require("./geminiConfig");
/**
 * Test function to verify Gemini AI is working
 * Call this to test your AI integration
 */
exports.testGeminiAI = functions.https.onCall(async (data, context) => {
    try {
        // Check if Gemini is enabled
        if (!(0, geminiConfig_1.isGeminiEnabled)()) {
            return {
                success: false,
                error: 'Gemini API key not configured',
                message: 'Please set your API key in functions/.runtimeconfig.json',
            };
        }
        const geminiClient = (0, geminiClient_1.getGeminiClient)();
        // Test 1: Simple anomaly explanation
        console.log('Test 1: Testing anomaly explanation...');
        const anomalyTest = await geminiClient.explainAnomaly({
            amount: 500,
            category: 'Shopping',
            averageAmount: 150,
            userIncome: 800,
            budgetRemaining: 180,
            anomalyScore: 0.85,
        });
        // Test 2: Financial insight generation
        console.log('Test 2: Testing financial insights...');
        const insightTest = await geminiClient.generateFinancialInsight({
            userId: 'test-user',
            userIncome: 800,
            spendingData: [
                { category: 'Food', amount: 450, count: 30 },
                { category: 'Transport', amount: 200, count: 15 },
                { category: 'Entertainment', amount: 100, count: 5 },
            ],
            budgets: [
                { category: 'Food', limit: 400, spent: 450 },
                { category: 'Transport', limit: 250, spent: 200 },
            ],
            goals: [
                { name: 'Laptop', target: 2000, current: 500 },
            ],
            period: 'monthly',
        });
        // Test 3: Goal advice
        console.log('Test 3: Testing goal advice...');
        const goalTest = await geminiClient.generateGoalAdvice({
            goalName: 'New Laptop',
            targetAmount: 2000,
            currentAmount: 500,
            deadline: '6 months',
            monthlyIncome: 800,
            monthlyExpenses: 650,
        });
        return {
            success: true,
            message: 'All AI tests passed! 🎉',
            tests: {
                anomalyExplanation: {
                    passed: true,
                    response: anomalyTest,
                    length: anomalyTest.length,
                },
                financialInsight: {
                    passed: true,
                    response: insightTest,
                    length: insightTest.length,
                },
                goalAdvice: {
                    passed: true,
                    response: goalTest,
                    length: goalTest.length,
                },
            },
            apiKey: 'Configured ✅',
            model: 'gemini-pro',
        };
    }
    catch (error) {
        console.error('Gemini test failed:', error);
        return {
            success: false,
            error: error.message,
            details: error.stack,
            troubleshooting: {
                apiKey: 'Check functions/.runtimeconfig.json',
                quota: 'Check https://console.cloud.google.com/',
                logs: 'Run: firebase functions:log',
            },
        };
    }
});
//# sourceMappingURL=testGemini.js.map