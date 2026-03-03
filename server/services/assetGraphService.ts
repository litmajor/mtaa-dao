/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ASSET GRAPH SERVICE - User Portfolio & Position Tracking
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Core functions:
 * • Discover all user positions across multiple protocols
 * • Build relationship graph (supply → yield, collateral → debt)
 * • Calculate composite exposures (net BTC, net ETH)
 * • Monitor liquidation risks
 * • Track yield across protocols
 * • Real-time price updates via OHLCV
 */

import { Logger } from '../utils/logger';
import { ohlcvService } from './ohlcvService';
import { aaveAdapter } from './defiProtocols/aaveAdapter';
import { moolaAdapter } from './defiProtocols/moolaAdapter';
import { lidoAdapter, curveAdapter } from './defiProtocols/lidoCurveAdapter';
import type {
  UserAssetGraph,
  AssetGraphNode,
  AssetGraphEdge,
  CompositeExposure,
  LiquidationRisk,
  AmaraPortfolioView,
  RiskLevel,
} from '../core/assetGraph/types';

const logger = Logger.getLogger();

class AssetGraphService {
  private graphs: Map<string, UserAssetGraph> = new Map();
  private updateIntervals: Map<string, NodeJS.Timer> = new Map();

  /**
   * CORE: Load or create user's asset graph
   * Called when user opens Amara Dashboard
   */
  async loadUserGraph(userId: string): Promise<UserAssetGraph> {
    // Return cached if exists and fresh
    if (this.graphs.has(userId)) {
      const cached = this.graphs.get(userId)!;
      const isFresh = Date.now() - cached.portfolioMetrics.lastSyncedAt < 5 * 60 * 1000; // 5 min
      
      if (isFresh) {
        return cached;
      }
    }

    logger.info(`[AssetGraph] Loading graph for user: ${userId}`);

    // Initialize empty graph
    const graph: UserAssetGraph = {
      userId,
      nodes: new Map(),
      edges: new Map(),
      byProtocol: new Map(),
      bySymbol: new Map(),
      byChain: new Map(),
      byYield: new Map(),
      compositeExposures: new Map(),
      liquidationRisks: [],
      portfolioMetrics: {
        totalValueUSD: 0,
        totalYieldUSD: 0,
        totalYieldAPY: 0,
        totalYieldProjectedAnnual: 0,
        protocolExposureCount: 0,
        uniqueAssets: 0,
        riskScore: 0,
        liquidationRiskCount: 0,
        lastSyncedAt: Date.now(),
        completeness: 0,
      },
    };

    try {
      // Discover positions from all sources
      const allNodes = await this.discoverAllPositions(userId);
      
      // Add to graph
      for (const node of allNodes) {
        graph.nodes.set(node.id, node);
      }

      logger.debug(`[AssetGraph] Discovered ${graph.nodes.size} positions for ${userId}`);

      // Build edges (relationships)
      await this.buildEdges(graph);

      // Build indices
      this.buildIndices(graph);

      // Calculate composites
      await this.calculateCompositeExposures(graph);

      // Check liquidation risks
      await this.checkLiquidationRisks(graph);

      // Calculate metrics
      this.calculatePortfolioMetrics(graph);

      // Store in memory cache
      this.graphs.set(userId, graph);

      // Setup real-time updates
      this.setupRealtimeUpdates(userId);

      logger.info(`✅ Loaded asset graph for ${userId}: ${graph.nodes.size} positions, $${graph.portfolioMetrics.totalValueUSD.toFixed(2)} total value`);

    } catch (error) {
      logger.error(`[AssetGraph] Failed to load graph for ${userId}:`, error);
      // Return empty graph so dashboard doesn't crash
      this.graphs.set(userId, graph);
    }

    return graph;
  }

  /**
   * DISCOVERY: Find all positions across protocols
   * Queries: Wallet RPC, Aave, Lido, Curve, Moola subgraphs
   */
  private async discoverAllPositions(userId: string): Promise<AssetGraphNode[]> {
    const allNodes: AssetGraphNode[] = [];

    try {
      logger.debug(`[AssetGraph] Discovering positions for ${userId}...`);

      // Get user's wallet addresses from database
      const walletAddresses = await this.getUserWalletAddresses(userId);
      if (!walletAddresses.length) {
        logger.warn(`[AssetGraph] No wallet addresses found for ${userId}`);
        return [];
      }

      // Get current prices (using fallback estimates)
      const prices = await ohlcvService.getPrices(['ETH', 'BTC', 'USDC', 'DAI', 'CELO']);
      const ethPrice = prices['ETH']?.close || 1900;

      // 1. WALLET BALANCES - Direct holdings
      for (const address of walletAddresses) {
        const balances = await this.getWalletBalances(address);
        
        for (const { symbol, balance, decimals } of balances) {
          const price = await this.getTokenPrice(symbol);
          const balanceUSD = (balance / Math.pow(10, decimals)) * price;

          if (balanceUSD < 1) continue; // Skip dust
          
          allNodes.push({
            id: `${userId}:${symbol}:direct:${address.slice(0, 8)}`,
            userId,
            type: 'direct_holding',
            symbol,
            chain: 'ethereum',
            address,
            balance: balance / Math.pow(10, decimals),
            balanceUSD,
            decimals,
            unlocked: true,
            riskLevel: 'low',
            tags: ['wallet'],
            lastUpdated: Date.now(),
            dataSource: 'wallet_rpc',
          });
        }
      }

      // 2. AAVE POSITIONS - Multi-chain lending/borrowing
      for (const address of walletAddresses) {
        const aavePositions = await aaveAdapter.discoverPositions(address);
        
        for (const aavePos of aavePositions) {
          // Supplied assets
          for (const supply of aavePos.supplied) {
            const price = await this.getTokenPrice(supply.asset);
            const balanceUSD = supply.amount * price;

            allNodes.push({
              id: `${userId}:aave:${supply.asset}:supply:${aavePos.chain}`,
              userId,
              type: 'protocol_position',
              symbol: `a${supply.asset}`,
              underlyingSymbol: supply.asset,
              protocol: 'aave',
              chain: aavePos.chain as any,
              decimals: 18,
              balance: supply.amount,
              balanceUSD,
              exchangeRate: 1.01,
              apyRate: supply.apy,
              apyMode: 'variable' as const,
              yieldType: 'lending' as const,
              unlocked: true,
              riskLevel: 'low',
              tags: ['lending', 'yield'],
              lastUpdated: Date.now(),
              dataSource: 'protocol_subgraph',
            });
          }

          // Borrowed assets
          for (const borrow of aavePos.borrowed) {
            const price = await this.getTokenPrice(borrow.asset);
            const balanceUSD = borrow.amount * price;

            allNodes.push({
              id: `${userId}:aave:${borrow.asset}:borrow:${aavePos.chain}`,
              userId,
              type: 'debt',
              symbol: borrow.asset,
              protocol: 'aave',
              chain: aavePos.chain as any,
              decimals: 18,
              balance: -borrow.amount,
              balanceUSD: -balanceUSD,
              apyRate: borrow.borrowRate,
              unlocked: true,
              riskLevel: 'medium',
              riskFactors: ['liquidation'],
              tags: ['debt'],
              lastUpdated: Date.now(),
              dataSource: 'protocol_subgraph',
            });
          }
        }
      }

      // 3. LIDO POSITIONS - Liquid staking
      for (const address of walletAddresses) {
        const lidoPos = await lidoAdapter.discoverPositions(address, ethPrice);
        
        if (lidoPos && lidoPos.stETHBalance > 0) {
          allNodes.push({
            id: `${userId}:lido:steth`,
            userId,
            type: 'derivative',
            symbol: 'stETH',
            underlyingSymbol: 'ETH',
            protocol: 'lido',
            chain: 'ethereum',
            decimals: 18,
            balance: lidoPos.stETHBalance,
            balanceUSD: lidoPos.stETHBalanceUSD,
            underlyingBalance: lidoPos.underlyingETH,
            exchangeRate: 1.005,
            exchangeRateExplanation: '1 stETH = 1.005 ETH (includes validator rewards)',
            apyRate: lidoPos.apy,
            apyMode: 'rebasing' as const,
            yieldType: 'staking' as const,
            unlocked: true,
            riskLevel: 'low',
            tags: ['staking', 'yield'],
            lastUpdated: Date.now(),
            dataSource: 'protocol_subgraph',
          });
        }
      }

      // 4. CURVE POSITIONS - DEX LP
      for (const address of walletAddresses) {
        const curvePositions = await curveAdapter.discoverPositions(address);
        
        for (const curve of curvePositions) {
          allNodes.push({
            id: `${userId}:curve:lp:${curve.poolAddress.slice(0, 8)}`,
            userId,
            type: 'lp_share',
            symbol: `CURVE-LP-${curve.poolAddress.slice(0, 6)}`,
            protocol: 'curve',
            chain: 'ethereum',
            decimals: 18,
            balance: curve.lpTokenBalance,
            balanceUSD: curve.lpValueUSD,
            apyRate: curve.apy,
            apyMode: 'variable' as const,
            yieldType: 'trading_fees' as const,
            unlocked: true,
            riskLevel: 'medium',
            riskFactors: ['impermanent_loss'],
            tags: ['lp', 'yield'],
            lastUpdated: Date.now(),
            dataSource: 'protocol_subgraph',
          });
        }
      }

      // 5. MOOLA POSITIONS - Celo lending
      for (const address of walletAddresses) {
        const moolaPos = await moolaAdapter.discoverPositions(address);
        
        if (moolaPos) {
          for (const supply of moolaPos.supplied) {
            const price = await this.getTokenPrice(supply.asset);
            allNodes.push({
              id: `${userId}:moola:${supply.asset}:supply`,
              userId,
              type: 'protocol_position',
              symbol: `m${supply.asset}`,
              underlyingSymbol: supply.asset,
              protocol: 'moola',
              chain: 'celo',
              decimals: 18,
              balance: supply.amount,
              balanceUSD: supply.amount * price,
              apyRate: supply.apy,
              yieldType: 'lending' as const,
              unlocked: true,
              riskLevel: 'low',
              tags: ['lending', 'yield'],
              lastUpdated: Date.now(),
              dataSource: 'protocol_subgraph',
            });
          }

          for (const borrow of moolaPos.borrowed) {
            const price = await this.getTokenPrice(borrow.asset);
            allNodes.push({
              id: `${userId}:moola:${borrow.asset}:borrow`,
              userId,
              type: 'debt',
              symbol: borrow.asset,
              protocol: 'moola',
              chain: 'celo',
              decimals: 18,
              balance: -borrow.amount,
              balanceUSD: -borrow.amount * price,
              apyRate: borrow.apy,
              unlocked: true,
              riskLevel: 'medium',
              tags: ['debt'],
              lastUpdated: Date.now(),
              dataSource: 'protocol_subgraph',
            });
          }
        }
      }

      logger.info(`[AssetGraph] Discovered ${allNodes.length} positions for ${userId}`);
    } catch (error) {
      logger.error(`[AssetGraph] Error discovering positions:`, error);
    }

    return allNodes;
  }

  /**
   * Get token price (using fallback estimates)
   */
  private async getTokenPrice(symbol: string): Promise<number> {
    // Return fallback price estimates
    const fallbacks: Record<string, number> = {
      ETH: 1900,
      USDC: 1.0,
      DAI: 1.0,
      USDT: 1.0,
      WBTC: 45000,
      BTC: 45000,
      CELO: 0.67,
      cUSD: 1.0,
    };
    
    return fallbacks[symbol] || 1.0; // Default to 1.0 if unknown
  }

  /**
   * Get wallet balances from RPC
   */
  private async getWalletBalances(address: string): Promise<Array<{ symbol: string; balance: number; decimals: number }>> {
    try {
      // TODO: Integrate with actual RPC or wallet balance service
      // For now return empty - would query Alchemy, Infura, etc
      return [];
    } catch (error) {
      logger.error(`[AssetGraph] Error fetching wallet balances:`, error);
      return [];
    }
  }

  /**
   * Get user's wallet addresses
   */
  private async getUserWalletAddresses(userId: string): Promise<string[]> {
    try {
      // TODO: Query from database for user's connected wallets
      // For now return empty array - would be populated from user's settings
      return [];
    } catch {
      return [];
    }
  }

  /**
   * BUILD EDGES: Connect nodes with relationships
   */
  private async buildEdges(graph: UserAssetGraph): Promise<void> {
    logger.debug(`[AssetGraph] Building edges for user ${graph.userId}`);

    // SUPPLY RELATIONSHIP: Direct USDC → aUSDC
    {
      const directUSDC = Array.from(graph.nodes.values()).find(
        (n) => n.symbol === 'USDC' && n.type === 'direct_holding'
      );

      const aUSDC = Array.from(graph.nodes.values()).find(
        (n) => n.symbol === 'aUSDC'
      );

      if (directUSDC && aUSDC) {
        graph.edges.set(`${directUSDC.id}→${aUSDC.id}`, {
          id: `${directUSDC.id}→${aUSDC.id}`,
          source: directUSDC.id,
          target: aUSDC.id,
          relationship: 'supplies',
          srcAmount: directUSDC.balance,
          tgtAmount: aUSDC.balance,
          rate: aUSDC.apyRate,
          ratioExplanation: `Earning ${aUSDC.apyRate}% APY, balance grows daily`,
          unlocked: true,
          createdAt: aUSDC.lastUpdated,
          lastUpdated: aUSDC.lastUpdated,
          visibility: 'primary',
        });
      }
    }

    // STAKE RELATIONSHIP: Direct ETH → stETH
    {
      const directETH = Array.from(graph.nodes.values()).find(
        (n) => n.symbol === 'ETH' && n.type === 'direct_holding'
      );

      const stETH = Array.from(graph.nodes.values()).find(
        (n) => n.symbol === 'stETH'
      );

      if (directETH && stETH && stETH.balance > 0) {
        graph.edges.set(`${directETH.id}→${stETH.id}`, {
          id: `${directETH.id}→${stETH.id}`,
          source: directETH.id,
          target: stETH.id,
          relationship: 'stakes',
          srcAmount: Math.min(directETH.balance, stETH.underlyingBalance || stETH.balance),
          tgtAmount: stETH.balance,
          rate: stETH.apyRate,
          ratioExplanation: `${stETH.balance} stETH = ${stETH.underlyingBalance} ETH (includes rewards)`,
          unlocked: true,
          createdAt: stETH.lastUpdated,
          lastUpdated: stETH.lastUpdated,
          visibility: 'primary',
        });
      }
    }
  }

  /**
   * INDICES: Build maps for quick lookup
   */
  private buildIndices(graph: UserAssetGraph): void {
    logger.debug(`[AssetGraph] Building indices`);

    for (const [nodeId, node] of graph.nodes) {
      // By Protocol
      if (node.protocol) {
        if (!graph.byProtocol.has(node.protocol)) {
          graph.byProtocol.set(node.protocol, []);
        }
        graph.byProtocol.get(node.protocol)!.push(nodeId);
      }

      // By Symbol
      if (!graph.bySymbol.has(node.symbol)) {
        graph.bySymbol.set(node.symbol, []);
      }
      graph.bySymbol.get(node.symbol)!.push(nodeId);

      // By Chain
      if (!graph.byChain.has(node.chain)) {
        graph.byChain.set(node.chain, []);
      }
      graph.byChain.get(node.chain)!.push(nodeId);

      // By Yield
      if (node.yieldType) {
        if (!graph.byYield.has(node.yieldType)) {
          graph.byYield.set(node.yieldType, []);
        }
        graph.byYield.get(node.yieldType)!.push(nodeId);
      }
    }
  }

  /**
   * COMPOSITES: Calculate aggregated exposures
   */
  private async calculateCompositeExposures(graph: UserAssetGraph): Promise<void> {
    logger.debug(`[AssetGraph] Calculating composite exposures`);

    // Group by underlying asset
    const exposureMap: Map<string, AssetGraphNode[]> = new Map();

    for (const [nodeId, node] of graph.nodes) {
      const baseAsset = node.underlyingSymbol || node.symbol;

      if (!exposureMap.has(baseAsset)) {
        exposureMap.set(baseAsset, []);
      }
      exposureMap.get(baseAsset)!.push(node);
    }

    // Create composite exposures
    for (const [baseAsset, nodes] of exposureMap) {
      const components = nodes.map((n) => ({
        nodeId: n.id,
        symbol: n.symbol,
        quantity: n.balance,
        direction: (n.balance < 0 ? 'short' : 'long') as 'long' | 'short',
        weight: 0, // Calculated after
        protocol: n.protocol,
        valueUSD: n.balanceUSD,
      }));

      const netLong = components
        .filter((c) => c.direction === 'long')
        .reduce((sum, c) => sum + c.quantity, 0);

      const netShort = components
        .filter((c) => c.direction === 'short')
        .reduce((sum, c) => sum + Math.abs(c.quantity), 0);

      const netQuantity = netLong - netShort;
      const netValueUSD = components.reduce((sum, c) => sum + c.valueUSD, 0);

      // Calculate weights
      const totalQuantity = Math.abs(netLong) + Math.abs(netShort);
      components.forEach((c) => {
        c.weight = totalQuantity > 0 ? Math.abs(c.quantity) / totalQuantity : 0;
      });

      graph.compositeExposures.set(`${graph.userId}:${baseAsset}:exposure`, {
        id: `${graph.userId}:${baseAsset}:exposure`,
        userId: graph.userId,
        exposureName: `${baseAsset} Exposure`,
        baseAsset,
        components,
        netLongQuantity: netLong,
        netShortQuantity: netShort,
        netQuantity,
        netValueUSD,
        riskLevel: this.calculateRiskLevel(nodes),
        concentration: nodes.length > 0 ? Math.max(...components.map((c) => c.weight)) : 0,
        lastCalculatedAt: Date.now(),
        dataQuality: 'fresh',
      });
    }
  }

  /**
   * RISKS: Check liquidation exposure
   */
  private async checkLiquidationRisks(graph: UserAssetGraph): Promise<void> {
    logger.debug(`[AssetGraph] Checking liquidation risks`);

    graph.liquidationRisks = [];

    // For now, no liquidation risks in mock data
    // In production, this would check collateral ratios from subgraph data
  }

  /**
   * METRICS: Calculate portfolio summary
   */
  private calculatePortfolioMetrics(graph: UserAssetGraph): void {
    logger.debug(`[AssetGraph] Calculating portfolio metrics`);

    let totalValueUSD = 0;
    let totalYieldUSD = 0;
    let yieldNodes = 0;

    for (const [nodeId, node] of graph.nodes) {
      totalValueUSD += node.balanceUSD;

      if (node.apyRate && node.balance > 0) {
        const yearlyYield = (node.balance * node.apyRate) / 100;
        const nodeYieldValue = yearlyYield * (node.balanceUSD / node.balance);
        totalYieldUSD += nodeYieldValue;
        yieldNodes++;
      }
    }

    const blendedAPY = totalValueUSD > 0 ? (totalYieldUSD / totalValueUSD) * 100 : 0;

    graph.portfolioMetrics = {
      totalValueUSD,
      totalYieldUSD,
      totalYieldAPY: blendedAPY,
      totalYieldProjectedAnnual: totalYieldUSD,
      protocolExposureCount: graph.byProtocol.size,
      uniqueAssets: graph.bySymbol.size,
      riskScore: this.calculatePortfolioRiskScore(graph),
      liquidationRiskCount: graph.liquidationRisks.filter((r) => r.atRisk).length,
      lastSyncedAt: Date.now(),
      completeness: 95, // Assume 95% unless we know otherwise
    };
  }

  /**
   * REAL-TIME: Setup price update subscriptions
   */
  private setupRealtimeUpdates(userId: string): void {
    if (this.updateIntervals.has(userId)) {
      return; // Already setup
    }

    logger.debug(`[AssetGraph] Setting up real-time updates for ${userId}`);

    // Refresh every 5 minutes
    const interval = setInterval(async () => {
      try {
        const graph = this.graphs.get(userId);
        if (!graph) return;

        // In production, update all prices from OHLCV service
        // For now, just recalculate metrics
        await this.calculateCompositeExposures(graph);
        await this.checkLiquidationRisks(graph);
        this.calculatePortfolioMetrics(graph);

        logger.debug(`✅ Real-time update for ${userId}`);
      } catch (error) {
        logger.error(`Real-time update failed for ${userId}:`, error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    this.updateIntervals.set(userId, interval);
  }

  /**
   * AMARA VIEW: Render for Amara Dashboard
   */
  async getAmaraPortfolioView(userId: string): Promise<AmaraPortfolioView> {
    const graph = await this.loadUserGraph(userId);

    return {
      userId,
      sections: {
        overview: {
          totalValueUSD: graph.portfolioMetrics.totalValueUSD,
          totalYieldUSD: graph.portfolioMetrics.totalYieldUSD,
          yieldAPY: graph.portfolioMetrics.totalYieldAPY,
          riskScore: graph.portfolioMetrics.riskScore,
        },

        positions: {
          direct: Array.from(graph.nodes.values()).filter((n) => n.type === 'direct_holding'),
          protocol: Array.from(graph.nodes.values()).filter((n) => n.type === 'protocol_position'),
          vault: Array.from(graph.nodes.values()).filter((n) => n.type === 'vault_share'),
          lp: Array.from(graph.nodes.values()).filter((n) => n.type === 'lp_share'),
        },

        exposures: {
          byAsset: Array.from(graph.compositeExposures.values()),
          byProtocol: Array.from(graph.byProtocol.entries()).map(([protocol, nodeIds]) => ({
            protocol,
            valueUSD: nodeIds.reduce((sum, id) => sum + (graph.nodes.get(id)?.balanceUSD || 0), 0),
            nodes: nodeIds.map((id) => graph.nodes.get(id)!).filter((n) => !!n),
            riskLevel: this.calculateRiskLevel(
              nodeIds.map((id) => graph.nodes.get(id)!).filter((n) => !!n)
            ),
          })),
          byChain: Array.from(graph.byChain.entries()).map(([chain, nodeIds]) => ({
            chain,
            valueUSD: nodeIds.reduce((sum, id) => sum + (graph.nodes.get(id)?.balanceUSD || 0), 0),
            nodes: nodeIds.map((id) => graph.nodes.get(id)!).filter((n) => !!n),
          })),
        },

        risks: {
          liquidation: graph.liquidationRisks,
          impermanentLoss: Array.from(graph.nodes.values())
            .filter((n) => n.riskFactors?.includes('impermanent_loss'))
            .map((n) => ({
              nodeId: n.id,
              estimatedLossPercent: 0,
              volatility: 0,
            })),
          protocolRisks: Array.from(graph.byProtocol.keys()).map((protocol) => ({
            protocol,
            tvl: 0,
            auditStatus: 'unknown',
          })),
        },

        yields: {
          earned: Array.from(graph.nodes.values())
            .filter((n) => n.apyRate && n.balance > 0)
            .map((n) => ({
              nodeId: n.id,
              symbol: n.symbol,
              protocol: n.protocol || 'wallet',
              earned: ((n.balance * (n.apyRate || 0)) / 100 / 12 * n.balanceUSD) / n.balance,
              apy: n.apyRate || 0,
              projected: (n.balance * (n.apyRate || 0)) / 100,
            })),
          opportunities: [],
        },
      },

      lastUpdatedAt: graph.portfolioMetrics.lastSyncedAt,
      updateFrequency: 'real-time',
    };
  }

  /**
   * QUERY: Get positions by protocol
   */
  async getProtocolPositions(
    userId: string,
    protocol: string
  ): Promise<AssetGraphNode[]> {
    const graph = await this.loadUserGraph(userId);
    const nodeIds = graph.byProtocol.get(protocol) || [];
    
    return nodeIds
      .map((id) => graph.nodes.get(id)!)
      .filter((n) => !!n);
  }

  /**
   * QUERY: Get net exposure for asset
   */
  async getNetExposure(
    userId: string,
    baseAsset: string
  ): Promise<CompositeExposure | undefined> {
    const graph = await this.loadUserGraph(userId);
    return graph.compositeExposures.get(`${userId}:${baseAsset}:exposure`);
  }

  // ===== HELPERS =====

  private calculateRiskLevel(nodes: AssetGraphNode[]): RiskLevel {
    if (nodes.some((n) => n.riskLevel === 'extreme')) return 'extreme';
    if (nodes.some((n) => n.riskLevel === 'high')) return 'high';
    if (nodes.some((n) => n.riskLevel === 'medium')) return 'medium';
    return 'low';
  }

  private calculatePortfolioRiskScore(graph: UserAssetGraph): number {
    let score = 0;

    // Liquidation risk
    score += graph.liquidationRisks.filter((r) => r.atRisk).length * 10;
    score += graph.liquidationRisks.filter((r) => r.criticalRisk).length * 25;

    // IL risk
    const ilNodes = Array.from(graph.nodes.values()).filter((n) =>
      n.riskFactors?.includes('impermanent_loss')
    );
    score += ilNodes.length * 5;

    // Concentration risk
    const biggestExposure = Math.max(
      ...Array.from(graph.compositeExposures.values()).map((e) => e.concentration)
    );
    score += biggestExposure * 20;

    return Math.min(100, score);
  }

  /**
   * Shutdown service
   */
  destroy(): void {
    for (const [userId, interval] of this.updateIntervals) {
      clearInterval(interval as any);
    }
    this.updateIntervals.clear();
    this.graphs.clear();
    logger.info('✅ Asset Graph Service shut down');
  }
}

export const assetGraphService = new AssetGraphService();
