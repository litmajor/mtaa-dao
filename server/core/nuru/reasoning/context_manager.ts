/**
 * Context Manager
 * 
 * Manages user context, conversation history, and reasoning state.
 * Provides contextual awareness for intelligent responses.
 */

import type { UserContext, Intent, Message } from '../types';
import { v4 as uuidv4 } from 'uuid'; // Assume uuid package is installed for unique IDs
import { db } from '../../../db'; // Import db for potential persistence

export class ContextManager {
  private contextStore: Map<string, UserContext>; // In-memory cache

  constructor() {
    this.contextStore = new Map();
    // Optionally load from DB on init if needed
  }

  /**
   * Enrich context with current intent and state
   */
  enrich(context: UserContext, intent: Intent): UserContext { // Made sync
    if (!context.userId) {
      throw new Error('User ID is required for context enrichment');
    }

    const existingContext = this.getContext(context.userId) || context;
    
    // Update conversation history (store intent type and entities for efficiency)
    const updatedHistory: Message[] = [
      ...existingContext.sessionData.conversationHistory,
      {
        role: 'user',
        content: `${intent.type}: ${JSON.stringify(intent.entities)}`, // More concise
        timestamp: new Date().toISOString() // Use ISO for consistency
      }
    ].slice(-20); // Keep last 20 messages

    const enrichedContext: UserContext = {
      ...existingContext,
      sessionData: {
        ...existingContext.sessionData,
        conversationHistory: updatedHistory,
        lastInteraction: new Date().toISOString(),
        activeTask: this.inferActiveTask(intent, existingContext)
      }
    };

    this.contextStore.set(context.userId, enrichedContext);
    // Persist to DB (assume userContexts table with userId PK and context JSON)
    this.persistContext(enrichedContext).catch(err => console.error('Failed to persist context:', err));

    return enrichedContext;
  }

  /**
   * Generate reasoning based on context and understanding
   */
  reason(understanding: { intent: Intent; context: UserContext; entities?: Record<string, any> }): any { // Better typing
    const { intent, context, entities = intent.entities || {} } = understanding;
    const intentType = intent.type; // Use Intent object

    // Dynamic confidence based on entity completeness and context
    let baseConfidence = 0.8;
    if (Object.keys(entities).length === 0) baseConfidence -= 0.3;

    // Check activeTask to avoid redundancy
    const activeTask = context.sessionData.activeTask;
    if (activeTask && activeTask.type === intentType && activeTask.status === 'in_progress') {
      return {
        explanation: `Continuing active ${intentType} task (ID: ${activeTask.id}).`,
        action: 'continue_task',
        confidence: 0.95,
        sources: ['context'],
        alternatives: ['cancel_task', 'new_task']
      };
    }

    switch (intentType) {
      case 'withdraw':
        return this.reasonWithdrawal({ entities, context }, baseConfidence);
      case 'deposit':
        return this.reasonDeposit({ entities, context }, baseConfidence);
      case 'submit_proposal':
        return this.reasonProposal({ entities, context }, baseConfidence);
      case 'vote':
        return this.reasonVote({ entities, context }, baseConfidence);
      case 'check_balance':
        return this.reasonBalanceCheck({ entities, context }, baseConfidence);
      case 'check_proposal': // Added missing case from patterns
        return this.reasonCheckProposal({ entities, context }, baseConfidence);
      default:
        return {
          explanation: 'I can help you with DAO operations, treasury management, and governance.',
          action: 'ask_clarification',
          confidence: 0.5,
          sources: ['system'],
          alternatives: ['check_balance', 'view_proposals', 'join_dao']
        };
    }
  }

  /**
   * Infer active task from intent
   */
  private inferActiveTask(intent: Intent, context: UserContext) {
    const existingTask = context.sessionData.activeTask;
    if (existingTask && existingTask.status !== 'completed') {
      // Check if new intent conflicts or continues
      if (existingTask.type === intent.type) {
        return existingTask; // Continue
      }
      // Else, complete old and start new? For now, overwrite
    }

    let taskType: string | undefined;
    let data = intent.entities;

    if (['withdraw', 'deposit'].includes(intent.type)) {
      taskType = intent.type;
    } else if (intent.type === 'submit_proposal') {
      taskType = 'proposal_creation';
    }

    if (taskType) {
      return {
        id: uuidv4(), // Use UUID for uniqueness
        type: taskType,
        status: 'in_progress',
        data
      };
    }

    return existingTask;
  }

  /**
   * Reasoning strategies for different intents (now take params and baseConfidence)
   */
  private reasonWithdrawal(params: { entities: Record<string, any>; context: UserContext }, baseConfidence: number) {
    const { entities } = params;
    let confidence = baseConfidence;
    if (!entities.amount) confidence -= 0.2;
    
    return {
      explanation: `To withdraw ${entities.amount || 'funds'} from the DAO treasury, you need to submit a withdrawal proposal that will be voted on by members.`,
      action: 'guide_withdrawal_proposal',
      confidence,
      sources: ['dao_rules', 'treasury_policy'],
      alternatives: ['check_balance_first', 'view_spending_history']
    };
  }

  private reasonDeposit(params: { entities: Record<string, any>; context: UserContext }, baseConfidence: number) {
    const { entities } = params;
    let confidence = baseConfidence;
    if (!entities.amount) confidence -= 0.2;
    
    return {
      explanation: `Great! I'll help you deposit ${entities.amount || 'funds'} to the DAO treasury. This will increase your contribution score.`,
      action: 'initiate_deposit',
      confidence,
      sources: ['deposit_guide'],
      alternatives: []
    };
  }

  private reasonProposal(params: { entities: Record<string, any>; context: UserContext }, baseConfidence: number) {
    return {
      explanation: 'I can help you create a proposal. You\'ll need to provide a title, description, and funding amount if applicable.',
      action: 'guide_proposal_creation',
      confidence: baseConfidence,
      sources: ['governance_guide'],
      alternatives: ['view_proposal_templates', 'check_proposal_rules']
    };
  }

  private reasonVote(params: { entities: Record<string, any>; context: UserContext }, baseConfidence: number) {
    const { entities } = params;
    let confidence = baseConfidence;
    if (!entities.proposalId) confidence -= 0.3;
    
    return {
      explanation: `I'll help you vote on ${entities.proposalId ? 'proposal #' + entities.proposalId : 'the active proposal'}.`,
      action: 'initiate_voting',
      confidence,
      sources: ['voting_guide'],
      alternatives: ['view_proposal_details', 'check_voting_power']
    };
  }

  private reasonBalanceCheck(params: { entities: Record<string, any>; context: UserContext }, baseConfidence: number) {
    return {
      explanation: 'I\'ll fetch the current treasury balance and your contribution status.',
      action: 'fetch_balance',
      confidence: baseConfidence,
      sources: ['blockchain', 'database'],
      alternatives: ['view_transaction_history', 'check_allocations']
    };
  }

  private reasonCheckProposal(params: { entities: Record<string, any>; context: UserContext }, baseConfidence: number) {
    const { entities } = params;
    let confidence = baseConfidence;
    if (!entities.proposalId) confidence -= 0.2;
    
    return {
      explanation: `Fetching status for ${entities.proposalId ? 'proposal #' + entities.proposalId : 'active proposals'}.`,
      action: 'fetch_proposal_status',
      confidence,
      sources: ['database'],
      alternatives: ['list_all_proposals', 'view_governance_rules']
    };
  }

  /**
   * Get context for a user (with DB fallback)
   */
  getContext(userId: string): UserContext | undefined {
    let context = this.contextStore.get(userId);
    if (!context) {
      // Fetch from DB
      const dbContext = db.select().from(userContexts).where(eq(userContexts.userId, userId)).limit(1);
      if (dbContext.length > 0) {
        context = dbContext[0].context as UserContext; // Assume JSON column
        this.contextStore.set(userId, context);
      }
    }
    return context;
  }

  /**
   * Clear context for a user
   */
  clearContext(userId: string): void {
    this.contextStore.delete(userId);
    // Delete from DB
    db.delete(userContexts).where(eq(userContexts.userId, userId));
  }

  /**
   * Persist context to DB (async)
   */
  private async persistContext(context: UserContext) {
    await db.upsert(userContexts).set({
      userId: context.userId,
      context: context as any // JSON
    });
  }

  // Method to add assistant message to history (call after response)
  addAssistantMessage(userId: string, content: string) {
    const context = this.getContext(userId);
    if (context) {
      const updatedHistory = [
        ...context.sessionData.conversationHistory,
        {
          role: 'assistant',
          content,
          timestamp: new Date().toISOString()
        }
      ].slice(-20);
      context.sessionData.conversationHistory = updatedHistory;
      this.contextStore.set(userId, context);
      this.persistContext(context);
    }
  }
}