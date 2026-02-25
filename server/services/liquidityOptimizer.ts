/**
 * Liquidity Optimizer
 * Multi-path search and optimization for cross-chain transfers
 * Finds cheapest, fastest, and balanced routes
 */

import { SupportedChain, CHAIN_CONFIG } from '../../shared/chainConfiguration';
import { getFeeCalculator, AllRoutingCosts } from './feeCalculator';
import { getBridgeIntegration, BridgeProtocol } from './bridgeIntegration';
import { getServiceAccountManager } from './serviceAccountManager';
import { Logger } from '../utils/logger';

const logger = new Logger('liquidity-optimizer');

export interface OptimizationRequest {
  sourceChain?: SupportedChain;        // If omitted, searches all chains
  targetChain: SupportedChain;
  sourceToken: string;
  targetToken: string;
  amount: string;
  priority: 'cost' | 'speed' | 'balanced';
  maxHops?: number;                   // Max intermediate hops (default 1)
  excludeChains?: SupportedChain[];   // Skip certain chains
}

export interface OptimalPathResult {
  rank: number;
  method: 'direct' | 'bridge' | 'swap_bridge' | 'multi_hop';
  
  // Route composition
  hops: TransferHop[];
  
  // Costs
  totalCostUSD: string;
  costBreakdown: {
    [key: string]: string;  // gas_source, gas_target, bridge_fee, swap_slippage
  };
  totalCostPercent: string;
  
  // Timing
  estimatedTimeSeconds: number;
  
  // Scoring
  costScore: number;        // 0-100, lower is better
  speedScore: number;       // 0-100, lower is better
  balancedScore: number;    // 0-100, lower is better
  
  // Recommendation
  recommendedFor: string;   // "cheapest", "fastest", "balanced"
}

export interface TransferHop {
  sequence: number;
  sourceChain: SupportedChain;
  targetChain: SupportedChain;
  sourceToken: string;
  targetToken: string;
  amount: string;           // Amount at this hop
  bridgeProtocol?: BridgeProtocol;
  isSwap: boolean;
  isNativeTransfer: boolean;
  estimatedTime: number;
  estimatedCost: string;
}

export interface OptimizationResult {
  request: OptimizationRequest;
  topPaths: OptimalPathResult[];
  totalPathsSearched: number;
  executionTime: number;    // milliseconds
  recommendation: OptimalPathResult;
}

export class LiquidityOptimizer {
  private feeCalculator = getFeeCalculator();
  private bridgeIntegration = getBridgeIntegration();
  private accountManager = getServiceAccountManager();

  /**
   * Find optimal transfer paths
   */
  async findOptimalPaths(req: OptimizationRequest): Promise<OptimizationResult> {
    const startTime = Date.now();
    logger.info(`Optimizing path: ${req.sourceToken} → ${req.targetToken} on ${req.targetChain}, priority: ${req.priority}`);

    const result: OptimizationResult = {
      request: req,
      topPaths: [],
      totalPathsSearched: 0,
      executionTime: 0,
      recommendation: {} as OptimalPathResult,
    };

    try {
      // Get all available source chains
      const sourceChains = req.sourceChain
        ? [req.sourceChain]
        : this.getAvailableSourceChains(req);

      // Generate all possible paths
      const allPaths: OptimalPathResult[] = [];

      for (const sourceChain of sourceChains) {
        // 1-hop paths (direct or bridge)
        const paths1Hop = await this.generate1HopPaths(sourceChain, req);
        allPaths.push(...paths1Hop);

        // 2-hop paths (if allowed)
        if ((req.maxHops || 1) >= 2) {
          const paths2Hop = await this.generate2HopPaths(sourceChain, req);
          allPaths.push(...paths2Hop);
        }

        // 3-hop paths (if explicitly requested)
        if ((req.maxHops || 1) >= 3) {
          const paths3Hop = await this.generate3HopPaths(sourceChain, req);
          allPaths.push(...paths3Hop);
        }
      }

      result.totalPathsSearched = allPaths.length;

      // Score all paths
      const scoredPaths = allPaths.map((path, index) => ({
        ...path,
        rank: index + 1,
      }));

      // Sort by priority
      const sorted = this.sortByPriority(scoredPaths, req.priority);

      // Return top 5 paths
      result.topPaths = sorted.slice(0, 5);

      // Determine recommendation
      result.recommendation = result.topPaths[0] || ({} as OptimalPathResult);
      result.executionTime = Date.now() - startTime;

      logger.info(
        `Optimization complete: ${result.totalPathsSearched} paths evaluated, ` +
        `top recommendation: ${result.recommendation.method || 'none'} ` +
        `(${result.recommendation.totalCostUSD || '?'} USD)`
      );

      return result;
    } catch (error) {
      logger.error(`Optimization failed: ${(error as any).message}`);
      result.executionTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Generate 1-hop paths (direct transfer or single bridge)
   */
  private async generate1HopPaths(sourceChain: SupportedChain, req: OptimizationRequest): Promise<OptimalPathResult[]> {
    const paths: OptimalPathResult[] = [];

    try {
      // Same chain, same token - direct transfer
      if (sourceChain === req.targetChain && req.sourceToken === req.targetToken) {
        const cost = await this.feeCalculator.calculateDirectTransferCost(
          sourceChain,
          req.amount,
          sourceChain === CHAIN_CONFIG[sourceChain]?.nativeToken
        );

        if (cost) {
          paths.push({
            rank: 0,
            method: 'direct',
            hops: [
              {
                sequence: 1,
                sourceChain,
                targetChain: req.targetChain,
                sourceToken: req.sourceToken,
                targetToken: req.targetToken,
                amount: req.amount,
                isSwap: false,
                isNativeTransfer: true,
                estimatedTime: cost.estimatedTimeSeconds,
                estimatedCost: cost.totalCostUSD,
              },
            ],
            totalCostUSD: cost.totalCostUSD,
            costBreakdown: {
              gas: cost.gasSourceChain,
            },
            totalCostPercent: cost.totalCostPercent,
            estimatedTimeSeconds: cost.estimatedTimeSeconds,
            costScore: this.calculateCostScore(parseFloat(cost.totalCostUSD), parseFloat(req.amount)),
            speedScore: this.calculateSpeedScore(cost.estimatedTimeSeconds),
            balancedScore: 0, // Will be calculated
            recommendedFor: 'cheapest',
          });
        }
      }

      // Same token on different chains - use bridge
      if (sourceChain !== req.targetChain && req.sourceToken === req.targetToken) {
        const cost = await this.feeCalculator.calculateBridgeTransferCost(
          sourceChain,
          req.targetChain,
          req.amount,
          req.sourceToken
        );

        if (cost) {
          paths.push({
            rank: 0,
            method: 'bridge',
            hops: [
              {
                sequence: 1,
                sourceChain,
                targetChain: req.targetChain,
                sourceToken: req.sourceToken,
                targetToken: req.targetToken,
                amount: req.amount,
                bridgeProtocol: cost.bridgeProtocol as BridgeProtocol,
                isSwap: false,
                isNativeTransfer: false,
                estimatedTime: cost.estimatedTimeSeconds,
                estimatedCost: cost.totalCostUSD,
              },
            ],
            totalCostUSD: cost.totalCostUSD,
            costBreakdown: {
              gas_source: cost.gasSourceChain,
              gas_target: cost.gasTargetChain,
              bridge_fee: cost.bridgeFee,
            },
            totalCostPercent: cost.totalCostPercent,
            estimatedTimeSeconds: cost.estimatedTimeSeconds,
            costScore: this.calculateCostScore(parseFloat(cost.totalCostUSD), parseFloat(req.amount)),
            speedScore: this.calculateSpeedScore(cost.estimatedTimeSeconds),
            balancedScore: 0,
            recommendedFor: cost.estimatedTimeSeconds < 1200 ? 'fastest' : 'balanced',
          });
        }
      }

      // Token mismatch - swap + bridge
      if (req.sourceToken !== req.targetToken) {
        const cost = await this.feeCalculator.calculateSwapBridgeCost(
          sourceChain,
          req.targetChain,
          req.sourceToken,
          req.targetToken,
          req.amount
        );

        if (cost) {
          paths.push({
            rank: 0,
            method: 'swap_bridge',
            hops: [
              {
                sequence: 1,
                sourceChain,
                targetChain: sourceChain,
                sourceToken: req.sourceToken,
                targetToken: req.targetToken,
                amount: req.amount,
                isSwap: true,
                isNativeTransfer: false,
                estimatedTime: 300,
                estimatedCost: cost.swapSlippage || '0',
              },
              {
                sequence: 2,
                sourceChain,
                targetChain: req.targetChain,
                sourceToken: req.targetToken,
                targetToken: req.targetToken,
                amount: (parseFloat(req.amount) * (1 - parseFloat(cost.swapSlippage || '0') / parseFloat(req.amount))).toFixed(6),
                bridgeProtocol: cost.bridgeProtocol as BridgeProtocol,
                isSwap: false,
                isNativeTransfer: false,
                estimatedTime: cost.estimatedTimeSeconds,
                estimatedCost: cost.bridgeFee,
              },
            ],
            totalCostUSD: cost.totalCostUSD,
            costBreakdown: {
              swap_slippage: cost.swapSlippage || '0',
              gas_source: cost.gasSourceChain,
              gas_target: cost.gasTargetChain,
              bridge_fee: cost.bridgeFee,
            },
            totalCostPercent: cost.totalCostPercent,
            estimatedTimeSeconds: cost.estimatedTimeSeconds,
            costScore: this.calculateCostScore(parseFloat(cost.totalCostUSD), parseFloat(req.amount)),
            speedScore: this.calculateSpeedScore(cost.estimatedTimeSeconds),
            balancedScore: 0,
            recommendedFor: 'balanced',
          });
        }
      }
    } catch (error) {
      logger.warn(`Failed to generate 1-hop paths: ${(error as any).message}`);
    }

    return paths;
  }

  /**
   * Generate 2-hop paths (intermediate chain)
   */
  private async generate2HopPaths(sourceChain: SupportedChain, req: OptimizationRequest): Promise<OptimalPathResult[]> {
    const paths: OptimalPathResult[] = [];
    const intermediateChains = this.getIntermediateChains(sourceChain, req);

    for (const intermediateChain of intermediateChains) {
      try {
        // Check if beneficial intermediate conversion exists
        // This is complex, so we'll do a simplified version:
        // Intermediate → Target chain with better liquidity

        // Skip if no bridge available
        const sourceConfig = CHAIN_CONFIG[sourceChain];
        const intermediateConfig = CHAIN_CONFIG[intermediateChain];
        
        if (!sourceConfig || !intermediateConfig) continue;
        
        // Check if both share bridge protocols
        const sourceProtocols: Set<string> = new Set(sourceConfig.bridges.filter((b) => b.active).map((b) => b.protocol));
        const intermediateProtocols: Set<string> = new Set(intermediateConfig.bridges.filter((b) => b.active).map((b) => b.protocol));
        
        let hasPath = false;
        for (const protocol of sourceProtocols) {
          if (intermediateProtocols.has(protocol)) {
            hasPath = true;
            break;
          }
        }

        if (!hasPath) continue;

        // Simple heuristic: only consider if it reduces cost significantly
        // In production, would evaluate each path more thoroughly
      } catch (error) {
        logger.debug(`Skipped 2-hop via ${intermediateChain}: ${(error as any).message}`);
      }
    }

    return paths;
  }

  /**
   * Generate 3-hop paths (complex routing)
   */
  private async generate3HopPaths(sourceChain: SupportedChain, req: OptimizationRequest): Promise<OptimalPathResult[]> {
    const paths: OptimalPathResult[] = [];

    // 3-hop paths are rarely optimal, so we'll skip detailed implementation
    // In production, would implement sophisticated path-finding (Dijkstra, etc.)

    return paths;
  }

  /**
   * Sort paths by priority
   */
  private sortByPriority(paths: OptimalPathResult[], priority: 'cost' | 'speed' | 'balanced'): OptimalPathResult[] {
    paths.forEach(path => {
      path.balancedScore = (path.costScore * 0.6) + (path.speedScore * 0.4);
    });

    switch (priority) {
      case 'cost':
        return paths.sort((a, b) => a.costScore - b.costScore);
      case 'speed':
        return paths.sort((a, b) => a.speedScore - b.speedScore);
      case 'balanced':
        return paths.sort((a, b) => a.balancedScore - b.balancedScore);
      default:
        return paths;
    }
  }

  /**
   * Get available source chains for the token
   */
  private getAvailableSourceChains(req: OptimizationRequest): SupportedChain[] {
    const excluded = new Set(req.excludeChains || []);
    const allChains = Object.keys(CHAIN_CONFIG) as SupportedChain[];

    return allChains.filter(chain =>
      !excluded.has(chain) &&
      this.hasTokenLiquidity(chain, req.sourceToken)
    );
  }

  /**
   * Get intermediate chains for routing
   */
  private getIntermediateChains(sourceChain: SupportedChain, req: OptimizationRequest): SupportedChain[] {
    const excluded = new Set(req.excludeChains || []);
    const allChains = Object.keys(CHAIN_CONFIG) as SupportedChain[];

    return allChains.filter(chain =>
      chain !== sourceChain &&
      !excluded.has(chain) &&
      this.isBridgeAvailable(sourceChain, chain) &&
      this.isBridgeAvailable(chain, req.targetChain)
    );
  }

  /**
   * Check if token has liquidity on chain
   */
  private hasTokenLiquidity(chain: SupportedChain, token: string): boolean {
    // In production, would check actual balance
    // For now, assume all supported tokens on all chains
    return true;
  }

  /**
   * Check if bridge exists between chains
   */
  private isBridgeAvailable(sourceChain: SupportedChain, targetChain: SupportedChain): boolean {
    const sourceConfig = CHAIN_CONFIG[sourceChain];
    const targetConfig = CHAIN_CONFIG[targetChain];
    
    if (!sourceConfig || !targetConfig) return false;

    // Check if they share bridge protocols
    const sourceProtocols = new Set(sourceConfig.bridges.filter(b => b.active).map(b => b.protocol));
    const targetProtocols = new Set(targetConfig.bridges.filter(b => b.active).map(b => b.protocol));

    for (const protocol of sourceProtocols) {
      if (targetProtocols.has(protocol)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calculate cost score (0-100, lower is better)
   */
  private calculateCostScore(costUSD: number, amountUSD: number): number {
    const costPercent = (costUSD / (amountUSD || 1)) * 100;

    // Normalize to 0-100 scale
    // 0.1% = 0 score (excellent)
    // 2% = 100 score (bad)
    return Math.max(0, Math.min(100, costPercent * 50));
  }

  /**
   * Calculate speed score (0-100, lower is better)
   */
  private calculateSpeedScore(timeSeconds: number): number {
    // Normalize to 0-100 scale
    // 1 minute = 0 score (excellent)
    // 30 minutes = 100 score (bad)
    const minutes = timeSeconds / 60;
    return Math.max(0, Math.min(100, (minutes - 1) * 3.3));
  }
}

/**
 * Singleton instance
 */
let instance: LiquidityOptimizer | null = null;

export function initializeLiquidityOptimizer(): LiquidityOptimizer {
  if (!instance) {
    instance = new LiquidityOptimizer();
  }
  return instance;
}

export function getLiquidityOptimizer(): LiquidityOptimizer {
  if (!instance) {
    instance = new LiquidityOptimizer();
  }
  return instance;
}

export function destroyLiquidityOptimizer(): void {
  instance = null;
}
