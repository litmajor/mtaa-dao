import { Request, Response } from 'express';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger('rules-engine');

// Rule type definitions
export enum RuleType {
  ENTRY = 'entry',
  WITHDRAWAL = 'withdrawal',
  ROTATION = 'rotation',
  FINANCIAL = 'financial',
  GOVERNANCE = 'governance'
}

export enum RuleOperator {
  EQUALS = 'equals',
  GREATER_THAN = 'gt',
  LESS_THAN = 'lt',
  GREATER_EQUAL = 'gte',
  LESS_EQUAL = 'lte',
  CONTAINS = 'contains',
  NOT_EQUALS = 'neq',
  IN = 'in'
}

export enum RuleActionType {
  APPROVE = 'approve',
  REJECT = 'reject',
  NOTIFY = 'notify',
  APPLY_PENALTY = 'apply_penalty',
  TRIGGER_VOTE = 'trigger_vote',
  PAUSE = 'pause',
  REQUIRE_APPROVAL = 'require_approval'
}

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value: any;
  logicalOperator?: 'AND' | 'OR'; // How to combine with next condition
}

export interface RuleAction {
  type: RuleActionType;
  payload: {
    [key: string]: any;
  };
}

export interface CustomRule {
  id: string;
  daoId: string;
  ruleType: RuleType;
  name: string;
  description: string;
  enabled: boolean;
  priority: number; // Higher priority evaluated first
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdBy: string;
  auditLog: RuleAuditEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleAuditEntry {
  id: string;
  ruleId: string;
  triggeredBy: string;
  triggeredAt: Date;
  result: 'approved' | 'rejected' | 'pending';
  metadata: any;
}

// Pre-built rule templates for different DAO types
export const RULE_TEMPLATES = {
  entryRules: [
    {
      name: 'Minimum Contribution',
      description: 'Require minimum contribution to join',
      ruleType: RuleType.ENTRY,
      conditions: [
        {
          field: 'initialContribution',
          operator: RuleOperator.LESS_THAN,
          value: null // Set by DAO
        }
      ],
      actions: [
        {
          type: RuleActionType.REJECT,
          payload: { reason: 'Insufficient initial contribution' }
        }
      ]
    },
    {
      name: 'Elder Approval Required',
      description: 'New members require elder approval',
      ruleType: RuleType.ENTRY,
      conditions: [
        {
          field: 'memberStatus',
          operator: RuleOperator.EQUALS,
          value: 'pending'
        }
      ],
      actions: [
        {
          type: RuleActionType.REQUIRE_APPROVAL,
          payload: { approverRole: 'elder', deadline: 3 } // 3 days
        }
      ]
    }
  ],

  withdrawalRules: [
    {
      name: 'Fixed Withdrawal Day',
      description: 'Only allow withdrawals on specific day(s)',
      ruleType: RuleType.WITHDRAWAL,
      conditions: [
        {
          field: 'dayOfWeek',
          operator: RuleOperator.NOT_EQUALS,
          value: 5 // Friday = 5
        }
      ],
      actions: [
        {
          type: RuleActionType.REJECT,
          payload: { reason: 'Withdrawals only on Friday' }
        }
      ]
    },
    {
      name: 'Maximum Per Cycle',
      description: 'Limit withdrawal amount per cycle',
      ruleType: RuleType.WITHDRAWAL,
      conditions: [
        {
          field: 'withdrawalAmount',
          operator: RuleOperator.GREATER_THAN,
          value: null // Set by DAO
        }
      ],
      actions: [
        {
          type: RuleActionType.REJECT,
          payload: { reason: 'Exceeds maximum withdrawal limit' }
        }
      ]
    },
    {
      name: 'Waiting Period',
      description: 'Require waiting period before first withdrawal',
      ruleType: RuleType.WITHDRAWAL,
      conditions: [
        {
          field: 'daysSinceMemberJoin',
          operator: RuleOperator.LESS_THAN,
          value: null // Set by DAO (e.g., 30 days)
        }
      ],
      actions: [
        {
          type: RuleActionType.REJECT,
          payload: { reason: 'Must wait before first withdrawal' }
        }
      ]
    }
  ],

  rotationRules: [
    {
      name: 'Skip Missing Members',
      description: 'Skip members who missed contributions',
      ruleType: RuleType.ROTATION,
      conditions: [
        {
          field: 'missedContributionCount',
          operator: RuleOperator.GREATER_EQUAL,
          value: 1
        }
      ],
      actions: [
        {
          type: RuleActionType.NOTIFY,
          payload: { message: 'Skipping rotation due to missed contributions' }
        }
      ]
    }
  ],

  financialRules: [
    {
      name: 'Late Contribution Penalty',
      description: 'Apply penalty for late contributions',
      ruleType: RuleType.FINANCIAL,
      conditions: [
        {
          field: 'daysLate',
          operator: RuleOperator.GREATER_THAN,
          value: 0
        }
      ],
      actions: [
        {
          type: RuleActionType.APPLY_PENALTY,
          payload: { 
            penaltyType: 'percentage', 
            amount: 5, // 5% penalty
            reason: 'Late contribution penalty'
          }
        }
      ]
    },
    {
      name: 'Interest Accrual',
      description: 'Accrue interest on member holdings',
      ruleType: RuleType.FINANCIAL,
      conditions: [
        {
          field: 'holdingPeriodDays',
          operator: RuleOperator.GREATER_EQUAL,
          value: 30
        }
      ],
      actions: [
        {
          type: RuleActionType.APPROVE,
          payload: { 
            interestRate: 2, // 2% annual
            frequency: 'monthly'
          }
        }
      ]
    }
  ],

  governanceRules: [
    {
      name: 'Proposal Cool-down',
      description: 'Require cool-down between proposals',
      ruleType: RuleType.GOVERNANCE,
      conditions: [
        {
          field: 'hoursSinceLastProposal',
          operator: RuleOperator.LESS_THAN,
          value: 24
        }
      ],
      actions: [
        {
          type: RuleActionType.REJECT,
          payload: { reason: 'Must wait 24 hours between proposals' }
        }
      ]
    }
  ]
};

/**
 * Evaluate if a transaction/action meets rule conditions
 */
function evaluateConditions(conditions: RuleCondition[], data: any): boolean {
  if (conditions.length === 0) return true;

  let result = true;
  let currentLogicalOperator = 'AND';

  for (const condition of conditions) {
    const conditionResult = evaluateCondition(condition, data);

    if (currentLogicalOperator === 'AND') {
      result = result && conditionResult;
    } else if (currentLogicalOperator === 'OR') {
      result = result || conditionResult;
    }

    currentLogicalOperator = condition.logicalOperator || 'AND';
  }

  return result;
}

/**
 * Evaluate a single condition
 */
function evaluateCondition(condition: RuleCondition, data: any): boolean {
  const fieldValue = data[condition.field];

  switch (condition.operator) {
    case RuleOperator.EQUALS:
      return fieldValue === condition.value;
    case RuleOperator.NOT_EQUALS:
      return fieldValue !== condition.value;
    case RuleOperator.GREATER_THAN:
      return fieldValue > condition.value;
    case RuleOperator.LESS_THAN:
      return fieldValue < condition.value;
    case RuleOperator.GREATER_EQUAL:
      return fieldValue >= condition.value;
    case RuleOperator.LESS_EQUAL:
      return fieldValue <= condition.value;
    case RuleOperator.CONTAINS:
      return typeof fieldValue === 'string' && fieldValue.includes(condition.value);
    case RuleOperator.IN:
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    default:
      return true;
  }
}

/**
 * Execute rule actions
 */
export interface RuleExecutionResult {
  allowed: boolean;
  reason?: string;
  actions: RuleAction[];
  penalties?: any[];
  requiresApproval?: boolean;
}

async function executeRuleActions(actions: RuleAction[]): Promise<RuleExecutionResult> {
  const result: RuleExecutionResult = {
    allowed: true,
    actions: [],
    penalties: []
  };

  for (const action of actions) {
    result.actions.push(action);

    switch (action.type) {
      case RuleActionType.APPROVE:
        result.allowed = true;
        break;

      case RuleActionType.REJECT:
        result.allowed = false;
        result.reason = action.payload.reason || 'Transaction rejected by rule';
        break;

      case RuleActionType.REQUIRE_APPROVAL:
        result.requiresApproval = true;
        break;

      case RuleActionType.APPLY_PENALTY:
        result.penalties = result.penalties || [];
        result.penalties.push(action.payload);
        break;

      case RuleActionType.NOTIFY:
        // Send notification (implement notification service)
        logger.info(`Rule notification: ${action.payload.message}`);
        break;

      case RuleActionType.PAUSE:
        // Pause DAO operations
        logger.warn(`Rule action: Pausing DAO`);
        break;
    }
  }

  return result;
}

/**
 * Evaluate a transaction against DAO rules
 */
export async function evaluateTransaction(
  daoId: string,
  ruleType: RuleType,
  transactionData: any,
  userId: string
): Promise<RuleExecutionResult> {
  try {
    // Get all enabled rules for this DAO and type
    const rules = await getActiveRules(daoId, ruleType);

    if (rules.length === 0) {
      return { allowed: true, actions: [] };
    }

    // Sort by priority (higher first)
    rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Evaluate each rule
    for (const rule of rules) {
      const conditionsMet = evaluateConditions(rule.conditions, transactionData);

      if (conditionsMet) {
        const result = await executeRuleActions(rule.actions);

        // Log audit entry
        await logRuleExecution(
          rule.id,
          userId,
          result.allowed ? 'approved' : result.requiresApproval ? 'pending' : 'rejected',
          transactionData
        );

        if (!result.allowed || result.requiresApproval) {
          return result;
        }
      }
    }

    return { allowed: true, actions: [] };
  } catch (err) {
    logger.error(`Error evaluating transaction: ${err}`);
    throw err;
  }
}

/**
 * Get active rules for a DAO
 */
async function getActiveRules(daoId: string, ruleType?: RuleType): Promise<CustomRule[]> {
  // TODO: Implement database query
  // This would fetch rules from a daoRules table
  return [];
}

/**
 * Log rule execution for audit trail
 */
async function logRuleExecution(
  ruleId: string,
  userId: string,
  result: 'approved' | 'rejected' | 'pending',
  metadata: any
): Promise<void> {
  try {
    // TODO: Implement audit log creation
    logger.info(`Rule executed: ${ruleId}, Result: ${result}`);
  } catch (err) {
    logger.error(`Error logging rule execution: ${err}`);
  }
}

/**
 * Create a custom rule
 */
export async function createCustomRule(
  daoId: string,
  createdBy: string,
  rule: Omit<CustomRule, 'id' | 'createdAt' | 'updatedAt' | 'auditLog'>
): Promise<CustomRule> {
  try {
    const customRule: CustomRule = {
      id: uuidv4(),
      daoId,
      ruleType: rule.ruleType,
      name: rule.name,
      description: rule.description,
      enabled: rule.enabled,
      priority: rule.priority || 0,
      conditions: rule.conditions,
      actions: rule.actions,
      createdBy,
      auditLog: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // TODO: Save to database
    logger.info(`Custom rule created: ${customRule.id} for DAO ${daoId}`);
    return customRule;
  } catch (err) {
    logger.error(`Error creating custom rule: ${err}`);
    throw err;
  }
}

/**
 * Update a custom rule
 */
export async function updateCustomRule(
  ruleId: string,
  updates: Partial<Omit<CustomRule, 'id' | 'createdAt' | 'createdBy' | 'auditLog'>>
): Promise<CustomRule> {
  try {
    // TODO: Implement database update
    logger.info(`Custom rule updated: ${ruleId}`);
    throw new Error('Not yet implemented');
  } catch (err) {
    logger.error(`Error updating custom rule: ${err}`);
    throw err;
  }
}

/**
 * Delete a custom rule
 */
export async function deleteCustomRule(ruleId: string): Promise<void> {
  try {
    // TODO: Implement database deletion
    logger.info(`Custom rule deleted: ${ruleId}`);
  } catch (err) {
    logger.error(`Error deleting custom rule: ${err}`);
    throw err;
  }
}

/**
 * Get rule templates for a DAO type
 */
export function getRuleTemplates(ruleType: RuleType): any[] {
  switch (ruleType) {
    case RuleType.ENTRY:
      return RULE_TEMPLATES.entryRules;
    case RuleType.WITHDRAWAL:
      return RULE_TEMPLATES.withdrawalRules;
    case RuleType.ROTATION:
      return RULE_TEMPLATES.rotationRules;
    case RuleType.FINANCIAL:
      return RULE_TEMPLATES.financialRules;
    case RuleType.GOVERNANCE:
      return RULE_TEMPLATES.governanceRules;
    default:
      return [];
  }
}

// ============================================
// API HANDLERS
// ============================================

/**
 * Handler: POST /api/dao/:daoId/rules
 * Create a new rule (from template or custom)
 */
export async function createRuleHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const userId = req.user?.id;
    const { ruleType, name, description, conditions, actions, priority, enabled } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rule = await createCustomRule(daoId, userId, {
      daoId,
      createdBy: userId,
      ruleType,
      name,
      description,
      conditions,
      actions,
      priority: priority || 0,
      enabled: enabled !== false
    });

    res.json(rule);
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    res.status(500).json({ error: 'Failed to create rule' });
  }
}

/**
 * Handler: GET /api/dao/:daoId/rules
 * Get all rules for a DAO
 */
export async function getDaoRulesHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const rules = await getActiveRules(daoId);
    res.json(rules);
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    res.status(500).json({ error: 'Failed to get rules' });
  }
}

/**
 * Handler: GET /api/rules/templates/:ruleType
 * Get rule templates
 */
export async function getRuleTemplatesHandler(req: Request, res: Response) {
  try {
    const { ruleType } = req.params;
    const templates = getRuleTemplates(ruleType as RuleType);
    res.json(templates);
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    res.status(500).json({ error: 'Failed to get templates' });
  }
}

/**
 * Handler: POST /api/dao/:daoId/rules/validate
 * Validate a transaction against DAO rules
 */
export async function validateTransactionHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const userId = req.user?.id;
    const { ruleType, transactionData } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await evaluateTransaction(daoId, ruleType, transactionData, userId);
    res.json(result);
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    res.status(500).json({ error: 'Failed to validate transaction' });
  }
}

/**
 * Handler: DELETE /api/rules/:ruleId
 * Delete a rule
 */
export async function deleteRuleHandler(req: Request, res: Response) {
  try {
    const { ruleId } = req.params;
    await deleteCustomRule(ruleId);
    res.json({ status: 'deleted' });
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
}
