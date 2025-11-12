/**
 * NURU - The Mind (Cognitive Core)
 * 
 * Purpose: Provides reasoning, analytical intelligence, and contextual awareness
 * for the Morio AI assistant system.
 */

import { IntentClassifier } from './nlu/intent_classifier';
import { ContextManager } from './reasoning/context_manager';
import { FinancialAnalyzer } from './analytics/financial_analyzer';
import { GovernanceAnalyzer } from './analytics/governance_analyzer';
import { CommunityAnalyzer } from './analytics/community_analyzer';
import { RiskAssessor } from './ethics/risk_assessor';
import type { UserContext, AnalysisRequest, ReasoningResponse } from './types';
import type { AgentMessage } from '../agent-framework/message-bus';
import { AgentCommunicator } from '../agent-framework/agent-communicator';
import { MessageType } from '../agent-framework/message-bus';

export class NuruCore {
  private intentClassifier: IntentClassifier;
  private contextManager: ContextManager;
  private financialAnalyzer: FinancialAnalyzer;
  private governanceAnalyzer: GovernanceAnalyzer;
  private communityAnalyzer: CommunityAnalyzer;
  private riskAssessor: RiskAssessor;
  private communicator: AgentCommunicator;

  constructor() {
    this.intentClassifier = new IntentClassifier();
    this.contextManager = new ContextManager();
    this.financialAnalyzer = new FinancialAnalyzer();
    this.governanceAnalyzer = new GovernanceAnalyzer();
    this.communityAnalyzer = new CommunityAnalyzer();
    this.riskAssessor = new RiskAssessor();
    this.communicator = new AgentCommunicator('NURU');
    
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    this.communicator.subscribe([
      MessageType.ANALYSIS_REQUEST,
      MessageType.USER_QUERY,
      MessageType.HEALTH_CHECK,
      MessageType.RISK_ASSESSMENT // Added for completeness
    ], this.handleMessage.bind(this));
  }

  private async handleMessage(message: AgentMessage): Promise<void> { // Typed
    try {
      let response: any;
  switch (message.type) {
        case MessageType.ANALYSIS_REQUEST:
          response = await this.analyze(message.payload as AnalysisRequest);
          break;
        case MessageType.USER_QUERY:
          response = await this.understand(message.payload.query, message.payload.context);
          break;
        case MessageType.HEALTH_CHECK:
          response = await this.healthCheck();
          break;
        case MessageType.RISK_ASSESSMENT:
          const { proposalId, daoId } = message.payload;
          response = await this.assessRisk(proposalId, daoId);
          break;
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }

      if (message.requiresResponse && message.correlationId) {
        await this.communicator.respond(message.correlationId, response);
      }
    } catch (error) {
      console.error('NURU error handling message:', error);
      if (message.requiresResponse && message.correlationId) {
        await this.communicator.respond(message.correlationId, { error: (error as Error).message });
      }
    }
  }

  /**
   * Understand user message and extract intent
   */
  async understand(message: string, context: UserContext) {
    const intent = await this.intentClassifier.classify(message);
    const enrichedContext = this.contextManager.enrich(context, intent); // Sync if possible
    
    return {
      intent: intent.type,
      entities: intent.entities,
      confidence: intent.confidence,
      context: enrichedContext,
      language: intent.language || 'en',
      sentiment: intent.sentiment || 0
    };
  }

  /**
   * Generate reasoning and recommendations
   */
  async reason(query: string, context: UserContext): Promise<ReasoningResponse> {
    const understanding = await this.understand(query, context);
  const reasoning = this.contextManager.reason({ intent: { type: understanding.intent, entities: understanding.entities, confidence: understanding.confidence }, context: understanding.context }); // Sync if possible
    
    return {
      reasoning: reasoning.explanation,
      recommendation: reasoning.action,
      confidence: reasoning.confidence,
      sources: reasoning.sources,
      alternatives: reasoning.alternatives
    };
  }

  /**
   * Analyze DAO data (treasury, governance, community)
   */
  async analyze(request: AnalysisRequest) {
    switch (request.type) {
      case 'treasury':
        return await this.financialAnalyzer.analyze(request.daoId, request.timeframe);
      case 'governance':
        return await this.governanceAnalyzer.analyze(request.daoId, request.timeframe);
      case 'community':
        return await this.communityAnalyzer.analyze(request.daoId, request.timeframe);
      default:
        throw new Error(`Unknown analysis type: ${request.type}`);
    }
  }

  /**
   * Assess risks and ethical compliance
   */
  async assessRisk(proposalId: string, daoId: string) {
    return await this.riskAssessor.assess(proposalId, daoId);
  }

  /**
   * Health check for Nuru core
   */
  async healthCheck() {
    // Dynamic checks
    let status = 'healthy';
    const components = {
      intentClassifier: 'active',
      contextManager: 'active',
      analyzers: 'active',
      riskAssessor: 'active'
    };

    try {
      // Test classifier
      await this.intentClassifier.classify('test');
      // Test context
      this.contextManager.getContext('test_user');
      // Test analyzer (no-op)
      await this.financialAnalyzer.analyze('test_dao', '30d');
      // Test risk
      await this.riskAssessor.assess('test_proposal', 'test_dao');
    } catch (error) {
      status = 'degraded';
      console.warn('Health check failed:', error);
    }

    return {
      status,
      components,
      timestamp: new Date().toISOString()
    };
  }
}

export const nuru = new NuruCore();
export * from './types';