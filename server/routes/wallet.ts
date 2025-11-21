import express, { Express, Router, Request, Response } from 'express';
import { isAuthenticated } from '../auth';

import EnhancedAgentWallet, { NetworkConfig } from '../agent_wallet';

import { db } from '../db';
import { walletTransactions, contributions, paymentRequests, lockedSavings, savingsGoals, paymentReceipts, vaults } from '../../shared/schema';
import { desc, eq, or, and, sql, gte } from 'drizzle-orm';
import { notificationService } from '../notificationService';
import { Logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';

const logger = Logger.getLogger();

// Get private key from environment or generate a development one
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x' + '1'.repeat(64);
const NETWORK = NetworkConfig.CELO_ALFAJORES;

// Only initialize wallet if we have a valid private key
let wallet: EnhancedAgentWallet | null = null;
try {
  if (PRIVATE_KEY && PRIVATE_KEY !== 'your_private_key_here') {
    wallet = new EnhancedAgentWallet(PRIVATE_KEY, NETWORK);
  }
} catch (error) {
  logger.warn('Failed to initialize wallet:', error);
}

const router = express.Router();

// Validation schemas
const sendNativeSchema = z.object({
  toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, 'Amount must be positive'),
  userId: z.string().optional()
});

const sendTokenSchema = z.object({
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
  toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid recipient address'),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, 'Amount must be positive'),
  userId: z.string().optional()
});

const createSavingsSchema = z.object({
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, 'Amount must be positive'),
  lockPeriodDays: z.number().int().min(30, 'Lock period must be at least 30 days')
});

// Middleware to check wallet availability
const requireWallet = (req: Request, res: Response, next: Function) => {
  if (!wallet) {
    return res.status(503).json({ 
      success: false, 
      error: 'Wallet service not available. Please configure PRIVATE_KEY in environment.' 
    });
  }
  next();
};

// GET /api/wallet/balance/:address?
router.get('/balance/:address?', isAuthenticated, requireWallet, async (req, res) => {
  try {
    const address = req.params.address || wallet!.address;
    const balance = await wallet!.getBalance();

    res.json({ 
      success: true,
      address, 
      balance,
      symbol: 'CELO'
    });
  } catch (error) {
    logger.error('Failed to get balance:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch balance' });
  }
});

// GET /api/wallet/balance/celo
router.get('/balance/celo', isAuthenticated, requireWallet, async (req, res) => {
  try {
    const address = (req.query.user as string) || wallet!.address;
    const balance = await wallet!.getBalanceEth(address);

    res.json({ 
      success: true,
      address, 
      balance, 
      symbol: 'CELO' 
    });
  } catch (error) {
    logger.error('Failed to get CELO balance:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch CELO balance' });
  }
});

// GET /api/wallet/balance/cusd
router.get('/balance/cusd', isAuthenticated, requireWallet, async (req, res) => {
  try {
    const address = (req.query.user as string) || wallet!.address;
    const CUSD_TOKEN_ADDRESS = '0x765DE816845861e75A25fCA122bb6898B8B1282a'; // Celo mainnet cUSD
    const balance = await wallet!.getBalance();

    res.json({ 
      success: true,
      address, 
      balance, 
      symbol: 'cUSD' 
    });
  } catch (error) {
    logger.error('Failed to get cUSD balance:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch cUSD balance' });
  }
});

// POST /api/wallet/send-native
router.post('/send-native', isAuthenticated, requireWallet, async (req, res) => {
  try {
    const validatedData = sendNativeSchema.parse(req.body);
    const { toAddress, amount, userId } = validatedData;

    // Check KYC limits if userId provided
    if (userId) {
      const { kycService } = await import('../services/kycService');
      const limitCheck = await kycService.checkTransactionLimit(userId, parseFloat(amount), 'CELO');
      if (!limitCheck.allowed) {
        return res.status(403).json({ success: false, error: limitCheck.reason });
      }
    }

    const result = await wallet!.sendNativeToken(toAddress, amount);

    // Create notification
    if (userId && result.hash) {
      await notificationService.createNotification({
        userId,
        type: 'transaction',
        title: 'Transaction Sent',
        message: `Successfully sent ${amount} CELO to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`,
        metadata: {
          transactionHash: result.hash,
          amount,
          currency: 'CELO',
          toAddress
        }
      });
    }

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Send native token failed:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    res.status(500).json({ success: false, error: 'Transaction failed' });
  }
});

// POST /api/wallet/send-token
router.post('/send-token', isAuthenticated, requireWallet, async (req, res) => {
  try {
    const validatedData = sendTokenSchema.parse(req.body);
    const { tokenAddress, toAddress, amount, userId } = validatedData;

    const result = await wallet!.sendTokenHuman(tokenAddress, toAddress, amount);

    // Create notification
    if (userId && result.hash) {
      const currency = tokenAddress.includes('cUSD') ? 'cUSD' : 'TOKEN';
      await notificationService.createNotification({
        userId,
        type: 'transaction',
        title: 'Token Sent',
        message: `Successfully sent ${amount} ${currency} to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`,
        metadata: {
          transactionHash: result.hash,
          amount,
          currency,
          toAddress,
          tokenAddress
        }
      });
    }

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Send token failed:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    res.status(500).json({ success: false, error: 'Transaction failed' });
  }
});

// GET /api/wallet/analytics
router.get('/analytics', isAuthenticated, async (req, res) => {
  try {
    const walletAddress = req.query.address as string;
    if (!walletAddress) {
      return res.status(400).json({ success: false, error: 'Wallet address required' });
    }

    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.walletAddress, walletAddress))
      .orderBy(desc(walletTransactions.createdAt));

    // Calculate analytics
    const analytics = transactions.reduce((acc, tx) => {
      const amount = parseFloat(tx.amount);
      const currency = tx.currency || 'UNKNOWN';

      if (!acc.byCurrency[currency]) {
        acc.byCurrency[currency] = { deposits: 0, withdrawals: 0, contributions: 0, transfers: 0 };
      }

      switch (tx.type) {
        case 'deposit':
          acc.totalDeposits += amount;
          acc.depositCount++;
          acc.byCurrency[currency].deposits += amount;
          break;
        case 'withdrawal':
          acc.totalWithdrawals += amount;
          acc.withdrawalCount++;
          acc.byCurrency[currency].withdrawals += amount;
          break;
        case 'contribution':
          acc.totalContributions += amount;
          acc.contributionCount++;
          acc.byCurrency[currency].contributions += amount;
          break;
        case 'transfer':
          acc.totalTransfers += amount;
          acc.transferCount++;
          acc.byCurrency[currency].transfers += amount;
          break;
      }
      return acc;
    }, {
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalContributions: 0,
      totalTransfers: 0,
      depositCount: 0,
      withdrawalCount: 0,
      contributionCount: 0,
      transferCount: 0,
      byCurrency: {} as Record<string, any>
    });

    res.json({
      success: true,
      analytics,
      transactionCount: transactions.length
    });
  } catch (error) {
    logger.error('Failed to get analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

// GET /api/wallet/savings
router.get('/savings', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const savingsAccounts = await db
      .select()
      .from(lockedSavings)
      .where(eq(lockedSavings.userId, userId))
      .orderBy(desc(lockedSavings.createdAt));

    // Calculate current values
    const enrichedSavings = savingsAccounts.map(saving => {
      const now = new Date();
      const unlocksAt = new Date(saving.unlocksAt);
      const isMatured = now >= unlocksAt;
      const daysRemaining = Math.max(0, Math.ceil((unlocksAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      const lockedAt = new Date(saving.lockedAt ?? new Date());
      const dailyRate = parseFloat(saving.interestRate || '0') / 365;
      const daysElapsed = Math.floor((now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60 * 24));
      const earnedInterest = parseFloat(saving.amount) * dailyRate * daysElapsed;
      const currentValue = parseFloat(saving.amount) + earnedInterest;

      return {
        ...saving,
        isMatured,
        daysRemaining,
        earnedInterest: earnedInterest.toFixed(2),
        currentValue: currentValue.toFixed(2)
      };
    });

    res.json({ success: true, savings: enrichedSavings });
  } catch (error) {
    logger.error('Failed to fetch savings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch savings accounts' });
  }
});

// POST /api/wallet/savings/create
router.post('/savings/create', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const validatedData = createSavingsSchema.parse(req.body);
    const { amount, lockPeriodDays } = validatedData;

    // Calculate interest rate
    let interestRate = '0.08'; // 8% for 30 days
    if (lockPeriodDays >= 365) interestRate = '0.15';
    else if (lockPeriodDays >= 180) interestRate = '0.12';
    else if (lockPeriodDays >= 90) interestRate = '0.10';

    // Get or create savings vault
    let vault = await db.query.vaults.findFirst({
      where: and(
        eq(vaults.userId, userId),
        eq(vaults.vaultType, 'savings')
      )
    });

    if (!vault) {
      const [newVault] = await db.insert(vaults).values({
        userId,
        name: 'Savings Vault',
        currency: 'cUSD',
        vaultType: 'savings',
        isActive: true
      }).returning();
      vault = newVault;
    }

    const unlocksAt = new Date();
    unlocksAt.setDate(unlocksAt.getDate() + lockPeriodDays);

    const [lockedSaving] = await db.insert(lockedSavings).values({
      userId,
      vaultId: vault.id,
      amount: amount.toString(),
      currency: 'cUSD',
      lockPeriod: lockPeriodDays,
      interestRate,
      unlocksAt,
      status: 'locked'
    }).returning();

    res.json({ success: true, data: lockedSaving });
  } catch (error) {
    logger.error('Failed to create savings:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    res.status(500).json({ success: false, error: 'Failed to create savings account' });
  }
});

// POST /api/wallet/savings/withdraw/:id
router.post('/savings/withdraw/:id', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { force } = req.body;

    const saving = await db.query.lockedSavings.findFirst({
      where: and(
        eq(lockedSavings.id, id),
        eq(lockedSavings.userId, userId)
      )
    });

    if (!saving) {
      return res.status(404).json({ success: false, error: 'Savings account not found' });
    }

    if (saving.status === 'withdrawn') {
      return res.status(400).json({ success: false, error: 'Already withdrawn' });
    }

    const now = new Date();
    const unlocksAt = new Date(saving.unlocksAt);
    const isMatured = now >= unlocksAt;

    let penalty = 0;
    if (force && !isMatured) {
      penalty = parseFloat(saving.amount) * 0.1; // 10% penalty
    }

    const lockedAt = new Date(saving.lockedAt ?? new Date());
    const dailyRate = parseFloat(saving.interestRate || '0') / 365;
    const daysElapsed = Math.floor((now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60 * 24));
    const earnedInterest = parseFloat(saving.amount) * dailyRate * daysElapsed;
    const totalValue = parseFloat(saving.amount) + earnedInterest;
    const finalAmount = totalValue - penalty;

    await db.update(lockedSavings)
      .set({
        status: 'withdrawn',
        penalty: penalty.toString(),
        updatedAt: new Date()
      })
      .where(eq(lockedSavings.id, id));

    res.json({
      success: true,
      finalAmount: finalAmount.toFixed(2),
      earnedInterest: earnedInterest.toFixed(2),
      penalty: penalty.toFixed(2),
      isEarlyWithdrawal: force && !isMatured
    });
  } catch (error) {
    logger.error('Failed to withdraw savings:', error);
    res.status(500).json({ success: false, error: 'Failed to withdraw savings' });
  }
});

// GET /api/wallet/network-info
router.get('/network-info', requireWallet, async (req, res) => {
  try {
    const info = await wallet!.getNetworkInfo();
    res.json({ success: true, ...info });
  } catch (error) {
    logger.error('Failed to get network info:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch network info' });
  }
});

export default router;