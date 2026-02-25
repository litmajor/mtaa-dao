/**
 * Strategy Vaults API Routes
 *
 * Manage vault deposits, withdrawals, performance tracking, and execution
 * Vaults execute curated trading strategies automatically via VaultExecutionService
 */

import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { VaultExecutionService } from '../services/vaultExecutionService';
import { serializeVaultResponse, serializeNumeric } from '../utils/serializationHelpers';
import { rateLimitMiddleware, withdrawalLimits } from '../middleware/rateLimitConfig';

// Mock database object
const db = {
  query: async (sql: string, params?: any[]) => {
    return [];
  },
  queryOne: async (sql: string, params?: any[]) => {
    return null;
  },
  insert: async (data: any) => {
    return { success: true };
  },
  update: async (table: string, data: any, where: any) => {
    return { success: true };
  },
  delete: async (table: string, where: any) => {
    return { success: true };
  },
};

const router = express.Router();

// Inject vault execution service (initialized in main server)
let vaultService: VaultExecutionService;

export function setVaultService(service: VaultExecutionService) {
  vaultService = service;
}

// ============================================================================
// VAULT LISTING & DISCOVERY
// ============================================================================

/**
 * GET /api/vaults
 * List all available strategy vaults with current performance metrics
 */
router.get('/', async (req, res) => {
  try {
    const vaults = await db.query(`
      SELECT id, name, description, category, strategy_id, 
             total_value, total_shares, created_at, status
      FROM vaults
      ORDER BY total_value DESC
    `);

    res.json({
      success: true,
      data: vaults || [],
      count: vaults?.length || 0,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/vaults/:id
 * Get detailed vault information including positions, PnL, strategy
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const vault = vaultService?.getVault(id);
    if (!vault) {
      return res.status(404).json({ success: false, error: 'Vault not found' });
    }

    const depositors = Array.from(vault.depositors.values()).map((d) => ({
      userId: d.userId,
      shares: d.shares,
      currentValue: d.currentValue,
      profitLoss: d.profitLoss,
      depositedAt: d.depositedAt,
    }));

    res.json({
      success: true,
      data: {
        vaultId: vault.vaultId,
        name: vault.name,
        strategyId: vault.strategyId,
        totalValue: vault.totalValue,
        totalShares: vault.totalShares,
        isActive: vault.isActive,
        depositorCount: vault.depositors.size,
        positions: vault.positions,
        lastExecutionTime: vault.lastExecutionTime,
        depositors,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================================================
// VAULT DEPOSITS & WITHDRAWALS
// ============================================================================

/**
 * POST /api/vaults/:id/deposit
 * Deposit capital into a vault
 */
router.post('/:id/deposit', [authenticateToken as any], async (req: any, res: Response) => {
  try {
    const { id } = req.params as any;
    const { amount } = req.body;
    const userId = (req.user as any)?.id || 'unknown';

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    // Execute deposit via vault service
    const { shares, currentValue } = await vaultService.depositToVault(id, userId, amount);

    // Log deposit transaction
    await db.insert({
      userId,
      vaultId: id,
      type: 'deposit',
      amount,
      shares,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      data: {
        vaultId: id,
        amount: serializeNumeric(amount),
        shares: serializeNumeric(shares),
        sharePrice: serializeNumeric(String(Number(amount) / Number(shares))),
        currentValue: serializeNumeric(currentValue),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /api/vaults/:id/withdraw
 * Withdraw capital from a vault (redeem shares)
 * 
 * PHASE 1: SAFETY - Rate limited to 10 withdrawals per hour per user
 */
router.post('/:id/withdraw', 
  [authenticateToken as any, rateLimitMiddleware(withdrawalLimits)], 
  async (req: any, res: Response) => {
  try {
    const { id } = req.params as any;
    const { shares } = req.body;
    const userId = (req.user as any)?.id || 'unknown';

    if (!shares || shares <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid shares' });
    }

    // Execute withdrawal
    const { amount, profitLoss } = await vaultService.withdrawFromVault(id, userId, shares);

    // Log withdrawal
    await db.insert({
      userId,
      vaultId: id,
      type: 'withdrawal',
      shares,
      amount,
      profitLoss,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      data: {
        vaultId: id,
        shares: serializeNumeric(shares),
        withdrawAmount: serializeNumeric(amount),
        profitLoss: serializeNumeric(profitLoss),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/vaults/:id/my-position
 * Get user's position in a vault
 */
router.get('/:id/my-position', [authenticateToken as any], async (req: any, res: Response) => {
  try {
    const { id } = req.params as any;
    const userId = (req.user as any)?.id || 'unknown';

    const depositor = vaultService?.getDepositor(id, userId);
    if (!depositor) {
      return res.status(404).json({ success: false, error: 'No position in vault' });
    }

    res.json({
      success: true,
      data: {
        userId,
        vaultId: id,
        shares: depositor.shares,
        currentValue: depositor.currentValue,
        profitLoss: depositor.profitLoss,
        depositAmount: depositor.depositAmount,
        depositedAt: depositor.depositedAt,
        lastUpdateAt: depositor.lastUpdateAt,
        sharePrice: depositor.currentValue / depositor.shares,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================================================
// VAULT POSITIONS & PERFORMANCE
// ============================================================================

/**
 * GET /api/vaults/:id/positions
 * Get current positions held by the vault
 */
router.get('/:id/positions', async (req, res) => {
  try {
    const { id } = req.params;
    const vault = vaultService?.getVault(id);

    if (!vault) {
      return res.status(404).json({ success: false, error: 'Vault not found' });
    }

    res.json({
      success: true,
      data: vault.positions,
      count: vault.positions.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/vaults/:id/performance
 * Get vault performance metrics and historical returns
 */
router.get('/:id/performance', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30 } = req.query;

    const performance = vaultService?.getPerformance(id) || [];
    const filtered = performance.slice(-parseInt(days as string));

    res.json({
      success: true,
      data: {
        vaultId: id,
        period: parseInt(days as string),
        performance: filtered.map((p) => ({
          timestamp: p.timestamp,
          totalValue: p.totalValue,
          dailyReturn: p.dailyReturn,
          cumulativeReturn: p.cumulativeReturn,
          trades: p.trades,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/vaults/:id/history
 * Get transaction history for a vault
/**
 * GET /api/vaults/:id/execution-log
 * Get vault execution history
 */
router.get('/:id/execution-log', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const logs = await (db.query as any)(
      `SELECT * FROM vault_execution_logs 
       WHERE vault_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [id, parseInt(limit as string)]
    );

    res.json({
      success: true,
      data: logs || [],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================================================
// VAULT MANAGEMENT (Creator/Admin Only)
// ============================================================================

/**
 * POST /api/vaults
 * Create a new strategy vault
 */
router.post('/', [authenticateToken as any], async (req: any, res: Response) => {
  try {
    const { name, description, category, strategyId, initialBalance } = req.body;
    const adminId = (req.user as any)?.id || 'unknown';

    // Check admin permissions
    const isAdmin = await db.queryOne(
      'SELECT 1 FROM admin_users WHERE user_id = ?',
      [adminId]
    );
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const vaultId = `vault_${Date.now()}`;

    // Create vault in service
    const vault = await vaultService.createVault(
      vaultId,
      name,
      strategyId,
      initialBalance || 0
    );

    // Persist to database
    await db.insert({
      id: vaultId,
      name,
      description,
      category,
      strategy_id: strategyId,
      total_value: initialBalance || 0,
      total_shares: 1_000_000,
      status: 'active',
      created_at: new Date(),
      created_by: adminId,
    });

    res.json({
      success: true,
      data: {
        vaultId,
        name,
        category,
        strategyId,
        totalValue: initialBalance,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * PUT /api/vaults/:id/pause
 * Pause vault execution
 */
router.put('/:id/pause', [authenticateToken as any], async (req: any, res: Response) => {
  try {
    const { id } = req.params as any;

    vaultService?.pauseVault(id);

    await db.update('vaults', { status: 'paused' }, { id });

    res.json({
      success: true,
      data: { vaultId: id, status: 'paused' },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * PUT /api/vaults/:id/resume
 * Resume vault execution
 */
router.put('/:id/resume', [authenticateToken as any], async (req: any, res: Response) => {
  try {
    const { id } = req.params as any;

    vaultService?.resumeVault(id);

    await db.update('vaults', { status: 'active' }, { id });

    res.json({
      success: true,
      data: { vaultId: id, status: 'active' },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/vaults/:id/analytics
 * Get detailed vault analytics
 */
router.get('/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;
    const vault = vaultService?.getVault(id);

    if (!vault) {
      return res.status(404).json({ success: false, error: 'Vault not found' });
    }

    const performance = vault.performanceHistory;
    const totalReturn = ((vault.totalValue - 1000000) / 1000000) * 100 || 0;
    const avgDailyReturn =
      performance.length > 0
        ? performance.reduce((sum, p) => sum + p.dailyReturn, 0) / performance.length
        : 0;

    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = vault.totalValue;
    for (const p of performance) {
      if (p.totalValue > peak) peak = p.totalValue;
      const drawdown = ((peak - p.totalValue) / peak) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    const totalTrades = performance.reduce((sum, p) => sum + p.trades, 0);

    res.json({
      success: true,
      data: {
        vaultId: id,
        totalValue: vault.totalValue,
        depositorCount: vault.depositors.size,
        totalReturn,
        avgDailyReturn,
        maxDrawdown,
        totalTrades,
        positions: vault.positions,
        isActive: vault.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
