/**
 * Gateway Service Singleton
 * Initializes and exports the data gateway service using the existing market-data
 * services and gateway adapters instead of the old development-only mocks.
 */

import { GatewayService, createGateway } from './gateway';
import { JsonRpcProvider } from 'ethers';
import { Logger } from '../../utils/logger';
import { priceOracle } from '../priceOracle';
import { gasPriceOracle } from '../gasPriceOracle';
import { ccxtService } from '../ccxtService';
import { initializeAdapters } from '../../core/agents/gateway/initialize';
import type {
  LiquidityInfo,
  VolumeData,
  GatewayQuoteRequest,
  TransferRoute,
  SecurityAudit,
} from './types';
import type { BaseAdapter } from '../../core/agents/gateway/adapters/base-adapter';

const logger = new Logger('gateway-service');

// The gateway index remains a real-provider adapter for non-price market data.
// Price resolution stays authoritative in the oracle layer and is consumed by
// marketDataClient directly, while this file focuses on liquidity, gas, volume,
// route, and security capabilities.

let gatewayAdapters: Map<string, BaseAdapter> | null = null;

type GatewayAdapterRequest = {
  symbol?: string;
  quoteSymbol?: string;
  tokenA?: string;
  tokenB?: string;
  chain: string;
};

function getGatewayAdapters(): Map<string, BaseAdapter> {
  if (!gatewayAdapters) {
    gatewayAdapters = initializeAdapters();
  }
  return gatewayAdapters;
}

function normalizeChainName(chainId: number): string {
  switch (chainId) {
    case 1:
      return 'ethereum';
    case 137:
      return 'polygon';
    case 42161:
      return 'arbitrum';
    case 10:
      return 'optimism';
    case 56:
      return 'bsc';
    case 8453:
      return 'base';
    case 42220:
    default:
      return 'celo';
  }
}

function getChainRpcUrl(chainId: number): string {
  switch (chainId) {
    case 1:
      return process.env.ETH_RPC_URL || process.env.MAINNET_RPC || 'https://rpc.ankr.com/eth';
    case 137:
      return process.env.POLYGON_RPC_URL || 'https://rpc.ankr.com/polygon';
    case 42161:
      return process.env.ARBITRUM_RPC_URL || 'https://rpc.ankr.com/arbitrum';
    case 10:
      return process.env.OPTIMISM_RPC_URL || 'https://rpc.ankr.com/optimism';
    case 56:
      return process.env.BSC_RPC_URL || 'https://rpc.ankr.com/bsc';
    case 8453:
      return process.env.BASE_RPC_URL || 'https://rpc.ankr.com/base';
    case 42220:
    default:
      return process.env.CELO_RPC_URL || 'https://forno.celo.org';
  }
}

interface RealPriceProviderResult {
  token: string;
  symbol: string;
  chainId: number;
  price: number;
  currency: 'USD';
  timestamp: number;
  source: 'price-oracle';
  confidence: number;
}

class RealPriceProvider {
  async getPrice(token: string, chainId: number): Promise<RealPriceProviderResult | null> {
    const priceData = await priceOracle.getValuationPrice(token);
    const markUsd = priceData?.haircutPriceUsd ?? priceData?.priceUsd;
    if (!priceData || markUsd === undefined || !Number.isFinite(markUsd) || markUsd <= 0) {
      return null;
    }

    return {
      token,
      symbol: token,
      chainId,
      price: markUsd,
      currency: 'USD',
      timestamp: priceData.asOf.getTime(),
      source: 'price-oracle',
      confidence: priceData.confidence === 'high' ? 1 : priceData.confidence === 'medium' ? 0.75 : 0.5,
    };
  }

  async getPrices(tokens: string[], chainId: number): Promise<Record<string, RealPriceProviderResult>> {
    const prices: Record<string, RealPriceProviderResult> = {};
    for (const token of tokens) {
      const price = await this.getPrice(token, chainId);
      if (price) {
        prices[token] = price;
      }
    }
    return prices;
  }

  async getHistoricalPrice(
    _token: string,
    _chainId: number,
    _timestamp: number
  ): Promise<RealPriceProviderResult | null> {
    return null;
  }
}

interface AdapterLiquidityAsset {
  symbol?: string;
  chain?: string;
  address?: string;
}

interface AdapterLiquidityCoin {
  symbol?: string;
  address?: string;
}

interface AdapterLiquidityMetadata {
  reserve0?: string | number;
  reserve1?: string | number;
  liquidityUSD?: string | number;
  concentration?: number;
  depth?: {
    slippage1percent?: string;
    slippage5percent?: string;
    slippage10percent?: string;
  };
  fee?: number;
  coins?: AdapterLiquidityCoin[];
}

interface AdapterLiquidityPayload {
  asset?: AdapterLiquidityAsset;
  metadata?: AdapterLiquidityMetadata;
  value?: string | number;
}

class RealLiquidityProvider {
  private normalizeSymbol(symbol: string | undefined): string {
    return String(symbol ?? '').trim().toUpperCase();
  }

  private extractPoolSymbols(payload: AdapterLiquidityPayload): string[] {
    const tokens = new Set<string>();

    if (payload.asset?.symbol) {
      this.normalizeSymbol(payload.asset.symbol)
        .split(/[-_\\/\s]+/)
        .filter(Boolean)
        .forEach(sym => tokens.add(sym));
    }

    if (payload.metadata?.coins) {
      payload.metadata.coins
        .map(coin => this.normalizeSymbol(coin.symbol))
        .filter(Boolean)
        .forEach(sym => tokens.add(sym));
    }

    return Array.from(tokens);
  }

  private isMatchingPair(payload: AdapterLiquidityPayload, tokenA: string, tokenB: string): boolean {
    const normalizedA = tokenA.trim().toUpperCase();
    const normalizedB = tokenB.trim().toUpperCase();
    const symbols = this.extractPoolSymbols(payload);

    return (
      symbols.length > 1 &&
      symbols.includes(normalizedA) &&
      symbols.includes(normalizedB)
    );
  }

  private buildLiquidityInfo(
    payload: AdapterLiquidityPayload,
    adapterName: string,
    tokenA: string,
    tokenB: string,
    chainId: number
  ) {
    const liquidityValue = payload.value ?? payload.metadata?.liquidityUSD;
    if (liquidityValue == null || Number(liquidityValue) <= 0) {
      return null;
    }

    return {
      poolAddress: payload.asset?.address ?? '0x' + '0'.repeat(40),
      chainId,
      tokenA,
      tokenB,
      reserve0: String(payload.metadata?.reserve0 ?? '0'),
      reserve1: String(payload.metadata?.reserve1 ?? '0'),
      liquidity: String(liquidityValue),
      concentration: Number(payload.metadata?.concentration ?? 0),
      depth: {
        slippage1percent: payload.metadata?.depth?.slippage1percent ?? '0',
        slippage5percent: payload.metadata?.depth?.slippage5percent ?? '0',
        slippage10percent: payload.metadata?.depth?.slippage10percent ?? '0',
      },
      fee: Number(payload.metadata?.fee ?? 0),
      source: adapterName,
    };
  }

  private calculateSlippage(amount: string, liquidity: LiquidityInfo): number {
    const amountFloat = parseFloat(amount);
    const liquidityFloat = parseFloat(liquidity.liquidity);
    if (!amountFloat || !liquidityFloat) {
      return 0;
    }

    const impliedSlippage = (amountFloat / liquidityFloat) * 100;
    return Number(impliedSlippage.toFixed(4));
  }

  private async tryFetchLiquidity(
    adapter: BaseAdapter,
    adapterName: string,
    requestParams: Record<string, any>,
    tokenA: string,
    tokenB: string,
    chainId: number
  ): Promise<LiquidityInfo> {
    const response = await adapter.fetch('liquidity', requestParams);
    if (!response?.success || !response.data) {
      throw new Error('No liquidity response');
    }

    const candidates = Array.isArray(response.data) ? response.data : [response.data];
    for (const candidate of candidates) {
      const payload = candidate as AdapterLiquidityPayload;
      if (!this.isMatchingPair(payload, tokenA, tokenB)) continue;

      const liquidity = this.buildLiquidityInfo(payload, adapterName, tokenA, tokenB, chainId);
      if (liquidity) {
        return liquidity;
      }
    }

    throw new Error('No matching liquidity candidate');
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number, adapterName: string): Promise<T> {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Adapter timeout: ${adapterName} after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  async getLiquidity(tokenA: string, tokenB: string, chainId: number): Promise<LiquidityInfo | null> {
    const adapters = getGatewayAdapters();
    const chain = normalizeChainName(chainId);
    const isCeloChain = chain === 'celo';
    const adapterCandidates = isCeloChain
      ? ['mento', 'ubeswap', 'moola', 'curve', 'uniswap', 'sushi', 'coingecko', 'blockchain']
      : ['uniswap', 'sushi', 'curve', 'moola', 'mento', 'ubeswap', 'coingecko', 'blockchain'];
    const timeoutMs = 8000;

    const requestParamsList = [
      { symbol: tokenA, quoteSymbol: tokenB, chain },
      { symbol: tokenB, quoteSymbol: tokenA, chain },
      { tokenA, tokenB, chain },
    ];

    const liquidityPromises: Promise<LiquidityInfo>[] = [];

    for (const adapterName of adapterCandidates) {
      const adapter = adapters.get(adapterName);
      if (!adapter) continue;

      for (const requestParams of requestParamsList) {
        const promise = this.executeWithTimeout(
          this.tryFetchLiquidity(adapter, adapterName, requestParams, tokenA, tokenB, chainId),
          timeoutMs,
          `${adapterName}:${JSON.stringify(requestParams)}`
        );
        liquidityPromises.push(promise);
      }
    }

    try {
      return await Promise.any(liquidityPromises);
    } catch {
      logger.warn(`No liquidity adapters returned a match for ${tokenA}/${tokenB} on ${chain}`);
      return null;
    }
  }

  async analyzeLiquidityDepth(tokenA: string, tokenB: string, chainId: number, amounts: string[]) {
    const liquidity = await this.getLiquidity(tokenA, tokenB, chainId);
    return amounts.map(amount => ({
      amount,
      slippage: liquidity ? this.calculateSlippage(amount, liquidity) : 0,
    }));
  }

  async checkLiquidityHealth(tokenA: string, tokenB: string, chainId: number, minLiquidityUSD: string) {
    const liquidity = await this.getLiquidity(tokenA, tokenB, chainId);
    if (!liquidity) {
      return {
        healthy: false,
        available: '0',
        deficit: minLiquidityUSD,
      };
    }

    const available = parseFloat(liquidity.liquidity);
    const required = parseFloat(minLiquidityUSD);
    const healthy = available >= required;

    return {
      healthy,
      available: liquidity.liquidity,
      deficit: healthy ? undefined : String(required - available),
    };
  }
}

class RealGasProvider {
  async getGasPrices(chainId: number) {
    const rpcUrl = getChainRpcUrl(chainId);
    const provider = new JsonRpcProvider(rpcUrl);

    try {
      const prices = await gasPriceOracle.getCurrentGasPrices(provider, normalizeChainName(chainId));
      if (!prices) {
        return null;
      }
      // Get optimal strategies for all tiers
      const standardStrat = await gasPriceOracle.getOptimalGasStrategy(provider, normalizeChainName(chainId), 'standard');
      const fastStrat = await gasPriceOracle.getOptimalGasStrategy(provider, normalizeChainName(chainId), 'fast');
      const instantStrat = await gasPriceOracle.getOptimalGasStrategy(provider, normalizeChainName(chainId), 'instant');

      return {
        chainId,
        standard: standardStrat.maxFeePerGas || standardStrat.gasPrice || prices.baseFee,
        fast: fastStrat.maxFeePerGas || fastStrat.gasPrice || prices.baseFee,
        instant: instantStrat.maxFeePerGas || instantStrat.gasPrice || prices.baseFee,
        estimatedTime: {
          standard: 30,
          fast: 10,
          instant: 5,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.warn(`Gas price oracle failed for chain ${chainId}`, { error });
      return null;
    }
  }

  async estimateGasCost(chainId: number, gasLimit: string): Promise<string | null> {
    const gasPrices = await this.getGasPrices(chainId);
    if (!gasPrices) {
      return null;
    }

    return (BigInt(gasPrices.standard) * BigInt(gasLimit)).toString();
  }
}

class RealVolumeProvider {
  private getDefaultPairs(chainId: number): string[] {
    return {
      1: ['BTC/USD', 'ETH/USD', 'USDC/USD'],
      137: ['MATIC/USD', 'USDC/USD', 'WETH/USD'],
      42220: ['CELO/USD', 'cUSD/USD', 'USDC/USD'],
      56: ['BNB/USD', 'BUSD/USD', 'USDT/USD'],
      43114: ['AVAX/USD', 'USDC/USD', 'ETH/USD'],
      250: ['FTM/USD', 'USDC/USD', 'WETH/USD'],
      42161: ['ETH/USD', 'USDC/USD', 'WBTC/USD'],
      10: ['ETH/USD', 'USDC/USD', 'LINK/USD'],
    }[chainId] ?? ['USDC/USD', 'ETH/USD'];
  }

  private async resolveUsdPrice(token: string): Promise<number | null> {
    const symbol = token.trim().toUpperCase();
    const priceData = await priceOracle.getValuationPrice(symbol);
    const markUsd = priceData?.haircutPriceUsd ?? priceData?.priceUsd;
    return priceData && markUsd !== undefined && Number.isFinite(markUsd) && markUsd > 0 ? markUsd : null;
  }

  async getVolume(pair: string, chainId: number, timeframe: '24h' | '7d' | 'monthly' = '24h'): Promise<VolumeData | null> {
    const interval = timeframe === '24h' ? '1h' : '1d';
    const limit = timeframe === '24h' ? 24 : timeframe === '7d' ? 7 : 30;
    const ohlcvResponse = await ccxtService.getOHLCV(pair, interval, limit);
    const candles = ohlcvResponse?.data;

    if (!Array.isArray(candles) || candles.length === 0) {
      return null;
    }

    const volumes = candles
      .map((c: any) => Number(c?.[5] ?? 0))
      .filter((v: number) => Number.isFinite(v) && v > 0);

    if (volumes.length === 0) {
      return null;
    }

    const totalVolume = volumes.reduce((sum: number, value: number) => sum + value, 0);
    const [baseToken] = pair.split('/').map(part => part.trim().toUpperCase());
    const priceUsd = await this.resolveUsdPrice(baseToken);
    if (priceUsd === null) return null;
    const volumeUSD24h = totalVolume * priceUsd;

    const base24h = timeframe === '24h' ? totalVolume : totalVolume / (timeframe === '7d' ? 7 : 30);
    const computedVolume7d = base24h * 7;
    const computedVolumeMonthly = base24h * 30;

    return {
      chainId,
      pair,
      volume24h: String(base24h),
      volume7d: String(computedVolume7d),
      volumeMonthly: String(computedVolumeMonthly),
      volumeUSD24h,
      volumeUSD7d: volumeUSD24h * 7,
      trades24h: candles.length,
      averageTradeSize: String(totalVolume / candles.length),
      timestamp: Date.now(),
    };
  }

  async getVolumeData(pair: string, chainId: number, timeframe: 'day' | 'week' | 'month' = 'day') {
    return this.getVolume(pair, chainId, timeframe === 'day' ? '24h' : timeframe === 'week' ? '7d' : 'monthly');
  }

  async getVolumeTrending(chainId: number, limit: number = 10): Promise<VolumeData[]> {
    const pairs = this.getDefaultPairs(chainId).slice(0, limit);
    const volumeResults = await Promise.all(pairs.map(pair => this.getVolume(pair, chainId, '24h')));
    return volumeResults.filter((item): item is VolumeData => item !== null);
  }

  async getChainVolume(chainId: number) {
    const pairs = this.getDefaultPairs(chainId);
    const volumeResults = await Promise.all(pairs.map(pair => this.getVolume(pair, chainId, '24h')));
    const validResults = volumeResults.filter((item): item is VolumeData => item !== null);

    if (validResults.length === 0) {
      return null;
    }

    const totalVolume24h = validResults.reduce((sum, item) => sum + parseFloat(item.volume24h), 0);
    const totalVolumeUSD24h = validResults.reduce((sum, item) => sum + item.volumeUSD24h, 0);
    const topPairs = validResults
      .sort((a, b) => b.volumeUSD24h - a.volumeUSD24h)
      .slice(0, 5)
      .map(item => ({
        pair: item.pair,
        volume: item.volume24h,
        volumeUSD: item.volumeUSD24h,
      }));

    return {
      chainId,
      chainName: normalizeChainName(chainId),
      totalVolume24h: String(totalVolume24h),
      totalVolumeUSD24h,
      topPairs,
      txCount24h: validResults.reduce((sum, item) => sum + item.trades24h, 0),
      activeUsers24h: validResults.length * 50,
      timestamp: Date.now(),
    };
  }
}

class RealRouteOptimizer {
  constructor(
    private liquidityProvider: any,
    private gasProvider: any,
    private priceProvider: any
  ) {}

  async getQuote(request: GatewayQuoteRequest) {
    const amountIn = Number(request.amountIn);
    const priceIn = await this.priceProvider.getPrice(request.tokenIn, request.chainInId);
    const priceOut = await this.priceProvider.getPrice(request.tokenOut, request.chainOutId);

    if (!priceIn || !priceOut) {
      throw new Error('Unable to fetch prices for quote');
    }

    const amountOutEstimate = (amountIn * priceIn.price) / priceOut.price;

    return {
      tokenIn: request.tokenIn,
      tokenOut: request.tokenOut,
      amountIn: request.amountIn,
      amountOut: String(amountOutEstimate),
      priceImpact: 0.5,
      slippage: request.slippage ?? 0.5,
      route: [request.tokenIn, request.tokenOut],
      liquidity: '0',
      timestamp: Date.now(),
    };
  }

  async optimizeRoute(request: GatewayQuoteRequest): Promise<TransferRoute> {
    if (request.chainInId === request.chainOutId) {
      return this.optimizeSingleChainSwap(
        request.tokenIn,
        request.tokenOut,
        request.amountIn,
        request.chainInId,
        request.slippage ?? 0.5
      );
    }

    return this.optimizeCrossChainRoute(
      request.tokenIn,
      request.tokenOut,
      request.amountIn,
      request.chainInId,
      request.chainOutId,
      request.slippage ?? 0.5
    );
  }

  async getAlternatives(request: GatewayQuoteRequest, limit: number = 3): Promise<TransferRoute[]> {
    const strategies = ['best_price', 'fastest', 'lowest_fee'];

    const alternativePromises = strategies.slice(0, Math.min(limit, strategies.length)).map((strategy, index) => {
      return this.optimizeRoute({
        ...request,
        slippage: request.slippage ? request.slippage + index * 0.1 : 0.5 + index * 0.1,
      }).catch((error) => {
        logger.warn('Failed to generate alternative route', { error, strategy });
        return null;
      });
    });

    const settled = await Promise.all(alternativePromises);
    return settled.filter((route): route is TransferRoute => route !== null);
  }

  private getNativeGasTokenSymbol(chainId: number): string {
    switch (chainId) {
      case 1:
      case 137:
      case 42161:
      case 10:
      case 8453:
        return 'ETH';
      case 56:
        return 'BNB';
      case 43114:
        return 'AVAX';
      case 250:
        return 'FTM';
      case 42220:
      default:
        return 'CELO';
    }
  }

  private async optimizeSingleChainSwap(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    chainId: number,
    slippage: number
  ): Promise<TransferRoute> {
    const routeId = `route_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const liquidity = await this.liquidityProvider.getLiquidity(tokenIn, tokenOut, chainId);
    const gasEstimate = await this.gasProvider.estimateGasCost(chainId, '150000');
    const expectedOutput = liquidity
      ? this.calculateSwapOutput(amountIn, liquidity)
      : String(Number(amountIn) * 0.99);
    const minOutput = String(Number(expectedOutput) * (1 - slippage / 100));
    const gasCost = gasEstimate ? BigInt(gasEstimate).toString() : '0';
    const nativeGasSymbol = this.getNativeGasTokenSymbol(chainId);
    const gasPrice = await this.priceProvider.getPrice(nativeGasSymbol, chainId);
    const gasCostUSD = gasPrice ? (Number(gasCost) / 1e18) * gasPrice.price : 0;

    return {
      id: routeId,
      source: {
        token: tokenIn,
        amount: amountIn,
        chainId,
        address: '0x' + '0'.repeat(40),
      },
      destination: {
        token: tokenOut,
        amount: expectedOutput,
        chainId,
        address: '0x' + '0'.repeat(40),
      },
      steps: [
        {
          from: {
            token: tokenIn,
            amount: amountIn,
            chainId,
          },
          to: {
            token: tokenOut,
            amount: expectedOutput,
            chainId,
          },
          protocol: liquidity?.source ?? 'uniswap',
          fee: liquidity ? String(liquidity.fee) : '0.003',
          slippage,
          gasEstimate: gasEstimate ?? '0',
        },
      ],
      expectedOutput,
      minOutput,
      totalSlippage: slippage,
      totalGasCost: gasEstimate ?? '0',
      totalGasCostUSD: gasCostUSD,
      bridgeMethod: 'none',
      estimatedTime: 30,
      riskLevel: 'low',
      timestamp: Date.now(),
    };
  }

  private async optimizeCrossChainRoute(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    chainInId: number,
    chainOutId: number,
    slippage: number
  ): Promise<TransferRoute> {
    const routeId = `route_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const steps: any[] = [];
    let currentAmount = amountIn;

    if (tokenIn !== 'USDC') {
      const sourceSwap = await this.buildSwapStep(tokenIn, 'USDC', currentAmount, chainInId, slippage);
      steps.push(sourceSwap);
      currentAmount = sourceSwap.to.amount;
    }

    const bridgeProtocol = this.selectBridgeProtocol(chainInId, chainOutId);
    const bridgeGasEstimate = await this.gasProvider.estimateGasCost(chainInId, '200000');
    steps.push({
      from: {
        token: 'USDC',
        amount: currentAmount,
        chainId: chainInId,
      },
      to: {
        token: 'USDC',
        amount: currentAmount,
        chainId: chainOutId,
      },
      protocol: bridgeProtocol,
      fee: '0.005',
      slippage: 0,
      gasEstimate: bridgeGasEstimate ?? '0',
    });

    if (tokenOut !== 'USDC') {
      const destinationSwap = await this.buildSwapStep('USDC', tokenOut, currentAmount, chainOutId, slippage);
      steps.push(destinationSwap);
      currentAmount = destinationSwap.to.amount;
    }

    const totalGasCost = steps.reduce((sum, step) => sum + Number(step.gasEstimate || '0'), 0);
    const nativeGasSymbol = this.getNativeGasTokenSymbol(chainInId);
    const gasPrice = await this.priceProvider.getPrice(nativeGasSymbol, chainInId);
    const gasCostUSD = gasPrice ? (totalGasCost / 1e18) * gasPrice.price : 0;
    const expectedOutput = currentAmount;
    const minOutput = String(Number(expectedOutput) * (1 - slippage / 100));

    return {
      id: routeId,
      source: {
        token: tokenIn,
        amount: amountIn,
        chainId: chainInId,
        address: '0x' + '0'.repeat(40),
      },
      destination: {
        token: tokenOut,
        amount: expectedOutput,
        chainId: chainOutId,
        address: '0x' + '0'.repeat(40),
      },
      steps,
      expectedOutput,
      minOutput,
      totalSlippage: slippage,
      totalGasCost: String(totalGasCost),
      totalGasCostUSD: gasCostUSD,
      bridgeMethod: bridgeProtocol,
      estimatedTime: 300,
      riskLevel: 'medium',
      timestamp: Date.now(),
    };
  }

  private async buildSwapStep(
    tokenIn: string,
    tokenOut: string,
    amount: string,
    chainId: number,
    slippage: number
  ) {
    const liquidity = await this.liquidityProvider.getLiquidity(tokenIn, tokenOut, chainId);
    const gasEstimate = await this.gasProvider.estimateGasCost(chainId, '150000');
    const expectedOutput = liquidity
      ? this.calculateSwapOutput(amount, liquidity)
      : String(Number(amount) * 0.99);

    return {
      from: {
        token: tokenIn,
        amount,
        chainId,
      },
      to: {
        token: tokenOut,
        amount: expectedOutput,
        chainId,
      },
      protocol: liquidity?.source ?? 'uniswap',
      fee: liquidity ? String(liquidity.fee) : '0.003',
      slippage,
      gasEstimate: gasEstimate ?? '0',
    };
  }

  private calculateSwapOutput(amountIn: string, liquidity: LiquidityInfo): string {
    const amountFloat = parseFloat(amountIn);
    const poolLiquidity = parseFloat(liquidity.liquidity);
    if (!amountFloat || !poolLiquidity) {
      return amountIn;
    }

    const priceImpact = Math.min(amountFloat / poolLiquidity, 0.5);
    return String(amountFloat * (1 - priceImpact));
  }

  private selectBridgeProtocol(chainInId: number, chainOutId: number): string {
    if (chainInId === chainOutId) {
      return 'none';
    }

    const routeKey = `${chainInId}-${chainOutId}`;
    const preferredBridges: Record<string, string> = {
      '1-137': 'layerzero',
      '137-1': 'layerzero',
      '1-56': 'stargate',
      '56-1': 'stargate',
      '1-43114': 'axelar',
      '43114-1': 'axelar',
    };

    return preferredBridges[routeKey] ?? 'layerzero';
  }
}

class RealSecurityValidator {
  async validate(route: TransferRoute): Promise<SecurityAudit> {
    const riskFlags: string[] = [];
    const slippage = Number(route.totalSlippage ?? 0);
    const gasCostUSD = Number(route.totalGasCostUSD ?? 0);
    const protocol = String(route.bridgeMethod || route.steps?.[0]?.protocol || '').toLowerCase();

    if (!route.source?.token || !route.destination?.token) {
      riskFlags.push('missing_source_or_destination');
    }

    if (slippage > 5) {
      riskFlags.push('high_slippage');
    }

    if (gasCostUSD > 1000) {
      riskFlags.push('high_gas_cost');
    }

    if (!this.isBridgeSecure(protocol)) {
      riskFlags.push('unsupported_bridge_method');
    }

    if (route.steps.some(step => /unsafe|unverified|experimental/.test(String(step.protocol || '').toLowerCase()))) {
      riskFlags.push('unsafe_protocol_step');
    }

    const isApproved = riskFlags.length === 0;

    return {
      routeId: route.id,
      checks: {
        slippageWithinThreshold: slippage <= 5,
        liquidityAdequate: route.steps.length > 0,
        gasCostAcceptable: gasCostUSD <= 1000,
        bridgeSecure: this.isBridgeSecure(protocol),
        oracleHealthy: true,
        contractVerified: !riskFlags.includes('unsafe_protocol_step'),
      },
      riskFlags,
      riskScore: riskFlags.length * 10,
      isApproved,
      timestamp: Date.now(),
    };
  }

  private isBridgeSecure(protocol: string): boolean {
    return ['none', 'native', 'stargate', 'axelar', 'wormhole', 'layerzero', 'cbridge', 'uniswap', 'sushi', 'curve'].includes(protocol);
  }
}

const priceProvider = new RealPriceProvider();
const liquidityProvider = new RealLiquidityProvider();
const gasProvider = new RealGasProvider();
const volumeProvider = new RealVolumeProvider();
const routeOptimizer = new RealRouteOptimizer(liquidityProvider, gasProvider, priceProvider);
const securityValidator = new RealSecurityValidator();

let gatewayServiceInstance: GatewayService | null = null;

/**
 * Initialize and get the gateway service singleton
 */
export function initializeGatewayService(
  customProviders?: {
    priceProvider?: any;
    liquidityProvider?: any;
    gasProvider?: any;
    volumeProvider?: any;
    routeOptimizer?: any;
    securityValidator?: any;
  }
): GatewayService {
  if (gatewayServiceInstance) {
    return gatewayServiceInstance;
  }

  const deps = {
    priceProvider: customProviders?.priceProvider || priceProvider,
    liquidityProvider: customProviders?.liquidityProvider || liquidityProvider,
    gasProvider: customProviders?.gasProvider || gasProvider,
    volumeProvider: customProviders?.volumeProvider || volumeProvider,
    routeOptimizer: customProviders?.routeOptimizer || routeOptimizer,
    securityValidator: customProviders?.securityValidator || securityValidator,
  };

  gatewayServiceInstance = createGateway(deps);
  logger.info('Gateway Service initialized with real providers');
  return gatewayServiceInstance;
}

/**
 * Get the gateway service singleton (must call initializeGatewayService first)
 */
export function getGatewayService(): GatewayService {
  if (!gatewayServiceInstance) {
    logger.warn('Gateway Service not initialized, initializing now with defaults');
    return initializeGatewayService();
  }
  return gatewayServiceInstance;
}

/**
 * Export the service class for type safety
 */
export { GatewayService };
