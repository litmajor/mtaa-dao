import { getGatewayService } from './gateway';
import { logger } from '../utils/logger';

export interface MarketDataQueryOptions {
  chainId?: number;
  source?: string;
}

class MarketDataClient {
  async getPrice(token: string, chainId: number, source?: string) {
    const { priceOracle } = await import('./priceOracle');
    return await priceOracle.getPrice(token);
  }

  async getPrices(tokens: string[], chainId: number, source?: string) {
    const { priceOracle } = await import('./priceOracle');
    const prices = await priceOracle.getPrices(tokens);
    return Object.fromEntries(Array.from(prices.entries()).map(([token, value]) => [token, value]));
  }

  async getLiquidity(tokenA: string, tokenB: string, chainId: number) {
    try {
      const gateway = getGatewayService();
      if (typeof (gateway as any).getLiquidityInfo === 'function') {
        return await (gateway as any).getLiquidityInfo(tokenA, tokenB, chainId);
      }
    } catch (error) {
      logger.warn('Gateway liquidity provider unavailable, using fallback path', { error });
    }

    return {
      tokenA,
      tokenB,
      chainId,
      liquidity: '0',
      depth: {},
      fee: 0,
      source: 'fallback',
    };
  }

  async getGasPrices(chainId: number) {
    try {
      const gateway = getGatewayService();
      if (typeof (gateway as any).getGasPrices === 'function') {
        return await (gateway as any).getGasPrices(chainId);
      }
    } catch (error) {
      logger.warn('Gateway gas provider unavailable, using fallback path', { error });
    }

    const { gasPriceOracle } = await import('./gasPriceOracle');
    return await (gasPriceOracle as any).getCurrentGasPrices({ getFeeData: async () => ({ maxFeePerGas: 0n, maxPriorityFeePerGas: 0n }), getGasPrice: async () => 0n } as any, String(chainId));
  }

  async getVolume(pair: string, chainId: number, timeframe: '24h' | '7d' | 'monthly' = '24h') {
    try {
      const gateway = getGatewayService();
      if (typeof (gateway as any).getVolumeData === 'function') {
        return await (gateway as any).getVolumeData(pair, chainId, timeframe);
      }
    } catch (error) {
      logger.warn('Gateway volume provider unavailable, using fallback path', { error });
    }

    const { ccxtService } = await import('./ccxtService');
    const volume = await ccxtService.getOHLCV(pair, '1h', 1).catch(() => null);
    return volume;
  }

  async getCandles(symbol: string, timeframe: string, limit: number, exchange = 'auto') {
    try {
      const gateway = getGatewayService();
      if (typeof (gateway as any).getCandles === 'function') {
        return await (gateway as any).getCandles(symbol, timeframe, limit, exchange);
      }
    } catch (error) {
      logger.warn('Gateway candle provider unavailable, using fallback path', { error });
    }

    const { ohlcvService } = await import('./ohlcvService');
    return await ohlcvService.getCandles(symbol, timeframe, limit, exchange);
  }
}

export const marketDataClient = new MarketDataClient();
export default marketDataClient;
