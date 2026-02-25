/**
 * NURU Market Integration
 * 
 * Enhances NURU cognitive core with real-time market data from intelligence shards.
 * Enables market-aware intent classification, risk scoring, and contextual analysis.
 */

import { shardOrchestrator } from '../../services/intelligenceShards';
import { assetIntelligence } from '../../services/assetIntelligence';
import type { AssetStateSnapshot } from '../../types/assetGraph';

export interface MarketContext {
  symbol: string;
  priceUsd: number;
  priceConfidence: number;
  volatility: number;
  liquidityDepth5pct: number;
  riskScore: number;
  governanceScore: number;
  tier: string;
  isVolatile: boolean;
  isIlliquid: boolean;
  isHighRisk: boolean;
  lastUpdated: Date;
}

export interface IntentMarketContext {
  affectedAssets: MarketContext[];
  marketCondition: 'calm' | 'volatile' | 'crisis';
  riskAversion: number; // 0-100, based on aggregate risk
  urgency: number; // How urgent is this action given market conditions
  recommendations: string[];
}

/**
 * Market-Aware Intent Analyzer
 * 
 * Enhances intent classification with real-time market data
 * Example: "Sell XYZ" intent changes based on:
 * - Current price volatility
 * - Liquidity available
 * - Risk score
 * - Governance tier
 */
export class MarketAwareIntentAnalyzer {
  private marketContextCache: Map<string, { context: MarketContext; timestamp: number }> = new Map();
  private cacheExpiryMs = 60_000; // 1 minute

  /**
   * Analyze user intent with market context
   */
  async analyzeIntentWithMarketContext(
    intent: string,
    symbols: string[],
    daoRiskProfile?: 'conservative' | 'moderate' | 'aggressive'
  ): Promise<IntentMarketContext> {
    // Get market context for all affected assets
    const affectedAssets = await this.fetchMarketContexts(symbols);
    
    // Determine overall market condition
    const marketCondition = this.assessMarketCondition(affectedAssets);
    
    // Calculate risk aversion based on DAO profile + market conditions
    const riskAversion = this.calculateRiskAversion(daoRiskProfile, affectedAssets);
    
    // Calculate urgency based on intent + market volatility
    const urgency = this.calculateUrgency(intent, affectedAssets);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      intent,
      affectedAssets,
      marketCondition,
      riskAversion
    );

    return {
      affectedAssets,
      marketCondition,
      riskAversion,
      urgency,
      recommendations,
    };
  }

  /**
   * Fetch real market contexts from intelligence shards
   */
  private async fetchMarketContexts(symbols: string[]): Promise<MarketContext[]> {
    const contexts: MarketContext[] = [];

    for (const symbol of symbols) {
      try {
        // Check cache first
        const cached = this.getFromCache(symbol);
        if (cached) {
          contexts.push(cached);
          continue;
        }

        // Get fresh snapshot from shard orchestrator
        const snapshot = await assetGraphService.getSnapshot(symbol);
        if (snapshot) {
          const context = this.snapshotToMarketContext(symbol, snapshot);
          this.setCache(symbol, context);
          contexts.push(context);
        }
      } catch (error) {
        console.warn(`Failed to fetch market context for ${symbol}:`, error);
        // Continue with other assets
      }
    }

    return contexts;
  }

  /**
   * Convert intelligence shard snapshot to market context
   */
  private snapshotToMarketContext(symbol: string, snapshot: AssetStateSnapshot): MarketContext {
    const core = snapshot.coreState;
    
    return {
      symbol,
      priceUsd: core.priceUsd || 0,
      priceConfidence: core.priceConfidence || 0,
      volatility: this.calculateVolatility(snapshot),
      liquidityDepth5pct: core.liquidityDepth5pct || 0,
      riskScore: core.riskOverallScore || 50,
      governanceScore: core.riskGovernanceScore || 50,
      tier: core.governanceDaoEligibilityTier || 'tier_4',
      isVolatile: (this.calculateVolatility(snapshot) || 0) > 15,
      isIlliquid: (core.liquidityDepth5pct || 0) < 1_000_000,
      isHighRisk: (core.riskOverallScore || 0) > 60,
      lastUpdated: new Date(),
    };
  }

  /**
   * Calculate volatility from price history
   */
  private calculateVolatility(snapshot: AssetStateSnapshot): number {
    // Use technical shard's momentum or RSI as proxy for volatility
    // If available, calculate from historical prices
    // For now: estimate from price confidence (inverse relationship)
    const confidence = snapshot.coreState.priceConfidence || 85;
    return Math.max(0, 100 - confidence * 1.5); // Higher confidence = lower volatility
  }

  /**
   * Assess overall market condition
   */
  private assessMarketCondition(
    assets: MarketContext[]
  ): 'calm' | 'volatile' | 'crisis' {
    if (assets.length === 0) return 'calm';

    const avgVolatility = assets.reduce((sum, a) => sum + a.volatility, 0) / assets.length;
    const avgRisk = assets.reduce((sum, a) => sum + a.riskScore, 0) / assets.length;
    const illiquidCount = assets.filter(a => a.isIlliquid).length;

    // Crisis: High risk (>70) OR >40% assets illiquid OR very high volatility (>30)
    if (avgRisk > 70 || illiquidCount / assets.length > 0.4 || avgVolatility > 30) {
      return 'crisis';
    }

    // Volatile: Moderate-high risk/volatility OR some illiquid assets
    if (avgRisk > 50 || illiquidCount / assets.length > 0.2 || avgVolatility > 15) {
      return 'volatile';
    }

    return 'calm';
  }

  /**
   * Calculate risk aversion score (0-100)
   */
  private calculateRiskAversion(
    daoProfile?: 'conservative' | 'moderate' | 'aggressive',
    assets?: MarketContext[]
  ): number {
    // Base risk aversion by DAO profile
    let base = 50; // Moderate default
    if (daoProfile === 'conservative') base = 70;
    if (daoProfile === 'aggressive') base = 30;

    // Adjust based on market conditions
    if (assets && assets.length > 0) {
      const avgRisk = assets.reduce((sum, a) => sum + a.riskScore, 0) / assets.length;
      const adjustment = (avgRisk - 50) * 0.5; // Market risk adds to aversion
      base = Math.max(0, Math.min(100, base + adjustment));
    }

    return base;
  }

  /**
   * Calculate urgency (0-100)
   * Higher urgency = execute immediately, lower = can wait
   */
  private calculateUrgency(intent: string, assets: MarketContext[]): number {
    let urgency = 50; // Neutral default

    // High urgency triggers
    if (intent.includes('emergency') || intent.includes('critical')) urgency = 80;
    if (intent.includes('risk') && assets.some(a => a.isHighRisk)) urgency = 70;
    if (intent.includes('withdraw') && assets.some(a => a.isVolatile)) urgency = 60;

    // Low urgency triggers
    if (intent.includes('maintain') || intent.includes('steady')) urgency = 30;
    if (intent.includes('analyze') || intent.includes('report')) urgency = 25;

    // Boost urgency if any asset is in crisis
    if (assets.some(a => a.isHighRisk && a.isIlliquid)) urgency = Math.min(100, urgency + 20);

    return urgency;
  }

  /**
   * Generate contextual recommendations
   */
  private generateRecommendations(
    intent: string,
    assets: MarketContext[],
    marketCondition: 'calm' | 'volatile' | 'crisis',
    riskAversion: number
  ): string[] {
    const recommendations: string[] = [];

    if (marketCondition === 'crisis') {
      recommendations.push('⚠️ Market in crisis mode. Consider defensive actions.');
      recommendations.push('✓ Prioritize liquidity and risk reduction');
    }

    if (marketCondition === 'volatile') {
      recommendations.push('📊 High market volatility detected. Adjust position sizes.');
    }

    // Asset-specific recommendations
    for (const asset of assets) {
      if (asset.isHighRisk) {
        recommendations.push(`🔴 ${asset.symbol} has elevated risk (${asset.riskScore}/100). Consider hedging.`);
      }
      if (asset.isIlliquid) {
        recommendations.push(`💧 ${asset.symbol} has low liquidity. Exit orders may take time.`);
      }
      if (asset.isVolatile) {
        recommendations.push(`📈 ${asset.symbol} is volatile. Consider limit orders instead of market.`);
      }
    }

    // Risk-aversion-based recommendations
    if (riskAversion > 70 && intent.includes('invest')) {
      recommendations.push('💡 Your DAO has high risk aversion. Consider stablecoins or tier-1 assets.');
    }

    return recommendations;
  }

  /**
   * Cache management
   */
  private getFromCache(symbol: string): MarketContext | null {
    const cached = this.marketContextCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      return cached.context;
    }
    this.marketContextCache.delete(symbol);
    return null;
  }

  private setCache(symbol: string, context: MarketContext): void {
    this.marketContextCache.set(symbol, { context, timestamp: Date.now() });
  }

  /**
   * Clear expired cache entries
   */
  clearStaleCache(): void {
    const now = Date.now();
    for (const [symbol, cached] of this.marketContextCache.entries()) {
      if (now - cached.timestamp > this.cacheExpiryMs) {
        this.marketContextCache.delete(symbol);
      }
    }
  }
}

/**
 * Cross-Asset Risk Analyzer
 * 
 * Analyzes systemic risk across multiple assets
 * Example: If Chainlink fails, all LINK-dependent assets have elevated risk
 */
export class CrossAssetRiskAnalyzer {
  /**
   * Analyze cascading risks across asset dependencies
   */
  async analyzeSystemicRisk(symbols: string[]): Promise<{
    systemicRisk: number;
    criticalPoints: Array<{ asset: string; severity: number; impact: string[] }>;
    recommendations: string[];
  }> {
    const snapshots = await this.fetchSnapshots(symbols);
    
    const criticalPoints: Array<{ asset: string; severity: number; impact: string[] }> = [];
    let maxRisk = 0;

    for (const [symbol, snapshot] of snapshots.entries()) {
      // Check dependency chains for critical failures
      const deps = snapshot.coreState.relationshipDiscovery?.dependencyChain || [];
      
      // Oracle failures are critical
      if (deps.some(d => d.includes('Chainlink'))) {
        criticalPoints.push({
          asset: symbol,
          severity: 85,
          impact: ['Price feed degradation', 'Liquidation risk', 'Collateral valuation fail'],
        });
        maxRisk = Math.max(maxRisk, 85);
      }

      // Multi-chain dependencies
      if (deps.some(d => d.includes('bridge') || d.includes('wrapped'))) {
        criticalPoints.push({
          asset: symbol,
          severity: 70,
          impact: ['Bridge exploit risk', 'Cross-chain timeout', 'Liquidity fragmentation'],
        });
        maxRisk = Math.max(maxRisk, 70);
      }
    }

    const systemicRisk = Math.min(100, maxRisk);
    const recommendations = this.generateSystemicRecommendations(systemicRisk, criticalPoints);

    return { systemicRisk, criticalPoints, recommendations };
  }

  private async fetchSnapshots(symbols: string[]): Promise<Map<string, AssetStateSnapshot>> {
    const snapshots = new Map<string, AssetStateSnapshot>();
    for (const symbol of symbols) {
      try {
        const snapshot = await assetGraphService.getSnapshot(symbol);
        if (snapshot) snapshots.set(symbol, snapshot);
      } catch (e) {
        console.warn(`Failed to fetch snapshot for ${symbol}`);
      }
    }
    return snapshots;
  }

  private generateSystemicRecommendations(
    systemicRisk: number,
    criticalPoints: Array<{ asset: string; severity: number; impact: string[] }>
  ): string[] {
    const recommendations: string[] = [];

    if (systemicRisk > 80) {
      recommendations.push('🚨 CRITICAL: Systemic risk detected. Implement emergency procedures.');
      recommendations.push('✓ Reduce exposure to critical dependencies');
    } else if (systemicRisk > 60) {
      recommendations.push('⚠️ Elevated systemic risk. Monitor closely.');
    }

    for (const point of criticalPoints) {
      if (point.severity > 80) {
        recommendations.push(`🔴 ${point.asset}: ${point.impact.join(', ')}`);
      }
    }

    return recommendations;
  }
}
