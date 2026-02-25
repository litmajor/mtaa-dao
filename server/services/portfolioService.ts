/**
 * Portfolio Service (TypeScript-First Implementation)
 * 
 * Direct portfolio calculation and metrics computation.
 * No Python backend dependency for portfolio analytics.
 * 
 * Supersedes: backend/models/__init__.py (PortfolioSummary - v0.1)
 *             backend/models/portfolio.py (if exists)
 */

import { logger } from '../utils/logger';
import { cacheService } from './cacheService';
import { priceOracle } from './priceOracle';

export interface PortfolioHolding {
  symbol: string;
  amount: number;
  valueUsd: number;
  allocation: number;
  costBasis?: number;
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
}

export interface PortfolioMetrics {
  totalValueUsd: number;
  totalCostBasisUsd: number;
  totalProfit: number;
  totalReturnPercent: number;
  
  // Risk metrics
  winRate: number;           // Percentage of profitable positions
  sharpeRatio: number;       // Risk-adjusted return
  maxDrawdown: number;       // Worst peak-to-trough decline
  
  // Composition
  symbols: string[];
  allocation: Record<string, number>;
  
  // Distribution
  topHolding: { symbol: string; allocation: number };
  concentration: number;     // Herfindahl index (0-100, higher = more concentrated)
  
  // Time-based
  lastUpdated: number;
  dayChange: number;
  dayChangePercent: number;
}

export interface PortfolioData {
  holdings: PortfolioHolding[];
  metrics: PortfolioMetrics;
}

class PortfolioService {
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes (portfolio changes slower)
  
  // Mock portfolio for development/testing
  // In production, would load from database
  private mockPortfolio: Map<string, PortfolioHolding[]> = new Map([
    ['default', [
      { symbol: 'SOL', amount: 100, valueUsd: 14250, allocation: 0.40, costBasis: 12000 },
      { symbol: 'ETH', amount: 50, valueUsd: 15750, allocation: 0.35, costBasis: 15000 },
      { symbol: 'USDC', amount: 8937.5, valueUsd: 8937.5, allocation: 0.25, costBasis: 8937.5 }
    ]]
  ]);

  /**
   * Get portfolio summary (holdings + metrics)
   * 
   * Returns: Complete portfolio data with calculations
   * Cache: 5 minutes
   */
  async getPortfolioSummary(userId: string = 'default'): Promise<PortfolioData | null> {
    const cacheKey = `portfolio:summary:${userId}`;
    
    try {
      // Check cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.debug(`Portfolio cache hit for ${userId}`);
        return cached;
      }

      logger.info(`Computing portfolio summary for ${userId}`);

      // Load holdings (from DB in production, mock for now)
      const holdings = await this.getHoldings(userId);
      if (!holdings || holdings.length === 0) {
        logger.warn(`No holdings found for ${userId}`);
        return null;
      }

      // Calculate metrics
      const metrics = await this.calculateMetrics(holdings);

      const result: PortfolioData = {
        holdings,
        metrics
      };

      // Cache result
      await cacheService.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      logger.error(`Failed to get portfolio summary for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get just the holdings for a user
   */
  async getHoldings(userId: string = 'default'): Promise<PortfolioHolding[] | null> {
    try {
      // In production: Load from database
      // For now: Use mock data
      const holdings = this.mockPortfolio.get(userId) || this.mockPortfolio.get('default');
      
      if (!holdings) {
        return null;
      }

      // Refresh prices for each holding
      const symbols = holdings.map(h => h.symbol);
      const prices = await priceOracle.getPrices(symbols);

      // Update values with fresh prices
      return holdings.map(holding => ({
        ...holding,
        valueUsd: (prices.get(holding.symbol)?.priceUsd || holding.valueUsd / holding.amount) * holding.amount
      }));
    } catch (error) {
      logger.error(`Failed to get holdings for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get allocation (symbol → percentage)
   */
  async getAllocation(userId: string = 'default'): Promise<Record<string, number> | null> {
    try {
      const holdings = await this.getHoldings(userId);
      if (!holdings) return null;

      const totalValue = holdings.reduce((sum, h) => sum + h.valueUsd, 0);
      
      return holdings.reduce((alloc, holding) => ({
        ...alloc,
        [holding.symbol]: totalValue > 0 ? holding.valueUsd / totalValue : 0
      }), {} as Record<string, number>);
    } catch (error) {
      logger.error(`Failed to calculate allocation for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Add holding to portfolio
   */
  async addHolding(userId: string, holding: Omit<PortfolioHolding, 'allocation'>): Promise<boolean> {
    try {
      logger.info(`Adding holding: ${holding.symbol} (${holding.amount} units) for ${userId}`);
      
      // In production: Save to database
      const portfolio = this.mockPortfolio.get(userId) || [];
      
      // Check if already exists
      const existing = portfolio.findIndex(h => h.symbol === holding.symbol);
      if (existing >= 0) {
        // Update existing
        portfolio[existing] = {
          ...portfolio[existing],
          amount: portfolio[existing].amount + holding.amount,
          valueUsd: portfolio[existing].valueUsd + holding.valueUsd,
          costBasis: (portfolio[existing].costBasis || 0) + (holding.costBasis || 0)
        };
      } else {
        // Add new
        portfolio.push({
          ...holding,
          allocation: 0 // Will be recalculated
        });
      }
      
      this.mockPortfolio.set(userId, portfolio);
      
      // Invalidate cache
      await cacheService.delete(`portfolio:summary:${userId}`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to add holding:`, error);
      return false;
    }
  }

  /**
   * Remove or reduce holding
   */
  async removeHolding(userId: string, symbol: string, amountToRemove?: number): Promise<boolean> {
    try {
      const portfolio = this.mockPortfolio.get(userId);
      if (!portfolio) return false;

      const index = portfolio.findIndex(h => h.symbol === symbol);
      if (index < 0) return false;

      if (!amountToRemove || amountToRemove >= portfolio[index].amount) {
        // Remove entirely
        portfolio.splice(index, 1);
      } else {
        // Reduce amount
        const ratio = (portfolio[index].amount - amountToRemove) / portfolio[index].amount;
        portfolio[index].amount -= amountToRemove;
        portfolio[index].valueUsd *= ratio;
      }

      this.mockPortfolio.set(userId, portfolio);
      
      // Invalidate cache
      await cacheService.delete(`portfolio:summary:${userId}`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to remove holding:`, error);
      return false;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PRIVATE: METRICS CALCULATION
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Calculate all portfolio metrics from holdings
   */
  private async calculateMetrics(holdings: PortfolioHolding[]): Promise<PortfolioMetrics> {
    // Total value and cost basis
    const totalValueUsd = holdings.reduce((sum, h) => sum + h.valueUsd, 0);
    const totalCostBasisUsd = holdings.reduce((sum, h) => sum + (h.costBasis || h.valueUsd), 0);
    const totalProfit = totalValueUsd - totalCostBasisUsd;
    const totalReturnPercent = totalCostBasisUsd > 0 
      ? (totalProfit / totalCostBasisUsd) * 100 
      : 0;

    // Win rate (profitable positions)
    const profitableCount = holdings.filter(h => {
      const pnl = h.valueUsd - (h.costBasis || h.valueUsd);
      return pnl > 0;
    }).length;
    const winRate = holdings.length > 0 ? (profitableCount / holdings.length) * 100 : 0;

    // Sharpe ratio (simplified: return per unit of volatility)
    // Real calculation would use historical returns
    const sharpeRatio = totalReturnPercent > 0 ? totalReturnPercent / 10 : 0; // Simplified

    // Max drawdown (simplified: worst single holding loss)
    const maxDrawdown = Math.min(
      ...holdings.map(h => {
        const pnl = h.valueUsd - (h.costBasis || h.valueUsd);
        if (pnl < 0) return (pnl / (h.costBasis || h.valueUsd)) * 100;
        return 0;
      }),
      0
    );

    // Allocation
    const allocation = holdings.reduce((alloc, holding) => ({
      ...alloc,
      [holding.symbol]: totalValueUsd > 0 ? holding.valueUsd / totalValueUsd : 0
    }), {} as Record<string, number>);

    // Top holding
    const topHolding = holdings.reduce((max, h) => 
      h.allocation > (max.allocation || 0) ? h : max,
      { symbol: '', allocation: 0 } as any
    );

    // Concentration (Herfindahl index)
    const concentration = Object.values(allocation).reduce((sum, alloc) => sum + Math.pow(alloc, 2), 0) * 100;

    // Day change (mock: would need historical data)
    const dayChange = totalValueUsd * 0.02; // Mock 2% daily change
    const dayChangePercent = 2;

    return {
      totalValueUsd,
      totalCostBasisUsd,
      totalProfit,
      totalReturnPercent: Math.round(totalReturnPercent * 100) / 100,
      winRate: Math.round(winRate * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      symbols: holdings.map(h => h.symbol),
      allocation,
      topHolding: {
        symbol: topHolding.symbol,
        allocation: topHolding.allocation
      },
      concentration,
      lastUpdated: Date.now(),
      dayChange,
      dayChangePercent
    };
  }

  /**
   * Clear portfolio cache
   */
  async clearCache(userId?: string): Promise<void> {
    if (userId) {
      await cacheService.delete(`portfolio:summary:${userId}`);
    } else {
      // Clear all portfolio caches
      const keys = Array.from(this.mockPortfolio.keys());
      for (const key of keys) {
        await cacheService.delete(`portfolio:summary:${key}`);
      }
    }
  }
}

export const portfolioService = new PortfolioService();
