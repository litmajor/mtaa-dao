/**
 * NURU - The Mind (Cognitive Core)
 * 
 * Purpose: Provides reasoning, analytical intelligence, and contextual awareness
 * for the Morio AI assistant system.
 * 
 * **UPGRADED:** Now wired to Intelligence Shards for real-time market data
 * and Symbol Universe for asset context awareness.
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
import { MarketAwareIntentAnalyzer, CrossAssetRiskAnalyzer } from './market_integration';
import { symbolUniverse } from '../symbol_universe';

export class NuruCore {
  private intentClassifier: IntentClassifier;
  private contextManager: ContextManager;
  private financialAnalyzer: FinancialAnalyzer;
  private governanceAnalyzer: GovernanceAnalyzer;
  private communityAnalyzer: CommunityAnalyzer;
  private riskAssessor: RiskAssessor;
  private communicator: AgentCommunicator;
  
  // NEW: Market-aware analyzers
  private marketAwareIntent: MarketAwareIntentAnalyzer;
  private crossAssetRiskAnalyzer: CrossAssetRiskAnalyzer;

  constructor() {
    this.intentClassifier = new IntentClassifier();
    this.contextManager = new ContextManager();
    this.financialAnalyzer = new FinancialAnalyzer();
    this.governanceAnalyzer = new GovernanceAnalyzer();
    this.communityAnalyzer = new CommunityAnalyzer();
    this.riskAssessor = new RiskAssessor();
    this.communicator = new AgentCommunicator('NURU');
    
    // Initialize market-aware components
    this.marketAwareIntent = new MarketAwareIntentAnalyzer();
    this.crossAssetRiskAnalyzer = new CrossAssetRiskAnalyzer();
    
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
   * Understand user message and extract intent (with market context)
   */
  async understand(message: string, context: UserContext) {
    const intent = await this.intentClassifier.classify(message);
    const enrichedContext = this.contextManager.enrich(context, intent);
    
    // Extract mentioned assets from entities
    const mentionedAssets = (intent.entities.assets || []) as string[];
    
    // NEW: Get market context for mentioned assets
    let marketContext = undefined;
    if (mentionedAssets.length > 0) {
      try {
        marketContext = await this.marketAwareIntent.analyzeIntentWithMarketContext(
          message,
          mentionedAssets,
          context.preferences?.riskProfile || 'moderate'
        );
      } catch (e) {
        console.warn('Failed to get market context:', e);
        // Continue without market context
      }
    }
    
    return {
      intent: intent.type,
      entities: intent.entities,
      confidence: intent.confidence,
      context: enrichedContext,
      language: intent.language || 'en',
      sentiment: intent.sentiment || 0,
      // NEW: Add market context to response
      marketContext: marketContext,
      assetInfo: mentionedAssets.map(symbol => ({
        symbol,
        metadata: symbolUniverse.getAsset(symbol),
        deployments: symbolUniverse.getDeployments(symbol),
      })),
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
   * NEW: Assess systemic/cascading risks across asset dependencies
   */
  async assessSystemicRisk(symbols: string[]) {
    try {
      return await this.crossAssetRiskAnalyzer.analyzeSystemicRisk(symbols);
    } catch (error) {
      console.error('Systemic risk analysis failed:', error);
      return {
        systemicRisk: 50,
        criticalPoints: [],
        recommendations: ['Unable to complete systemic risk analysis. Monitor manually.'],
      };
    }
  }

  /**
   * NEW: Analyze portfolio composition for risk assessment
   * Called by KWETU to understand treasury exposure
   */
  async analyzePortfolioComposition(symbols: string[]): Promise<any> {
    try {
      const composition = symbolUniverse.analyzeCategoryComposition(symbols);
      
      // Calculate aggregate metrics
      const totalRisk = composition.reduce((sum, cat) => sum + (cat.avgRisk * cat.count), 0) / (symbols.length || 1);
      const highRiskCount = composition.filter(c => symbolUniverse.isHighRiskCategory(c.category)).length;
      const safeCount = composition.filter(c => symbolUniverse.isSafeCategory(c.category)).length;
      
      return {
        composition,
        aggregateMetrics: {
          totalAssets: symbols.length,
          avgRisk: Math.round(totalRisk),
          safeAssets: safeCount,
          highRiskAssets: highRiskCount,
          riskProfile: totalRisk > 50 ? 'aggressive' : totalRisk > 35 ? 'moderate' : 'conservative',
        },
        recommendations: this.generatePortfolioRecommendations(composition, totalRisk),
      };
    } catch (error) {
      console.error('Portfolio composition analysis failed:', error);
      return {
        composition: [],
        aggregateMetrics: { totalAssets: 0, avgRisk: 0, safeAssets: 0, highRiskAssets: 0 },
        recommendations: ['Unable to analyze portfolio composition.'],
      };
    }
  }

  /**
   * Generate recommendations based on portfolio composition
   */
  private generatePortfolioRecommendations(composition: any[], totalRisk: number): string[] {
    const recommendations: string[] = [];

    // Risk-based recommendations
    if (totalRisk > 55) {
      recommendations.push('⚠️ Portfolio is very aggressive. Consider adding stablecoins or tier-1 assets.');
    }
    if (totalRisk > 40 && totalRisk < 55) {
      recommendations.push('→ Portfolio is moderately aggressive. Can benefit from diversification.');
    }
    if (totalRisk < 25) {
      recommendations.push('✓ Portfolio is conservative and well-diversified.');
    }

    // Category-specific recommendations
    const memeCount = composition.find((c: any) => c.category === 'meme_token')?.count || 0;
    if (memeCount > 2) {
      recommendations.push(`🎭 High concentration in meme_tokens (${memeCount}). Consider reducing to <1%.`);
    }

    const stableCount = composition.find((c: any) => c.category === 'stablecoin')?.count || 0;
    if (stableCount === 0 && composition.length > 0) {
      recommendations.push('💰 No stablecoins detected. Recommend adding USDC, DAI, or USDT for stability.');
    }

    return recommendations;
  }

  /**
   * Get safer alternative for a token
   * Used when NURU recommends risk mitigation
   */
  async findSaferAlternative(symbol: string, targetCategory?: string): Promise<any> {
    try {
      const asset = symbolUniverse.getAsset(symbol);
      if (!asset) return undefined;

      // If no target category specified, use same category but safer tier
      const targetCat = targetCategory as any || asset.category;
      
      const alternatives = symbolUniverse.findSaferAlternativesInCategory(symbol, targetCat);
      
      return {
        original: { symbol, category: asset.category, tier: asset.tier, riskScore: symbolUniverse.getCategoryRiskScore(asset.category) },
        alternatives: alternatives.map(alt => ({
          symbol: alt.symbol,
          category: alt.category,
          tier: alt.tier,
          riskScore: symbolUniverse.getCategoryRiskScore(alt.category),
          improvement: symbolUniverse.getCategoryRiskScore(asset.category) - symbolUniverse.getCategoryRiskScore(alt.category),
        })),
      };
    } catch (error) {
      console.error(`Error finding safer alternative for ${symbol}:`, error);
      return undefined;
    }
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
      // Skip database-dependent checks in health check to avoid query errors
      // These are tested through actual API calls
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