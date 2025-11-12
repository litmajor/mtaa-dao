/**
 * Type definitions for Nuru cognitive core
 */

export interface UserContext {
  userId: string;
  daoId: string;
  role: 'guest' | 'member' | 'admin' | 'founder';
  walletAddress?: string;
  contributionScore: number;
  recentActions: Action[];
  preferences: {
    language: string;
    notifications: boolean;
    theme: 'light' | 'dark';
  };
  sessionData: {
    activeTask?: Task;
    conversationHistory: Message[];
    lastInteraction: Date;
  };
}

export interface Action {
  type: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface Task {
  id: string;
  type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  data: Record<string, any>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Intent {
  type: IntentType;
  entities: Record<string, any>;
  confidence: number;
  language?: string;
  sentiment?: number;
}

export type IntentType =
  | 'withdraw'
  | 'deposit'
  | 'check_balance'
  | 'submit_proposal'
  | 'vote'
  | 'check_proposal'
  | 'join_dao'
  | 'onboarding'
  | 'help'
  | 'analytics'
  | 'community_stats'
  | 'treasury_report'
  | 'governance_info'
  | 'unknown';

export interface ReasoningResponse {
  reasoning: string;
  recommendation: string;
  confidence: number;
  sources: string[];
  alternatives?: string[];
}

export interface AnalysisRequest {
  type: 'treasury' | 'governance' | 'community';
  daoId: string;
  timeframe?: string;
}

export interface AnalysisResponse {
  summary: string;
  metrics: Record<string, number>;
  insights: string[];
  risks: Risk[];
  recommendations: string[];
}

export interface Risk {
  level: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  mitigation?: string;
}

export interface EthicsCheck {
  proposalId: string;
  checks: {
    budgetCompliance: boolean;
    conflictOfInterest: boolean;
    communityBenefit: number;
    riskLevel: 'low' | 'medium' | 'high';
    fairnessScore: number;
  };
  recommendations: string[];
  requiredActions: string[];
}
