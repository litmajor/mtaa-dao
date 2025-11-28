
import express from 'express';
import { z } from 'zod';
import { db } from '../storage';
import { p2pTransfers } from '../../shared/p2pTransferSchema';
import { users } from '../../shared/schema';
import { transactionLimitService } from '../services/transactionLimitService';
import { eq, or, and, desc } from 'drizzle-orm';
import crypto from 'crypto';

const router = express.Router();

// Auth middleware placeholder - replace with your actual auth
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Validation schemas
const transferSchema = z.object({
  receiverId: z.string().uuid(),
  amountUSD: z.number().min(0.01).max(100000),
  currency: z.string().default('cUSD'),
  reference: z.string().optional(),
});

/**
 * POST /api/p2p-transfers/send
 * Initiate a P2P transfer with KYC limit checking
 */
router.post('/send', requireAuth, async (req, res) => {
  try {
    const senderId = req.user.id;
    const validated = transferSchema.parse(req.body);

    // Check if receiver exists
    const [receiver] = await db
      .select()
      .from(users)
      .where(eq(users.id, validated.receiverId))
      .limit(1);

    if (!receiver) {
      return res.status(404).json({
        success: false,
        error: 'Receiver not found',
      });
    }

    // Check sender KYC limits
    const limitCheck = await transactionLimitService.canTransact(
      senderId,
      validated.amountUSD,
      'p2p_send'
    );

    if (!limitCheck.allowed) {
      // Record rejected transaction
      await transactionLimitService.recordTransaction(
        senderId,
        validated.amountUSD,
        'p2p_send',
        'rejected',
        limitCheck.reason
      );

      return res.status(403).json({
        success: false,
        error: limitCheck.reason,
        code: 'KYC_LIMIT_EXCEEDED',
        data: {
          tier: limitCheck.tier,
          dailyUsed: limitCheck.dailyUsed,
          dailyLimit: limitCheck.dailyLimit,
          monthlyUsed: limitCheck.monthlyUsed,
          monthlyLimit: limitCheck.monthlyLimit,
        },
      });
    }

    // Get sender and receiver tiers
    const { kycService } = await import('../services/kycService');
    const senderTier = await kycService.getCurrentTier(senderId);
    const receiverTier = await kycService.getCurrentTier(validated.receiverId);

    // Create transfer record
    const transferId = `P2P-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const amountKES = validated.amountUSD * 129; // Exchange rate

    const [transfer] = await db
      .insert(p2pTransfers)
      .values({
        transferId,
        senderId,
        receiverId: validated.receiverId,
        amountUSD: validated.amountUSD.toString(),
        amountKES: amountKES.toString(),
        currency: validated.currency,
        status: 'completed', // In production, this might be 'pending' initially
        senderKycTier: senderTier.tier,
        receiverKycTier: receiverTier.tier,
        senderDailyLimit: senderTier.dailyLimit.toString(),
        senderMonthlyLimit: senderTier.monthlyLimit.toString(),
        senderDailyUsed: (limitCheck.dailyUsed || 0).toString(),
        senderMonthlyUsed: (limitCheck.monthlyUsed || 0).toString(),
        reference: validated.reference,
        completedAt: new Date(),
      })
      .returning();

    // Record approved transaction
    await transactionLimitService.recordTransaction(
      senderId,
      validated.amountUSD,
      'p2p_send',
      'approved'
    );

    res.json({
      success: true,
      data: {
        transferId: transfer.transferId,
        amount: validated.amountUSD,
        amountKES,
        receiver: {
          id: receiver.id,
          username: receiver.username,
        },
        status: transfer.status,
        kycInfo: {
          tier: limitCheck.tier,
          dailyRemaining: (limitCheck.dailyLimit || 0) - (limitCheck.dailyUsed || 0) - validated.amountUSD,
          monthlyRemaining: (limitCheck.monthlyLimit || 0) - (limitCheck.monthlyUsed || 0) - validated.amountUSD,
        },
      },
    });
  } catch (error: any) {
    console.error('P2P transfer error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'TRANSFER_FAILED',
    });
  }
});

/**
 * GET /api/p2p-transfers/history
 * Get user's P2P transfer history (sent and received)
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = '50', offset = '0' } = req.query;

    const transfers = await db
      .select()
      .from(p2pTransfers)
      .where(
        or(
          eq(p2pTransfers.senderId, userId),
          eq(p2pTransfers.receiverId, userId)
        )
      )
      .orderBy(desc(p2pTransfers.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({
      success: true,
      data: transfers.map((t) => ({
        transferId: t.transferId,
        type: t.senderId === userId ? 'sent' : 'received',
        amount: parseFloat(t.amountUSD),
        amountKES: parseFloat(t.amountKES),
        currency: t.currency,
        status: t.status,
        reference: t.reference,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/p2p-transfers/:transferId
 * Get transfer details
 */
router.get('/:transferId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { transferId } = req.params;

    const [transfer] = await db
      .select()
      .from(p2pTransfers)
      .where(eq(p2pTransfers.transferId, transferId))
      .limit(1);

    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: 'Transfer not found',
      });
    }

    // Ensure user is involved in transfer
    if (transfer.senderId !== userId && transfer.receiverId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: {
        transferId: transfer.transferId,
        type: transfer.senderId === userId ? 'sent' : 'received',
        amount: parseFloat(transfer.amountUSD),
        amountKES: parseFloat(transfer.amountKES),
        currency: transfer.currency,
        status: transfer.status,
        reference: transfer.reference,
        createdAt: transfer.createdAt,
        completedAt: transfer.completedAt,
        senderKycTier: transfer.senderKycTier,
        receiverKycTier: transfer.receiverKycTier,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
