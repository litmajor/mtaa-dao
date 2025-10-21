/**
 * Type definitions for Morio agent
 */

import type { UserContext } from '../../core/nuru/types';

export interface ChatMessage {
  userId: string;
  daoId: string;
  content: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface ChatResponse {
  text: string;
  intent: string;
  confidence: number;
  suggestions: string[];
  actions: Action[];
  metadata: {
    processingTime: number;
    sessionId: string;
    language?: string;
    error?: string;
  };
}

export interface Action {
  type: string;
  label: string;
  data?: Record<string, any>;
}

export interface Session {
  id: string;
  userId: string;
  daoId?: string;
  context: UserContext;
  createdAt: Date;
  lastActivity: Date;
  metadata: {
    lastMessage?: string;
    lastResponse?: string;
    lastIntent?: string;
  };
}

export interface MorioConfig {
  personality: 'friendly' | 'professional' | 'casual';
  language: string;
  maxHistoryLength: number;
  responseTimeout: number;
}
