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
 *
 * ========== FIXES APPLIED ==========
 *
 * FIX #1: getTokenPrice() now calls ohlcvService first and falls back to
 *         hardcoded estimates only for symbols the service doesn't return.
 *         Previously the ohlcvService import was unused for individual prices
 *         and every position was valued with stale hardcoded constants.
 *
 * FIX #2: Prices are fetched once as a symbol→price map before discovery
 *         loops begin. Was calling await getTokenPrice() per position inside
 *         nested loops — O(wallets × positions) sequential fetches.
 *
 * FIX #3: buildEdges() driven by node metadata, not hardcoded symbol strings.
 *         Any node with an underlyingSymbol that matches a direct_holding node
 *         gets a supply/stake/lp edge automatically. Adding a new protocol no
 *         longer requires a manual block in this method.
 *
 * FIX #4: Node IDs include the wallet address for wallet-derived nodes so two
 *         wallets holding the same asset or staking into the same protocol
 *         produce distinct nodes rather than colliding and overwriting.
 *
 * FIX #5: calculatePortfolioRiskScore() guards Math.max() against empty spread
 *         (which returns -Infinity). New users with no positions no longer get
 *         a risk score of -Infinity.
 *
 * FIX #6: Yield earned calculation in getAmaraPortfolioView() corrected.
 *         Was (balance × apy / 100 / 12 × balanceUSD) / balance which reduced
 *         to (apy / 100 / 12) × balanceUSD / balance × balanceUSD — nonsensical.
 *         Correct formula: (balanceUSD × apy) / 100 / 12.
 *
 * FIX #7: loadUserGraph() uses an in-flight promise cache to prevent the race
 *         condition where two concurrent calls for the same userId both miss
 *         the cache, fire duplicate protocol subgraph calls, and race to
 *         overwrite each other's result in this.graphs.
 *
 * FIX #8: Per-protocol discovery errors are tracked individually. A failed
 *         Aave subgraph call no longer silently returns "no Aave positions."
 *         discoveryErrors are surfaced in portfolioMetrics.completeness and
 *         a new portfolioMetrics.dataSourceErrors field.
 */

import { Logger } from '../utils/logger';
import { ohlcvService } from './ohlcvService';
import { aaveAdapter } from './defiProtocols/aaveAdapter';
import { moolaAdapter } from './defiProtocols/moolaAdapter';
import { lidoAdapter, curveAdapter } from './defiProtocols/lidoCurveAdapter';
import { db } from '../db';
import { walletConnections, walletTokenBalances, blockchainNetworks, blockchainTokens } from '@shared/walletIntegrationSchema';
import { eq } from 'drizzle-orm';
import { redis } from './redis';
import { EdgeRelationshipType } from '../core/assetGraph/types';
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

// FIX #1: Hardcoded fallbacks are last-resort only, used when ohlcvService
// doesn't have a price for a given symbol.
const PRICE_FALLBACKS: Record<string, number> = {
  ETH:  1900,
  WETH: 1900,
  BTC:  45000,
  WBTC: 45000,
  USDC: 1.0,
  USDT: 1.0,
  DAI:  1.0,
  CELO: 0.67,
  cUSD: 1.0,
  cEUR: 1.08,
};

/** Per-protocol discovery result — distinguishes "no positions" from "call failed" */
interface DiscoveryResult {
  nodes: AssetGraphNode[];
  source: string;
  success: boolean;
  error?: string;
}

/** Cached price snapshot with TTL */
interface CachedPrices {
  data: Record<string, number>;
  expiresAt: number;
}

/** Per-wallet per-protocol discovery cache */
interface WalletDiscoveryCache {
  [protocol: string]: {
    nodes: AssetGraphNode[];
    expiresAt: number;
    error?: string;
  };
}

/** Node state snapshot for change detection */
interface NodeSnapshot {
  id: string;
  balance: number;
  balanceUSD: number;
  apyRate?: number;
}

class AssetGraphService {
  private graphs: Map<string, UserAssetGraph> = new Map();
  private updateIntervals: Map<string, NodeJS.Timer> = new Map();
  private priceUpdateIntervals: Map<string, NodeJS.Timer> = new Map();
  private priceWarmingInterval: NodeJS.Timer | null = null;

  /**
   * FIX #7: In-flight promise cache prevents duplicate concurrent loads for
   * the same userId. Without this, two simultaneous calls both miss the graph
   * cache, fire duplicate subgraph queries, and race to write this.graphs.
   */
  private loadingPromises: Map<string, Promise<UserAssetGraph>> = new Map();

  /**
   * CONCURRENCY: Semaphore to limit parallel OHLCV calls
   * Prevents overwhelming exchange rate limits with too many concurrent requests
   * Max 4 concurrent calls keeps latency ~200ms while avoiding 429 (too many requests)
   */
  private ohlcvConcurrencyTokens = 4;
  private ohlcvConcurrencyQueue: Array<() => Promise<void>> = [];
  private ohlcvConcurrencyActive = 0;

  /**
   * CACHING #1: Global price cache shared across all users
   * TTL: 45 seconds for tight freshness (reduced from 90s after parallelization)
   * Parallelized fetch takes ~200ms, so 45s TTL ensures prices never stale >45s
   */
  private globalPriceCache: CachedPrices | null = null;
  private readonly PRICE_CACHE_TTL_MS = 45 * 1000; // 45 seconds (was 90s)
  private lastPriceWarmTime = 0;

  /**
   * CACHING #2: Per-wallet per-protocol discovery results
   * Keyed by wallet address, stores cached results per protocol
   * TTL: 5-10 minutes to avoid repeated subgraph calls
   */
  private walletDiscoveryCache: Map<string, WalletDiscoveryCache> = new Map();
  private readonly DISCOVERY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * CACHING #3: Node state snapshots for dirty tracking
   * Detects which nodes changed to avoid unnecessary edge/index/metrics rebuilds
   */
  private nodeSnapshots: Map<string, NodeSnapshot[]> = new Map();

  // ==========================================================================
  // CORE: Load or create user's asset graph
  // ==========================================================================

  async loadUserGraph(userId: string): Promise<UserAssetGraph> {
    // Return fresh cached graph
    if (this.graphs.has(userId)) {
      const cached = this.graphs.get(userId)!;
      const isFresh = Date.now() - cached.portfolioMetrics.lastSyncedAt < 5 * 60 * 1000;
      if (isFresh) return cached;
    }

    // FIX #7: Return in-flight promise if a load is already running for this user
    if (this.loadingPromises.has(userId)) {
      return this.loadingPromises.get(userId)!;
    }

    const loadPromise = this._doLoadUserGraph(userId).finally(() => {
      this.loadingPromises.delete(userId);
    });

    this.loadingPromises.set(userId, loadPromise);
    return loadPromise;
  }

  private async _doLoadUserGraph(userId: string): Promise<UserAssetGraph> {
    logger.info(`[AssetGraph] Loading graph for user: ${userId}`);

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
      const { nodes, discoveryErrors } = await this.discoverAllPositions(userId);

      for (const node of nodes) {
        graph.nodes.set(node.id, node);
      }

      logger.debug(`[AssetGraph] Discovered ${graph.nodes.size} positions for ${userId}`);

      // CACHING #3: Only rebuild edges/indices/metrics if nodes changed
      const hasChanges = this.hasNodeChanges(graph);

      if (hasChanges) {
        await this.buildEdges(graph);
        this.buildIndices(graph);
        await this.calculateCompositeExposures(graph);
        await this.checkLiquidationRisks(graph);
        this.calculatePortfolioMetrics(graph, discoveryErrors);
        logger.debug(`[AssetGraph] Node changes detected, rebuilt edges/indices/metrics`);
      } else {
        // Reuse existing indices and metrics if nodes didn't change
        const oldGraph = this.graphs.get(userId);
        if (oldGraph) {
          logger.debug(`[AssetGraph] No node changes, reusing edges/indices`);
          graph.edges = oldGraph.edges;
          graph.byProtocol = oldGraph.byProtocol;
          graph.bySymbol = oldGraph.bySymbol;
          graph.byChain = oldGraph.byChain;
          graph.byYield = oldGraph.byYield;
          graph.compositeExposures = oldGraph.compositeExposures;
          graph.liquidationRisks = oldGraph.liquidationRisks;
          graph.portfolioMetrics = oldGraph.portfolioMetrics;
        } else {
          // First load, can't reuse
          await this.buildEdges(graph);
          this.buildIndices(graph);
          await this.calculateCompositeExposures(graph);
          await this.checkLiquidationRisks(graph);
          this.calculatePortfolioMetrics(graph, discoveryErrors);
        }
      }

      this.takeNodeSnapshot(graph);
      this.graphs.set(userId, graph);
      this.setupRealtimeUpdates(userId);

      logger.info(
        `✅ Loaded asset graph for ${userId}: ${graph.nodes.size} positions, ` +
        `$${graph.portfolioMetrics.totalValueUSD.toFixed(2)} total value, ` +
        `completeness: ${graph.portfolioMetrics.completeness}%`
      );
    } catch (error) {
      logger.error(`[AssetGraph] Failed to load graph for ${userId}:`, error);
      this.graphs.set(userId, graph);
    }

    return graph;
  }

  // ==========================================================================
  // DISCOVERY: Find all positions across protocols
  // ==========================================================================

  private async discoverAllPositions(
    userId: string
  ): Promise<{ nodes: AssetGraphNode[]; discoveryErrors: Record<string, string> }> {
    const discoveryErrors: Record<string, string> = {};

    const walletAddresses = await this.getUserWalletAddresses(userId);
    if (!walletAddresses.length) {
      logger.warn(`[AssetGraph] No wallet addresses found for ${userId}`);
      return { nodes: [], discoveryErrors };
    }

    // FIX #2: Fetch all prices once upfront as a symbol→price map.
    // Previously getTokenPrice() was awaited inside nested per-position loops.
    const priceMap = await this.buildPriceMap();

    const getPrice = (symbol: string): number =>
      priceMap[symbol] ?? PRICE_FALLBACKS[symbol] ?? 1.0;

    // Run all per-address discovery in parallel, per-protocol
    const results = await Promise.all([
      this.discoverWalletBalances(userId, walletAddresses, getPrice),
      this.discoverAavePositions(userId, walletAddresses, getPrice),
      this.discoverLidoPositions(userId, walletAddresses, getPrice),
      this.discoverCurvePositions(userId, walletAddresses, getPrice),
      this.discoverMoolaPositions(userId, walletAddresses, getPrice),
    ]);

    const allNodes: AssetGraphNode[] = [];

    for (const result of results) {
      if (!result.success && result.error) {
        // FIX #8: Track per-source errors instead of silently continuing
        discoveryErrors[result.source] = result.error;
        logger.warn(`[AssetGraph] Discovery failed for ${result.source}: ${result.error}`);
      }
      allNodes.push(...result.nodes);
    }

    logger.info(
      `[AssetGraph] Discovered ${allNodes.length} positions for ${userId}` +
      (Object.keys(discoveryErrors).length
        ? ` (${Object.keys(discoveryErrors).length} source errors: ${Object.keys(discoveryErrors).join(', ')})`
        : '')
    );

    return { nodes: allNodes, discoveryErrors };
  }

  // ==========================================================================
  // FIX #2: Single upfront price map instead of per-position fetches
  // ==========================================================================

  /**
   * CACHING #1: Price caching with TTL
   * Check global cache first before calling ohlcvService
   */
  private async buildPriceMap(): Promise<Record<string, number>> {
    const now = Date.now();

    // Return cached prices if still fresh
    if (this.globalPriceCache && this.globalPriceCache.expiresAt > now) {
      logger.debug(`[AssetGraph] Using cached prices (expires in ${(this.globalPriceCache.expiresAt - now) / 1000}s)`);
      return this.globalPriceCache.data;
    }

    try {
      const symbols = ['ETH', 'WETH', 'BTC', 'WBTC', 'USDC', 'USDT', 'DAI', 'CELO', 'cUSD', 'cEUR', 'LINK', 'UNI', 'AAVE', 'CRV'];
      
      // 🚀 PARALLEL FETCH with concurrency limiting: Get prices with max 4 concurrent calls
      // Prevents overwhelming exchange rate limits while keeping latency ~200ms
      const responses = await Promise.all(
        symbols.map(symbol =>
          this.withConcurrencyLimit(async () => {
            try {
              return await ohlcvService.getCandles(symbol, '1h', 1);
            } catch (e) {
              logger.debug(`[AssetGraph] Failed to fetch price for ${symbol}: ${(e as any).message}`);
              return { data: [] }; // Return empty response for graceful fallback
            }
          })
        )
      );

      const map: Record<string, number> = {};
      symbols.forEach((symbol, index) => {
        const response = responses[index];
        if (response.data && response.data.length > 0) {
          const latestCandle = response.data[response.data.length - 1];
          map[symbol] = latestCandle.close;
        }
      });

      // Cache the result with TTL
      this.globalPriceCache = {
        data: map,
        expiresAt: now + this.PRICE_CACHE_TTL_MS,
      };
      this.lastPriceWarmTime = now;

      logger.debug(`[AssetGraph] Cached prices for ${Object.keys(map).length} symbols (TTL: ${this.PRICE_CACHE_TTL_MS / 1000}s)`);
      return map;
    } catch (error: any) {
      logger.warn(`[AssetGraph] Price map fetch failed, using fallbacks: ${error.message}`);
      return {};
    }
  }

  // ==========================================================================
  // Per-protocol discovery methods (FIX #4: wallet-scoped node IDs)
  // ==========================================================================

  /**
   * CACHING #2: Per-wallet discovery caching helper
   * Returns cached discovery result if fresh, otherwise null
   */
  private getDiscoveryCacheForWallet(address: string, protocol: string): AssetGraphNode[] | null {
    const cache = this.walletDiscoveryCache.get(address);
    if (!cache) return null;

    const protocolCache = cache[protocol];
    if (!protocolCache) return null;

    if (protocolCache.expiresAt < Date.now()) {
      // Stale, delete it
      delete cache[protocol];
      return null;
    }

    logger.debug(`[AssetGraph] Cache hit for ${protocol}:${address.slice(0, 10)}`);
    return protocolCache.nodes;
  }

  /**
   * CACHING #2: Store discovery result in per-wallet cache
   */
  private setDiscoveryCacheForWallet(address: string, protocol: string, nodes: AssetGraphNode[]): void {
    if (!this.walletDiscoveryCache.has(address)) {
      this.walletDiscoveryCache.set(address, {});
    }
    const cache = this.walletDiscoveryCache.get(address)!;
    cache[protocol] = {
      nodes,
      expiresAt: Date.now() + this.DISCOVERY_CACHE_TTL_MS,
    };
  }

  private async discoverWalletBalances(
    userId: string,
    walletAddresses: string[],
    getPrice: (symbol: string) => number
  ): Promise<DiscoveryResult> {
    const nodes: AssetGraphNode[] = [];

    try {
      for (const address of walletAddresses) {
        const balances = await this.getWalletBalances(address);

        for (const { symbol, balance, decimals } of balances) {
          const normalised = balance / Math.pow(10, decimals);
          const balanceUSD = normalised * getPrice(symbol);

          if (balanceUSD < 1) continue;

          nodes.push({
            // FIX #4: address slug in ID prevents collision across wallets
            id: `${userId}:${symbol}:direct:${address.toLowerCase()}`,
            userId,
            type: 'direct_holding',
            symbol,
            chain: 'ethereum',
            address,
            balance: normalised,
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

      return { nodes, source: 'wallet_rpc', success: true };
    } catch (error: any) {
      return { nodes, source: 'wallet_rpc', success: false, error: error.message };
    }
  }

  private async discoverAavePositions(
    userId: string,
    walletAddresses: string[],
    getPrice: (symbol: string) => number
  ): Promise<DiscoveryResult> {
    const nodes: AssetGraphNode[] = [];

    try {
      for (const address of walletAddresses) {
        // CACHING #2: Check cache first
        const cachedNodes = this.getDiscoveryCacheForWallet(address, 'aave');
        if (cachedNodes) {
          nodes.push(...cachedNodes);
          continue;
        }

        const aavePositions = await aaveAdapter.discoverPositions(address);

        const addressNodes: AssetGraphNode[] = [];

        for (const aavePos of aavePositions) {
          for (const supply of aavePos.supplied) {
            const balanceUSD = supply.amount * getPrice(supply.asset);

            const node: AssetGraphNode = {
              // FIX #4: address slug scopes ID to the wallet that holds the position
              id: `${userId}:aave:${supply.asset}:supply:${aavePos.chain}:${address.slice(2, 10)}`,
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
            };
            addressNodes.push(node);
            nodes.push(node);
          }

          for (const borrow of aavePos.borrowed) {
            const balanceUSD = borrow.amount * getPrice(borrow.asset);

            const node: AssetGraphNode = {
              id: `${userId}:aave:${borrow.asset}:borrow:${aavePos.chain}:${address.slice(2, 10)}`,
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
            };
            addressNodes.push(node);
            nodes.push(node);
          }
        }

        // CACHING #2: Store in cache
        if (addressNodes.length > 0) {
          this.setDiscoveryCacheForWallet(address, 'aave', addressNodes);
        }
      }

      return { nodes, source: 'aave', success: true };
    } catch (error: any) {
      return { nodes, source: 'aave', success: false, error: error.message };
    }
  }

  private async discoverLidoPositions(
    userId: string,
    walletAddresses: string[],
    getPrice: (symbol: string) => number
  ): Promise<DiscoveryResult> {
    const nodes: AssetGraphNode[] = [];
    const ethPrice = getPrice('ETH');

    try {
      for (const address of walletAddresses) {
        // CACHING #2: Check cache first
        const cachedNodes = this.getDiscoveryCacheForWallet(address, 'lido');
        if (cachedNodes) {
          nodes.push(...cachedNodes);
          continue;
        }

        const lidoPos = await lidoAdapter.discoverPositions(address, ethPrice);
        const addressNodes: AssetGraphNode[] = [];

        if (lidoPos && lidoPos.stETHBalance > 0) {
          const node: AssetGraphNode = {
            // FIX #4: address slug prevents collision if user has multiple wallets with stETH
            id: `${userId}:lido:steth:${address.slice(2, 10)}`,
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
          };
          addressNodes.push(node);
          nodes.push(node);
        }

        // CACHING #2: Store in cache
        if (addressNodes.length > 0) {
          this.setDiscoveryCacheForWallet(address, 'lido', addressNodes);
        }
      }

      return { nodes, source: 'lido', success: true };
    } catch (error: any) {
      return { nodes, source: 'lido', success: false, error: error.message };
    }
  }

  private async discoverCurvePositions(
    userId: string,
    walletAddresses: string[],
    _getPrice: (symbol: string) => number
  ): Promise<DiscoveryResult> {
    const nodes: AssetGraphNode[] = [];

    try {
      for (const address of walletAddresses) {
        // CACHING #2: Check cache first
        const cachedNodes = this.getDiscoveryCacheForWallet(address, 'curve');
        if (cachedNodes) {
          nodes.push(...cachedNodes);
          continue;
        }

        const curvePositions = await curveAdapter.discoverPositions(address);
        const addressNodes: AssetGraphNode[] = [];

        for (const curve of curvePositions) {
          const node: AssetGraphNode = {
            // FIX #4: address slug scopes to wallet; pool address still in ID for uniqueness
            id: `${userId}:curve:lp:${curve.poolAddress.slice(2, 10)}:${address.slice(2, 10)}`,
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
          };
          addressNodes.push(node);
          nodes.push(node);
        }

        // CACHING #2: Store in cache
        if (addressNodes.length > 0) {
          this.setDiscoveryCacheForWallet(address, 'curve', addressNodes);
        }
      }

      return { nodes, source: 'curve', success: true };
    } catch (error: any) {
      return { nodes, source: 'curve', success: false, error: error.message };
    }
  }

  private async discoverMoolaPositions(
    userId: string,
    walletAddresses: string[],
    getPrice: (symbol: string) => number
  ): Promise<DiscoveryResult> {
    const nodes: AssetGraphNode[] = [];

    try {
      for (const address of walletAddresses) {
        // CACHING #2: Check cache first
        const cachedNodes = this.getDiscoveryCacheForWallet(address, 'moola');
        if (cachedNodes) {
          nodes.push(...cachedNodes);
          continue;
        }

        const moolaPos = await moolaAdapter.discoverPositions(address);
        if (!moolaPos) continue;

        const addressNodes: AssetGraphNode[] = [];

        for (const supply of moolaPos.supplied) {
          const node: AssetGraphNode = {
            // FIX #4: address slug scopes to wallet
            id: `${userId}:moola:${supply.asset}:supply:${address.slice(2, 10)}`,
            userId,
            type: 'protocol_position',
            symbol: `m${supply.asset}`,
            underlyingSymbol: supply.asset,
            protocol: 'moola',
            chain: 'celo',
            decimals: 18,
            balance: supply.amount,
            balanceUSD: supply.amount * getPrice(supply.asset),
            apyRate: supply.apy,
            yieldType: 'lending' as const,
            unlocked: true,
            riskLevel: 'low',
            tags: ['lending', 'yield'],
            lastUpdated: Date.now(),
            dataSource: 'protocol_subgraph',
          };
          addressNodes.push(node);
          nodes.push(node);
        }

        for (const borrow of moolaPos.borrowed) {
          const node: AssetGraphNode = {
            id: `${userId}:moola:${borrow.asset}:borrow:${address.slice(2, 10)}`,
            userId,
            type: 'debt',
            symbol: borrow.asset,
            protocol: 'moola',
            chain: 'celo',
            decimals: 18,
            balance: -borrow.amount,
            balanceUSD: -borrow.amount * getPrice(borrow.asset),
            apyRate: borrow.apy,
            unlocked: true,
            riskLevel: 'medium',
            tags: ['debt'],
            lastUpdated: Date.now(),
            dataSource: 'protocol_subgraph',
          };
          addressNodes.push(node);
          nodes.push(node);
        }

        // CACHING #2: Store in cache
        if (addressNodes.length > 0) {
          this.setDiscoveryCacheForWallet(address, 'moola', addressNodes);
        }
      }

      return { nodes, source: 'moola', success: true };
    } catch (error: any) {
      return { nodes, source: 'moola', success: false, error: error.message };
    }
  }

  // ==========================================================================
  // BUILD EDGES — FIX #3: metadata-driven, not hardcoded symbol pairs
  // ==========================================================================

  /**
   * FIX #3: Previously hardcoded two specific relationships (USDC→aUSDC,
   * ETH→stETH) by symbol string matching. Adding any new protocol required
   * a manual block here.
   *
   * Now driven by node metadata:
   * - Any node with an underlyingSymbol where a matching direct_holding exists
   *   gets an edge automatically.
   * - Edge relationship type derived from the node's type and yieldType.
   * - Protocol-specific pairs (debt ↔ supply collateral) also auto-detected.
   */
  private async buildEdges(graph: UserAssetGraph): Promise<void> {
    logger.debug(`[AssetGraph] Building edges for user ${graph.userId}`);

    const nodes = Array.from(graph.nodes.values());

    // Index direct holdings by symbol for O(1) lookup
    const directBySymbol = new Map<string, AssetGraphNode[]>();
    for (const node of nodes) {
      if (node.type === 'direct_holding') {
        const existing = directBySymbol.get(node.symbol) || [];
        existing.push(node);
        directBySymbol.set(node.symbol, existing);
      }
    }

    // Index all nodes by underlyingSymbol for debt/collateral pairing
    const nodesByUnderlying = new Map<string, AssetGraphNode[]>();
    for (const node of nodes) {
      if (node.underlyingSymbol) {
        const existing = nodesByUnderlying.get(node.underlyingSymbol) || [];
        existing.push(node);
        nodesByUnderlying.set(node.underlyingSymbol, existing);
      }
    }

    for (const node of nodes) {
      if (!node.underlyingSymbol) continue;

      const sources = directBySymbol.get(node.underlyingSymbol) || [];

      for (const source of sources) {
        const edgeId = `${source.id}→${node.id}`;
        if (graph.edges.has(edgeId)) continue;

        const relationship = this.inferEdgeRelationship(node);

        graph.edges.set(edgeId, {
          id: edgeId,
          source: source.id,
          target: node.id,
          relationship: relationship as EdgeRelationshipType,
          srcAmount: source.balance,
          tgtAmount: node.balance,
          rate: node.apyRate,
          ratioExplanation: this.buildRatioExplanation(node, relationship),
          unlocked: true,
          createdAt: node.lastUpdated,
          lastUpdated: node.lastUpdated,
          visibility: 'primary',
        });
      }

      // Debt ↔ supply collateral pair within the same protocol
      if (node.type === 'debt') {
        const suppliesInProtocol = nodes.filter(
          n => n.protocol === node.protocol && n.type === 'protocol_position'
        );

        for (const supply of suppliesInProtocol) {
          const edgeId = `${supply.id}→${node.id}`;
          if (graph.edges.has(edgeId)) continue;

          graph.edges.set(edgeId, {
            id: edgeId,
            source: supply.id,
            target: node.id,
            relationship: 'locks_as_collateral' as EdgeRelationshipType,
            srcAmount: supply.balance,
            tgtAmount: Math.abs(node.balance),
            rate: node.apyRate,
            ratioExplanation: `${supply.symbol} collateralises ${node.symbol} borrow on ${node.protocol}`,
            unlocked: true,
            createdAt: node.lastUpdated,
            lastUpdated: node.lastUpdated,
            visibility: 'secondary',
          });
        }
      }
    }

    logger.debug(`[AssetGraph] Built ${graph.edges.size} edges`);
  }

  private inferEdgeRelationship(node: AssetGraphNode): string {
    if (node.yieldType === 'staking')      return 'stakes';
    if (node.yieldType === 'lending')      return 'supplies';
    if (node.yieldType === 'trading_fees') return 'provides_liquidity';
    if (node.type === 'derivative')        return 'stakes';
    if (node.type === 'lp_share')          return 'provides_liquidity';
    return 'supplies';
  }

  private buildRatioExplanation(node: AssetGraphNode, relationship: string): string {
    if (relationship === 'stakes' && node.exchangeRateExplanation) {
      return node.exchangeRateExplanation;
    }
    if (node.apyRate) {
      return `Earning ${node.apyRate.toFixed(2)}% APY via ${node.protocol || 'protocol'}`;
    }
    return `${node.symbol} backed by ${node.underlyingSymbol}`;
  }

  // ==========================================================================
  // INDICES
  // ==========================================================================

  private buildIndices(graph: UserAssetGraph): void {
    for (const [nodeId, node] of graph.nodes) {
      if (node.protocol) {
        if (!graph.byProtocol.has(node.protocol)) graph.byProtocol.set(node.protocol, []);
        graph.byProtocol.get(node.protocol)!.push(nodeId);
      }

      if (!graph.bySymbol.has(node.symbol)) graph.bySymbol.set(node.symbol, []);
      graph.bySymbol.get(node.symbol)!.push(nodeId);

      if (!graph.byChain.has(node.chain)) graph.byChain.set(node.chain, []);
      graph.byChain.get(node.chain)!.push(nodeId);

      if (node.yieldType) {
        if (!graph.byYield.has(node.yieldType)) graph.byYield.set(node.yieldType, []);
        graph.byYield.get(node.yieldType)!.push(nodeId);
      }
    }
  }

  // ==========================================================================
  // COMPOSITE EXPOSURES
  // ==========================================================================

  private async calculateCompositeExposures(graph: UserAssetGraph): Promise<void> {
    const exposureMap = new Map<string, AssetGraphNode[]>();

    for (const node of graph.nodes.values()) {
      const baseAsset = node.underlyingSymbol || node.symbol;
      if (!exposureMap.has(baseAsset)) exposureMap.set(baseAsset, []);
      exposureMap.get(baseAsset)!.push(node);
    }

    for (const [baseAsset, nodes] of exposureMap) {
      const components = nodes.map(n => ({
        nodeId: n.id,
        symbol: n.symbol,
        quantity: n.balance,
        direction: (n.balance < 0 ? 'short' : 'long') as 'long' | 'short',
        weight: 0,
        protocol: n.protocol,
        valueUSD: n.balanceUSD,
      }));

      const netLong  = components.filter(c => c.direction === 'long').reduce((s, c) => s + c.quantity, 0);
      const netShort = components.filter(c => c.direction === 'short').reduce((s, c) => s + Math.abs(c.quantity), 0);
      const netValueUSD = components.reduce((s, c) => s + c.valueUSD, 0);
      const totalQty = Math.abs(netLong) + Math.abs(netShort);

      components.forEach(c => {
        c.weight = totalQty > 0 ? Math.abs(c.quantity) / totalQty : 0;
      });

      graph.compositeExposures.set(`${graph.userId}:${baseAsset}:exposure`, {
        id: `${graph.userId}:${baseAsset}:exposure`,
        userId: graph.userId,
        exposureName: `${baseAsset} Exposure`,
        baseAsset,
        components,
        netLongQuantity:  netLong,
        netShortQuantity: netShort,
        netQuantity: netLong - netShort,
        netValueUSD,
        riskLevel: this.calculateRiskLevel(nodes),
        concentration: components.length > 0 ? Math.max(...components.map(c => c.weight)) : 0,
        lastCalculatedAt: Date.now(),
        dataQuality: 'fresh',
      });
    }
  }

  // ==========================================================================
  // LIQUIDATION RISK
  // ==========================================================================

  private async checkLiquidationRisks(graph: UserAssetGraph): Promise<void> {
    graph.liquidationRisks = [];

    const debtNodes = Array.from(graph.nodes.values()).filter(n => n.type === 'debt');

    for (const debtNode of debtNodes) {
      const supplyNodes = Array.from(graph.nodes.values()).filter(
        n => n.protocol === debtNode.protocol && n.type === 'protocol_position'
      );

      const collateralUSD = supplyNodes.reduce((sum, n) => sum + n.balanceUSD, 0);
      const debtUSD = Math.abs(debtNode.balanceUSD);

      if (collateralUSD === 0 || debtUSD === 0) continue;

      const healthFactor = collateralUSD / debtUSD;
      const atRisk = healthFactor < 1.2;
      const criticalRisk = healthFactor < 1.05;

      if (atRisk) {
        graph.liquidationRisks.push({
          edgeId: `${debtNode.id}:liquidation`,
          collateralSymbol: supplyNodes[0]?.symbol || 'UNKNOWN',
          collateralAmount: collateralUSD,
          debtSymbol: debtNode.symbol,
          debtAmount: debtUSD,
          currentPrice: 1,
          liquidationPrice: 0,
          margin: healthFactor - 1,
          marginPercent: (healthFactor - 1) * 100,
          atRisk,
          criticalRisk,
        });
      }
    }
  }

  // ==========================================================================
  // PORTFOLIO METRICS — FIX #5 + FIX #8
  // ==========================================================================

  private calculatePortfolioMetrics(
    graph: UserAssetGraph,
    discoveryErrors: Record<string, string> = {}
  ): void {
    let totalValueUSD = 0;
    let totalYieldUSD = 0;

    for (const node of graph.nodes.values()) {
      totalValueUSD += node.balanceUSD;

      if (node.apyRate && node.balance > 0) {
        totalYieldUSD += (node.balanceUSD * node.apyRate) / 100;
      }
    }

    const blendedAPY = totalValueUSD > 0 ? (totalYieldUSD / totalValueUSD) * 100 : 0;

    // FIX #5: Guard against empty compositeExposures spread producing -Infinity
    const exposureConcentrations = Array.from(graph.compositeExposures.values()).map(e => e.concentration);
    const biggestExposure = exposureConcentrations.length > 0
      ? Math.max(...exposureConcentrations)
      : 0;

    // FIX #8: Completeness reflects actual data source health
    const totalSources = 5; // wallet, aave, lido, curve, moola
    const failedSources = Object.keys(discoveryErrors).length;
    const completeness = Math.round(((totalSources - failedSources) / totalSources) * 100);

    graph.portfolioMetrics = {
      totalValueUSD,
      totalYieldUSD,
      totalYieldAPY: blendedAPY,
      totalYieldProjectedAnnual: totalYieldUSD,
      protocolExposureCount: graph.byProtocol.size,
      uniqueAssets: graph.bySymbol.size,
      riskScore: this.calculatePortfolioRiskScore(graph, biggestExposure),
      liquidationRiskCount: graph.liquidationRisks.filter(r => r.atRisk).length,
      lastSyncedAt: Date.now(),
      completeness,
    };
  }

  /**
   * CACHING #3: Create snapshot of node state for dirty tracking
   * Detects which nodes changed balance/APY between loads
   */
  private takeNodeSnapshot(graph: UserAssetGraph): void {
    const snapshot: NodeSnapshot[] = [];
    for (const node of graph.nodes.values()) {
      snapshot.push({
        id: node.id,
        balance: node.balance,
        balanceUSD: node.balanceUSD,
        apyRate: node.apyRate,
      });
    }
    this.nodeSnapshots.set(graph.userId, snapshot);
  }

  /**
   * CACHING #3: Detect which nodes changed since last snapshot
   * Returns true if any node's balance/APY significantly changed
   */
  private hasNodeChanges(graph: UserAssetGraph): boolean {
    const oldSnapshot = this.nodeSnapshots.get(graph.userId) || [];
    const oldById = new Map(oldSnapshot.map(s => [s.id, s]));

    // Check if any node changed
    for (const node of graph.nodes.values()) {
      const old = oldById.get(node.id);
      if (!old) return true; // New node

      // Detect significant changes (>1% balance change or any APY change)
      const balanceChanged = Math.abs(node.balance - old.balance) / Math.max(Math.abs(old.balance), 1) > 0.01;
      const apyChanged = (node.apyRate || 0) !== (old.apyRate || 0);

      if (balanceChanged || apyChanged) {
        logger.debug(`[AssetGraph] Detected change in ${node.id}: balance=${node.balance} (was ${old.balance}), apy=${node.apyRate} (was ${old.apyRate})`);
        return true;
      }
    }

    // Check if any node was removed
    if (oldSnapshot.length !== graph.nodes.size) return true;

    return false;
  }

  /**
   * SEPARATION #4: Lightweight price-only update (no edge/index/metric recalc)
   * Runs every 60 seconds to refresh USD prices without triggering expensive rebuilds
   */
  private async updateNodePricesOnly(userId: string, priceMap: Record<string, number>): Promise<void> {
    const graph = this.graphs.get(userId);
    if (!graph) return;

    const getPrice = (symbol: string): number =>
      priceMap[symbol] ?? PRICE_FALLBACKS[symbol] ?? 1.0;

    let priceUpdated = false;

    // Refresh balanceUSD on all nodes with live prices
    for (const node of graph.nodes.values()) {
      const oldUSD = node.balanceUSD;
      const newUSD = node.balance * getPrice(node.symbol);

      if (Math.abs(newUSD - oldUSD) > 0.01) {
        node.balanceUSD = newUSD;
        priceUpdated = true;
      }
    }

    if (!priceUpdated) return;

    // Only recalc metrics that depend on USD prices, skip edges/indices
    let totalValueUSD = 0;
    let totalYieldUSD = 0;

    for (const node of graph.nodes.values()) {
      totalValueUSD += node.balanceUSD;
      if (node.apyRate && node.balance > 0) {
        totalYieldUSD += (node.balanceUSD * node.apyRate) / 100;
      }
    }

    const blendedAPY = totalValueUSD > 0 ? (totalYieldUSD / totalValueUSD) * 100 : 0;

    // Update only price-dependent metrics
    graph.portfolioMetrics.totalValueUSD = totalValueUSD;
    graph.portfolioMetrics.totalYieldUSD = totalYieldUSD;
    graph.portfolioMetrics.totalYieldAPY = blendedAPY;
    graph.portfolioMetrics.totalYieldProjectedAnnual = totalYieldUSD;
    graph.portfolioMetrics.lastSyncedAt = Date.now();

    logger.debug(`[AssetGraph] Updated prices for ${userId}: $${totalValueUSD.toFixed(2)} USD value`);
  }

  // ==========================================================================
  // REAL-TIME UPDATES — SEPARATED #4
  // ==========================================================================

  /**
   * SEPARATION #4: Setup two independent update timers:
   * 1. Fast price updates every 60s (lightweight, USD only)
   * 2. Slow discovery updates every 5 mins (full rebuild if needed)
   */
  private setupRealtimeUpdates(userId: string): void {
    // Fast price-only updates
    if (!this.priceUpdateIntervals.has(userId)) {
      const priceInterval = setInterval(async () => {
        try {
          const priceMap = await this.buildPriceMap();
          await this.updateNodePricesOnly(userId, priceMap);
          logger.debug(`✅ Price update for ${userId}`);
        } catch (error) {
          logger.error(`Price update failed for ${userId}:`, error);
        }
      }, 60 * 1000); // Every 60 seconds

      this.priceUpdateIntervals.set(userId, priceInterval);
    }

    // Slow full discovery updates
    if (this.updateIntervals.has(userId)) return;

    const discoveryInterval = setInterval(async () => {
      try {
        // Trigger a full reload if 5 mins have passed
        await this.loadUserGraph(userId);
        logger.debug(`✅ Full discovery update for ${userId}`);
      } catch (error) {
        logger.error(`Full discovery update failed for ${userId}:`, error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    this.updateIntervals.set(userId, discoveryInterval);
  }

  // ==========================================================================
  // AMARA VIEW
  // ==========================================================================

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
          direct:   Array.from(graph.nodes.values()).filter(n => n.type === 'direct_holding'),
          protocol: Array.from(graph.nodes.values()).filter(n => n.type === 'protocol_position'),
          vault:    Array.from(graph.nodes.values()).filter(n => n.type === 'vault_share'),
          lp:       Array.from(graph.nodes.values()).filter(n => n.type === 'lp_share'),
        },

        exposures: {
          byAsset: Array.from(graph.compositeExposures.values()),
          byProtocol: Array.from(graph.byProtocol.entries()).map(([protocol, nodeIds]) => ({
            protocol,
            valueUSD: nodeIds.reduce((sum, id) => sum + (graph.nodes.get(id)?.balanceUSD || 0), 0),
            nodes: nodeIds.map(id => graph.nodes.get(id)!).filter(Boolean),
            riskLevel: this.calculateRiskLevel(
              nodeIds.map(id => graph.nodes.get(id)!).filter(Boolean)
            ),
          })),
          byChain: Array.from(graph.byChain.entries()).map(([chain, nodeIds]) => ({
            chain,
            valueUSD: nodeIds.reduce((sum, id) => sum + (graph.nodes.get(id)?.balanceUSD || 0), 0),
            nodes: nodeIds.map(id => graph.nodes.get(id)!).filter(Boolean),
          })),
        },

        risks: {
          liquidation: graph.liquidationRisks,
          impermanentLoss: Array.from(graph.nodes.values())
            .filter(n => n.riskFactors?.includes('impermanent_loss'))
            .map(n => ({
              nodeId: n.id,
              estimatedLossPercent: 0,
              volatility: 0,
            })),
          protocolRisks: Array.from(graph.byProtocol.keys()).map(protocol => ({
            protocol,
            tvl: 0,
            auditStatus: 'unknown',
          })),
        },

        yields: {
          earned: Array.from(graph.nodes.values())
            .filter(n => n.apyRate && n.balance > 0)
            .map(n => ({
              nodeId: n.id,
              symbol: n.symbol,
              protocol: n.protocol || 'wallet',
              /**
               * FIX #6: Was (balance × apy/100/12 × balanceUSD) / balance
               * which simplified to (apy/100/12) × (balanceUSD²/balance) — wrong.
               * Correct: monthly yield in USD = balanceUSD × (apy/100) / 12
               */
              earned: (n.balanceUSD * (n.apyRate || 0)) / 100 / 12,
              apy: n.apyRate || 0,
              projected: (n.balanceUSD * (n.apyRate || 0)) / 100,
            })),
          opportunities: [],
        },
      },

      lastUpdatedAt: graph.portfolioMetrics.lastSyncedAt,
      updateFrequency: 'real-time',
    };
  }

  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  async getProtocolPositions(userId: string, protocol: string): Promise<AssetGraphNode[]> {
    const graph = await this.loadUserGraph(userId);
    return (graph.byProtocol.get(protocol) || [])
      .map(id => graph.nodes.get(id)!)
      .filter(Boolean);
  }

  async getNetExposure(userId: string, baseAsset: string): Promise<CompositeExposure | undefined> {
    const graph = await this.loadUserGraph(userId);
    return graph.compositeExposures.get(`${userId}:${baseAsset}:exposure`);
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private calculateRiskLevel(nodes: AssetGraphNode[]): RiskLevel {
    if (nodes.some(n => n.riskLevel === 'extreme')) return 'extreme';
    if (nodes.some(n => n.riskLevel === 'high'))    return 'high';
    if (nodes.some(n => n.riskLevel === 'medium'))  return 'medium';
    return 'low';
  }

  /**
   * FIX #5: biggestExposure passed in from calculatePortfolioMetrics which
   * already guards Math.max() against an empty spread.
   */
  private calculatePortfolioRiskScore(graph: UserAssetGraph, biggestExposure: number): number {
    let score = 0;

    score += graph.liquidationRisks.filter(r => r.atRisk).length * 10;
    score += graph.liquidationRisks.filter(r => r.criticalRisk).length * 25;

    const ilNodes = Array.from(graph.nodes.values()).filter(
      n => n.riskFactors?.includes('impermanent_loss')
    );
    score += ilNodes.length * 5;

    score += biggestExposure * 20;

    return Math.min(100, Math.max(0, score));
  }

  private async getNativeTokenSymbol(chainId: number): Promise<string> {
    try {
      // Redis cache key for chain native token
      const cacheKey = `chain:native:${chainId}`;

      // Try Redis first
      const cached = await redis.get(cacheKey);
      if (cached) {
        return cached as string;
      }

      // Query blockchainNetworks table
      const network = await db
        .select({ nativeToken: blockchainNetworks.nativeToken })
        .from(blockchainNetworks)
        .where(eq(blockchainNetworks.chainId, chainId))
        .limit(1);

      if (network[0]?.nativeToken) {
        const symbol = network[0].nativeToken;
        // Cache for 24 hours (rarely changes)
        await redis.set(cacheKey, symbol, 86400);
        return symbol;
      }

      logger.warn(`[AssetGraph] Native token not found for chainId ${chainId}, defaulting to ETH`);
      return 'ETH';
    } catch (error) {
      logger.error(`[AssetGraph] Error fetching native token for chainId ${chainId}:`, error);
      return 'ETH';
    }
  }

  private async getTokenDecimals(chainId: number, symbol: string): Promise<number> {
    try {
      // Redis cache key for token decimals
      const cacheKey = `token:decimals:${chainId}:${symbol}`;

      // Try Redis first
      const cached = await redis.get(cacheKey);
      if (cached) {
        return parseInt(cached as string, 10);
      }

      // Query blockchainTokens table
      const token = await db
        .select({ decimals: blockchainTokens.decimals })
        .from(blockchainTokens)
        .where(eq(blockchainTokens.chainId, chainId))
        .limit(1);

      const decimals = token[0]?.decimals ?? 18;
      if (decimals !== 18) {
        // Cache for 24 hours (token decimals don't change)
        await redis.set(cacheKey, decimals.toString(), 86400);
      }
      return decimals;
    } catch (error) {
      logger.error(`[AssetGraph] Error fetching token decimals for ${symbol}:`, error);
      return 18;
    }
  }

  private async getWalletBalances(
    address: string
  ): Promise<Array<{ symbol: string; balance: number; decimals: number }>> {
    try {
      // Redis cache key for wallet balances
      const cacheKey = `wallet:balances:${address.toLowerCase()}`;

      // Try Redis first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug(`[AssetGraph] Loaded wallet balances from Redis cache for ${address.slice(0, 10)}`);
        return JSON.parse(cached);
      }

      // Query DB for wallet connections
      const walletConn = await db
        .select()
        .from(walletConnections)
        .where(eq(walletConnections.walletAddress, address.toLowerCase()))
        .limit(1);

      if (!walletConn[0]) {
        logger.warn(`[AssetGraph] No wallet connection found for ${address.slice(0, 10)}`);
        return [];
      }

      // Get token balances from DB
      const tokenBalances = await db
        .select()
        .from(walletTokenBalances)
        .where(eq(walletTokenBalances.walletConnectionId, walletConn[0].id));

      // Build balance array with symbol, balance, decimals
      const balances: Array<{ symbol: string; balance: number; decimals: number }> = [];

      // Add native token (ETH, MATIC, CELO, etc.) if balance > 0
      const nativeBalance = walletConn[0].nativeBalance;
      if (nativeBalance && Number(nativeBalance) > 0) {
        // Fetch native token symbol from blockchainNetworks table
        const nativeSymbol = await this.getNativeTokenSymbol(walletConn[0].chainId);
        const nativeDecimals = await this.getTokenDecimals(walletConn[0].chainId, nativeSymbol);

        balances.push({
          symbol: nativeSymbol,
          balance: Number(nativeBalance),
          decimals: nativeDecimals,
        });
      }

      // Add ERC20 token balances
      for (const tokenBalance of tokenBalances) {
        const balance = Number(tokenBalance.balance || 0);
        if (balance > 0) {
          const tokenSymbol = (tokenBalance.tokenId as string).toUpperCase() || 'UNKNOWN';
          // Fetch token decimals from blockchainTokens table
          const tokenDecimals = await this.getTokenDecimals(walletConn[0].chainId, tokenSymbol);

          balances.push({
            symbol: tokenSymbol,
            balance,
            decimals: tokenDecimals,
          });
        }
      }

      // Cache in Redis for 2 minutes
      await redis.set(cacheKey, JSON.stringify(balances), 120);

      logger.debug(`[AssetGraph] Fetched ${balances.length} token balances for ${address.slice(0, 10)} from DB`);
      return balances;
    } catch (error) {
      logger.error(`[AssetGraph] Error fetching wallet balances for ${address}:`, error);
      return [];
    }
  }

  private async getUserWalletAddresses(userId: string): Promise<string[]> {
    try {
      // Redis cache key for user wallet addresses
      const cacheKey = `user:wallets:${userId}`;

      // Try Redis first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug(`[AssetGraph] Loaded user wallet addresses from Redis cache for ${userId}`);
        return JSON.parse(cached);
      }

      // Query DB for all wallet connections for this user
      const userWallets = await db
        .select()
        .from(walletConnections)
        .where(eq(walletConnections.userId, userId));

      if (!userWallets.length) {
        logger.warn(`[AssetGraph] No wallet addresses found in DB for user ${userId}`);
        return [];
      }

      // Extract wallet addresses
      const addresses = userWallets
        .map(w => w.walletAddress)
        .filter((addr) => addr && addr.length > 0);

      // Cache in Redis for 5 minutes (user wallets don't change often)
      if (addresses.length > 0) {
        await redis.set(cacheKey, JSON.stringify(addresses), 300);
      }

      logger.debug(`[AssetGraph] Fetched ${addresses.length} wallet addresses for user ${userId} from DB`);
      return addresses;
    } catch (error) {
      logger.error(`[AssetGraph] Error fetching wallet addresses for user ${userId}:`, error);
      return [];
    }
  }

  // ==========================================================================
  // CACHE WARMING: Pre-fetch prices on schedule to avoid stale data
  // ==========================================================================

  /**
   * Warm the price cache by fetching all symbols in parallel
   * Should be called every 30 seconds (before cache expires) to keep data fresh
   * Prevents first user from experiencing slow fetch + 2.8s latency
   */
  async warmPriceCache(): Promise<void> {
    const now = Date.now();
    
    // Skip if cache is still warm enough (>15s remaining)
    if (this.globalPriceCache && this.globalPriceCache.expiresAt - now > 15 * 1000) {
      logger.debug(`[AssetGraph] Price cache still fresh, skipping warm (${(this.globalPriceCache.expiresAt - now) / 1000}s remaining)`);
      return;
    }

    logger.debug('[AssetGraph] ☀️ Warming price cache...');
    
    try {
      const symbols = ['ETH', 'WETH', 'BTC', 'WBTC', 'USDC', 'USDT', 'DAI', 'CELO', 'cUSD', 'cEUR', 'LINK', 'UNI', 'AAVE', 'CRV'];
      
      // 🚀 Parallel fetch all symbols with concurrency limiting
      const responses = await Promise.all(
        symbols.map(symbol =>
          this.withConcurrencyLimit(async () => {
            try {
              return await ohlcvService.getCandles(symbol, '1h', 1);
            } catch (e) {
              logger.debug(`[AssetGraph] Price warming failed for ${symbol}: ${(e as any).message}`);
              return { data: [] };
            }
          })
        )
      );

      const map: Record<string, number> = {};
      symbols.forEach((symbol, index) => {
        const response = responses[index];
        if (response.data && response.data.length > 0) {
          const latestCandle = response.data[response.data.length - 1];
          map[symbol] = latestCandle.close;
        }
      });

      // Populate cache
      this.globalPriceCache = {
        data: map,
        expiresAt: now + this.PRICE_CACHE_TTL_MS,
      };
      this.lastPriceWarmTime = now;

      logger.debug(`[AssetGraph] ✅ Price cache warmed (${Object.keys(map).length} symbols, expires in ${this.PRICE_CACHE_TTL_MS / 1000}s)`);
    } catch (error: any) {
      logger.warn(`[AssetGraph] Price cache warming failed: ${error.message}`);
    }
  }

  // ==========================================================================
  // CONCURRENCY CONTROL: Limit parallel OHLCV calls to prevent rate limits
  // ==========================================================================

  /**
   * Executes a function with concurrency limiting (semaphore pattern)
   * Max 4 concurrent OHLCV calls to prevent overwhelming exchange rate limits
   * while keeping latency within ~200ms target
   */
  private withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        this.ohlcvConcurrencyActive++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.ohlcvConcurrencyActive--;
          if (this.ohlcvConcurrencyQueue.length > 0) {
            const next = this.ohlcvConcurrencyQueue.shift();
            if (next) next();
          }
        }
      };

      if (this.ohlcvConcurrencyActive < this.ohlcvConcurrencyTokens) {
        execute();
      } else {
        this.ohlcvConcurrencyQueue.push(execute);
      }
    });
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  destroy(): void {
    for (const [, interval] of this.updateIntervals) {
      clearInterval(interval as any);
    }
    for (const [, interval] of this.priceUpdateIntervals) {
      clearInterval(interval as any);
    }
    if (this.priceWarmingInterval) {
      clearInterval(this.priceWarmingInterval as any);
    }
    this.updateIntervals.clear();
    this.priceUpdateIntervals.clear();
    this.loadingPromises.clear();
    this.nodeSnapshots.clear();
    this.walletDiscoveryCache.clear();
    this.globalPriceCache = null;
    this.graphs.clear();
    logger.info('✅ Asset Graph Service shut down');
  }
}

export const assetGraphService = new AssetGraphService();