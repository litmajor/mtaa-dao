/**
 * Price Provider
 * Aggregates prices from multiple sources with fallback logic
 */

import { TokenPrice } from './types';

export interface IPriceProvider {
  getPrice(token: string, chainId: number, source?: string): Promise<TokenPrice | null>;
  getPrices(tokens: string[], chainId: number): Promise<Record<string, TokenPrice>>;
  getHistoricalPrice(token: string, chainId: number, timestamp: number): Promise<TokenPrice | null>;
}

export class AggregatedPriceProvider implements IPriceProvider {
  constructor(
    private chainlinkProvider: any,
    private uniswapProvider: any,
    private coingeckoProvider: any
  ) {}

  async getPrice(
    token: string,
    chainId: number,
    source?: string
  ): Promise<TokenPrice | null> {
    if (source) {
      return this.getPriceFromSource(token, chainId, source);
    }

    // Try multiple sources with fallback
    const sources = ['chainlink', 'uniswap', 'coingecko'];
    for (const src of sources) {
      try {
        const price = await this.getPriceFromSource(token, chainId, src);
        if (price) return price;
      } catch (error) {
        console.warn(`Failed to get price from ${src}:`, error);
        continue;
      }
    }

    return null;
  }

  async getPrices(tokens: string[], chainId: number): Promise<Record<string, TokenPrice>> {
    const prices: Record<string, TokenPrice> = {};
    const results = await Promise.allSettled(
      tokens.map(token => this.getPrice(token, chainId))
    );

    tokens.forEach((token, index) => {
      const result = results[index];
      if (result.status === 'fulfilled' && result.value) {
        prices[token] = result.value;
      }
    });

    return prices;
  }

  async getHistoricalPrice(
    token: string,
    chainId: number,
    timestamp: number
  ): Promise<TokenPrice | null> {
    try {
      return await this.coingeckoProvider.getHistoricalPrice(token, chainId, timestamp);
    } catch (error) {
      console.error('Error fetching historical price:', error);
      return null;
    }
  }

  private async getPriceFromSource(
    token: string,
    chainId: number,
    source: string
  ): Promise<TokenPrice | null> {
    switch (source) {
      case 'chainlink':
        return this.chainlinkProvider.getPrice(token, chainId);
      case 'uniswap':
        return this.uniswapProvider.getPrice(token, chainId);
      case 'coingecko':
        return this.coingeckoProvider.getPrice(token, chainId);
      default:
        return null;
    }
  }
}

/**
 * Liquidity Provider
 * Fetches and analyzes liquidity across DEXes
 */

import { LiquidityInfo, SlippageAnalysis } from './types';

export interface ILiquidityProvider {
  getLiquidity(tokenA: string, tokenB: string, chainId: number): Promise<LiquidityInfo | null>;
  analyzeLiquidityImpact(
    tokenA: string,
    tokenB: string,
    chainId: number,
    amounts: string[]
  ): Promise<SlippageAnalysis[]>;
  findBestLiquidityPool(
    tokenA: string,
    tokenB: string,
    chainId: number
  ): Promise<LiquidityInfo | null>;
}

export class UniversalLiquidityProvider implements ILiquidityProvider {
  constructor(
    private uniswapV2: any,
    private uniswapV3: any,
    private curveProvider: any,
    private balancerProvider: any
  ) {}

  async getLiquidity(
    tokenA: string,
    tokenB: string,
    chainId: number
  ): Promise<LiquidityInfo | null> {
    const pools = await Promise.all([
      this.uniswapV2.getPool(tokenA, tokenB, chainId).catch(() => null),
      this.uniswapV3.getPool(tokenA, tokenB, chainId).catch(() => null),
      this.curveProvider.getPool(tokenA, tokenB, chainId).catch(() => null),
      this.balancerProvider.getPool(tokenA, tokenB, chainId).catch(() => null),
    ]);

    const validPools = pools.filter(p => p !== null);
    if (validPools.length === 0) return null;

    // Return pool with best liquidity
    return validPools.reduce((best, current) =>
      parseFloat(current.liquidity) > parseFloat(best.liquidity) ? current : best
    );
  }

  async analyzeLiquidityImpact(
    tokenA: string,
    tokenB: string,
    chainId: number,
    amounts: string[]
  ): Promise<SlippageAnalysis[]> {
    const liquidity = await this.getLiquidity(tokenA, tokenB, chainId);
    if (!liquidity) return [];

    return amounts.map(amount => ({
      expectedOutput: amount, // Placeholder
      minOutput: (parseFloat(amount) * 0.99).toString(), // 1% slippage
      slippagePercent: this.calculateSlippagePercent(amount, liquidity),
      slippageAmount: this.calculateSlippageAmount(amount, liquidity),
      priceImpact: this.calculatePriceImpact(amount, liquidity),
      liquidity: liquidity.liquidity,
      depth: {
        support: (parseFloat(liquidity.liquidity) * 0.8).toString(),
        resistance: (parseFloat(liquidity.liquidity) * 1.2).toString(),
      },
    }));
  }

  async findBestLiquidityPool(
    tokenA: string,
    tokenB: string,
    chainId: number
  ): Promise<LiquidityInfo | null> {
    const pools = await Promise.allSettled([
      this.uniswapV2.getPool(tokenA, tokenB, chainId),
      this.uniswapV3.getPool(tokenA, tokenB, chainId),
      this.curveProvider.getPool(tokenA, tokenB, chainId),
      this.balancerProvider.getPool(tokenA, tokenB, chainId),
    ]);

    const validPools = pools
      .filter(p => p.status === 'fulfilled')
      .map(p => (p as PromiseFulfilledResult<any>).value)
      .filter(p => p !== null);

    if (validPools.length === 0) return null;

    // Score pools by liquidity and fee
    return validPools.reduce((best, current) => {
      const bestScore = parseFloat(best.liquidity) / (1 + best.fee);
      const currentScore = parseFloat(current.liquidity) / (1 + current.fee);
      return currentScore > bestScore ? current : best;
    });
  }

  private calculateSlippagePercent(amount: string, liquidity: LiquidityInfo): number {
    return (parseFloat(amount) / parseFloat(liquidity.liquidity)) * 100;
  }

  private calculateSlippageAmount(amount: string, liquidity: LiquidityInfo): string {
    const slippage = this.calculateSlippagePercent(amount, liquidity);
    return (parseFloat(amount) * (slippage / 100)).toString();
  }

  private calculatePriceImpact(amount: string, liquidity: LiquidityInfo): number {
    const ratio = parseFloat(amount) / parseFloat(liquidity.liquidity);
    return ratio > 0.1 ? 5 : ratio > 0.05 ? 2 : 0.5;
  }
}

/**
 * Gas Price Provider
 * Tracks gas prices across chains
 */

import { GasPriceFeed } from './types';

export interface IGasProvider {
  getGasPrices(chainId: number): Promise<GasPriceFeed | null>;
  getGasPricesForChains(chainIds: number[]): Promise<Record<number, GasPriceFeed>>;
  estimateGasCost(chainId: number, gasLimit: string): Promise<string | null>;
}

export class GasFeesProvider implements IGasProvider {
  constructor(private etherscan: any, private blockscout: any) {}

  async getGasPrices(chainId: number): Promise<GasPriceFeed | null> {
    try {
      const prices = await this.etherscan.getGasPrices(chainId);
      return {
        chainId,
        standard: prices.standard,
        fast: prices.fast,
        instant: prices.instant,
        estimatedTime: {
          standard: 3 * 60, // 3 minutes
          fast: 1 * 60, // 1 minute
          instant: 15, // 15 seconds
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`Error getting gas prices for chain ${chainId}:`, error);
      return null;
    }
  }

  async getGasPricesForChains(chainIds: number[]): Promise<Record<number, GasPriceFeed>> {
    const results: Record<number, GasPriceFeed> = {};
    const prices = await Promise.allSettled(
      chainIds.map(id => this.getGasPrices(id))
    );

    chainIds.forEach((id, index) => {
      const result = prices[index];
      if (result.status === 'fulfilled' && result.value) {
        results[id] = result.value;
      }
    });

    return results;
  }

  async estimateGasCost(chainId: number, gasLimit: string): Promise<string | null> {
    const gasPrices = await this.getGasPrices(chainId);
    if (!gasPrices) return null;

    const cost = (BigInt(gasPrices.standard) * BigInt(gasLimit)).toString();
    return cost;
  }
}

/**
 * Volume Provider
 * Tracks trading volume and market activity
 */

import { VolumeData, ChainVolume } from './types';

export interface IVolumeProvider {
  getVolume(pair: string, chainId: number, timeframe: string): Promise<VolumeData | null>;
  getChainVolume(chainId: number): Promise<ChainVolume | null>;
  getTrendingPairs(chainId: number, limit?: number): Promise<VolumeData[]>;
}

export class VolumeAggregatorProvider implements IVolumeProvider {
  constructor(
    private subgraph: any,
    private defiLlama: any,
    private coingecko: any
  ) {}

  async getVolume(
    pair: string,
    chainId: number,
    timeframe: string = '24h'
  ): Promise<VolumeData | null> {
    try {
      const volume = await this.subgraph.getVolume(pair, chainId, timeframe);
      return {
        chainId,
        pair,
        volume24h: volume.volume24h,
        volume7d: volume.volume7d,
        volumeMonthly: volume.volumeMonthly,
        volumeUSD24h: parseFloat(volume.volumeUSD24h),
        volumeUSD7d: parseFloat(volume.volumeUSD7d),
        trades24h: volume.trades24h,
        averageTradeSize: volume.averageTradeSize,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error getting volume:', error);
      return null;
    }
  }

  async getChainVolume(chainId: number): Promise<ChainVolume | null> {
    try {
      const data = await this.defiLlama.getChainVolume(chainId);
      return {
        chainId,
        chainName: data.chainName,
        totalVolume24h: data.totalVolume24h,
        totalVolumeUSD24h: parseFloat(data.totalVolumeUSD24h),
        topPairs: data.topPairs,
        txCount24h: data.txCount24h,
        activeUsers24h: data.activeUsers24h,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error getting chain volume:', error);
      return null;
    }
  }

  async getTrendingPairs(chainId: number, limit: number = 5): Promise<VolumeData[]> {
    try {
      const pairs = await this.coingecko.getTrendingPairs(chainId, limit);
      return Promise.all(
        pairs.map((pair: string) => this.getVolume(pair, chainId))
      ).then(results => results.filter(r => r !== null) as VolumeData[]);
    } catch (error) {
      console.error('Error getting trending pairs:', error);
      return [];
    }
  }
}
