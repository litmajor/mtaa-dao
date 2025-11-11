
/**
 * Agent Communicator - Simplifies agent-to-agent communication
 * 
 * Wraps the message bus with agent-specific helpers
 */

import { messageBus, MessageBus, MessageType, AgentMessage, MessagePriority } from './message-bus';
import { Logger } from '../../utils/logger';

const logger = new Logger('agent-communicator');

export class AgentCommunicator {
  constructor(
    private agentId: string,
    private bus: MessageBus = messageBus
  ) {}

  /**
   * Subscribe to message types
   */
  subscribe(
    messageTypes: MessageType[],
    handler: (message: AgentMessage) => Promise<void>
  ): void {
    this.bus.subscribe(this.agentId, messageTypes, handler);
  }

  /**
   * Unsubscribe from message types
   */
  unsubscribe(messageTypes?: MessageType[]): void {
    this.bus.unsubscribe(this.agentId, messageTypes);
  }

  /**
   * Send message to specific agent
   */
  async sendTo(
    recipientId: string,
    messageType: MessageType,
    payload: any,
    priority: MessagePriority = 'medium'
  ): Promise<void> {
    const message: AgentMessage = {
      id: this.generateId(),
      from: this.agentId,
      to: recipientId,
      type: messageType,
      payload,
      timestamp: new Date(),
      priority,
      requiresResponse: false
    };

    await this.bus.publish(message);
    logger.debug(`${this.agentId} sent ${messageType} to ${recipientId}`);
  }

  /**
   * Request data from another agent
   */
  async requestFrom(
    recipientId: string,
    messageType: MessageType,
    payload: any,
    timeout: number = 5000
  ): Promise<any> {
    const message: AgentMessage = {
      id: this.generateId(),
      from: this.agentId,
      to: recipientId,
      type: messageType,
      payload,
      timestamp: new Date(),
      priority: 'high',
      requiresResponse: true
    };

    logger.debug(`${this.agentId} requesting ${messageType} from ${recipientId}`);
    return await this.bus.request(message, timeout);
  }

  /**
   * Respond to a request
   */
  async respond(correlationId: string, payload: any): Promise<void> {
    await this.bus.respond(correlationId, payload);
  }

  /**
   * Broadcast to all agents
   */
  async broadcast(
    messageType: MessageType,
    payload: any,
    priority: MessagePriority = 'medium'
  ): Promise<void> {
    await this.bus.broadcast(messageType, payload, this.agentId, priority);
    logger.debug(`${this.agentId} broadcast ${messageType}`);
  }

  /**
   * Notify AI layer (NURU, KWETU, or MORIO)
   */
  async notifyAI(
    component: 'NURU' | 'KWETU' | 'MORIO',
    messageType: MessageType,
    payload: any
  ): Promise<void> {
    await this.sendTo(component, messageType, payload, 'high');
  }

  /**
   * Request analysis from ANALYZER
   */
  async requestAnalysis(analysisType: string, data: any): Promise<any> {
    return await this.requestFrom(
      'ANL-MTAA-001',
      MessageType.ANALYSIS_REQUEST,
      { type: analysisType, data }
    );
  }

  /**
   * Request sync from SYNCHRONIZER
   */
  async requestSync(nodeId: string, state: any): Promise<any> {
    return await this.requestFrom(
      'SYNC-MTAA-001',
      MessageType.STATE_SYNC,
      { nodeId, state }
    );
  }

  /**
   * Report threat to DEFENDER
   */
  async reportThreat(threat: any): Promise<void> {
    await this.sendTo(
      'DEF-OBSIDIAN-001',
      MessageType.THREAT_DETECTED,
      threat,
      'critical'
    );
  }

  private generateId(): string {
    return `${this.agentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
