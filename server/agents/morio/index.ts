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
import { createLLMProvider, type LLMConfig } from './api/llm_provider';
import type { ChatMessage, ChatResponse, MorioConfig, Session } from './types';
import { AgentCommunicator } from '../../core/agent-framework/agent-communicator';
import { MessageType } from '../../core/agent-framework/message-bus';
import { Logger } from '../../utils/logger';

const logger = new Logger('morio-agent');

export interface MorioAgentDependencies {
  nuru?: typeof nuru;
  sessionManager?: SessionManager;
  responseGenerator?: ResponseGenerator;
  userGenerator?: UserGenerator;
  communicator?: AgentCommunicator;
  onNotification?: (payload: unknown) => void | Promise<void>;
}

export class MorioAgent {
  private sessionManager: SessionManager;
  private responseGenerator: ResponseGenerator;
  private userGenerator: UserGenerator;
  private config: MorioConfig;
  private communicator: AgentCommunicator;
  private readonly understandMessage: typeof nuru.understand;
  private readonly onNotification?: (payload: unknown) => void | Promise<void>;
  private llmConfig?: LLMConfig;
  private activeSessions = new Map<string, number>();
  private readonly inFlightSessions = new Set<string>();
  private readonly activeResponseControllers = new Set<AbortController>();
  private readonly messageQueues = new Map<string, Promise<ChatResponse>>();
  private isShutdown = false;
  private sessionMetrics = {
    totalSessions: 0,
    activeSessions: 0,
    avgProcessingTime: 0,
    lastMetricsUpdate: new Date()
  };
  private metricsUpdateInterval: NodeJS.Timeout | null = null;
  private readonly activeSessionTimeoutMs: number;
  private readonly metricsUpdateIntervalMs: number;

  constructor(
    config?: Partial<MorioConfig>,
    llmConfig?: LLMConfig,
    dependencies: MorioAgentDependencies = {}
  ) {
    this.config = {
      personality: 'friendly',
      language: 'en',
      maxHistoryLength: 20,
      responseTimeout: 30000,
      ...config
    };
    this.config.responseTimeout = Math.max(1, this.config.responseTimeout);
    this.config.maxHistoryLength = Math.max(1, Math.floor(this.config.maxHistoryLength));

    this.llmConfig = llmConfig;
    this.activeSessionTimeoutMs = Math.max(1, config?.activeSessionTimeoutMs ?? 60_000);
    this.metricsUpdateIntervalMs = Math.max(1, config?.metricsUpdateIntervalMs ?? 10_000);
    this.sessionManager = dependencies.sessionManager ?? new SessionManager();
    this.responseGenerator = dependencies.responseGenerator ?? new ResponseGenerator(this.config, llmConfig);
    this.userGenerator = dependencies.userGenerator ?? new UserGenerator();
    this.communicator = dependencies.communicator ?? new AgentCommunicator('MORIO');
    this.understandMessage = dependencies.nuru?.understand.bind(dependencies.nuru) ?? nuru.understand.bind(nuru);
    this.onNotification = dependencies.onNotification ?? (async payload => {
      if (!payload || typeof payload !== 'object' || !('userId' in payload) || typeof payload.userId !== 'string') {
        logger.warn('MORIO cannot relay a notification without a userId');
        return;
      }
      const { wsConnectionManager } = await import('../../services/WebSocketConnectionManager');
      wsConnectionManager.sendToUser(payload.userId, { type: 'morio_notification', data: payload });
    });
    
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
          if (this.onNotification) {
            await this.onNotification(message.payload);
          } else {
            logger.warn('MORIO received a notification without a configured delivery handler', {
              messageId: message.id
            });
          }
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
    }, this.metricsUpdateIntervalMs);
    this.metricsUpdateInterval.unref?.();
  }

  /**
   * Update session metrics
   */
  private updateSessionMetrics(): void {
    const now = Date.now();
    for (const [key, lastSeen] of this.activeSessions) {
      if (!this.inFlightSessions.has(key) && now - lastSeen >= this.activeSessionTimeoutMs) this.activeSessions.delete(key);
    }
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
    this.updateSessionMetrics();
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
    if (this.isShutdown) throw new Error('MorioAgent has been shut down');
    const sessionKey = `${message.userId}:${message.daoId || 'default'}`;
    const previous = this.messageQueues.get(sessionKey) ?? Promise.resolve(undefined as unknown as ChatResponse);
    const current = previous.catch(() => undefined as unknown as ChatResponse)
      .then(() => this.processMessage(message, sessionKey));
    this.messageQueues.set(sessionKey, current);
    try {
      return await current;
    } finally {
      if (this.messageQueues.get(sessionKey) === current) this.messageQueues.delete(sessionKey);
    }
  }

  private async processMessage(message: ChatMessage, sessionKey: string): Promise<ChatResponse> {
    const startTime = Date.now();
    let sessionId = 'unavailable';

    try {
      if (this.isShutdown) throw new Error('MorioAgent has been shut down');
      // Track this session as active
      this.activeSessions.set(sessionKey, Date.now());
      this.inFlightSessions.add(sessionKey);

      // Get or create session context
      const { session, created } = await this.sessionManager.getOrCreateSession(message.userId, message.daoId);
      sessionId = session.id;
      if (created) this.sessionMetrics.totalSessions += 1;

      // Give both Nuru and response generation the current user turn in the context.
      const history = session.context.sessionData.conversationHistory;
      history.push({ role: 'user', content: message.content, timestamp: message.timestamp ?? new Date() });
      if (history.length > this.config.maxHistoryLength) {
        history.splice(0, history.length - this.config.maxHistoryLength);
      }

      // Understand the message using Nuru
      const understanding = await this.understandMessage(message.content, session.context);
      const responseContext = understanding.context ?? session.context;
      const responseHistory = responseContext.sessionData.conversationHistory;
      const lastTurn = responseHistory[responseHistory.length - 1];
      if (lastTurn?.role !== 'user' || lastTurn.content !== message.content) {
        responseHistory.push({ role: 'user', content: message.content, timestamp: message.timestamp ?? new Date() });
      }
      if (responseHistory.length > this.config.maxHistoryLength) {
        responseHistory.splice(0, responseHistory.length - this.config.maxHistoryLength);
      }

      // Generate appropriate response
      const response = await this.withResponseTimeout(
        signal => this.responseGenerator.generate(understanding, responseContext, signal),
        this.config.responseTimeout
      );
      const responseText = response.text ?? '';
      responseHistory.push({ role: 'assistant', content: responseText, timestamp: new Date() });
      if (responseHistory.length > this.config.maxHistoryLength) {
        responseHistory.splice(0, responseHistory.length - this.config.maxHistoryLength);
      }

      // Update session with the interaction
      await this.sessionManager.updateSession(message.userId, {
        lastMessage: message.content,
        lastResponse: responseText,
        lastIntent: understanding.intent
      }, message.daoId, responseContext);

      const processingTime = Date.now() - startTime;
      
      // Update average processing time
      logger.debug(`Message processed for user ${message.userId}`, {
        intent: understanding.intent,
        processingTime,
        confidence: understanding.confidence
      });

      return {
        text: responseText,
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
      return this.handleError(error, sessionId, Date.now() - startTime);
    } finally {
      this.inFlightSessions.delete(sessionKey);
      if (!this.isShutdown) this.activeSessions.set(sessionKey, Date.now());
      const processingTime = Date.now() - startTime;
      // Exponential moving average; recent per-message processing times have greater weight.
      this.sessionMetrics.avgProcessingTime = this.sessionMetrics.avgProcessingTime === 0
        ? processingTime
        : (this.sessionMetrics.avgProcessingTime + processingTime) / 2;
    }
  }

  private async withResponseTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
    const controller = new AbortController();
    this.activeResponseControllers.add(controller);
    let timer: NodeJS.Timeout | undefined;
    let abortListener: (() => void) | undefined;
    let timedOut = false;
    try {
      return await Promise.race([
        operation(controller.signal),
        new Promise<T>((_, reject) => {
          abortListener = () => reject(new Error(timedOut
            ? `Morio response timed out after ${timeoutMs}ms`
            : 'Morio response generation was cancelled'));
          controller.signal.addEventListener('abort', abortListener, { once: true });
        }),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, timeoutMs);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      if (abortListener) controller.signal.removeEventListener('abort', abortListener);
      this.activeResponseControllers.delete(controller);
    }
  }

  /**
   * Get session status
   */
  async getSessionStatus(userId: string, daoId?: string): Promise<Session | null> {
    return await this.sessionManager.findSession(userId, daoId);
  }

  /**
   * Clear user session
   */
  async clearSession(userId: string, daoId?: string): Promise<void> {
    await this.sessionManager.clearSession(userId, daoId);
    
    // Also remove from active sessions
    const keys = Array.from(this.activeSessions.keys()).filter(key =>
      daoId === undefined ? key.startsWith(`${userId}:`) : key === `${userId}:${daoId || 'default'}`
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
  private handleError(error: unknown, sessionId: string, processingTime: number): ChatResponse {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isSwahili = this.config.language.toLowerCase().startsWith('sw');
    const isTimeout = error instanceof Error && error.message.includes('timed out');
    
    return {
      text: isSwahili
        ? isTimeout ? 'Samahani, ombi limechukua muda mrefu. Tafadhali jaribu tena.' : 'Samahani, hitilafu imetokea. Tafadhali jaribu tena baadaye.'
        : isTimeout ? 'The response took too long. Please try again.' : 'I encountered an issue. Please try again or rephrase your question.',
      intent: 'error',
      confidence: 0,
      suggestions: isSwahili
        ? ['Angalia salio la DAO', 'Tazama mapendekezo yanayoendelea', 'Pata msaada']
        : ['Check DAO balance', 'View active proposals', 'Get help'],
      actions: [],
      metadata: {
        error: errorMessage,
        processingTime,
        sessionId
      }
    };
  }

  /**
   * Gracefully shutdown Morio
   */
  public async shutdown(): Promise<void> {
    this.isShutdown = true;
    for (const controller of this.activeResponseControllers) controller.abort();
    this.activeResponseControllers.clear();
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = null;
    }
    this.activeSessions.clear();
    this.inFlightSessions.clear();
    this.messageQueues.clear();
    this.communicator.unsubscribe([MessageType.NOTIFICATION, MessageType.HEALTH_CHECK]);
    this.sessionManager.shutdown();
    if (morioInstance === this) morioInstance = undefined;
    logger.info('MorioAgent shutdown complete');
  }
}

export function createMorioAgent(
  config?: Partial<MorioConfig>,
  llmConfig?: LLMConfig,
  dependencies?: MorioAgentDependencies
): MorioAgent {
  return new MorioAgent(config, llmConfig, dependencies);
}

let morioInstance: MorioAgent | undefined;
export function getMorioAgent(): MorioAgent {
  morioInstance ??= createMorioAgent();
  return morioInstance;
}

// Backward-compatible lazy singleton: importing this module alone starts no timers or subscriptions.
export const morio: MorioAgent = new Proxy({} as MorioAgent, {
  get(_target, property) {
    const instance = getMorioAgent();
    const value = Reflect.get(instance, property, instance) as unknown;
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

// Export types and utilities
export * from './types';
export { UserGenerator } from './api/user_generator';
export { createLLMProvider, LLMResponseGenerator } from './api/llm_provider';
export { SessionManager } from './api/session_manager';
export { ResponseGenerator } from './api/response_generator';