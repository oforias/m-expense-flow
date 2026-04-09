import axios, { AxiosInstance } from 'axios';
import { getGeminiConfig, validateGeminiConfig } from './geminiConfig';

/**
 * Gemini API Client
 * Handles communication with Google Gemini API
 */

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface GeminiRequest {
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  promptFeedback?: {
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  };
}

export class GeminiClient {
  private client: AxiosInstance;
  private config: ReturnType<typeof getGeminiConfig>;

  constructor() {
    this.config = getGeminiConfig();
    validateGeminiConfig(this.config);

    this.client = axios.create({
      baseURL: this.config.endpoint,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Generate content using Gemini API
   */
  async generateContent(prompt: string, context?: string): Promise<string> {
    try {
      const messages: GeminiMessage[] = [];

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

      const request: GeminiRequest = {
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

      const response = await this.client.post<GeminiResponse>(
        `/models/${this.config.model}:generateContent?key=${this.config.apiKey}`,
        request
      );

      if (!response.data.candidates || response.data.candidates.length === 0) {
        throw new Error('No response from Gemini API');
      }

      const candidate = response.data.candidates[0];
      
      if (candidate.finishReason !== 'STOP') {
        console.warn(`Gemini finish reason: ${candidate.finishReason}`);
      }

      const text = candidate.content.parts[0]?.text;
      
      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      return text.trim();
    } catch (error: any) {
      console.error('Gemini API error:', error.response?.data || error.message);
      
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      if (error.response?.status === 401) {
        throw new Error('Invalid Gemini API key');
      }
      
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  /**
   * Generate financial insight with structured prompt
   */
  async generateFinancialInsight(data: {
    userId: string;
    userIncome?: number;
    spendingData: Array<{ category: string; amount: number; count: number }>;
    budgets?: Array<{ category: string; limit: number; spent: number }>;
    goals?: Array<{ name: string; target: number; current: number }>;
    anomalies?: Array<{ amount: number; category: string; reason: string }>;
    period: string;
  }): Promise<string> {
    const context = this.buildFinancialContext(data);
    const prompt = this.buildFinancialPrompt(data);
    
    return this.generateContent(prompt, context);
  }

  /**
   * Build context for financial analysis
   */
  private buildFinancialContext(data: any): string {
    let context = `You are a friendly financial advisor for university students in Ghana. `;
    context += `You provide personalized, actionable advice in a conversational tone. `;
    context += `Use emojis sparingly and be encouraging but honest.\n\n`;
    
    if (data.userIncome) {
      context += `User's monthly income: GHS ${data.userIncome}\n`;
    }
    
    if (data.budgets && data.budgets.length > 0) {
      context += `\nActive Budgets:\n`;
      data.budgets.forEach((b: any) => {
        const percentage = (b.spent / b.limit * 100).toFixed(0);
        context += `- ${b.category}: GHS ${b.spent}/${b.limit} (${percentage}%)\n`;
      });
    }
    
    if (data.goals && data.goals.length > 0) {
      context += `\nSavings Goals:\n`;
      data.goals.forEach((g: any) => {
        const percentage = (g.current / g.target * 100).toFixed(0);
        context += `- ${g.name}: GHS ${g.current}/${g.target} (${percentage}%)\n`;
      });
    }
    
    return context;
  }

  /**
   * Build prompt for financial analysis
   */
  private buildFinancialPrompt(data: any): string {
    let prompt = `Analyze this ${data.period} spending pattern:\n\n`;
    
    data.spendingData.forEach((item: any) => {
      prompt += `- ${item.category}: GHS ${item.amount} (${item.count} transactions)\n`;
    });
    
    if (data.anomalies && data.anomalies.length > 0) {
      prompt += `\n⚠️ Unusual spending detected:\n`;
      data.anomalies.forEach((a: any) => {
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
  async explainAnomaly(data: {
    amount: number;
    category: string;
    averageAmount: number;
    userIncome?: number;
    budgetRemaining?: number;
    anomalyScore: number;
  }): Promise<string> {
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
  async generateGoalAdvice(data: {
    goalName: string;
    targetAmount: number;
    currentAmount: number;
    deadline: string;
    monthlyIncome: number;
    monthlyExpenses: number;
  }): Promise<string> {
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
  async generateSurplusRecommendation(data: {
    surplusAmount: number;
    goals: Array<{ name: string; remaining: number; priority: number }>;
    emergencyFund: number;
    emergencyFundTarget: number;
  }): Promise<string> {
    const prompt = `A student finished the month with GHS ${data.surplusAmount} surplus! ` +
      `Their goals: ${data.goals.map(g => `${g.name} (GHS ${g.remaining} remaining)`).join(', ')}. ` +
      `Emergency fund: GHS ${data.emergencyFund}/${data.emergencyFundTarget}. ` +
      `Suggest how to allocate this surplus. Be specific with amounts. ` +
      `Keep it under 100 words and be encouraging! 🎉`;
    
    return this.generateContent(prompt);
  }
}

// Singleton instance
let geminiClientInstance: GeminiClient | null = null;

/**
 * Get Gemini client instance
 */
export function getGeminiClient(): GeminiClient {
  if (!geminiClientInstance) {
    geminiClientInstance = new GeminiClient();
  }
  return geminiClientInstance;
}
