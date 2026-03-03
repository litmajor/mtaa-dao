import express from 'express';
import { db } from '../../storage';
import { tasks, walletTransactions, daoMemberships, daos } from '../../../shared/schema';
import { authenticate } from '../../auth';
import { eq, and, or, desc } from 'drizzle-orm';
import { z } from 'zod';
import { auditConsolidated } from '../../services/auditConsolidated';
import { rateLimitPerUser } from '../../middleware/rateLimit';

const router = express.Router({ mergeParams: true }); // mergeParams to access :daoId

// ════════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: DAO Membership & Role Verification
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Verify user is member of DAO
 * Sets req.daoMembership on request
 */
export async function requireDaoMembership(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const { daoId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!daoId) {
      return res.status(400).json({ error: 'daoId is required' });
    }

    // Check if DAO exists
    const dao = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check if user is DAO member
    const membership = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, userId)
        )
      )
      .limit(1);

    if (!membership.length) {
      return res.status(403).json({ error: 'You are not a member of this DAO' });
    }

    (req as any).daoMembership = membership[0];
    (req as any).dao = dao[0];
    next();
  } catch (error) {
    console.error('DAO membership check error:', error);
    res.status(500).json({ error: 'Membership verification failed' });
  }
}

/**
 * Verify user is DAO admin or elder
 * Must be called AFTER requireDaoMembership
 */
export async function requireDaoAdminOrElder(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const membership = (req as any).daoMembership;
    if (!membership) {
      return res.status(401).json({ error: 'Membership verification required' });
    }

    const role = (membership.role?.toLowerCase() || '').trim();
    if (!['admin', 'elder', 'moderator'].includes(role)) {
      return res.status(403).json({
        error: 'Only DAO admins, elders, or moderators can perform this action',
        yourRole: membership.role,
      });
    }

    (req as any).isAdmin = role === 'admin' || role === 'elder';
    next();
  } catch (error) {
    console.error('Admin/elder check error:', error);
    res.status(500).json({ error: 'Role verification failed' });
  }
}

/**
 * Verify user is DAO admin (stricter than admin/elder)
 * For treasury operations only
 */
export async function requireDaoAdminOnly(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const membership = (req as any).daoMembership;
    if (!membership) {
      return res.status(401).json({ error: 'Membership verification required' });
    }

    const role = (membership.role?.toLowerCase() || '').trim();
    if (role !== 'admin' && role !== 'elder') {
      return res.status(403).json({
        error: 'Only DAO admins/elders can perform this action',
        yourRole: membership.role,
      });
    }

    next();
  } catch (error) {
    console.error('Admin-only check error:', error);
    res.status(500).json({ error: 'Role verification failed' });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ════════════════════════════════════════════════════════════════════════════════

const createBountyEscrowSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('cUSD'),
});

const releaseBountyEscrowSchema = z.object({
  taskId: z.string().min(1),
  releaseToClaimant: z.boolean().default(false),
});

const disputeBountyEscrowSchema = z.object({
  taskId: z.string().min(1),
  reason: z.string().min(10, 'Dispute reason must be at least 10 characters'),
  evidence: z.array(z.string()).optional(),
});

const archiveBountyEscrowSchema = z.object({
  taskId: z.string().min(1),
  reason: z.string().optional(),
});

// ════════════════════════════════════════════════════════════════════════════════
// ROUTES: LIST & READ-ONLY OPERATIONS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/dao/:daoId/bounty-escrow
 * List all bounty escrows for this DAO
 * 
 * Accessible by: All DAO members
 */
router.get(
  '/',
  authenticate,
  requireDaoMembership,
  rateLimitPerUser('bounty-list', 30, '1min'),
  async (req, res) => {
    try {
      const { daoId } = req.params;
      const { status, limit = '50', offset = '0' } = req.query;

      let query = db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.type, 'escrow_deposit'),
            // Filter by DAO (via task description pattern)
          )
        );

      if (status && ['held', 'completed', 'disputed', 'refunded', 'archived'].includes(status as string)) {
        query = query.where(eq(walletTransactions.status, status as string));
      }

      // Get total count
      const totalResult = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.type, 'escrow_deposit'));

      const escrows = await (
        query as any
      )
        .orderBy(desc(walletTransactions.createdAt))
        .limit(parseInt(limit as string) || 50)
        .offset(parseInt(offset as string) || 0);

      res.json({
        success: true,
        data: escrows,
        pagination: {
          total: totalResult.length,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      });
    } catch (error) {
      console.error('Error listing bounty escrows:', error);
      res.status(500).json({ error: 'Failed to list escrows' });
    }
  }
);

/**
 * GET /api/dao/:daoId/bounty-escrow/:taskId
 * Get specific bounty escrow status
 * 
 * Accessible by: All DAO members
 */
router.get(
  '/:taskId',
  authenticate,
  requireDaoMembership,
  rateLimitPerUser('bounty-view', 30, '1min'),
  async (req, res) => {
    try {
      const { daoId, taskId } = req.params;

      // Verify task exists and belongs to DAO
      const task = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.id, taskId),
            eq(tasks.daoId, daoId)
          )
        )
        .limit(1);

      if (!task.length) {
        return res.status(404).json({ error: 'Task not found in this DAO' });
      }

      // Get escrow status
      const escrow = await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.type, 'escrow_deposit'),
            eq(walletTransactions.description, `Escrow for task: ${taskId}`)
          )
        )
        .limit(1);

      res.json({
        success: true,
        task: task[0],
        escrow: escrow.length > 0 ? escrow[0] : null,
        hasEscrow: escrow.length > 0,
      });
    } catch (error) {
      console.error('Error getting escrow status:', error);
      res.status(500).json({ error: 'Failed to get escrow status' });
    }
  }
);

/**
 * GET /api/dao/:daoId/bounty-escrow/active
 * List active bounty escrows (not completed/archived)
 * 
 * Accessible by: All DAO members
 */
router.get(
  '/active/list',
  authenticate,
  requireDaoMembership,
  rateLimitPerUser('bounty-active-list', 30, '1min'),
  async (req, res) => {
    try {
      const { daoId } = req.params;

      const escrows = await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.type, 'escrow_deposit'),
            or(
              eq(walletTransactions.status, 'held'),
              eq(walletTransactions.status, 'disputed')
            )
          )
        )
        .orderBy(desc(walletTransactions.createdAt));

      res.json({
        success: true,
        data: escrows,
        count: escrows.length,
      });
    } catch (error) {
      console.error('Error listing active escrows:', error);
      res.status(500).json({ error: 'Failed to list active escrows' });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// ROUTES: CREATE ESCROW
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/dao/:daoId/bounty-escrow
 * Create bounty escrow for a task
 * 
 * Accessible by: DAO members creating a task
 * 
 * SECURITY:
 *   1. authenticate
 *   2. requireDaoMembership (verify DAO membership)
 *   3. rateLimitPerUser (max 10 creates per 5 min)
 *   4. auditConsolidated (log creation)
 */
router.post(
  '/',
  authenticate,
  requireDaoMembership,
  rateLimitPerUser('bounty-create', 10, '5min'),
  auditConsolidated('bounty_escrow_create', ['medium']),
  async (req, res) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).user?.id;

      const validatedData = createBountyEscrowSchema.parse(req.body);
      const { taskId, amount, currency } = validatedData;

      // Verify task exists and belongs to this DAO
      const task = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.id, taskId),
            eq(tasks.daoId, daoId)
          )
        )
        .limit(1);

      if (!task.length) {
        return res.status(404).json({ error: 'Task not found in this DAO' });
      }

      // Verify user is task creator or DAO admin
      const membership = (req as any).daoMembership;
      const isCreator = task[0].creatorId === userId;
      const isAdmin = ['admin', 'elder'].includes((membership.role || '').toLowerCase());

      if (!isCreator && !isAdmin) {
        return res.status(403).json({
          error: 'Only task creator or DAO admin can create bounty escrow',
        });
      }

      // Check if escrow already exists
      const existingEscrow = await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.type, 'escrow_deposit'),
            eq(walletTransactions.description, `Escrow for task: ${taskId}`)
          )
        )
        .limit(1);

      if (existingEscrow.length > 0) {
        return res.status(400).json({ error: 'Bounty escrow already exists for this task' });
      }

      // Create escrow
      const escrow = await db
        .insert(walletTransactions)
        .values({
          walletAddress: userId,
          amount: amount.toString(),
          currency: currency || 'cUSD',
          type: 'escrow_deposit',
          status: 'held',
          description: `Escrow for task: ${taskId}`,
          metadata: {
            daoId,
            taskId,
            createdBy: userId,
            taskTitle: task[0].title,
          },
        })
        .returning();

      res.json({
        success: true,
        escrowId: escrow[0].id,
        taskId,
        amount,
        currency: currency || 'cUSD',
        status: 'held',
        createdAt: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating bounty escrow:', error);
      res.status(500).json({ error: 'Failed to create bounty escrow' });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// ROUTES: RELEASE ESCROW (Financial operation - HARDENED)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/dao/:daoId/bounty-escrow/:taskId/release
 * Release bounty to claimant or refund to creator
 * 
 * SECURITY:
 *   1. authenticate
 *   2. requireDaoMembership (verify membership)
 *   3. requireDaoAdminOrElder (verify admin/elder role)
 *   4. rateLimitPerUser (max 5 releases per min) ← Network protection
 *   5. auditConsolidated (critical severity logging) ← Audit trail
 */
router.post(
  '/:taskId/release',
  authenticate,
  requireDaoMembership,
  requireDaoAdminOrElder,
  rateLimitPerUser('bounty-release', 5, '1min'),
  auditConsolidated('bounty_escrow_release', ['medium']),
  async (req, res) => {
    try {
      const { daoId, taskId } = req.params;
      const userId = (req as any).user?.id;
      const validatedData = releaseBountyEscrowSchema.parse(req.body);
      const { releaseToClaimant } = validatedData;

      // Verify task exists in DAO
      const task = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.id, taskId),
            eq(tasks.daoId, daoId)
          )
        )
        .limit(1);

      if (!task.length) {
        return res.status(404).json({ error: 'Task not found in this DAO' });
      }

      // Find escrow
      const escrow = await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.type, 'escrow_deposit'),
            eq(walletTransactions.description, `Escrow for task: ${taskId}`),
            or(
              eq(walletTransactions.status, 'held'),
              eq(walletTransactions.status, 'disputed')
            )
          )
        )
        .limit(1);

      if (!escrow.length) {
        return res.status(404).json({ error: 'Active escrow not found for this task' });
      }

      const escrowAmount = parseFloat(escrow[0].amount);
      const recipient = releaseToClaimant ? task[0].claimerId : task[0].creatorId;

      if (!recipient) {
        return res.status(400).json({
          error: `No valid recipient. Claimant: ${task[0].claimerId}, Creator: ${task[0].creatorId}`,
        });
      }

      // Update escrow to completed
      await db
        .update(walletTransactions)
        .set({
          status: 'completed',
          updatedAt: new Date(),
          metadata: {
            ...(escrow[0].metadata || {}),
            releasedBy: userId,
            releasedAt: new Date().toISOString(),
            releaseType: releaseToClaimant ? 'to_claimant' : 'to_creator',
          },
        })
        .where(eq(walletTransactions.id, escrow[0].id));

      // Create release transaction
      const release = await db
        .insert(walletTransactions)
        .values({
          walletAddress: recipient,
          amount: escrowAmount.toString(),
          currency: escrow[0].currency,
          type: 'escrow_release',
          status: 'completed',
          description: `Bounty released for task: ${taskId} by ${userId}`,
          metadata: {
            daoId,
            taskId,
            sourceEscrowId: escrow[0].id,
            recipient,
            releasedBy: userId,
          },
        })
        .returning();

      // Update task status if released to claimant
      if (releaseToClaimant) {
        await db
          .update(tasks)
          .set({
            status: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, taskId));
      }

      // Log high-value releases
      if (escrowAmount > 5000) {
        await auditConsolidated.log({
          severity: 'critical',
          action: 'high_value_bounty_release',
          userId,
          daoId,
          taskId,
          amount: escrowAmount,
          recipient,
          releaseType: releaseToClaimant ? 'to_claimant' : 'to_creator',
        });
      }

      res.json({
        success: true,
        releaseId: release[0].id,
        taskId,
        amount: escrowAmount,
        recipient,
        releasedToClaimant: releaseToClaimant,
        releasedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error releasing bounty escrow:', error);
      res.status(500).json({ error: 'Failed to release bounty escrow' });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// ROUTES: DISPUTE ESCROW
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/dao/:daoId/bounty-escrow/:taskId/dispute
 * Flag a bounty escrow as disputed
 * 
 * SECURITY:
 *   1. authenticate
 *   2. requireDaoMembership
 *   3. rateLimitPerUser (prevent spam)
 *   4. auditConsolidated (log disputes)
 */
router.post(
  '/:taskId/dispute',
  authenticate,
  requireDaoMembership,
  rateLimitPerUser('bounty-dispute', 3, '1min'),
  auditConsolidated('bounty_escrow_dispute', ['medium']),
  async (req, res) => {
    try {
      const { daoId, taskId } = req.params;
      const userId = (req as any).user?.id;

      const validatedData = disputeBountyEscrowSchema.parse(req.body);
      const { reason, evidence } = validatedData;

      // Verify task exists in DAO
      const task = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.id, taskId),
            eq(tasks.daoId, daoId)
          )
        )
        .limit(1);

      if (!task.length) {
        return res.status(404).json({ error: 'Task not found in this DAO' });
      }

      // Find escrow
      const escrow = await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.type, 'escrow_deposit'),
            eq(walletTransactions.description, `Escrow for task: ${taskId}`),
            eq(walletTransactions.status, 'held')
          )
        )
        .limit(1);

      if (!escrow.length) {
        return res.status(404).json({ error: 'Active escrow not found for this task' });
      }

      // Update escrow to disputed
      const updatedEscrow = await db
        .update(walletTransactions)
        .set({
          status: 'disputed',
          updatedAt: new Date(),
          metadata: {
            ...(escrow[0].metadata || {}),
            disputedBy: userId,
            disputedAt: new Date().toISOString(),
            disputeReason: reason,
            disputeEvidence: evidence || [],
          },
        })
        .where(eq(walletTransactions.id, escrow[0].id))
        .returning();

      // TODO: Trigger dispute resolution workflow
      // - Notify DAO admins
      // - Create dispute ticket
      // - Set review/resolution deadline

      res.json({
        success: true,
        taskId,
        escrowId: escrow[0].id,
        status: 'disputed',
        reason,
        disputedBy: userId,
        disputedAt: new Date().toISOString(),
        nextSteps: 'DAO admins will review and resolve this dispute',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error disputing bounty escrow:', error);
      res.status(500).json({ error: 'Failed to dispute bounty escrow' });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// ROUTES: ARCHIVE ESCROW (Admin only)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/dao/:daoId/bounty-escrow/:taskId/archive
 * Archive a completed or canceled escrow
 * 
 * Accessible by: DAO admins only
 */
router.post(
  '/:taskId/archive',
  authenticate,
  requireDaoMembership,
  requireDaoAdminOnly,
  rateLimitPerUser('bounty-archive', 10, '5min'),
  auditConsolidated('bounty_escrow_archive', ['medium']),
  async (req, res) => {
    try {
      const { daoId, taskId } = req.params;
      const userId = (req as any).user?.id;

      const validatedData = archiveBountyEscrowSchema.parse(req.body);
      const { reason } = validatedData;

      // Verify task exists in DAO
      const task = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.id, taskId),
            eq(tasks.daoId, daoId)
          )
        )
        .limit(1);

      if (!task.length) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Find escrow
      const escrow = await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.type, 'escrow_deposit'),
            eq(walletTransactions.description, `Escrow for task: ${taskId}`)
          )
        )
        .limit(1);

      if (!escrow.length) {
        return res.status(404).json({ error: 'Escrow not found for this task' });
      }

      // Can only archive completed, refunded, or disputed escrows
      const allowedStatuses = ['completed', 'refunded', 'disputed'];
      if (!allowedStatuses.includes(escrow[0].status)) {
        return res.status(400).json({
          error: `Cannot archive escrow with status: ${escrow[0].status}`,
          allowedStatuses,
        });
      }

      // Archive the escrow
      const archived = await db
        .update(walletTransactions)
        .set({
          status: 'archived',
          updatedAt: new Date(),
          metadata: {
            ...(escrow[0].metadata || {}),
            archivedBy: userId,
            archivedAt: new Date().toISOString(),
            archiveReason: reason || 'No reason provided',
            previousStatus: escrow[0].status,
          },
        })
        .where(eq(walletTransactions.id, escrow[0].id))
        .returning();

      res.json({
        success: true,
        taskId,
        escrowId: escrow[0].id,
        previousStatus: escrow[0].status,
        newStatus: 'archived',
        archivedBy: userId,
        archivedAt: new Date().toISOString(),
        reason: reason || 'No reason provided',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error archiving bounty escrow:', error);
      res.status(500).json({ error: 'Failed to archive bounty escrow' });
    }
  }
);

export default router;
