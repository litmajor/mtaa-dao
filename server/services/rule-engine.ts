import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { daoRules, ruleExecutions, ruleTemplates } from '../../shared/schema';
import { v4 as uuidv4 } from 'uuid';

interface RuleCondition {
  field: string;
  operator: 'equals' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: any;
}

interface RuleAction {
  type: 'approve' | 'reject' | 'notify' | 'apply_penalty' | 'trigger_vote';
  payload: Record<string, any>;
}

interface RuleConfig {
  conditions: RuleCondition[];
  actions: RuleAction[];
  operator?: 'AND' | 'OR';
}

interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  status: 'approved' | 'rejected' | 'pending' | 'error';
  reason?: string;
  executionTime: number;
}

export class RuleEngine {
  // Create a new rule for a DAO
  async createRule(daoId: string, userId: string, ruleData: {
    name: string;
    description: string;
    eventType: string;
    templateId?: string;
    config: RuleConfig;
    priority?: number;
  }): Promise<string> {
    const ruleId = uuidv4();
    
    const insertData: any = {
      name: ruleData.name,
      description: ruleData.description,
      eventType: ruleData.eventType,
      ruleConfig: ruleData.config,
      priority: ruleData.priority || 100,
      createdBy: userId,
      isActive: true,
      daoId
    };

    if (ruleData.templateId) {
      insertData.templateId = ruleData.templateId;
    }

    await (db as any)
      .insert(daoRules)
      .values(insertData);

    return ruleId;
  }

  // Get all rules for a DAO
  async getRulesForDao(daoId: string): Promise<any[]> {
    return await (db as any).query.daoRules.findMany({
      where: and(
        eq((daoRules as any).daoId, daoId),
        eq((daoRules as any).isActive, true)
      )
    });
  }

  // Get a single rule by ID
  async getRule(ruleId: string): Promise<any> {
    return await (db as any).query.daoRules.findFirst({
      where: eq((daoRules as any).id, ruleId)
    });
  }

  // Get rules filtered by event type
  async getRulesForEvent(daoId: string, eventType: string): Promise<any[]> {
    return await (db as any).query.daoRules.findMany({
      where: and(
        eq((daoRules as any).daoId, daoId),
        eq((daoRules as any).eventType, eventType),
        eq((daoRules as any).isActive, true)
      )
    });
  }

  // Evaluate a single rule
  async evaluateRule(rule: any, context: Record<string, any>): Promise<RuleEvaluationResult> {
    const startTime = Date.now();
    const config: RuleConfig = typeof rule.ruleConfig === 'string' 
      ? JSON.parse(rule.ruleConfig) 
      : rule.ruleConfig;

    try {
      // Evaluate all conditions
      const conditionResults = config.conditions.map(cond => 
        this.evaluateCondition(cond, context)
      );

      // Combine using operator (default AND)
      const operator = config.operator || 'AND';
      let allConditionsMet: boolean;
      
      if (operator === 'OR') {
        allConditionsMet = conditionResults.some(result => result);
      } else {
        allConditionsMet = conditionResults.every(result => result);
      }

      // If conditions met, execute actions
      if (allConditionsMet) {
        const actionResults = await Promise.all(
          config.actions.map(action => this.executeAction(action, context))
        );
        
        const failedActions = actionResults.filter(r => r.success === false);
        const reason = failedActions
          .map(r => r.reason)
          .join('; ');

        const status = failedActions.length === 0 ? 'approved' : 'rejected';

        // Log execution
        await this.logExecution(rule.id, rule.daoId, rule.eventType, context, allConditionsMet, actionResults, failedActions.length === 0 ? 'success' : 'failed', reason);

        return {
          ruleId: rule.id,
          ruleName: rule.name,
          status,
          reason: reason || undefined,
          executionTime: Date.now() - startTime
        };
      } else {
        // Conditions not met - rule doesn't apply
        await this.logExecution(rule.id, rule.daoId, rule.eventType, context, false, [], 'success', 'Conditions not met');

        return {
          ruleId: rule.id,
          ruleName: rule.name,
          status: 'approved',
          reason: 'Conditions not met',
          executionTime: Date.now() - startTime
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Log error
      await this.logExecution(rule.id, rule.daoId, rule.eventType, context, false, [], 'failed', errorMsg);

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        status: 'error',
        reason: errorMsg,
        executionTime: Date.now() - startTime
      };
    }
  }

  // Evaluate all rules for an event
  async evaluateAllRules(daoId: string, eventType: string, context: Record<string, any>): Promise<RuleEvaluationResult[]> {
    const rules = await this.getRulesForEvent(daoId, eventType);
    
    return Promise.all(
      rules.map(rule => this.evaluateRule(rule, context))
    );
  }

  // Check if all rules approved
  checkAllApproved(results: RuleEvaluationResult[]): boolean {
    return results.every(r => r.status === 'approved' || r.status === 'pending');
  }

  // Evaluate a single condition
  private evaluateCondition(condition: RuleCondition, context: Record<string, any>): boolean {
    const value = this.getNestedValue(context, condition.field);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'gte':
        return Number(value) >= Number(condition.value);
      case 'lte':
        return Number(value) <= Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'contains':
        return String(value).includes(String(condition.value));
      default:
        return false;
    }
  }

  // Execute an action
  private async executeAction(action: RuleAction, context: Record<string, any>): Promise<{success: boolean; reason?: string}> {
    try {
      switch (action.type) {
        case 'approve':
          return { success: true };
        
        case 'reject':
          return { 
            success: false, 
            reason: action.payload.reason || 'Rejected by rule'
          };
        
        case 'notify':
          // Send notification
          console.log('[RuleEngine] Sending notification:', action.payload);
          return { success: true };
        
        case 'apply_penalty':
          // Apply penalty (deduct amount)
          console.log('[RuleEngine] Applying penalty:', action.payload);
          return { success: true };
        
        case 'trigger_vote':
          // Trigger a vote
          console.log('[RuleEngine] Triggering vote:', action.payload);
          return { success: true };
        
        default:
          return { success: false, reason: 'Unknown action type' };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, reason: errorMsg };
    }
  }

  // Get nested value from context (supports dot notation)
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, prop) => 
      current?.[prop], obj
    );
  }

  // Log rule execution
  private async logExecution(
    ruleId: string,
    daoId: string,
    eventType: string,
    context: Record<string, any>,
    conditionsMet: boolean,
    actionsExecuted: any[],
    executionResult: 'success' | 'failed' | 'partial',
    errorMessage?: string
  ): Promise<void> {
    const executionId = uuidv4();
    
    try {
      await (db as any).insert(ruleExecutions).values({
        ruleId,
        daoId,
        eventType,
        context,
        conditionsMet,
        actionsExecuted: actionsExecuted,
        executionResult,
        errorMessage: errorMessage || null,
        executedAt: new Date()
      });
    } catch (error) {
      console.error('[RuleEngine] Failed to log execution:', error);
    }
  }

  // Get execution history for a rule
  async getExecutionHistory(ruleId: string, limit = 50): Promise<any[]> {
    return await (db as any).query.ruleExecutions.findMany({
      where: eq((ruleExecutions as any).ruleId, ruleId),
      limit
    });
  }

  // Update a rule
  async updateRule(ruleId: string, userId: string, updates: Record<string, any>): Promise<void> {
    const updateData: any = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.config !== undefined) updateData.ruleConfig = updates.config;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.priority !== undefined) updateData.priority = updates.priority;

    updateData.updatedBy = userId;
    updateData.updatedAt = new Date();

    if (Object.keys(updateData).length > 0) {
      await (db as any).update(daoRules).set(updateData).where(eq((daoRules as any).id, ruleId));
    }
  }

  // Delete a rule
  async deleteRule(ruleId: string): Promise<void> {
    await (db as any).delete(daoRules).where(eq((daoRules as any).id, ruleId));
  }

  // Get rule templates
  async getTemplates(category?: string): Promise<any[]> {
    if (category) {
      return await (db as any).query.ruleTemplates.findMany({
        where: eq((ruleTemplates as any).category, category)
      });
    }

    return await (db as any).query.ruleTemplates.findMany();
  }

  // Get a single template
  async getTemplate(templateId: string): Promise<any> {
    return await (db as any).query.ruleTemplates.findFirst({
      where: eq((ruleTemplates as any).id, templateId)
    });
  }
}

export const ruleEngine = new RuleEngine();
