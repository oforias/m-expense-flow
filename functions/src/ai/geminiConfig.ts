/**
 * Gemini AI Configuration
 * Reads from environment variables (.env file) — no longer uses deprecated functions.config()
 */

export interface GeminiConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  endpoint: string;
}

export function getGeminiConfig(): GeminiConfig {
  let modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  // Map legacy model names
  if (modelName === 'gemini-pro') modelName = 'gemini-1.5-flash';

  return {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: modelName,
    maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '1000'),
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
    endpoint: process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta',
  };
}

/**
 * Validate Gemini configuration
 * Throws error if API key is missing
 */
export function validateGeminiConfig(config: GeminiConfig): void {
  if (!config.apiKey) {
    throw new Error(
      'Gemini API key not configured. Set it using: ' +
      'firebase functions:config:set gemini.api_key="YOUR_API_KEY"'
    );
  }
}

/**
 * Check if Gemini is enabled
 * Returns false if API key is not configured
 */
export function isGeminiEnabled(): boolean {
  try {
    const config = getGeminiConfig();
    return config.apiKey.length > 0;
  } catch {
    return false;
  }
}

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  requestsPerMinute: 15, // Gemini free tier limit
  requestsPerDay: 1500,  // Gemini free tier limit
  maxConcurrent: 5,
};

/**
 * Feature flags for AI capabilities
 */
export const AI_FEATURES = {
  spendingAnalysis: true,
  anomalyExplanation: true,
  recommendations: true,
  comparativeInsights: true,
  goalAdvice: true,
  budgetSuggestions: true,
};
