/**
 * Defender Agent - Custom Validation Rules
 * Implements business logic validation for endpoints
 */

import { ValidationContext, ValidationResult, ValidationRuleType, ThreatLevel } from './types';
import { Logger } from '../../utils/logger';
import { Request } from 'express';
import { redis } from '../../services/redis';

const logger = new Logger('defender-custom-rules');

/**
 * Amount Limit Validation
 * Ensures transfers don't exceed configured limits
 */
export async function validateAmountLimit(
  context: ValidationContext,
  limit: number
): Promise<ValidationResult> {
  const { requestBody } = context;
  const amount = parseFloat(requestBody.amount || '0');

  if (amount > limit) {
    return {
      allowed: false,
      reason: `Amount ${amount} exceeds limit of ${limit}`,
      threatDetected: true,
      threatType: 'AMOUNT_LIMIT_EXCEEDED',
      requiresApproval: true,
      approvalLevel: amount > limit * 2 ? 'multisig' : 'treasurer',
      ruleViolations: [
        {
          ruleId: 'amount_limit_1',
          ruleType: ValidationRuleType.AMOUNT_LIMIT,
          violation: `Amount ${amount} exceeds ${limit}`,
          severity: amount > limit * 5 ? ThreatLevel.CRITICAL : ThreatLevel.MODERATE,
        },
      ],
      metadata: { requestedAmount: amount, limit },
    };
  }

  return {
    allowed: true,
    threatDetected: false,
    ruleViolations: [],
    metadata: { amount, limit },
  };
}

/**
 * Recipient Whitelist Validation
 * Only allows transfers to pre-approved addresses
 */
export async function validateRecipientWhitelist(
  context: ValidationContext,
  whitelist: string[]
): Promise<ValidationResult> {
  const { requestBody, daoId } = context;
  const recipient = requestBody.toAddress || requestBody.recipient || '';

  // Normalize address
  const normalizedRecipient = recipient.toLowerCase().trim();
  const normalizedWhitelist = whitelist.map(a => a.toLowerCase().trim());

  if (!normalizedWhitelist.includes(normalizedRecipient)) {
    logger.warn('[DEFENDER] Recipient not in whitelist', {
      recipient,
      daoId,
      whitelistSize: whitelist.length,
    });

    return {
      allowed: false,
      reason: `Recipient ${recipient} is not in the approved whitelist`,
      threatDetected: true,
      threatType: 'RECIPIENT_NOT_WHITELISTED',
      requiresApproval: true,
      approvalLevel: 'governance',
      ruleViolations: [
        {
          ruleId: 'recipient_whitelist_1',
          ruleType: ValidationRuleType.RECIPIENT_WHITELIST,
          violation: `${recipient} not in whitelist of ${whitelist.length} addresses`,
          severity: ThreatLevel.HIGH,
        },
      ],
      metadata: { recipient, whitelistSize: whitelist.length },
    };
  }

  return {
    allowed: true,
    threatDetected: false,
    ruleViolations: [],
    metadata: { recipient, whitelisted: true },
  };
}

/**
 * Time-Based Restriction Validation
 * Restricts operations to certain hours/days
 */
export async function validateTimeBasedRestriction(
  context: ValidationContext,
  config: {
    allowedHours?: [number, number]; // [start, end] in 24h format
    allowedDays?: number[]; // 0-6 (Sunday-Saturday)
    blockedDates?: string[]; // ISO date strings
  }
): Promise<ValidationResult> {
  const violations: any[] = [];
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const dateStr = now.toISOString().split('T')[0];

  // Check hour restriction
  if (config.allowedHours) {
    const [startHour, endHour] = config.allowedHours;
    if (hour < startHour || hour >= endHour) {
      violations.push({
        ruleId: 'time_restriction_hours',
        ruleType: ValidationRuleType.TIME_BASED,
        violation: `Current hour ${hour} outside allowed window ${startHour}-${endHour}`,
        severity: ThreatLevel.MODERATE,
      });
    }
  }

  // Check day restriction
  if (config.allowedDays && !config.allowedDays.includes(day)) {
    violations.push({
      ruleId: 'time_restriction_day',
      ruleType: ValidationRuleType.TIME_BASED,
      violation: `Operations not allowed on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]}`,
      severity: ThreatLevel.MODERATE,
    });
  }

  // Check blocked dates
  if (config.blockedDates?.includes(dateStr)) {
    violations.push({
      ruleId: 'time_restriction_blocked_date',
      ruleType: ValidationRuleType.TIME_BASED,
      violation: `Operations blocked on ${dateStr}`,
      severity: ThreatLevel.HIGH,
    });
  }

  if (violations.length > 0) {
    return {
      allowed: false,
      reason: `Operation outside allowed time window`,
      threatDetected: true,
      threatType: 'TIME_RESTRICTION_VIOLATION',
      requiresApproval: true,
      approvalLevel: 'treasurer',
      ruleViolations: violations,
      metadata: { hour, day, date: dateStr },
    };
  }

  return {
    allowed: true,
    threatDetected: false,
    ruleViolations: [],
    metadata: { hour, day, date: dateStr },
  };
}

/**
 * Governance Approval Validation
 * Requires DAO governance approval for large transactions
 */
export async function validateGovernanceApproval(
  context: ValidationContext,
  config: {
    amountThreshold: number;
    requireProposal: boolean;
    requireVote: boolean;
  }
): Promise<ValidationResult> {
  const { requestBody, daoId } = context;
  const amount = parseFloat(requestBody.amount || '0');

  if (amount > config.amountThreshold) {
    logger.info('[DEFENDER] Large transaction requires governance approval', {
      amount,
      threshold: config.amountThreshold,
      daoId,
    });

    return {
      allowed: false,
      reason: `Amount ${amount} requires governance approval (threshold: ${config.amountThreshold})`,
      threatDetected: false,
      requiresApproval: true,
      approvalLevel: 'governance',
      ruleViolations: [
        {
          ruleId: 'governance_approval_1',
          ruleType: ValidationRuleType.GOVERNANCE_APPROVAL,
          violation: `Amount exceeds governance threshold`,
          severity: ThreatLevel.MODERATE,
        },
      ],
      metadata: {
        amount,
        threshold: config.amountThreshold,
        requireProposal: config.requireProposal,
        requireVote: config.requireVote,
      },
    };
  }

  return {
    allowed: true,
    threatDetected: false,
    ruleViolations: [],
    metadata: { amount, belowThreshold: true },
  };
}

/**
 * Quota Check Validation
 * Tracks and limits usage by period
 */
export async function validateQuotaCheck(
    context: ValidationContext,
    config: {
        maxPerPeriod: number;
        periodMs: number;
        quotaKey: string;
    }
): Promise<ValidationResult> {
    const { userId, daoId } = context;
    const quotaId = `quota:${config.quotaKey}:${daoId}:${userId}`;
    const now = Date.now();

    try {
        // Get current quota usage from Redis
        const redisKey = `${quotaId}:window`;
        const windowStart = await redis.get(`${quotaId}:start`);
        const currentUsage = await redis.increment(redisKey);

        // Initialize window if new
        if (currentUsage === 1) {
            await redis.expire(redisKey, Math.ceil(config.periodMs / 1000));
            await redis.set(`${quotaId}:start`, now.toString(), Math.ceil(config.periodMs / 1000));
        }

        // Check if quota exceeded
        if (currentUsage > config.maxPerPeriod) {
            logger.warn('[DEFENDER] Quota limit exceeded', {
                quotaId,
                usage: currentUsage,
                limit: config.maxPerPeriod,
            });

            return {
                allowed: false,
                reason: `Quota exceeded: ${currentUsage}/${config.maxPerPeriod} requests in period`,
                threatDetected: false,
                requiresApproval: true,
                approvalLevel: 'treasurer',
                ruleViolations: [
                    {
                        ruleId: 'quota_check_1',
                        ruleType: ValidationRuleType.QUOTA_CHECK,
                        violation: `Usage ${currentUsage} exceeds limit of ${config.maxPerPeriod}`,
                        severity: ThreatLevel.MODERATE,
                    },
                ],
                metadata: { quotaId, usage: currentUsage, limit: config.maxPerPeriod },
            };
        }

        return {
            allowed: true,
            threatDetected: false,
            ruleViolations: [],
            metadata: { quotaId, usage: currentUsage, limit: config.maxPerPeriod },
        };
    } catch (error) {
        logger.error('[DEFENDER] Quota check error', { quotaId, error });
        // Fail open on Redis errors
        return {
            allowed: true,
            threatDetected: false,
            ruleViolations: [],
            metadata: { quotaId, error: 'quota_check_error' },
        };
    }
}

/**
 * Multi-Signature Requirement Validation
 * Ensures multi-sig requirements are met
 */
export async function validateMultiSigRequirement(
  context: ValidationContext,
  config: {
    requiredSignatures: number;
    signatories: string[];
  }
): Promise<ValidationResult> {
  const { requestBody, userId } = context;
  const currentSignatures = requestBody.signatures || [];

  if (currentSignatures.length < config.requiredSignatures) {
    const remaining = config.requiredSignatures - currentSignatures.length;

    return {
      allowed: false,
      reason: `Requires ${config.requiredSignatures} signatures, ${remaining} missing`,
      threatDetected: false,
      requiresApproval: true,
      approvalLevel: 'multisig',
      ruleViolations: [
        {
          ruleId: 'multisig_requirement_1',
          ruleType: ValidationRuleType.MULTI_SIG,
          violation: `Only ${currentSignatures.length} of ${config.requiredSignatures} signatures collected`,
          severity: ThreatLevel.MODERATE,
        },
      ],
      metadata: {
        currentSignatures: currentSignatures.length,
        required: config.requiredSignatures,
        remaining,
        signatories: config.signatories,
      },
    };
  }

  return {
    allowed: true,
    threatDetected: false,
    ruleViolations: [],
    metadata: {
      signatures: currentSignatures.length,
      required: config.requiredSignatures,
    },
  };
}

/**
 * Custom Rate Limit Validation
 * Enforces endpoint-specific rate limits
 */
export async function validateCustomRateLimit(
  context: ValidationContext,
  config: {
    maxRequests: number;
    windowMs: number;
  }
): Promise<ValidationResult> {
  // TODO: Implement actual rate limiting with Redis or similar
  // This is a placeholder
  return {
    allowed: true,
    threatDetected: false,
    ruleViolations: [],
    metadata: {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
    },
  };
}

/**
 * DAO-Specific Validation
 * Custom rules per DAO
 */
export async function validateDAOSpecificRules(
  context: ValidationContext,
  config: Record<string, any>
): Promise<ValidationResult> {
  const { daoId, requestBody } = context;

  // DAO can define custom validation logic
  // Examples:
  // - Treasury balance must stay above minimum
  // - Members must approve large disbursements
  // - Only scheduled transfers allowed
  // - Treasury composition rules

  // Placeholder for custom per-DAO rules
  logger.debug('[DEFENDER] Evaluating DAO-specific rules', {
    daoId,
    configKeys: Object.keys(config),
  });

  return {
    allowed: true,
    threatDetected: false,
    ruleViolations: [],
    metadata: { daoId, rules: Object.keys(config) },
  };
}

/**
 * Privilege Escalation Check
 * Detects and blocks privilege escalation attempts
 */
export async function validatePrivilegeEscalation(
  context: ValidationContext,
  config: {
    blockedActions: string[];
    restrictedRoles: string[];
  }
): Promise<ValidationResult> {
  const { userRole, userPrivileges, endpoint } = context;

  // Check if user is trying to access restricted functionality
  if (config.restrictedRoles.includes(userRole)) {
    return {
      allowed: false,
      reason: `Role '${userRole}' cannot access this endpoint`,
      threatDetected: true,
      threatType: 'PRIVILEGE_ESCALATION_ATTEMPT',
      requiresApproval: false,
      ruleViolations: [
        {
          ruleId: 'privilege_escalation_1',
          ruleType: ValidationRuleType.PRIVILEGE_CHECK,
          violation: `Restricted role '${userRole}' attempting access`,
          severity: ThreatLevel.HIGH,
        },
      ],
      metadata: { userRole, endpoint },
    };
  }

  return {
    allowed: true,
    threatDetected: false,
    ruleViolations: [],
    metadata: { userRole, verified: true },
  };
}

/**
 * Combine multiple validation rules
 */
export async function combinedValidation(
  context: ValidationContext,
  validators: Array<{
    type: ValidationRuleType;
    config: Record<string, any>;
  }>
): Promise<ValidationResult> {
  const allViolations: any[] = [];
  let requiresMFA = false;
  let requiresApproval = false;
  let approvalLevel: 'none' | 'user' | 'treasurer' | 'multisig' | 'governance' = 'none';
  let threatDetected = false;

  for (const validator of validators) {
    let result: ValidationResult | null = null;

    switch (validator.type) {
      case ValidationRuleType.AMOUNT_LIMIT:
        result = await validateAmountLimit(context, validator.config.limit);
        break;
      case ValidationRuleType.RECIPIENT_WHITELIST:
        result = await validateRecipientWhitelist(context, validator.config.whitelist);
        break;
      case ValidationRuleType.TIME_BASED:
        result = await validateTimeBasedRestriction(context, validator.config);
        break;
      case ValidationRuleType.GOVERNANCE_APPROVAL:
        result = await validateGovernanceApproval(context, {
          amountThreshold: validator.config.amountThreshold || 0,
          requireProposal: validator.config.requireProposal !== false,
          requireVote: validator.config.requireVote !== false,
        });
        break;
      case ValidationRuleType.QUOTA_CHECK:
        result = await validateQuotaCheck(context, {
          maxPerPeriod: validator.config.maxPerPeriod || 0,
          periodMs: validator.config.periodMs || 0,
          quotaKey: validator.config.quotaKey || 'default',
        });
        break;
      case ValidationRuleType.MULTI_SIG:
        result = await validateMultiSigRequirement(context, {
          requiredSignatures: validator.config.requiredSignatures || 1,
          signatories: validator.config.signatories || [],
        });
        break;
      case ValidationRuleType.RATE_LIMIT_CUSTOM:
        result = await validateCustomRateLimit(context, {
          maxRequests: validator.config.maxRequests || 100,
          windowMs: validator.config.windowMs || 60000,
        });
        break;
      case ValidationRuleType.DAO_SPECIFIC:
        result = await validateDAOSpecificRules(context, validator.config);
        break;
      case ValidationRuleType.PRIVILEGE_CHECK:
        result = await validatePrivilegeEscalation(context, {
          blockedActions: validator.config.blockedActions || [],
          restrictedRoles: validator.config.restrictedRoles || [],
        });
        break;
    }

    if (result) {
      allViolations.push(...result.ruleViolations);
      if (result.threatDetected) threatDetected = true;
      if (result.requiresMFA) requiresMFA = true;
      if (result.requiresApproval) {
        requiresApproval = true;
        // Escalate approval level if needed
        const levels = ['none', 'user', 'treasurer', 'multisig', 'governance'];
        const currentLevel = levels.indexOf(approvalLevel);
        const resultLevel = levels.indexOf(result.approvalLevel || 'none');
        if (resultLevel > currentLevel) {
          approvalLevel = result.approvalLevel || 'none';
        }
      }

      // If any validator rejects, combined validation rejects
      if (!result.allowed) {
        return {
          allowed: false,
          reason: result.reason,
          threatDetected,
          threatType: result.threatType,
          requiresMFA,
          requiresApproval,
          approvalLevel: approvalLevel as any,
          ruleViolations: allViolations,
          metadata: { failedValidator: validator.type },
        };
      }
    }
  }

  return {
    allowed: true,
    threatDetected,
    requiresMFA,
    requiresApproval,
    approvalLevel: approvalLevel as any,
    ruleViolations: allViolations,
    metadata: { allValidatorsPassed: true },
  };
}

export default {
  validateAmountLimit,
  validateRecipientWhitelist,
  validateTimeBasedRestriction,
  validateGovernanceApproval,
  validateQuotaCheck,
  validateMultiSigRequirement,
  validateCustomRateLimit,
  validateDAOSpecificRules,
  validatePrivilegeEscalation,
  combinedValidation,
};
