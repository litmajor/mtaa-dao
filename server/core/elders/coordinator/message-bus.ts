/**
 * Coordinator Message Bus
 * 
 * Enables publish/subscribe communication between elders
 * Each elder can broadcast messages and subscribe to relevant topics
 */

import EventEmitter from 'eventemitter3';

/**
 * Message types that can be published
 */
export type MessageTopic = 
  | 'scry:threat-detected'
  | 'scry:forecast-updated'
  | 'scry:analysis-complete'
  | 'kaizen:recommendation-generated'
  | 'kaizen:optimization-applied'
  | 'kaizen:metrics-updated'
  | 'lumen:review-complete'
  | 'lumen:ethics-violation-detected'
  | 'lumen:compliance-status-updated'
  | 'coordinator:consensus-request'
  | 'coordinator:decision-made'
  | 'coordinator:alert-escalated';

/**
 * Message structure
 */
export interface CoordinatorMessage {
  id: string;
  topic: MessageTopic;
  from: 'SCRY' | 'KAIZEN' | 'LUMEN' | 'COORDINATOR';
  to?: 'SCRY' | 'KAIZEN' | 'LUMEN' | 'COORDINATOR' | 'ALL';
  daoId?: string;
  data: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timestamp: Date;
  requiresResponse?: boolean;
  responseDeadline?: Date;
}

/**
 * Message handler callback
 */
export type MessageHandler = (message: CoordinatorMessage) => Promise<void> | void;

/**
 * Message subscription
 */
interface Subscription {
  id: string;
  topic: MessageTopic | 'ALL';
  handler: MessageHandler;
  filter?: (msg: CoordinatorMessage) => boolean;
}

/**
 * Coordinator Message Bus
 */
export class CoordinatorMessageBus extends EventEmitter {
  private subscriptions: Map<string, Subscription> = new Map();
  private messageHistory: CoordinatorMessage[] = [];
  private messageQueues: Map<string, CoordinatorMessage[]> = new Map();
  private maxHistorySize = 10000;
  private deliveryAttempts: Map<string, number> = new Map();
  private maxDeliveryAttempts = 3;

  constructor() {
    super();
    this.setupQueues();
    console.log('[CoordinatorMessageBus] Initialized');
  }

  /**
   * Setup message queues for each elder
   */
  private setupQueues(): void {
    this.messageQueues.set('SCRY', []);
    this.messageQueues.set('KAIZEN', []);
    this.messageQueues.set('LUMEN', []);
    this.messageQueues.set('COORDINATOR', []);
  }

  /**
   * Publish a message
   */
  async publishMessage(message: CoordinatorMessage): Promise<void> {
    const startTime = Date.now();

    try {
      // Add to history
      this.addToHistory(message);

      // Get matching subscriptions
      const matchingSubscriptions = this.getMatchingSubscriptions(message);

      if (matchingSubscriptions.length === 0) {
        console.warn(`[CoordinatorMessageBus] No subscriptions for topic: ${message.topic}`);
      }

      // Deliver to all matching subscriptions
      const deliveryPromises = matchingSubscriptions.map(sub => 
        this.deliverMessage(message, sub)
      );

      await Promise.allSettled(deliveryPromises);

      const duration = Date.now() - startTime;
      console.log(
        `[CoordinatorMessageBus] Published ${message.topic} from ${message.from} in ${duration}ms`
      );

      this.emit('message:published', {
        topic: message.topic,
        from: message.from,
        deliveredTo: matchingSubscriptions.length,
        duration
      });
    } catch (error) {
      console.error('[CoordinatorMessageBus] Error publishing message:', error);
      this.emit('message:error', { message, error });
    }
  }

  /**
   * Subscribe to messages
   */
  subscribe(
    topic: MessageTopic | 'ALL',
    handler: MessageHandler,
    filter?: (msg: CoordinatorMessage) => boolean
  ): string {
    const subscriptionId = `${topic}-${Date.now()}-${Math.random()}`;

    const subscription: Subscription = {
      id: subscriptionId,
      topic,
      handler,
      filter
    };

    this.subscriptions.set(subscriptionId, subscription);

    console.log(`[CoordinatorMessageBus] New subscription: ${subscriptionId} for topic ${topic}`);

    return subscriptionId;
  }

  /**
   * Unsubscribe from messages
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Get all subscriptions for a topic
   */
  getSubscriptions(topic: MessageTopic | 'ALL'): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => 
      sub.topic === 'ALL' || sub.topic === topic
    );
  }

  /**
   * Get matching subscriptions for a message
   */
  private getMatchingSubscriptions(message: CoordinatorMessage): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => {
      // Topic matches (specific or wildcard)
      if (sub.topic !== 'ALL' && sub.topic !== message.topic) {
        return false;
      }

      // Filter function matches (if provided)
      if (sub.filter && !sub.filter(message)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Deliver message to a subscription
   */
  private async deliverMessage(
    message: CoordinatorMessage,
    subscription: Subscription
  ): Promise<void> {
    const attemptKey = `${message.id}-${subscription.id}`;
    const attempts = this.deliveryAttempts.get(attemptKey) || 0;

    try {
      await subscription.handler(message);
      this.deliveryAttempts.delete(attemptKey);
    } catch (error) {
      console.error(
        `[CoordinatorMessageBus] Delivery error for ${message.topic}:`,
        error
      );

      // Retry logic for critical messages
      if (message.priority === 'critical' && attempts < this.maxDeliveryAttempts) {
        const nextAttempt = attempts + 1;
        this.deliveryAttempts.set(attemptKey, nextAttempt);

        // Schedule retry with backoff
        const backoffMs = Math.pow(2, nextAttempt) * 1000;
        setTimeout(() => {
          this.deliverMessage(message, subscription);
        }, backoffMs);
      }
    }
  }

  /**
   * Add message to history
   */
  private addToHistory(message: CoordinatorMessage): void {
    this.messageHistory.push(message);

    // Keep history size manageable
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get message history
   */
  getHistory(topic?: MessageTopic, limit: number = 100): CoordinatorMessage[] {
    let history = [...this.messageHistory];

    if (topic) {
      history = history.filter(m => m.topic === topic);
    }

    return history.slice(-limit);
  }

  /**
   * Get message history for a specific DAO
   */
  getDaoHistory(daoId: string, limit: number = 100): CoordinatorMessage[] {
    return this.messageHistory
      .filter(m => m.daoId === daoId)
      .slice(-limit);
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * Broadcast message to all elders
   */
  async broadcast(
    topic: MessageTopic,
    data: any,
    from: 'SCRY' | 'KAIZEN' | 'LUMEN' | 'COORDINATOR' = 'COORDINATOR',
    daoId?: string,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
  ): Promise<void> {
    const message: CoordinatorMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      topic,
      from,
      to: 'ALL',
      daoId,
      data,
      priority,
      timestamp: new Date()
    };

    await this.publishMessage(message);
  }

  /**
   * Send point-to-point message
   */
  async sendMessage(
    topic: MessageTopic,
    from: 'SCRY' | 'KAIZEN' | 'LUMEN' | 'COORDINATOR',
    to: 'SCRY' | 'KAIZEN' | 'LUMEN' | 'COORDINATOR',
    data: any,
    daoId?: string
  ): Promise<void> {
    const message: CoordinatorMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      topic,
      from,
      to,
      daoId,
      data,
      priority: 'normal',
      timestamp: new Date()
    };

    await this.publishMessage(message);
  }

  /**
   * Send critical alert
   */
  async sendCriticalAlert(
    topic: MessageTopic,
    from: 'SCRY' | 'KAIZEN' | 'LUMEN' | 'COORDINATOR',
    data: any,
    daoId?: string
  ): Promise<void> {
    const message: CoordinatorMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      topic,
      from,
      to: 'ALL',
      daoId,
      data,
      priority: 'critical',
      timestamp: new Date(),
      requiresResponse: true,
      responseDeadline: new Date(Date.now() + 60000) // 1 minute
    };

    await this.publishMessage(message);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalSubscriptions: this.subscriptions.size,
      subscriptionsByTopic: this.getSubscriptionsByTopic(),
      messageHistorySize: this.messageHistory.length,
      pendingDeliveries: this.deliveryAttempts.size,
      topics: Array.from(new Set(this.messageHistory.map(m => m.topic)))
    };
  }

  /**
   * Get subscriptions grouped by topic
   */
  private getSubscriptionsByTopic(): Record<string, number> {
    const result: Record<string, number> = {};
    
    this.subscriptions.forEach(sub => {
      const key = sub.topic;
      result[key] = (result[key] || 0) + 1;
    });

    return result;
  }

  /**
   * Shutdown message bus
   */
  shutdown(): void {
    console.log('[CoordinatorMessageBus] Shutting down message bus');
    this.subscriptions.clear();
    this.messageHistory = [];
    this.messageQueues.clear();
    this.deliveryAttempts.clear();
    this.emit('bus:shutdown');
  }
}

/**
 * Singleton instance
 */
export const coordinatorMessageBus = new CoordinatorMessageBus();
