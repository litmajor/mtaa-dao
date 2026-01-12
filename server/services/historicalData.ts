/**
 * Historical Data Service
 * Manages historical OHLCV data and analysis across different time periods
 */

import ccxtService from './ccxtService';
import { logger } from '../utils/logger';

export interface HistoricalDataPoint {
  timestamp: number;
  date: string; // ISO 8601 format (YYYY-MM-DD)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePercent: number;
}

export interface HistoricalStats {
  period: string;
  dataPoints: number;
  startDate: string;
  endDate: string;
  highPrice: number;
  highDate: string;
  lowPrice: number;
  lowDate: string;
  openPrice: number;
  closePrice: number;
  changePercent: number;
  changeAbsolute: number;
  volatility: number; // Standard deviation of returns
  averageVolume: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number; // Risk-adjusted return
  cumulativeReturn: number;
  daysUp: number;
  daysDown: number;
  winRate: number;
}

export interface HistoricalAnalysis {
  symbol: string;
  exchange: string;
  period: '1m' | '3m' | '6m' | '1y' | 'all';
  timestamp: number;
  data: HistoricalDataPoint[];
  stats: HistoricalStats;
}

/**
 * Get days for a specific period
 */
function getPeriodDays(period: '1m' | '3m' | '6m' | '1y' | 'all'): number {
  const periods: Record<string, number> = {
    '1m': 30,
    '3m': 90,
    '6m': 180,
    '1y': 365,
    'all': 730 // 2 years default max
  };
  return periods[period] || 30;
}

/**
 * Get appropriate timeframe for OHLCV data based on period
 */
function getTimeframeForPeriod(period: '1m' | '3m' | '6m' | '1y' | 'all'): string {
  if (period === '1m') return '1d'; // Daily candles for 1 month = 30 candles
  if (period === '3m') return '1d'; // Daily candles for 3 months = 90 candles
  if (period === '6m') return '1d'; // Daily candles for 6 months = 180 candles
  if (period === '1y') return '1d'; // Daily candles for 1 year = 365 candles
  return '1d'; // Default to daily
}

/**
 * Calculate standard deviation (volatility)
 */
function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;

  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const squareDiffs = prices.map((value) => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  const stdDev = Math.sqrt(avgSquareDiff);

  // Return as percentage of mean
  return (stdDev / mean) * 100;
}

/**
 * Calculate daily returns
 */
function calculateReturns(prices: number[]): number[] {
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const returnValue = (prices[i] - prices[i - 1]) / prices[i - 1];
    returns.push(returnValue);
  }
  return returns;
}

/**
 * Calculate Sharpe Ratio (risk-adjusted return)
 * Assumes risk-free rate of 0% for simplicity
 */
function calculateSharpeRatio(returns: number[]): number {
  if (returns.length < 2) return 0;

  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const squareDiffs = returns.map((value) => Math.pow(value - meanReturn, 2));
  const variance = squareDiffs.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  // Annualized Sharpe Ratio (assuming 252 trading days per year)
  return (meanReturn * 252) / (stdDev * Math.sqrt(252));
}

/**
 * Calculate maximum drawdown
 */
function calculateMaxDrawdown(prices: number[]): { maxDrawdown: number; maxDrawdownPercent: number } {
  if (prices.length < 2) return { maxDrawdown: 0, maxDrawdownPercent: 0 };

  let maxPrice = prices[0];
  let maxDrawdown = 0;

  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > maxPrice) {
      maxPrice = prices[i];
    }
    const drawdown = maxPrice - prices[i];
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  const maxDrawdownPercent = (maxDrawdown / maxPrice) * 100;
  return { maxDrawdown, maxDrawdownPercent };
}

/**
 * Format date to ISO string
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Fetch and analyze historical data for a given period
 */
export async function getHistoricalAnalysis(
  symbol: string,
  exchange: string,
  period: '1m' | '3m' | '6m' | '1y' | 'all' = '1y'
): Promise<HistoricalAnalysis> {
  try {
    const days = getPeriodDays(period);
    const timeframe = getTimeframeForPeriod(period);
    const limit = Math.min(days, 500); // API limit of 500 candles

    logger.debug(`Fetching historical data: ${symbol} on ${exchange} for ${period}`);

    // Fetch OHLCV data from exchange
    const ohlcvData = await ccxtService.getOHLCVFromExchange(
      exchange,
      symbol,
      timeframe,
      limit
    );

    if (!ohlcvData || ohlcvData.length === 0) {
      throw new Error(`No historical data available for ${symbol} on ${exchange}`);
    }

    // Convert CCXT format to our format
    const data: HistoricalDataPoint[] = ohlcvData.map((candle, index) => {
      const [timestamp, open, high, low, close, volume] = candle;
      const prevClose = index > 0 ? ohlcvData[index - 1][4] : close;
      const changePercent = ((close - prevClose) / prevClose) * 100;

      return {
        timestamp,
        date: formatDate(timestamp),
        open,
        high,
        low,
        close,
        volume,
        changePercent
      };
    });

    // Extract prices and volumes
    const prices = data.map((d) => d.close);
    const volumes = data.map((d) => d.volume);
    const opens = data.map((d) => d.open);
    const closes = data.map((d) => d.close);
    const highs = data.map((d) => d.high);
    const lows = data.map((d) => d.low);

    // Calculate statistics
    const highPrice = Math.max(...highs);
    const lowPrice = Math.min(...lows);
    const highIndex = highs.indexOf(highPrice);
    const lowIndex = lows.indexOf(lowPrice);

    const openPrice = opens[0];
    const closePrice = closes[closes.length - 1];
    const changePercent = ((closePrice - openPrice) / openPrice) * 100;
    const changeAbsolute = closePrice - openPrice;

    const volatility = calculateVolatility(prices);
    const averageVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const returns = calculateReturns(prices);
    const sharpeRatio = calculateSharpeRatio(returns);
    const { maxDrawdown, maxDrawdownPercent } = calculateMaxDrawdown(prices);

    // Count up/down days
    let daysUp = 0;
    let daysDown = 0;
    data.forEach((d) => {
      if (d.changePercent > 0) daysUp++;
      else if (d.changePercent < 0) daysDown++;
    });
    const winRate = ((daysUp / (daysUp + daysDown)) * 100) || 0;

    // Cumulative return
    const cumulativeReturn = ((closePrice - openPrice) / openPrice) * 100;

    const stats: HistoricalStats = {
      period,
      dataPoints: data.length,
      startDate: data[0].date,
      endDate: data[data.length - 1].date,
      highPrice,
      highDate: data[highIndex].date,
      lowPrice,
      lowDate: data[lowIndex].date,
      openPrice,
      closePrice,
      changePercent: Math.round(changePercent * 100) / 100,
      changeAbsolute: Math.round(changeAbsolute * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
      averageVolume: Math.round(averageVolume),
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      cumulativeReturn: Math.round(cumulativeReturn * 100) / 100,
      daysUp,
      daysDown,
      winRate: Math.round(winRate * 100) / 100
    };

    return {
      symbol,
      exchange,
      period,
      timestamp: Date.now(),
      data,
      stats
    };
  } catch (error: any) {
    logger.error(`Historical data fetch failed: ${error.message}`);
    throw error;
  }
}

/**
 * Compare historical data across multiple periods
 */
export async function compareHistoricalPeriods(
  symbol: string,
  exchange: string
): Promise<{
  symbol: string;
  exchange: string;
  periods: HistoricalAnalysis[];
  comparison: Record<string, any>;
}> {
  try {
    const periods: Array<'1m' | '3m' | '6m' | '1y'> = ['1m', '3m', '6m', '1y'];
    const results = await Promise.all(
      periods.map((period) => getHistoricalAnalysis(symbol, exchange, period))
    );

    // Create comparison metrics
    const comparison = {
      best1mChange: results[0].stats.changePercent,
      best3mChange: results[1].stats.changePercent,
      best6mChange: results[2].stats.changePercent,
      best1yChange: results[3].stats.changePercent,
      volatility1m: results[0].stats.volatility,
      volatility3m: results[1].stats.volatility,
      volatility6m: results[2].stats.volatility,
      volatility1y: results[3].stats.volatility,
      best1mVolatility: results[0].stats.volatility,
      best3mVolatility: results[1].stats.volatility,
      best6mVolatility: results[2].stats.volatility,
      best1yVolatility: results[3].stats.volatility
    };

    return {
      symbol,
      exchange,
      periods: results,
      comparison
    };
  } catch (error: any) {
    logger.error(`Historical comparison failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get price performance over specific date ranges
 */
export async function getPricePerformance(
  symbol: string,
  exchange: string,
  startDate: Date,
  endDate: Date
): Promise<HistoricalAnalysis> {
  try {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (days > 730) {
      throw new Error('Date range exceeds maximum of 2 years');
    }

    const limit = Math.min(days, 500);
    const timeframe = days > 365 ? '1d' : '1d'; // Use daily candles

    const ohlcvData = await ccxtService.getOHLCVFromExchange(
      exchange,
      symbol,
      timeframe,
      limit
    );

    if (!ohlcvData || ohlcvData.length === 0) {
      throw new Error(`No data available for the specified date range`);
    }

    // Convert and filter by date range
    const data: HistoricalDataPoint[] = ohlcvData
      .map((candle, index) => {
        const [timestamp, open, high, low, close, volume] = candle;
        const prevClose = index > 0 ? ohlcvData[index - 1][4] : close;
        const changePercent = ((close - prevClose) / prevClose) * 100;

        return {
          timestamp,
          date: formatDate(timestamp),
          open,
          high,
          low,
          close,
          volume,
          changePercent
        };
      })
      .filter((d) => {
        const date = new Date(d.date);
        return date >= startDate && date <= endDate;
      });

    if (data.length === 0) {
      throw new Error('No data points in the specified date range');
    }

    // Recalculate stats for filtered data
    const prices = data.map((d) => d.close);
    const volumes = data.map((d) => d.volume);
    const highs = data.map((d) => d.high);
    const lows = data.map((d) => d.low);

    const highPrice = Math.max(...highs);
    const lowPrice = Math.min(...lows);
    const highIndex = highs.indexOf(highPrice);
    const lowIndex = lows.indexOf(lowPrice);

    const openPrice = data[0].open;
    const closePrice = data[data.length - 1].close;
    const changePercent = ((closePrice - openPrice) / openPrice) * 100;

    const volatility = calculateVolatility(prices);
    const averageVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const returns = calculateReturns(prices);
    const sharpeRatio = calculateSharpeRatio(returns);
    const { maxDrawdown, maxDrawdownPercent } = calculateMaxDrawdown(prices);

    let daysUp = 0;
    let daysDown = 0;
    data.forEach((d) => {
      if (d.changePercent > 0) daysUp++;
      else if (d.changePercent < 0) daysDown++;
    });
    const winRate = ((daysUp / (daysUp + daysDown)) * 100) || 0;

    const stats: HistoricalStats = {
      period: 'custom' as any,
      dataPoints: data.length,
      startDate: data[0].date,
      endDate: data[data.length - 1].date,
      highPrice,
      highDate: data[highIndex].date,
      lowPrice,
      lowDate: data[lowIndex].date,
      openPrice,
      closePrice,
      changePercent: Math.round(changePercent * 100) / 100,
      changeAbsolute: Math.round((closePrice - openPrice) * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
      averageVolume: Math.round(averageVolume),
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      cumulativeReturn: Math.round(changePercent * 100) / 100,
      daysUp,
      daysDown,
      winRate: Math.round(winRate * 100) / 100
    };

    return {
      symbol,
      exchange,
      period: 'custom' as any,
      timestamp: Date.now(),
      data,
      stats
    };
  } catch (error: any) {
    logger.error(`Price performance fetch failed: ${error.message}`);
    throw error;
  }
}
