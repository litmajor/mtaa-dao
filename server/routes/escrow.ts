
import express from 'express';
import { db } from '../storage';
import { escrowAccounts, escrowMilestones, escrowDisputes } from '../../shared/escrowSchema';
import { eq, or } from 'drizzle-orm';
import { escrowService } from '../services/escrowService';
import { authenticate } from '../auth';

const router = express.Router();

// Create escrow
router.post('/create', authenticate, async (req, res) => {
  try {
    const { taskId, payeeId, amount, currency, milestones } = req.body;
    const payerId = req.user!.id;

    const escrow = await escrowService.createEscrow({
      taskId,
      payerId,
      payeeId,
      amount,
      currency: currency || 'cUSD',
      milestones
    });

    res.json({ success: true, escrow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fund escrow
router.post('/:escrowId/fund', authenticate, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { transactionHash } = req.body;
    const payerId = req.user!.id;

    const escrow = await escrowService.fundEscrow(escrowId, payerId, transactionHash);

    res.json({ success: true, escrow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve milestone
router.post('/:escrowId/milestones/:milestoneNumber/approve', authenticate, async (req, res) => {
  try {
    const { escrowId, milestoneNumber } = req.params;
    const { proofUrl } = req.body;
    const approverId = req.user!.id;

    const milestone = await escrowService.approveMilestone(escrowId, milestoneNumber, approverId, proofUrl);

    res.json({ success: true, milestone });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Release milestone
router.post('/:escrowId/milestones/:milestoneNumber/release', authenticate, async (req, res) => {
  try {
    const { escrowId, milestoneNumber } = req.params;
    const { transactionHash } = req.body;

    const milestone = await escrowService.releaseMilestone(escrowId, milestoneNumber, transactionHash);

    res.json({ success: true, milestone });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Release full escrow
router.post('/:escrowId/release', authenticate, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { transactionHash } = req.body;

    const escrow = await escrowService.releaseFullEscrow(escrowId, transactionHash);

    res.json({ success: true, escrow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Raise dispute
router.post('/:escrowId/dispute', authenticate, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { reason, evidence } = req.body;
    const userId = req.user!.id;

    const dispute = await escrowService.raiseDispute(escrowId, userId, reason, evidence || []);

    res.json({ success: true, dispute });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Refund escrow
router.post('/:escrowId/refund', authenticate, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { transactionHash } = req.body;

    const escrow = await escrowService.refundEscrow(escrowId, transactionHash);

    res.json({ success: true, escrow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user's escrows
router.get('/my-escrows', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;

    const escrows = await db.select()
      .from(escrowAccounts)
      .where(or(
        eq(escrowAccounts.payerId, userId),
        eq(escrowAccounts.payeeId, userId)
      ));

    res.json({ success: true, escrows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get escrow details
router.get('/:escrowId', authenticate, async (req, res) => {
  try {
    const { escrowId } = req.params;

    const escrow = await db.select()
      .from(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId))
      .limit(1);

    if (!escrow.length) {
      return res.status(404).json({ success: false, error: 'Escrow not found' });
    }

    const milestones = await db.select()
      .from(escrowMilestones)
      .where(eq(escrowMilestones.escrowId, escrowId));

    const disputes = await db.select()
      .from(escrowDisputes)
      .where(eq(escrowDisputes.escrowId, escrowId));

    res.json({ success: true, escrow: escrow[0], milestones, disputes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
