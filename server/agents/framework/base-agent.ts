
/**
 * Base Agent Framework
 * Provides common functionality for all agents
 */

export enum AgentStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ERROR = 'error'
}

export interface AgentConfig {
  id: string;
  name: string;
  version: string;
  capabilities: string[];
  agentStatus?: string;
  syncMode?: string;
  sequenceNumber?: number;
  trustedAgents?: string[];
}

export interface AgentMetrics {
  tasksProcessed: number;
  averageProcessingTime: number;
  errorRate: number;
  lastActive: Date;
}


export abstract class BaseAgent {
  protected config: AgentConfig;
  protected status: AgentStatus;
  protected metrics: AgentMetrics;
  protected startTime: Date;
  public agentStatus?: string;
  public syncMode?: string;
  public sequenceNumber?: number;
  public trustedAgents?: Set<string>;

  constructor(config: AgentConfig) {
    this.config = config;
    this.status = AgentStatus.INITIALIZING;
    this.startTime = new Date();
    this.metrics = {
      tasksProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      lastActive: new Date()
    };
    if (config.agentStatus) this.agentStatus = config.agentStatus;
    if (config.syncMode) this.syncMode = config.syncMode;
    if (config.sequenceNumber !== undefined) this.sequenceNumber = config.sequenceNumber;
    if (config.trustedAgents) this.trustedAgents = new Set(config.trustedAgents);
  }

  abstract initialize(): Promise<void>;
  abstract process(data: any): Promise<any>;
  abstract shutdown(): Promise<void>;

  getStatus(): AgentStatus {
    return this.status;
  }

  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  protected updateMetrics(processingTime: number, success: boolean): void {
    this.metrics.tasksProcessed++;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (this.metrics.tasksProcessed - 1) + processingTime) / 
      this.metrics.tasksProcessed;
    
    if (!success) {
      this.metrics.errorRate = 
        (this.metrics.errorRate * (this.metrics.tasksProcessed - 1) + 1) / 
        this.metrics.tasksProcessed;
    }
    
    this.metrics.lastActive = new Date();
  }

  protected setStatus(status: AgentStatus): void {
    this.status = status;
  }
}
