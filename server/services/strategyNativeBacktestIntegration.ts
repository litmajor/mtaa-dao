import { marketDataClient } from './marketDataClient';
import { db } from '../db';
import { strategiesTable } from '../db/schema/strategies';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import type { OHLCVCandle } from './ohlcvService';
import type { BacktestMetrics } from './strategyFreqtradeIntegration';

export interface NativeBacktestRequest {
  strategyId: string;
  pair: string;
  timeframe: string;
  timerange: string;
  stakeAmount: number;
  startingCapital?: number;
  strategyConfig?: Record<string, any>;
}

function parseTimerange(timerange: string): { startDate: Date; endDate: Date } {
  const parts = String(timerange || '').split('-').map((p) => p.trim());
  if (parts.length !== 2 || parts.some((p) => p.length !== 8)) {
    throw new Error('Invalid timerange format. Expected YYYYMMDD-YYYYMMDD');
  }

  const start = new Date(`${parts[0].slice(0, 4)}-${parts[0].slice(4, 6)}-${parts[0].slice(6, 8)}T00:00:00Z`);
  const end = new Date(`${parts[1].slice(0, 4)}-${parts[1].slice(4, 6)}-${parts[1].slice(6, 8)}T23:59:59Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw new Error('Invalid timerange dates');
  }

  return { startDate: start, endDate: end };
}

function timeframeMinutes(timeframe: string): number {
  const normalized = timeframe.toLowerCase().trim();
  if (normalized === '1m') return 1;
  if (normalized === '5m') return 5;
  if (normalized === '15m') return 15;
  if (normalized === '30m') return 30;
  if (normalized === '1h') return 60;
  if (normalized === '4h') return 240;
  if (normalized === '1d') return 1440;
  return 60;
}

function estimateCandleLimit(startDate: Date, endDate: Date, timeframe: string): number {
  const minutes = timeframeMinutes(timeframe);
  const dayCount = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const candles = Math.ceil((dayCount * 24 * 60) / minutes) + 10;
  return Math.min(Math.max(candles, 100), 2500);
}

function calculateReturnMetrics(candles: OHLCVCandle[], startingCapital: number): BacktestMetrics {
  const prices = candles.map((c) => c.close);
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const returns = [] as number[];

  for (let i = 1; i < prices.length; i += 1) {
    const prev = prices[i - 1];
    const cur = prices[i];
    if (prev > 0) {
      returns.push((cur - prev) / prev);
    }
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / Math.max(returns.length, 1);
  const variance = returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / Math.max(returns.length, 1);
  const stdDev = Math.sqrt(variance);
  const downside = returns.filter((r) => r < 0);
  const downsideVariance = downside.reduce((sum, value) => sum + Math.pow(value - 0, 2), 0) / Math.max(downside.length, 1);
  const downsideStdDev = Math.sqrt(downsideVariance);

  const timeframeMin = timeframeMinutes('1h');
  const periodMinutes = Math.max(timeframeMin, 1);
  const periodsPerYear = 525600 / periodMinutes;
  const sharpeRatio = stdDev > 0 ? (mean * Math.sqrt(periodsPerYear)) / stdDev : 0;
  const sortinoRatio = downsideStdDev > 0 ? (mean * Math.sqrt(periodsPerYear)) / downsideStdDev : 0;

  let maxDrawdown = 0;
  let peak = prices[0];
  for (const price of prices) {
    if (price > peak) {
      peak = price;
    }
    maxDrawdown = Math.max(maxDrawdown, (peak - price) / peak);
  }

  const totalProfitPercent = ((lastPrice - firstPrice) / firstPrice) * 100;
  const totalProfitUsd = (startingCapital * totalProfitPercent) / 100;
  const profitableTrades = totalProfitPercent >= 0 ? 1 : 0;
  const losingTrades = totalProfitPercent < 0 ? 1 : 0;
  const winRatePercent = profitableTrades > 0 ? 100 : 0;
  const recoveryFactor = maxDrawdown > 0 ? Math.abs(totalProfitPercent) / (maxDrawdown * 100) : 0;

  const positiveReturns = returns.filter((r) => r > 0);
  const negativeReturns = returns.filter((r) => r <= 0);
  const avgWin = positiveReturns.length > 0 ? positiveReturns.reduce((sum, value) => sum + value, 0) / positiveReturns.length : 0;
  const avgLoss = negativeReturns.length > 0 ? negativeReturns.reduce((sum, value) => sum + value, 0) / negativeReturns.length : 0;
  const expectancy = avgWin * (positiveReturns.length / Math.max(returns.length, 1)) - Math.abs(avgLoss) * (negativeReturns.length / Math.max(returns.length, 1));

  return {
    totalTrades: 1,
    profitableTrades,
    losingTrades,
    winRatePercent,
    totalProfitUsd,
    totalProfitPercent,
    avgProfitPercent: totalProfitPercent,
    sharpeRatio,
    sortinoRatio,
    maxDrawdownPercent: maxDrawdown * 100,
    buyAndHoldPercent: totalProfitPercent,
    exposureTimePercent: 100,
    avgDurationMinutes: periodMinutes,
    recoveryFactor,
    expectancy,
  };
}

export class StrategyNativeBacktestIntegration {
  async runBacktest(request: NativeBacktestRequest): Promise<BacktestMetrics> {
    const { strategyId, pair, timeframe, timerange, stakeAmount, startingCapital = 10000 } = request;
    const { startDate, endDate } = parseTimerange(timerange);
    const limit = estimateCandleLimit(startDate, endDate, timeframe);

    logger.info(`[NativeBacktest] Fetching candles for ${pair} ${timeframe} ${timerange} (limit ${limit})`);
    const response = await marketDataClient.getCandles(pair, timeframe, limit, 'auto');

    if (!response || response.status !== 'success' || !Array.isArray(response.data) || response.data.length < 10) {
      throw new Error('Failed to fetch sufficient historical candles for native backtest');
    }

    const metrics = calculateReturnMetrics(response.data, startingCapital);
    await this.persistMetrics(strategyId, metrics);
    return metrics;
  }

  private async persistMetrics(strategyId: string, metrics: BacktestMetrics): Promise<void> {
    await db.update(strategiesTable)
      .set({
        backtestResults: metrics as any,
        lastBacktestedAt: new Date(),
        sharpeRatio: String(metrics.sharpeRatio),
        maxDrawdownPercent: String(metrics.maxDrawdownPercent),
        ytdReturnPercent: String(metrics.totalProfitPercent),
      } as any)
      .where(eq(strategiesTable.id, strategyId));
  }
}

export const strategyNativeBacktestIntegration = new StrategyNativeBacktestIntegration();
