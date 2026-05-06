/**
 * Payment Links Router - V1 Canonical Endpoint
 * Create and manage payment links/requests with multi-asset support
 * Base path: /api/v1/wallets/payment-links
 * Aligned with paymentRequests table schema
 * 
 * Endpoints (6):
 * GET    /api/v1/wallets/payment-links/tokens/supported  List supported tokens
 * POST   /api/v1/wallets/payment-links                    Create payment link
 * GET    /api/v1/wallets/payment-links                    List payment links
 * GET    /api/v1/wallets/payment-links/:id               Get payment link details
 * POST   /api/v1/wallets/payment-links/:id/mark-paid     Mark link as paid/cancelled
 * DELETE /api/v1/wallets/payment-links/:id               Delete payment link
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { isAuthenticated } from '../../../auth';
import { db } from '../../../storage';
import { logger } from '../../../utils/logger';
import { eq, and } from 'drizzle-orm';
import { paymentRequests } from '../../../../shared/schema';

const router = express.Router();

// Rate limiting for payment link creation and actions
class RateLimiter {
  private limits: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(config: { windowMs: number; maxRequests: number }) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
  }

  checkLimit(identifier: string): boolean {
    const now = Date.now();
    const requests = this.limits.get(identifier) || [];
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.limits.set(identifier, validRequests);
    return true;
  }
}

const createLinkLimiter = new RateLimiter({ windowMs: 3600000, maxRequests: 50 }); // 50 links per hour
const markPaidLimiter = new RateLimiter({ windowMs: 60000, maxRequests: 10 }); // 10 per minute

// Supported tokens/assets configuration
const SUPPORTED_TOKENS = {
  'cUSD': { name: 'Celo Dollar', symbol: 'cUSD', decimals: 18, type: 'stablecoin', chain: 'celo' },
  'USDC': { name: 'USD Coin', symbol: 'USDC', decimals: 6, type: 'stablecoin', chain: 'celo' },
  'USDT': { name: 'Tether', symbol: 'USDT', decimals: 6, type: 'stablecoin', chain: 'celo' },
  'DAI': { name: 'Dai Stablecoin', symbol: 'DAI', decimals: 18, type: 'stablecoin', chain: 'celo' },
  'cELO': { name: 'Celo Native Token', symbol: 'cELO', decimals: 18, type: 'native', chain: 'celo' },
  'USD': { name: 'US Dollar', symbol: 'USD', decimals: 2, type: 'fiat', chain: 'fiat' },
  'KES': { name: 'Kenyan Shilling', symbol: 'KES', decimals: 2, type: 'fiat', chain: 'fiat' },
  'EUR': { name: 'Euro', symbol: 'EUR', decimals: 2, type: 'fiat', chain: 'fiat' },
} as const;

// Validation schemas
const createPaymentLinkSchema = z.object({
  description: z.string().min(1).max(500).describe('What is this payment for?'),
  amount: z.number().positive().describe('Amount in the specified currency'),
  currency: z.enum(Object.keys(SUPPORTED_TOKENS) as [keyof typeof SUPPORTED_TOKENS, ...Array<keyof typeof SUPPORTED_TOKENS>])
    .default('cUSD')
    .describe('Currency/token code (default: cUSD)'),
  toAddress: z.string().optional().describe('Blockchain address for payment (if blockchain payment)'),
  expiresIn: z.number().optional().default(7 * 24 * 60 * 60).describe('Expiry in seconds (default: 7 days)'),
});

const markPaidSchema = z.object({
  status: z.enum(['paid', 'cancelled']).describe('Mark as paid or cancelled'),
  transactionHash: z.string().optional().describe('Blockchain transaction hash if applicable'),
});

/**
 * Generate QR code URL for payment link
 */
function generateQRCode(linkId: string): string {
  const shareUrl = `${process.env.APP_URL || 'https://app.mtaa.io'}/payment/${linkId}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}`;
}

/**
 * Generate blockchain-specific URI schemes
 */
function generateBlockchainUri(linkId: string, currency: string, amount: string): string {
  if (currency === 'cUSD' || currency === 'USDC' || currency === 'USDT' || currency === 'DAI') {
    return `celo://pay/${linkId}?token=${currency}&amount=${amount}`;
  } else if (currency === 'cELO') {
    return `celo://pay/${linkId}?amount=${amount}`;
  }
  return '';
}

// GET /api/v1/wallets/payment-links/tokens/supported (MUST come before /:id route)
// List all supported tokens and assets
router.get('/tokens/supported', (req: any, res: Response) => {
  try {
    const tokensList = Object.entries(SUPPORTED_TOKENS).map(([key, config]) => ({
      code: key,
      ...config,
    }));

    res.json({
      success: true,
      data: tokensList,
      summary: {
        stablecoins: tokensList.filter(t => t.type === 'stablecoin').length,
        nativeTokens: tokensList.filter(t => t.type === 'native').length,
        fiatOptions: tokensList.filter(t => t.type === 'fiat').length,
        total: tokensList.length,
      },
    });
  } catch (error: any) {
    logger.error('Supported tokens retrieval error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/wallets/payment-links
// Create a new payment link/request
router.post('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Apply rate limiting
    if (!createLinkLimiter.checkLimit(userId)) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Maximum 50 payment links per hour.'
      });
    }

    const validatedData = createPaymentLinkSchema.parse(req.body);
    const linkId = `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + validatedData.expiresIn * 1000);
    const qrCode = generateQRCode(linkId);
    const celoUri = generateBlockchainUri(linkId, validatedData.currency, validatedData.amount.toString());

    // Store in database
    const [paymentLink] = await db.insert(paymentRequests).values({
      id: linkId,
      fromUserId: userId,
      toUserId: null,
      toAddress: validatedData.toAddress || null,
      amount: new Decimal(validatedData.amount).toFixed(2),
      currency: validatedData.currency,
      description: validatedData.description,
      qrCode: qrCode,
      celoUri: celoUri || null,
      status: 'pending',
      expiresAt: expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    logger.info('Payment link created', {
      userId,
      linkId,
      amount: validatedData.amount,
      currency: validatedData.currency,
    });

    const shareUrl = `${process.env.APP_URL || 'https://app.mtaa.io'}/payment/${linkId}`;

    res.status(201).json({
      success: true,
      data: {
        id: linkId,
        description: validatedData.description,
        amount: validatedData.amount,
        currency: validatedData.currency,
        currencyConfig: SUPPORTED_TOKENS[validatedData.currency as keyof typeof SUPPORTED_TOKENS],
        toAddress: validatedData.toAddress || null,
        shareUrl,
        qrCode: qrCode,
        celoUri: celoUri || null,
        status: 'pending',
        expiresAt: expiresAt,
        createdAt: paymentLink.createdAt,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid request data', details: error.errors });
    }
    logger.error('Payment link creation error', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/v1/wallets/payment-links
// List payment links for authenticated user
router.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { status, limit = '20', offset = '0' } = req.query;

    const whereConditions = [eq(paymentRequests.fromUserId, userId)];
    if (status && typeof status === 'string') {
      whereConditions.push(eq(paymentRequests.status, status as any));
    }

    const links = await db.select()
      .from(paymentRequests)
      .where(and(...whereConditions))
      .limit(Number(limit))
      .offset(Number(offset));

    logger.info('Payment links retrieved', { userId, count: links.length });

    res.json({
      success: true,
      data: links.map(link => ({
        ...link,
        amount: Number(link.amount),
        currencyConfig: SUPPORTED_TOKENS[link.currency as keyof typeof SUPPORTED_TOKENS],
      })),
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error: any) {
    logger.error('Payment links retrieval error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/wallets/payment-links/:id
// Get details of a specific payment link
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [link] = await db.select()
      .from(paymentRequests)
      .where(eq(paymentRequests.id, id))
      .limit(1);

    if (!link) {
      return res.status(404).json({ success: false, error: 'Payment link not found' });
    }

    // Check if link is expired
    if (link.expiresAt && new Date() > link.expiresAt) {
      return res.status(410).json({
        success: false,
        error: 'Payment link has expired',
        expiredAt: link.expiresAt
      });
    }

    const currencyConfig = SUPPORTED_TOKENS[link.currency as keyof typeof SUPPORTED_TOKENS];

    res.json({
      success: true,
      data: {
        ...link,
        amount: Number(link.amount),
        currencyConfig,
      },
    });
  } catch (error: any) {
    logger.error('Payment link retrieval error', { error: error.message, linkId: req.params.id });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/wallets/payment-links/:id/mark-paid
// Mark a payment link as paid or cancelled
router.post('/:id/mark-paid', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Apply rate limiting
    if (!markPaidLimiter.checkLimit(userId)) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait before marking another payment.'
      });
    }

    const validatedData = markPaidSchema.parse(req.body);

    // Fetch payment link to verify ownership
    const [link] = await db.select()
      .from(paymentRequests)
      .where(eq(paymentRequests.id, id))
      .limit(1);

    if (!link) {
      return res.status(404).json({ success: false, error: 'Payment link not found' });
    }

    if (link.fromUserId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized: You do not own this payment link' });
    }

    // Update status
    const [updated] = await db.update(paymentRequests)
      .set({
        status: validatedData.status,
        toUserId: validatedData.status === 'paid' ? (req.user as any)?.claims?.id : null,
        updatedAt: new Date(),
      })
      .where(eq(paymentRequests.id, id))
      .returning();

    logger.info('Payment link status updated', {
      userId,
      linkId: id,
      status: validatedData.status,
      transactionHash: validatedData.transactionHash,
    });

    res.json({
      success: true,
      message: `Payment link marked as ${validatedData.status}`,
      data: {
        id,
        status: validatedData.status,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid request data', details: error.errors });
    }
    logger.error('Mark payment link error', { error: error.message, linkId: req.params.id });
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /api/v1/wallets/payment-links/:id
// Delete a payment link (only if not yet paid)
router.delete('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Fetch link to verify ownership
    const [link] = await db.select()
      .from(paymentRequests)
      .where(eq(paymentRequests.id, id))
      .limit(1);

    if (!link) {
      return res.status(404).json({ success: false, error: 'Payment link not found' });
    }

    if (link.fromUserId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized: You do not own this payment link' });
    }

    if (link.status === 'paid') {
      return res.status(400).json({ success: false, error: 'Cannot delete a paid payment link' });
    }

    // Delete from database
    await db.delete(paymentRequests)
      .where(eq(paymentRequests.id, id));

    logger.info('Payment link deleted', { userId, linkId: id });

    res.json({
      success: true,
      message: 'Payment link deleted',
    });
  } catch (error: any) {
    logger.error('Payment link deletion error', { error: error.message, linkId: req.params.id });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
