"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGeminiClient = exports.GeminiClient = void 0;
const axios_1 = require("axios");
const geminiConfig_1 = require("./geminiConfig");
class GeminiClient {
    constructor() {
        this.config = (0, geminiConfig_1.getGeminiConfig)();
        (0, geminiConfig_1.validateGeminiConfig)(this.config);
        this.client = axios_1.default.create({
            baseURL: this.config.endpoint,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
    /**
     * Generate content using Gemini API
     */
    async generateContent(prompt, context) {
        var _a, _b, _c, _d;
        try {
            const messages = [];
            // Add context if provided
            if (context) {
                messages.push({
                    role: 'user',
                    parts: [{ text: context }],
                });
                messages.push({
                    role: 'model',
                    parts: [{ text: 'I understand the context. I\'ll provide personalized financial advice based on this information.' }],
                });
            }
            // Add main prompt
            messages.push({
                role: 'user',
                parts: [{ text: prompt }],
            });
            const request = {
                contents: messages,
                generationConfig: {
                    temperature: this.config.temperature,
                    maxOutputTokens: this.config.maxTokens,
                    topP: 0.8,
                    topK: 40,
                },
                safetySettings: [
                    {
                        category: 'HARM_CATEGORY_HARASSMENT',
                        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
                    },
                    {
                        category: 'HARM_CATEGORY_HATE_SPEECH',
                        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
                    },
                    {
                        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
                    },
                    {
                        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
                    },
                ],
            };
            const response = await this.client.post(`/models/${this.config.model}:generateContent?key=${this.config.apiKey}`, request);
            if (!response.data.candidates || response.data.candidates.length === 0) {
                throw new Error('No response from Gemini API');
            }
            const candidate = response.data.candidates[0];
            if (candidate.finishReason !== 'STOP') {
                console.warn(`Gemini finish reason: ${candidate.finishReason}`);
            }
            const text = (_a = candidate.content.parts[0]) === null || _a === void 0 ? void 0 : _a.text;
            if (!text) {
                throw new Error('Empty response from Gemini API');
            }
            return text.trim();
        }
        catch (error) {
            console.error('Gemini API error:', ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
            if (((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) === 429) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }
            if (((_d = error.response) === null || _d === void 0 ? void 0 : _d.status) === 401) {
                throw new Error('Invalid Gemini API key');
            }
            throw new Error(`Gemini API error: ${error.message}`);
        }
    }
    /**
     * Generate financial insight with structured prompt
     */
    async generateFinancialInsight(data) {
        const context = this.buildFinancialContext(data);
        const prompt = this.buildFinancialPrompt(data);
        return this.generateContent(prompt, context);
    }
    /**
     * Build context for financial analysis
     */
    buildFinancialContext(data) {
        let context = `You are a friendly financial advisor for university students in Ghana. `;
        context += `You provide personalized, actionable advice in a conversational tone. `;
        context += `Use emojis sparingly and be encouraging but honest.\n\n`;
        if (data.userIncome) {
            context += `User's monthly income: GHS ${data.userIncome}\n`;
        }
        if (data.budgets && data.budgets.length > 0) {
            context += `\nActive Budgets:\n`;
            data.budgets.forEach((b) => {
                const percentage = (b.spent / b.limit * 100).toFixed(0);
                context += `- ${b.category}: GHS ${b.spent}/${b.limit} (${percentage}%)\n`;
            });
        }
        if (data.goals && data.goals.length > 0) {
            context += `\nSavings Goals:\n`;
            data.goals.forEach((g) => {
                const percentage = (g.current / g.target * 100).toFixed(0);
                context += `- ${g.name}: GHS ${g.current}/${g.target} (${percentage}%)\n`;
            });
        }
        return context;
    }
    /**
     * Build prompt for financial analysis
     */
    buildFinancialPrompt(data) {
        let prompt = `Analyze this ${data.period} spending pattern:\n\n`;
        data.spendingData.forEach((item) => {
            prompt += `- ${item.category}: GHS ${item.amount} (${item.count} transactions)\n`;
        });
        if (data.anomalies && data.anomalies.length > 0) {
            prompt += `\n⚠️ Unusual spending detected:\n`;
            data.anomalies.forEach((a) => {
                prompt += `- GHS ${a.amount} on ${a.category} (${a.reason})\n`;
            });
        }
        prompt += `\nProvide 2-3 specific, actionable insights. Be conversational and encouraging. `;
        prompt += `Focus on what matters most. Keep it under 150 words.`;
        return prompt;
    }
    /**
     * Explain spending anomaly
     */
    async explainAnomaly(data) {
        const prompt = `A user just spent GHS ${data.amount} on ${data.category}. ` +
            `Their usual spending in this category is GHS ${data.averageAmount}. ` +
            `${data.userIncome ? `Their monthly income is GHS ${data.userIncome}. ` : ''}` +
            `${data.budgetRemaining !== undefined ? `They have GHS ${data.budgetRemaining} left in their budget. ` : ''}` +
            `Explain why this is unusual and provide 1-2 specific suggestions. ` +
            `Be friendly and helpful. Keep it under 100 words.`;
        return this.generateContent(prompt);
    }
    /**
     * Generate goal advice
     */
    async generateGoalAdvice(data) {
        const available = data.monthlyIncome - data.monthlyExpenses;
        const prompt = `A student wants to save GHS ${data.targetAmount} for ${data.goalName}. ` +
            `They currently have GHS ${data.currentAmount} saved. ` +
            `Deadline: ${data.deadline}. ` +
            `Monthly income: GHS ${data.monthlyIncome}, expenses: GHS ${data.monthlyExpenses}. ` +
            `Available to save: GHS ${available}. ` +
            `Provide realistic advice on achieving this goal. ` +
            `Be encouraging but honest. Keep it under 120 words.`;
        return this.generateContent(prompt);
    }
    /**
     * Generate budget surplus recommendation
     */
    async generateSurplusRecommendation(data) {
        const prompt = `A student finished the month with GHS ${data.surplusAmount} surplus! ` +
            `Their goals: ${data.goals.map(g => `${g.name} (GHS ${g.remaining} remaining)`).join(', ')}. ` +
            `Emergency fund: GHS ${data.emergencyFund}/${data.emergencyFundTarget}. ` +
            `Suggest how to allocate this surplus. Be specific with amounts. ` +
            `Keep it under 100 words and be encouraging! 🎉`;
        return this.generateContent(prompt);
    }
}
exports.GeminiClient = GeminiClient;
// Singleton instance
let geminiClientInstance = null;
/**
 * Get Gemini client instance
 */
function getGeminiClient() {
    if (!geminiClientInstance) {
        geminiClientInstance = new GeminiClient();
    }
    return geminiClientInstance;
}
exports.getGeminiClient = getGeminiClient;
//# sourceMappingURL=geminiClient.js.map