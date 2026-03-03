
import express from 'express';
import { db } from '../storage';
import { invoices, invoicePayments } from '../../shared/invoiceSchema';
import { walletTransactions } from '../../shared/schema';
import { eq, or, desc } from 'drizzle-orm';
import { authenticate } from '../auth';
import { notificationService } from '../notificationService';

const router = express.Router();

// ════════════════════════════════════════════════════════════════════════════════
// NEW RESTful ENDPOINT (RECOMMENDED)
// ════════════════════════════════════════════════════════════════════════════════

// POST /api/invoices - Create invoice
router.post('/', authenticate, async (req, res) => {
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

// ════════════════════════════════════════════════════════════════════════════════
// DEPRECATED ENDPOINT (Keep for 6 months, then remove)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use POST /api/invoices instead
 * Sunset: 2026-09-01
 */
// Create invoice
router.post('/create', authenticate, async (req, res) => {
  // Issue deprecation warning
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 01 Sep 2026 00:00:00 GMT');
  res.setHeader('Link', '</api/invoices>; rel="successor-version"');
  res.setHeader('Warning', '299 - "POST /api/invoices/create is deprecated. Use POST /api/invoices instead"');

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

// Get user's invoices (with comprehensive filtering)
router.get('/list/all', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { type, status, daoId, limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    let query = db.select().from(invoices);

    // Filter by user's involvement
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

    // Apply additional filters
    if (status) {
      query = query.where(eq(invoices.status, String(status)));
    }
    if (daoId) {
      query = query.where(eq(invoices.daoId, String(daoId)));
    }

    // Get total count
    const allResults = await query;
    const totalCount = allResults.length;

    // Apply sorting and pagination
    const results = await query
      .orderBy(
        invoices[sortBy as keyof typeof invoices] || invoices.createdAt,
        sortOrder === 'asc' ? 'asc' : 'desc'
      )
      .limit(Number(limit))
      .offset(Number(offset));

    res.json({
      success: true,
      data: results,
      pagination: {
        total: totalCount,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < totalCount
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user's invoices (legacy endpoint for backward compatibility)
router.get('/my', authenticate, async (req, res) => {
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

// UPDATE an invoice (before sending or payment)
router.put('/:invoiceId', authenticate, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user!.id;
    const { toUserId, amount, currency, description, lineItems, dueDate, notes, termsAndConditions } = req.body;

    const invoice = await db.select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice.length) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Only creator can update
    if (invoice[0].fromUserId !== userId) {
      return res.status(403).json({ success: false, error: 'Only the invoice creator can update it' });
    }

    // Cannot update if already sent or paid
    if (invoice[0].status && !['draft'].includes(invoice[0].status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot update invoice in ${invoice[0].status} status. Only draft invoices can be updated.`,
        currentStatus: invoice[0].status
      });
    }

    // Build update data
    const updateData: any = {};
    if (toUserId !== undefined) updateData.toUserId = toUserId;
    if (amount !== undefined) updateData.amount = amount;
    if (currency !== undefined) updateData.currency = currency;
    if (description !== undefined) updateData.description = description;
    if (lineItems !== undefined) updateData.lineItems = lineItems;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (notes !== undefined) updateData.notes = notes;
    if (termsAndConditions !== undefined) updateData.termsAndConditions = termsAndConditions;
    updateData.updatedAt = new Date();

    const [updated] = await db.update(invoices)
      .set(updateData)
      .where(eq(invoices.id, invoiceId))
      .returning();

    res.json({ success: true, invoice: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE an invoice (only draft status)
router.delete('/:invoiceId', authenticate, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user!.id;

    const invoice = await db.select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice.length) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Only creator can delete
    if (invoice[0].fromUserId !== userId) {
      return res.status(403).json({ success: false, error: 'Only the invoice creator can delete it' });
    }

    // Can only delete if draft or sent (not paid)
    if (invoice[0].status && !['draft', 'sent'].includes(invoice[0].status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete invoice in ${invoice[0].status} status. Only draft/sent invoices can be deleted.`,
        currentStatus: invoice[0].status
      });
    }

    // Delete associated payments if any
    await db.delete(invoicePayments)
      .where(eq(invoicePayments.invoiceId, invoiceId));

    // Delete the invoice
    await db.delete(invoices)
      .where(eq(invoices.id, invoiceId));

    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
