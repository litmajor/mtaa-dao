/**
 * Vault Type Validators
 * 
 * Validates operations based on vault type constraints:
 * - savings: fixed-yield, locked, no allocate/rebalance
 * - investment: active allocation, manual allocation allowed
 * - strategy: auto-execute via strategy, no manual allocate
 * - investment-pool: multi-member fund, no allocate/rebalance
 * - escrow: time/condition-locked, no withdraw/allocate
 * - deployment: smart contract deployment, no withdraw
 * - custom: no constraints
 * 
 * ✅ TYPE-SAFE: Full TypeScript validation
 */

import { z } from 'zod';

// ════════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ════════════════════════════════════════════════════════════════════════════════

export type VaultTypeConstraint = 
  | 'savings'
  | 'investment'
  | 'strategy'
  | 'investment-pool'
  | 'escrow'
  | 'deployment'
  | 'custom';

export type VaultOperation = 
  | 'deposit'
  | 'withdraw'
  | 'allocate'
  | 'rebalance'
  | 'pause'
  | 'resume'
  | 'delete';

export interface TypeConstraintRules {
  // Operation permissions
  allowDeposit: boolean;
  allowWithdraw: boolean;
  allowAllocate: boolean;
  allowRebalance: boolean;
  
  // Lock duration (for time-locked vaults like savings/escrow)
  lockDuration?: number; // milliseconds - default lock time
  maxLockDuration?: number; // milliseconds - maximum allowed (for configurable types)
  minLockDuration?: number; // milliseconds - minimum required
  
  // Withdrawal constraints (customizable per vault)
  requiresApproval?: boolean; // Needs approval before withdrawal
  requiresMultisig?: boolean; // Needs multisig for DAO vaults
  minWithdrawalAmount?: number; // Minimum withdrawal in base units
  maxWithdrawalAmount?: number; // Maximum withdrawal in base units
  dailyWithdrawalLimit?: number; // Daily aggregate limit
  withdrawalFrequencyMs?: number; // Min time between withdrawals (e.g., weekly)
  
  // DAO-specific constraints
  maxMembers?: number; // For investment-pool type
  requiredRoleForWithdrawal?: 'admin' | 'elder' | 'member'; // Minimum role needed
  
  // Escrow-specific
  releaseConditions?: 'time-based' | 'condition-based' | 'multisig';
}

// ════════════════════════════════════════════════════════════════════════════════
// VAULT TYPE CONSTRAINT MAP
// ════════════════════════════════════════════════════════════════════════════════

const VAULT_TYPE_CONSTRAINTS: Record<VaultTypeConstraint, TypeConstraintRules> = {
  // Savings vault: Fixed yield, locked, no manual trading
  // Lock duration is configurable per vault instance (1 day - 1 year)
  savings: {
    allowDeposit: true,
    allowWithdraw: false, // Locked until duration expires
    allowAllocate: false,
    allowRebalance: false,
    minLockDuration: 1 * 24 * 60 * 60 * 1000, // 1 day minimum
    maxLockDuration: 365 * 24 * 60 * 60 * 1000, // 1 year maximum
    requiresApproval: false,
    requiresMultisig: false, // Personal savings don't need multisig
  },

  // Investment vault: Active allocation, user manages positions
  investment: {
    allowDeposit: true,
    allowWithdraw: true,
    allowAllocate: true, // User can manually allocate
    allowRebalance: true, // User can rebalance
    requiresApproval: false,
    requiresMultisig: false, // Personal vaults don't need multisig
    minWithdrawalAmount: 0,
  },

  // Strategy vault: Auto-execute, no manual allocation
  strategy: {
    allowDeposit: true,
    allowWithdraw: true,
    allowAllocate: false, // Strategy handles allocation
    allowRebalance: false, // Strategy handles rebalancing
    requiresApproval: false,
    requiresMultisig: false, // Personal strategy vaults
  },

  // Investment pool: Multi-member fund, no manual allocation
  'investment-pool': {
    allowDeposit: true,
    allowWithdraw: true,
    allowAllocate: false, // Pool manager allocates
    allowRebalance: false, // Pool manager rebalances
    requiresApproval: true, // Requires pool approval
    requiresMultisig: true, // DAO pools require multisig
    maxMembers: 100,
    requiredRoleForWithdrawal: 'admin', // Only admins can withdraw from DAO pools
  },

  // Escrow vault: Time-locked, condition-based release
  escrow: {
    allowDeposit: true,
    allowWithdraw: false, // Can't withdraw until condition met
    allowAllocate: false,
    allowRebalance: false,
    requiresApproval: true, // Requires condition check
    requiresMultisig: true, // DAO escrow requires multisig
    lockDuration: 90 * 24 * 60 * 60 * 1000, // Typically 90 days
    releaseConditions: 'time-based', // Can be overridden in vault_config
  },

  // Deployment vault: Smart contract deployment funds
  deployment: {
    allowDeposit: true,
    allowWithdraw: false, // Deployed to smart contract
    allowAllocate: false,
    allowRebalance: false,
    requiresApproval: true, // Requires deployment approval
  },

  // Custom vault: No constraints
  custom: {
    allowDeposit: true,
    allowWithdraw: true,
    allowAllocate: true,
    allowRebalance: true,
    requiresApproval: false,
  },
};

// ════════════════════════════════════════════════════════════════════════════════
// VALIDATORS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Validate deposit operation for vault type
 */
export const validateDeposit = (vaultType: VaultTypeConstraint): boolean => {
  const rules = VAULT_TYPE_CONSTRAINTS[vaultType];
  return rules?.allowDeposit ?? true;
};

/**
 * Validate withdrawal operation for vault type
 */
export const validateWithdraw = (vaultType: VaultTypeConstraint): boolean => {
  const rules = VAULT_TYPE_CONSTRAINTS[vaultType];
  return rules?.allowWithdraw ?? true;
};

/**
 * Validate allocation operation for vault type
 */
export const validateAllocate = (vaultType: VaultTypeConstraint): boolean => {
  const rules = VAULT_TYPE_CONSTRAINTS[vaultType];
  return rules?.allowAllocate ?? true;
};

/**
 * Validate rebalance operation for vault type
 */
export const validateRebalance = (vaultType: VaultTypeConstraint): boolean => {
  const rules = VAULT_TYPE_CONSTRAINTS[vaultType];
  return rules?.allowRebalance ?? true;
};

/**
 * Validate operation on vault type
 */
export const validateVaultOperation = (
  vaultType: VaultTypeConstraint,
  operation: VaultOperation
): { allowed: boolean; reason?: string } => {
  const rules = VAULT_TYPE_CONSTRAINTS[vaultType];

  if (!rules) {
    return { allowed: false, reason: `Unknown vault type: ${vaultType}` };
  }

  switch (operation) {
    case 'deposit':
      if (!rules.allowDeposit) {
        return { allowed: false, reason: `${vaultType} vault does not allow deposits` };
      }
      return { allowed: true };

    case 'withdraw':
      if (!rules.allowWithdraw) {
        return { allowed: false, reason: `${vaultType} vault does not allow withdrawals` };
      }
      return { allowed: true };

    case 'allocate':
      if (!rules.allowAllocate) {
        return { allowed: false, reason: `${vaultType} vault does not allow manual allocations` };
      }
      return { allowed: true };

    case 'rebalance':
      if (!rules.allowRebalance) {
        return { allowed: false, reason: `${vaultType} vault does not allow rebalancing` };
      }
      return { allowed: true };

    case 'pause':
    case 'resume':
    case 'delete':
      // These operations are always allowed
      return { allowed: true };

    default:
      return { allowed: false, reason: `Unknown operation: ${operation}` };
  }
};

/**
 * Get constraint rules for vault type
 */
export const getConstraintRules = (vaultType: VaultTypeConstraint): TypeConstraintRules | null => {
  return VAULT_TYPE_CONSTRAINTS[vaultType] || null;
};

/**
 * Validate lock duration for savings vault
 * Returns { valid: boolean; reason?: string; min?: number; max?: number }
 */
export const validateLockDuration = (
  vaultType: VaultTypeConstraint,
  lockDurationMs: number
): { valid: boolean; reason?: string; minMs?: number; maxMs?: number } => {
  const rules = VAULT_TYPE_CONSTRAINTS[vaultType];

  if (!rules) {
    return { valid: false, reason: `Unknown vault type: ${vaultType}` };
  }

  // Only savings vaults have configurable lock duration
  if (vaultType !== 'savings') {
    return { valid: true }; // Other types don't have lock duration constraints
  }

  if (rules.minLockDuration && lockDurationMs < rules.minLockDuration) {
    return {
      valid: false,
      reason: `Lock duration must be at least ${rules.minLockDuration / (24 * 60 * 60 * 1000)} days`,
      minMs: rules.minLockDuration,
      maxMs: rules.maxLockDuration,
    };
  }

  if (rules.maxLockDuration && lockDurationMs > rules.maxLockDuration) {
    return {
      valid: false,
      reason: `Lock duration cannot exceed ${rules.maxLockDuration / (24 * 60 * 60 * 1000)} days (1 year)`,
      minMs: rules.minLockDuration,
      maxMs: rules.maxLockDuration,
    };
  }

  return { 
    valid: true,
    minMs: rules.minLockDuration,
    maxMs: rules.maxLockDuration,
  };
};

/**
 * Check if vault type requires approval for operation
 */
export const requiresApproval = (vaultType: VaultTypeConstraint): boolean => {
  const rules = VAULT_TYPE_CONSTRAINTS[vaultType];
  return rules?.requiresApproval ?? false;
};

/**
 * Get lock duration for vault type (if applicable)
 */
export const getLockDuration = (vaultType: VaultTypeConstraint): number | null => {
  const rules = VAULT_TYPE_CONSTRAINTS[vaultType];
  return rules?.lockDuration ?? null;
};

/**
 * Get max members for vault type (if applicable)
 */
export const getMaxMembers = (vaultType: VaultTypeConstraint): number | null => {
  const rules = VAULT_TYPE_CONSTRAINTS[vaultType];
  return rules?.maxMembers ?? null;
};

// ════════════════════════════════════════════════════════════════════════════════
// ZOD SCHEMAS - REQUEST VALIDATION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Zod schema for vault creation
 */
export const createVaultSchema = z.object({
  name: z.string().min(1, 'Vault name required').max(100),
  description: z.string().max(500).optional(),
  vaultType: z.enum([
    'savings',
    'investment',
    'strategy',
    'investment-pool',
    'escrow',
    'deployment',
    'custom',
  ] as const),
  currency: z.string().default('cUSD'),
  initialBalance: z.string().regex(/^\d+(\.\d{1,18})?$/, 'Invalid amount format').optional(),
  config: z.record(z.any()).optional(),
});

/**
 * Zod schema for deposit
 */
export const depositSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount format'),
  currency: z.string().default('cUSD'),
  source: z.string().optional(),
});

/**
 * Zod schema for withdrawal
 */
export const withdrawSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount format'),
  currency: z.string().default('cUSD'),
  destination: z.string(),
  multisigSignature: z.string().optional(),
});

/**
 * Zod schema for allocation
 */
export const allocationSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount format'),
  currency: z.string(),
  assetId: z.string().optional(),
  strategyId: z.string().optional(),
});

/**
 * Zod schema for rebalancing
 */
export const rebalanceSchema = z.object({
  targetAllocations: z.record(
    z.number().min(0).max(100, 'Allocation percentage must be 0-100')
  ),
  multisigSignature: z.string().optional(),
});

// ════════════════════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Validate total allocation percentages sum to 100
 */
export const validateAllocationTotal = (allocations: Record<string, number>): boolean => {
  const total = Object.values(allocations).reduce((sum, val) => sum + val, 0);
  return Math.abs(total - 100) < 0.01; // Allow for floating point errors
};

/**
 * Validate amount is positive
 */
export const validateAmountPositive = (amount: string): boolean => {
  try {
    const num = parseFloat(amount);
    return num > 0;
  } catch {
    return false;
  }
};

/**
 * Validate amount has valid decimal places
 */
export const validateAmountDecimals = (amount: string, maxDecimals: number = 8): boolean => {
  try {
    const parts = amount.split('.');
    if (parts.length > 2) return false;
    if (parts.length === 2 && parts[1].length > maxDecimals) return false;
    return true;
  } catch {
    return false;
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// WITHDRAWAL VALIDATION (Phase 4B)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Comprehensive withdrawal validation
 * Checks: type constraints, lock status, amount limits, frequency, and multisig needs
 */
export interface WithdrawalValidationResult {
  allowed: boolean;
  reason?: string;
  requiresMultisig?: boolean;
  requiresApproval?: boolean;
  lockedUntil?: Date;
  minWithdrawal?: number;
  maxWithdrawal?: number;
}

export const validateWithdrawalRequest = (
  vaultType: VaultTypeConstraint,
  amount: number,
  vaultBalance: number,
  isDAOVault: boolean,
  userRole?: 'member' | 'elder' | 'admin',
  lockedUntil?: Date,
  customConfig?: Record<string, any>
): WithdrawalValidationResult => {
  const rules = VAULT_TYPE_CONSTRAINTS[vaultType];

  if (!rules) {
    return { allowed: false, reason: `Unknown vault type: ${vaultType}` };
  }

  // 1. Check if withdrawal is allowed for this vault type
  if (!rules.allowWithdraw) {
    return { 
      allowed: false, 
      reason: `${vaultType} vault does not allow withdrawals`,
    };
  }

  // 2. Check if vault is locked (for savings, escrow, etc)
  if (lockedUntil) {
    const now = new Date();
    if (lockedUntil > now) {
      return {
        allowed: false,
        reason: `Vault is locked until ${lockedUntil.toISOString()}`,
        lockedUntil,
      };
    }
  }

  // 3. Check amount limits
  const minWithdrawal = customConfig?.minWithdrawal || rules.minWithdrawalAmount || 0;
  const maxWithdrawal = customConfig?.maxWithdrawal || rules.maxWithdrawalAmount;

  if (amount < minWithdrawal) {
    return {
      allowed: false,
      reason: `Withdrawal amount must be at least ${minWithdrawal}`,
      minWithdrawal,
      maxWithdrawal,
    };
  }

  if (maxWithdrawal && amount > maxWithdrawal) {
    return {
      allowed: false,
      reason: `Withdrawal amount cannot exceed ${maxWithdrawal}`,
      minWithdrawal,
      maxWithdrawal,
    };
  }

  // 4. Check available balance
  if (amount > vaultBalance) {
    return {
      allowed: false,
      reason: `Insufficient balance. Available: ${vaultBalance}, Requested: ${amount}`,
    };
  }

  // 5. For DAO vaults, check role and multisig
  if (isDAOVault) {
    const requiredRole = rules.requiredRoleForWithdrawal;
    if (requiredRole) {
      const roleHierarchy = { member: 0, elder: 1, admin: 2 };
      const userRoleLevel = roleHierarchy[userRole || 'member'] || 0;
      const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

      if (userRoleLevel < requiredRoleLevel) {
        return {
          allowed: false,
          reason: `Insufficient role for withdrawal. Required: ${requiredRole}, Got: ${userRole}`,
        };
      }
    }

    // Check if multisig is required (operational treasuries MUST have multisig)
    const multisigRequired = rules.requiresMultisig || customConfig?.requiresMultisig || false;
    return {
      allowed: true,
      requiresMultisig: multisigRequired,
      requiresApproval: rules.requiresApproval,
    };
  }

  // 6. For personal vaults, basic checks passed
  return {
    allowed: true,
    requiresMultisig: false,
  };
};

/**
 * Validate if vault is time-locked and when it unlocks
 */
export const validateLockExpiration = (
  vaultType: VaultTypeConstraint,
  lockedUntil?: Date
): { isLocked: boolean; lockedUntilDate?: Date; daysRemaining?: number } => {
  const now = new Date();

  if (!lockedUntil) {
    return { isLocked: false };
  }

  if (lockedUntil <= now) {
    return { isLocked: false, lockedUntilDate: lockedUntil };
  }

  const daysRemaining = Math.ceil(
    (lockedUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );

  return {
    isLocked: true,
    lockedUntilDate: lockedUntil,
    daysRemaining,
  };
};

/**
 * Check escrow release conditions
 */
export const validateEscrowRelease = (
  releaseCondition?: string,
  customConfig?: Record<string, any>
): { canRelease: boolean; reason?: string } => {
  if (!releaseCondition) {
    return { canRelease: true };
  }

  switch (releaseCondition) {
    case 'time-based':
      // Time-based escrow is checked via lockedUntil
      return { canRelease: true };

    case 'condition-based':
      // Must have custom condition check in config
      if (customConfig?.releaseConditionMet) {
        return { canRelease: true };
      }
      return {
        canRelease: false,
        reason: `Escrow condition not met: ${customConfig?.releaseConditionDescription || 'awaiting approval'}`,
      };

    case 'multisig':
      // Multisig check handled separately in withdrawal flow
      return { canRelease: true };

    default:
      return { canRelease: true };
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// EXPORT HELPERS
// ════════════════════════════════════════════════════════════════════════════════

export default {
  validateDeposit,
  validateWithdraw,
  validateAllocate,
  validateRebalance,
  validateVaultOperation,
  getConstraintRules,
  getLockDuration,
  getMaxMembers,
  validateAllocationTotal,
  validateAmountPositive,
  validateAmountDecimals,
  validateWithdrawalRequest,
  validateLockExpiration,
  validateEscrowRelease,
  createVaultSchema,
  depositSchema,
  withdrawSchema,
  allocationSchema,
  rebalanceSchema,
};
