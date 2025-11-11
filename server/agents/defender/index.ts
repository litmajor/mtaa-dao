
/**
 * Defender Agent - The Iron Wall and Intelligent Sentry
 * Codename: DEF-OBSIDIAN
 * 
 * Active threat prevention, mitigation, and system integrity enforcement
 */

import { BaseAgent, AgentStatus } from '../framework/base-agent';
import { EthicsModule } from './ethics-module';
import { ThreatDetectionEngine } from './threat-engine';
import { QuarantineManager } from './quarantine-manager';
import {
  DefenseMode,
  ThreatLevel,
  ActionType,
  AgentBehavior,
  DefenseAction,
  DefenderMetrics
} from './types';
import crypto from 'crypto';

export class DefenderAgent extends BaseAgent {
  private mode: DefenseMode = DefenseMode.SILENT_MONITOR;
  private ethics: EthicsModule;
  private threatEngine: ThreatDetectionEngine;
  private quarantineManager: QuarantineManager;
  
  // State tracking
  private trustScores: Map<string, number> = new Map();
  private behavioralHistory: Map<string, AgentBehavior[]> = new Map();
  private activeThreats: Map<string, ThreatLevel> = new Map();
  private defenseActions: DefenseAction[] = [];
  
  // Collaboration interfaces
  private watcherFeed: Array<{ timestamp: Date; signal: any }> = [];
  private analyzerReports: Array<{ timestamp: Date; report: any }> = [];
  private commanderAlerts: Array<{ timestamp: Date; alert: any }> = [];
  
  private monitoringInterval?: NodeJS.Timeout;
  private readonly MAX_HISTORY = 1000;

  constructor(agentId: string) {
    super({
      id: `DEF-OBSIDIAN-${agentId}`,
      name: 'Defender',
      version: '1.0.0',
      capabilities: ['threat_detection', 'quarantine', 'ethics_review', 'real_time_monitoring']
    });

    this.ethics = new EthicsModule();
    this.threatEngine = new ThreatDetectionEngine();
    this.quarantineManager = new QuarantineManager();
  }

  async initialize(): Promise<void> {
    this.setStatus(AgentStatus.ACTIVE);
    this.startContinuousMonitor();
    console.log(`[${this.config.id}] Defender Agent initialized and active`);
  }

  async process(data: AgentBehavior): Promise<DefenseAction | null> {
    return this.act(data);
  }

  async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.setStatus(AgentStatus.PAUSED);
    console.log(`[${this.config.id}] Defender Agent shutting down gracefully`);
  }

  // Collaboration methods
  receiveWatcherSignal(signal: any): void {
    this.watcherFeed.push({
      timestamp: new Date(),
      signal
    });

    // Maintain feed size
    if (this.watcherFeed.length > this.MAX_HISTORY) {
      this.watcherFeed.shift();
    }

    // Switch to reactive mode if threat detected
    if (signal.threat_level && signal.threat_level > 2) {
      this.mode = DefenseMode.REACTIVE_DEFENSE;
      console.warn(`[${this.config.id}] Switching to REACTIVE_DEFENSE mode due to Watcher signal`);
    }
  }

  receiveAnalyzerReport(report: any): void {
    this.analyzerReports.push({
      timestamp: new Date(),
      report
    });

    // Maintain report size
    if (this.analyzerReports.length > 500) {
      this.analyzerReports.shift();
    }

    // Update trust scores based on analyzer findings
    if (report.agent_id && report.risk_score !== undefined) {
      const currentTrust = this.trustScores.get(report.agent_id) || 1.0;
      const newTrust = Math.max(0.0, currentTrust - report.risk_score * 0.1);
      this.trustScores.set(report.agent_id, newTrust);
    }
  }

  assessThreat(behavior: AgentBehavior): {
    threatLevel: ThreatLevel;
    confidence: number;
    justification: string;
  } {
    // Behavioral analysis
    const { threatLevel, confidence, matchedSignatures } = 
      this.threatEngine.analyzeBehavior(behavior);

    // Trust score consideration
    const trustFactor = this.trustScores.get(behavior.agentId) || 1.0;
    let adjustedThreatLevel = threatLevel;
    let adjustedConfidence = confidence;

    if (trustFactor < 0.3) {
      adjustedThreatLevel = Math.min(ThreatLevel.CRITICAL, threatLevel + 1);
      adjustedConfidence = Math.min(1.0, confidence + 0.2);
    }

    // Historical behavior analysis
    const history = this.behavioralHistory.get(behavior.agentId) || [];
    if (history.length > 5) {
      const recentAnomalies = history.slice(-5).filter(b => b.maliciousScore > 0.5).length;
      if (recentAnomalies >= 3) {
        adjustedThreatLevel = Math.min(ThreatLevel.CRITICAL, adjustedThreatLevel + 1);
      }
    }

    const justification = `Threat signatures: ${matchedSignatures.join(', ')}, Trust: ${trustFactor.toFixed(2)}, History anomalies: ${history.length}`;

    return {
      threatLevel: adjustedThreatLevel,
      confidence: adjustedConfidence,
      justification
    };
  }

  executeDefenseAction(
    actionType: ActionType,
    targetAgent: string,
    threatLevel: ThreatLevel,
    justification: string
  ): DefenseAction {
    const actionId = crypto
      .createHash('md5')
      .update(`${targetAgent}:${actionType}:${Date.now()}`)
      .digest('hex')
      .substring(0, 8);

    // Request ethical approval
    let ethicalApproval: boolean;
    let ethicalReasoning: string;

    if (this.mode !== DefenseMode.ENGAGED_COMBAT) {
      this.mode = DefenseMode.ETHICAL_WAIT;
      const review = this.ethics.reviewAction(actionType, targetAgent, justification, threatLevel);
      ethicalApproval = review.approval;
      ethicalReasoning = review.reasoning;
    } else {
      // In combat mode, assume emergency approval for critical threats
      ethicalApproval = threatLevel >= ThreatLevel.HIGH;
      ethicalReasoning = 'Emergency combat mode - immediate action required';
    }

    const action: DefenseAction = {
      actionId,
      actionType,
      targetAgent,
      justification: `${justification} | Ethics: ${ethicalReasoning}`,
      ethicalApproval,
      timestamp: new Date(),
      success: false
    };

    if (ethicalApproval) {
      const success = this.executeAction(action);
      action.success = success;

      if (success) {
        console.log(`[${this.config.id}] Successfully executed ${actionType} on ${targetAgent}`);
      } else {
        console.error(`[${this.config.id}] Failed to execute ${actionType} on ${targetAgent}`);
      }
    } else {
      console.warn(`[${this.config.id}] Action ${actionType} on ${targetAgent} denied by LUMEN ethics`);
    }

    this.defenseActions.push(action);
    this.ethics.logAction(action);

    // Maintain action history size
    if (this.defenseActions.length > this.MAX_HISTORY) {
      this.defenseActions.shift();
    }

    return action;
  }

  private executeAction(action: DefenseAction): boolean {
    try {
      switch (action.actionType) {
        case ActionType.QUARANTINE:
          return this.quarantineManager.quarantineAgent(action.targetAgent, {
            networkIsolation: true,
            resourceLimit: 0.1,
            monitoringLevel: 'high'
          });

        case ActionType.ISOLATE:
          return this.quarantineManager.quarantineAgent(action.targetAgent, {
            networkIsolation: true,
            resourceLimit: 0.05,
            monitoringLevel: 'maximum'
          });

        case ActionType.BLOCK:
          console.log(`[${this.config.id}] Blocking access for agent ${action.targetAgent}`);
          return true;

        case ActionType.MONITOR:
          console.log(`[${this.config.id}] Enhanced monitoring activated for agent ${action.targetAgent}`);
          return true;

        case ActionType.ALERT:
          this.commanderAlerts.push({
            timestamp: new Date(),
            alert: {
              agent: action.targetAgent,
              action: action.actionType,
              justification: action.justification
            }
          });
          return true;

        case ActionType.PURGE:
          console.error(`[${this.config.id}] PURGE action executed on agent ${action.targetAgent}`);
          return this.quarantineManager.quarantineAgent(action.targetAgent, {
            networkIsolation: true,
            resourceLimit: 0,
            monitoringLevel: 'maximum',
            violations: ['PURGED']
          });

        default:
          return false;
      }
    } catch (error) {
      console.error(`[${this.config.id}] Action execution failed:`, error);
      return false;
    }
  }

  act(behavior: AgentBehavior): DefenseAction | null {
    const startTime = Date.now();

    try {
      // Store behavioral history
      const history = this.behavioralHistory.get(behavior.agentId) || [];
      history.push(behavior);
      this.behavioralHistory.set(behavior.agentId, history);

      // Maintain history size
      if (history.length > 100) {
        history.shift();
      }

      // Assess threat
      const { threatLevel, confidence, justification } = this.assessThreat(behavior);

      // Update active threats tracking
      if (threatLevel > ThreatLevel.BENIGN) {
        this.activeThreats.set(behavior.agentId, threatLevel);
      } else {
        this.activeThreats.delete(behavior.agentId);
      }

      // Determine appropriate action
      const actionType = this.determineAction(threatLevel, confidence, behavior.agentId);

      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, true);

      if (actionType) {
        return this.executeDefenseAction(actionType, behavior.agentId, threatLevel, justification);
      }

      return null;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, false);
      console.error(`[${this.config.id}] Error in act():`, error);
      return null;
    }
  }

  private determineAction(
    threatLevel: ThreatLevel,
    confidence: number,
    agentId: string
  ): ActionType | null {
    // Check if already quarantined
    if (this.quarantineManager.isQuarantined(agentId)) {
      if (threatLevel === ThreatLevel.CRITICAL && confidence > 0.9) {
        return ActionType.PURGE;
      }
      return null;
    }

    // Action decision matrix
    if (threatLevel === ThreatLevel.CRITICAL) {
      return confidence > 0.8 ? ActionType.ISOLATE : ActionType.QUARANTINE;
    } else if (threatLevel === ThreatLevel.HIGH) {
      return confidence > 0.7 ? ActionType.QUARANTINE : ActionType.BLOCK;
    } else if (threatLevel === ThreatLevel.MODERATE) {
      return confidence > 0.6 ? ActionType.BLOCK : ActionType.MONITOR;
    } else if (threatLevel === ThreatLevel.SUSPICIOUS) {
      return confidence > 0.5 ? ActionType.MONITOR : ActionType.ALERT;
    }

    return null;
  }

  private startContinuousMonitor(): void {
    this.monitoringInterval = setInterval(() => {
      try {
        // Check for escalating threats
        const escalatedThreats: string[] = [];

        for (const [agentId, threatLevel] of this.activeThreats.entries()) {
          const history = this.behavioralHistory.get(agentId) || [];
          if (history.length >= 3) {
            const recentScores = history.slice(-3).map(b => b.maliciousScore);
            if (recentScores.every(score => score > 0.6)) {
              escalatedThreats.push(agentId);
            }
          }
        }

        // Handle escalated threats
        for (const agentId of escalatedThreats) {
          if (!this.quarantineManager.isQuarantined(agentId)) {
            console.warn(`[${this.config.id}] Escalated threat detected for ${agentId} - initiating containment`);
            this.executeDefenseAction(
              ActionType.QUARANTINE,
              agentId,
              ThreatLevel.HIGH,
              'Escalated threat pattern detected'
            );
          }
        }

        // Switch back to monitoring mode if no active threats
        if (this.activeThreats.size === 0 && this.mode === DefenseMode.REACTIVE_DEFENSE) {
          this.mode = DefenseMode.SILENT_MONITOR;
          console.log(`[${this.config.id}] Switching back to SILENT_MONITOR mode`);
        }
      } catch (error) {
        console.error(`[${this.config.id}] Monitoring thread error:`, error);
      }
    }, 5000); // Monitor every 5 seconds
  }

  getSystemStatus(): DefenderMetrics {
    const trustScoresArray = Array.from(this.trustScores.values());
    const avgTrust = trustScoresArray.length > 0
      ? trustScoresArray.reduce((a, b) => a + b, 0) / trustScoresArray.length
      : 1.0;

    return {
      agentId: this.config.id,
      mode: this.mode,
      activeThreats: this.activeThreats.size,
      quarantinedAgents: this.quarantineManager.getQuarantineStatus().quarantinedCount,
      totalActions: this.defenseActions.length,
      recentActions: this.defenseActions.slice(-10).map(a => ({
        action: a.actionType,
        target: a.targetAgent,
        success: a.success,
        timestamp: a.timestamp
      })),
      trustScoresSummary: {
        avgTrust,
        lowTrustAgents: Array.from(this.trustScores.entries())
          .filter(([_, v]) => v < 0.3)
          .map(([k, _]) => k),
        highTrustAgents: Array.from(this.trustScores.entries())
          .filter(([_, v]) => v > 0.9)
          .map(([k, _]) => k)
      },
      quarantineStatus: this.quarantineManager.getQuarantineStatus()
    };
  }
}

export * from './types';
