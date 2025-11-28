/**
 * Response Generator
 *
 * Generates natural, contextual responses based on intent and context
 * Now with optional LLM integration for enhanced responses
 * KWETU Integration: Executes real treasury and proposal operations
 */

import type { UserContext } from '../../../core/nuru/types';
import type { Action, MorioConfig } from '../types';
import { responses, onboardingGuides } from '../config/responses';
import { createLLMProvider, LLMResponseGenerator, LLMConfig } from './llm_provider';
import { Logger } from '../../../utils/logger';
import { kwetu } from '../../../core/kwetu';
import { storage } from '../../../storage';

const logger = new Logger('response-generator');

export class ResponseGenerator {
  private config: MorioConfig;
  private llmGenerator?: LLMResponseGenerator;

  constructor(config: MorioConfig, llmConfig?: LLMConfig) {
    this.config = config;
    
    // Initialize LLM if configured
    if (llmConfig) {
      try {
        const llmProvider = createLLMProvider(llmConfig);
        this.llmGenerator = new LLMResponseGenerator(llmProvider);
        logger.info('LLM provider initialized');
      } catch (error) {
        logger.warn('Failed to initialize LLM provider, using template responses:', error);
      }
    }
  }

  /**
   * Generate response based on understanding and context
   * Uses LLM if available, falls back to templates
   * KWETU Integration: Fetches real DAO data for treasury and proposal operations
   */
  async generate(understanding: any, context: UserContext) {
    const { intent, entities, confidence } = understanding;

    // Try LLM first if available and confidence is high enough
    if (this.llmGenerator && confidence > 0.6) {
      try {
        const llmResponse = await this.llmGenerator.generateResponse(
          understanding.rawInput || `User asking about: ${intent}`,
          context
        );
        
        return {
          text: llmResponse.text,
          suggestions: this.generateSuggestions(intent, context),
          actions: this.generateActions(intent, entities)
        };
      } catch (error) {
        logger.warn('LLM generation failed, falling back to templates:', error);
      }
    }

    // Fall back to template-based response
    const template = this.getResponseTemplate(intent);
    let suggestions: string[] = [];
    let actions: Action[] = [];
    let responseText = '';

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
        // Fetch real treasury data via KWETU
        try {
          const treasuryData = await this.fetchTreasuryBalance(context.daoId);
          responseText = `Your DAO treasury: **${treasuryData.balance} ${treasuryData.currency}** across ${treasuryData.vaults} vault(s). Last updated: ${new Date(treasuryData.lastUpdated).toLocaleString()}`;
          suggestions = this.generateSuggestions(intent, context);
          actions = this.generateActions(intent, { ...entities, balance: treasuryData.balance });
        } catch (error) {
          logger.warn('Failed to fetch treasury balance, using template:', error);
          responseText = this.personalizeResponse(template.text, context, entities);
          suggestions = this.generateSuggestions(intent, context);
          actions = this.generateActions(intent, entities);
        }
        break;

      case 'submit_proposal':
        // Guide user through proposal creation
        try {
          const proposalData = {
            title: entities.title || 'New Proposal',
            description: entities.description || 'Describe your proposal here',
            daoId: context.daoId,
            proposerId: context.userId,
            status: 'draft'
          };
          
          // Validate required fields
          if (!proposalData.title || !proposalData.daoId) {
            responseText = 'To create a proposal, I need a title and DAO ID. Please provide these details.';
          } else {
            // Create proposal in database
            const proposal = await this.createProposalAsync(proposalData);
            responseText = `Proposal created successfully! 🎉\n\n**ID:** ${proposal.id}\n**Title:** ${proposal.title}\n\nNext steps:\n1. Add more details\n2. Submit to the DAO\n3. Community votes`;
            suggestions = ['View proposal', 'Submit to voting', 'Edit proposal'];
            actions = [{
              type: 'view_proposal',
              label: 'View Proposal',
              data: { proposalId: proposal.id }
            }];
          }
        } catch (error) {
          logger.warn('Failed to create proposal, using template:', error);
          responseText = this.personalizeResponse(template.text, context, entities);
          suggestions = this.generateSuggestions(intent, context);
          actions = this.generateActions(intent, entities);
        }
        break;

      default:
        // For other intents, proceed with default response generation
        responseText = this.personalizeResponse(template.text, context, entities);
        suggestions = this.generateSuggestions(intent, context);
        actions = this.generateActions(intent, entities);
        break;
    }

    return {
      text: responseText || this.personalizeResponse(template.text, context, entities),
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

  /**
   * KWETU Integration: Fetch real treasury balance from DAO vaults
   */
  private async fetchTreasuryBalance(daoId: string): Promise<any> {
    try {
      if (!daoId) {
        throw new Error('DAO ID is required to fetch treasury balance');
      }

      // Call KWETU treasury service to get actual balance
      const treasuryData = await kwetu.execute({
        service: 'treasury',
        method: 'getBalance',
        params: { daoId }
      });

      logger.info('Treasury balance fetched for DAO:', { daoId, balance: treasuryData.balance });
      return treasuryData;
    } catch (error) {
      logger.error('Error fetching treasury balance:', error);
      // Graceful fallback to template response
      throw new Error(`Failed to fetch treasury balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * KWETU Integration: Create a new proposal in the database
   */
  private async createProposalAsync(proposalData: any): Promise<any> {
    try {
      // Validate proposal data
      if (!proposalData.title) {
        throw new Error('Proposal title is required');
      }
      if (!proposalData.daoId) {
        throw new Error('DAO ID is required to create proposal');
      }

      // Create proposal via storage layer
      const proposal = await storage.createProposal({
        ...proposalData,
        createdAt: new Date(),
        updatedAt: new Date(),
        proposalType: proposalData.proposalType || 'general',
        fundingAmount: proposalData.fundingAmount || 0
      });

      logger.info('Proposal created successfully:', { proposalId: proposal.id, title: proposal.title });
      return proposal;
    } catch (error) {
      logger.error('Error creating proposal:', error);
      throw new Error(`Failed to create proposal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}