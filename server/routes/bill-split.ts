import { Router, type Request } from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { createBillSplit, getUserBillSplits, getBillSplitDetails, getBillSplitSettlement, recordBillSplitPayment, settleBillSplit, cancelBillSplit } from '../services/billSplitService';
import { notificationService } from '../notificationService';

const router = Router();
router.use(isAuthenticated);

const userKey = (req: Request) => req.user?.id ?? req.user?.claims?.sub ?? req.ip ?? 'unknown-user';
const readLimiter = rateLimiter({
  windowMs: 60_000,
  max: 60,
  keyGenerator: (req) => `bill-split:read:${userKey(req)}`,
});
const writeLimiter = rateLimiter({
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req) => `bill-split:write:${userKey(req)}`,
});

const participantSchema = z.object({
  userId: z.string().min(1).optional(),
  daoId: z.string().uuid().optional(),
  walletAddress: z.string().min(1).optional(),
  sharePercentage: z.number().min(0).max(100).refine(
    (percentage) => Math.abs(percentage * 100 - Math.round(percentage * 100)) < 1e-8,
    'Percentage supports at most two decimal places'
  ).optional(),
  customAmount: z.string().regex(/^\d+(?:\.\d{1,8})?$/).optional(),
}).refine((participant) => [participant.userId, participant.daoId, participant.walletAddress].filter(Boolean).length === 1, {
  message: 'Specify exactly one participant userId, daoId, or walletAddress',
});

const createBillSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(5000).optional(),
  totalAmount: z.string().regex(/^\d+(?:\.\d{1,8})?$/).refine((amount) => amountToAtomicUnits(amount) > 0n),
  currency: z.string().trim().min(1).max(10).default('cUSD'),
  splitMethod: z.enum(['equal', 'custom', 'percentage']).optional(),
  splitType: z.enum(['equal', 'custom', 'percentage']).optional(),
  participants: z.array(participantSchema).min(1).max(100),
}).transform(({ splitType, splitMethod, ...input }) => ({
  ...input,
  splitMethod: splitMethod ?? splitType ?? 'equal',
})).superRefine((input, context) => {
  if (input.splitMethod === 'custom') {
    if (input.participants.some((participant) => participant.customAmount === undefined)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['participants'], message: 'Every participant needs a custom amount' });
      return;
    }
    const assigned = input.participants.reduce((sum, participant) => sum + amountToAtomicUnits(participant.customAmount!), 0n);
    if (assigned !== amountToAtomicUnits(input.totalAmount)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['participants'], message: 'Custom participant amounts must equal the total amount' });
    }
  }
  if (input.splitMethod === 'percentage') {
    if (input.participants.some((participant) => participant.sharePercentage === undefined)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['participants'], message: 'Every participant needs a share percentage' });
      return;
    }
    const assigned = input.participants.reduce((sum, participant) => sum + BigInt(Math.round((participant.sharePercentage ?? 0) * 100)), 0n);
    if (assigned !== 10_000n) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['participants'], message: 'Participant percentages must total 100' });
    }
  }
});

function authenticatedUserId(req: Request): string | undefined {
  return req.user?.id ?? req.user?.claims?.sub;
}

async function getAuthorizedBillSplit(id: string, userId: string) {
  let details;
  try {
    details = await getBillSplitDetails(id);
  } catch (error) {
    if (error instanceof Error && error.message === 'Bill split not found') return null;
    throw error;
  }
  if (details.creatorId !== userId && !details.participants.some((participant) => participant.userId === userId)) {
    return null;
  }
  return details;
}

/**
 * Create a new bill split
 * POST /api/wallet/bill-split
 */
router.post('/', writeLimiter, async (req, res) => {
  try {
    const userId = authenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const input = createBillSchema.parse(req.body);

    const billData = {
      creatorId: userId,
      ...input,
    };

    const billSplit = await createBillSplit(billData);

    res.status(201).json({
      success: true,
      billSplit,
      message: `Bill split created with ${input.participants.length} participants`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid bill split', details: error.errors });
    console.error('Create bill split error:', error);
    res.status(500).json({ error: 'Failed to create bill split' });
  }
});

/**
 * Get user's bill splits
 * GET /api/wallet/bill-splits?status=active|settled|cancelled
 */
router.get('/', readLimiter, async (req, res) => {
  try {
    const userId = authenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { status } = req.query;

    const billSplits = await getUserBillSplits(userId, status as string | undefined);

    res.json({
      success: true,
      billSplits,
      total: billSplits.length,
    });
  } catch (error) {
    console.error('Get bill splits error:', error);
    res.status(500).json({ error: 'Failed to fetch bill splits' });
  }
});

/**
 * Get single bill split with details
 * GET /api/wallet/bill-split/:id
 */
router.get('/:id', readLimiter, async (req, res) => {
  try {
    const userId = authenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { id } = req.params;

    const details = await getAuthorizedBillSplit(id, userId);

    if (!details) {
      return res.status(404).json({ error: 'Bill split not found' });
    }

    res.json({
      success: true,
      ...details,
    });
  } catch (error) {
    console.error('Get bill split error:', error);
    res.status(500).json({ error: 'Failed to fetch bill split' });
  }
});

/**
 * Record a payment for bill split
 * POST /api/wallet/bill-split/:id/payment
 */
router.post('/:id/payment', writeLimiter, async (req, res) => {
  try {
    const userId = authenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const paymentInput = z.object({
      amount: z.string().regex(/^\d+(?:\.\d{1,8})?$/).refine((value) => amountToAtomicUnits(value) > 0n),
      transactionHash: z.string().trim().min(1).max(255),
    }).parse(req.body);
    const { id } = req.params;
    let details;
    try {
      details = await getBillSplitDetails(id);
    } catch (error) {
      if (error instanceof Error && error.message === 'Bill split not found') return res.status(404).json({ error: 'Bill split not found' });
      throw error;
    }
    const participant = details.participants.find((item) => item.userId === userId);
    if (!participant) return res.status(403).json({ error: 'Only a bill split participant can record their payment' });

    await recordBillSplitPayment(id, userId, paymentInput.amount, paymentInput.transactionHash);

    res.json({
      success: true,
      message: 'Payment submission recorded and awaiting on-chain verification',
      status: 'pending',
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid payment', details: error.errors });
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

/**
 * Settle bill split
 * POST /api/wallet/bill-split/:id/settle
 */
router.post('/:id/settle', writeLimiter, async (req, res) => {
  try {
    const userId = authenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const details = await getBillSplitDetails(id);
    if (details.creatorId !== userId) return res.status(403).json({ error: 'Only the bill split creator can settle it' });
    await settleBillSplit(id);

    res.json({
      success: true,
      message: 'Bill split settled',
    });
  } catch (error) {
    console.error('Settle bill error:', error);
    res.status(500).json({ error: 'Failed to settle bill' });
  }
});

/**
 * Cancel bill split
 * POST /api/wallet/bill-split/:id/cancel
 */
router.post('/:id/cancel', writeLimiter, async (req, res) => {
  try {
    const userId = authenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const details = await getBillSplitDetails(id);
    if (details.creatorId !== userId) return res.status(403).json({ error: 'Only the bill split creator can cancel it' });
    await cancelBillSplit(id);

    res.json({
      success: true,
      message: 'Bill split cancelled',
    });
  } catch (error) {
    console.error('Cancel bill error:', error);
    res.status(500).json({ error: 'Failed to cancel bill' });
  }
});

/**
 * Send payment reminders
 * POST /api/wallet/bill-split/:id/remind
 */
router.post('/:id/remind', writeLimiter, async (req, res) => {
  try {
    const userId = authenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const details = await getBillSplitDetails(id);
    if (details.creatorId !== userId) return res.status(403).json({ error: 'Only the bill split creator can send reminders' });
    const outstanding = details.participants.filter((participant) =>
      participant.userId && amountToAtomicUnits(participant.amountPaid ?? '0') < amountToAtomicUnits(participant.amountOwed)
    );
    for (const participant of outstanding) {
      const remaining = atomicUnitsToAmount(
        amountToAtomicUnits(participant.amountOwed) - amountToAtomicUnits(participant.amountPaid ?? '0')
      );
      await notificationService.createNotification({
        userId: participant.userId!,
        type: 'bill_split_reminder',
        title: `Payment reminder: ${details.title}`,
        message: `You have an outstanding balance of ${remaining} ${details.currency}`,
        metadata: { billSplitId: id, participantId: participant.id, outstandingAmount: remaining },
      });
    }
    res.json({
      success: true,
      message: 'Reminders sent to registered participants with outstanding balances',
      remindersSent: outstanding.length,
    });
  } catch (error) {
    console.error('Send reminders error:', error);
    res.status(500).json({ error: 'Failed to send reminders' });
  }
});

/**
 * Get bill settlement info
 * GET /api/wallet/bill-split/:id/settlement
 */
router.get('/:id/settlement', readLimiter, async (req, res) => {
  try {
    const userId = authenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { id } = req.params;
    const details = await getAuthorizedBillSplit(id, userId);
    if (!details) return res.status(404).json({ error: 'Bill split not found' });
    const settlement = await getBillSplitSettlement(id);

    res.json({
      success: true,
      settlement,
    });
  } catch (error) {
    console.error('Get settlement error:', error);
    res.status(500).json({ error: 'Failed to fetch settlement info' });
  }
});

export default router;

function amountToAtomicUnits(amount: string): bigint {
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole) * 100_000_000n + BigInt(fraction.padEnd(8, '0'));
}

function atomicUnitsToAmount(units: bigint): string {
  const whole = units / 100_000_000n;
  const fraction = (units % 100_000_000n).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
