/**
 * Futures Positions Repository
 * 
 * Data access layer for perpetual/futures position tracking
 * Handles CRUD operations and queries for open positions
 */

import { pool } from '../db';
import { logger } from '../utils/logger';

export interface FuturesPosition {
  id: string;
  user_id: string;
  credential_id: string;
  exchange: string;
  position_id: string;
  symbol: string;
  side: 'long' | 'short' | 'buy' | 'sell';
  contracts: number;
  contractSize?: number;
  entry_price: number;
  current_mark_price?: number;
  collateral?: number;
  leverage: number;
  liquidation_price?: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  realized_pnl: number;
  funding_paid: number;
  created_at: Date;
  updated_at: Date;
  closed_at?: Date;
}

export class FuturesPositionRepository {
  /**
   * Create or update a futures position
   */
  async upsertPosition(position: Partial<FuturesPosition>): Promise<FuturesPosition> {
    try {
      const {
        user_id,
        credential_id,
        exchange,
        position_id,
        symbol,
        side,
        contracts,
        contractSize,
        entry_price,
        current_mark_price,
        collateral,
        leverage,
        liquidation_price,
        unrealized_pnl,
        unrealized_pnl_pct,
        realized_pnl,
        funding_paid,
      } = position;

      const result = await pool.query(
        `INSERT INTO futures_positions (
          user_id, credential_id, exchange, position_id, symbol, side,
          contracts, contractSize, entry_price, current_mark_price, collateral,
          leverage, liquidation_price, unrealized_pnl, unrealized_pnl_pct,
          realized_pnl, funding_paid, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
        )
        ON CONFLICT (credential_id, exchange, position_id) DO UPDATE SET
          symbol = $5,
          side = $6,
          contracts = $7,
          contractSize = $8,
          entry_price = $9,
          current_mark_price = $10,
          collateral = $11,
          leverage = $12,
          liquidation_price = $13,
          unrealized_pnl = $14,
          unrealized_pnl_pct = $15,
          realized_pnl = $16,
          funding_paid = $17,
          updated_at = NOW()
        RETURNING *`,
        [
          user_id,
          credential_id,
          exchange,
          position_id,
          symbol,
          side,
          contracts,
          contractSize,
          entry_price,
          current_mark_price,
          collateral,
          leverage,
          liquidation_price,
          unrealized_pnl,
          unrealized_pnl_pct,
          realized_pnl,
          funding_paid,
        ]
      );

      return result.rows[0];
    } catch (error: any) {
      logger.error('[FuturesPositionRepository] Upsert failed:', error);
      throw error;
    }
  }

  /**
   * Get open positions for a user
   */
  async getOpenPositions(userId: string, exchange?: string): Promise<FuturesPosition[]> {
    try {
      let query = `
        SELECT * FROM futures_positions
        WHERE user_id = $1 AND closed_at IS NULL
      `;
      const params: any[] = [userId];

      if (exchange) {
        query += ` AND exchange = $2`;
        params.push(exchange);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error: any) {
      logger.error('[FuturesPositionRepository] Get open positions failed:', error);
      throw error;
    }
  }

  /**
   * Get a specific position by ID
   */
  async getPositionById(positionId: string, userId: string): Promise<FuturesPosition | null> {
    try {
      const result = await pool.query(
        `SELECT * FROM futures_positions WHERE id = $1 AND user_id = $2`,
        [positionId, userId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error: any) {
      logger.error('[FuturesPositionRepository] Get position by ID failed:', error);
      throw error;
    }
  }

  /**
   * Close a position
   */
  async closePosition(
    positionId: string,
    userId: string,
    realizedPnl: number
  ): Promise<FuturesPosition | null> {
    try {
      const result = await pool.query(
        `UPDATE futures_positions 
         SET closed_at = NOW(), 
             realized_pnl = $3,
             updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [positionId, userId, realizedPnl]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error: any) {
      logger.error('[FuturesPositionRepository] Close position failed:', error);
      throw error;
    }
  }

  /**
   * Record mark price history for position
   */
  async recordMarkPrice(
    positionId: string,
    markPrice: number,
    pnlAtTime?: number,
    pnlPctAtTime?: number
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO mark_price_history (position_id, mark_price, pnl_at_time, pnl_pct_at_time, recorded_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [positionId, markPrice, pnlAtTime, pnlPctAtTime]
      );
    } catch (error: any) {
      logger.error('[FuturesPositionRepository] Record mark price failed:', error);
      throw error;
    }
  }

  /**
   * Get mark price history for a position
   */
  async getMarkPriceHistory(positionId: string, limit: number = 100): Promise<any[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM mark_price_history 
         WHERE position_id = $1 
         ORDER BY recorded_at DESC 
         LIMIT $2`,
        [positionId, limit]
      );

      return result.rows;
    } catch (error: any) {
      logger.error('[FuturesPositionRepository] Get mark price history failed:', error);
      throw error;
    }
  }

  /**
   * Record leverage adjustment
   */
  async recordLeverageAdjustment(
    positionId: string,
    oldLeverage: number | null,
    newLeverage: number,
    status: string,
    response?: string
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO position_leverage_audit (position_id, old_leverage, new_leverage, request_status, exchange_response, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [positionId, oldLeverage, newLeverage, status, response]
      );
    } catch (error: any) {
      logger.error('[FuturesPositionRepository] Record leverage adjustment failed:', error);
      throw error;
    }
  }

  /**
   * Get positions by credential ID and symbol
   */
  async getPositionsByCredential(
    credentialId: string,
    symbol?: string
  ): Promise<FuturesPosition[]> {
    try {
      let query = `
        SELECT * FROM futures_positions
        WHERE credential_id = $1 AND closed_at IS NULL
      `;
      const params: any[] = [credentialId];

      if (symbol) {
        query += ` AND symbol = $2`;
        params.push(symbol);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error: any) {
      logger.error('[FuturesPositionRepository] Get positions by credential failed:', error);
      throw error;
    }
  }

  /**
   * Calculate aggregate P&L for user
   */
  async getAggregatePnL(userId: string, exchange?: string): Promise<{
    unrealized_pnl: number;
    realized_pnl: number;
    total_pnl: number;
  }> {
    try {
      let query = `
        SELECT 
          COALESCE(SUM(unrealized_pnl), 0) as unrealized_pnl,
          COALESCE(SUM(realized_pnl), 0) as realized_pnl
        FROM futures_positions
        WHERE user_id = $1 AND closed_at IS NULL
      `;
      const params: any[] = [userId];

      if (exchange) {
        query += ` AND exchange = $2`;
        params.push(exchange);
      }

      const result = await pool.query(query, params);
      const row = result.rows[0] || { unrealized_pnl: 0, realized_pnl: 0 };

      return {
        unrealized_pnl: parseFloat(row.unrealized_pnl),
        realized_pnl: parseFloat(row.realized_pnl),
        total_pnl: parseFloat(row.unrealized_pnl) + parseFloat(row.realized_pnl),
      };
    } catch (error: any) {
      logger.error('[FuturesPositionRepository] Get aggregate PnL failed:', error);
      throw error;
    }
  }
}

/**
 * Singleton instance
 */
export const futuresPositionRepository = new FuturesPositionRepository();
