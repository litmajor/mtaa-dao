import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateToken } from '../../../middleware/auth';
import { ApiResponse } from '../../../utils/apiResponse';
import { logger } from '../../../utils/logger';
import { pool } from '../../../db';

const router = Router();
router.use(authenticateToken as any);

// ASSUMPTION: `symbols` table has a `ticker` column ('BTC', 'ETH', ...) used
// as the key for ccxtService price lookups. Verify against your real schema
// -- if the column is named differently, fix TARGET_JOINS.symbol below and
// the equivalent in watchlistAlertEvaluator.ts.
//
// Each entity type's join fragment: (select expression for display name,
// select expression for the FK column, table to join).
const TARGET_JOINS: Record<string, { table: string; fkColumn: string; nameExpr: string }> = {
  symbol: { table: 'symbols', fkColumn: 'symbol_id', nameExpr: 's.ticker' },
  pool: { table: 'pools', fkColumn: 'pool_id', nameExpr: 'p.name' },
  vault: { table: 'vaults', fkColumn: 'vault_id', nameExpr: 'v.name' },
  investment_pool: { table: 'investment_pools', fkColumn: 'investment_pool_id', nameExpr: 'ip.name' },
  strategy: { table: 'strategies', fkColumn: 'strategy_id', nameExpr: 'st.name' },
  creator: { table: 'users', fkColumn: 'creator_id', nameExpr: 'u.username' },
};

const VALID_ITEM_TYPES = Object.keys(TARGET_JOINS);
const VALID_METRICS_BY_TYPE: Record<string, string[]> = {
  symbol: ['price'],
  pool: ['apy', 'tvl'],
  vault: ['apy', 'tvl'],
  investment_pool: ['apy', 'tvl'],
  strategy: [],
  creator: [],
};

function requireUserId(req: Request, res: Response): string | null {
  const userId = (req as any).user?.id;
  if (!userId) {
    // FIX from v1: v1 silently fell back to the literal string 'unknown'
    // here, meaning a broken auth context would read/write watchlist rows
    // under a shared fake identity instead of failing loudly. Fail closed.
    res.status(401).json(ApiResponse.error('Unauthenticated'));
    return null;
  }
  return userId;
}

/**
 * GET /v1/yuki/watchlist
 * Retrieve all watchlists and their items for the user.
 *
 * FIX from v1: previously N+1 (one query for watchlists, then one items
 * query per watchlist in a loop). Now a single batched items query.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const watchlistsRes = await pool.query(
      `SELECT * FROM yuki_watchlists WHERE user_id = $1 ORDER BY name ASC`,
      [userId]
    );
    const watchlists = watchlistsRes.rows;
    if (watchlists.length === 0) {
      return res.json(ApiResponse.success([]));
    }

    const watchlistIds = watchlists.map((w) => w.id);

    // Resolve each item's display name via its target table in one query
    // per entity type (six queries total, independent of watchlist count --
    // NOT six-per-watchlist). This still beats the v1 N+1 pattern at any
    // scale beyond a handful of watchlists, and is far simpler than one
    // giant UNION across six differently-shaped joins.
    const itemsByType = await Promise.all(
      VALID_ITEM_TYPES.map(async (itemType) => {
        const { fkColumn, nameExpr, table } = TARGET_JOINS[itemType];
        const alias = table === 'symbols' ? 's' : table === 'pools' ? 'p'
          : table === 'vaults' ? 'v' : table === 'investment_pools' ? 'ip'
          : table === 'strategies' ? 'st' : 'u';
        const result = await pool.query(
          `SELECT i.*, ${nameExpr} AS target_name
           FROM yuki_watchlist_items i
           JOIN ${table} ${alias} ON ${alias}.id = i.${fkColumn}
           WHERE i.watchlist_id = ANY($1::uuid[]) AND i.item_type = $2`,
          [watchlistIds, itemType]
        );
        return result.rows;
      })
    );

    const allItems = itemsByType.flat();
    const itemsByWatchlist = new Map<string, any[]>();
    for (const item of allItems) {
      const list = itemsByWatchlist.get(item.watchlist_id) || [];
      list.push(item);
      itemsByWatchlist.set(item.watchlist_id, list);
    }

    const result = watchlists.map((w) => ({
      ...w,
      items: itemsByWatchlist.get(w.id) || [],
    }));

    res.json(ApiResponse.success(result));
  } catch (error: any) {
    logger.error('Failed to fetch watchlists', { error });
    res.status(500).json(ApiResponse.error(`Failed to fetch watchlists: ${error.message}`));
  }
});

/**
 * POST /v1/yuki/watchlist
 * Create a new watchlist
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json(ApiResponse.error('Watchlist name is required'));
    }

    const insertRes = await pool.query(
      `INSERT INTO yuki_watchlists (user_id, name) VALUES ($1, $2) RETURNING *`,
      [userId, name.trim()]
    );

    res.json(ApiResponse.success({ ...insertRes.rows[0], items: [] }));
  } catch (error: any) {
    logger.error('Failed to create watchlist', { error });
    res.status(500).json(ApiResponse.error(`Failed to create watchlist: ${error.message}`));
  }
});

/**
 * DELETE /v1/yuki/watchlist/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { id } = req.params;
    const deleteRes = await pool.query(
      `DELETE FROM yuki_watchlists WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );

    if (deleteRes.rowCount === 0) {
      return res.status(404).json(ApiResponse.error('Watchlist not found or unauthorized'));
    }

    res.json(ApiResponse.success({ message: 'Watchlist deleted successfully' }));
  } catch (error: any) {
    logger.error('Failed to delete watchlist', { error });
    res.status(500).json(ApiResponse.error(`Failed to delete watchlist: ${error.message}`));
  }
});

/**
 * POST /v1/yuki/watchlist/:watchlistId/items
 * Add an item to a watchlist, with optional alert configuration.
 *
 * Body: {
 *   itemType: 'symbol' | 'pool' | 'vault' | 'investment_pool' | 'strategy' | 'creator',
 *   targetId: string (UUID of the referenced entity),
 *   alertMetric?: 'price' | 'apy' | 'tvl',
 *   alertDirection?: 'above' | 'below',
 *   alertThreshold?: number
 * }
 */
router.post('/:watchlistId/items', async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { watchlistId } = req.params;
    const { itemType, targetId, alertMetric, alertDirection, alertThreshold, metadata } = req.body;

    if (!itemType || !VALID_ITEM_TYPES.includes(itemType)) {
      return res.status(400).json(ApiResponse.error(`itemType must be one of: ${VALID_ITEM_TYPES.join(', ')}`));
    }
    if (!targetId) {
      return res.status(400).json(ApiResponse.error('targetId is required'));
    }

    // Alert config must be all-or-nothing, and metric must fit the type --
    // mirrors the DB CHECK constraints, but checking here first gives a
    // clean 400 instead of a raw Postgres constraint-violation error.
    const hasAnyAlertField = alertMetric || alertDirection || alertThreshold !== undefined;
    const hasAllAlertFields = alertMetric && alertDirection && alertThreshold !== undefined;
    if (hasAnyAlertField && !hasAllAlertFields) {
      return res.status(400).json(ApiResponse.error('alertMetric, alertDirection, and alertThreshold must all be provided together, or all omitted'));
    }
    if (hasAllAlertFields) {
      const allowedMetrics = VALID_METRICS_BY_TYPE[itemType];
      if (!allowedMetrics.includes(alertMetric)) {
        return res.status(400).json(ApiResponse.error(
          allowedMetrics.length === 0
            ? `Alerts are not yet supported for item type '${itemType}'`
            : `For item type '${itemType}', alertMetric must be one of: ${allowedMetrics.join(', ')}`
        ));
      }
      if (!['above', 'below'].includes(alertDirection)) {
        return res.status(400).json(ApiResponse.error(`alertDirection must be 'above' or 'below'`));
      }
    }

    // Verify watchlist ownership
    const ownershipCheck = await pool.query(
      `SELECT id FROM yuki_watchlists WHERE id = $1 AND user_id = $2`,
      [watchlistId, userId]
    );
    if (ownershipCheck.rowCount === 0) {
      return res.status(403).json(ApiResponse.error('Access to watchlist denied'));
    }

    const fkColumn = TARGET_JOINS[itemType].fkColumn;

    try {
      const insertRes = await pool.query(
        `INSERT INTO yuki_watchlist_items
           (watchlist_id, item_type, ${fkColumn}, alert_metric, alert_direction, alert_threshold, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          watchlistId,
          itemType,
          targetId,
          hasAllAlertFields ? alertMetric : null,
          hasAllAlertFields ? alertDirection : null,
          hasAllAlertFields ? Number(alertThreshold) : null,
          metadata || {},
        ]
      );
      res.json(ApiResponse.success(insertRes.rows[0]));
    } catch (dbError: any) {
      // Postgres unique_violation on the per-type unique index -- this
      // entity is already on this watchlist.
      if (dbError.code === '23505') {
        return res.status(409).json(ApiResponse.error('This item is already on the watchlist'));
      }
      // foreign_key_violation -- targetId doesn't exist in the referenced table.
      if (dbError.code === '23503') {
        return res.status(400).json(ApiResponse.error('targetId does not reference a real entity'));
      }
      throw dbError;
    }
  } catch (error: any) {
    logger.error('Failed to add watchlist item', { error });
    res.status(500).json(ApiResponse.error(`Failed to add watchlist item: ${error.message}`));
  }
});

/**
 * PATCH /v1/yuki/watchlist/items/:itemId/alert
 * Update or clear alert configuration for an item.
 * Pass alertMetric: null to clear the alert entirely.
 */
router.patch('/items/:itemId/alert', async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { itemId } = req.params;
    const { alertMetric, alertDirection, alertThreshold } = req.body;

    const ownerRes = await pool.query(
      `SELECT i.* FROM yuki_watchlist_items i
       JOIN yuki_watchlists w ON i.watchlist_id = w.id
       WHERE i.id = $1 AND w.user_id = $2`,
      [itemId, userId]
    );
    if (ownerRes.rowCount === 0) {
      return res.status(404).json(ApiResponse.error('Watchlist item not found or unauthorized'));
    }
    const item = ownerRes.rows[0];

    const clearing = alertMetric === null;
    if (!clearing) {
      const allowedMetrics = VALID_METRICS_BY_TYPE[item.item_type];
      if (!allowedMetrics.includes(alertMetric)) {
        return res.status(400).json(ApiResponse.error(`For item type '${item.item_type}', alertMetric must be one of: ${allowedMetrics.join(', ')}`));
      }
      if (!['above', 'below'].includes(alertDirection)) {
        return res.status(400).json(ApiResponse.error(`alertDirection must be 'above' or 'below'`));
      }
      if (alertThreshold === undefined || Number.isNaN(Number(alertThreshold))) {
        return res.status(400).json(ApiResponse.error('alertThreshold is required'));
      }
    }

    const updateRes = await pool.query(
      `UPDATE yuki_watchlist_items
       SET alert_metric = $1, alert_direction = $2, alert_threshold = $3,
           alert_active = true, alert_last_fired_at = NULL
       WHERE id = $4
       RETURNING *`,
      [
        clearing ? null : alertMetric,
        clearing ? null : alertDirection,
        clearing ? null : Number(alertThreshold),
        itemId,
      ]
    );

    res.json(ApiResponse.success(updateRes.rows[0]));
  } catch (error: any) {
    logger.error('Failed to update alert', { error });
    res.status(500).json(ApiResponse.error(`Failed to update alert: ${error.message}`));
  }
});

/**
 * DELETE /v1/yuki/watchlist/items/:itemId
 */
router.delete('/items/:itemId', async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { itemId } = req.params;
    const verifyRes = await pool.query(
      `SELECT i.id FROM yuki_watchlist_items i
       JOIN yuki_watchlists w ON i.watchlist_id = w.id
       WHERE i.id = $1 AND w.user_id = $2`,
      [itemId, userId]
    );
    if (verifyRes.rowCount === 0) {
      return res.status(404).json(ApiResponse.error('Watchlist item not found or unauthorized'));
    }

    await pool.query(`DELETE FROM yuki_watchlist_items WHERE id = $1`, [itemId]);
    res.json(ApiResponse.success({ message: 'Watchlist item removed successfully' }));
  } catch (error: any) {
    logger.error('Failed to remove watchlist item', { error });
    res.status(500).json(ApiResponse.error(`Failed to remove watchlist item: ${error.message}`));
  }
});

export default router;