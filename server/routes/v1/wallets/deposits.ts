/**
 * Deposits Router - V1 Canonical Endpoint
 * Base path: /api/v1/wallets/deposits
 * 
 * Direct migration from /api/deposits/* to /api/v1/wallets/deposits/*
 * 
 * Endpoints (7):
 * POST   /api/v1/wallets/deposits/initiate              Initiate deposit
 * GET    /api/v1/wallets/deposits/status/:txId          Get deposit status
 * GET    /api/v1/wallets/deposits/limits                Get deposit limits
 * GET    /api/v1/wallets/deposits/stable-assets         List stable-asset deposit methods
 * GET    /api/v1/wallets/deposits/history               User's deposit history
 * GET    /api/v1/wallets/deposits/summary               Deposit summary stats
 * POST   /api/v1/wallets/deposits/webhook               Provider webhook (no auth)
 */

import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { isAuthenticated } from '../../../auth';
import { db } from '../../../storage';
import { logger } from '../../../utils/logger';
import { walletTransactions } from '../../../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

const router = express.Router({ mergeParams: true });

// ════════════════════════════════════════════════════════════════════════════════
// RATE LIMITERS
// ════════════════════════════════════════════════════════════════════════════════

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

// Webhook rate limiter: Protect webhook endpoint from abuse (IP-based)
const webhookLimiter = new RateLimiter({ windowMs: 60 * 1000, maxRequests: 100 });

// ════════════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ════════════════════════════════════════════════════════════════════════════════

const initiateDepositSchema = z.object({
  provider: z.enum(['stripe', 'kotanipay', 'mpesa']),
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount format'),
  currency: z.string().default('cUSD'),
  metadata: z.record(z.any()).optional(),
});

// ════════════════════════════════════════════════════════════════════════════════
// DEPOSIT OPERATIONS (7 endpoints)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /deposits/initiate - Initiate a deposit
 */
router.post(
  '/initiate',
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.claims?.id;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const validatedData = initiateDepositSchema.parse(req.body);
      const depositId = `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create wallet transaction record for deposit tracking
      const [transaction] = await db.insert(walletTransactions).values({
        toUserId: userId,
        type: 'deposit',
        status: 'pending',
        amount: new Decimal(validatedData.amount).toFixed(2),
        currency: validatedData.currency,
        walletAddress: '', // Populated by provider webhook
        metadata: { provider: validatedData.provider, ...validatedData.metadata, initiatedAt: new Date() },
      }).returning();

      logger.info('Deposit initiated', { userId, depositId, amount: validatedData.amount, provider: validatedData.provider });

      res.status(201).json({
        success: true,
        data: {
          id: depositId,
          status: 'pending',
          amount: validatedData.amount,
          currency: validatedData.currency,
          provider: validatedData.provider,
          createdAt: transaction.createdAt,
        },
        message: 'Deposit initiated. Awaiting payment confirmation.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /deposits/status/:txId - Get deposit status
 */
router.get(
  '/status/:txId',
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.claims?.id;
      const { txId } = req.params;

      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const [transaction] = await db.select().from(walletTransactions)
        .where(and(
          eq(walletTransactions.id, txId),
          eq(walletTransactions.toUserId, userId),
          eq(walletTransactions.type, 'deposit')
        ))
        .limit(1);

      if (!transaction) {
        return res.status(404).json({ success: false, error: 'Deposit not found' });
      }

      const metadata = transaction.metadata as any || {};
      res.json({
        success: true,
        data: {
          id: transaction.id,
          status: transaction.status,
          amount: Number(transaction.amount),
          currency: transaction.currency,
          provider: metadata.provider,
          createdAt: transaction.createdAt,
          completedAt: transaction.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /deposits/limits - Get deposit limits for user
 */
router.get(
  '/limits',
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: {
          limits: {
            stripe: { daily: '10000', monthly: '50000', perTransaction: '5000' },
            kotanipay: { daily: '5000', monthly: '25000', perTransaction: '2500' },
            mpesa: { daily: '1000', monthly: '10000', perTransaction: '500' },
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /deposits/stable-assets - List stable-asset deposit methods
 */
router.get(
  '/stable-assets',
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: {
          assets: [
            { symbol: 'cUSD', name: 'Celo Dollar', decimals: 18, chain: 'celo' },
            { symbol: 'USDC', name: 'USD Coin', decimals: 6, chain: 'celo' },
            { symbol: 'USDT', name: 'Tether', decimals: 6, chain: 'celo' },
            { symbol: 'DAI', name: 'DAI Stablecoin', decimals: 18, chain: 'celo' },
          ],
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /deposits/history - Get user's deposit history
 */
router.get(
  '/history',
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.claims?.id;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;

      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const deposits = await db.select().from(walletTransactions)
        .where(and(
          eq(walletTransactions.toUserId, userId),
          eq(walletTransactions.type, 'deposit')
        ))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(limit)
        .offset(offset);

      res.json({
        success: true,
        data: deposits.map(d => {
          const metadata = d.metadata as any || {};
          return {
            id: d.id,
            status: d.status,
            amount: Number(d.amount),
            currency: d.currency,
            provider: metadata.provider,
            createdAt: d.createdAt,
          };
        }),
        count: deposits.length,
        pagination: { limit, offset },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /deposits/summary - Get deposit summary stats
 */
router.get(
  '/summary',
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.claims?.id;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const deposits = await db.select().from(walletTransactions)
        .where(and(
          eq(walletTransactions.toUserId, userId),
          eq(walletTransactions.type, 'deposit')
        ))
        .orderBy(desc(walletTransactions.createdAt));

      const totalDeposited = deposits
        .filter(d => d.status === 'completed')
        .reduce((sum, d) => new Decimal(sum).add(new Decimal(d.amount || '0')), new Decimal(0))
        .toString();

      const pendingDeposits = deposits.filter(d => d.status === 'pending');

      res.json({
        success: true,
        data: {
          totalDeposited,
          totalCount: deposits.length,
          completedCount: deposits.filter(d => d.status === 'completed').length,
          pendingCount: pendingDeposits.length,
          lastDepositAt: deposits[0]?.createdAt || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /deposits/webhook - Provider webhook endpoint (Stripe, Kotanipay, M-Pesa)
 * Public endpoint: No auth required (providers call from fixed IPs)
 * Rate limited by IP to prevent abuse
 */
router.post(
  '/webhook',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Rate limit by IP
      const clientIp = req.ip || 'unknown';
      if (!webhookLimiter.checkLimit(clientIp)) {
        return res.status(429).json({ success: false, error: 'Rate limit exceeded' });
      }

      const { depositId, transactionHash, status, provider, feeAmount, metadata } = req.body;

      if (!depositId || !status) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: depositId, status',
        });
      }

      // Update transaction status
      await db.update(walletTransactions)
        .set({
          status: status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'pending',
          walletAddress: transactionHash || '',
          metadata: { transactionHash, provider, feeAmount, ...metadata },
          updatedAt: new Date(),
        })
        .where(eq(walletTransactions.id, depositId));

      if (status === 'completed') {
        logger.info('Deposit webhook: completed', { depositId, transactionHash, provider });
      } else if (status === 'failed') {
        logger.warn('Deposit webhook: failed', { depositId, provider });
      }

      res.json({ success: true, message: 'Webhook processed' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
