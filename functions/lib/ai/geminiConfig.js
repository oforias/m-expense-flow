"use strict";
/**
 * Gemini AI Configuration
 * Reads from environment variables (.env file) — no longer uses deprecated functions.config()
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_FEATURES = exports.RATE_LIMITS = exports.isGeminiEnabled = exports.validateGeminiConfig = exports.getGeminiConfig = void 0;
function getGeminiConfig() {
    let modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    // Map legacy model names
    if (modelName === 'gemini-pro')
        modelName = 'gemini-1.5-flash';
    return {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: modelName,
        maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '1000'),
        temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
        endpoint: process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta',
    };
}
exports.getGeminiConfig = getGeminiConfig;
/**
 * Validate Gemini configuration
 * Throws error if API key is missing
 */
function validateGeminiConfig(config) {
    if (!config.apiKey) {
        throw new Error('Gemini API key not configured. Set it using: ' +
            'firebase functions:config:set gemini.api_key="YOUR_API_KEY"');
    }
}
exports.validateGeminiConfig = validateGeminiConfig;
/**
 * Check if Gemini is enabled
 * Returns false if API key is not configured
 */
function isGeminiEnabled() {
    try {
        const config = getGeminiConfig();
        return config.apiKey.length > 0;
    }
    catch (_a) {
        return false;
    }
}
exports.isGeminiEnabled = isGeminiEnabled;
/**
 * Rate limiting configuration
 */
exports.RATE_LIMITS = {
    requestsPerMinute: 15,
    requestsPerDay: 1500,
    maxConcurrent: 5,
};
/**
 * Feature flags for AI capabilities
 */
exports.AI_FEATURES = {
    spendingAnalysis: true,
    anomalyExplanation: true,
    recommendations: true,
    comparativeInsights: true,
    goalAdvice: true,
    budgetSuggestions: true,
};
//# sourceMappingURL=geminiConfig.js.map