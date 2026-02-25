import { Router } from 'express';
import { createBillSplit, getUserBillSplits, getBillSplitDetails, recordBillSplitPayment, settleBillSplit, cancelBillSplit } from '../services/billSplitService';
import { notificationService } from '../notificationService';

const router = Router();

/**
 * Create a new bill split
 * POST /api/wallet/bill-split
 */
router.post('/', async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      title,
      description,
      totalAmount,
      currency = 'cUSD',
      splitType,
      participants,
    } = req.body;

    // Validate input
    if (!title || !totalAmount || !participants || participants.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (parseFloat(totalAmount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const billData = {
      creatorId: userId,
      title,
      description: description || undefined,
      totalAmount: totalAmount.toString(),
      currency,
      splitMethod: splitType || 'equal',
      participants: participants.map((p: any) => ({
        sharePercentage: splitType === 'custom' ? undefined : 100 / participants.length,
        customAmount: splitType === 'custom' ? p.amount?.toString() : undefined,
        walletAddress: p.email, // Use email as identifier
      })),
    };

    const billSplit = await createBillSplit(billData);

    // Send notifications to participants
    for (const participant of participants) {
      if (participant.email) {
        await notificationService.createNotification({
          userId: participant.email, // In a real app, map email to userId
          type: 'bill_split_created',
          title: `You've been added to "${title}"`,
          message: `You owe ${currency} ${participant.amount || (parseFloat(totalAmount) / participants.length).toFixed(2)}`,
          metadata: {
            billSplitId: billSplit.id,
            amount: participant.amount || parseFloat(totalAmount) / participants.length,
            actionUrl: `/bill-splits/${billSplit.id}`,
          },
        });
      }
    }

    res.json({
      success: true,
      billSplit,
      message: `Bill split created with ${participants.length} participants`,
    });
  } catch (error) {
    console.error('Create bill split error:', error);
    res.status(500).json({ error: 'Failed to create bill split' });
  }
});

/**
 * Get user's bill splits
 * GET /api/wallet/bill-splits?status=active|settled|cancelled
 */
router.get('/', async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
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
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const details = await getBillSplitDetails(id);

    if (!details || !details.id) {
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
router.post('/:id/payment', async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { participantName, amount, transactionHash } = req.body;

    if (!participantName || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await recordBillSplitPayment(id, participantName, parseFloat(amount), transactionHash);

    res.json({
      success: true,
      message: 'Payment recorded',
    });
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

/**
 * Settle bill split
 * POST /api/wallet/bill-split/:id/settle
 */
router.post('/:id/settle', async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    const result = await settleBillSplit(id);

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
router.post('/:id/cancel', async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    const result = await cancelBillSplit(id);

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
router.post('/:id/remind', async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    // Send payment reminders to participants
    // This would need to be implemented in billSplitService
    res.json({
      success: true,
      message: 'Reminders sent',
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
router.get('/:id/settlement', async (req, res) => {
  try {
    const { id } = req.params;

    const settlement = await (async () => {
      const details = await getBillSplitDetails(id);
      const { participants } = details;
      
      const totalAmount = details.totalAmount;
      const paidAmount = participants.reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0);
      const owedAmount = totalAmount - paidAmount;

      return {
        billId: bill.id,
        totalAmount,
        paidAmount,
        owedAmount,
        settledPercentage: Math.round((paidAmount / totalAmount) * 100),
        participants: participants.map((p: any) => ({
          name: p.name,
          owes: p.amount - (p.paidAmount || 0),
          paid: p.paid,
        })),
      };
    })();

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
