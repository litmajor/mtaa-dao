/**
 * Message Bus Bridge - Unifies Coordinator, Gateway, and Main Agent Framework
 * 
 * Bridges the three separate message bus subsystems into a single unified bus
 * with cross-subsystem message routing and coordination
 */

import { Logger } from '../../utils/logger';
import { type EnhancedMessageBus, MessageType } from './enhanced-message-bus';
import type {AgentMessage} from './enhanced-message-bus';
const logger = new Logger('message-bus-bridge');

/**
 * Message Bus Bridge
 */
export class MessageBusBridge {
  private mainBus: EnhancedMessageBus;
  private coordinatorBusAdapter: CoordinatorBridgeAdapter;
  private gatewayBusAdapter: GatewayBridgeAdapter;

  constructor(mainBus: EnhancedMessageBus) {
    this.mainBus = mainBus;
    this.coordinatorBusAdapter = new CoordinatorBridgeAdapter(mainBus);
    this.gatewayBusAdapter = new GatewayBridgeAdapter(mainBus);
    
    logger.info('MessageBusBridge initialized');
  }

  /**
   * Get the coordinator bridge adapter
   */
  getCoordinatorBridge(): CoordinatorBridgeAdapter {
    return this.coordinatorBusAdapter;
  }

  /**
   * Get the gateway bridge adapter
   */
  getGatewayBridge(): GatewayBridgeAdapter {
    return this.gatewayBusAdapter;
  }

  /**
   * Get the main bus
   */
  getMainBus(): EnhancedMessageBus {
    return this.mainBus;
  }
}

/**
 * Bridge adapter for Coordinator messages
 * 
 * Maps coordinator message topics to main bus message types
 */
export class CoordinatorBridgeAdapter {
  private mainBus: EnhancedMessageBus;
  
  // Topic to MessageType mapping
  private topicMap: Map<string, MessageType> = new Map([
    ['scry:threat-detected', MessageType.SCRY_THREAT_DETECTED],
    ['scry:forecast-updated', MessageType.SCRY_FORECAST_UPDATED],
    ['scry:analysis-complete', MessageType.SCRY_ANALYSIS_COMPLETE],
    ['kaizen:recommendation-generated', MessageType.KAIZEN_RECOMMENDATION_GENERATED],
    ['kaizen:optimization-applied', MessageType.KAIZEN_OPTIMIZATION_APPLIED],
    ['kaizen:metrics-updated', MessageType.KAIZEN_METRICS_UPDATED],
    ['lumen:review-complete', MessageType.LUMEN_REVIEW_COMPLETE],
    ['lumen:ethics-violation-detected', MessageType.LUMEN_ETHICS_VIOLATION_DETECTED],
    ['lumen:compliance-status-updated', MessageType.LUMEN_COMPLIANCE_STATUS_UPDATED],
    ['coordinator:consensus-request', MessageType.COORDINATOR_CONSENSUS_REQUEST],
    ['coordinator:decision-made', MessageType.COORDINATOR_DECISION_MADE],
    ['coordinator:alert-escalated', MessageType.COORDINATOR_ALERT_ESCALATED],
  ]);

  constructor(mainBus: EnhancedMessageBus) {
    this.mainBus = mainBus;
  }

  /**
   * Bridge a coordinator message to the main bus
   */
  async bridgeMessage(coordinatorMessage: any): Promise<void> {
    try {
      const topic = coordinatorMessage.topic || coordinatorMessage.type;
      const messageType = this.topicMap.get(topic);

      if (!messageType) {
        logger.warn(`Unknown coordinator topic: ${topic}`);
        return;
      }

      const bridgedMessage: AgentMessage = {
        id: coordinatorMessage.id || this.generateId(),
        from: coordinatorMessage.from || 'coordinator',
        to: this.mapRecipient(coordinatorMessage.to) || 'broadcast',
        type: messageType,
        payload: coordinatorMessage.data || coordinatorMessage.payload,
        timestamp: coordinatorMessage.timestamp || new Date(),
        priority: this.mapPriority(coordinatorMessage.priority) || 'medium',
        requiresResponse: coordinatorMessage.requiresResponse || false,
        subsystem: 'coordinator',
        correlationId: coordinatorMessage.correlationId,
        ttl: coordinatorMessage.ttl,
      };

      await this.mainBus.publish(bridgedMessage);
      logger.debug(`Bridged coordinator message ${topic} -> ${messageType}`);
    } catch (error) {
      logger.error('Failed to bridge coordinator message:', error);
    }
  }

  /**
   * Subscribe to coordinator messages (proxied through main bus)
   */
  subscribe(
    topic: string,
    handler: (message: any) => Promise<void>
  ): void {
    const messageType = this.topicMap.get(topic);
    if (!messageType) {
      logger.warn(`Cannot subscribe to unknown coordinator topic: ${topic}`);
      return;
    }

    this.mainBus.subscribe('coordinator-proxy', [messageType], async (message) => {
      // Reverse-map back to coordinator format
      const coordinatorMessage = {
        id: message.id,
        topic,
        from: message.from,
        to: message.to,
        data: message.payload,
        priority: message.priority,
        timestamp: message.timestamp,
        correlationId: message.correlationId,
      };

      await handler(coordinatorMessage);
    });
  }

  /**
   * Map coordinator recipient format to main bus format
   */
  private mapRecipient(to: string | undefined): string | undefined {
    if (!to || to === 'ALL') {
      return 'broadcast';
    }
    if (to === 'SCRY' || to === 'KAIZEN' || to === 'LUMEN' || to === 'COORDINATOR') {
      return to.toLowerCase();
    }
    return to;
  }

  /**
   * Map coordinator priority to main bus priority
   */
  private mapPriority(priority: string | undefined): 'low' | 'medium' | 'high' | 'critical' | undefined {
    switch (priority) {
      case 'critical':
      case 'high':
        return 'high';
      case 'normal':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return undefined;
    }
  }

  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Bridge adapter for Gateway messages
 * 
 * Maps gateway message types to main bus message types
 */
export class GatewayBridgeAdapter {
  private mainBus: EnhancedMessageBus;
  
  // Gateway type to MessageType mapping
  private typeMap: Map<string, MessageType> = new Map([
    ['gateway:price_request', MessageType.GATEWAY_PRICE_REQUEST],
    ['gateway:price_update', MessageType.GATEWAY_PRICE_UPDATE],
    ['gateway:liquidity_request', MessageType.GATEWAY_LIQUIDITY_REQUEST],
    ['gateway:liquidity_update', MessageType.GATEWAY_LIQUIDITY_UPDATE],
    ['gateway:execution_request', MessageType.GATEWAY_EXECUTION_REQUEST],
    ['gateway:execution_response', MessageType.GATEWAY_EXECUTION_RESPONSE],
  ]);

  constructor(mainBus: EnhancedMessageBus) {
    this.mainBus = mainBus;
  }

  /**
   * Bridge a gateway message to the main bus
   */
  async bridgeMessage(gatewayMessage: any): Promise<void> {
    try {
      const type = gatewayMessage.type;
      const messageType = this.typeMap.get(type);

      if (!messageType) {
        logger.warn(`Unknown gateway message type: ${type}`);
        return;
      }

      const bridgedMessage: AgentMessage = {
        id: gatewayMessage.id || this.generateId(),
        from: gatewayMessage.from || 'gateway',
        to: gatewayMessage.to || 'broadcast',
        type: messageType,
        payload: gatewayMessage.payload,
        timestamp: gatewayMessage.timestamp || new Date(),
        priority: gatewayMessage.priority || 'medium',
        requiresResponse: gatewayMessage.requiresResponse || false,
        subsystem: 'gateway',
        correlationId: gatewayMessage.correlationId,
        ttl: gatewayMessage.ttl,
      };

      await this.mainBus.publish(bridgedMessage);
      logger.debug(`Bridged gateway message ${type} -> ${messageType}`);
    } catch (error) {
      logger.error('Failed to bridge gateway message:', error);
    }
  }

  /**
   * Subscribe to gateway messages (proxied through main bus)
   */
  subscribe(
    type: string,
    handler: (message: any) => Promise<void>
  ): void {
    const messageType = this.typeMap.get(type);
    if (!messageType) {
      logger.warn(`Cannot subscribe to unknown gateway message type: ${type}`);
      return;
    }

    this.mainBus.subscribe('gateway-proxy', [messageType], async (message) => {
      // Format as gateway message
      const gatewayMessage = {
        id: message.id,
        type,
        from: message.from,
        to: message.to,
        payload: message.payload,
        priority: message.priority,
        timestamp: message.timestamp,
        correlationId: message.correlationId,
      };

      await handler(gatewayMessage);
    });
  }

  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
