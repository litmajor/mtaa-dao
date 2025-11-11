
/**
 * Message Bus - Central communication hub for all agents
 * 
 * Provides pub/sub, request/response, and broadcast patterns
 */

import { EventEmitter } from 'events';
import { Logger } from '../../utils/logger';

const logger = new Logger('message-bus');

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
  
  // System messages
  AGENT_ONLINE = 'agent_online',
  AGENT_OFFLINE = 'agent_offline',
  HEALTH_CHECK = 'health_check'
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
}

type MessageHandler = (message: AgentMessage) => Promise<void>;

interface Subscriber {
  agentId: string;
  handler: MessageHandler;
}

export class MessageBus extends EventEmitter {
  private subscribers: Map<MessageType, Set<Subscriber>> = new Map();
  private pendingResponses: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private messageHistory: AgentMessage[] = [];
  private readonly MAX_HISTORY = 1000;

  constructor() {
    super();
    this.setMaxListeners(100); // Increase for many agents
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
      this.subscribers.get(type)!.add(subscriber);
    });

    logger.info(`Agent ${agentId} subscribed to ${messageTypes.join(', ')}`);
  }

  /**
   * Unsubscribe from message types
   */
  unsubscribe(agentId: string, messageTypes?: MessageType[]): void {
    if (!messageTypes) {
      // Unsubscribe from all
      this.subscribers.forEach(subscribers => {
        subscribers.forEach(sub => {
          if (sub.agentId === agentId) {
            subscribers.delete(sub);
          }
        });
      });
    } else {
      messageTypes.forEach(type => {
        const subscribers = this.subscribers.get(type);
        if (subscribers) {
          subscribers.forEach(sub => {
            if (sub.agentId === agentId) {
              subscribers.delete(sub);
            }
          });
        }
      });
    }

    logger.info(`Agent ${agentId} unsubscribed`);
  }

  /**
   * Publish a message
   */
  async publish(message: AgentMessage): Promise<void> {
    // Add to history
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.MAX_HISTORY) {
      this.messageHistory.shift();
    }

    // Emit for monitoring
    this.emit('message', message);

    // Get subscribers
    const subscribers = this.subscribers.get(message.type);
    if (!subscribers || subscribers.size === 0) {
      logger.warn(`No subscribers for message type: ${message.type}`);
      return;
    }

    // Deliver to recipients
    const deliveryPromises: Promise<void>[] = [];

    for (const subscriber of subscribers) {
      // Check if subscriber is a recipient
      if (Array.isArray(message.to)) {
        if (!message.to.includes(subscriber.agentId)) continue;
      } else if (message.to !== 'broadcast' && message.to !== subscriber.agentId) {
        continue;
      }

      // Deliver message
      deliveryPromises.push(
        this.deliverMessage(subscriber, message)
      );
    }

    await Promise.allSettled(deliveryPromises);
  }

  /**
   * Request-response pattern
   */
  async request(
    message: AgentMessage,
    timeout: number = 5000
  ): Promise<any> {
    const correlationId = message.correlationId || this.generateId();
    message.correlationId = correlationId;
    message.requiresResponse = true;

    // Setup response handler
    const responsePromise = new Promise<any>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingResponses.delete(correlationId);
        reject(new Error(`Request timeout for ${message.type}`));
      }, timeout);

      this.pendingResponses.set(correlationId, {
        resolve,
        reject,
        timeout: timeoutHandle
      });
    });

    // Send request
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
  }

  /**
   * Broadcast to all subscribers
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
      requiresResponse: false
    };

    await this.publish(message);
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
   * Get statistics
   */
  getStats(): {
    totalMessages: number;
    subscriberCount: number;
    pendingResponses: number;
    messagesByType: Record<string, number>;
  } {
    const messagesByType: Record<string, number> = {};
    this.messageHistory.forEach(msg => {
      messagesByType[msg.type] = (messagesByType[msg.type] || 0) + 1;
    });

    return {
      totalMessages: this.messageHistory.length,
      subscriberCount: Array.from(this.subscribers.values())
        .reduce((sum, set) => sum + set.size, 0),
      pendingResponses: this.pendingResponses.size,
      messagesByType
    };
  }

  /**
   * Deliver message to subscriber
   */
  private async deliverMessage(
    subscriber: Subscriber,
    message: AgentMessage
  ): Promise<void> {
    try {
      await subscriber.handler(message);
      logger.debug(`Delivered ${message.type} to ${subscriber.agentId}`);
    } catch (error) {
      logger.error(`Failed to deliver message to ${subscriber.agentId}`, error);
      this.emit('delivery_error', { subscriber, message, error });
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const messageBus = new MessageBus();
