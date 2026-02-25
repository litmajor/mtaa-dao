/**
 * Arbitrage Opportunity Repository
 * Data access layer for arbitrage detection and tracking
 */

import { db } from '../db';
import { ArbitrageOpportunity } from '../../types/cex.types';

export class ArbitrageRepository {
  /**
   * Create a new arbitrage opportunity record
   */
  static async recordOpportunity(
    tradingPair: string,
    buyExchange: string,
    buyPrice: string,
    sellExchange: string,
    sellPrice: string,
    spreadPercent: string,
    spreadAmount: string,
    estimatedProfit?: string,
    buyLiquidity?: string,
    sellLiquidity?: string,
    buyFeePercent?: string,
    sellFeePercent?: string,
    netProfit?: string
  ): Promise<ArbitrageOpportunity> {
    const result = await db.query(
      `INSERT INTO arbitrage_opportunities (
        trading_pair, buy_exchange, buy_price, sell_exchange, sell_price,
        spread_percent, spread_amount, estimated_profit, buy_liquidity,
        sell_liquidity, buy_fee_percent, sell_fee_percent, net_profit
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        tradingPair,
        buyExchange,
        buyPrice,
        sellExchange,
        sellPrice,
        spreadPercent,
        spreadAmount,
        estimatedProfit,
        buyLiquidity,
        sellLiquidity,
        buyFeePercent || '0.1',
        sellFeePercent || '0.1',
        netProfit,
      ]
    );
    return this.mapToCamelCase(result.rows[0]);
  }

  /**
   * Get active (recently detected) opportunities
   */
  static async getActiveOpportunities(
    minProfitPercent: string = '0.5',
    limit: number = 50
  ): Promise<ArbitrageOpportunity[]> {
    const result = await db.query(
      `SELECT * FROM arbitrage_opportunities
       WHERE status = 'detected'
         AND spread_percent >= $1
         AND detected_at > NOW() - INTERVAL '5 minutes'
       ORDER BY spread_percent DESC, detected_at DESC
       LIMIT $2`,
      [minProfitPercent, limit]
    );
    return result.rows.map(row => this.mapToCamelCase(row));
  }

  /**
   * Get opportunities by trading pair
   */
  static async getOpportunitiesByPair(
    tradingPair: string,
    limit: number = 20
  ): Promise<ArbitrageOpportunity[]> {
    const result = await db.query(
      `SELECT * FROM arbitrage_opportunities
       WHERE trading_pair = $1 AND status = 'detected'
       ORDER BY detected_at DESC
       LIMIT $2`,
      [tradingPair, limit]
    );
    return result.rows.map(row => this.mapToCamelCase(row));
  }

  /**
   * Get highest profit opportunities
   */
  static async getHighestProfitOpportunities(
    limit: number = 10
  ): Promise<ArbitrageOpportunity[]> {
    const result = await db.query(
      `SELECT * FROM arbitrage_opportunities
       WHERE status = 'detected'
       ORDER BY net_profit DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(row => this.mapToCamelCase(row));
  }

  /**
   * Mark opportunity as executed
   */
  static async markAsExecuted(opportunityId: string): Promise<void> {
    await db.query(
      `UPDATE arbitrage_opportunities
       SET status = 'executed', executed_at = NOW()
       WHERE id = $1`,
      [opportunityId]
    );
  }

  /**
   * Mark opportunity as expired
   */
  static async markAsExpired(opportunityId: string): Promise<void> {
    await db.query(
      `UPDATE arbitrage_opportunities
       SET status = 'expired'
       WHERE id = $1`,
      [opportunityId]
    );
  }

  /**
   * Clean up old opportunities (older than specified minutes)
   */
  static async cleanupOldOpportunities(minutesOld: number = 30): Promise<number> {
    const result = await db.query(
      `DELETE FROM arbitrage_opportunities
       WHERE status IN ('expired', 'executed')
         AND created_at < NOW() - INTERVAL '1 minute' * $1`,
      [minutesOld]
    );
    return result.rowCount || 0;
  }

  /**
   * Get statistics on arbitrage opportunities
   */
  static async getStatistics(): Promise<{
    totalDetected: number;
    totalExecuted: number;
    totalExpired: number;
    averageSpread: string;
    maxProfit: string;
    lastDetected: Date | null;
  }> {
    const result = await db.query(
      `SELECT
        COUNT(CASE WHEN status = 'detected' THEN 1 END) as total_detected,
        COUNT(CASE WHEN status = 'executed' THEN 1 END) as total_executed,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as total_expired,
        AVG(CAST(spread_percent as DECIMAL)) as average_spread,
        MAX(CAST(net_profit as DECIMAL)) as max_profit,
        MAX(detected_at) as last_detected
       FROM arbitrage_opportunities`
    );
    
    const row = result.rows[0];
    return {
      totalDetected: parseInt(row.total_detected) || 0,
      totalExecuted: parseInt(row.total_executed) || 0,
      totalExpired: parseInt(row.total_expired) || 0,
      averageSpread: row.average_spread?.toString() || '0',
      maxProfit: row.max_profit?.toString() || '0',
      lastDetected: row.last_detected ? new Date(row.last_detected) : null,
    };
  }

  /**
   * Map snake_case to camelCase
   */
  private static mapToCamelCase(row: any): ArbitrageOpportunity {
    return {
      id: row.id,
      tradingPair: row.trading_pair,
      buyExchange: row.buy_exchange,
      buyPrice: row.buy_price,
      sellExchange: row.sell_exchange,
      sellPrice: row.sell_price,
      spreadPercent: row.spread_percent,
      spreadAmount: row.spread_amount,
      estimatedProfit: row.estimated_profit,
      buyLiquidity: row.buy_liquidity,
      sellLiquidity: row.sell_liquidity,
      buyFeePercent: row.buy_fee_percent,
      sellFeePercent: row.sell_fee_percent,
      netProfit: row.net_profit,
      status: row.status,
      createdAt: new Date(row.created_at),
      detectedAt: new Date(row.detected_at),
      executedAt: row.executed_at ? new Date(row.executed_at) : undefined,
    };
  }
}
