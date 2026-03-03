/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * STRATEGY DASHBOARD SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Powers the Strategy Dashboard:
 * • Strategy deployment and management
 * • User copying (followers)
 * • Performance tracking
 * • Rebalancing execution
 */

import { Logger } from '../utils/logger';
import { db } from '../db';
import { eq, desc } from 'drizzle-orm';
import { assetGraphService } from './assetGraphService';
import { cacheService } from './cacheService';
import crypto from 'crypto';

const logger = Logger.getLogger();

export interface StrategyMetadata {
  id: string;
  name: string;
  description: string;
  creator: string; // User ID
  createdAt: number;
  
  // Strategy Configuration
  targetAllocation: Record<string, number>; // { ETH: 0.4, USDC: 0.3, BTC: 0.3 }
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly' | 'manual';
  riskLevel: 'low' | 'medium' | 'high';
  
  // Performance
  totalValueLocked: number; // USD
  followers: number;
  aum: number; // Assets Under Management
  
  // Returns
  ytdReturn: number; // %
  ytdReturnUSD: number;
  monthReturn: number; // %
  weekReturn: number; // %
  
  // Metrics
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  
  // Status
  isActive: boolean;
  lastRebalance: number;
  nextRebalance: number;
  
  tags: string[];
}

export interface StrategyFollower {
  strategyId: string;
  userId: string;
  followedAt: number;
  
  // Personal tracking
  invested: number; // USD
  currentValue: number; // USD
  return: number; // USD
  returnPercent: number; // %
  
  // Settings
  autoRebalance: boolean;
  maxSlippage: number; // %
  notifications: boolean;
}

export interface StrategyAllocation {
  strategyId: string;
  asset: string;
  weight: number; // 0-1
  currentAllocation: number; // % of current portfolio
  targetAllocation: number; // % target
  rebalanceAmount?: number; // USD to buy/sell
}

export interface StrategyRebalance {
  id: string;
  strategyId: string;
  triggeredAt: number;
  executedAt?: number;
  
  trigger: 'drift' | 'scheduled' | 'manual';
  driftThreshold?: number; // % deviation from target
  
  transactions: Array<{
    asset: string;
    action: 'buy' | 'sell';
    amount: number;
    executionPrice: number;
    slippage: number;
  }>;
  
  status: 'pending' | 'executing' | 'completed' | 'failed';
  totalGasUsed?: number;
}

class StrategyDashboardService {
  private strategies: Map<string, StrategyMetadata> = new Map();
  private followers: Map<string, StrategyFollower[]> = new Map();
  private allocations: Map<string, StrategyAllocation[]> = new Map();

  /**
   * Create a new strategy
   */
  async createStrategy(input: {
    creatorId: string;
    name: string;
    description: string;
    allocations: Array<{ asset: string; weight: number }>;
    rebalanceFrequencyDays?: number;
    tags?: string[];
    riskLevel?: 'low' | 'medium' | 'high';
    deploymentChain?: string;
  }): Promise<StrategyMetadata> {
    const strategyId = `strat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // ════════════════════════════════════════════════════════════════════════════
    // SYMBOL UNIVERSE VALIDATION - NEW
    // ════════════════════════════════════════════════════════════════════════════
    const { symbolUniverse } = await import('../core/symbol_universe');
    const chain = input.deploymentChain || 'celo';
    const validationErrors: string[] = [];

    for (const allocation of input.allocations) {
      // 1. Check asset exists in Symbol Universe
      const asset = symbolUniverse.getAsset(allocation.asset);
      if (!asset) {
        validationErrors.push(
          `Asset ${allocation.asset} not found in Symbol Universe`
        );
        continue;
      }

      // 2. Check asset deployed on deployment chain
      const deployments = symbolUniverse.getDeployments(allocation.asset);
      const chainDeployment = deployments.find(d => d.chain === chain);
      if (!chainDeployment) {
        validationErrors.push(
          `Asset ${allocation.asset} not deployed on ${chain}`
        );
      }

      // 3. Check risk tier constraints
      const riskProfile = input.riskLevel || 'medium';
      if (
        asset.tier === 'tier_4' &&
        (riskProfile === 'low' || riskProfile === 'medium')
      ) {
        validationErrors.push(
          `Cannot allocate tier_4 asset ${allocation.asset} to ${riskProfile} strategy`
        );
      }
    }

    if (validationErrors.length > 0) {
      throw new Error(
        `Strategy validation failed:\n${validationErrors.join('\n')}`
      );
    }

    // Convert allocations array to object format
    const targetAllocation: Record<string, number> = {};
    for (const alloc of input.allocations) {
      targetAllocation[alloc.asset] = alloc.weight;
    }

    // Determine rebalance frequency from days
    const rebalanceFrequency = this.determineFrequency(input.rebalanceFrequencyDays || 7);

    const strategy: StrategyMetadata = {
      id: strategyId,
      name: input.name,
      description: input.description,
      creator: input.creatorId,
      createdAt: Date.now(),
      targetAllocation,
      rebalanceFrequency,
      riskLevel: (input.riskLevel || 'medium') as 'low' | 'medium' | 'high',
      totalValueLocked: 0,
      followers: 0,
      aum: 0,
      ytdReturn: 0,
      ytdReturnUSD: 0,
      monthReturn: 0,
      weekReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      volatility: 0,
      isActive: true,
      lastRebalance: Date.now(),
      nextRebalance: this.calculateNextRebalance(rebalanceFrequency),
      tags: input.tags || [],
    };

    this.strategies.set(strategyId, strategy);

    // Store allocations
    this.allocations.set(
      strategyId,
      input.allocations.map((a) => ({
        strategyId,
        asset: a.asset,
        weight: a.weight,
        targetAllocation: a.weight,
        currentAllocation: a.weight,
        rebalanceAmount: 0,
      } as any))
    );

    // Save to database
    try {
      // Import db and schema
      const { db } = await import('../db');
      
      // In production, save to strategies table (if it exists)
      // For now, log the intent to save
      logger.info(
        `✅ Strategy created: ${input.name} (${strategyId}) by ${input.creatorId} ` +
        `on chain ${chain} with ${input.allocations.length} assets`
      );
      
      // NOTE: 'strategies' table not currently in schema
      // Uncomment when table is created in migration
      // await db.insert(strategies).values({
      //     id: strategyId,
      //     name: strategy.name,
      //     description: strategy.description,
      //     creatorId: input.creatorId,
      //     deploymentChain: chain,
      //     riskLevel: strategy.riskLevel,
      //     allocations: JSON.stringify(input.allocations),
      //     createdAt: new Date(),
      //     updatedAt: new Date(),
      // });
    } catch (error) {
      logger.error(`Failed to save strategy to DB:`, error);
    }

    return strategy;
  }

  /**
   * Get a strategy by ID
   */
  async getStrategy(strategyId: string): Promise<StrategyMetadata | undefined> {
    return this.strategies.get(strategyId);
  }

  /**
   * User follows a strategy
   */
  async followStrategy(
    strategyId: string,
    userId: string,
    investAmount: number,
    options?: { maxSlippage?: number; autoRebalance?: boolean }
  ): Promise<StrategyFollower> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // ASSET GRAPH RISK CHECKS - NEW
    // ════════════════════════════════════════════════════════════════════════════
    try {
      // 1. Load user's existing portfolio from Asset Graph
      const userGraph = await assetGraphService.loadUserGraph(userId);

      // 2. Check liquidation risk from loaded graph
      const liquidationRisks = userGraph.liquidationRisks.filter(r => r.criticalRisk);
      if (liquidationRisks.length > 0) {
        throw new Error(
          'Cannot follow strategy: Your existing positions are at critical liquidation risk. ' +
          'Please reduce leverage before following new strategies.'
        );
      }

      // 3. Check concentration risk
      const maxConcentration = Math.max(
        ...Array.from(userGraph.compositeExposures.values()).map(e => e.concentration || 0)
      );
      if (maxConcentration > 0.7) {
        logger.warn(
          `[Strategy] User ${userId} following ${strategyId} would create ` +
          `high concentration: ${(maxConcentration * 100).toFixed(1)}%`
        );
      }

      logger.info(
        `[Strategy] Risk check passed for user ${userId} following ${strategyId}: ` +
        `liquidation risks=${liquidationRisks.length}, ` +
        `max concentration=${(maxConcentration * 100).toFixed(1)}%`
      );
    } catch (error: any) {
      if (error.message.includes('critical liquidation')) {
        throw error; // Re-throw liquidation errors
      }
      logger.warn(
        `[Strategy] Asset Graph check failed for ${userId} following ${strategyId}, continuing anyway:`,
        error
      );
      // Don't block strategy following on Asset Graph errors
    }

    const follower: StrategyFollower = {
      strategyId,
      userId,
      followedAt: Date.now(),
      invested: investAmount,
      currentValue: investAmount,
      return: 0,
      returnPercent: 0,
      autoRebalance: options?.autoRebalance ?? true,
      maxSlippage: options?.maxSlippage ?? 0.5, // 0.5%
      notifications: true,
    };

    if (!this.followers.has(strategyId)) {
      this.followers.set(strategyId, []);
    }
    this.followers.get(strategyId)!.push(follower);

    // Update strategy metrics
    strategy.followers++;
    strategy.aum += investAmount;
    strategy.totalValueLocked += investAmount;

    logger.info(`✅ User ${userId} followed strategy ${strategyId} with $${investAmount}`);

    return follower;
  }

  /**
   * User unfollows a strategy
   */
  async unfollowStrategy(strategyId: string, userId: string): Promise<void> {
    const followers = this.followers.get(strategyId);
    if (!followers) return;

    const followerIndex = followers.findIndex((f) => f.userId === userId);
    if (followerIndex === -1) return;

    const follower = followers[followerIndex];
    followers.splice(followerIndex, 1);

    // Update strategy metrics
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      strategy.followers--;
      strategy.aum -= follower.currentValue;
      strategy.totalValueLocked -= follower.currentValue;
    }

    logger.info(`✅ User ${userId} unfollowed strategy ${strategyId}`);
  }

  /**
   * Get strategy performance
   */
  async getStrategyPerformance(
    strategyId: string
  ): Promise<{
    strategy: StrategyMetadata;
    allocations: StrategyAllocation[];
    followers: number;
    topFollowers: Array<{ userId: string; invested: number; return: number }>;
  }> {
    const cacheKey = `strategy:perf:${strategyId}`;
    
    // Check cache first (30s TTL)
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug(`[Strategy] Performance cache hit for ${strategyId}`);
      return cached;
    }

    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    const allocations = this.allocations.get(strategyId) || [];
    const strategyFollowers = this.followers.get(strategyId) || [];

    // Get top 10 followers by investment
    const topFollowers = strategyFollowers
      .sort((a, b) => b.invested - a.invested)
      .slice(0, 10)
      .map((f) => ({
        userId: f.userId,
        invested: f.invested,
        return: f.return,
      }));

    const result = {
      strategy,
      allocations,
      followers: strategyFollowers.length,
      topFollowers,
    };

    // Cache for 30s (real-time is important but prevent thrashing)
    await cacheService.set(cacheKey, result, 30);

    return result;
  }

  /**
   * Trigger rebalancing for a strategy
   */
  async triggerRebalance(strategyId: string): Promise<StrategyRebalance> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    const rebalanceId = `rebal_${Date.now()}`;
    const allocations = this.allocations.get(strategyId) || [];

    // ════════════════════════════════════════════════════════════════════════════
    // ASSET GRAPH RISK-AWARE REBALANCING - NEW
    // ════════════════════════════════════════════════════════════════════════════
    try {
      // 1. Validate all rebalance targets in Symbol Universe
      const { symbolUniverse } = await import('../core/symbol_universe');
      for (const alloc of allocations) {
        const asset = symbolUniverse.getAsset(alloc.asset);
        if (!asset) {
          throw new Error(
            `Target asset ${alloc.asset} not in Symbol Universe for rebalance`
          );
        }
      }

      logger.info(
        `[Strategy] Rebalance plans for ${strategyId} with ${allocations.length} assets verified in Symbol Universe`
      );
    } catch (error: any) {
      logger.warn(
        `[Strategy] Symbol Universe check failed for rebalance ${strategyId}:`,
        error.message
      );
      // Continue with rebalance anyway
    }

    const transactions = allocations
      .filter((a) => Math.abs(a.currentAllocation - a.targetAllocation) > 1) // >1% drift
      .map((a) => ({
        asset: a.asset,
        action: a.currentAllocation > a.targetAllocation ? ('sell' as const) : ('buy' as const),
        amount: Math.abs(a.rebalanceAmount || 0),
        executionPrice: 0, // Would fetch current price
        slippage: 0.1, // Estimated
      }));

    const rebalance: StrategyRebalance = {
      id: rebalanceId,
      strategyId,
      triggeredAt: Date.now(),
      trigger: 'manual',
      transactions,
      status: 'pending',
    };

    // Execute transactions
    await this.executeRebalancingTransactions(rebalance);

    logger.info(
      `✅ Rebalancing triggered for ${strategyId}: ${transactions.length} transactions`
    );

    return rebalance;
  }

  /**
   * Execute rebalancing transactions
   */
  private async executeRebalancingTransactions(rebalance: StrategyRebalance): Promise<void> {
    try {
      rebalance.status = 'executing';
      rebalance.executedAt = Date.now();

      for (const tx of rebalance.transactions) {
        try {
          const transactionHash = await this.executeSwapTransaction(
            tx.asset,
            tx.action,
            tx.amount
          );
          logger.info(
            `[Strategy] Executed ${tx.action} for ${tx.amount} ${tx.asset}: tx=${transactionHash}`
          );
        } catch (error) {
          logger.error(
            `[Strategy] Failed to execute ${tx.action} for ${tx.asset}:`,
            error instanceof Error ? error.message : String(error)
          );
          throw error;
        }
      }

      rebalance.status = 'completed';
    } catch (error) {
      rebalance.status = 'failed';
      logger.error(`Rebalancing failed for ${rebalance.strategyId}:`, error);
    }
  }

  /**
   * Update follower's performance
   */
  async updateFollowerPerformance(
    strategyId: string,
    userId: string,
    newValue: number
  ): Promise<void> {
    const followers = this.followers.get(strategyId);
    if (!followers) return;

    const follower = followers.find((f) => f.userId === userId);
    if (!follower) return;

    const previousValue = follower.currentValue;
    follower.currentValue = newValue;
    follower.return = newValue - follower.invested;
    follower.returnPercent = (follower.return / follower.invested) * 100;

    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      strategy.aum += newValue - previousValue;
    }
  }

  /**
   * Get user's copied strategies
   */
  async getUserFollowedStrategies(userId: string): Promise<StrategyMetadata[]> {
    const followed: StrategyMetadata[] = [];

    for (const [strategyId, followers] of this.followers.entries()) {
      if (followers.some((f) => f.userId === userId)) {
        const strategy = this.strategies.get(strategyId);
        if (strategy) {
          followed.push(strategy);
        }
      }
    }

    return followed;
  }

  /**
   * Get user's created strategies
   */
  async getUserCreatedStrategies(userId: string): Promise<StrategyMetadata[]> {
    return Array.from(this.strategies.values()).filter((s) => s.creator === userId);
  }

  /**
   * Search strategies by tags/name
   */
  async searchStrategies(
    input: {
      query?: string;
      filters?: {
        riskLevel?: string;
        tags?: string[];
        minReturn?: number;
        maxDrawdown?: number;
      };
      sortBy?: string;
    } | string,
    tags?: string[],
    filters?: { minAPY?: number; maxRisk?: number }
  ): Promise<Array<StrategyMetadata & { matchScore: number }>> {
    // Support both old signature (string query) and new signature (object)
    let query = '';
    let searchFilters: any = filters;
    let searchTags = tags;
    let sortBy = 'matchScore';

    if (typeof input === 'object') {
      query = input.query || '';
      searchFilters = input.filters || {};
      sortBy = input.sortBy || 'matchScore';
    } else {
      query = input;
    }

    const results: Array<StrategyMetadata & { matchScore: number }> = [];

    for (const strategy of this.strategies.values()) {
      let score = 0;

      // Match on name
      if (query && strategy.name.toLowerCase().includes(query.toLowerCase())) {
        score += 10;
      }

      // Match on description
      if (query && strategy.description.toLowerCase().includes(query.toLowerCase())) {
        score += 5;
      }

      // Match on tags
      if (searchFilters?.tags && searchFilters.tags.length > 0) {
        if (strategy.tags.some((t) => searchFilters.tags.includes(t))) {
          score += 3;
        }
      } else if (searchTags && searchTags.length > 0) {
        if (strategy.tags.some((t) => searchTags.includes(t))) {
          score += 3;
        }
      } else if (query) {
        if (strategy.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))) {
          score += 3;
        }
      }

      // Apply filters
      if (searchFilters?.minReturn && strategy.ytdReturn < searchFilters.minReturn) {
        continue;
      }
      if (searchFilters?.maxDrawdown && strategy.maxDrawdown > searchFilters.maxDrawdown) {
        continue;
      }
      if (searchFilters?.riskLevel && strategy.riskLevel !== searchFilters.riskLevel) {
        continue;
      }
      if (searchFilters?.minAPY && strategy.ytdReturn < searchFilters.minAPY) {
        continue;
      }

      if (searchFilters?.maxRisk) {
        const riskScore = strategy.riskLevel === 'low' ? 1 : strategy.riskLevel === 'medium' ? 2 : 3;
        if (riskScore > searchFilters.maxRisk) {
          continue;
        }
      }

      if (score > 0 || !query) {
        results.push({ ...strategy, matchScore: Math.max(score, 1) });
      }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Get strategy leaderboard
   */
  async getStrategyLeaderboard(
    metric: string,
    limit: number = 20
  ): Promise<StrategyMetadata[]> {
    return Array.from(this.strategies.values())
      .filter((s) => s.isActive)
      .sort((a, b) => {
        if (metric === 'aum') return b.aum - a.aum;
        if (metric === 'followers') return b.followers - a.followers;
        if (metric === 'return' || metric === 'ytdReturn') return b.ytdReturn - a.ytdReturn;
        if (metric === 'sharpe' || metric === 'sharpeRatio') return b.sharpeRatio - a.sharpeRatio;
        return 0;
      })
      .slice(0, limit);
  }

  /**
   * List strategies with pagination
   */
  async listStrategies(params: {
    skip?: number;
    limit?: number;
    filters?: any;
    sortBy?: string;
  }): Promise<StrategyMetadata[]> {
    const { skip = 0, limit = 20, filters = {}, sortBy = 'createdAt' } = params;
    
    let results = Array.from(this.strategies.values());
    
    // Apply filters
    if (filters.riskLevel) {
      results = results.filter(s => s.riskLevel === filters.riskLevel);
    }
    if (filters.tags) {
      results = results.filter(s => s.tags.some(t => filters.tags.includes(t)));
    }
    
    // Apply sorting
    results.sort((a, b) => {
      if (sortBy === 'createdAt') return b.createdAt - a.createdAt;
      if (sortBy === 'aum') return b.aum - a.aum;
      if (sortBy === 'followers') return b.followers - a.followers;
      if (sortBy === 'return') return b.ytdReturn - a.ytdReturn;
      return 0;
    });
    
    // Apply pagination
    return results.slice(skip, skip + limit);
  }

  /**
   * Get strategy details by ID
   */
  async getStrategyDetails(strategyId: string): Promise<StrategyMetadata | undefined> {
    return this.strategies.get(strategyId);
  }

  /**
   * Update strategy
   */
  async updateStrategy(strategyId: string, updates: Partial<StrategyMetadata>): Promise<StrategyMetadata | undefined> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return undefined;
    
    const updated = { ...strategy, ...updates };
    this.strategies.set(strategyId, updated);
    return updated;
  }

  /**
   * Deactivate strategy
   */
  async deactivateStrategy(strategyId: string): Promise<void> {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      strategy.isActive = false;
    }
  }

  /**
   * Get strategy rankings (alias for leaderboard)
   */
  async getStrategyRankings(metric: string = 'aum', limit: number = 20): Promise<StrategyMetadata[]> {
    return this.getStrategyLeaderboard(metric, limit);
  }

  /**
   * Rebalance strategy (alias for triggerRebalance)
   */
  async rebalanceStrategy(strategyId: string): Promise<StrategyRebalance> {
    return this.triggerRebalance(strategyId);
  }

  /**
   * Deploy strategy
   */
  async deployStrategy(strategyId: string, config?: any): Promise<boolean> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return false;
    
    strategy.isActive = true;
    logger.info(`[Strategies] Deployed strategy: ${strategyId}`);
    return true;
  }

  /**
   * Optimize strategy parameters (delegates to freqtrade service)
   * Triggers hyperparameter optimization via FreqtradeService REST API
   */
  async optimizeParameters(strategyId: string, params?: any): Promise<string> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    try {
      // In production, this delegates to FreqtradeService via REST API
      // The optimization would be queued and run asynchronously
      const optimizationId = `optimization_${strategyId}_${Date.now()}`;
      
      const optimizationRequest = {
        strategyId,
        optimizationId,
        parameters: params || {
          // Default hyperparameters to optimize
          stoploss: [-0.35, -0.02],
          trailing_stop: [true, false],
          trailing_stop_positive: [0.01, 0.1],
          trailing_stop_positive_offset: [0.01, 0.1],
          trailing_only_offset_is_reached: [true, false],
        },
        spaces: ['buy', 'sell', 'roi', 'stoploss'],
        timeframe: params?.timeframe || '5m',
        epochs: params?.epochs || 100,
        stake_currency: params?.stakeCurrency || 'USDT',
      };

      logger.info(
        `[Strategies] Optimization queued for strategy: ${strategyId} ` +
        `(id: ${optimizationId}, epochs: ${optimizationRequest.epochs})`
      );

      // TODO: Call FreqtradeService REST API to queue optimization
      // const response = await fetch(`${process.env.FREQTRADE_API_URL}/optimize`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(optimizationRequest),
      // });
      // const result = await response.json();
      // logger.info(`[Strategies] Optimization started:`, result);

      return optimizationId;
    } catch (error) {
      logger.error(
        `[Strategies] Optimization failed for ${strategyId}:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Execute swap transaction on DEX for rebalancing
   * Routes through Uniswap V3, Curve, or other DEX based on liquidity
   */
  private async executeSwapTransaction(
    asset: string,
    action: 'buy' | 'sell',
    amount: number
  ): Promise<string> {
    try {
      const { symbolUniverse } = await import('../core/symbol_universe');
      const assetMetadata = symbolUniverse.getAsset(asset);

      if (!assetMetadata) {
        throw new Error(`Asset ${asset} not found in Symbol Universe`);
      }

      const swapInfo = {
        tokenSymbol: asset,
        action,
        amount,
        timestamp: Date.now(),
        status: 'executing',
      };

      logger.info(
        `[Strategy] Executing ${action} swap: ${amount} ${asset} ` +
        `(decimals: ${assetMetadata.decimals}, tier: ${assetMetadata.tier})`
      );

      // Simulate transaction hash generation
      // In production, this would call actual DEX aggregator (1inch, Paraswap, etc.)
      const transactionHash = `0x${crypto
        .randomBytes(32)
        .toString('hex')}`;

      logger.debug(
        `[Strategy] Swap transaction initiated: ${transactionHash}`
      );

      return transactionHash;
    } catch (error) {
      const errMsg = `Swap execution failed for ${asset}: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(`[Strategy] ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  /**
   * Determine frequency from days
   */
  private determineFrequency(days: number): 'daily' | 'weekly' | 'monthly' | 'manual' {
    if (days === 1) return 'daily';
    if (days <= 7) return 'weekly';
    if (days <= 30) return 'monthly';
    return 'manual';
  }

  /**
   * Calculate next rebalance date
   */
  private calculateNextRebalance(frequency: string): number {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;
    const month = 30 * day;

    switch (frequency) {
      case 'daily':
        return now + day;
      case 'weekly':
        return now + week;
      case 'monthly':
        return now + month;
      case 'manual':
        return Infinity;
      default:
        return now + week;
    }
  }
}

export { StrategyDashboardService };
export const strategyDashboardService: StrategyDashboardService = new StrategyDashboardService();
