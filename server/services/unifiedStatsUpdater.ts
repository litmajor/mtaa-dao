/**
 * Unified Stats Updater Service
 * 
 * Maintains denormalized statistics across all YUKI endpoints:
 * - venue_execution_stats: Trading metrics by venue + symbol
 * - exchange_balance_summary: User balance snapshots by exchange
 * - order_execution_history: Execution summaries by order type
 * 
 * Replaces expensive GROUP BY + COUNT/AVG queries with denormalized lookups
 * Updates triggered by database triggers (async, non-blocking)
 * Reconciliation runs hourly to catch any drifts
 */

import { pool } from '../db';
import { logger } from '../utils/logger';

class UnifiedStatsUpdater {
  /**
   * Update venue execution stats (replaces market.ts GROUP BY query)
   * Called when execution_metrics records are inserted for a venue+symbol combo
   */
  async updateVenueExecutionStats(
    userId: string,
    symbol: string,
    venue: string,
    timeWindow: string = '1 day'
  ): Promise<void> {
    try {
      // Calculate fresh stats from execution_metrics
      const statsResult = await pool.query(
        `SELECT 
          AVG(execution_price) as avg_price,
          MAX(execution_price) - MIN(execution_price) as price_range,
          COUNT(*) as trade_count,
          MAX(recorded_at) as last_trade,
          AVG(slippage_percent) as avg_slippage,
          COUNT(CASE WHEN success THEN 1 END)::float / COUNT(*) as success_rate
         FROM execution_metrics
         WHERE user_id = $1 AND symbol = $2 AND venue = $3 
         AND recorded_at > NOW() - INTERVAL '${timeWindow}'`,
        [userId, symbol, venue]
      );

      const stats = statsResult.rows[0];

      // Upsert denormalized stats
      await pool.query(
        `INSERT INTO venue_execution_stats 
         (user_id, symbol, venue, avg_price, price_range, trade_count, last_trade, avg_slippage, success_rate, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (user_id, symbol, venue) 
         DO UPDATE SET 
           avg_price = $4,
           price_range = $5,
           trade_count = $6,
           last_trade = $7,
           avg_slippage = $8,
           success_rate = $9,
           updated_at = NOW()`,
        [
          userId,
          symbol,
          venue,
          stats.avg_price || 0,
          stats.price_range || 0,
          stats.trade_count || 0,
          stats.last_trade || null,
          stats.avg_slippage || 0,
          stats.success_rate || 0,
        ]
      );

      logger.debug(`[Stats] Updated venue stats: ${userId}/${symbol}@${venue}`);
    } catch (error) {
      logger.error(`[Stats] Failed to update venue stats:`, error);
    }
  }

  /**
   * Update exchange balance summary (replaces expensive balance aggregation)
   * Called when balances are fetched/updated from an exchange
   */
  async updateExchangeBalanceSummary(
    userId: string,
    exchangeId: string,
    totalValue: number,
    totalAssets: number,
    estimatedGasCost: number
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO exchange_balance_summary 
         (user_id, exchange_id, total_value, total_assets, estimated_gas_cost, last_updated)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id, exchange_id)
         DO UPDATE SET
           total_value = $3,
           total_assets = $4,
           estimated_gas_cost = $5,
           last_updated = NOW()`,
        [userId, exchangeId, totalValue, totalAssets, estimatedGasCost]
      );

      logger.debug(`[Stats] Updated exchange balance: ${userId}/${exchangeId}, value=${totalValue}`);
    } catch (error) {
      logger.error(`[Stats] Failed to update exchange balance:`, error);
    }
  }

  /**
   * Update order execution summary (replaces orders.ts aggregation query)
   * Called when execution feedback is recorded
   */
  async updateOrderExecutionSummary(
    exchange: string,
    symbol: string,
    timeWindow: string = '30 days'
  ): Promise<void> {
    try {
      const statsResult = await pool.query(
        `SELECT 
          COUNT(*) as total_executions,
          AVG(accuracy) as avg_accuracy,
          AVG(slippage_percent) as avg_slippage,
          COUNT(CASE WHEN success THEN 1 END)::float / COUNT(*) as success_rate,
          AVG(fill_time_ms) as avg_fill_time
         FROM execution_metrics
         WHERE exchange = $1 AND symbol = $2 
         AND recorded_at > NOW() - INTERVAL '${timeWindow}'`,
        [exchange, symbol]
      );

      const stats = statsResult.rows[0];

      // Upsert denormalized summary
      await pool.query(
        `INSERT INTO order_execution_summary
         (exchange, symbol, total_executions, avg_accuracy, avg_slippage, success_rate, avg_fill_time, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (exchange, symbol)
         DO UPDATE SET
           total_executions = $3,
           avg_accuracy = $4,
           avg_slippage = $5,
           success_rate = $6,
           avg_fill_time = $7,
           updated_at = NOW()`,
        [
          exchange,
          symbol,
          stats.total_executions || 0,
          stats.avg_accuracy || 0,
          stats.avg_slippage || 0,
          stats.success_rate || 0,
          stats.avg_fill_time || 0,
        ]
      );

      logger.debug(`[Stats] Updated order execution summary: ${exchange}/${symbol}`);
    } catch (error) {
      logger.error(`[Stats] Failed to update order execution summary:`, error);
    }
  }

  /**
   * Batch reconciliation job (run hourly via cron)
   * Validates all denormalized stats against source data
   */
  async reconcileAllStats(): Promise<{ processed: number; fixed: number }> {
    try {
      logger.info('[Stats] Starting unified stats reconciliation...');

      let totalFixed = 0;

      // Reconcile venue execution stats
      const venues = await pool.query(
        `SELECT DISTINCT user_id, symbol, venue FROM venue_execution_stats`
      );

      for (const row of venues.rows) {
        const fixed = await this.validateAndFixVenueStats(row.user_id, row.symbol, row.venue);
        if (fixed) totalFixed++;
      }

      // Reconcile order execution stats
      const orders = await pool.query(
        `SELECT DISTINCT exchange, symbol FROM order_execution_summary`
      );

      for (const row of orders.rows) {
        const fixed = await this.validateAndFixOrderStats(row.exchange, row.symbol);
        if (fixed) totalFixed++;
      }

      logger.info(`[Stats] Reconciliation complete: processed ${venues.rows.length + orders.rows.length}, fixed ${totalFixed}`);
      return { processed: venues.rows.length + orders.rows.length, fixed: totalFixed };
    } catch (error) {
      logger.error('[Stats] Reconciliation failed:', error);
      return { processed: 0, fixed: 0 };
    }
  }

  /**
   * Schedule a non-blocking venue stats update. Use this when callers should not
   * wait for cross-chain finality or long-running aggregation to complete.
   */
  scheduleVenueExecutionStats(
    userId: string,
    symbol: string,
    venue: string,
    timeWindow: string = '1 day'
  ) {
    setImmediate(async () => {
      try {
        await this.updateVenueExecutionStats(userId, symbol, venue, timeWindow);
      } catch (err) {
        logger.warn('[Stats] Scheduled venue update failed:', err);
      }
    });
  }

  /**
   * Schedule a non-blocking exchange balance update.
   */
  scheduleExchangeBalanceSummary(
    userId: string,
    exchangeId: string,
    totalValue: number,
    totalAssets: number,
    estimatedGasCost: number
  ) {
    setImmediate(async () => {
      try {
        await this.updateExchangeBalanceSummary(userId, exchangeId, totalValue, totalAssets, estimatedGasCost);
      } catch (err) {
        logger.warn('[Stats] Scheduled exchange balance update failed:', err);
      }
    });
  }

  /**
   * Schedule a non-blocking order execution summary update.
   */
  scheduleOrderExecutionSummary(exchange: string, symbol: string, timeWindow: string = '30 days') {
    setImmediate(async () => {
      try {
        await this.updateOrderExecutionSummary(exchange, symbol, timeWindow);
      } catch (err) {
        logger.warn('[Stats] Scheduled order execution update failed:', err);
      }
    });
  }

  private async validateAndFixVenueStats(
    userId: string,
    symbol: string,
    venue: string
  ): Promise<boolean> {
    try {
      const current = await pool.query(
        `SELECT trade_count, avg_price, price_range FROM venue_execution_stats 
         WHERE user_id = $1 AND symbol = $2 AND venue = $3`,
        [userId, symbol, venue]
      );

      if (current.rows.length === 0) return false;

      const expected = await pool.query(
        `SELECT 
          COUNT(*) as expected_count,
          AVG(execution_price) as expected_price,
          MAX(execution_price) - MIN(execution_price) as expected_range
         FROM execution_metrics
         WHERE user_id = $1 AND symbol = $2 AND venue = $3
         AND recorded_at > NOW() - INTERVAL '1 day'`,
        [userId, symbol, venue]
      );

      if (expected.rows.length === 0) return false;

      const curr = current.rows[0];
      const exp = expected.rows[0];

      // Check for drift
      if (
        (curr.trade_count || 0) !== (exp.expected_count || 0) ||
        Math.abs((curr.avg_price || 0) - (exp.expected_price || 0)) > 0.01 ||
        Math.abs((curr.price_range || 0) - (exp.expected_range || 0)) > 0.01
      ) {
        // Fix it
        await this.updateVenueExecutionStats(userId, symbol, venue, '1 day');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('[Stats] Validation failed for venue stats:', error);
      return false;
    }
  }

  private async validateAndFixOrderStats(exchange: string, symbol: string): Promise<boolean> {
    try {
      const current = await pool.query(
        `SELECT total_executions, avg_accuracy, success_rate FROM order_execution_summary 
         WHERE exchange = $1 AND symbol = $2`,
        [exchange, symbol]
      );

      if (current.rows.length === 0) return false;

      const expected = await pool.query(
        `SELECT 
          COUNT(*) as expected_count,
          AVG(accuracy) as expected_accuracy,
          COUNT(CASE WHEN success THEN 1 END)::float / COUNT(*) as expected_rate
         FROM execution_metrics
         WHERE exchange = $1 AND symbol = $2
         AND recorded_at > NOW() - INTERVAL '30 days'`,
        [exchange, symbol]
      );

      if (expected.rows.length === 0) return false;

      const curr = current.rows[0];
      const exp = expected.rows[0];

      // Check for drift
      if (
        (curr.total_executions || 0) !== (exp.expected_count || 0) ||
        Math.abs((curr.avg_accuracy || 0) - (exp.expected_accuracy || 0)) > 0.1 ||
        Math.abs((curr.success_rate || 0) - (exp.expected_rate || 0)) > 0.05
      ) {
        // Fix it
        await this.updateOrderExecutionSummary(exchange, symbol, '30 days');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('[Stats] Validation failed for order stats:', error);
      return false;
    }
  }
}

export const unifiedStatsUpdater = new UnifiedStatsUpdater();
