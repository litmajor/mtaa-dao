/**
 * Context Manager
 * 
 * Manages user context, conversation history, and reasoning state.
 * Provides contextual awareness for intelligent responses.
 */

import type { UserContext, Intent, Message } from '../types';

export class ContextManager {
  private contextStore: Map<string, UserContext>;

  constructor() {
    this.contextStore = new Map();
  }

  /**
   * Enrich context with current intent and state
   */
  async enrich(context: UserContext, intent: Intent): Promise<UserContext> {
    const existingContext = this.contextStore.get(context.userId) || context;
    
    // Update conversation history
    const updatedHistory = [
      ...existingContext.sessionData.conversationHistory,
      {
        role: 'user' as const,
        content: JSON.stringify(intent),
        timestamp: new Date()
      }
    ].slice(-20); // Keep last 20 messages

    const enrichedContext: UserContext = {
      ...existingContext,
      sessionData: {
        ...existingContext.sessionData,
        conversationHistory: updatedHistory,
        lastInteraction: new Date(),
        activeTask: this.inferActiveTask(intent, existingContext)
      }
    };

    this.contextStore.set(context.userId, enrichedContext);
    return enrichedContext;
  }

  /**
   * Generate reasoning based on context and understanding
   */
  async reason(understanding: any): Promise<any> {
    const { intent, context } = understanding;

    switch (intent) {
      case 'withdraw':
        return this.reasonWithdrawal(understanding);
      case 'deposit':
        return this.reasonDeposit(understanding);
      case 'submit_proposal':
        return this.reasonProposal(understanding);
      case 'vote':
        return this.reasonVote(understanding);
      case 'check_balance':
        return this.reasonBalanceCheck(understanding);
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
    if (intent.type === 'withdraw' || intent.type === 'deposit') {
      return {
        id: `tx_${Date.now()}`,
        type: intent.type,
        status: 'in_progress' as const,
        data: intent.entities
      };
    }

    if (intent.type === 'submit_proposal') {
      return {
        id: `proposal_${Date.now()}`,
        type: 'proposal_creation',
        status: 'in_progress' as const,
        data: intent.entities
      };
    }

    return context.sessionData.activeTask;
  }

  /**
   * Reasoning strategies for different intents
   */
  private reasonWithdrawal(understanding: any) {
    const { entities, context } = understanding;
    
    return {
      explanation: `To withdraw ${entities.amount || 'funds'} from the DAO treasury, you need to submit a withdrawal proposal that will be voted on by members.`,
      action: 'guide_withdrawal_proposal',
      confidence: 0.9,
      sources: ['dao_rules', 'treasury_policy'],
      alternatives: ['check_balance_first', 'view_spending_history']
    };
  }

  private reasonDeposit(understanding: any) {
    const { entities } = understanding;
    
    return {
      explanation: `Great! I'll help you deposit ${entities.amount || 'funds'} to the DAO treasury. This will increase your contribution score.`,
      action: 'initiate_deposit',
      confidence: 0.95,
      sources: ['deposit_guide'],
      alternatives: []
    };
  }

  private reasonProposal(understanding: any) {
    return {
      explanation: 'I can help you create a proposal. You\'ll need to provide a title, description, and funding amount if applicable.',
      action: 'guide_proposal_creation',
      confidence: 0.9,
      sources: ['governance_guide'],
      alternatives: ['view_proposal_templates', 'check_proposal_rules']
    };
  }

  private reasonVote(understanding: any) {
    const { entities } = understanding;
    
    return {
      explanation: `I'll help you vote on ${entities.proposalId ? 'proposal #' + entities.proposalId : 'the active proposal'}.`,
      action: 'initiate_voting',
      confidence: 0.9,
      sources: ['voting_guide'],
      alternatives: ['view_proposal_details', 'check_voting_power']
    };
  }

  private reasonBalanceCheck(understanding: any) {
    return {
      explanation: 'I\'ll fetch the current treasury balance and your contribution status.',
      action: 'fetch_balance',
      confidence: 1.0,
      sources: ['blockchain', 'database'],
      alternatives: ['view_transaction_history', 'check_allocations']
    };
  }

  /**
   * Get context for a user
   */
  getContext(userId: string): UserContext | undefined {
    return this.contextStore.get(userId);
  }

  /**
   * Clear context for a user
   */
  clearContext(userId: string): void {
    this.contextStore.delete(userId);
  }
}
