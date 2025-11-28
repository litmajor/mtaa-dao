/**
 * Central Gateway Service
 * Aggregates market data, gas prices, liquidity, volume, and routes
 * Serves as secure foundation for multi-chain operations
 */

import { EventEmitter } from 'events';
import {
  GatewayMarketSnapshot,
  GatewayRecommendation,
  GatewayQuoteRequest,
  GatewayQuoteResponse,
  GatewayHealthCheck,
  GatewayState,
  CacheEntry,
  TokenPrice,
  LiquidityInfo,
  GasPriceFeed,
  VolumeData,
  TransferRoute,
  GatewayEvent,
  SecurityAudit,
  RateLimitPolicy,
  Alert,
} from './types';

const CACHE_TTL = {
  PRICES: 60 * 1000, // 1 minute
  LIQUIDITY: 30 * 1000, // 30 seconds
  GAS: 15 * 1000, // 15 seconds
  VOLUME: 5 * 60 * 1000, // 5 minutes
  ROUTES: 2 * 60 * 1000, // 2 minutes
};

export class GatewayService extends EventEmitter {
  private state: GatewayState = {
    prices: new Map(),
    liquidity: new Map(),
    gasFeeds: new Map(),
    volume: new Map(),
    routes: new Map(),
  };

  private rateLimiter: Map<string, RateLimitPolicy> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private oracleHealthy: Map<string, boolean> = new Map();
  private bridgeHealthy: Map<string, boolean> = new Map();

  constructor(
    private priceProvider: any,
    private liquidityProvider: any,
    private gasProvider: any,
    private volumeProvider: any,
    private routeOptimizer: any,
    private securityValidator: any
  ) {
    super();
    this.initializeHealthChecks();
  }

  // ============================================================================
  // PRICE AGGREGATION
  // ============================================================================

  async getTokenPrice(token: string, chainId: number): Promise<TokenPrice | null> {
    const cacheKey = `${token}_${chainId}`;
    const cached = this.getCached<TokenPrice>(this.state.prices, cacheKey);
    if (cached) return cached;

    try {
      const price = await this.priceProvider.getPrice(token, chainId);
      this.setCached(this.state.prices, cacheKey, price, CACHE_TTL.PRICES);
      return price;
    } catch (error) {
      console.error(`Error fetching price for ${token}:`, error);
      return null;
    }
  }

  async getPricesForTokens(tokens: string[], chainId: number): Promise<Record<string, TokenPrice>> {
    const prices: Record<string, TokenPrice> = {};
    const results = await Promise.all(
      tokens.map(token => this.getTokenPrice(token, chainId))
    );

    tokens.forEach((token, index) => {
      if (results[index]) {
        prices[token] = results[index]!;
      }
    });

    return prices;
  }

  async getAggregatedPrice(
    token: string,
    chainId: number,
    sources?: string[]
  ): Promise<TokenPrice | null> {
    const prices = await Promise.all([
      this.priceProvider.getPrice(token, chainId, 'chainlink'),
      this.priceProvider.getPrice(token, chainId, 'uniswap'),
      this.priceProvider.getPrice(token, chainId, 'coingecko'),
    ]);

    const validPrices = prices.filter(p => p !== null);
    if (validPrices.length === 0) return null;

    // Weighted average with deviation check
    const avg = this.calculateWeightedAverage(validPrices);
    const deviation = this.calculateDeviation(validPrices, avg.price);

    if (deviation > 5) {
      this.emitAlert('price_deviation', 'warning', 
        `Price deviation of ${deviation}% for ${token} on chain ${chainId}`);
    }

    return {
      ...avg,
      source: 'aggregated',
      confidence: 1 - (deviation / 100),
    };
  }

  // ============================================================================
  // LIQUIDITY ANALYSIS
  // ============================================================================

  async getLiquidityInfo(
    tokenA: string,
    tokenB: string,
    chainId: number
  ): Promise<LiquidityInfo | null> {
    const cacheKey = `liq_${tokenA}_${tokenB}_${chainId}`;
    const cached = this.getCached<LiquidityInfo>(this.state.liquidity, cacheKey);
    if (cached) return cached;

    try {
      const liquidity = await this.liquidityProvider.getLiquidity(tokenA, tokenB, chainId);
      this.setCached(this.state.liquidity, cacheKey, liquidity, CACHE_TTL.LIQUIDITY);
      return liquidity;
    } catch (error) {
      console.error(`Error fetching liquidity:`, error);
      return null;
    }
  }

  async analyzeLiquidityDepth(
    tokenA: string,
    tokenB: string,
    chainId: number,
    amounts: string[]
  ): Promise<{ amount: string; slippage: number }[]> {
    const liquidity = await this.getLiquidityInfo(tokenA, tokenB, chainId);
    if (!liquidity) return [];

    return amounts.map(amount => ({
      amount,
      slippage: this.calculateSlippage(amount, liquidity),
    }));
  }

  async checkLiquidityHealth(
    tokenA: string,
    tokenB: string,
    chainId: number,
    minLiquidity: string
  ): Promise<{ healthy: boolean; available: string; deficit?: string }> {
    const liquidity = await this.getLiquidityInfo(tokenA, tokenB, chainId);
    if (!liquidity) {
      return { healthy: false, available: '0' };
    }

    const healthy = parseFloat(liquidity.liquidity) >= parseFloat(minLiquidity);
    return {
      healthy,
      available: liquidity.liquidity,
      deficit: !healthy ? (parseFloat(minLiquidity) - parseFloat(liquidity.liquidity)).toString() : undefined,
    };
  }

  // ============================================================================
  // GAS PRICE & FEES
  // ============================================================================

  async getGasPrices(chainId: number): Promise<GasPriceFeed | null> {
    const cacheKey = `gas_${chainId}`;
    const cached = this.getCached<GasPriceFeed>(this.state.gasFeeds, cacheKey);
    if (cached) return cached;

    try {
      const gasPrices = await this.gasProvider.getGasPrices(chainId);
      this.setCached(this.state.gasFeeds, cacheKey, gasPrices, CACHE_TTL.GAS);
      return gasPrices;
    } catch (error) {
      console.error(`Error fetching gas prices for chain ${chainId}:`, error);
      return null;
    }
  }

  async getEstimatedGasCost(
    chainId: number,
    gasLimit: string,
    speedLevel: 'standard' | 'fast' | 'instant' = 'standard'
  ): Promise<{ cost: string; costUSD: number } | null> {
    const gasFeed = await this.getGasPrices(chainId);
    if (!gasFeed) return null;

    const gasPrice = gasFeed[speedLevel];
    const cost = (BigInt(gasPrice) * BigInt(gasLimit)).toString();

    // Convert to USD
    const ethPrice = await this.getTokenPrice('ETH', chainId);
    const costUSD = ethPrice 
      ? parseFloat(cost) / 1e18 * ethPrice.price 
      : 0;

    return { cost, costUSD };
  }

  async compareGasAcrossChains(chainIds: number[], gasLimit: string): Promise<
    Record<number, { cost: string; costUSD: number }>
  > {
    const results: Record<number, { cost: string; costUSD: number }> = {};

    for (const chainId of chainIds) {
      const estimate = await this.getEstimatedGasCost(chainId, gasLimit);
      if (estimate) results[chainId] = estimate;
    }

    return results;
  }

  // ============================================================================
  // ON-CHAIN VOLUME
  // ============================================================================

  async getVolumeData(
    pair: string,
    chainId: number,
    timeframe: '24h' | '7d' | 'monthly' = '24h'
  ): Promise<VolumeData | null> {
    const cacheKey = `vol_${pair}_${chainId}_${timeframe}`;
    const cached = this.getCached<VolumeData>(this.state.volume, cacheKey);
    if (cached) return cached;

    try {
      const volume = await this.volumeProvider.getVolume(pair, chainId, timeframe);
      this.setCached(this.state.volume, cacheKey, volume, CACHE_TTL.VOLUME);
      return volume;
    } catch (error) {
      console.error(`Error fetching volume:`, error);
      return null;
    }
  }

  async analyzeMarketActivity(chainId: number): Promise<{
    totalVolume24h: string;
    topPairs: Array<{ pair: string; volume: string; volumeUSD: number }>;
    trending: Array<{ pair: string; change: number }>;
  } | null> {
    try {
      const data = await this.volumeProvider.getChainVolume(chainId);
      return {
        totalVolume24h: data.totalVolume24h,
        topPairs: data.topPairs,
        trending: data.topPairs
          .sort((a: any, b: any) => b.volumeUSD - a.volumeUSD)
          .slice(0, 5),
      };
    } catch (error) {
      console.error(`Error analyzing market activity:`, error);
      return null;
    }
  }

  // ============================================================================
  // ROUTE OPTIMIZATION
  // ============================================================================

  async getOptimalRoute(request: GatewayQuoteRequest): Promise<GatewayQuoteResponse | null> {
    // Check rate limits
    if (!this.checkRateLimit(request.tokenIn)) {
      throw new Error('Rate limit exceeded');
    }

    try {
      // Get quote
      const quote = await this.routeOptimizer.getQuote({
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        amountIn: request.amountIn,
        chainInId: request.chainInId,
        chainOutId: request.chainOutId,
      });

      // Get optimal route
      const route = await this.routeOptimizer.optimizeRoute({
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        amountIn: request.amountIn,
        chainInId: request.chainInId,
        chainOutId: request.chainOutId,
        slippage: request.slippage || 0.5,
      });

      // Get alternatives
      const alternatives = await this.routeOptimizer.getAlternatives({
        ...request,
        limit: 3,
      });

      // Security validation
      const audit = await this.securityValidator.validate(route);
      if (!audit.isApproved) {
        throw new Error(`Route failed security checks: ${audit.riskFlags.join(', ')}`);
      }

      // Emit event
      this.emit('route_generated', {
        request,
        route,
        timestamp: Date.now(),
      });

      return {
        quote,
        route,
        alternatives,
        risks: audit.riskFlags,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error getting optimal route:', error);
      throw error;
    }
  }

  async getRouteRecommendation(request: GatewayQuoteRequest): Promise<GatewayRecommendation | null> {
    try {
      const response = await this.getOptimalRoute(request);
      if (!response) return null;

      const recommendation: GatewayRecommendation = {
        operation: request.chainInId === request.chainOutId ? 'swap' : 'bridge',
        optimalRoute: response.route,
        alternatives: response.alternatives,
        rationale: this.generateRouteRationale(response.route),
        estimatedTime: response.route.estimatedTime,
        costSavings: this.calculateCostSavings(response.route, response.alternatives),
        riskAssessment: await this.securityValidator.validate(response.route),
      };

      return recommendation;
    } catch (error) {
      console.error('Error getting route recommendation:', error);
      return null;
    }
  }

  // ============================================================================
  // SECURITY & VALIDATION
  // ============================================================================

  async validateRoute(route: TransferRoute): Promise<SecurityAudit> {
    const audit = await this.securityValidator.validate(route);
    return audit;
  }

  async validateOperation(
    operation: 'swap' | 'bridge' | 'transfer',
    params: Record<string, any>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate amounts
    if (!this.isValidAmount(params.amount)) {
      errors.push('Invalid amount');
    }

    // Validate addresses
    if (!this.isValidAddress(params.recipient)) {
      errors.push('Invalid recipient address');
    }

    // Check slippage
    if (params.slippage > 50) {
      errors.push('Slippage too high (>50%)');
    }

    // Check gas limits
    if (params.gasPrice) {
      const gasPrice = await this.getGasPrices(params.chainId);
      if (gasPrice && parseFloat(params.gasPrice) > parseFloat(gasPrice.instant) * 2) {
        errors.push('Gas price significantly higher than current network');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ============================================================================
  // MARKET SNAPSHOT
  // ============================================================================

  async getMarketSnapshot(): Promise<GatewayMarketSnapshot> {
    const snapshot: GatewayMarketSnapshot = {
      timestamp: Date.now(),
      chains: {},
      bridges: {},
      swapProtocols: {},
    };

    // Collect chain data
    const chainIds = [1, 137, 56, 43114, 250]; // Ethereum, Polygon, BSC, Avalanche, Fantom
    for (const chainId of chainIds) {
      const gasPrice = await this.getGasPrices(chainId);
      const activity = await this.analyzeMarketActivity(chainId);

      snapshot.chains[chainId] = {
        gasPrice: gasPrice!,
        volume24h: activity?.totalVolume24h || '0',
        topTokens: [], // Would be populated from price feeds
      };
    }

    return snapshot;
  }

  // ============================================================================
  // HEALTH & MONITORING
  // ============================================================================

  async getHealthStatus(): Promise<GatewayHealthCheck> {
    const oracles: Record<string, { status: string; latency: number }> = {};
    const bridges: Record<string, { status: string; latency: number }> = {};

    // Check oracle health
    for (const [oracle, healthy] of this.oracleHealthy) {
      oracles[oracle] = {
        status: healthy ? 'healthy' : 'unhealthy',
        latency: Math.random() * 100, // Placeholder
      };
    }

    // Check bridge health
    for (const [bridge, healthy] of this.bridgeHealthy) {
      bridges[bridge] = {
        status: healthy ? 'healthy' : 'unhealthy',
        latency: Math.random() * 200, // Placeholder
      };
    }

    return {
      status: this.determineOverallHealth(oracles, bridges),
      oracles,
      bridges,
      cacheHitRate: this.calculateCacheHitRate(),
      uptime: 99.9,
      timestamp: Date.now(),
    };
  }

  private initializeHealthChecks(): void {
    // Initialize oracle checks
    this.oracleHealthy.set('chainlink', true);
    this.oracleHealthy.set('uniswap', true);
    this.oracleHealthy.set('coingecko', true);

    // Initialize bridge checks
    this.bridgeHealthy.set('stargate', true);
    this.bridgeHealthy.set('axelar', true);
    this.bridgeHealthy.set('wormhole', true);

    // Periodic health checks
    setInterval(() => this.performHealthCheck(), 60 * 1000);
  }

  private async performHealthCheck(): Promise<void> {
    // Check oracle connectivity and response times
    for (const oracle of this.oracleHealthy.keys()) {
      try {
        // Implement actual health check
        this.oracleHealthy.set(oracle, true);
      } catch {
        this.oracleHealthy.set(oracle, false);
        this.emitAlert(`oracle_${oracle}_unhealthy`, 'critical', 
          `Oracle ${oracle} is unreachable`);
      }
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCached<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    data: T,
    ttl: number
  ): void {
    cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      version: 1,
    });
  }

  private calculateWeightedAverage(prices: TokenPrice[]): TokenPrice {
    const weightedPrice = prices.reduce((sum, p) => sum + p.price * p.confidence, 0) /
      prices.reduce((sum, p) => sum + p.confidence, 0);

    return {
      ...prices[0],
      price: weightedPrice,
      confidence: prices.reduce((sum, p) => sum + p.confidence, 0) / prices.length,
    };
  }

  private calculateDeviation(prices: TokenPrice[], average: number): number {
    const deviations = prices.map(p => Math.abs(p.price - average) / average * 100);
    return deviations.reduce((a, b) => a + b, 0) / deviations.length;
  }

  private calculateSlippage(amount: string, liquidity: LiquidityInfo): number {
    const amountBN = parseFloat(amount);
    const liquidityBN = parseFloat(liquidity.liquidity);
    return (amountBN / liquidityBN) * 100;
  }

  private calculateCostSavings(
    optimal: TransferRoute,
    alternatives: TransferRoute[]
  ): { percent: number; amount: string } {
    if (alternatives.length === 0) {
      return { percent: 0, amount: '0' };
    }

    const altCost = alternatives[0].totalGasCostUSD;
    const optimalCost = optimal.totalGasCostUSD;
    const savings = altCost - optimalCost;
    const percent = (savings / altCost) * 100;

    return {
      percent,
      amount: savings.toString(),
    };
  }

  private generateRouteRationale(route: TransferRoute): string {
    return `Recommended route uses ${route.bridgeMethod} bridge with ` +
           `${route.totalSlippage.toFixed(2)}% slippage and ${route.totalGasCostUSD.toFixed(2)} USD gas cost. ` +
           `Estimated time: ${route.estimatedTime}s.`;
  }

  private checkRateLimit(key: string): boolean {
    // Simple rate limit check
    return true; // Placeholder
  }

  private isValidAmount(amount: string): boolean {
    try {
      return parseFloat(amount) > 0;
    } catch {
      return false;
    }
  }

  private isValidAddress(address: string): boolean {
    return Boolean(address && address.startsWith('0x') && address.length === 42);
  }

  private determineOverallHealth(
    oracles: Record<string, any>,
    bridges: Record<string, any>
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const oracleHealth = Object.values(oracles).filter((o: any) => o.status === 'healthy').length;
    const bridgeHealth = Object.values(bridges).filter((b: any) => b.status === 'healthy').length;

    if (oracleHealth < 2 || bridgeHealth < 2) return 'unhealthy' as const;
    if (oracleHealth < 3 || bridgeHealth < 3) return 'degraded' as const;
    return 'healthy' as const;
  }

  private calculateCacheHitRate(): number {
    return 0.85; // Placeholder
  }

  private emitAlert(id: string, severity: string, message: string): void {
    const alert: Alert = {
      id,
      type: severity,
      message,
      timestamp: Date.now(),
    };

    this.activeAlerts.set(id, alert);
    this.emit('alert', alert);
  }
}

export const createGateway = (deps: any): GatewayService => {
  return new GatewayService(
    deps.priceProvider,
    deps.liquidityProvider,
    deps.gasProvider,
    deps.volumeProvider,
    deps.routeOptimizer,
    deps.securityValidator
  );
};
