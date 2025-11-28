/**
 * MORIO - The Spirit (Conversational Interface)
 * 
 * Purpose: Provides the conversational personality and user interface layer
 * for the Morio AI assistant system.
 */

import { nuru } from '../../core/nuru';
import { SessionManager } from './api/session_manager';
import { ResponseGenerator } from './api/response_generator';
import { UserGenerator } from './api/user_generator';
import { createLLMProvider, LLMConfig } from './api/llm_provider';
import type { ChatMessage, ChatResponse, MorioConfig, Session } from './types';
import { AgentCommunicator } from '../../core/agent-framework/agent-communicator';
import { MessageType } from '../../core/agent-framework/message-bus';
import { Logger } from '../../utils/logger';

const logger = new Logger('morio-agent');

export class MorioAgent {
  private sessionManager: SessionManager;
  private responseGenerator: ResponseGenerator;
  private userGenerator: UserGenerator;
  private config: MorioConfig;
  private communicator: AgentCommunicator;
  private llmConfig?: LLMConfig;
  private activeSessions: Set<string> = new Set();
  private sessionMetrics = {
    totalSessions: 0,
    activeSessions: 0,
    avgSessionDuration: 0,
    lastMetricsUpdate: new Date()
  };
  private metricsUpdateInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<MorioConfig>, llmConfig?: LLMConfig) {
    this.config = {
      personality: 'friendly',
      language: 'en',
      maxHistoryLength: 20,
      responseTimeout: 30000,
      ...config
    };

    this.llmConfig = llmConfig;
    this.sessionManager = new SessionManager();
    this.responseGenerator = new ResponseGenerator(this.config, llmConfig);
    this.userGenerator = new UserGenerator({ defaultDaoId: '' });
    this.communicator = new AgentCommunicator('MORIO');
    
    this.setupMessageHandlers();
    this.startMetricsTracking();
    
    logger.info('MorioAgent initialized', {
      personality: this.config.personality,
      language: this.config.language,
      llmEnabled: !!llmConfig
    });
  }

  private setupMessageHandlers(): void {
    this.communicator.subscribe([
      MessageType.NOTIFICATION,
      MessageType.HEALTH_CHECK
    ], this.handleCommunicatorMessage.bind(this));
  }

  private async handleCommunicatorMessage(message: any): Promise<void> {
    try {
      switch (message.type) {
        case MessageType.NOTIFICATION:
          // Handle system notifications to relay to users
          logger.info('MORIO received notification:', message.payload);
          break;
        case MessageType.HEALTH_CHECK:
          if (message.requiresResponse && message.correlationId) {
            await this.communicator.respond(message.correlationId, {
              status: 'healthy',
              activeSessions: this.getActiveSessions(),
              metrics: this.getMetrics()
            });
          }
          break;
      }
    } catch (error) {
      logger.error('MORIO error handling communicator message:', error);
    }
  }

  /**
   * Track active sessions in real-time
   */
  private startMetricsTracking(): void {
    this.metricsUpdateInterval = setInterval(() => {
      this.updateSessionMetrics();
    }, 10000); // Update every 10 seconds
  }

  /**
   * Update session metrics
   */
  private updateSessionMetrics(): void {
    const activeCount = this.activeSessions.size;
    this.sessionMetrics.activeSessions = activeCount;
    this.sessionMetrics.lastMetricsUpdate = new Date();
    
    if (activeCount > 0) {
      logger.debug(`Active sessions: ${activeCount}`);
    }
  }

  /**
   * Get active sessions count
   */
  private getActiveSessions(): number {
    return this.activeSessions.size;
  }

  /**
   * Get session metrics
   */
  public getMetrics() {
    return {
      ...this.sessionMetrics,
      activeSessions: this.getActiveSessions()
    };
  }

  /**
   * Handle incoming chat message
   */
  async handleMessage(message: ChatMessage): Promise<ChatResponse> {
    const startTime = Date.now();
    const sessionKey = `${message.userId}:${message.daoId || 'default'}`;

    try {
      // Track this session as active
      this.activeSessions.add(sessionKey);
      this.sessionMetrics.totalSessions = Math.max(
        this.sessionMetrics.totalSessions,
        this.activeSessions.size
      );

      // Get or create session context
      const session = await this.sessionManager.getSession(message.userId, message.daoId);

      // Understand the message using Nuru
      const understanding = await nuru.understand(message.content, session.context);

      // Generate appropriate response
      const response = await this.responseGenerator.generate(
        understanding,
        session.context
      );

      // Update session with the interaction
      await this.sessionManager.updateSession(message.userId, {
        lastMessage: message.content,
        lastResponse: response.text,
        lastIntent: understanding.intent
      });

      const processingTime = Date.now() - startTime;
      
      // Update average processing time
      this.sessionMetrics.avgSessionDuration = 
        (this.sessionMetrics.avgSessionDuration + processingTime) / 2;

      logger.debug(`Message processed for user ${message.userId}`, {
        intent: understanding.intent,
        processingTime,
        confidence: understanding.confidence
      });

      return {
        text: response.text,
        intent: understanding.intent,
        confidence: understanding.confidence,
        suggestions: response.suggestions || [],
        actions: response.actions || [],
        metadata: {
          processingTime,
          sessionId: session.id,
          language: understanding.language || this.config.language
        }
      };

    } catch (error) {
      logger.error('Morio error handling message:', error);
      return this.handleError(error);
    } finally {
      // Clean up session tracking after a delay to allow for follow-up messages
      setTimeout(() => {
        this.activeSessions.delete(sessionKey);
      }, 60000); // 1 minute timeout
    }
  }

  /**
   * Get session status
   */
  async getSessionStatus(userId: string): Promise<Session | null> {
    return await this.sessionManager.getSession(userId);
  }

  /**
   * Clear user session
   */
  async clearSession(userId: string): Promise<void> {
    await this.sessionManager.clearSession(userId);
    
    // Also remove from active sessions
    const keys = Array.from(this.activeSessions).filter(key => 
      key.startsWith(`${userId}:`)
    );
    keys.forEach(key => this.activeSessions.delete(key));
    
    logger.info(`Session cleared for user ${userId}`);
  }

  /**
   * Generate synthetic user for testing
   */
  public generateTestUser(daoId?: string) {
    return this.userGenerator.generateUser(daoId);
  }

  /**
   * Generate synthetic conversation for testing
   */
  public generateTestConversation(userId: string, daoId: string) {
    return this.userGenerator.generateConversation(userId, daoId);
  }

  /**
   * Handle errors gracefully
   */
  private handleError(error: any): ChatResponse {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      text: "Samahani (sorry), I encountered an issue. Pole sana! Please try again or rephrase your question.",
      intent: 'error',
      confidence: 0,
      suggestions: [
        'Check DAO balance',
        'View active proposals',
        'Get help'
      ],
      actions: [],
      metadata: {
        error: errorMessage,
        processingTime: 0,
        sessionId: 'error'
      }
    };
  }

  /**
   * Gracefully shutdown Morio
   */
  public async shutdown(): Promise<void> {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
    }
    this.activeSessions.clear();
    logger.info('MorioAgent shutdown complete');
  }
}

// Export singleton instance
export const morio = new MorioAgent();

// Export types and utilities
export * from './types';
export { UserGenerator } from './api/user_generator';
export { createLLMProvider, LLMResponseGenerator } from './api/llm_provider';
export { SessionManager } from './api/session_manager';
export { ResponseGenerator } from './api/response_generator';