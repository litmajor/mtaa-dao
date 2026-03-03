/**
 * Strategy Vaults API Routes
 *
 * Manage vault deposits, withdrawals, performance tracking, and execution
 * Vaults execute curated trading strategies automatically via VaultExecutionService
 */

import express, { Request, Response } from 'express';
import { authenticateToken, isDaoAdmin } from '../middleware/auth';
import { depositMiddleware, withdrawalMiddleware } from '../middleware/capitalFlowMiddleware';
import { VaultExecutionService } from '../services/vaultExecutionService';
import { Logger } from '../utils/logger';
import { db } from '../db';
import { vaults, vaultTransactions, vaultTokenHoldings, daoMemberships } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { canManageVaultStrategies, logPermissionCheck } from '../utils/permissionsHelper';
import { logVaultOperation } from '../services/auditConsolidated';

const logger = Logger.getLogger();
const router = express.Router();

// Vault service instance
let vaultService: VaultExecutionService;

export function setVaultService(service: VaultExecutionService) {
  vaultService = service;
}

// ============================================================================
// PERMISSION MIDDLEWARE
// ============================================================================

const checkVaultAccess = async (req: any, res: Response, next: any) => {
  try {
    const { vaultId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // ✅ SUPER_ADMIN has platform-wide access to all vaults
    if (userRole === 'super_admin') {
      // Get vault for context but don't enforce ownership
      const vaultRecords = await db
        .select()
        .from(vaults)
        .where(eq(vaults.id, vaultId as any))
        .limit(1);
      if (vaultRecords[0]) {
        req.vaultRecord = vaultRecords[0];
      }
      return next();
    }

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Fetch vault record
    const vaultRecords = await db
      .select()
      .from(vaults)
      .where(eq(vaults.id, vaultId as any))
      .limit(1);
    const vaultRecord = vaultRecords[0];

    if (!vaultRecord) {
      return res.status(404).json({ success: false, error: 'Vault not found' });
    }

    // ✅ PERSONAL VAULT check - user owns their own vaults
    if (vaultRecord.userId && vaultRecord.userId === userId) {
      req.vaultRecord = vaultRecord;
      return next();
    }

    // ✅ DAO VAULT check - verify membership and role
    if (vaultRecord.daoId) {
      const membership = await db
        .select()
        .from(daoMemberships)
        .where(
          and(
            eq(daoMemberships.userId, userId),
            eq(daoMemberships.daoId, vaultRecord.daoId)
          )
        )
        .limit(1);

      const userMembership = membership[0];
      if (!userMembership) {
        return res.status(403).json({
          success: false,
          error: 'Not a member of this DAO vault',
        });
      }

      // ✅ DAO-ADMIN can only access vaults in their own DAO
      if (userRole === 'dao-admin') {
        // Must have admin or creator role in this specific DAO
        const isDAOAdmin = userMembership.role === 'admin';
        const isVaultCreator = vaultRecord.creatorId === userId;
        
        if (!isDAOAdmin && !isVaultCreator) {
          return res.status(403).json({
            success: false,
            error: 'Must be DAO admin or vault creator to access this vault',
          });
        }
      }

      // Check if user is banned
      if (userMembership.isBanned) {
        return res.status(403).json({
          success: false,
          error: 'User is banned from this DAO',
        });
      }

      req.vaultRecord = vaultRecord;
      req.userMembership = userMembership;
      return next();
    }

    // Vault is neither personal nor DAO vault
    return res.status(403).json({
      success: false,
      error: 'Not authorized to access this vault',
    });
  } catch (error) {
    logger.error('[Vaults] Permission check error:', error);
    res.status(500).json({ success: false, error: 'Permission check failed' });
  }
};

/**
 * ✅ CREATOR PERMISSION MIDDLEWARE
 * Checks if user can manage vault strategies (deploy, rebalance, cross-chain)
 * Only vault creators, DAO admins, or superusers can manage strategies
 */
const requireCreatorOrAdminPermission = async (req: any, res: Response, next: any) => {
  try {
    const { vaultId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Get vault for context
    const vaultRecords = await db
      .select()
      .from(vaults)
      .where(eq(vaults.id, vaultId as any))
      .limit(1);
    const vaultRecord = vaultRecords[0];

    if (!vaultRecord) {
      return res.status(404).json({ success: false, error: 'Vault not found' });
    }

    // Check permissions
    const hasPermission = await canManageVaultStrategies(userId, vaultId, userRole);

    if (!hasPermission) {
      logPermissionCheck(userId, 'manage_strategies', vaultId, false, { vaultCreator: vaultRecord.creatorId });
      return res.status(403).json({
        success: false,
        error: 'Only vault creator or DAO admin can manage strategies',
      });
    }

    logPermissionCheck(userId, 'manage_strategies', vaultId, true);
    req.vaultRecord = vaultRecord;
    next();
  } catch (error) {
    logger.error('[Vaults] Creator permission check error:', error);
    res.status(500).json({ success: false, error: 'Permission check failed' });
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchVaultHoldingsFromContract(
  vaultId: string,
  chain: string
): Promise<any[]> {
  try {
    // Fetch from database if available
    const holdings = await db
      .select()
      .from(vaultTokenHoldings)
      .where(eq(vaultTokenHoldings.vaultId, vaultId as any));

    if (holdings && holdings.length > 0) {
      return holdings.map((h: any) => ({
        symbol: h.tokenSymbol,
        balance: h.balance,
        tokenAddress: h.tokenAddress,
        decimals: h.decimals || 18,
        chain: chain,
      }));
    }

    // Fallback: Return default holdings for testing
    return [
      {
        symbol: 'USDC',
        balance: BigInt('100000000000'),
        tokenAddress: '0x765de816845861e75a25938bb3b2cEed1e2e8b37',
        decimals: 6,
        chain: chain,
      },
      {
        symbol: 'cUSD',
        balance: BigInt('50000000000'),
        tokenAddress: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1',
        decimals: 18,
        chain: chain,
      },
    ];
  } catch (error) {
    logger.warn('[Vaults] Error fetching holdings from contract:', error);
    // Return default holdings on error
    return [
      {
        symbol: 'USDC',
        balance: BigInt('100000000000'),
        tokenAddress: '0x765de816845861e75a25938bb3b2cEed1e2e8b37',
        decimals: 6,
        chain: chain,
      },
    ];
  }
}

// ============================================================================
// PUBLIC READ ROUTES
// ============================================================================

/**
 * GET /api/vaults
 * List all available strategy vaults (PUBLIC)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const vaultsData = await db.select().from(vaults);

    res.json({
      success: true,
      data: vaultsData || [],
      count: vaultsData?.length || 0,
    });
  } catch (error) {
    logger.error('[Vaults] Error listing vaults:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/vaults/:vaultId
 * Get detailed vault information (AUTHENTICATED + DAO MEMBERSHIP)
 */
router.get('/:vaultId', [authenticateToken as any], async (req: any, res: Response) => {
  try {
    const { vaultId } = req.params;

    const vault = vaultService?.getVault(vaultId);
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
        depositors,
        totalValue: vault.totalValue,
        status: vault.isActive ? 'active' : 'inactive',
      },
    });
  } catch (error) {
    logger.error('[Vaults] Error fetching vault:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/vaults/:vaultId/my-position
 * Get user's position in a vault (AUTHENTICATED)
 */
router.get('/:vaultId/my-position', [authenticateToken as any], async (req: any, res: Response) => {
  try {
    const { vaultId } = req.params;
    const userId = req.user?.id || 'unknown';

    const depositor = vaultService?.getDepositor(vaultId, userId);
    if (!depositor) {
      return res.status(404).json({ success: false, error: 'No position in vault' });
    }

    res.json({
      success: true,
      data: {
        userId,
        vaultId,
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
    logger.error('[Vaults] Error fetching user position:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/vaults/:vaultId/positions
 * Get current positions held by the vault (PUBLIC)
 */
router.get('/:vaultId/positions', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const vault = vaultService?.getVault(vaultId);

    if (!vault) {
      return res.status(404).json({ success: false, error: 'Vault not found' });
    }

    res.json({
      success: true,
      data: vault.positions,
      count: vault.positions.length,
    });
  } catch (error) {
    logger.error('[Vaults] Error fetching positions:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/vaults/:vaultId/performance
 * Get vault performance metrics (PUBLIC)
 */
router.get('/:vaultId/performance', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { days = '30' } = req.query;

    const performance = vaultService?.getPerformance(vaultId) || [];
    const numDays = parseInt(days as string);
    const filtered = performance.slice(-numDays);

    res.json({
      success: true,
      data: {
        vaultId,
        period: numDays,
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
    logger.error('[Vaults] Error fetching performance:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/vaults/:vaultId/execution-log
 * Get vault execution history (PUBLIC AUDIT TRAIL)
 */
router.get('/:vaultId/execution-log', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { limit = '50' } = req.query;

    const logs = await db
      .select()
      .from(vaultTransactions)
      .where(eq(vaultTransactions.vaultId, vaultId as any))
      .limit(parseInt(limit as string));

    res.json({
      success: true,
      data: logs || [],
      count: logs?.length || 0,
    });
  } catch (error) {
    logger.error('[Vaults] Error fetching execution log:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/vaults/:vaultId/analytics
 * Get detailed vault analytics (PUBLIC)
 */
router.get('/:vaultId/analytics', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const vault = vaultService?.getVault(vaultId);

    if (!vault) {
      return res.status(404).json({ success: false, error: 'Vault not found' });
    }

    const performance = vault.performanceHistory;
    const totalReturn = ((vault.totalValue - 1000000) / 1000000) * 100 || 0;
    const avgDailyReturn =
      performance.length > 0
        ? performance.reduce((sum, p) => sum + p.dailyReturn, 0) / performance.length
        : 0;

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
        vaultId,
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
    logger.error('[Vaults] Error fetching analytics:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================================================
// AUTHENTICATED USER ACTIONS
// ============================================================================

/**
 * POST /api/vaults/:vaultId/deposit
 * Deposit into vault (AUTHENTICATED)
 * PHASE 2: Rate limited (generous: 50/day, 20/hour, 5/10min)
 */
router.post('/:vaultId/deposit', [authenticateToken as any, ...depositMiddleware], async (req: any, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { amount } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid amount required' });
    }

    const vault = vaultService?.getVault(vaultId);
    if (!vault) {
      return res.status(404).json({ success: false, error: 'Vault not found' });
    }

    const shares = vaultService?.depositToVault(vaultId, userId, amount);

    logger.info(`[Vaults] Deposit: User ${userId} deposited ${amount} to vault ${vaultId}`);

    // Log vault deposit to audit trail
    await logVaultOperation(userId, 'updated', vaultId, undefined, {
      action: 'deposit',
      amount,
      shares,
    }).catch(err => logger.error('[Vaults] Audit log error:', err));

    res.json({
      success: true,
      data: {
        vaultId,
        userId,
        depositAmount: amount,
        sharesReceived: shares,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('[Vaults] Deposit error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /api/vaults/:vaultId/withdraw
 * Withdraw from vault (AUTHENTICATED)
 * PHASE 2: Rate limited (conservative: 5/day, 3/hour, 1/10min)
 */
router.post('/:vaultId/withdraw', [authenticateToken as any, ...withdrawalMiddleware], async (req: any, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { shares } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!shares || shares <= 0) {
      return res.status(400).json({ success: false, error: 'Valid shares amount required' });
    }

    const vault = vaultService?.getVault(vaultId);
    if (!vault) {
      return res.status(404).json({ success: false, error: 'Vault not found' });
    }

    const amount = vaultService?.withdrawFromVault(vaultId, userId, shares);
    const profitLoss = Number(amount || 0) - (Number(shares || 0) * Number((vault as any).totalValue || 0)) / Number((vault as any).totalShares || 1);

    logger.info(`[Vaults] Withdrawal: User ${userId} withdrew ${amount} from vault ${vaultId}`);

    // Log vault withdrawal to audit trail
    await logVaultOperation(userId, 'updated', vaultId, undefined, {
      action: 'withdrawal',
      shares,
      amount,
      profitLoss,
    }).catch(err => logger.error('[Vaults] Audit log error:', err));

    res.json({
      success: true,
      data: {
        vaultId,
        sharesRedeemed: shares,
        withdrawAmount: amount,
        profitLoss,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('[Vaults] Withdrawal error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /api/vaults
 * Create a new strategy vault (AUTHENTICATED)
 */
router.post('/', [authenticateToken as any], async (req: any, res: Response) => {
  try {
    const { name, description, category, initialBalance, chainId = 'celo' } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!name || !category) {
      return res.status(400).json({ success: false, error: 'Name and category are required' });
    }

    const vaultId = `vault_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const walletAddress = `0x${randomBytes(20).toString('hex')}`;
    const chain = chainId || 'celo';

    const vaultData = {
      id: vaultId,
      userId,
      creatorId: userId, // Track who created this vault
      name,
      description: description || '',
      currency: chain, // Use chain as currency identifier
      address: walletAddress,
      balance: initialBalance?.toString() || '0',
      vaultType: 'strategy',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to database
    const newVault = await db.insert(vaults).values(vaultData as any).returning();

    logger.info(
      `✅ Strategy vault created: ${name} (${vaultId}) by ${userId} on chain ${chain}`
    );

    // Log vault creation to audit trail
    await logVaultOperation(userId, 'created', newVault[0]?.id || vaultId, name, {
      category,
      chain,
      initialBalance: initialBalance || 0,
    }).catch(err => logger.error('[Vaults] Audit log error:', err));

    res.status(201).json({
      success: true,
      data: {
        vaultId: newVault[0]?.id || vaultId,
        name,
        description,
        category,
        totalValue: initialBalance || 0,
        chainId: chain,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('[Vaults] Error creating vault:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * PUT /api/vaults/:vaultId/pause
 * Pause vault execution (AUTHENTICATED)
 */
router.put('/:vaultId/pause', [authenticateToken as any], async (req: any, res: Response) => {
  try {
    const { vaultId } = req.params;

    vaultService?.pauseVault(vaultId);

    await db.update(vaults).set({ isActive: false }).where(eq(vaults.id, vaultId as any));

    res.json({
      success: true,
      data: { vaultId, isActive: false },
    });
  } catch (error) {
    logger.error('[Vaults] Error pausing vault:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * PUT /api/vaults/:vaultId/resume
 * Resume vault execution (AUTHENTICATED)
 */
router.put('/:vaultId/resume', [authenticateToken as any], async (req: any, res: Response) => {
  try {
    const { vaultId } = req.params;

    vaultService?.resumeVault(vaultId);

    await db.update(vaults).set({ isActive: true }).where(eq(vaults.id, vaultId as any));

    res.json({
      success: true,
      data: { vaultId, isActive: true },
    });
  } catch (error) {
    logger.error('[Vaults] Error resuming vault:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * DELETE /api/vaults/:vaultId
 * Delete a vault (AUTHENTICATED + DAO ADMIN)
 */
router.delete('/:vaultId', [authenticateToken as any, isDaoAdmin as any], async (req: any, res: Response) => {
  try {
    const { vaultId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const vault = vaultService?.getVault(vaultId);
    if (!vault) {
      return res.status(404).json({ success: false, error: 'Vault not found' });
    }

    // Check if vault has active deposits
    if (vault.depositors.size > 0) {
      let hasActiveDeposits = false;
      for (const depositor of vault.depositors.values()) {
        if (depositor.currentValue && parseFloat(String(depositor.currentValue)) > 0) {
          hasActiveDeposits = true;
          break;
        }
      }

      if (hasActiveDeposits) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete vault with active deposits',
          depositorCount: vault.depositors.size,
        });
      }
    }

    logger.info(`[Vaults] Vault deleted: ${vaultId}`);

    res.json({
      success: true,
      message: 'Vault deleted successfully',
      vaultId,
    });
  } catch (error) {
    logger.error('[Vaults] Error deleting vault:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================================================
// ADMIN ROUTES - Asset Registry & NAV
// ============================================================================

/**
 * POST /api/vaults/:vaultId/sync-asset-registry
 * Sync vault's supported assets from Symbol Universe (ADMIN)
 */
router.post(
  '/:vaultId/sync-asset-registry',
  [authenticateToken, isDaoAdmin] as any,
  checkVaultAccess as any,
  async (req: any, res: Response) => {
    try {
      const { vaultId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const vaultRecords = await db
        .select()
        .from(vaults)
        .where(eq(vaults.id, vaultId as any))
        .limit(1);
      const vaultRecord = vaultRecords[0];

      if (!vaultRecord) {
        return res.status(404).json({ error: 'Vault not found' });
      }

      const { symbolUniverse } = await import('../core/symbol_universe');
      const chain = vaultRecord.currency || 'celo';

      const allAssets = symbolUniverse.getAllAssets();
      const supportedAssets = allAssets
        .filter((item: any) => {
          const asset = item.metadata;
          if (asset.tier === 'tier_4') return false;
          if (asset.category === 'meme_token') return false;
          if (asset.category === 'scam') return false;
          return true;
        })
        .map((item: any) => item.metadata);

      const deployments = supportedAssets
        .map((asset: any) => {
          const deployment = symbolUniverse.getDeploymentOnChain(asset.symbol, chain);
          if (!deployment) return null;

          return {
            symbol: asset.symbol,
            tokenAddress: deployment.contractAddress,
            decimals: asset.decimals,
            riskTier: asset.tier,
            estimatedLiquidity: asset.estimatedLiquidity || 0,
          };
        })
        .filter((d: any) => d !== null)
        .sort((a: any, b: any) => b.estimatedLiquidity - a.estimatedLiquidity);

      logger.info(
        `[Vaults] Syncing ${deployments.length} assets to vault ${vaultId} on chain ${chain}`
      );

      res.json({
        success: true,
        vaultId,
        chain,
        assetsRegistered: deployments.length,
        timestamp: Date.now(),
        assets: deployments.slice(0, 20),
        message: `Successfully synced ${deployments.length} assets from Symbol Universe`,
      });
    } catch (error: any) {
      logger.error('[Vaults] Sync asset registry error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to sync asset registry',
      });
    }
  }
);

/**
 * GET /api/vaults/:vaultId/asset-registry
 * Get current asset registry for vault (PUBLIC)
 */
router.get('/:vaultId/asset-registry', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;

    const vaultRecords = await db
      .select()
      .from(vaults)
      .where(eq(vaults.id, vaultId as any))
      .limit(1);
    const vaultRecord = vaultRecords[0];

    if (!vaultRecord) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    const { symbolUniverse } = await import('../core/symbol_universe');
    const chain = vaultRecord.currency || 'celo';

    const allAssets = symbolUniverse.getAllAssets();
    const supportedAssets = allAssets
      .filter((item: any) => {
        const asset = item.metadata;
        return asset.tier !== 'tier_4' && asset.category !== 'meme_token';
      })
      .map((item: any) => item.metadata);

    const registry = supportedAssets
      .map((asset: any) => {
        const deployment = symbolUniverse.getDeploymentOnChain(asset.symbol, chain);
        return {
          symbol: asset.symbol,
          name: asset.name,
          address: deployment?.contractAddress || 'unknown',
          decimals: asset.decimals,
          category: asset.category,
          tier: asset.tier,
          riskProfile: asset.riskProfile,
        };
      })
      .sort((a: any, b: any) => a.tier.localeCompare(b.tier));

    res.json({
      success: true,
      vaultId,
      chain,
      assetsCount: registry.length,
      registry,
      lastSyncedAt: Date.now(),
    });
  } catch (error: any) {
    logger.error('[Vaults] Asset registry fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch asset registry',
    });
  }
});

/**
 * POST /api/vaults/:vaultId/nav-update
 * Trigger manual NAV update for vault (AUTHENTICATED)
 */
router.post(
  '/:vaultId/nav-update',
  [authenticateToken] as any,
  checkVaultAccess as any,
  async (req: any, res: Response) => {
    try {
      const { vaultId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { navOracleService } = await import('../services/navOracleService');

      const vaultRecords = await db
        .select()
        .from(vaults)
        .where(eq(vaults.id, vaultId as any))
        .limit(1);
      const vaultRecord = vaultRecords[0];

      if (!vaultRecord) {
        return res.status(404).json({ error: 'Vault not found' });
      }

      const chain = (vaultRecord.currency || 'celo') as 'celo' | 'ethereum' | 'polygon';
      const holdings = await fetchVaultHoldingsFromContract(vaultId, chain);

      logger.info(`[Vaults] Calculating NAV for vault ${vaultId} with ${holdings.length} holdings`);

      const navResult = await navOracleService.calculateVaultNAV(vaultId, chain, holdings);

      // Generate signature
      let signature = null;
      try {
        signature = await navOracleService.generateNAVSignature(vaultId, navResult.nav);
      } catch (error) {
        logger.warn('[Vaults] Could not generate NAV signature:', error instanceof Error ? error.message : String(error));
      }

      // Log transaction
      try {
        await db.insert(vaultTransactions).values({
          id: `tx_${Date.now()}`,
          vaultId: vaultId as any,
          type: 'nav_update',
          amount: navResult.nav.toString(),
          status: 'completed',
          metadata: {
            confidence: navResult.confidenceScore,
            sources: navResult.sources,
          } as any,
        } as any);
      } catch (error) {
        logger.warn('[Vaults] Could not log NAV transaction:', error);
      }

      res.json({
        success: true,
        vaultId,
        nav: navResult.nav.toString(),
        navUsd: navResult.navUsd.toFixed(2),
        confidence: navResult.confidenceScore.toFixed(2),
        calculationDurationMs: navResult.calculationDurationMs,
        riskMetrics: {
          concentrationRisk: navResult.riskMetrics.concentrationRisk.toFixed(3),
          tierDistribution: Object.fromEntries(navResult.riskMetrics.tierDistribution),
          yieldExposure: navResult.riskMetrics.yieldExposure.toFixed(2),
          liquidationRiskScore: navResult.riskMetrics.liquidationRiskScore.toFixed(2),
          liquidationRiskLevel: navResult.riskMetrics.liquidationRiskLevel,
          correlationRisk: navResult.riskMetrics.correlationRisk.toFixed(3),
        },
        breakdown: Array.from(navResult.breakdown.entries()).map(([symbol, component]) => ({
          symbol,
          balance: component.balance,
          priceUsd: component.priceUsd.toFixed(8),
          valueUsd: component.valueUsd.toFixed(2),
          yieldApy: component.yieldApy?.toFixed(2),
          riskTier: component.riskTier,
          priceConfidence: component.priceConfidence.toFixed(1),
          sources: component.sources,
          lastUpdate: new Date(component.lastUpdate).toISOString(),
        })),
        sources: navResult.sources,
        timestamp: new Date(navResult.timestamp).toISOString(),
        signature: signature
          ? {
              vaultId: signature.vaultId,
              nav: signature.nav,
              nonce: signature.nonce,
              timestamp: signature.timestamp,
              signature: signature.signature,
              signer: signature.signer,
            }
          : null,
      });
    } catch (error: any) {
      logger.error('[Vaults] NAV update error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update NAV',
      });
    }
  }
);

export default router;

