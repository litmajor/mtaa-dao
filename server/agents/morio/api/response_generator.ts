/**
 * Response Generator
 *
 * Generates natural, contextual responses based on intent and context
 */

import type { UserContext } from '../../../core/nuru/types';
import type { Action, MorioConfig } from '../types';
import { responses, onboardingGuides } from '../config/responses';

export class ResponseGenerator {
  private config: MorioConfig;

  constructor(config: MorioConfig) {
    this.config = config;
  }

  /**
   * Generate response based on understanding and context
   */
  async generate(understanding: any, context: UserContext) {
    const { intent, entities, confidence } = understanding;

    // Get base response template
    const template = this.getResponseTemplate(intent);

    // Generate contextual suggestions and actions
    let suggestions: string[] = [];
    let actions: Action[] = [];

    // Handle onboarding intents
    switch (intent) {
      case 'onboarding_tour':
        return {
          text: onboardingGuides.tour,
          suggestions: ['How do I create a proposal?', 'Explain treasury', 'How do I vote?']
        };

      case 'onboarding_proposals':
        return {
          text: onboardingGuides.proposals,
          suggestions: ['Show example proposal', 'What makes a good proposal?', 'Back to tour']
        };

      case 'onboarding_voting':
        return {
          text: onboardingGuides.voting,
          suggestions: ['Show active proposals', 'What is voting power?', 'Back to tour']
        };

      case 'onboarding_treasury':
        return {
          text: onboardingGuides.treasury,
          suggestions: ['Check DAO balance', 'How do I deposit?', 'Back to tour']
        };

      case 'check_balance':
        suggestions = this.generateSuggestions(intent, context);
        actions = this.generateActions(intent, entities);
        break;

      default:
        // For other intents, proceed with default response generation
        suggestions = this.generateSuggestions(intent, context);
        actions = this.generateActions(intent, entities);
        break;
    }

    // Personalize response
    const personalizedText = this.personalizeResponse(template.text, context, entities);

    return {
      text: personalizedText,
      suggestions,
      actions
    };
  }

  /**
   * Get response template for intent
   */
  private getResponseTemplate(intent: string) {
    return responses[intent] || responses.default;
  }

  /**
   * Personalize response with context and entities
   */
  private personalizeResponse(
    template: string,
    context: UserContext,
    entities: Record<string, any>
  ): string {
    let response = template;

    // Replace placeholders
    response = response.replace('{name}', context.userId);
    response = response.replace('{amount}', entities.amount || '');
    response = response.replace('{currency}', entities.currency || 'KES');
    response = response.replace('{proposalId}', entities.proposalId || '');

    // Add personality based on config
    if (this.config.personality === 'friendly') {
      response = this.addFriendlyTouch(response);
    }

    return response;
  }

  /**
   * Add friendly personality touches
   */
  private addFriendlyTouch(response: string): string {
    const greetings = ['Hi!', 'Hello!', 'Hey there!', 'Habari!'];
    const confirmations = ['Sure thing!', 'Got it!', 'Absolutely!', 'Sawa!'];

    // 30% chance to add greeting
    if (Math.random() < 0.3) {
      const greeting = greetings[Math.floor(Math.random() * greetings.length)];
      response = `${greeting} ${response}`;
    }

    return response;
  }

  /**
   * Generate contextual suggestions
   */
  private generateSuggestions(intent: string, context: UserContext): string[] {
    const baseSuggestions: Record<string, string[]> = {
      withdraw: [
        'Check my balance first',
        'View withdrawal history',
        'See DAO spending limits'
      ],
      deposit: [
        'Check contribution rewards',
        'View my contribution history',
        'See DAO treasury status'
      ],
      check_balance: [
        'View transaction history',
        'See DAO analytics',
        'Check proposal allocations'
      ],
      submit_proposal: [
        'View proposal templates',
        'Check proposal guidelines',
        'See past proposals'
      ],
      vote: [
        'View proposal details',
        'Check my voting power',
        'See voting history'
      ],
      default: [
        'Check DAO balance',
        'View active proposals',
        'See community stats'
      ]
    };

    return baseSuggestions[intent] || baseSuggestions.default;
  }

  /**
   * Generate actionable buttons/actions
   */
  private generateActions(intent: string, entities: Record<string, any>): Action[] {
    const actions: Action[] = [];

    switch (intent) {
      case 'withdraw':
        actions.push({
          type: 'open_withdrawal',
          label: 'Start Withdrawal',
          data: entities
        });
        break;

      case 'deposit':
        actions.push({
          type: 'open_deposit',
          label: 'Deposit Funds',
          data: entities
        });
        break;

      case 'submit_proposal':
        actions.push({
          type: 'create_proposal',
          label: 'Create Proposal',
          data: entities
        });
        break;

      case 'vote':
        actions.push({
          type: 'cast_vote',
          label: 'Cast Vote',
          data: entities
        });
        break;

      case 'check_balance':
        actions.push({
          type: 'view_balance',
          label: 'View Full Balance',
          data: {}
        });
        break;
    }

    return actions;
  }
}