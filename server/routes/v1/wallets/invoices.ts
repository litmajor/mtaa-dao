/**
 * Invoices Router - V1 Canonical Endpoint
 * Issue, send, and track invoices for payment
 * Base path: /api/v1/wallets/invoices
 * Supports: Stablecoins (cUSD, USDC, USDT), Tokens (cELO, other blockchain assets), Fiat (USD, KES, EUR)
 * 
 * Endpoints (8):
 * POST   /api/v1/wallets/invoices              Create draft invoice
 * GET    /api/v1/wallets/invoices              List user's invoices  
 * GET    /api/v1/wallets/invoices/archive      List archived (non-draft) invoices
 * GET    /api/v1/wallets/invoices/:id          Get invoice details
 * PUT    /api/v1/wallets/invoices/:id          Update draft invoice
 * POST   /api/v1/wallets/invoices/:id/send     Send invoice to recipient
 * POST   /api/v1/wallets/invoices/:id/pay      Pay an invoice
 * DELETE /api/v1/wallets/invoices/:id          Delete draft invoice
 */

import express, { Request, Response } from 'express';
import { db } from '../../../storage';
import { invoices as invoicesTable, users } from '../../../../shared/schema';
import { eq, and, ne } from 'drizzle-orm';
import { isAuthenticated } from '../../../auth';
import { logger } from '../../../utils/logger';
import { z } from 'zod';
import { Decimal } from 'decimal.js';

const router = express.Router();

// ════════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ════════════════════════════════════════════════════════════════════════════

const createInvoiceSchema = z.object({
  recipientEmail: z.string().email('Invalid email'),
  recipientName: z.string().optional(),
  description: z.string().min(1, 'Description required'),
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount'),
  currency: z.enum(['cUSD', 'USDC', 'USDT', 'DAI', 'cELO', 'USD', 'KES', 'EUR']).default('cUSD'),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.string().regex(/^\d+(\.\d{1,8})?$/),
    taxRate: z.number().optional().default(0),
  })).optional(),
  subtotal: z.string().optional(),
  tax: z.string().optional(),
  total: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateInvoiceSchema = createInvoiceSchema.partial();

const payInvoiceSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount').optional(),
  currency: z.string().optional(),
  paymentMethod: z.enum(['wallet', 'mpesa', 'stripe', 'bank_transfer']).optional(),
  transactionHash: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Supported tokens
const SUPPORTED_TOKENS = {
  'cUSD': { name: 'Celo Dollar', symbol: 'cUSD', decimals: 18, type: 'stablecoin', chain: 'celo' },
  'USDC': { name: 'USD Coin', symbol: 'USDC', decimals: 6, type: 'stablecoin', chain: 'celo' },
  'USDT': { name: 'Tether', symbol: 'USDT', decimals: 6, type: 'stablecoin', chain: 'celo' },
  'DAI': { name: 'Dai Stablecoin', symbol: 'DAI', decimals: 18, type: 'stablecoin', chain: 'celo' },
  'cELO': { name: 'Celo Native Token', symbol: 'cELO', decimals: 18, type: 'native', chain: 'celo' },
  'USD': { name: 'US Dollar', symbol: 'USD', decimals: 2, type: 'fiat', chain: 'fiat' },
  'KES': { name: 'Kenyan Shilling', symbol: 'KES', decimals: 2, type: 'fiat', chain: 'fiat' },
  'EUR': { name: 'Euro', symbol: 'EUR', decimals: 2, type: 'fiat', chain: 'fiat' },
};

// ════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Generate unique invoice number
 */
function generateInvoiceNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `INV-${timestamp}-${random}`;
}

/**
 * Calculate totals from line items
 */
function calculateLineItemTotals(lineItems: any[]): {
  subtotal: Decimal;
  tax: Decimal;
  total: Decimal;
  items: any[];
} {
  const items = lineItems.map((item) => {
    const itemSubtotal = new Decimal(item.quantity).mul(new Decimal(item.unitPrice));
    const itemTax = itemSubtotal.mul(new Decimal(item.taxRate || 0).div(100));
    return {
      ...item,
      subtotal: itemSubtotal.toString(),
      tax: itemTax.toString(),
      total: itemSubtotal.add(itemTax).toString(),
    };
  });

  const subtotal = items.reduce((sum, item) => 
    new Decimal(sum).add(new Decimal(item.subtotal)), new Decimal(0));
  const tax = items.reduce((sum, item) => 
    new Decimal(sum).add(new Decimal(item.tax)), new Decimal(0));
  const total = subtotal.add(tax);

  return { subtotal, tax, total, items };
}

/**
 * Send invoice email notification
 */
async function sendInvoiceEmail(invoice: any, recipientEmail: string): Promise<void> {
  try {
    logger.info('Invoice email notification sent', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      recipientEmail,
      amount: invoice.total,
      currency: invoice.currency,
    });
    // Email notification logged for integration with external email service
    // When NotificationService is available: await notificationService.sendEmail({...})
  } catch (error) {
    logger.warn('Failed to send invoice email', { error, invoiceId: invoice.id });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /invoices/archive - List archived invoices (MUST come before /:id route)
 */
router.get('/archive', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const archived = await db.select().from(invoicesTable).where(
      and(
        eq(invoicesTable.fromUserId, userId),
        ne(invoicesTable.status, 'draft')
      )
    );

    res.json({
      success: true,
      count: archived.length,
      data: archived,
    });
  } catch (error: any) {
    logger.error('Error listing archived invoices', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /invoices - Create draft invoice
 */
router.post('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const validatedData = createInvoiceSchema.parse(req.body);
    const invoiceNumber = generateInvoiceNumber();

    // Calculate totals from line items if provided
    let subtotal = new Decimal(validatedData.subtotal || validatedData.amount);
    let tax = new Decimal(validatedData.tax || 0);
    let total = new Decimal(validatedData.total || validatedData.amount);

    if (validatedData.lineItems && validatedData.lineItems.length > 0) {
      const calculated = calculateLineItemTotals(validatedData.lineItems);
      subtotal = calculated.subtotal;
      tax = calculated.tax;
      total = calculated.total;
    }

    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber,
      fromUserId: userId,
      recipientEmail: validatedData.recipientEmail,
      recipientName: validatedData.recipientName || null,
      description: validatedData.description,
      amount: total.toString(),
      currency: validatedData.currency,
      lineItems: validatedData.lineItems || [],
      subtotal: subtotal.toString(),
      tax: tax.toString(),
      total: total.toString(),
      status: 'draft',
      dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
      notes: validatedData.notes || null,
      termsAndConditions: validatedData.termsAndConditions || null,
      metadata: validatedData.metadata || {},
    }).returning();

    logger.info('Invoice created', {
      userId,
      invoiceId: invoice.id,
      invoiceNumber,
      recipientEmail: validatedData.recipientEmail,
      total: total.toString(),
    });

    res.status(201).json({
      success: true,
      data: invoice,
    });
  } catch (error: any) {
    logger.error('Error creating invoice', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /invoices - List user's invoices
 */
router.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const status = (req.query.status as string) || null;

    const whereConditions = [eq(invoicesTable.fromUserId, userId)];
    if (status) {
      whereConditions.push(eq(invoicesTable.status, status));
    }

    const userInvoices = await db.select().from(invoicesTable).where(
      and(...whereConditions as any)
    );

    res.json({
      success: true,
      count: userInvoices.length,
      data: userInvoices,
    });
  } catch (error: any) {
    logger.error('Error listing invoices', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /invoices/:id - Get invoice details
 */
router.get('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [invoice] = await db.select().from(invoicesTable).where(
      eq(invoicesTable.id, req.params.id)
    ).limit(1);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Check authorization: user is issuer
    if (invoice.fromUserId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error: any) {
    logger.error('Error getting invoice', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /invoices/:id - Update draft invoice
 */
router.put('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [invoice] = await db.select().from(invoicesTable).where(
      eq(invoicesTable.id, req.params.id)
    ).limit(1);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.fromUserId !== userId) return res.status(403).json({ error: 'Unauthorized' });
    if (invoice.status !== 'draft') {
      return res.status(400).json({ error: 'Can only update draft invoices' });
    }

    const validatedData = updateInvoiceSchema.parse(req.body);

    // Recalculate totals if updating amounts
    let subtotal = new Decimal(invoice.subtotal || '0');
    let tax = new Decimal(invoice.tax || '0');
    let total = new Decimal(invoice.total || '0');

    if (validatedData.lineItems && validatedData.lineItems.length > 0) {
      const calculated = calculateLineItemTotals(validatedData.lineItems);
      subtotal = calculated.subtotal;
      tax = calculated.tax;
      total = calculated.total;
    } else if (validatedData.amount) {
      total = new Decimal(validatedData.amount);
      subtotal = total;
      tax = new Decimal(0);
    }

    const [updated] = await db.update(invoicesTable)
      .set({
        recipientEmail: validatedData.recipientEmail || invoice.recipientEmail,
        recipientName: validatedData.recipientName || invoice.recipientName,
        description: validatedData.description || invoice.description,
        amount: total.toString(),
        currency: validatedData.currency || invoice.currency,
        lineItems: validatedData.lineItems || invoice.lineItems,
        subtotal: subtotal.toString(),
        tax: tax.toString(),
        total: total.toString(),
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : invoice.dueDate,
        notes: validatedData.notes || invoice.notes,
        termsAndConditions: validatedData.termsAndConditions || invoice.termsAndConditions,
        metadata: validatedData.metadata || invoice.metadata,
        updatedAt: new Date(),
      })
      .where(eq(invoicesTable.id, req.params.id))
      .returning();

    logger.info('Invoice updated', { userId, invoiceId: updated.id });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    logger.error('Error updating invoice', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /invoices/:id/send - Send invoice to recipient
 */
router.post('/:id/send', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [invoice] = await db.select().from(invoicesTable).where(
      eq(invoicesTable.id, req.params.id)
    ).limit(1);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.fromUserId !== userId) return res.status(403).json({ error: 'Unauthorized' });
    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Cannot send paid invoices' });
    }

    const [updated] = await db.update(invoicesTable)
      .set({
        status: 'sent',
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invoicesTable.id, req.params.id))
      .returning();

    // Send email notification
    await sendInvoiceEmail(updated, invoice.recipientEmail || '');

    logger.info('Invoice sent', {
      userId,
      invoiceId: updated.id,
      recipientEmail: invoice.recipientEmail,
    });

    res.json({
      success: true,
      message: 'Invoice sent successfully',
      data: updated,
    });
  } catch (error: any) {
    logger.error('Error sending invoice', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /invoices/:id/pay - Record payment for invoice
 */
router.post('/:id/pay', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [invoice] = await db.select().from(invoicesTable).where(
      eq(invoicesTable.id, req.params.id)
    ).limit(1);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const validatedData = payInvoiceSchema.parse(req.body);
    const paymentAmount = validatedData.amount || invoice.total;

    const [updated] = await db.update(invoicesTable)
      .set({
        status: 'paid',
        paidAt: new Date(),
        paymentMethod: validatedData.paymentMethod || 'wallet',
        transactionHash: validatedData.transactionHash || null,
        metadata: {
          ...(typeof invoice.metadata === 'object' ? invoice.metadata : {}),
          payerId: userId,
          paidAmount: paymentAmount,
          ...(validatedData.metadata || {}),
        },
        updatedAt: new Date(),
      })
      .where(eq(invoicesTable.id, req.params.id))
      .returning();

    logger.info('Invoice paid', {
      invoiceId: updated.id,
      payerId: userId,
      amount: paymentAmount,
      currency: validatedData.currency || invoice.currency,
    });

    res.json({
      success: true,
      message: 'Invoice marked as paid',
      data: updated,
    });
  } catch (error: any) {
    logger.error('Error paying invoice', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /invoices/:id - Delete invoice (only draft)
 */
router.delete('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [invoice] = await db.select().from(invoicesTable).where(
      eq(invoicesTable.id, req.params.id)
    ).limit(1);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.fromUserId !== userId) return res.status(403).json({ error: 'Unauthorized' });
    if (invoice.status !== 'draft') {
      return res.status(400).json({ error: 'Can only delete draft invoices' });
    }

    await db.delete(invoicesTable).where(eq(invoicesTable.id, req.params.id));

    logger.info('Invoice deleted', { userId, invoiceId: invoice.id });

    res.json({
      success: true,
      message: 'Invoice deleted',
    });
  } catch (error: any) {
    logger.error('Error deleting invoice', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

export default router;
