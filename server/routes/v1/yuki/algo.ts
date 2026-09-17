/**
 * ════════════════════════════════════════════════════════════════════════════════
 * YUKI ALGO Router - Algorithmic Trading Strategies (TWAP, VWAP)
 * ════════════════════════════════════════════════════════════════════════════════
 */

import express, { type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../../db';
import { authenticate } from '../../../auth';
import { logger } from '../../../utils/logger';

const router = express.Router();
router.use(authenticate);

let algoJobsTableReady = false;

async function ensureAlgoJobsTable(): Promise<void> {
  if (algoJobsTableReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS yuki_algo_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL,
      parent_id UUID,
      strategy VARCHAR(30) NOT NULL,
      order_type VARCHAR(30) NOT NULL,
      symbol VARCHAR(50) NOT NULL,
      side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
      amount NUMERIC(30, 12) NOT NULL,
      execute_at TIMESTAMP NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_yuki_algo_jobs_user_id ON yuki_algo_jobs(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_yuki_algo_jobs_status ON yuki_algo_jobs(status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_yuki_algo_jobs_execute_at ON yuki_algo_jobs(execute_at);`);

  algoJobsTableReady = true;
}

function serializeAlgoJob(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    parentId: row.parent_id,
    strategy: row.strategy,
    orderType: row.order_type,
    symbol: row.symbol,
    side: row.side,
    amount: Number(row.amount),
    executeAt: row.execute_at?.toISOString ? row.execute_at.toISOString() : row.execute_at,
    status: row.status,
    metadata: row.metadata || {},
    createdAt: row.created_at?.toISOString ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at?.toISOString ? row.updated_at.toISOString() : row.updated_at,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ════════════════════════════════════════════════════════════════════════════════

const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: 'Too many requests, please try again later'
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many read requests'
});

// ════════════════════════════════════════════════════════════════════════════════
// ALGORITHMIC EXECUTION (TWAP / VWAP)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /v1/yuki/algo/twap
 * Schedule a Time-Weighted Average Price order
 */
router.post('/twap', writeLimiter, async (req: Request, res: Response) => {
  try {
    const { symbol, side, amount, durationMinutes, chunks } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!symbol || !side || !amount || !durationMinutes || !chunks) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const chunkAmount = amount / chunks;
    const intervalMinutes = durationMinutes / chunks;
    const parentId = uuidv4();

    await ensureAlgoJobsTable();

    const insertQuery = `
      INSERT INTO yuki_algo_jobs (
        user_id, parent_id, strategy, order_type, symbol, side, amount, execute_at, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    for (let i = 0; i < chunks; i++) {
      const executeAt = new Date(Date.now() + i * intervalMinutes * 60 * 1000);
      await pool.query(insertQuery, [
        userId,
        parentId,
        'twap',
        'twap-chunk',
        symbol,
        side,
        chunkAmount,
        executeAt,
        'scheduled',
        JSON.stringify({
          chunkIndex: i + 1,
          totalChunks: chunks,
          durationMinutes,
          createdBy: userId,
        }),
      ]);
    }

    logger.info(`[Algo] Created TWAP order for ${userId}: ${amount} ${symbol} over ${durationMinutes}m in ${chunks} chunks`);
    res.json({ success: true, parentId, message: 'TWAP order scheduled successfully' });
  } catch (err: any) {
    logger.error(`[Algo] Error creating TWAP: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /v1/yuki/algo/orders
 * List active algorithmic orders for the user
 */
router.get('/orders', readLimiter, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await ensureAlgoJobsTable();

    const result = await pool.query(`
      SELECT * FROM yuki_algo_jobs
      WHERE user_id = $1 AND status IN ('scheduled', 'running')
      ORDER BY execute_at ASC, created_at DESC
    `, [userId]);

    res.json({ success: true, orders: result.rows.map(serializeAlgoJob) });
  } catch (err: any) {
    logger.error(`[Algo] Error listing orders: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /v1/yuki/algo/orders/:orderId
 * Modify an active scheduled algo task
 */
router.patch('/orders/:orderId', writeLimiter, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { orderId } = req.params;
    const { amount, executeAt, metadata, status } = req.body;

    if (!orderId) return res.status(400).json({ error: 'Missing orderId' });
    if (!amount && !executeAt && !metadata && !status) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    await ensureAlgoJobsTable();

    const existing = await pool.query(
      `SELECT * FROM yuki_algo_jobs WHERE id = $1 AND user_id = $2 AND status = 'scheduled' LIMIT 1`,
      [orderId, userId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Scheduled algo job not found or cannot be modified' });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (amount !== undefined) {
      updates.push(`amount = $${paramIndex++}`);
      params.push(amount);
    }
    if (executeAt !== undefined) {
      const parsed = new Date(executeAt);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'executeAt must be a valid timestamp' });
      }
      updates.push(`execute_at = $${paramIndex++}`);
      params.push(parsed);
    }
    if (metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(metadata));
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE yuki_algo_jobs
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;
    params.push(orderId, userId);

    const updated = await pool.query(query, params);
    res.json({ success: true, order: serializeAlgoJob(updated.rows[0]) });
  } catch (err: any) {
    logger.error(`[Algo] Error updating order: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /v1/yuki/algo/orders/:orderId
 * Cancel an active scheduled algo job
 */
router.delete('/orders/:orderId', writeLimiter, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

    await ensureAlgoJobsTable();

    const result = await pool.query(
      `UPDATE yuki_algo_jobs SET status = 'canceled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 AND status = 'scheduled' RETURNING *`,
      [orderId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Scheduled algo job not found or cannot be canceled' });
    }

    res.json({ success: true, order: serializeAlgoJob(result.rows[0]) });
  } catch (err: any) {
    logger.error(`[Algo] Error canceling order: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
