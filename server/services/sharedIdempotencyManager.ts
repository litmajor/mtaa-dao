/**
 * SHARED IDEMPOTENCY MANAGER
 * Cross-service deduplication service
 */

import { pool } from '../db';
import { withTransaction } from '../utils/dbClient';

export type IdempotencyStatus = 'pending' | 'completed' | 'failed';

export class SharedIdempotencyManager {
  private readonly defaultTTLSeconds = 86400;

  /**
   * Atomically acquire the "pending" lock for a key.
   * Returns true if this caller acquired the lock and MUST call recordResult().
   * Returns false if another process holds the lock or the key is already finished.
   */
  async startProcessing(key: string): Promise<boolean> {
    return await withTransaction(async (client) => {
      const insertResult = await client.query(
        `INSERT INTO idempotency_keys (key, status, created_at, expires_at)
         VALUES ($1, 'pending', NOW(), NOW() + INTERVAL '24 hours')
         ON CONFLICT (key) DO NOTHING
         RETURNING status, expires_at`,
        [key]
      );

      if (insertResult.rows.length > 0) {
        return true;
      }

      const existing = await client.query(
        `SELECT status, expires_at FROM idempotency_keys WHERE key = $1 FOR UPDATE`,
        [key]
      );

      if (existing.rows.length === 0) {
        throw new Error('Failed to read idempotency key after concurrent insert');
      }

      const row = existing.rows[0];
      if (row.status === 'pending') {
        return false; // Another process is working on it
      }

      // Completed or failed — only re-process if expired
      if (new Date(row.expires_at) < new Date()) {
        await client.query(
          `UPDATE idempotency_keys 
           SET status = 'pending', created_at = NOW(), expires_at = NOW() + INTERVAL '24 hours', response = NULL
           WHERE key = $1`,
          [key]
        );
        return true;
      }

      return false; // Finished and still fresh — caller should read cached result
    }, 20000);
  }

  async recordResult(key: string, response: any, ttlSeconds: number = this.defaultTTLSeconds): Promise<void> {
    const status = response?.success === false ? 'failed' : 'completed';
    await pool.query(
      `INSERT INTO idempotency_keys (key, status, response, created_at, expires_at)
       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '${ttlSeconds} seconds')
       ON CONFLICT (key) DO UPDATE SET
         status = EXCLUDED.status,
         response = EXCLUDED.response,
         expires_at = EXCLUDED.expires_at`,
      [key, status, JSON.stringify(response)]
    );
  }

  /** Returns null if not found, 'pending' if in-flight, or the cached response object. */
  async getResult(key: string): Promise<any | null> {
    const result = await pool.query(
      `SELECT status, response FROM idempotency_keys 
       WHERE key = $1 AND expires_at > NOW()`,
      [key]
    );
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    if (row.status === 'pending') return 'pending';
    if (!row.response) return null;
    return typeof row.response === 'string' ? JSON.parse(row.response) : row.response;
  }

  async clearKey(key: string): Promise<void> {
    await pool.query(`DELETE FROM idempotency_keys WHERE key = $1`, [key]);
  }

  async clear(key: string): Promise<void> {
    await this.clearKey(key);
  }
}

export const sharedIdempotencyManager = new SharedIdempotencyManager();