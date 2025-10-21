/**
 * MORIO - The Spirit (Conversational Interface)
 * 
 * Purpose: Provides the conversational personality and user interface layer
 * for the Morio AI assistant system.
 */

import { nuru } from '../../core/nuru';
import { SessionManager } from './api/session_manager';
import { ResponseGenerator } from './api/response_generator';
import type { ChatMessage, ChatResponse, MorioConfig } from './types';

export class MorioAgent {
  private sessionManager: SessionManager;
  private responseGenerator: ResponseGenerator;
  private config: MorioConfig;

  constructor(config?: Partial<MorioConfig>) {
    this.config = {
      personality: 'friendly',
      language: 'en',
      maxHistoryLength: 20,
      responseTimeout: 30000,
      ...config
    };
    
    this.sessionManager = new SessionManager();
    this.responseGenerator = new ResponseGenerator(this.config);
  }

  /**
   * Handle incoming chat message
   */
  async handleMessage(message: ChatMessage): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      // Get or create session context
      const session = await this.sessionManager.getSession(message.userId, message.daoId);
      
      // Understand the message using Nuru
      const understanding = await nuru.understand(message.content, session.context);
      
      // Generate appropriate response
      const response = await this.responseGenerator.generate(
        understanding,
        session.context
      );
      
      // Update session with the interaction
      await this.sessionManager.updateSession(message.userId, {
        lastMessage: message.content,
        lastResponse: response.text,
        lastIntent: understanding.intent,
        timestamp: new Date()
      });
      
      return {
        text: response.text,
        intent: understanding.intent,
        confidence: understanding.confidence,
        suggestions: response.suggestions || [],
        actions: response.actions || [],
        metadata: {
          processingTime: Date.now() - startTime,
          sessionId: session.id,
          language: understanding.language
        }
      };
      
    } catch (error) {
      console.error('Morio error:', error);
      return this.handleError(error);
    }
  }

  /**
   * Get session status
   */
  async getSessionStatus(userId: string): Promise<any> {
    return await this.sessionManager.getSession(userId);
  }

  /**
   * Clear user session
   */
  async clearSession(userId: string): Promise<void> {
    await this.sessionManager.clearSession(userId);
  }

  /**
   * Handle errors gracefully
   */
  private handleError(error: any): ChatResponse {
    return {
      text: "Samahani (sorry), I encountered an issue. Pole sana! Please try again or rephrase your question.",
      intent: 'error',
      confidence: 0,
      suggestions: [
        'Check DAO balance',
        'View active proposals',
        'Get help'
      ],
      actions: [],
      metadata: {
        error: error.message,
        processingTime: 0,
        sessionId: 'error'
      }
    };
  }
}

// Export singleton instance
export const morio = new MorioAgent();
export * from './types';
