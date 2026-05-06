
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 DAO Investment Pools Router
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * DAO-scoped investment pool management with:
 * - Multi-asset portfolio configuration
 * - Basis points allocation (10000 = 100%)
 * - Pool creation, updates, deletion
 * - Asset management and composition analysis
 * - Pool health validation
 *
 * Base Path: /api/v1/daos/:daoId/investment-pools
 * Parent ensures: isAuthenticated, validateDaoId
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response, Router } from 'express';
import { db } from '../../../../db';
import { daoMemberships, investmentPools, poolAssets, poolProposals, poolVotes, poolGovernanceSettings } from '../../../../../shared/schema';
import { logger } from '../../../../utils/logger';
import { eq, and } from 'drizzle-orm';
import { poolGovernanceService } from '../../../../services/poolGovernanceService';

interface PoolParams {
  daoId: string;
  poolId?: string;
  assetId?: string;
}

type PoolRequest = Request<PoolParams>;

const router: Router = express.Router({ mergeParams: true });

// Helper: Check user is admin or manager
const checkPoolPermission = async (daoId: string, userId: string) => {
  const member = await db
    .select()
    .from(daoMemberships)
    .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, userId)));

  if (!member.length) throw new Error('User not a member of this DAO');
  if (member[0].role !== 'admin' && member[0].role !== 'manager') {
    throw new Error('Insufficient permissions: admin or manager role required');
  }

  return true;
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/daos/:daoId/investment-pools
// List all pools for a DAO
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/', async (req: PoolRequest, res: Response) => {
  try {
    const { daoId } = req.params as PoolParams;

    const pools = await db
      .select()
      .from(investmentPools)
      .where(eq(investmentPools.daoId, daoId));

    // Fetch assets for each pool
    const poolsWithAssets = await Promise.all(
      pools.map(async (pool: any) => {
        const assets = await db
          .select()
          .from(poolAssets)
          .where(and(eq(poolAssets.poolId, pool.id), eq(poolAssets.isActive, true)));

        return {
          id: pool.id,
          name: pool.name,
          symbol: pool.symbol,
          description: pool.description,
          tvl: pool.totalValueLocked,
          sharePrice: pool.sharePrice,
          createdAt: pool.createdAt,
          updatedAt: pool.updatedAt,
          assets: assets.map((a: any) => ({
            id: a.id,
            symbol: a.assetSymbol,
            name: a.assetName,
            address: a.tokenAddress,
            allocation: a.targetAllocation,
            balance: a.currentBalance,
            valueUsd: a.currentValueUsd,
          })),
          totalAllocation: assets.reduce(
            (sum: number, a: any) => sum + a.targetAllocation,
            0
          ),
        };
      })
    );

    res.json({ daoId, count: poolsWithAssets.length, pools: poolsWithAssets });
  } catch (error) {
    logger.error(`Error fetching pools for DAO ${req.params.daoId}:`, error);
    res.status(500).json({ error: 'Failed to fetch pools' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/daos/:daoId/investment-pools
// Create a new investment pool
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/', async (req: PoolRequest, res: Response) => {
  try {
    const { daoId } = req.params as PoolParams;
    const { name, symbol, description, assets } = req.body;
    const userId = req.user?.claims?.sub;

    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    // Check permissions
    try {
      await checkPoolPermission(daoId, userId);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Permission denied';
      return res
        .status(errMsg.includes('Insufficient') ? 403 : 400)
        .json({ error: errMsg });
    }

    // Validate input
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Pool name is required' });
    }
    if (!symbol || symbol.trim().length === 0) {
      return res.status(400).json({ error: 'Pool symbol is required' });
    }

    if (!Array.isArray(assets) || assets.length === 0) {
      return res
        .status(400)
        .json({ error: 'At least one asset is required' });
    }

    // Validate total allocation
    const totalAllocation = assets.reduce((sum: number, a: any) => sum + (a.allocation || 0), 0);
    if (totalAllocation > 10000) {
      return res.status(400).json({
        error: 'Total asset allocation exceeds 10000 basis points (100%)',
      });
    }

    // Create pool
    const result = await db.insert(investmentPools).values({
      daoId,
      name: name.trim(),
      symbol: symbol.trim(),
      description: description || null,
      createdBy: userId,
      isActive: true,
    });

    const poolId = Array.isArray(result) && result.length > 0 ? result[0].id : (result as any).id;

    // Create assets
    if (assets.length > 0) {
      await Promise.all(
        assets.map((a: any) =>
          db.insert(poolAssets).values({
            poolId,
            assetSymbol: a.symbol,
            assetName: a.name || null,
            tokenAddress: a.address || null,
            network: a.network || null,
            targetAllocation: a.allocation || 0,
            isActive: true,
          })
        )
      );
    }

    logger.info(
      `Investment pool "${name}" created for DAO ${daoId} by user ${userId}`
    );

    res.status(201).json({
      success: true,
      pool: {
        id: poolId,
        daoId,
        name,
        symbol,
        description: description || null,
        assets: assets.map((a: any) => ({
          symbol: a.symbol,
          name: a.name,
          address: a.address,
          allocation: a.allocation,
        })),
      },
    });
  } catch (error) {
    logger.error(
      `Error creating pool for DAO ${req.params.daoId}:`,
      error
    );
    res.status(500).json({ error: 'Failed to create pool' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/daos/:daoId/investment-pools/:poolId
// Get specific pool details
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/:poolId', async (req: PoolRequest, res: Response) => {
  try {
    const { daoId, poolId } = req.params as PoolParams & { poolId: string };

    const pool = await db
      .select()
      .from(investmentPools)
      .where(
        and(eq(investmentPools.daoId, daoId), eq(investmentPools.id, poolId))
      );

    if (!pool.length) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    const assets = await db
      .select()
      .from(poolAssets)
      .where(and(eq(poolAssets.poolId, poolId), eq(poolAssets.isActive, true)));

    const p = pool[0];

    res.json({
      id: p.id,
      daoId: p.daoId,
      name: p.name,
      symbol: p.symbol,
      description: p.description,
      tvl: p.totalValueLocked,
      sharePrice: p.sharePrice,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      assets: assets.map((a: any) => ({
        id: a.id,
        symbol: a.assetSymbol,
        name: a.assetName,
        address: a.tokenAddress,
        allocation: a.targetAllocation,
        balance: a.currentBalance,
        valueUsd: a.currentValueUsd,
      })),
      totalAllocation: assets.reduce(
        (sum: number, a: any) => sum + a.targetAllocation,
        0
      ),
    });
  } catch (error) {
    logger.error(
      `Error fetching pool ${req.params.poolId} for DAO ${req.params.daoId}:`,
      error
    );
    res.status(500).json({ error: 'Failed to fetch pool' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/v1/daos/:daoId/investment-pools/:poolId
// Update pool details
// ═══════════════════════════════════════════════════════════════════════════════
router.patch('/:poolId', async (req: PoolRequest, res: Response) => {
  try {
    const { daoId, poolId } = req.params as PoolParams & { poolId: string };
    const { name, symbol, description } = req.body;
    const userId = req.user?.claims?.sub;

    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    // Check permissions
    try {
      await checkPoolPermission(daoId, userId);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Permission denied';
      return res
        .status(errMsg.includes('Insufficient') ? 403 : 400)
        .json({ error: errMsg });
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined && name.trim().length > 0) {
      updates.name = name.trim();
    }
    if (symbol !== undefined && symbol.trim().length > 0) {
      updates.symbol = symbol.trim();
    }
    if (description !== undefined) updates.description = description || null;

    if (Object.keys(updates).length === 1) {
      // Only updatedAt
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    await db
      .update(investmentPools)
      .set(updates)
      .where(
        and(eq(investmentPools.daoId, daoId), eq(investmentPools.id, poolId))
      );

    const updated = await db
      .select()
      .from(investmentPools)
      .where(
        and(eq(investmentPools.daoId, daoId), eq(investmentPools.id, poolId))
      );

    if (!updated.length) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    const assets = await db
      .select()
      .from(poolAssets)
      .where(and(eq(poolAssets.poolId, poolId), eq(poolAssets.isActive, true)));

    const p = updated[0];

    res.json({
      id: p.id,
      daoId: p.daoId,
      name: p.name,
      symbol: p.symbol,
      description: p.description,
      tvl: p.totalValueLocked,
      assets: assets.map((a: any) => ({
        id: a.id,
        symbol: a.assetSymbol,
        allocation: a.targetAllocation,
      })),
    });
  } catch (error) {
    logger.error(
      `Error updating pool ${req.params.poolId} for DAO ${req.params.daoId}:`,
      error
    );
    res.status(500).json({ error: 'Failed to update pool' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/daos/:daoId/investment-pools/:poolId
// Delete a pool
// ═══════════════════════════════════════════════════════════════════════════════
router.delete('/:poolId', async (req: PoolRequest, res: Response) => {
  try {
    const { daoId, poolId } = req.params as PoolParams & { poolId: string };
    const userId = req.user?.claims?.sub;

    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    // Check permissions
    try {
      await checkPoolPermission(daoId, userId);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Permission denied';
      return res
        .status(errMsg.includes('Insufficient') ? 403 : 400)
        .json({ error: errMsg });
    }

    // Soft delete by setting isActive to false
    await db
      .update(investmentPools)
      .set({ isActive: false })
      .where(
        and(eq(investmentPools.daoId, daoId), eq(investmentPools.id, poolId))
      );

    logger.info(
      `Investment pool ${poolId} deleted from DAO ${daoId} by user ${userId}`
    );

    res.json({ success: true, message: 'Pool deleted' });
  } catch (error) {
    logger.error(
      `Error deleting pool ${req.params.poolId} from DAO ${req.params.daoId}:`,
      error
    );
    res.status(500).json({ error: 'Failed to delete pool' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/daos/:daoId/investment-pools/:poolId/assets
// Add asset to existing pool (recalculate allocations)
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:poolId/assets', async (req: PoolRequest, res: Response) => {
  try {
    const { daoId, poolId } = req.params as PoolParams & { poolId: string };
    const { symbol, name, address, network, basisPoints } = req.body;
    const userId = req.user?.claims?.sub;

    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    // Check permissions
    try {
      await checkPoolPermission(daoId, userId);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Permission denied';
      return res
        .status(errMsg.includes('Insufficient') ? 403 : 400)
        .json({ error: errMsg });
    }

    const allocation = basisPoints || 1000;
    
    if (!symbol) {
      return res.status(400).json({
        error: 'Asset symbol is required',
      });
    }

    if (allocation < 1 || allocation > 10000) {
      return res.status(400).json({
        error: 'Allocation must be between 1 and 10000 basis points',
      });
    }

    // Get existing assets
    const existingAssets = await db
      .select()
      .from(poolAssets)
      .where(and(eq(poolAssets.poolId, poolId), eq(poolAssets.isActive, true)));

    const currentTotal = existingAssets.reduce(
      (sum: number, a: any) => sum + a.targetAllocation,
      0
    );
    const newTotal = currentTotal + allocation;

    if (newTotal > 10000) {
      return res.status(400).json({
        error: `Adding ${allocation} basis points would exceed 10000 limit`,
        details: {
          currentTotal,
          requested: allocation,
          maximum: 10000 - currentTotal,
        },
      });
    }

    const result = await db.insert(poolAssets).values({
      poolId,
      assetSymbol: symbol,
      assetName: name || null,
      tokenAddress: address || null,
      network: network || null,
      targetAllocation: allocation,
      isActive: true,
    });

    const assetId = Array.isArray(result) && result.length > 0 ? result[0].id : (result as any).id;

    logger.info(
      `Asset ${symbol} added to pool ${poolId} in DAO ${daoId} by user ${userId}`
    );

    res.status(201).json({
      success: true,
      asset: {
        id: assetId,
        symbol,
        name: name || null,
        address: address || null,
        allocation,
      },
      poolTotal: newTotal,
    });
  } catch (error) {
    logger.error(
      `Error adding asset to pool ${req.params.poolId}:`,
      error
    );
    res.status(500).json({ error: 'Failed to add asset' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/daos/:daoId/investment-pools/:poolId/assets/:assetId
// Remove asset from pool
// ═══════════════════════════════════════════════════════════════════════════════
router.delete('/:poolId/assets/:assetId', async (req: PoolRequest, res: Response) => {
  try {
    const { daoId, poolId, assetId } = req.params as PoolParams & { poolId: string; assetId: string };
    const userId = req.user?.claims?.sub;

    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    // Check permissions
    try {
      await checkPoolPermission(daoId, userId);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Permission denied';
      return res
        .status(errMsg.includes('Insufficient') ? 403 : 400)
        .json({ error: errMsg });
    }

    // Check pool has multiple assets
    const assets = await db
      .select()
      .from(poolAssets)
      .where(and(eq(poolAssets.poolId, poolId), eq(poolAssets.isActive, true)));

    if (assets.length <= 1) {
      return res.status(400).json({
        error: 'Cannot remove the last asset from a pool. Delete the pool instead.',
      });
    }

    // Soft delete
    await db
      .update(poolAssets)
      .set({ isActive: false })
      .where(eq(poolAssets.id, assetId));

    logger.info(
      `Asset ${assetId} removed from pool ${poolId} by user ${userId}`
    );

    res.json({ success: true, message: 'Asset removed from pool' });
  } catch (error) {
    logger.error(
      `Error removing asset ${req.params.assetId} from pool ${req.params.poolId}:`,
      error
    );
    res.status(500).json({ error: 'Failed to remove asset' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/daos/:daoId/investment-pools/:poolId/composition
// Get detailed pool composition and allocation analysis
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/:poolId/composition', async (req: PoolRequest, res: Response) => {
  try {
    const { daoId, poolId } = req.params as PoolParams & { poolId: string };

    const pool = await db
      .select()
      .from(investmentPools)
      .where(
        and(eq(investmentPools.daoId, daoId), eq(investmentPools.id, poolId))
      );

    if (!pool.length) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    const assets = await db
      .select()
      .from(poolAssets)
      .where(and(eq(poolAssets.poolId, poolId), eq(poolAssets.isActive, true)));

    const totalAllocation = assets.reduce(
      (sum: number, a: any) => sum + a.targetAllocation,
      0
    );
    const isBalanced = totalAllocation === 10000;

    res.json({
      poolId,
      daoId,
      name: pool[0].name,
      isBalanced,
      totalAllocation,
      remainingAllocation: 10000 - totalAllocation,
      assetCount: assets.length,
      assets: assets.map((a: any) => ({
        id: a.id,
        symbol: a.assetSymbol,
        name: a.assetName,
        address: a.tokenAddress,
        allocation: a.targetAllocation,
        percentage: ((a.targetAllocation / 10000) * 100).toFixed(2),
        balance: a.currentBalance,
        valueUsd: a.currentValueUsd,
      })),
    });
  } catch (error) {
    logger.error(
      `Error fetching composition for pool ${req.params.poolId}:`,
      error
    );
    res.status(500).json({ error: 'Failed to fetch composition' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POOL GOVERNANCE - Weighted Voting
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/daos/:daoId/investment-pools/:poolId/governance/voting-power
 * Get user's voting power in the pool
 */
router.get('/:poolId/governance/voting-power', async (req: Request, res: Response) => {
  try {
    const { poolId } = (req as any).params;
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const votingPower = await poolGovernanceService.calculateVotingPower(poolId, userId);
    res.json(votingPower);
  } catch (error) {
    logger.error('Error fetching voting power:', error);
    res.status(500).json({ error: 'Failed to fetch voting power' });
  }
});

/**
 * GET /api/v1/daos/:daoId/investment-pools/:poolId/governance/proposals
 * Get all proposals for a pool
 */
router.get('/:poolId/governance/proposals', async (req: Request, res: Response) => {
  try {
    const { poolId } = (req as any).params;
    const { status } = req.query;

    const proposals = await poolGovernanceService.getProposals(poolId, status as string);
    res.json({ proposals });
  } catch (error) {
    logger.error('Error fetching proposals:', error);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

/**
 * GET /api/v1/daos/:daoId/investment-pools/:poolId/governance/proposals/:proposalId
 * Get proposal details
 */
router.get('/:poolId/governance/proposals/:proposalId', async (req: Request, res: Response) => {
  try {
    const { proposalId } = (req as any).params;

    const [proposal] = await db
      .select()
      .from(poolProposals)
      .where(eq(poolProposals.id, proposalId));

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const votes = await poolGovernanceService.getProposalVotes(proposalId);
    const result = await poolGovernanceService.checkAndFinalizeProposal(proposalId);

    res.json({ proposal, votes, result });
  } catch (error) {
    logger.error('Error fetching proposal:', error);
    res.status(500).json({ error: 'Failed to fetch proposal' });
  }
});

/**
 * POST /api/v1/daos/:daoId/investment-pools/:poolId/governance/proposals
 * Create a new pool governance proposal
 */
router.post('/:poolId/governance/proposals', async (req: Request, res: Response) => {
  try {
    const { poolId } = (req as any).params;
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { title, description, proposalType, details } = req.body;

    if (!title || !description || !proposalType) {
      return res.status(400).json({ error: 'Title, description, and proposal type are required' });
    }

    const proposal = await poolGovernanceService.createProposal(
      poolId,
      userId,
      title,
      description,
      proposalType,
      details || {}
    );

    res.json({ proposal, message: 'Proposal created successfully' });
  } catch (error) {
    logger.error('Error creating proposal:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create proposal'
    });
  }
});

/**
 * POST /api/v1/daos/:daoId/investment-pools/:poolId/governance/proposals/:proposalId/vote
 * Vote on a pool governance proposal
 */
router.post('/:poolId/governance/proposals/:proposalId/vote', async (req: Request, res: Response) => {
  try {
    const { proposalId } = (req as any).params;
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { vote, reason } = req.body;

    if (!vote || !['for', 'against', 'abstain'].includes(vote)) {
      return res.status(400).json({ error: 'Valid vote choice required (for, against, abstain)' });
    }

    const voteRecord = await poolGovernanceService.vote(proposalId, userId, vote, reason);
    res.json({ vote: voteRecord, message: 'Vote cast successfully' });
  } catch (error) {
    logger.error('Error casting vote:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to cast vote'
    });
  }
});

/**
 * POST /api/v1/daos/:daoId/investment-pools/:poolId/governance/proposals/:proposalId/execute
 * Execute a passed governance proposal
 */
router.post('/:poolId/governance/proposals/:proposalId/execute', async (req: Request, res: Response) => {
  try {
    const { proposalId } = (req as any).params;
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await poolGovernanceService.executeProposal(proposalId, userId);
    res.json(result);
  } catch (error) {
    logger.error('Error executing proposal:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to execute proposal'
    });
  }
});

/**
 * GET /api/v1/daos/:daoId/investment-pools/:poolId/governance/settings
 * Get pool governance settings
 */
router.get('/:poolId/governance/settings', async (req: Request, res: Response) => {
  try {
    const { poolId } = (req as any).params;

    const [settings] = await db
      .select()
      .from(poolGovernanceSettings)
      .where(eq(poolGovernanceSettings.poolId, poolId));

    if (!settings) {
      return res.status(404).json({ error: 'Governance settings not found' });
    }

    res.json(settings);
  } catch (error) {
    logger.error('Error fetching governance settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * PUT /api/v1/daos/:daoId/investment-pools/:poolId/governance/settings
 * Update pool governance settings (admin only)
 */
router.put('/:poolId/governance/settings', async (req: Request, res: Response) => {
  try {
    const { daoId, poolId } = (req as any).params;
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify admin permission
    await checkPoolPermission(daoId, userId);

    const updates = req.body;
    await db
      .update(poolGovernanceSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(poolGovernanceSettings.poolId, poolId));

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    logger.error('Error updating governance settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
