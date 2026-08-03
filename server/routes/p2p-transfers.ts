
import express from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { db } from '../storage';
import { p2pTransfers } from '../../shared/p2pTransferSchema';
import { users } from '../../shared/schema';
import { accounts, accountTransactions } from '../../shared/accountSchema';
import { transactionLimitService } from '../services/transactionLimitService';
import { exchangeRateService } from '../services/exchangeRateService';
import { eq, or, and, desc } from 'drizzle-orm';
import crypto from 'crypto';

const router = express.Router();

type AuthRequest = Request & { user?: { id?: string; username?: string; role?: string } };

import { isAuthenticated } from '../nextAuthMiddleware';
import { requirePINVerification, checkAmountThreshold } from '../middleware/pin-verification';

// Validation schemas
const transferSchema = z.object({
  receiverId: z.string().uuid(),
  amountUSD: z.number().min(0.01).max(100000),
  currency: z.string().default('cUSD'),
  reference: z.string().optional(),
  idempotencyKey: z.string().uuid('Idempotency key must be a valid UUID'), // Required for idempotency
});

/**
 * POST /api/p2p-transfers/send
 * Initiate a P2P transfer with KYC limit checking and balance debit/credit
 * Auth: Requires upstream isAuthenticated middleware (req.user.id must be set)
 */
router.post('/send', isAuthenticated, requirePINVerification, checkAmountThreshold(process.env.PIN_REQUIRED_THRESHOLD || 1000), async (req: AuthRequest, res: express.Response) => {
  try {
    // Auth is enforced by upstream middleware wrapper at mount point
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const senderId = req.user.id;
    const senderUsername = req.user.username || senderId;
    const validated = transferSchema.parse(req.body);

    // Idempotency check: if this request was already processed, return cached result
    const [existingTransfer] = await db
      .select()
      .from(p2pTransfers)
      .where(eq(p2pTransfers.idempotencyKey, validated.idempotencyKey))
      .limit(1);

    if (existingTransfer) {
      // Return cached response
      const [receiver] = await db
        .select()
        .from(users)
        .where(eq(users.id, existingTransfer.receiverId))
        .limit(1);

      return res.json({
        success: true,
        data: {
          transferId: existingTransfer.transferId,
          amount: parseFloat(existingTransfer.amountUSD),
          amountKES: parseFloat(existingTransfer.amountKES),
          receiver: {
            id: receiver?.id,
            username: receiver?.username,
          },
          status: existingTransfer.status,
          isDuplicate: true,
        },
      });
    }

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

    // Get sender and receiver KYC tiers
    const { kycService } = await import('../services/kycService');
    const senderTier = await kycService.getCurrentTier(senderId);
    const receiverTier = await kycService.getCurrentTier(validated.receiverId);

    // Get sender and receiver wallet accounts
    const [senderAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, senderId), eq(accounts.accountType, 'wallet')))
      .limit(1);

    const [receiverAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, validated.receiverId), eq(accounts.accountType, 'wallet')))
      .limit(1);

    if (!senderAccount) {
      return res.status(400).json({
        success: false,
        error: 'Sender wallet account not found',
        code: 'WALLET_NOT_FOUND',
      });
    }

    if (!receiverAccount) {
      return res.status(400).json({
        success: false,
        error: 'Receiver wallet account not found',
        code: 'WALLET_NOT_FOUND',
      });
    }

    // Verify sender has sufficient balance
    const senderBalance = parseFloat(senderAccount.balance);
    if (senderBalance < validated.amountUSD) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance',
        code: 'INSUFFICIENT_BALANCE',
        data: {
          senderBalance,
          requestedAmount: validated.amountUSD,
        },
      });
    }

    // Generate transfer ID and calculate exchange rate
    const transferId = `P2P-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const exchangeRate = await exchangeRateService.getUSDtoKESRate();
    const amountKES = validated.amountUSD * exchangeRate;

    // Execute atomic transaction: debit sender, credit receiver, record transfer
    const [transfer] = await db.transaction(async (tx) => {
      // 1. Debit sender's wallet
      const newSenderBalance = (senderBalance - validated.amountUSD).toFixed(8);
      await tx
        .update(accounts)
        .set({
          balance: newSenderBalance,
          totalWithdrawn: (parseFloat(senderAccount.totalWithdrawn) + validated.amountUSD).toString(),
          totalTransactions: senderAccount.totalTransactions + 1,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, senderAccount.id));

      // 2. Credit receiver's wallet
      const newReceiverBalance = (parseFloat(receiverAccount.balance) + validated.amountUSD).toFixed(8);
      await tx
        .update(accounts)
        .set({
          balance: newReceiverBalance,
          totalDeposited: (parseFloat(receiverAccount.totalDeposited) + validated.amountUSD).toString(),
          totalTransactions: receiverAccount.totalTransactions + 1,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, receiverAccount.id));

      // 3. Record debit transaction for sender
      await tx.insert(accountTransactions).values({
        accountId: senderAccount.id,
        transactionType: 'transfer',
        amount: validated.amountUSD.toString(),
        currency: 'USDC',
        description: `P2P transfer to ${receiver.username}`,
        reference: transferId,
        fromAccountId: senderAccount.id,
        toAccountId: receiverAccount.id,
        toUserId: validated.receiverId,
        status: 'completed',
        balanceBefore: senderAccount.balance,
        balanceAfter: newSenderBalance,
        metadata: JSON.stringify({ p2pTransferId: transferId }),
      });

      // 4. Record credit transaction for receiver
      await tx.insert(accountTransactions).values({
        accountId: receiverAccount.id,
        transactionType: 'transfer',
        amount: validated.amountUSD.toString(),
        currency: 'USDC',
        description: `P2P transfer from ${senderUsername}`,
        reference: transferId,
        fromAccountId: senderAccount.id,
        toAccountId: receiverAccount.id,
        fromUserId: senderId,
        status: 'completed',
        balanceBefore: receiverAccount.balance,
        balanceAfter: newReceiverBalance,
        metadata: JSON.stringify({ p2pTransferId: transferId }),
      });

      // 5. Record p2p transfer
      const result = await tx
        .insert(p2pTransfers)
        .values({
          transferId,
          senderId,
          receiverId: validated.receiverId,
          amountUSD: validated.amountUSD.toString(),
          amountKES: amountKES.toString(),
          currency: validated.currency,
          status: 'completed',
          senderKycTier: senderTier.tier,
          receiverKycTier: receiverTier.tier,
          senderDailyLimit: senderTier.dailyLimit.toString(),
          senderMonthlyLimit: senderTier.monthlyLimit.toString(),
          senderDailyUsed: (limitCheck.dailyUsed || 0).toString(),
          senderMonthlyUsed: (limitCheck.monthlyUsed || 0).toString(),
          reference: validated.reference,
          idempotencyKey: validated.idempotencyKey,
          completedAt: new Date(),
        })
        .returning();

      return result;
    });

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
 * Auth: Requires upstream isAuthenticated middleware
 */
router.get('/history', async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const { limit = '50', offset = '0' } = req.query;

    // Cap pagination limit at 100 to prevent resource exhaustion
    const parsedLimit = Math.min(parseInt(limit as string) || 50, 100);
    const parsedOffset = Math.max(parseInt(offset as string) || 0, 0);

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
      .limit(parsedLimit)
      .offset(parsedOffset);

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
 * Auth: Requires upstream isAuthenticated middleware
 */
router.get('/:transferId', async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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
