
/**
 * Defender Agent Types
 * Based on DEF-OBSIDIAN Python implementation
 */

export enum ThreatLevel {
  BENIGN = 0,
  SUSPICIOUS = 1,
  MODERATE = 2,
  HIGH = 3,
  CRITICAL = 4
}

export enum DefenseMode {
  SILENT_MONITOR = 'silent_monitor',
  REACTIVE_DEFENSE = 'reactive_defense',
  ENGAGED_COMBAT = 'engaged_combat',
  ETHICAL_WAIT = 'ethical_wait',
  RECOVERY_SYNC = 'recovery_sync'
}

export enum ActionType {
  QUARANTINE = 'quarantine',
  BLOCK = 'block',
  ISOLATE = 'isolate',
  PURGE = 'purge',
  MONITOR = 'monitor',
  ALERT = 'alert'
}

export interface ThreatSignature {
  signatureId: string;
  pattern: Record<string, (indicators: Record<string, number>) => boolean>;
  severity: ThreatLevel;
  confidence: number;
  createdAt: Date;
}

export interface AgentBehavior {
  agentId: string;
  timestamp: Date;
  actions: string[];
  resourceUsage: Record<string, number>;
  communicationPatterns: Record<string, number>;
  anomalyIndicators: Record<string, number>;
  trustScore: number;
  maliciousScore: number;
}

export interface DefenseAction {
  actionId: string;
  actionType: ActionType;
  targetAgent: string;
  justification: string;
  ethicalApproval: boolean;
  timestamp: Date;
  success: boolean;
}

export interface QuarantinePolicy {
  networkIsolation: boolean;
  resourceLimit: number;
  monitoringLevel: 'low' | 'medium' | 'high' | 'maximum';
  violations?: string[];
}

export interface DefenderMetrics {
  agentId: string;
  mode: DefenseMode;
  activeThreats: number;
  quarantinedAgents: number;
  totalActions: number;
  recentActions: Array<{
    action: string;
    target: string;
    success: boolean;
    timestamp: Date;
  }>;
  trustScoresSummary: {
    avgTrust: number;
    lowTrustAgents: string[];
    highTrustAgents: string[];
  };
  quarantineStatus: {
    quarantinedCount: number;
    quarantinedAgents: string[];
    policies: Record<string, any>;
  };
}
