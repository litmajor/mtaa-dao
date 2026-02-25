/**
 * Agent Factory & Registry
 * Manages initialization and lifecycle of all system agents
 */

import { BaseAgent } from '../agents/framework/base-agent';
import { SynchronizerAgent } from '../agents/synchronizer';
import { TradingAgentBase } from '../agents/trading';
import { AnomalyDetectionAgent } from '../agents/anomaly-detection';
import { ComplianceAgent } from '../agents/compliance';
import { GovernanceAnalyticsAgent } from '../agents/governance';
import { Logger } from '../utils/logger';

const logger = new Logger('agent-factory');

export type AgentType =
  | 'synchronizer'
  | 'trading'
  | 'anomaly_detection'
  | 'compliance'
  | 'governance_analytics';

export interface AgentInfo {
  id: string;
  type: AgentType;
  name: string;
  instance: BaseAgent;
  status: 'initializing' | 'active' | 'paused' | 'error' | 'shutdown';
  createdAt: Date;
  lastActive: Date;
}

export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<string, AgentInfo> = new Map();
  private agentsByType: Map<AgentType, AgentInfo[]> = new Map();

  private constructor() {
    // Initialize type map
    [
      'synchronizer',
      'trading',
      'anomaly_detection',
      'compliance',
      'governance_analytics'
    ].forEach(type => {
      this.agentsByType.set(type as AgentType, []);
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  /**
   * Create and register an agent
   */
  async createAgent(type: AgentType, agentId?: string): Promise<AgentInfo> {
    let instance: BaseAgent;
    const id = agentId || `${type}-${Date.now()}`;

    try {
      switch (type) {
        case 'synchronizer':
          instance = new SynchronizerAgent(id);
          break;
        case 'trading':
          instance = new TradingAgentBase(id);
          break;
        case 'anomaly_detection':
          instance = new AnomalyDetectionAgent(id);
          break;
        case 'compliance':
          instance = new ComplianceAgent(id);
          break;
        case 'governance_analytics':
          instance = new GovernanceAnalyticsAgent(id);
          break;
        default:
          throw new Error(`Unknown agent type: ${type}`);
      }

      const agentInfo: AgentInfo = {
        id,
        type,
        name: instance.getConfig().name,
        instance,
        status: 'initializing',
        createdAt: new Date(),
        lastActive: new Date()
      };

      this.agents.set(id, agentInfo);
      this.agentsByType.get(type)!.push(agentInfo);

      logger.info(`[AgentFactory] Created ${type} agent: ${id}`);

      return agentInfo;
    } catch (error) {
      logger.error(`[AgentFactory] Failed to create ${type} agent:`, error);
      throw error;
    }
  }

  /**
   * Initialize an agent
   */
  async initializeAgent(agentId: string): Promise<void> {
    const info = this.agents.get(agentId);
    if (!info) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    try {
      info.status = 'initializing';
      await info.instance.initialize();
      info.status = 'active';
      info.lastActive = new Date();
      logger.info(`[AgentFactory] Initialized agent: ${agentId}`);
    } catch (error) {
      info.status = 'error';
      logger.error(`[AgentFactory] Failed to initialize agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Shutdown an agent
   */
  async shutdownAgent(agentId: string): Promise<void> {
    const info = this.agents.get(agentId);
    if (!info) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    try {
      await info.instance.shutdown();
      info.status = 'shutdown';
      logger.info(`[AgentFactory] Shutdown agent: ${agentId}`);
    } catch (error) {
      logger.error(`[AgentFactory] Failed to shutdown agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents of a type
   */
  getAgentsByType(type: AgentType): AgentInfo[] {
    return this.agentsByType.get(type) || [];
  }

  /**
   * Get all agents
   */
  getAllAgents(): AgentInfo[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get all active agents
   */
  getActiveAgents(): AgentInfo[] {
    return Array.from(this.agents.values()).filter(a => a.status === 'active');
  }

  /**
   * Pause agent
   */
  pauseAgent(agentId: string): void {
    const info = this.agents.get(agentId);
    if (info) {
      info.status = 'paused';
      logger.info(`[AgentFactory] Paused agent: ${agentId}`);
    }
  }

  /**
   * Resume agent
   */
  resumeAgent(agentId: string): void {
    const info = this.agents.get(agentId);
    if (info) {
      info.status = 'active';
      info.lastActive = new Date();
      logger.info(`[AgentFactory] Resumed agent: ${agentId}`);
    }
  }

  /**
   * Get agent status summary
   */
  getStatusSummary() {
    const allAgents = this.getAllAgents();
    return {
      totalAgents: allAgents.length,
      byType: {
        synchronizer: this.getAgentsByType('synchronizer').length,
        trading: this.getAgentsByType('trading').length,
        anomaly_detection: this.getAgentsByType('anomaly_detection').length,
        compliance: this.getAgentsByType('compliance').length,
        governance_analytics: this.getAgentsByType('governance_analytics').length
      },
      byStatus: {
        active: allAgents.filter(a => a.status === 'active').length,
        paused: allAgents.filter(a => a.status === 'paused').length,
        error: allAgents.filter(a => a.status === 'error').length,
        initializing: allAgents.filter(a => a.status === 'initializing').length,
        shutdown: allAgents.filter(a => a.status === 'shutdown').length
      }
    };
  }
}

export const agentRegistry = AgentRegistry.getInstance();
