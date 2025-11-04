/**
 * MORIO - The Spirit (Conversational Interface)
 * 
 * Purpose: Provides the conversational personality and user interface layer
 * for the Morio AI assistant system.
 */

import { nuru } from '../../core/nuru';
import { SessionManager } from './api/session_manager';
import { ResponseGenerator } from './api/response_generator';
import { MorioSession, MorioResponse } from './types';
import { OnboardingService } from '../../core/kwetu/services/onboarding_service';
import type { ChatMessage, ChatResponse, MorioConfig } from './types';

export class MorioAgent {
  private sessionManager: SessionManager;
  private responseGenerator: ResponseGenerator;
  private onboardingService: OnboardingService;
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
    this.onboardingService = new OnboardingService();
  }

  /**
   * Handle incoming chat message
   */
  async handleMessage(message: ChatMessage): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      // Get or create session context, potentially from onboarding status
      const session = await this.sessionManager.getSession(message.userId, message.daoId);
      const onboardingStatus = await this.onboardingService.getOnboardingStatus(message.userId);

      // If onboarding is not complete, guide the user through it
      if (!onboardingStatus?.completed) {
        const onboardingResponse = await this.onboardingService.handleOnboardingStep(message.userId, message.content, onboardingStatus);
        // Update session context with onboarding information
        session.context = { ...session.context, ...onboardingResponse.context };
        
        await this.sessionManager.updateSession(message.userId, {
          lastMessage: message.content,
          lastResponse: onboardingResponse.text,
          timestamp: new Date(),
          context: session.context // Ensure context is updated
        });

        return {
          text: onboardingResponse.text,
          intent: 'onboarding',
          confidence: 1,
          suggestions: onboardingResponse.suggestions || [],
          actions: onboardingResponse.actions || [],
          metadata: {
            processingTime: Date.now() - startTime,
            sessionId: session.id,
            onboardingStep: onboardingStatus?.currentStep,
            onboardingCompleted: false,
            language: 'en' // Assuming onboarding is in English for now
          }
        };
      }

      // Understand the message using Nuru, incorporating onboarding context
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
        timestamp: new Date(),
        context: session.context // Ensure context is updated
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
          language: understanding.language,
          onboardingCompleted: true // Explicitly state onboarding is complete
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
    // Combine session and onboarding status for a comprehensive view
    const session = await this.sessionManager.getSession(userId);
    const onboardingStatus = await this.onboardingService.getOnboardingStatus(userId);
    return { ...session, onboardingStatus };
  }

  /**
   * Clear user session
   */
  async clearSession(userId: string): Promise<void> {
    await this.sessionManager.clearSession(userId);
    await this.onboardingService.resetOnboarding(userId); // Reset onboarding status
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