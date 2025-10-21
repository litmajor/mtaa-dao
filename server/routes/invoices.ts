
import express from 'express';
import { db } from '../storage';
import { invoices, invoicePayments } from '../../shared/invoiceSchema';
import { walletTransactions } from '../../shared/schema';
import { eq, or, desc } from 'drizzle-orm';
import { authenticate } from '../auth';
import { notificationService } from '../notificationService';

const router = express.Router();

// Create invoice
router.post('/create', authenticate, async (req, res) => {
  try {
    const { toUserId, daoId, amount, currency, description, lineItems, dueDate, notes } = req.body;
    const fromUserId = req.user!.id;

    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const [invoice] = await db.insert(invoices).values({
      invoiceNumber,
      fromUserId,
      toUserId,
      daoId,
      amount,
      currency: currency || 'cUSD',
      description,
      lineItems: lineItems || [],
      dueDate: dueDate ? new Date(dueDate) : null,
      notes,
      status: 'draft'
    }).returning();

    res.json({ success: true, invoice });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send invoice
router.post('/:invoiceId/send', authenticate, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user!.id;

    const invoice = await db.select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice.length || invoice[0].fromUserId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const [updated] = await db.update(invoices)
      .set({ status: 'sent', updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId))
      .returning();

    // Send notification
    if (invoice[0].toUserId) {
      await notificationService.createNotification({
        userId: invoice[0].toUserId,
        type: 'invoice',
        title: 'Invoice Received',
        message: `You have received an invoice for ${invoice[0].amount} ${invoice[0].currency}`,
        metadata: { invoiceId, invoiceNumber: invoice[0].invoiceNumber }
      });
    }

    res.json({ success: true, invoice: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pay invoice with wallet
router.post('/:invoiceId/pay', authenticate, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { transactionHash, paymentMethod } = req.body;
    const payerId = req.user!.id;

    const invoice = await db.select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice.length) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    if (invoice[0].status === 'paid') {
      return res.status(400).json({ success: false, error: 'Invoice already paid' });
    }

    // Record payment
    const [payment] = await db.insert(invoicePayments).values({
      invoiceId,
      payerId,
      amount: invoice[0].amount,
      currency: invoice[0].currency,
      paymentMethod: paymentMethod || 'wallet',
      transactionHash,
      status: 'completed'
    }).returning();

    // Update invoice status
    await db.update(invoices)
      .set({
        status: 'paid',
        paidAt: new Date(),
        paymentMethod: paymentMethod || 'wallet',
        transactionHash,
        updatedAt: new Date()
      })
      .where(eq(invoices.id, invoiceId));

    // Record wallet transaction
    await db.insert(walletTransactions).values({
      fromUserId: payerId,
      toUserId: invoice[0].fromUserId,
      walletAddress: 'invoice_payment',
      amount: invoice[0].amount,
      currency: invoice[0].currency,
      type: 'transfer',
      status: 'completed',
      transactionHash,
      description: `Payment for invoice ${invoice[0].invoiceNumber}`
    });

    // Notify invoice creator
    await notificationService.createNotification({
      userId: invoice[0].fromUserId,
      type: 'invoice',
      title: 'Invoice Paid',
      message: `Invoice ${invoice[0].invoiceNumber} has been paid`,
      metadata: { invoiceId, transactionHash }
    });

    res.json({ success: true, payment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user's invoices
router.get('/my-invoices', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { type } = req.query; // 'sent' or 'received'

    let query = db.select().from(invoices);

    if (type === 'sent') {
      query = query.where(eq(invoices.fromUserId, userId));
    } else if (type === 'received') {
      query = query.where(eq(invoices.toUserId, userId));
    } else {
      query = query.where(or(
        eq(invoices.fromUserId, userId),
        eq(invoices.toUserId, userId)
      ));
    }

    const userInvoices = await query.orderBy(desc(invoices.createdAt));

    res.json({ success: true, invoices: userInvoices });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get invoice details
router.get('/:invoiceId', authenticate, async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await db.select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice.length) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const payments = await db.select()
      .from(invoicePayments)
      .where(eq(invoicePayments.invoiceId, invoiceId));

    res.json({ success: true, invoice: invoice[0], payments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel invoice
router.post('/:invoiceId/cancel', authenticate, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user!.id;

    const invoice = await db.select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice.length || invoice[0].fromUserId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const [updated] = await db.update(invoices)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId))
      .returning();

    res.json({ success: true, invoice: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
