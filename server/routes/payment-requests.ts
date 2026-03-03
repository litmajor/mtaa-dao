import { Router } from 'express';
import { db } from '../db';
import { authenticate } from '../auth';
import { paymentRequests, users, walletTransactions } from '../../shared/schema';
import { eq, and, lte, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { notificationService } from '../notificationService';

const router = Router();

// ════════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION MIDDLEWARE
// ════════════════════════════════════════════════════════════════════════════════

// All payment request operations require authentication
router.use(authenticate);

/**
 * Create a payment request
 * POST /api/payment-requests
 */
router.post('/', async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      toUserId,
      toAddress,
      amount,
      currency = 'cUSD',
      description,
      expiresInDays = 7,
    } = req.body;

    // Validate input
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    if (!toUserId && !toAddress) {
      return res.status(400).json({ error: 'Either toUserId or toAddress is required' });
    }

    // Create payment request
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const requestId = uuidv4();
    const paymentRequest = {
      id: requestId,
      fromUserId: userId,
      toUserId: toUserId || null,
      toAddress: toAddress || null,
      amount: amount.toString(),
      currency,
      description: description || null,
      status: 'pending',
      expiresAt,
      metadata: {
        createdAt: new Date().toISOString(),
        expiresInDays,
      },
    };

    await db.insert(paymentRequests).values(paymentRequest as any);

    // Send notification to recipient if toUserId provided
    if (toUserId) {
      const fromUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      await notificationService.sendNotification(toUserId, {
        userId: toUserId,
        type: 'payment_request',
        title: `Payment Request from ${fromUser?.username || 'Someone'}`,
        message: `${fromUser?.username || 'Someone'} is requesting ${currency} ${amount}${description ? ': ' + description : ''}`,
        metadata: {
          paymentRequestId: requestId,
          fromUserId: userId,
          amount,
          currency,
        },
      });
    }

    res.json({
      success: true,
      paymentRequest,
      expiresAt,
      shareLink: `/pay-request/${requestId}`,
    });
  } catch (error) {
    console.error('Create payment request error:', error);
    res.status(500).json({ error: 'Failed to create payment request' });
  }
});

/**
 * Get payment requests (sent or received)
 * GET /api/payment-requests?type=sent|received
 */
router.get('/', async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { type = 'received' } = req.query;

    let whereClause;
    if (type === 'sent') {
      whereClause = eq(paymentRequests.fromUserId, userId);
    } else {
      whereClause = and(
        eq(paymentRequests.toUserId, userId),
        lte(paymentRequests.expiresAt, new Date()) // Exclude expired
      );
    }

    const requests = await db.query.paymentRequests.findMany({
      where: whereClause,
      orderBy: desc(paymentRequests.createdAt),
      limit: 50,
    });

    res.json({ success: true, requests });
  } catch (error) {
    console.error('Get payment requests error:', error);
    res.status(500).json({ error: 'Failed to fetch payment requests' });
  }
});

/**
 * Get single payment request
 * GET /api/payment-requests/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const request = await db.query.paymentRequests.findFirst({
      where: eq(paymentRequests.id, id),
    });

    if (!request) {
      return res.status(404).json({ error: 'Payment request not found' });
    }

    // Check if expired
    const isExpired = request.expiresAt && new Date() > new Date(request.expiresAt);

    res.json({
      success: true,
      request,
      isExpired,
      status: isExpired ? 'expired' : request.status,
    });
  } catch (error) {
    console.error('Get payment request error:', error);
    res.status(500).json({ error: 'Failed to fetch payment request' });
  }
});

/**
 * Mark payment request as paid
 * POST /api/payment-requests/:id/mark-paid
 */
router.post('/:id/mark-paid', async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { transactionHash, metadata } = req.body;

    const request = await db.query.paymentRequests.findFirst({
      where: eq(paymentRequests.id, id),
    });

    if (!request) {
      return res.status(404).json({ error: 'Payment request not found' });
    }

    // Update request status
    await db.update(paymentRequests)
      .set({
        status: 'paid',
        paidAt: new Date(),
        transactionHash: transactionHash || null,
        updatedAt: new Date(),
      })
      .where(eq(paymentRequests.id, id));

    // Send notification to requester
    const fromUser = await db.query.users.findFirst({
      where: eq(users.id, request.fromUserId),
    });

    const paidByUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (fromUser && fromUser.id) {
      await notificationService.sendNotification(fromUser.id, {
        userId: fromUser.id,
        type: 'payment_received',
        title: 'Payment Received',
        message: `${paidByUser?.username || 'Someone'} paid ${request.currency} ${request.amount}${request.description ? ': ' + request.description : ''}`,
        metadata: {
          paymentRequestId: id,
          fromUserId: userId,
          amount: request.amount,
          currency: request.currency,
          transactionHash,
        },
      });
    }

    res.json({ success: true, message: 'Payment marked as paid' });
  } catch (error) {
    console.error('Mark paid error:', error);
    res.status(500).json({ error: 'Failed to mark payment as paid' });
  }
});

/**
 * Cancel payment request
 * POST /api/payment-requests/:id/cancel
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    const request = await db.query.paymentRequests.findFirst({
      where: eq(paymentRequests.id, id),
    });

    if (!request) {
      return res.status(404).json({ error: 'Payment request not found' });
    }

    // Only requester can cancel
    if (request.fromUserId !== userId) {
      return res.status(403).json({ error: 'Only the requester can cancel' });
    }

    // Can't cancel if already paid
    if (request.status === 'paid') {
      return res.status(400).json({ error: 'Cannot cancel a paid request' });
    }

    // Update status
    await db.update(paymentRequests)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(paymentRequests.id, id));

    res.json({ success: true, message: 'Payment request cancelled' });
  } catch (error) {
    console.error('Cancel payment request error:', error);
    res.status(500).json({ error: 'Failed to cancel payment request' });
  }
});

/**
 * Get payment request stats
 * GET /api/payment-requests/stats/summary
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Sent requests
    const sentRequests = await db.query.paymentRequests.findMany({
      where: eq(paymentRequests.fromUserId, userId),
    });

    const sentStats = {
      total: sentRequests.length,
      paid: sentRequests.filter((r) => r.status === 'paid').length,
      pending: sentRequests.filter((r) => r.status === 'pending').length,
      expired: sentRequests.filter((r) => r.status === 'expired').length,
      totalAmount: sentRequests.reduce((sum, r) => sum + parseFloat(r.amount), 0),
    };

    // Received requests
    const receivedRequests = await db.query.paymentRequests.findMany({
      where: eq(paymentRequests.toUserId, userId),
    });

    const receivedStats = {
      total: receivedRequests.length,
      paid: receivedRequests.filter((r) => r.status === 'paid').length,
      pending: receivedRequests.filter((r) => r.status === 'pending').length,
      expired: receivedRequests.filter((r) => r.status === 'expired').length,
      totalAmount: receivedRequests.reduce((sum, r) => sum + parseFloat(r.amount), 0),
    };

    res.json({
      success: true,
      sent: sentStats,
      received: receivedStats,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
