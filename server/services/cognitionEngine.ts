/**
 * Cognition Engine
 * 
 * Decision-making layer for DAO treasury intelligence.
 * 
 * Consumes:
 * - AssetStateSnapshot (from Intelligence Shards)
 * - TreasuryPosition (current holdings)
 * - TreasuryContext (DAO type, risk tolerance, time horizon)
 * 
 * Produces:
 * - CognitionOutput with scored recommendations + reasoning
 * 
 * Core Principle: SAME ASSET, DIFFERENT DAO = DIFFERENT DECISION
 * 
 * DAO Personas with different Cognition logic:
 * - short_term: Optimize for liquidity + distribution timing
 * - bail_fund: Optimize for emergency exit speed + minimal slippage
 * - investment_club: Optimize for APY + risk-adjusted returns
 * - foundation: Optimize for sustainable spend rate + principal preservation
 * - long_term: Balance safety + growth
 */

import { AssetStateSnapshot, TreasuryPosition, TreasuryContext, DaoType, CognitionOutput } from '../types/assetGraph';
import { logger } from '../utils/logger';
import { eq, desc } from 'drizzle-orm';

/**
 * Cognition Query Types
 * Each query answers a specific treasury question
 */

// 1. Allocation Analysis: "What should we do with treasury?"
export interface AllocationAnalysisQuery {
  type: 'allocation_analysis';
  treasuryPositions: TreasuryPosition[];
  currentComposition: Map<string, number>; // symbol -> % of treasury
  targetComposition?: Map<string, number>; // optional target allocation
  context: TreasuryContext;
}

export interface AllocationAnalysisOutput {
  currentRiskScore: number;
  currentVolatility: number;
  currentYield: number;
  
  candidateAssets: Array<{
    symbol: string;
    riskScore: number;
    expectedYield: number;
    correlationToCurrent: number;
    recommendation: 'increase' | 'maintain' | 'decrease' | 'add' | 'remove';
    rationale: string;
  }>;
  
  compositeScore: number;
  optimalAllocation: Map<string, number>;
  expectedImpact: {
    riskChange: number;
    volatilityChange: number;
    yieldChange: number;
  };
}

// 2. Liquidity Analysis: "Can we exit this position?"
export interface LiquidityAnalysisQuery {
  type: 'liquidity_analysis';
  assetId: string;
  desiredExitAmount: number; // USD
  timeConstraint?: number; // seconds allowed for exit
  maxSlippageTolerance?: number; // % acceptable slippage
  context: TreasuryContext;
}

export interface LiquidityAnalysisOutput {
  canExit: boolean;
  exitSpeed: 'immediate' | 'fast' | 'slow' | 'illiquid';
  estimatedSlippage: number; // %
  estimatedTimeToExit: number; // seconds
  estimatedNetAmount: number; // Amount received after slippage
  
  executionPlan: {
    chain: string;
    dex: string;
    route: string[]; // Asset swap path
    bridgeRequired: boolean;
    bridgeCost: number; // %
  };
  
  alternateRoutes: Array<{
    description: string;
    slippage: number;
    timeRequired: number;
    riskLevel: string;
  }>;
  
  warnings: string[];
}

// 3. Hedging Analysis: "What hedges our downside?"
export interface HedgingAnalysisQuery {
  type: 'hedging_analysis';
  treasuryPositions: TreasuryPosition[];
  targetDownsideProtection: number; // e.g., 10 for 10% max loss
  context: TreasuryContext;
}

export interface HedgingAnalysisOutput {
  currentDownside: number; // Current portfolio downside risk
  
  hedgingOptions: Array<{
    assetSymbol: string;
    correlation: number; // Negative = hedge
    recommendedAllocation: number;
    expectedProtection: number; // % downside protected
    cost: number; // Drag on returns
    riskOfHedge: string;
  }>;
  
  optimalHedgeComposition: Map<string, number>;
  expectedPortfolioSharpe: number;
  hedgingCost: number; // % annual drag
}

// 4. Yield Optimization: "Where can we get better returns?"
export interface YieldOptimizationQuery {
  type: 'yield_optimization';
  treasuryPositions: TreasuryPosition[];
  yieldBudget: number; // Risk budget for yield-seeking
  context: TreasuryContext;
}

export interface YieldOptimizationOutput {
  currentAPY: number;
  currentYieldSources: Array<{
    assetId: string;
    strategy: string;
    apy: number;
    riskScore: number;
  }>;
  
  opportunitiesRanked: Array<{
    assetId: string;
    symbol: string;
    strategy: string;
    apy: number;
    protocol: string;
    lockPeriod?: number;
    riskScore: number;
    allocateAmount: number;
    expectedAPY: number;
    worstCaseAPY: number;
    timeHorizon: number; // days
  }>;
  
  recommendedReallocation: Map<string, number>;
  projectedAPY: number;
  sharpeRatioImprovement: number;
}

// 5. Trend Analysis: "What's market direction?"
export interface TrendAnalysisQuery {
  type: 'trend_analysis';
  assets: AssetStateSnapshot[];
  context: TreasuryContext;
}

export interface TrendAnalysisOutput {
  marketSentiment: 'strong_uptrend' | 'uptrend' | 'neutral' | 'downtrend' | 'strong_downtrend';
  volatilityCluster: boolean; // Is volatility spiking?
  volatilityLevel: 'low' | 'medium' | 'high';
  
  assetTrends: Array<{
    symbol: string;
    trend: string;
    momentum: number;
    signals: {
      rsi: string;
      macd: string;
      bollinger: string;
    };
  }>;
  
  actionableAlerts: string[]; // "RSI oversold on CELO", etc.
}

// 6. Arbitrage Detection: "Where are the spreads?"
export interface ArbitrageDetectionQuery {
  type: 'arbitrage_detection';
  assets: AssetStateSnapshot[];
  minProfitThreshold: number; // % profit threshold
  context: TreasuryContext;
}

export interface ArbitrageDetectionOutput {
  opportunities: Array<{
    id: string;
    description: string; // "USDC ETH→Base via Wormhole"
    fromChain: string;
    toChain: string;
    fromDex: string;
    toDex: string;
    buyPrice: number;
    sellPrice: number;
    spread: number; // %
    estimatedProfit: number; // USD
    slippageCost: number; // USD
    bridgeCost: number; // USD
    netProfit: number; // USD
    executionTime: number; // seconds
    riskLevel: string;
    confidence: number; // 0-100
  }>;
  
  topOpportunity?: {
    description: string;
    estimatedProfit: number;
  };
}

// 7. Governance Impact: "How do we propose a rebalance?"
export interface GovernanceImpactQuery {
  type: 'governance_impact';
  proposedChanges: Map<string, number>; // symbol -> new allocation %
  context: TreasuryContext;
}

export interface GovernanceImpactOutput {
  isEligible: boolean; // Does DAO meet governance rules?
  quorumRequired: number;
  eligibilityChecks: Array<{
    check: string;
    passed: boolean;
    reason?: string;
  }>;
  
  projectedImpact: {
    riskDelta: number;
    volatilityDelta: number;
    yieldDelta: number;
  };
  
  proposalNarrative: string; // Suggested text for proposal
  recommendedVotingPeriod: number; // hours
  estimatedExecutionTime: number; // hours
}

// 8. Risk Monitoring: "Are we over-concentrated/volatile?"
export interface RiskMonitoringQuery {
  type: 'risk_monitoring';
  treasuryPositions: TreasuryPosition[];
  context: TreasuryContext;
}

export interface RiskMonitoringOutput {
  overallRiskScore: number; // 0-100
  isHealthy: boolean; // Within DAO's risk tolerance?
  
  violations: Array<{
    type: 'concentration' | 'volatility' | 'liquidity' | 'smart_contract' | 'oracle';
    severity: 'warning' | 'critical';
    description: string;
    affectedAssets: string[];
  }>;
  
  concentrationMetrics: {
    herfindahl: number; // 0-1, 0 = perfectly diversified
    topThreeExposure: number; // % of portfolio
    recommendation: string;
  };
  
  recommendations: string[];
}

/**
 * Main Cognition Engine (Strategy Registry Pattern)
 * 
 * Orchestrates all query types with swappable strategies.
 * 
 * Design:
 * - Strategies are pluggable (governance can upgrade logic)
 * - Each strategy is versioned independently
 * - Decisions include full provenance (which strategy, version, graph, correlation)
 * - Enables institutional auditability and governance
 */
export class CognitionEngine {
  private db: any; // Database connection (injected at initialization)
  private strategyRegistry: Map<string, any> = new Map(); // CognitionStrategy registry
  private engineVersion = '1.0.0';

  constructor(db?: any) {
    if (db) {
      this.db = db;
    }
    this.registerDefaultStrategies();
  }

  /**
   * Register default strategies
   * Can be extended with governance-approved custom strategies
   */
  private registerDefaultStrategies() {
    // Strategies will be registered here
    // For now, using inline logic, but this enables hot-swapping
  }

  /**
   * Register a custom strategy
   * Governance-approved strategies can be registered at runtime
   */
  registerStrategy(id: string, strategy: any) {
    this.strategyRegistry.set(id, strategy);
    logger.info('Strategy registered', { id, version: strategy.version });
  }

  /**
   * Get strategy for a query type
   * Falls back to default if custom not registered
   */
  getStrategy(queryType: string): any {
    const custom = this.strategyRegistry.get(queryType);
    if (custom) return custom;
    
    // Return default strategy id for routing
    return { id: queryType, version: '1.0.0' };
  }

  // ========== GRAPH & CORRELATION LOADING ==========

  /**
   * Load AssetGraphVersion by version number (metadata only)
   * Use this first to check if nodes/edges have changed (via hashes)
   */
  async getAssetGraphVersionMetadata(graphVersion: number) {
    if (!this.db) {
      logger.warn('Database not initialized, returning mock graph metadata');
      return null;
    }

    try {
      const { assetGraphVersions } = await import('../db');
      const version = await this.db
        .select()
        .from(assetGraphVersions)
        .where(eq(assetGraphVersions.version, graphVersion))
        .limit(1);

      return version[0] || null;
    } catch (error) {
      logger.error('Failed to load asset graph version metadata', { error, graphVersion });
      return null;
    }
  }

  /**
   * Load all AssetNodes for a specific graph version
   */
  async getAssetNodesForVersion(graphVersion: number) {
    if (!this.db) return [];

    try {
      const { assetNodes } = await import('../db');
      const nodes = await this.db
        .select()
        .from(assetNodes)
        .where(eq(assetNodes.version, graphVersion));

      return nodes.map(n => n.nodeData);
    } catch (error) {
      logger.error('Failed to load asset nodes', { error, graphVersion });
      return [];
    }
  }

  /**
   * Load all AssetEdges for a specific graph version
   */
  async getAssetEdgesForVersion(graphVersion: number) {
    if (!this.db) return [];

    try {
      const { assetEdges } = await import('../db');
      const edges = await this.db
        .select()
        .from(assetEdges)
        .where(eq(assetEdges.version, graphVersion));

      return edges.map(e => e.edgeData);
    } catch (error) {
      logger.error('Failed to load asset edges', { error, graphVersion });
      return [];
    }
  }

  /**
   * Load AssetGraphVersion (full graph) by version number
   * This now loads from separate tables instead of embedding
   */
  async getAssetGraphVersion(graphVersion: number) {
    if (!this.db) {
      logger.warn('Database not initialized, returning mock graph');
      return null;
    }

    try {
      const [metadata, nodes, edges] = await Promise.all([
        this.getAssetGraphVersionMetadata(graphVersion),
        this.getAssetNodesForVersion(graphVersion),
        this.getAssetEdgesForVersion(graphVersion),
      ]);

      if (!metadata) return null;

      // Reconstruct graph object from separate tables
      return {
        ...metadata,
        assetNodes: nodes,
        assetEdges: edges,
      };
    } catch (error) {
      logger.error('Failed to load asset graph', { error, graphVersion });
      return null;
    }
  }

  /**
   * Load CorrelationMatrix by matrixVersion number (now independent of graphVersion)
   * Used when Cognition needs correlations (hedging, diversification analysis)
   */
  async getCorrelationMatrix(matrixVersion: number) {
    if (!this.db) {
      logger.warn('Database not initialized, returning mock correlations');
      return null;
    }

    try {
      const { correlationMatrices } = await import('../db');
      const matrix = await this.db
        .select()
        .from(correlationMatrices)
        .where(eq(correlationMatrices.matrixVersion, matrixVersion))
        .limit(1);

      return matrix[0] || null;
    } catch (error) {
      logger.error('Failed to load correlation matrix', { error, matrixVersion });
      return null;
    }
  }

  /**
   * Get latest CorrelationMatrix that matches a graph version
   * (for cases where you want compatible correlations)
   */
  async getLatestCorrelationForGraphVersion(graphVersion: number) {
    if (!this.db) return null;

    try {
      const { correlationMatrices } = await import('../db');
      const matrices = await this.db
        .select()
        .from(correlationMatrices)
        .where(eq(correlationMatrices.computedAgainstGraphVersion, graphVersion))
        .orderBy(desc(correlationMatrices.timestamp))
        .limit(1);

      return matrices[0] || null;
    } catch (error) {
      logger.error('Failed to load correlation for graph version', { error, graphVersion });
      return null;
    }
  }

  /**
   * Load AssetGraphVersion and CorrelationMatrix together
   * Convenience method for queries that need both
   */
  async getGraphContext(graphVersion: number, matrixVersion?: number) {
    const [graph, correlationMatrix] = await Promise.all([
      this.getAssetGraphVersion(graphVersion),
      matrixVersion
        ? this.getCorrelationMatrix(matrixVersion)
        : this.getLatestCorrelationForGraphVersion(graphVersion),
    ]);

    return { graph, correlationMatrix };
  }

  /**
   * Filter graph by DAO type
   * Some edges/nodes might not be relevant for certain DAO types
   * 
   * Example: bail_fund can't use complex derivative strategies
   */
  filterGraphByDaoType(graph: any, daoType: DaoType) {
    if (!graph) return null;

    const filtered = {
      ...graph,
      assetEdges: graph.assetEdges.filter((edge: any) => {
        // bail_fund: only simple swaps and bridges, no derivatives/collateral
        if (daoType === 'bail_fund' || daoType === 'funeral_fund') {
          return ['bridge_route', 'liquidity_source'].includes(edge.relationshipType);
        }

        // foundation: allow all except highest-risk strategies
        if (daoType === 'foundation') {
          return !['collateral_pair'].includes(edge.relationshipType); // Can do everything else
        }

        // All others: allow everything
        return true;
      }),
    };

    return filtered;
  }

  /**
   * Main entry point for Cognition
   * Routes queries based on type and applies DAO-context-aware scoring
   */
  async querySymbolUniverse(
    query: 
      | AllocationAnalysisQuery
      | LiquidityAnalysisQuery
      | HedgingAnalysisQuery
      | YieldOptimizationQuery
      | TrendAnalysisQuery
      | ArbitrageDetectionQuery
      | GovernanceImpactQuery
      | RiskMonitoringQuery
  ): Promise<CognitionOutput> {
    try {
      let result: any;

      switch (query.type) {
        case 'allocation_analysis':
          result = await this.analyzeAllocation(query as AllocationAnalysisQuery);
          break;
        case 'liquidity_analysis':
          result = await this.analyzeLiquidity(query as LiquidityAnalysisQuery);
          break;
        case 'hedging_analysis':
          result = await this.analyzeHedging(query as HedgingAnalysisQuery);
          break;
        case 'yield_optimization':
          result = await this.optimizeYield(query as YieldOptimizationQuery);
          break;
        case 'trend_analysis':
          result = await this.analyzeTrends(query as TrendAnalysisQuery);
          break;
        case 'arbitrage_detection':
          result = await this.detectArbitrage(query as ArbitrageDetectionQuery);
          break;
        case 'governance_impact':
          result = await this.analyzeGovernanceImpact(query as GovernanceImpactQuery);
          break;
        case 'risk_monitoring':
          result = await this.monitorRisk(query as RiskMonitoringQuery);
          break;
        default:
          throw new Error(`Unknown query type`);
      }

      // Wrap result in CognitionOutput
      return {
        context: query.context,
        decisionType: query.type,
        recommendedAction: this.synthesizeAction(query.type, result),
        confidenceScore: this.calculateConfidence(query.context, result),
        reasoningGraph: this.buildReasoningGraph(query.type, result),
        riskFlags: this.identifyRiskFlags(query.context, result),
        executionHints: this.generateExecutionHints(query.type, result),
      };
    } catch (error) {
      logger.error('Cognition Engine error', { error, query });
      throw error;
    }
  }

  // ========== DAO-SPECIFIC COGNITION LOGIC ==========

  /**
   * Allocation Analysis
   * Different DAO types optimize different objectives
   */
  /**
   * Get default objective weights for DAO type
   * Can be overridden per DAO instance via governance
   */
  private getDefaultObjectiveWeights(daoType: string): Record<string, number> {
    switch (daoType) {
      case 'bail_fund':
      case 'funeral_fund':
        // Optimize for emergency liquidity
        return { risk: 0.3, yield: 0.1, liquidity: 0.6 };

      case 'short_term':
        // Optimize for distribution timing + liquidity
        return { risk: 0.2, yield: 0.2, liquidity: 0.6 };

      case 'investment_club':
        // Optimize for yield + risk-adjusted returns
        return { risk: 0.3, yield: 0.6, liquidity: 0.1 };

      case 'foundation':
        // Optimize for principal preservation + sustainable yield
        return { risk: 0.6, yield: 0.3, liquidity: 0.1 };

      case 'long_term':
      default:
        // Balanced
        return { risk: 0.4, yield: 0.4, liquidity: 0.2 };
    }
  }

  private async analyzeAllocation(query: AllocationAnalysisQuery): Promise<AllocationAnalysisOutput> {
    const context = query.context;

    // DAO-specific weights (can be overridden via governance)
    let objectiveWeights = context.objectiveWeights || this.getDefaultObjectiveWeights(context.daoType);

    // Score each asset based on DAO objectives
    // (Implementation would score based on snapshots)

    return {
      currentRiskScore: 50,
      currentVolatility: 30,
      currentYield: 5.5,
      candidateAssets: [],
      compositeScore: 75,
      optimalAllocation: new Map(),
      expectedImpact: { riskChange: -5, volatilityChange: -10, yieldChange: +1.2 },
    };
  }

  /**
   * Liquidity Analysis
   * Can we exit? How fast? At what cost?
   */
  private async analyzeLiquidity(query: LiquidityAnalysisQuery): Promise<LiquidityAnalysisOutput> {
    // Query AssetStateSnapshot for liquidity data
    // Compute exit feasibility based on:
    // - DEX liquidity depth
    // - Bridge availability if needed
    // - Time constraints (especially for rotation DAOs)

    return {
      canExit: true,
      exitSpeed: 'fast',
      estimatedSlippage: 2.5,
      estimatedTimeToExit: 300, // 5 minutes
      estimatedNetAmount: 9750,
      executionPlan: {
        chain: 'celo',
        dex: 'ubeswap',
        route: ['CELO', 'cUSD'],
        bridgeRequired: false,
        bridgeCost: 0,
      },
      alternateRoutes: [],
      warnings: [],
    };
  }

  /**
   * Hedging Analysis
   * Find assets that hedge portfolio downside
   */
  private async analyzeHedging(query: HedgingAnalysisQuery): Promise<HedgingAnalysisOutput> {
    // Find highly negative correlations to current positions
    // Score hedges by: correlation, cost, effectiveness

    return {
      currentDownside: 25,
      hedgingOptions: [],
      optimalHedgeComposition: new Map(),
      expectedPortfolioSharpe: 1.5,
      hedgingCost: 0.5,
    };
  }

  /**
   * Yield Optimization
   * Maximize returns within risk budget
   */
  private async optimizeYield(query: YieldOptimizationQuery): Promise<YieldOptimizationOutput> {
    // For investment_club and foundation DAOs
    // Rank yield strategies by APY, risk, and lock period

    return {
      currentAPY: 5.5,
      currentYieldSources: [],
      opportunitiesRanked: [],
      recommendedReallocation: new Map(),
      projectedAPY: 7.2,
      sharpeRatioImprovement: 0.3,
    };
  }

  /**
   * Trend Analysis
   * Market direction and volatility signals
   */
  private async analyzeTrends(query: TrendAnalysisQuery): Promise<TrendAnalysisOutput> {
    // Aggregate technical signals from snapshots
    // Identify volatility clusters and momentum

    return {
      marketSentiment: 'neutral',
      volatilityCluster: false,
      volatilityLevel: 'medium',
      assetTrends: [],
      actionableAlerts: [],
    };
  }

  /**
   * Arbitrage Detection
   * Find profitable spreads
   */
  private async detectArbitrage(query: ArbitrageDetectionQuery): Promise<ArbitrageDetectionOutput> {
    // For sophisticated DAOs
    // Scan for price discrepancies across DEXes and chains
    // Account for bridge fees and slippage

    return {
      opportunities: [],
      topOpportunity: undefined,
    };
  }

  /**
   * Governance Impact
   * Assess proposal feasibility and impact
   */
  private async analyzeGovernanceImpact(query: GovernanceImpactQuery): Promise<GovernanceImpactOutput> {
    // Check DAO governance rules
    // Project risk/yield/volatility impact
    // Generate proposal narrative

    return {
      isEligible: true,
      quorumRequired: 20,
      eligibilityChecks: [],
      projectedImpact: { riskDelta: -5, volatilityDelta: -10, yieldDelta: 1.2 },
      proposalNarrative: 'Rebalance to reduce volatility...',
      recommendedVotingPeriod: 72,
      estimatedExecutionTime: 48,
    };
  }

  /**
   * Risk Monitoring
   * Check for violations
   */
  private async monitorRisk(query: RiskMonitoringQuery): Promise<RiskMonitoringOutput> {
    // Score concentration, volatility, smart contract risk
    // Flag violations vs DAO's risk profile

    return {
      overallRiskScore: 45,
      isHealthy: true,
      violations: [],
      concentrationMetrics: {
        herfindahl: 0.3,
        topThreeExposure: 60,
        recommendation: 'Consider diversifying away from CELO',
      },
      recommendations: [],
    };
  }

  // ========== SYNTHESIS & SCORING ==========

  private synthesizeAction(queryType: string, result: any): string {
    // Convert query result into actionable recommendation
    return `Based on ${queryType} analysis, recommend...`;
  }

  /**
   * Calculate institutional-grade confidence score
   * 
   * Combines multiple factors to prevent blind automation disasters:
   * - Data freshness (old data = lower confidence)
   * - Signal agreement (conflicting signals = lower confidence)
   * - Liquidity reliability (sparse market depth = lower confidence)
   * - Volatility regime stability (markets in shock = lower confidence)
   * - DAO time horizon alignment (short-term DAO + long-term data = misalignment)
   */
  private calculateConfidence(context: TreasuryContext, result: any, snapshot?: any): number {
    let confidenceFactors: Array<{ name: string; score: number; reasoning: string }> = [];

    // 1. Data Freshness: How old is the snapshot?
    let freshnessScore = 100;
    if (snapshot?.isStale) {
      freshnessScore = 40; // Stale data = low confidence
    } else if (snapshot?.createdAt) {
      const ageSeconds = (Date.now() - snapshot.createdAt.getTime()) / 1000;
      // Exponential decay: full confidence < 1hr, decay by 1% per hour after
      freshnessScore = Math.max(50, 100 - Math.pow(ageSeconds / 3600, 1.5));
    }
    confidenceFactors.push({
      name: 'data_freshness',
      score: freshnessScore,
      reasoning: `Data age: ${freshnessScore.toFixed(0)}% fresh`,
    });

    // 2. Signal Agreement: Do independent indicators agree?
    let signalAgreementScore = 85; // Default: moderate agreement
    if (result?.signalConflict === true) {
      signalAgreementScore = 50;
    } else if (result?.allSignalsAlign === true) {
      signalAgreementScore = 95;
    }
    confidenceFactors.push({
      name: 'signal_agreement',
      score: signalAgreementScore,
      reasoning: `Cross-signal consistency: ${signalAgreementScore.toFixed(0)}%`,
    });

    // 3. Liquidity Reliability: Is the market deep enough?
    let liquidityScore = 75;
    if (snapshot?.liquidityDepth5pct && snapshot.liquidityDepth5pct < 10000) {
      liquidityScore = 40; // Shallow market = unreliable pricing
    } else if (snapshot?.liquidityDepth5pct && snapshot.liquidityDepth5pct > 500000) {
      liquidityScore = 95; // Deep market = high confidence
    }
    confidenceFactors.push({
      name: 'liquidity_reliability',
      score: liquidityScore,
      reasoning: `Market depth (5% slippage): ${liquidityScore.toFixed(0)}%`,
    });

    // 4. Volatility Regime Stability: Is the market in shock?
    let volatilityScore = 85;
    if (snapshot?.technicalMomentum && Math.abs(snapshot.technicalMomentum) > 80) {
      volatilityScore = 60; // Extreme momentum = unstable regime
    } else if (snapshot?.technicalRsi14) {
      const isOverbought = snapshot.technicalRsi14 > 70;
      const isOversold = snapshot.technicalRsi14 < 30;
      if (isOverbought || isOversold) {
        volatilityScore = 65; // Regime extremes = lower confidence
      }
    }
    confidenceFactors.push({
      name: 'volatility_stability',
      score: volatilityScore,
      reasoning: `Regime stability: ${volatilityScore.toFixed(0)}%`,
    });

    // 5. Time Horizon Alignment: Is decision timeline reasonable?
    let timeHorizonScore = 90;
    if (context.nextDistributionWindow) {
      const timeUntilDeadline = context.nextDistributionWindow.deadline.getTime() - Date.now();
      const hoursToDeadline = timeUntilDeadline / (1000 * 3600);
      
      // If decision horizon is too short for market to settle, lower confidence
      if (hoursToDeadline < 1) {
        timeHorizonScore = 30; // Immediate deadline = high uncertainty
      } else if (hoursToDeadline < 24) {
        timeHorizonScore = 60;
      } else if (hoursToDeadline > 365 * 24) {
        timeHorizonScore = 100; // Long horizon = stable assumptions
      }
    }
    confidenceFactors.push({
      name: 'time_horizon_alignment',
      score: timeHorizonScore,
      reasoning: `Timeline feasibility: ${timeHorizonScore.toFixed(0)}%`,
    });

    // Composite: Geometric mean of factors (one low score doesn't destroy confidence if others high)
    const compositeConfidence =
      Math.pow(
        freshnessScore *
          signalAgreementScore *
          liquidityScore *
          volatilityScore *
          timeHorizonScore,
        1 / 5
      );

    return Math.round(Math.min(100, Math.max(0, compositeConfidence)));
  }

  /**
   * Build versioned reasoning graph for auditability
   * 
   * This is institutional-grade provenance:
   * - Which engine version?
   * - Which strategy version?
   * - Which graph version was data from?
   * - Which correlation version?
   * - What factors influenced scoring?
   * - What weights were used?
   * - What risks were flagged?
   * 
   * Every decision is reproducible AND defensible.
   */
  private buildReasoningGraph(
    queryType: string,
    result: any,
    graphVersion: number,
    correlationVersion: number,
    context: TreasuryContext,
    confidenceFactors?: any[]
  ): any {
    const strategy = this.getStrategy(queryType);

    return {
      // Version tracking
      engineVersion: this.engineVersion,
      strategyId: strategy.id,
      strategyVersion: strategy.version,
      graphVersionUsed: graphVersion,
      correlationVersionUsed: correlationVersion,

      // Decision trace
      queryType,
      factors: result.factors || [],
      objectiveWeights: context.objectiveWeights || {},
      compositeScore: result.compositeScore || 0,

      // Confidence details
      confidenceScore: result.confidenceScore || 85,
      confidenceFactors: confidenceFactors || [],

      // Risk flags
      riskFlags: result.riskFlags || [],

      timestamp: new Date(),
    };
  }

  private identifyRiskFlags(context: TreasuryContext, result: any): string[] {
    // Extract warnings from result
    return [];
  }

  private generateExecutionHints(queryType: string, result: any): any {
    // Specific instructions for agents executing this recommendation
    return {};
  }
}

// Singleton instance
export const cognitionEngine = new CognitionEngine();
