/**
 * Shared types for Morio AI Assistant System
 * 
 * These types ensure type safety across the three layers:
 * - NURU (Mind): Cognitive processing
 * - KWETU (Body): DAO operations  
 * - MORIO (Spirit): Conversational interface
 */

export interface Understanding {
  intent: IntentType;
  entities: Record<string, any>;
  confidence: number;
  context: EnrichedContext;
  language: string;
  sentiment: number;
}

export interface EnrichedContext {
  userId: string;
  daoId: string;
  role: 'guest' | 'member' | 'admin' | 'founder';
  walletAddress?: string;
  contributionScore: number;
  sessionData: {
    conversationHistory: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: Date;
    }>;
    lastInteraction: Date;
    activeTask?: {
      id: string;
      type: string;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
      data: Record<string, any>;
    };
  };
}

export interface ReasoningOutput {
  explanation: string;
  action: ActionType;
  confidence: number;
  sources: string[];
  alternatives: string[];
  kwetuOperation?: KwetuOperation;
}

export interface KwetuOperation {
  type: 'treasury' | 'governance' | 'community' | 'read_only';
  service: string;
  method: string;
  params: Record<string, any>;
}

export interface MorioResponse {
  text: string;
  suggestions: string[];
  actions: ActionButton[];
  data?: any;
}

export interface ActionButton {
  type: string;
  label: string;
  data?: Record<string, any>;
}

export type IntentType =
  | 'withdraw'
  | 'deposit'
  | 'check_balance'
  | 'submit_proposal'
  | 'vote'
  | 'check_proposal'
  | 'join_dao'
  | 'onboard'
  | 'help'
  | 'analytics'
  | 'community_stats'
  | 'treasury_report'
  | 'governance_info'
  | 'unknown';

export type ActionType =
  | 'guide_withdrawal_proposal'
  | 'initiate_deposit'
  | 'fetch_balance'
  | 'guide_proposal_creation'
  | 'initiate_voting'
  | 'show_proposals'
  | 'onboard_user'
  | 'ask_clarification'
  | 'provide_help'
  | 'fetch_analytics';
