import express from 'express';
import { db } from '../storage';
import { escrowAccounts, escrowMilestones, escrowDisputes } from '../../shared/escrowSchema';
import { users } from '../../shared/schema';
import { eq, or, sql } from 'drizzle-orm';
import { escrowService } from '../services/escrowService';
import { authenticate } from '../auth';
import { nanoid } from 'nanoid';
import {
  notifyEscrowCreated,
  notifyEscrowAccepted,
  notifyMilestonePending,
  notifyMilestoneApproved,
  notifyEscrowDisputed,
  logNotification
} from '../services/escrow-notifications';

const router = express.Router();

// Helper: Verify user is party to escrow
async function verifyEscrowParty(escrowId: string, userId: string) {
  const escrow = await db.select()
    .from(escrowAccounts)
    .where(eq(escrowAccounts.id, escrowId))
    .limit(1);

  if (!escrow.length) {
    throw new Error('Escrow not found');
  }

  if (escrow[0].payerId !== userId && escrow[0].payeeId !== userId) {
    throw new Error('Unauthorized: You are not a party to this escrow');
  }

  return escrow[0];
}

// Initiate escrow with invite link (wallet-based, peer-to-peer)
router.post('/initiate', authenticate, async (req, res) => {
  try {
    const { recipient, amount, currency, description, milestones } = req.body;
    const payerId = req.user!.id;

    // Validation
    if (!recipient || !amount || !currency) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const numAmount = parseFloat(amount);
    if (numAmount < 1) {
      return res.status(400).json({ error: 'Amount must be at least $1' });
    }

    // Find recipient by email or username
    let payeeId: string | null = null;
    const recipientUser = await db.select().from(users)
      .where(or(
        eq(users.email, recipient.toLowerCase()),
        eq(users.username, recipient.replace('@', '').toLowerCase())
      ))
      .limit(1);

    if (recipientUser.length > 0) {
      payeeId = recipientUser[0].id;
    }

    // Create escrow (payeeId can be null if user doesn't exist yet)
    const escrow = await escrowService.createEscrow({
      payerId,
      payeeId: payeeId || 'pending',
      amount: numAmount.toString(),
      currency: currency || 'cUSD',
      milestones: milestones || []
    });

    // Generate invite code for shareable link
    const inviteCode = nanoid(12);

    // Store invite code in metadata
    await db.update(escrowAccounts)
      .set({
        metadata: {
          inviteCode,
          recipientEmail: recipient.toLowerCase(),
          description,
          createdFromWallet: true
        }
      })
      .where(eq(escrowAccounts.id, escrow.id));

    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const inviteLink = `${baseUrl}/escrow/accept/${inviteCode}?referrer=${payerId}`;

    // Send notification to recipient
    const payer = await db.select().from(users)
      .where(eq(users.id, payerId))
      .limit(1);

    if (payer.length > 0) {
      try {
        await notifyEscrowCreated(
          payer[0],
          recipient.toLowerCase(),
          { ...escrow, inviteCode, milestones: milestones || [] }
        );
        await logNotification(payerId, 'escrow_created', 'email', recipient.toLowerCase(), escrow.id);
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError);
      }
    }

    res.json({ success: true, escrow: { ...escrow, inviteCode }, inviteLink });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get escrow by invite code (public - no auth required)
router.get('/invite/:inviteCode', async (req, res) => {
  try {
    const { inviteCode } = req.params;

    // Query using JSON metadata field
    const escrow = await db.select()
      .from(escrowAccounts)
      .where(sql`${escrowAccounts.metadata}->>'inviteCode' = ${inviteCode}`)
      .limit(1);

    if (!escrow.length) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    const escrowData = escrow[0];
    const payer = await db.select().from(users)
      .where(eq(users.id, escrowData.payerId))
      .limit(1);

    const milestones = await db.select()
      .from(escrowMilestones)
      .where(eq(escrowMilestones.escrowId, escrowData.id));

    res.json({ ...escrowData, payer: payer[0] || null, milestones });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Accept escrow invite (creates/links payee)
router.post('/accept/:inviteCode', authenticate, async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const { referrer } = req.query;
    const userId = req.user!.id;

    const escrow = await db.select()
      .from(escrowAccounts)
      .where(sql`${escrowAccounts.metadata}->>'inviteCode' = ${inviteCode}`)
      .limit(1);

    if (!escrow.length) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    // Prevent accepting your own escrow
    if (escrow[0].payerId === userId) {
      return res.status(400).json({ error: 'Cannot accept your own escrow' });
    }

    // Update escrow with actual payee ID
    const [updated] = await db.update(escrowAccounts)
      .set({
        payeeId: userId,
        status: 'accepted',
        updatedAt: new Date()
      })
      .where(eq(escrowAccounts.id, escrow[0].id))
      .returning();

    // Register referral if referrer ID provided
    if (referrer && typeof referrer === 'string') {
      try {
        const { registerEscrowReferral, trackEscrowReferral } = await import('../services/referral-integration');
        await registerEscrowReferral(referrer, userId, escrow[0].id);
        await trackEscrowReferral(referrer, userId, escrow[0].id);
        console.log(`✅ Referral tracked: ${referrer} -> ${userId} from escrow ${escrow[0].id}`);
      } catch (referralError) {
        console.error('Error processing referral:', referralError);
      }
    }

    // Send notifications to both payer and payee
    try {
      const [payer, payee] = await Promise.all([
        db.select().from(users).where(eq(users.id, escrow[0].payerId)).limit(1),
        db.select().from(users).where(eq(users.id, userId)).limit(1)
      ]);

      if (payer.length > 0 && payee.length > 0) {
        await notifyEscrowAccepted(payer[0], payee[0], updated);
        await Promise.all([
          payer[0].email ? logNotification(escrow[0].payerId, 'escrow_accepted', 'email', payer[0].email, escrow[0].id) : Promise.resolve(),
          payee[0].email ? logNotification(userId, 'escrow_accepted', 'email', payee[0].email, escrow[0].id) : Promise.resolve()
        ]);
      }
    } catch (notifyError) {
      console.error('Failed to send acceptance notification:', notifyError);
    }

    res.json({ success: true, escrow: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create escrow (original - kept for backward compatibility)
router.post('/create', authenticate, async (req, res) => {
  try {
    const { taskId, payeeId, amount, currency, milestones } = req.body;
    const payerId = req.user!.id;

    // Validation
    if (!payeeId || !amount || !currency) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const numAmount = parseFloat(amount);
    if (numAmount < 1) {
      return res.status(400).json({ error: 'Amount must be at least $1' });
    }

    // Create escrow
    const escrow = await escrowService.createEscrow({
      payerId,
      payeeId,
      taskId,
      amount: numAmount.toString(),
      currency: currency || 'cUSD',
      milestones: milestones || []
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

    const escrow = await verifyEscrowParty(escrowId, payerId);

    if (escrow.payerId !== payerId) {
      return res.status(403).json({ error: 'Only the payer can fund this escrow' });
    }

    const updatedEscrow = await escrowService.fundEscrow(escrowId, payerId, transactionHash);
    res.json({ success: true, escrow: updatedEscrow });
  } catch (error: any) {
    res.status(error.message.includes('Unauthorized') ? 403 : 500)
      .json({ success: false, error: error.message });
  }
});

// Approve milestone (payee marks as complete)
router.post('/:escrowId/milestones/:milestoneNumber/approve', authenticate, async (req, res) => {
  try {
    const { escrowId, milestoneNumber } = req.params;
    const { proofUrl } = req.body;
    const approverId = req.user!.id;

    const escrow = await verifyEscrowParty(escrowId, approverId);

    if (escrow.payeeId !== approverId) {
      return res.status(403).json({ error: 'Only the payee can submit milestone completion' });
    }

    const milestone = await escrowService.approveMilestone(escrowId, milestoneNumber, approverId, proofUrl);

    // Send notification to payer that milestone is pending review
    try {
      const [payer, payee] = await Promise.all([
        db.select().from(users).where(eq(users.id, escrow.payerId)).limit(1),
        db.select().from(users).where(eq(users.id, escrow.payeeId)).limit(1)
      ]);

      if (payer.length > 0 && payee.length > 0) {
        await notifyMilestonePending(payer[0], payee[0], escrow, milestone);
        if (payer[0].email) await logNotification(escrow.payerId, 'milestone_pending', 'email', payer[0].email, escrowId);
      }
    } catch (notifyError) {
      console.error('Failed to send milestone notification:', notifyError);
    }

    res.json({ success: true, milestone });
  } catch (error: any) {
    res.status(error.message.includes('Unauthorized') ? 403 : 500)
      .json({ success: false, error: error.message });
  }
});

// Release milestone (payer approves and releases payment)
router.post('/:escrowId/milestones/:milestoneNumber/release', authenticate, async (req, res) => {
  try {
    const { escrowId, milestoneNumber } = req.params;
    const { transactionHash } = req.body;
    const userId = req.user!.id;

    const escrow = await verifyEscrowParty(escrowId, userId);

    if (escrow.payerId !== userId) {
      return res.status(403).json({ error: 'Only the payer can release milestone payments' });
    }

    const milestone = await escrowService.releaseMilestone(escrowId, milestoneNumber, transactionHash);

    // Send notification to payee that payment was approved and released
    try {
      const [payer, payee] = await Promise.all([
        db.select().from(users).where(eq(users.id, escrow.payerId)).limit(1),
        db.select().from(users).where(eq(users.id, escrow.payeeId)).limit(1)
      ]);

      if (payer.length > 0 && payee.length > 0) {
        await notifyMilestoneApproved(payer[0], payee[0], escrow, milestone);
        if (payee[0].email) await logNotification(escrow.payeeId, 'milestone_approved', 'email', payee[0].email, escrowId);
      }
    } catch (notifyError) {
      console.error('Failed to send milestone approval notification:', notifyError);
    }

    res.json({ success: true, milestone });
  } catch (error: any) {
    res.status(error.message.includes('Unauthorized') ? 403 : 500)
      .json({ success: false, error: error.message });
  }
});

// Release full escrow
router.post('/:escrowId/release', authenticate, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { transactionHash } = req.body;
    const userId = req.user!.id;

    const escrow = await verifyEscrowParty(escrowId, userId);

    if (escrow.payerId !== userId) {
      return res.status(403).json({ error: 'Only the payer can release the escrow' });
    }

    const updatedEscrow = await escrowService.releaseFullEscrow(escrowId, transactionHash);
    res.json({ success: true, escrow: updatedEscrow });
  } catch (error: any) {
    res.status(error.message.includes('Unauthorized') ? 403 : 500)
      .json({ success: false, error: error.message });
  }
});

// Raise dispute
router.post('/:escrowId/dispute', authenticate, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { reason, evidence } = req.body;
    const userId = req.user!.id;

    const escrow = await verifyEscrowParty(escrowId, userId);

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Dispute reason must be at least 10 characters' });
    }

    const dispute = await escrowService.raiseDispute(escrowId, userId, reason, evidence || []);

    // Send notifications to both parties
    try {
      const [payer, payee] = await Promise.all([
        db.select().from(users).where(eq(users.id, escrow.payerId)).limit(1),
        db.select().from(users).where(eq(users.id, escrow.payeeId)).limit(1)
      ]);

      if (payer.length > 0 && payee.length > 0) {
        await notifyEscrowDisputed(payer[0], payee[0], escrow, reason);
        await Promise.all([
          payer[0].email ? logNotification(escrow.payerId, 'escrow_disputed', 'email', payer[0].email, escrowId) : Promise.resolve(),
          payee[0].email ? logNotification(escrow.payeeId, 'escrow_disputed', 'email', payee[0].email, escrowId) : Promise.resolve()
        ]);
      }
    } catch (notifyError) {
      console.error('Failed to send dispute notification:', notifyError);
    }

    res.json({ success: true, dispute });
  } catch (error: any) {
    res.status(error.message.includes('Unauthorized') ? 403 : 500)
      .json({ success: false, error: error.message });
  }
});

// Refund escrow
router.post('/:escrowId/refund', authenticate, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { transactionHash } = req.body;
    const userId = req.user!.id;

    const escrow = await verifyEscrowParty(escrowId, userId);

    if (escrow.payerId !== userId) {
      return res.status(403).json({ error: 'Only the payer can request a refund' });
    }

    const updatedEscrow = await escrowService.refundEscrow(escrowId, transactionHash);
    res.json({ success: true, escrow: updatedEscrow });
  } catch (error: any) {
    res.status(error.message.includes('Unauthorized') ? 403 : 500)
      .json({ success: false, error: error.message });
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
    const userId = req.user!.id;

    const escrow = await verifyEscrowParty(escrowId, userId);

    const milestones = await db.select()
      .from(escrowMilestones)
      .where(eq(escrowMilestones.escrowId, escrowId));

    const disputes = await db.select()
      .from(escrowDisputes)
      .where(eq(escrowDisputes.escrowId, escrowId));

    res.json({ success: true, escrow, milestones, disputes });
  } catch (error: any) {
    res.status(error.message.includes('Unauthorized') ? 403 : 404)
      .json({ success: false, error: error.message });
  }
});

export default router;