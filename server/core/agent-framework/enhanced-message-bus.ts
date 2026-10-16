/**
 * Enhanced Unified Message Bus with Persistence, Priority/TTL Enforcement, and Observability
 * 
 * Features:
 * - Bridges main agent framework, elders/coordinator, and gateway subsystems
 * - Redis-backed persistence for durability and multi-instance support
 * - Priority queue enforcement: critical > high > medium > low
 * - TTL enforcement with automatic message expiration
 * - Dead Letter Queue for undeliverable messages
 * - Comprehensive metrics for Prometheus
 * - Request/response correlation with guarantees
 * - Alert on subscriber unavailability
 */

import { EventEmitter } from 'events';
import type Redis from 'ioredis';
import { Logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger('enhanced-message-bus');

// Message type enums
export enum MessageType {
  // Analyzer messages
  FRAUD_ALERT = 'fraud_alert',
  ANOMALY_DETECTED = 'anomaly_detected',
  TREASURY_HEALTH = 'treasury_health',
  RISK_ASSESSMENT = 'risk_assessment',
  NODE_PROFILE = 'node_profile',
  
  // Synchronizer messages
  STATE_SYNC = 'state_sync',
  DRIFT_DETECTED = 'drift_detected',
  ROLLBACK_REQUEST = 'rollback_request',
  CHECKPOINT_CREATED = 'checkpoint_created',
  SYNC_BEAT = 'sync_beat',
  
  // Defender messages
  THREAT_DETECTED = 'threat_detected',
  QUARANTINE_USER = 'quarantine_user',
  RELEASE_USER = 'release_user',
  ETHICAL_REVIEW = 'ethical_review',
  DEFENSE_ACTION = 'defense_action',
  
  // AI Layer messages
  ANALYSIS_REQUEST = 'analysis_request',
  ANALYSIS_RESPONSE = 'analysis_response',
  ACTION_REQUIRED = 'action_required',
  NOTIFICATION = 'notification',
  USER_QUERY = 'user_query',
  
  // Coordinator messages (bridged from elders)
  SCRY_THREAT_DETECTED = 'scry:threat-detected',
  SCRY_FORECAST_UPDATED = 'scry:forecast-updated',
  SCRY_ANALYSIS_COMPLETE = 'scry:analysis-complete',
  KAIZEN_RECOMMENDATION_GENERATED = 'kaizen:recommendation-generated',
  KAIZEN_OPTIMIZATION_APPLIED = 'kaizen:optimization-applied',
  KAIZEN_METRICS_UPDATED = 'kaizen:metrics-updated',
  LUMEN_REVIEW_COMPLETE = 'lumen:review-complete',
  LUMEN_ETHICS_VIOLATION_DETECTED = 'lumen:ethics-violation-detected',
  LUMEN_COMPLIANCE_STATUS_UPDATED = 'lumen:compliance-status-updated',
  COORDINATOR_CONSENSUS_REQUEST = 'coordinator:consensus-request',
  COORDINATOR_DECISION_MADE = 'coordinator:decision-made',
  COORDINATOR_ALERT_ESCALATED = 'coordinator:alert-escalated',
  
  // Gateway messages (bridged from gateway subsystem)
  GATEWAY_PRICE_REQUEST = 'gateway:price_request',
  GATEWAY_PRICE_UPDATE = 'gateway:price_update',
  GATEWAY_LIQUIDITY_REQUEST = 'gateway:liquidity_request',
  GATEWAY_LIQUIDITY_UPDATE = 'gateway:liquidity_update',
  GATEWAY_EXECUTION_REQUEST = 'gateway:execution_request',
  GATEWAY_EXECUTION_RESPONSE = 'gateway:execution_response',
  
  // System messages
  AGENT_ONLINE = 'agent_online',
  AGENT_OFFLINE = 'agent_offline',
  HEALTH_CHECK = 'health_check',
  METRICS_UPDATE = 'metrics_update',
  ALERT_REQUEST = 'alert_request',
  PRICE_UPDATE = 'price_update',
  LIQUIDITY_UPDATE = 'liquidity_update',
  EXECUTION_REQUEST = 'execution_request',
  TRANSACTION_EVENT = 'transaction_event',
  USER_EVENT = 'user_event',
  AUDIT_REQUEST = 'audit_request',
}

export type MessagePriority = 'low' | 'medium' | 'high' | 'critical';

export interface AgentMessage {
  id: string;
  from: string;
  to: string | string[];
  type: MessageType;
  payload: any;
  timestamp: Date;
  priority: MessagePriority;
  requiresResponse: boolean;
  correlationId?: string;
  ttl?: number; // Time to live in milliseconds
  expiresAt?: number; // Absolute expiration timestamp
  subsystem?: 'agent-framework' | 'coordinator' | 'gateway'; // Origin subsystem
  deliveryAttempts?: number;
  maxDeliveryAttempts?: number;
}

export interface MessageDeliveryRecord {
  messageId: string;
  to: string;
  deliveredAt: Date;
  status: 'delivered' | 'failed' | 'timeout' | 'expired';
  error?: string;
}

type MessageHandler = (message: AgentMessage) => Promise<void>;

interface Subscriber {
  agentId: string;
  handler: MessageHandler;
}

interface PriorityLevel {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const PRIORITY_LEVELS: PriorityLevel = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

/**
 * Enhanced Unified Message Bus
 */
export class EnhancedMessageBus extends EventEmitter {
  private subscribers: Map<MessageType, Set<Subscriber>> = new Map();
  private pendingResponses: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private messageHistory: AgentMessage[] = [];
  private deadLetterQueue: AgentMessage[] = [];
  private readonly MAX_HISTORY = 10000;
  private readonly MAX_DLQ = 5000;
  private readonly DEFAULT_DELIVERY_ATTEMPTS = 3;
  private readonly DEFAULT_TTL = 300000; // 5 minutes
  
  private redis: Redis | null = null;
  private redisReady = false;
  private processingQueue = new Map<MessagePriority, AgentMessage[]>();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  
  // Metrics
  private metrics = {
    totalPublished: 0,
    totalDelivered: 0,
    totalFailed: 0,
    totalExpired: 0,
    totalDLQ: 0,
    totalResponses: 0,
    totalTimeouts: 0,
    messagesByType: new Map<MessageType, number>(),
    subscribersByType: new Map<MessageType, number>(),
    deliveryTimes: [] as number[],
    avgDeliveryTime: 0,
  };

  constructor(redisClient?: Redis) {
    super();
    this.setMaxListeners(200); // More listeners for unified bus
    this.redis = redisClient || null;
    
    // Initialize priority queues
    this.processingQueue.set('critical', []);
    this.processingQueue.set('high', []);
    this.processingQueue.set('medium', []);
    this.processingQueue.set('low', []);
    
    if (this.redis) {
      this.initializeRedis();
    }
    
    logger.info('EnhancedMessageBus initialized');
  }

  /**
   * Initialize Redis connection and load persisted state
   */
  private async initializeRedis(): Promise<void> {
    if (!this.redis) return;
    
    try {
      // Test connection
      await this.redis.ping();
      this.redisReady = true;
      logger.info('Redis connection established for message persistence');
      
      // Load undelivered messages from Redis
      await this.loadUndeliveredMessages();
      
      // Subscribe to Redis channel for cross-process messages
      if (process.env.ENABLE_DISTRIBUTED_BUS === 'true') {
        this.subscribeToRedisChannel();
      }
    } catch (error) {
      logger.error('Failed to initialize Redis for message bus:', error);
      this.redisReady = false;
    }
  }

  /**
   * Load undelivered messages from Redis persistence
   */
  private async loadUndeliveredMessages(): Promise<void> {
    if (!this.redis || !this.redisReady) return;
    
    try {
      const keys = await this.redis.keys('mtaa:msg:pending:*');
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const message = JSON.parse(data) as AgentMessage;
          this.messageHistory.push(message);
        }
      }
      logger.info(`Loaded ${keys.length} undelivered messages from Redis`);
    } catch (error) {
      logger.error('Failed to load undelivered messages from Redis:', error);
    }
  }

  /**
   * Subscribe to Redis channel for cross-process messages
   */
  private subscribeToRedisChannel(): void {
    if (!this.redis || !this.redisReady) return;
    
    const subscriber = this.redis.duplicate();
    subscriber.subscribe('mtaa:message-bus', (err) => {
      if (err) {
        logger.error('Failed to subscribe to Redis channel:', err);
      } else {
        logger.info('Subscribed to Redis message-bus channel');
      }
    });
    
    subscriber.on('message', (channel, data) => {
      if (channel === 'mtaa:message-bus') {
        try {
          const message = JSON.parse(data) as AgentMessage;
          this.handleRedisMessage(message);
        } catch (error) {
          logger.error('Failed to parse Redis message:', error);
        }
      }
    });
  }

  /**
   * Handle messages from Redis (from other processes/containers)
   */
  private handleRedisMessage(message: AgentMessage): void {
    // Only process if we have subscribers for this type
    const subscribers = this.subscribers.get(message.type);
    if (!subscribers || subscribers.size === 0) {
      logger.warn(`[DLQ] Received Redis message with no subscribers: ${message.type}`);
      this.addToDeadLetterQueue(message, 'No local subscribers for this message type');
      return;
    }
    
    // Check TTL
    if (message.expiresAt && Date.now() > message.expiresAt) {
      logger.warn(`Message expired (via Redis): ${message.id}`);
      this.metrics.totalExpired++;
      return;
    }
    
    // Deliver to subscribers
    this.deliverToSubscribers(message).catch((error) => {
      logger.error(`Failed to deliver Redis message: ${message.id}`, error);
    });
  }

  /**
   * Subscribe to specific message types
   */
  subscribe(
    agentId: string,
    messageTypes: MessageType[],
    handler: MessageHandler
  ): void {
    const subscriber: Subscriber = { agentId, handler };

    messageTypes.forEach(type => {
      if (!this.subscribers.has(type)) {
        this.subscribers.set(type, new Set());
      }
      const subscribers = this.subscribers.get(type)!;
      subscribers.add(subscriber);
      
      const count = subscribers.size;
      this.metrics.subscribersByType.set(type, count);
    });

    logger.info(`Agent ${agentId} subscribed to ${messageTypes.length} message types`);
  }

  /**
   * Unsubscribe from message types
   */
  unsubscribe(agentId: string, messageTypes?: MessageType[]): void {
    if (!messageTypes) {
      // Unsubscribe from all
      this.subscribers.forEach((subscribers, type) => {
        const before = subscribers.size;
        subscribers.forEach(sub => {
          if (sub.agentId === agentId) {
            subscribers.delete(sub);
          }
        });
        this.metrics.subscribersByType.set(type, subscribers.size);
      });
    } else {
      messageTypes.forEach(type => {
        const subscribers = this.subscribers.get(type);
        if (subscribers) {
          const before = subscribers.size;
          subscribers.forEach(sub => {
            if (sub.agentId === agentId) {
              subscribers.delete(sub);
            }
          });
          this.metrics.subscribersByType.set(type, subscribers.size);
        }
      });
    }

    logger.info(`Agent ${agentId} unsubscribed`);
  }

  /**
   * Publish a message with priority and TTL enforcement
   */
  async publish(message: AgentMessage): Promise<void> {
    // Ensure message has required fields
    if (!message.id) {
      message.id = this.generateId();
    }
    if (!message.timestamp) {
      message.timestamp = new Date();
    }
    if (!message.priority) {
      message.priority = 'medium';
    }
    if (!message.subsystem) {
      message.subsystem = 'agent-framework';
    }

    // Calculate expiration
    const ttl = message.ttl || this.DEFAULT_TTL;
    message.expiresAt = Date.now() + ttl;

    // Check if already expired
    if (Date.now() > message.expiresAt) {
      logger.warn(`Message expired before delivery: ${message.id}`);
      this.metrics.totalExpired++;
      return;
    }

    // Initialize delivery attempts
    message.deliveryAttempts = (message.deliveryAttempts || 0) + 1;
    message.maxDeliveryAttempts = message.maxDeliveryAttempts || this.DEFAULT_DELIVERY_ATTEMPTS;

    // Add to history
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.MAX_HISTORY) {
      this.messageHistory.shift();
    }

    // Increment metrics
    this.metrics.totalPublished++;
    this.metrics.messagesByType.set(
      message.type,
      (this.metrics.messagesByType.get(message.type) || 0) + 1
    );

    // Emit for monitoring
    this.emit('message', message);

    // Persist to Redis if enabled
    if (this.redis && this.redisReady) {
      await this.persistToRedis(message);
    }

    // Add to priority queue
    const priorityQueue = this.processingQueue.get(message.priority)!;
    priorityQueue.push(message);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processMessageQueue();
    }
  }

  /**
   * Process messages from priority queues
   */
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (true) {
        // Get highest priority message
        let message: AgentMessage | undefined;
        for (const priority of ['critical', 'high', 'medium', 'low'] as MessagePriority[]) {
          const queue = this.processingQueue.get(priority)!;
          if (queue.length > 0) {
            message = queue.shift();
            break;
          }
        }

        if (!message) break;

        // Check TTL
        if (message.expiresAt && Date.now() > message.expiresAt) {
          logger.warn(`Message expired during processing: ${message.id}`);
          this.metrics.totalExpired++;
          continue;
        }

        // Deliver
        const startTime = Date.now();
        try {
          await this.deliverToSubscribers(message);
          const deliveryTime = Date.now() - startTime;
          this.metrics.deliveryTimes.push(deliveryTime);
          if (this.metrics.deliveryTimes.length > 100) {
            this.metrics.deliveryTimes.shift();
          }
          this.metrics.avgDeliveryTime =
            this.metrics.deliveryTimes.reduce((a, b) => a + b, 0) / this.metrics.deliveryTimes.length;
          this.metrics.totalDelivered++;
        } catch (error) {
          logger.error(`Failed to deliver message ${message.id}:`, error);
          
          // Retry or DLQ
          if (message.deliveryAttempts! < message.maxDeliveryAttempts!) {
            logger.info(`Retrying message ${message.id} (attempt ${message.deliveryAttempts}/${message.maxDeliveryAttempts})`);
            this.processingQueue.get(message.priority)!.push(message);
          } else {
            this.metrics.totalFailed++;
            this.addToDeadLetterQueue(message, `Failed after ${message.maxDeliveryAttempts} attempts`);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Deliver message to subscribers
   */
  private async deliverToSubscribers(message: AgentMessage): Promise<void> {
    const subscribers = this.subscribers.get(message.type);
    
    if (!subscribers || subscribers.size === 0) {
      const errorMsg = `No subscribers for message type: ${message.type}`;
      logger.warn(`[DLQ] ${errorMsg}`);
      
      // Alert and add to DLQ
      this.emit('no-subscribers', {
        messageType: message.type,
        messageId: message.id,
        from: message.from,
        timestamp: new Date(),
      });
      
      this.addToDeadLetterQueue(message, errorMsg);
      this.metrics.totalDLQ++;
      return;
    }

    // Filter recipients
    const recipients: Subscriber[] = [];
    for (const subscriber of subscribers) {
      if (Array.isArray(message.to)) {
        if (message.to.includes(subscriber.agentId)) {
          recipients.push(subscriber);
        }
      } else if (message.to === 'broadcast' || message.to === subscriber.agentId) {
        recipients.push(subscriber);
      }
    }

    if (recipients.length === 0) {
      const errorMsg = `No matching recipients for message to: ${message.to}`;
      logger.warn(`[DLQ] ${errorMsg}`);
      this.addToDeadLetterQueue(message, errorMsg);
      return;
    }

    // Deliver concurrently
    const deliveryPromises = recipients.map(subscriber =>
      this.deliverToSubscriber(subscriber, message)
    );

    const results = await Promise.allSettled(deliveryPromises);
    
    // Check for any failures
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.warn(`Message delivery had ${failures.length} failures`);
      throw new Error(`${failures.length} delivery failures`);
    }
  }

  /**
   * Deliver message to a single subscriber
   */
  private async deliverToSubscriber(
    subscriber: Subscriber,
    message: AgentMessage
  ): Promise<void> {
    try {
      await subscriber.handler(message);
      logger.debug(`Delivered ${message.type} to ${subscriber.agentId}`);
    } catch (error) {
      logger.error(`Failed to deliver message to ${subscriber.agentId}: ${message.type}`, error);
      throw error;
    }
  }

  /**
   * Request-response pattern with correlation and timeout
   */
  async request(
    message: AgentMessage,
    timeout: number = 5000
  ): Promise<any> {
    const correlationId = message.correlationId || this.generateId();
    message.correlationId = correlationId;
    message.requiresResponse = true;

    const responsePromise = new Promise<any>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingResponses.delete(correlationId);
        this.metrics.totalTimeouts++;
        logger.warn(`Request timeout for ${message.type} (${correlationId})`);
        reject(new Error(`Request timeout for ${message.type}`));
      }, timeout);

      this.pendingResponses.set(correlationId, {
        resolve,
        reject,
        timeout: timeoutHandle
      });
    });

    await this.publish(message);
    return responsePromise;
  }

  /**
   * Respond to a request
   */
  async respond(
    correlationId: string,
    payload: any
  ): Promise<void> {
    const pending = this.pendingResponses.get(correlationId);
    if (!pending) {
      logger.warn(`No pending request for correlation ID: ${correlationId}`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingResponses.delete(correlationId);
    pending.resolve(payload);
    this.metrics.totalResponses++;
  }

  /**
   * Broadcast to all subscribers of a type
   */
  async broadcast(
    messageType: MessageType,
    payload: any,
    sender: string,
    priority: MessagePriority = 'medium'
  ): Promise<void> {
    const message: AgentMessage = {
      id: this.generateId(),
      from: sender,
      to: 'broadcast',
      type: messageType,
      payload,
      timestamp: new Date(),
      priority,
      requiresResponse: false,
      subsystem: 'agent-framework',
    };

    await this.publish(message);
  }

  /**
   * Add message to Dead Letter Queue
   */
  private addToDeadLetterQueue(message: AgentMessage, reason: string): void {
    this.deadLetterQueue.push(message);
    if (this.deadLetterQueue.length > this.MAX_DLQ) {
      this.deadLetterQueue.shift();
    }

    logger.error(`Message added to DLQ: ${message.id} - Reason: ${reason}`);
    this.emit('dlq-message', {
      messageId: message.id,
      type: message.type,
      reason,
      timestamp: new Date(),
    });
  }

  /**
   * Persist message to Redis
   */
  private async persistToRedis(message: AgentMessage): Promise<void> {
    if (!this.redis || !this.redisReady) return;

    try {
      const key = `mtaa:msg:pending:${message.id}`;
      const ttl = (message.expiresAt! - Date.now()) / 1000; // Convert to seconds
      
      if (ttl > 0) {
        await this.redis.setex(
          key,
          Math.ceil(ttl),
          JSON.stringify(message)
        );
      }
    } catch (error) {
      logger.error('Failed to persist message to Redis:', error);
    }
  }

  /**
   * Get message history
   */
  getHistory(limit?: number): AgentMessage[] {
    if (limit) {
      return this.messageHistory.slice(-limit);
    }
    return [...this.messageHistory];
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(limit?: number): AgentMessage[] {
    if (limit) {
      return this.deadLetterQueue.slice(-limit);
    }
    return [...this.deadLetterQueue];
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    const subscriberCount = Array.from(this.subscribers.values())
      .reduce((sum, set) => sum + set.size, 0);

    return {
      totalPublished: this.metrics.totalPublished,
      totalDelivered: this.metrics.totalDelivered,
      totalFailed: this.metrics.totalFailed,
      totalExpired: this.metrics.totalExpired,
      totalDLQ: this.metrics.totalDLQ,
      totalResponses: this.metrics.totalResponses,
      totalTimeouts: this.metrics.totalTimeouts,
      subscriberCount,
      pendingResponses: this.pendingResponses.size,
      messagesByType: Object.fromEntries(this.metrics.messagesByType),
      subscribersByType: Object.fromEntries(this.metrics.subscribersByType),
      avgDeliveryTime: Math.round(this.metrics.avgDeliveryTime * 100) / 100,
      historySize: this.messageHistory.length,
      dlqSize: this.deadLetterQueue.length,
      redisConnected: this.redisReady,
      queueDepth: {
        critical: this.processingQueue.get('critical')?.length || 0,
        high: this.processingQueue.get('high')?.length || 0,
        medium: this.processingQueue.get('medium')?.length || 0,
        low: this.processingQueue.get('low')?.length || 0,
      },
    };
  }

  /**
   * Publish to Redis for cross-process communication
   */
  async publishToRedis(message: AgentMessage): Promise<void> {
    if (!this.redis || !this.redisReady) return;

    try {
      await this.redis.publish('mtaa:message-bus', JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to publish message to Redis:', error);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Bridge message from coordinator subsystem
   */
  async bridgeFromCoordinator(message: any): Promise<void> {
    const bridgedMessage: AgentMessage = {
      id: message.id || this.generateId(),
      from: message.from || 'coordinator',
      to: message.to || 'broadcast',
      type: (message.topic || message.type) as MessageType,
      payload: message.data || message.payload,
      timestamp: message.timestamp || new Date(),
      priority: (message.priority || 'medium') as MessagePriority,
      requiresResponse: message.requiresResponse || false,
      subsystem: 'coordinator',
      correlationId: message.correlationId,
      ttl: message.ttl,
    };

    await this.publish(bridgedMessage);
  }

  /**
   * Bridge message from gateway subsystem
   */
  async bridgeFromGateway(message: any): Promise<void> {
    const bridgedMessage: AgentMessage = {
      id: message.id || this.generateId(),
      from: message.from || 'gateway',
      to: message.to || 'broadcast',
      type: (message.type) as MessageType,
      payload: message.payload,
      timestamp: message.timestamp || new Date(),
      priority: (message.priority || 'medium') as MessagePriority,
      requiresResponse: message.requiresResponse || false,
      subsystem: 'gateway',
      correlationId: message.correlationId,
      ttl: message.ttl,
    };

    await this.publish(bridgedMessage);
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down EnhancedMessageBus');
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Flush pending messages to Redis for recovery
    if (this.redis && this.redisReady) {
      for (const message of this.messageHistory) {
        await this.persistToRedis(message);
      }
    }

    this.removeAllListeners();
  }
}

// Singleton instance
let messageBusInstance: EnhancedMessageBus | null = null;

/**
 * Initialize the message bus with optional Redis
 */
export function initializeMessageBus(redisClient?: Redis): EnhancedMessageBus {
  if (!messageBusInstance) {
    messageBusInstance = new EnhancedMessageBus(redisClient);
  }
  return messageBusInstance;
}

/**
 * Get the message bus instance
 */
export function getMessageBus(): EnhancedMessageBus {
  if (!messageBusInstance) {
    messageBusInstance = new EnhancedMessageBus();
  }
  return messageBusInstance;
}

// Export singleton as default
export const messageBus = getMessageBus();
