/**
 * STRATEGY STATS UPDATER SERVICE
 * 
 * Maintains denormalized strategy_stats table for fast strategy listing queries.
 * Avoids expensive COUNT(DISTINCT) aggregations on strategy_executions.
 * 
 * Updates via:
 * 1. Incremental updates on strategy execution (event-driven)
 * 2. Periodic reconciliation to catch drift
 */

import { pool } from '../db';
import { logger } from '../utils/logger';

class StrategyStatsUpdater {
  /**
   * On strategy execution: update strategy_stats
   */
  async onExecutionStatusChanged(strategyId: string, status: string): Promise<void> {
    try {
      // Ensure stats row exists
      await this.ensureStatsRow(strategyId);
      
      // Count executions by status
      const execCount = await pool.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
         FROM strategy_executions 
         WHERE strategy_id = $1`,
        [strategyId]
      );
      
      const { total, successful, failed } = execCount.rows[0];
      
      // Count signals in last 24 hours
      const signalCount = await pool.query(
        `SELECT COUNT(*) as count 
         FROM execution_logs 
         WHERE execution_id IN (
           SELECT id FROM strategy_executions WHERE strategy_id = $1
         ) AND created_at > NOW() - INTERVAL '24 hours'`,
        [strategyId]
      );
      
      // Get latest execution timestamp
      const lastExec = await pool.query(
        `SELECT MAX(started_at) as last_executed_at 
         FROM strategy_executions 
         WHERE strategy_id = $1`,
        [strategyId]
      );
      
      // Update denormalized stats (incremental, no expensive aggregations)
      await pool.query(
        `UPDATE strategy_stats 
         SET execution_count = $1,
             successful_executions = $2,
             failed_executions = $3,
             signal_count_24h = $4,
             last_execution_at = $5,
             popularity_score = $1,  -- Simple ranking: execution count
             updated_at = NOW()
         WHERE strategy_id = $6`,
        [total, successful, failed, signalCount.rows[0].count, lastExec.rows[0].last_executed_at, strategyId]
      );
      
      logger.debug(`[STRATEGY STATS] Updated for strategy ${strategyId}: ${total} executions, ${successful} successful`);
    } catch (error) {
      logger.error(`[STRATEGY STATS] Failed to update on execution:`, error);
    }
  }

  /**
   * Ensure stats row exists for strategy
   */
  private async ensureStatsRow(strategyId: string): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO strategy_stats (strategy_id)
         VALUES ($1)
         ON CONFLICT (strategy_id) DO NOTHING`,
        [strategyId]
      );
    } catch (error) {
      logger.warn(`[STRATEGY STATS] Failed to ensure stats row:`, error);
    }
  }

  /**
   * Periodic reconciliation: recompute all strategy stats
   * Run every 5-10 minutes to catch any drift from failed triggers
   */
  async reconcileAllStats(): Promise<{ processed: number; fixed: number }> {
    try {
      logger.info('[STRATEGY STATS] Starting reconciliation...');
      
      // Get all strategies with stats
      const strategies = await pool.query(
        `SELECT id FROM strategies WHERE id IN (SELECT strategy_id FROM strategy_stats)`
      );
      
      let fixed = 0;
      
      for (const { id } of strategies.rows) {
        const hasDrift = await this.validateAndFixStrategyStats(id);
        if (hasDrift) fixed++;
      }
      
      logger.info(`[STRATEGY STATS] Reconciliation complete: processed ${strategies.rows.length}, fixed ${fixed}`);
      return { processed: strategies.rows.length, fixed };
    } catch (error) {
      logger.error('[STRATEGY STATS] Reconciliation failed:', error);
      return { processed: 0, fixed: 0 };
    }
  }

  /**
   * Validate and fix stats for a strategy
   * Returns true if drift was detected and fixed
   */
  private async validateAndFixStrategyStats(strategyId: string): Promise<boolean> {
    try {
      // Get current denormalized stats
      const current = await pool.query(
        `SELECT execution_count, successful_executions, failed_executions, signal_count_24h
         FROM strategy_stats 
         WHERE strategy_id = $1`,
        [strategyId]
      );
      
      if (current.rows.length === 0) {
        // Stats row missing, create it
        await this.ensureStatsRow(strategyId);
        return true;
      }
      
      // Calculate expected stats from source of truth
      const execStats = await pool.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
         FROM strategy_executions 
         WHERE strategy_id = $1`,
        [strategyId]
      );
      
      const signalStats = await pool.query(
        `SELECT COUNT(*) as count 
         FROM execution_logs 
         WHERE execution_id IN (
           SELECT id FROM strategy_executions WHERE strategy_id = $1
         ) AND created_at > NOW() - INTERVAL '24 hours'`,
        [strategyId]
      );
      
      const curr = current.rows[0];
      const expTotal = parseInt(execStats.rows[0].total) || 0;
      const expSuccessful = parseInt(execStats.rows[0].successful) || 0;
      const expFailed = parseInt(execStats.rows[0].failed) || 0;
      const expSignals = parseInt(signalStats.rows[0].count) || 0;
      
      // Check for drift
      const hasExecDrift = curr.execution_count !== expTotal;
      const hasSuccessDrift = curr.successful_executions !== expSuccessful;
      const hasFailedDrift = curr.failed_executions !== expFailed;
      const hasSignalDrift = curr.signal_count_24h !== expSignals;
      
      if (hasExecDrift || hasSuccessDrift || hasFailedDrift || hasSignalDrift) {
        logger.warn(`[STRATEGY STATS] Drift detected for strategy ${strategyId}`, {
          executions: { current: curr.execution_count, expected: expTotal },
          successful: { current: curr.successful_executions, expected: expSuccessful },
          failed: { current: curr.failed_executions, expected: expFailed },
          signals_24h: { current: curr.signal_count_24h, expected: expSignals },
        });
        
        // Fix it
        await pool.query(
          `UPDATE strategy_stats 
           SET execution_count = $1,
               successful_executions = $2,
               failed_executions = $3,
               signal_count_24h = $4,
               popularity_score = $1,
               last_reconciled_at = NOW(),
               updated_at = NOW()
           WHERE strategy_id = $5`,
          [expTotal, expSuccessful, expFailed, expSignals, strategyId]
        );
        
        return true;
      }
      
      // No drift, just update last_reconciled_at
      await pool.query(
        `UPDATE strategy_stats SET last_reconciled_at = NOW() 
         WHERE strategy_id = $1`,
        [strategyId]
      );
      
      return false;
    } catch (error) {
      logger.error(`[STRATEGY STATS] Validation failed for ${strategyId}:`, error);
      return false;
    }
  }
}

export const strategyStatsUpdater = new StrategyStatsUpdater();
