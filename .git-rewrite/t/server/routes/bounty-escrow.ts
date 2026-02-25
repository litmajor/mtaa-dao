
import express from 'express';
import { db } from '../storage';
import { tasks, walletTransactions, daoMemberships, taskHistory } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const router = express.Router();

// Escrow schemas
const createEscrowSchema = z.object({
  taskId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default('cUSD')
});

const releaseEscrowSchema = z.object({
  taskId: z.string().min(1),
  releaseToClaimant: z.boolean()
});

// Create escrow for task
router.post('/create', async (req, res) => {
  try {
    const validatedData = createEscrowSchema.parse(req.body);
    const { taskId, amount, currency } = validatedData;
  const userId = req.user?.claims?.sub ?? '';

    // Verify task exists and user is creator
    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task.length) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task[0].creatorId !== userId) {
      return res.status(403).json({ error: 'Only task creator can fund escrow' });
    }

    // Check if escrow already exists
    const existingEscrow = await db
      .select()
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.type, 'escrow_deposit'),
        eq(walletTransactions.description, `Escrow for task: ${taskId}`)
      ))
      .limit(1);

    if (existingEscrow.length > 0) {
      return res.status(400).json({ error: 'Escrow already exists for this task' });
    }

    // Create escrow transaction
    const escrow = await db.insert(walletTransactions).values({
      walletAddress: userId,
      amount: amount.toString(),
      currency,
      type: 'escrow_deposit',
      status: 'held',
      description: `Escrow for task: ${taskId}`
    }).returning();

    res.json({
      success: true,
      escrowId: escrow[0].id,
      amount,
      currency,
      status: 'held'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Release escrow (task creator or DAO admin)
router.post('/release', async (req, res) => {
  try {
    const validatedData = releaseEscrowSchema.parse(req.body);
    const { taskId, releaseToClaimant } = validatedData;
  const userId = req.user?.claims?.sub ?? '';

    // Get task and verify permissions
    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task.length) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user can release escrow (creator or DAO admin)
    const canRelease = task[0].creatorId === userId;
    if (!canRelease) {
      const membership = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, task[0].daoId),
          eq(daoMemberships.userId, userId)
        ))
        .limit(1);
      
  if (!membership.length || !['admin', 'moderator'].includes(membership[0].role ?? '')) {
        return res.status(403).json({ error: 'Insufficient permissions to release escrow' });
      }
    }

    // Find escrow transaction
    const escrow = await db
      .select()
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.type, 'escrow_deposit'),
        eq(walletTransactions.description, `Escrow for task: ${taskId}`),
        eq(walletTransactions.status, 'held')
      ))
      .limit(1);

    if (!escrow.length) {
      return res.status(404).json({ error: 'Active escrow not found for this task' });
    }

    const escrowAmount = parseFloat(escrow[0].amount);
    const recipient = releaseToClaimant ? task[0].claimerId : task[0].creatorId;

    if (!recipient) {
      return res.status(400).json({ error: 'No valid recipient for escrow release' });
    }

    // Update escrow status
    await db
      .update(walletTransactions)
      .set({ 
        status: 'completed',
        updatedAt: new Date()
      })
      .where(eq(walletTransactions.id, escrow[0].id));

    // Create release transaction
    const release = await db.insert(walletTransactions).values({
      walletAddress: recipient,
      amount: escrowAmount.toString(),
      currency: escrow[0].currency,
      type: 'escrow_release',
      status: 'completed',
      description: `Escrow release for task: ${taskId}`
    }).returning();

    // Update task status if released to claimant
    if (releaseToClaimant) {
      await db
        .update(tasks)
        .set({ 
          status: 'completed',
          updatedAt: new Date()
        })
        .where(eq(tasks.id, taskId));
    }

    res.json({
      success: true,
      releaseId: release[0].id,
      amount: escrowAmount,
      recipient,
      releasedToClaimant: releaseToClaimant
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get escrow status
router.get('/:taskId/escrow', async (req, res) => {
  try {
    const { taskId } = req.params;

    const escrow = await db
      .select()
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.type, 'escrow_deposit'),
        eq(walletTransactions.description, `Escrow for task: ${taskId}`)
      ))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(1);

    if (!escrow.length) {
      return res.json({ hasEscrow: false });
    }

    res.json({
      hasEscrow: true,
      amount: parseFloat(escrow[0].amount),
      currency: escrow[0].currency,
      status: escrow[0].status,
      createdAt: escrow[0].createdAt
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Dispute escrow (if task verification fails)
router.post('/:taskId/dispute', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { reason } = req.body;
  const userId = req.user?.claims?.sub ?? '';

    // Get task
    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task.length) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Only claimant or creator can dispute
    if (task[0].claimerId !== userId && task[0].creatorId !== userId) {
      return res.status(403).json({ error: 'Only task claimant or creator can dispute' });
    }

    // Update task to disputed status
    await db
      .update(tasks)
      .set({ 
        status: 'disputed',
        updatedAt: new Date()
      })
      .where(eq(tasks.id, taskId));

    // Log dispute
    await db.insert(taskHistory).values({
      taskId,
      userId,
      action: 'disputed',
      details: { reason, disputedAt: new Date().toISOString() }
    });

    res.json({
      success: true,
      message: 'Dispute created. Escrow will be held pending resolution.',
      taskId
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
