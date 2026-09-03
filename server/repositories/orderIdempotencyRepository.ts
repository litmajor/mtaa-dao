/**
 * Order Idempotency Repository
 * 
 * Data access layer for order idempotency key management
 * Prevents duplicate order submission via retry logic
 */

import { pool } from '../db';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

export interface IdempotencyKey {
  id: string;
  user_id: string;
  credential_id: string;
  exchange: string;
  idempotency_key: string;
  order_type: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  result_order_id?: string;
  result_status?: string;
  result_error?: string;
  expires_at: Date;
  created_at: Date;
}

export class OrderIdempotencyRepository {
  /**
   * Check if an idempotency key exists and is still valid
   */
  async getIdempotencyKey(
    exchange: string,
    idempotencyKey: string
  ): Promise<IdempotencyKey | null> {
    try {
      const result = await pool.query(
        `SELECT * FROM order_idempotency_keys 
         WHERE exchange = $1 AND idempotency_key = $2 AND expires_at > NOW()
         LIMIT 1`,
        [exchange, idempotencyKey]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error: any) {
      logger.error('[OrderIdempotencyRepository] Get idempotency key failed:', error);
      throw error;
    }
  }

  /**
   * Store order placement attempt with idempotency key
   */
  async storeIdempotencyKey(params: {
    user_id: string;
    credential_id: string;
    exchange: string;
    idempotency_key: string;
    order_type: string;
    symbol: string;
    side: 'buy' | 'sell';
    amount: number;
    price?: number;
    result_order_id?: string;
    result_status?: string;
    result_error?: string;
  }): Promise<IdempotencyKey> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiry

      const result = await pool.query(
        `INSERT INTO order_idempotency_keys (
          user_id, credential_id, exchange, idempotency_key, order_type,
          symbol, side, amount, price, result_order_id, result_status,
          result_error, expires_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        RETURNING *`,
        [
          params.user_id,
          params.credential_id,
          params.exchange,
          params.idempotency_key,
          params.order_type,
          params.symbol,
          params.side,
          params.amount,
          params.price || null,
          params.result_order_id || null,
          params.result_status || null,
          params.result_error || null,
          expiresAt,
        ]
      );

      return result.rows[0];
    } catch (error: any) {
      logger.error('[OrderIdempotencyRepository] Store idempotency key failed:', error);
      throw error;
    }
  }

  /**
   * Update idempotency key with order result
   */
  async updateWithResult(
    idempotencyKey: string,
    exchange: string,
    resultOrderId: string,
    resultStatus: string,
    resultError?: string
  ): Promise<void> {
    try {
      await pool.query(
        `UPDATE order_idempotency_keys 
         SET result_order_id = $3, 
             result_status = $4, 
             result_error = $5
         WHERE idempotency_key = $1 AND exchange = $2`,
        [idempotencyKey, exchange, resultOrderId, resultStatus, resultError || null]
      );
    } catch (error: any) {
      logger.error('[OrderIdempotencyRepository] Update with result failed:', error);
      throw error;
    }
  }

  /**
   * Generate a unique idempotency key from order parameters
   * Uses client-side generation to ensure same retry produces same key
   */
  static generateIdempotencyKey(params: {
    userId: string;
    credentialId: string;
    symbol: string;
    side: 'buy' | 'sell';
    amount: number;
    price?: number;
    timestamp?: number;
  }): string {
    // Use a hash of order parameters + timestamp to create deterministic idempotency key
    const { userId, credentialId, symbol, side, amount, price, timestamp } = params;
    const key = `${userId}:${credentialId}:${symbol}:${side}:${amount}:${price || 'market'}:${timestamp || Date.now()}`;

    // For simplicity, use base64-encoded key (in production, use crypto hash)
    return Buffer.from(key).toString('base64');
  }

  /**
   * Clean up expired idempotency keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    try {
      const result = await pool.query(
        `DELETE FROM order_idempotency_keys WHERE expires_at <= NOW()`
      );

      logger.info(`[OrderIdempotencyRepository] Cleaned up ${result.rowCount} expired keys`);
      return result.rowCount || 0;
    } catch (error: any) {
      logger.error('[OrderIdempotencyRepository] Cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get recent order attempts for a credential
   */
  async getRecentAttempts(
    credentialId: string,
    symbol?: string,
    limit: number = 50
  ): Promise<IdempotencyKey[]> {
    try {
      let query = `
        SELECT * FROM order_idempotency_keys
        WHERE credential_id = $1
      `;
      const params: any[] = [credentialId];

      if (symbol) {
        query += ` AND symbol = $2`;
        params.push(symbol);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error: any) {
      logger.error('[OrderIdempotencyRepository] Get recent attempts failed:', error);
      throw error;
    }
  }
}

/**
 * Singleton instance
 */
export const orderIdempotencyRepository = new OrderIdempotencyRepository();
