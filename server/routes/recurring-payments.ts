
import { Router } from 'express';
import { db } from '../db';
import { authenticate } from '../auth';
import { notificationService } from '../notificationService';
import { eq, and, desc } from 'drizzle-orm';
import { walletTransactions } from '../../shared/schema';

const router = Router();

// Create recurring payment
router.post('/', authenticate, async (req, res) => {
  try {
    const { recipient, amount, token, frequency, startDate, description } = req.body;
    const userId = req.user!.id;

    // Validate input
    if (!recipient || !amount || !token || !frequency || !startDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
      return res.status(400).json({ error: 'Invalid frequency' });
    }

    // Calculate next payment date based on frequency
    const nextPayment = new Date(startDate);
    
    const payment = {
      id: crypto.randomUUID(),
      userId,
      recipient,
      amount,
      token,
      frequency,
      nextPayment: nextPayment.toISOString(),
      description: description || '',
      status: 'active',
      totalExecuted: 0,
      lastExecuted: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Insert into database using walletTransactions table
    // Store as type 'recurring' with metadata for tracking
    const insertedPayment = await db.insert(walletTransactions).values({
      fromUserId: userId,
      walletAddress: userId, // Use userId as identifier for now
      amount: parseFloat(amount),
      currency: token,
      type: 'recurring',
      status: 'active',
      description: description || `Recurring ${frequency} payment to ${recipient}`,
      metadata: {
        recipient,
        frequency,
        nextPayment,
        totalExecuted: 0,
        lastExecuted: null
      }
    }).returning();
    
    const paymentData = insertedPayment[0] ? {
      id: insertedPayment[0].id,
      userId,
      recipient,
      amount,
      token,
      frequency,
      nextPayment: nextPayment.toISOString(),
      description: description || '',
      status: 'active',
      totalExecuted: 0,
      lastExecuted: null,
      createdAt: insertedPayment[0].createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: insertedPayment[0].updatedAt?.toISOString() || new Date().toISOString(),
    } : payment;
    
    // Send notification
    await notificationService.sendNotification(userId, {
      type: 'recurring_payment_created',
      title: 'Recurring Payment Created',
      message: `Your recurring ${frequency} payment of ${amount} ${token} has been set up`,
      metadata: { paymentId: paymentData.id }
    });

    res.json({ success: true, payment: paymentData });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List recurring payments for user
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { status } = req.query;

    // Query from database with optional status filter
    let query = db.select().from(walletTransactions)
      .where(and(eq(walletTransactions.fromUserId, userId), eq(walletTransactions.type, 'recurring')));
    
    if (status && ['active', 'paused', 'completed'].includes(status)) {
      query = db.select().from(walletTransactions)
        .where(and(
          eq(walletTransactions.fromUserId, userId),
          eq(walletTransactions.type, 'recurring'),
          eq(walletTransactions.status, status)
        ));
    }
    
    const transactions = await query;
    const payments = transactions.map(tx => ({
      id: tx.id,
      userId,
      recipient: tx.description?.split(' to ')?.[1] || 'Unknown',
      amount: tx.amount?.toString() || '0',
      token: tx.currency,
      frequency: (tx.metadata as any)?.frequency || 'monthly',
      nextPayment: (tx.metadata as any)?.nextPayment || tx.createdAt?.toISOString(),
      description: (tx.metadata as any)?.description || tx.description || '',
      status: tx.status || 'active',
      totalExecuted: (tx.metadata as any)?.totalExecuted || 0,
      lastExecuted: (tx.metadata as any)?.lastExecuted || null,
      createdAt: tx.createdAt?.toISOString(),
      updatedAt: tx.updatedAt?.toISOString()
    }));

    res.json({ success: true, payments });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific recurring payment
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Query from database and verify ownership
    const transaction = await db.select().from(walletTransactions)
      .where(and(
        eq(walletTransactions.id, id),
        eq(walletTransactions.fromUserId, userId),
        eq(walletTransactions.type, 'recurring')
      ));
    
    if (!transaction.length) {
      return res.status(404).json({ error: 'Recurring payment not found' });
    }
    
    const tx = transaction[0];
    const payment = {
      id: tx.id,
      userId,
      recipient: tx.description?.split(' to ')?.[1] || 'Unknown',
      amount: tx.amount?.toString() || '0',
      token: tx.currency,
      frequency: (tx.metadata as any)?.frequency || 'monthly',
      nextPayment: (tx.metadata as any)?.nextPayment || tx.createdAt?.toISOString(),
      description: (tx.metadata as any)?.description || tx.description || '',
      status: tx.status || 'active',
      totalExecuted: (tx.metadata as any)?.totalExecuted || 0,
      lastExecuted: (tx.metadata as any)?.lastExecuted || null,
      createdAt: tx.createdAt?.toISOString(),
      updatedAt: tx.updatedAt?.toISOString()
    };
    
    res.json({ success: true, payment });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update recurring payment (pause/resume/edit)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { status, amount, frequency } = req.body;

    // Update in database and verify ownership
    const existing = await db.select().from(walletTransactions)
      .where(and(
        eq(walletTransactions.id, id),
        eq(walletTransactions.fromUserId, userId),
        eq(walletTransactions.type, 'recurring')
      ));
    
    if (!existing.length) {
      return res.status(404).json({ error: 'Recurring payment not found' });
    }
    
    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (amount) updateData.amount = parseFloat(amount);
    
    const metadata = existing[0].metadata as any || {};
    if (frequency) metadata.frequency = frequency;
    updateData.metadata = metadata;
    
    await db.update(walletTransactions).set(updateData).where(eq(walletTransactions.id, id));
    
    const action = status === 'paused' ? 'paused' : status === 'active' ? 'resumed' : 'updated';
    
    res.json({ success: true, message: `Recurring payment ${action}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete recurring payment
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Delete from database and verify ownership
    const existing = await db.select().from(walletTransactions)
      .where(and(
        eq(walletTransactions.id, id),
        eq(walletTransactions.fromUserId, userId),
        eq(walletTransactions.type, 'recurring')
      ));
    
    if (!existing.length) {
      return res.status(404).json({ error: 'Recurring payment not found' });
    }
    
    await db.delete(walletTransactions).where(eq(walletTransactions.id, id));
    
    await notificationService.sendNotification(userId, {
      type: 'recurring_payment_deleted',
      title: 'Recurring Payment Cancelled',
      message: 'Your recurring payment has been cancelled',
      metadata: { paymentId: id }
    });

    res.json({ success: true, message: 'Recurring payment deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment history for a recurring payment
router.get('/:id/history', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { limit = 10, offset = 0 } = req.query;

    // Query payment execution history from database
    const existing = await db.select().from(walletTransactions)
      .where(and(
        eq(walletTransactions.id, id),
        eq(walletTransactions.fromUserId, userId),
        eq(walletTransactions.type, 'recurring')
      ));
    
    if (!existing.length) {
      return res.status(404).json({ error: 'Recurring payment not found' });
    }
    
    // For now, we query completed transactions of the same type to show history
    // In a full implementation, there would be a separate recurringPaymentHistory table
    const history = await db.select().from(walletTransactions)
      .where(and(
        eq(walletTransactions.fromUserId, userId),
        eq(walletTransactions.type, 'recurring')
      ))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(Math.min(parseInt(limit as string) || 10, 100))
      .offset(parseInt(offset as string) || 0);
    
    res.json({ success: true, history, total: history.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get recurring payment statistics
router.get('/:id/stats', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Calculate stats from database
    const payment = await db.select().from(walletTransactions)
      .where(and(
        eq(walletTransactions.id, id),
        eq(walletTransactions.fromUserId, userId),
        eq(walletTransactions.type, 'recurring')
      ));
    
    if (!payment.length) {
      return res.status(404).json({ error: 'Recurring payment not found' });
    }
    
    const tx = payment[0];
    const metadata = (tx.metadata as any) || {};
    
    res.json({ 
      success: true, 
      stats: {
        totalExecuted: metadata.totalExecuted || 0,
        totalAmount: (parseFloat(tx.amount?.toString() || '0') * (metadata.totalExecuted || 0)).toFixed(2),
        nextPayment: metadata.nextPayment || tx.createdAt?.toISOString(),
        successCount: metadata.totalExecuted || 0,
        failureCount: metadata.failedAttempts || 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all active recurring payments (for dashboard)
router.get('/dashboard/active', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 50);

    // Query active recurring payments from database (limited for dashboard)
    const payments = await db.select().from(walletTransactions)
      .where(and(
        eq(walletTransactions.fromUserId, userId),
        eq(walletTransactions.type, 'recurring'),
        eq(walletTransactions.status, 'active')
      ))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit);
    
    const mappedPayments = payments.map(tx => ({
      id: tx.id,
      userId,
      recipient: tx.description?.split(' to ')?.[1] || 'Unknown',
      amount: tx.amount?.toString() || '0',
      token: tx.currency,
      frequency: (tx.metadata as any)?.frequency || 'monthly',
      nextPayment: (tx.metadata as any)?.nextPayment || tx.createdAt?.toISOString(),
      description: (tx.metadata as any)?.description || tx.description || '',
      status: tx.status || 'active',
      totalExecuted: (tx.metadata as any)?.totalExecuted || 0
    }));
    
    res.json({ success: true, payments: mappedPayments });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
