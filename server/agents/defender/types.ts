
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

/**
 * User Roles in DAO
 */
export enum UserRole {
  MEMBER = 'member',
  TREASURER = 'treasurer',
  GOVERNANCE = 'governance',
  MULTISIG_SIGNER = 'multisig_signer',
  ADMIN = 'admin',
  BANNED = 'banned'
}

/**
 * Custom Validation Rule Type
 * Allows defender agent to enforce business logic at endpoint level
 */
export enum ValidationRuleType {
  AMOUNT_LIMIT = 'amount_limit',
  RECIPIENT_WHITELIST = 'recipient_whitelist',
  TIME_BASED = 'time_based',
  PRIVILEGE_CHECK = 'privilege_check',
  GOVERNANCE_APPROVAL = 'governance_approval',
  QUOTA_CHECK = 'quota_check',
  MULTI_SIG = 'multi_sig',
  RATE_LIMIT_CUSTOM = 'rate_limit_custom',
  DAO_SPECIFIC = 'dao_specific',
  CUSTOM_LOGIC = 'custom_logic'
}

/**
 * Custom Validation Rule Definition
 */
export interface ValidationRule {
  ruleId: string;
  ruleType: ValidationRuleType;
  endpoint: string;
  enabled: boolean;
  config: Record<string, any>;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * Custom Validation Context for endpoint execution
 */
export interface ValidationContext {
  userId: string;
  daoId: string;
  endpoint: string;
  method: string;
  requestBody: Record<string, any>;
  requestParams: Record<string, any>;
  requestQuery: Record<string, any>;
  userRole: string;
  userPrivileges: string[];
  timestamp: Date;
  threatLevel: ThreatLevel;
}

/**
 * Custom Validation Result
 */
export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  threatDetected: boolean;
  threatType?: string;
  requiresMFA?: boolean;
  requiresApproval?: boolean;
  approvalLevel?: 'none' | 'user' | 'treasurer' | 'multisig' | 'governance';
  ruleViolations: {
    ruleId: string;
    ruleType: ValidationRuleType;
    violation: string;
    severity: ThreatLevel;
  }[];
  metadata: Record<string, any>;
}

/**
 * Endpoint Security Policy with Custom Validation
 */
export interface EndpointSecurityPolicy {
  endpoint: string;
  method: string;
  requiredPrivileges: string[];
  requiredRoles: string[];
  threatLevel: ThreatLevel;
  rateLimit: {
    requests: number;
    windowMs: number;
  };
  requiresAudit: boolean;
  requiresMFA?: boolean;
  customRules: ValidationRule[];
  customValidationHandler?: (context: ValidationContext) => Promise<ValidationResult>;
  description: string;
  blockedUntil?: Date;
  owner: string; // DAO ID or 'system'
}

/**
 * Threat Signature for pattern matching
 */
export interface ThreatSignature {
  signatureId: string;
  pattern: Record<string, (indicators: Record<string, number>) => boolean>;
  severity: ThreatLevel;
  confidence: number;
  createdAt: Date;
}

/**
 * Agent Behavior tracking
 */
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

/**
 * Defense Action taken by defender agent
 */
export interface DefenseAction {
  actionId: string;
  actionType: ActionType;
  targetAgent: string;
  justification: string;
  ethicalApproval: boolean;
  timestamp: Date;
  success: boolean;
}

/**
 * Quarantine Policy for isolated agents/users
 */
export interface QuarantinePolicy {
  networkIsolation: boolean;
  resourceLimit: number;
  monitoringLevel: 'low' | 'medium' | 'high' | 'maximum';
  violations?: string[];
}

/**
 * Threat Alert with detailed context
 */
export interface ThreatAlert {
  alertId: string;
  timestamp: Date;
  endpoint: string;
  userId: string;
  threatType: string;
  threatLevel: ThreatLevel;
  ruleViolations: string[];
  action: string; // What the defender did
  resolved: boolean;
  metadata: Record<string, any>;
}

/**
 * Defender Metrics and Dashboard Data
 */
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
  threatSummary: {
    last24Hours: number;
    last7Days: number;
    highestThreat: ThreatLevel;
    topThreats: {
      threatType: string;
      count: number;
    }[];
  };
}
