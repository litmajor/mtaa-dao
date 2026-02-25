/**
 * Universal Reversibility Pattern Type Definitions
 * 
 * Defines standard state machine, interfaces, and patterns for making
 * high-power actions safely reversible with grace periods and opt-in
 * execution confirmation.
 * 
 * State Flow:
 * INITIATED → PENDING_CONFIRMATION → GRACE_PERIOD → REVERSIBLE_UNTIL → EXECUTED → IRREVERSIBLE
 */

/**
 * Reversibility Status - Standard state machine for all reversible actions
 */
export enum ReversibilityStatus {
  /** Action initiated, awaiting confirmation */
  INITIATED = 'INITIATED',
  
  /** Action confirmed, in confirmation period before grace period */
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
  
  /** Action in grace period - can be reversed by any authorized actor */
  GRACE_PERIOD = 'GRACE_PERIOD',
  
  /** Grace period ending soon - final warning period */
  REVERSIBLE_UNTIL = 'REVERSIBLE_UNTIL',
  
  /** Action executed - no longer reversible */
  EXECUTED = 'EXECUTED',
  
  /** Action became irreversible after deadline */
  IRREVERSIBLE = 'IRREVERSIBLE',
  
  /** Action successfully reversed/cancelled */
  REVERSED = 'REVERSED',
  
  /** Action reverted by emergency stop */
  EMERGENCY_STOPPED = 'EMERGENCY_STOPPED',
}

/**
 * Action Severity Level - determines grace period duration and approval requirements
 */
export enum ActionSeverity {
  /** Low-risk: User self-service (no approval, 24hr grace) */
  LOW = 'LOW',
  
  /** Medium-risk: Single moderator approval (48hr grace) */
  MEDIUM = 'MEDIUM',
  
  /** High-risk: 2-of-3 approval board required (72hr grace) */
  HIGH = 'HIGH',
  
  /** Critical: Superuser + 2-of-3 board + CEO approval (7-day grace) */
  CRITICAL = 'CRITICAL',
}

/**
 * Actor Type - who initiated or triggered the action
 */
export enum ActorType {
  USER = 'USER',
  AGENT = 'AGENT',
  SYSTEM = 'SYSTEM',
  ADMIN = 'ADMIN',
  DAO_GOVERNANCE = 'DAO_GOVERNANCE',
}

/**
 * Reversal Reason - why an action was reversed
 */
export enum ReversalReason {
  /** User requested reversal */
  USER_REQUESTED = 'USER_REQUESTED',
  
  /** Quality control detected issue */
  QUALITY_CONTROL = 'QUALITY_CONTROL',
  
  /** Error in calculation or logic */
  ERROR_DETECTED = 'ERROR_DETECTED',
  
  /** Emergency stop triggered */
  EMERGENCY_STOP = 'EMERGENCY_STOP',
  
  /** Grace period expired without execution */
  GRACE_PERIOD_EXPIRED = 'GRACE_PERIOD_EXPIRED',
  
  /** Security/compliance violation detected */
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  
  /** User requested cancellation before execution */
  USER_CANCELLATION = 'USER_CANCELLATION',
  
  /** Governance vote overrode action */
  GOVERNANCE_OVERRIDE = 'GOVERNANCE_OVERRIDE',
  
  /** Payment sent to wrong recipient */
  SENT_TO_WRONG_RECIPIENT = 'SENT_TO_WRONG_RECIPIENT',
  
  /** Duplicate payment detected */
  DUPLICATE_PAYMENT = 'DUPLICATE_PAYMENT',
  
  /** Incorrect payment amount */
  INCORRECT_AMOUNT = 'INCORRECT_AMOUNT',
}

/**
 * Confirmation Requirement - what's needed to proceed
 */
export interface ConfirmationRequirement {
  /** Type of confirmation needed */
  type: 'NONE' | 'EMAIL' | 'PIN' | 'APPROVAL_BOARD' | 'MULTI_SIG' | 'DAO_VOTE';
  
  /** How many approvals required (for board/multi-sig) */
  requiredApprovals?: number;
  
  /** Who can approve */
  approverRoles?: string[];
  
  /** Timeout for waiting on confirmations */
  confirmationTimeoutMinutes: number;
}

/**
 * Grace Period Configuration
 */
export interface GracePeriodConfig {
  /** Total duration for grace period in hours */
  durationHours: number;
  
  /** When to start sending reminders (hours before deadline) */
  reminderHoursBefore: number[];
  
  /** Whether user can accelerate end of grace period */
  userCanAccelerate: boolean;
  
  /** Whether action can be auto-executed at deadline */
  autoExecuteAtDeadline: boolean;
}

/**
 * Reversibility Scope - what can be reversed and by whom
 */
export interface ReversibilityScope {
  /** What state can be reversed (all fields that get modified) */
  fields: string[];
  
  /** Can initiator reverse their own action? */
  initiatorCanReverse: boolean;
  
  /** Can any admin reverse? */
  adminCanReverse: boolean;
  
  /** Can DAO governance reverse? */
  governanceCanReverse: boolean;
  
  /** Minimum role required to reverse */
  minimumRoleToReverse?: string;
  
  /** Is there a deadline after which reversal is impossible? */
  reversalDeadlineHours?: number;
  
  /** Can action partially be reversed (only some fields)? */
  partialReversalAllowed: boolean;
}

/**
 * Reversible Action - standard shape for all reversible actions
 */
export interface ReversibleAction {
  /** Unique identifier */
  id: string;
  
  /** Type of action (e.g., 'PROPOSAL_EXECUTION', 'USER_DELETION', 'AGENT_DEPLOYMENT') */
  actionType: string;
  
  /** Human-readable description */
  description: string;
  
  /** Current status in state machine */
  status: ReversibilityStatus;
  
  /** Risk level / severity */
  severity: ActionSeverity;
  
  /** Who initiated this action */
  initiator: {
    id: string;
    type: ActorType;
    role?: string;
    email?: string;
  };
  
  /** What entity does this action affect */
  affectedEntity: {
    type: string; // 'USER', 'DAO', 'AGENT', 'PROPOSAL', etc.
    id: string;
    name?: string;
  };
  
  /** What exactly is being changed */
  actionPayload: Record<string, any>;
  
  /** Before state snapshot (for reversal) */
  beforeState: Record<string, any>;
  
  /** After state snapshot (intended state after execution) */
  afterState: Record<string, any>;
  
  /** Confirmation requirements */
  confirmationRequirement: ConfirmationRequirement;
  
  /** Grace period config */
  gracePeriodConfig: GracePeriodConfig;
  
  /** Who can reverse this action */
  reversibilityScope: ReversibilityScope;
  
  /** Timestamps */
  initiatedAt: Date;
  confirmedAt?: Date;
  gracePeriodStartsAt?: Date;
  gracePeriodEndsAt?: Date;
  executedAt?: Date;
  reversedAt?: Date;
  irreversibleAt?: Date;
  
  /** Execution result (if executed) */
  executionResult?: {
    success: boolean;
    error?: string;
    transactionHash?: string;
    blockNumber?: number;
  };
  
  /** Reversal details (if reversed) */
  reversalDetails?: {
    reason: ReversalReason;
    reversedBy: {
      id: string;
      type: ActorType;
      role?: string;
    };
    reversalReason: string;
    reversalPayload?: Record<string, any>;
    reversalTransactionHash?: string;
  };
  
  /** Approvals received (for multi-step confirmations) */
  approvals?: Array<{
    approverId: string;
    approverRole: string;
    approvedAt: Date;
    comment?: string;
  }>;
  
  /** Audit metadata */
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    tags?: string[];
  };
  
  /** Is this action currently cancelable? */
  isCurrentlyCancelable: boolean;
  
  /** Emergency stop override token (if applicable) */
  emergencyStopToken?: string;
}

/**
 * Emergency Stop Configuration
 */
export interface EmergencyStopConfig {
  /** Is emergency stop available for this action type? */
  enabled: boolean;
  
  /** Who can trigger emergency stop */
  allowedActors: string[]; // 'SUPERUSER', 'GOVERNANCE', 'CIRCUIT_BREAKER'
  
  /** Does triggering stop require approval? */
  requiresApproval: boolean;
  
  /** If requires approval, how many? */
  requiredApprovals?: number;
  
  /** Timeline - how long can action be emergency stopped after initiation? */
  activeDurationHours: number;
  
  /** What action to take when stopping */
  stopAction: 'PAUSE' | 'CANCEL' | 'ROLLBACK';
  
  /** Can user appeal emergency stop? */
  appealable: boolean;
  
  /** Notification to send when emergency stop triggered */
  notificationTemplate?: string;
}

/**
 * Circuit Breaker State - for rate-limiting and runaway prevention
 */
export interface CircuitBreakerState {
  /** Total actions in time window */
  actionCount: number;
  
  /** Threshold (max actions per time window) */
  threshold: number;
  
  /** Time window in minutes */
  timeWindowMinutes: number;
  
  /** Is circuit breaker currently OPEN (blocking new actions)? */
  isOpen: boolean;
  
  /** When will circuit breaker reset? */
  resetsAt?: Date;
  
  /** Reason circuit breaker opened */
  reason?: string;
}

/**
 * Action Pattern Type - categorizes different reversibility patterns
 */
export enum ActionPatternType {
  /** Simple action with grace period (e.g., delete user) */
  SIMPLE_GRACE_PERIOD = 'SIMPLE_GRACE_PERIOD',
  
  /** Action requiring explicit user confirmation (e.g., transfer funds) */
  CONFIRMATION_REQUIRED = 'CONFIRMATION_REQUIRED',
  
  /** Multi-signature approval (e.g., governance proposal) */
  MULTI_APPROVAL = 'MULTI_APPROVAL',
  
  /** Simulation preview then execution (e.g., agent deployment) */
  SIMULATE_THEN_EXECUTE = 'SIMULATE_THEN_EXECUTE',
  
  /** Two-phase commit (prepare then finalize) */
  TWO_PHASE_COMMIT = 'TWO_PHASE_COMMIT',
}

/**
 * Create Reversible Action DTO
 */
export interface CreateReversibleActionDTO {
  actionType: string;
  description: string;
  severity: ActionSeverity;
  initiator: {
    id: string;
    type: ActorType;
    role?: string;
    email?: string;
  };
  affectedEntity: {
    type: string;
    id: string;
    name?: string;
  };
  actionPayload: Record<string, any>;
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  confirmationRequirement: ConfirmationRequirement;
  gracePeriodConfig: GracePeriodConfig;
  reversibilityScope: ReversibilityScope;
  emergencyStopConfig?: EmergencyStopConfig;
  metadata?: Record<string, any>;
}

/**
 * Reverse Action DTO
 */
export interface ReverseActionDTO {
  actionId: string;
  reason: ReversalReason;
  reversedBy: {
    id: string;
    type: ActorType;
    role?: string;
  };
  reversalReason: string;
  reversalPayload?: Record<string, any>;
  requiresApproval?: boolean;
}

/**
 * Confirm Action DTO
 */
export interface ConfirmActionDTO {
  actionId: string;
  confirmationData?: {
    pin?: string;
    email?: string;
    signature?: string;
  };
  confirmationToken?: string;
  ipAddress?: string;
}

/**
 * Execute Action DTO
 */
export interface ExecuteActionDTO {
  actionId: string;
  executedBy: {
    id: string;
    type: ActorType;
    role?: string;
  };
  skipGracePeriod?: boolean; // Only for admins with override
  skipGracePeriodReason?: string;
}

/**
 * State Transition Validator
 * Validates whether a state transition is allowed
 */
export interface StateTransitionRule {
  from: ReversibilityStatus;
  to: ReversibilityStatus;
  allowedActors?: string[];
  requiresApproval?: boolean;
  conditions?: Array<(action: ReversibleAction) => boolean>;
}

/**
 * Reversibility Report - for audit and compliance
 */
export interface ReversibilityReport {
  actionId: string;
  actionType: string;
  severity: ActionSeverity;
  status: ReversibilityStatus;
  statusTimeline: Array<{
    status: ReversibilityStatus;
    timestamp: Date;
    actor?: { id: string; role?: string };
  }>;
  isCurrentlyReversible: boolean;
  reversalDeadline?: Date;
  hoursUntilIrreversible?: number;
  reversalHistory: Array<{
    reversedAt: Date;
    reason: ReversalReason;
    reversedBy: { id: string; role?: string };
  }>;
  approvalChain: Array<{
    approver: { id: string; role: string };
    approvedAt: Date;
    comment?: string;
  }>;
  affectedEntities: Array<{
    type: string;
    id: string;
    estimatedImpact: string;
  }>;
}
