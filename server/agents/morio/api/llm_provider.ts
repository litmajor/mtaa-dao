/**
 * LLM Provider for Morio
 * Integrates with OpenAI and other LLM services for enhanced response generation
 */

import { Logger } from '../../../utils/logger';

const logger = new Logger('morio-llm-provider');

export interface LLMConfig {
  provider: 'openai' | 'local' | 'mock';
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
}

export interface LLMResponse {
  text: string;
  confidence: number;
  tokens: {
    input: number;
    output: number;
  };
  model: string;
}

export interface LLMRequest {
  systemPrompt: string;
  userMessage: string;
  context?: Record<string, any>;
  temperature?: number;
  maxTokens?: number;
}

/**
 * LLMProvider - Abstract base for LLM implementations
 */
export abstract class LLMProvider {
  protected config: LLMConfig;
  protected name: string;

  constructor(config: LLMConfig) {
    this.config = config;
    this.name = this.constructor.name;
  }

  abstract generate(request: LLMRequest): Promise<LLMResponse>;

  protected validateConfig(): void {
    if (!this.config) {
      throw new Error('LLM configuration is missing');
    }
  }

  protected logRequest(request: LLMRequest): void {
    logger.debug(`[${this.name}] Request:`, {
      model: this.config.model,
      userMessage: request.userMessage.substring(0, 100)
    });
  }

  protected logResponse(response: LLMResponse): void {
    logger.debug(`[${this.name}] Response:`, {
      tokens: response.tokens,
      confidence: response.confidence
    });
  }
}

/**
 * OpenAI Provider
 */
export class OpenAIProvider extends LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(config: LLMConfig) {
    super(config);
    this.validateConfig();
    
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.model = config.model || 'gpt-3.5-turbo';

    if (!this.apiKey) {
      throw new Error('OpenAI API key not provided or found in OPENAI_API_KEY');
    }
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    this.logRequest(request);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: request.systemPrompt
            },
            {
              role: 'user',
              content: request.userMessage
            }
          ],
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? this.config.maxTokens ?? 500
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const generatedText = data.choices[0]?.message?.content || '';

      const result: LLMResponse = {
        text: generatedText,
        confidence: 0.95,
        tokens: {
          input: data.usage?.prompt_tokens || 0,
          output: data.usage?.completion_tokens || 0
        },
        model: this.model
      };

      this.logResponse(result);
      return result;
    } catch (error) {
      logger.error('OpenAI generation failed:', error);
      throw error;
    }
  }
}

/**
 * Mock Provider for testing
 */
export class MockLLMProvider extends LLMProvider {
  async generate(request: LLMRequest): Promise<LLMResponse> {
    this.logRequest(request);

    // Simple mock response
    const mockResponse: LLMResponse = {
      text: `Mock response to: "${request.userMessage.substring(0, 50)}..."`,
      confidence: 0.8,
      tokens: {
        input: 50,
        output: 25
      },
      model: 'mock-gpt'
    };

    this.logResponse(mockResponse);
    return mockResponse;
  }
}

/**
 * Factory function to create LLM provider
 */
export function createLLMProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'mock':
      return new MockLLMProvider(config);
    default:
      logger.warn(`Unknown LLM provider: ${config.provider}, using mock`);
      return new MockLLMProvider(config);
  }
}

/**
 * LLM-Enhanced Response Generator
 */
export class LLMResponseGenerator {
  private llmProvider: LLMProvider;
  private systemPrompt: string;

  constructor(llmProvider: LLMProvider, systemPrompt?: string) {
    this.llmProvider = llmProvider;
    this.systemPrompt = systemPrompt || this.getDefaultSystemPrompt();
  }

  /**
   * Generate response using LLM
   */
  async generateResponse(
    userMessage: string,
    context?: Record<string, any>
  ): Promise<LLMResponse> {
    const enrichedSystemPrompt = this.enrichSystemPrompt(context);

    return await this.llmProvider.generate({
      systemPrompt: enrichedSystemPrompt,
      userMessage,
      context,
      temperature: 0.7,
      maxTokens: 500
    });
  }

  /**
   * Get default system prompt for Morio
   */
  private getDefaultSystemPrompt(): string {
    return `You are Morio, a helpful AI assistant for managing Decentralized Autonomous Organizations (DAOs).
You help users with:
- Viewing DAO balances and transactions
- Creating and voting on proposals
- Managing treasury funds
- Understanding DAO governance

You respond in a friendly, concise manner using simple language.
Use Swahili greetings occasionally (Habari = Hello, Sawa = OK, Pole = Take it easy).
Keep responses under 150 words unless detailed explanation is needed.`;
  }

  /**
   * Enrich system prompt with context
   */
  private enrichSystemPrompt(context?: Record<string, any>): string {
    let prompt = this.systemPrompt;

    if (context) {
      if (context.userId) {
        prompt += `\nUser ID: ${context.userId}`;
      }
      if (context.daoId) {
        prompt += `\nDAO ID: ${context.daoId}`;
      }
      if (context.userRole) {
        prompt += `\nUser Role: ${context.userRole}`;
      }
    }

    return prompt;
  }
}
