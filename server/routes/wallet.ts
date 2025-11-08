import express, { Express, Router, Request, Response } from 'express';

import EnhancedAgentWallet, { NetworkConfig, WalletManager } from '../agent_wallet';

import { db } from '../storage';
import { walletTransactions, contributions, paymentRequests, lockedSavings, savingsGoals, paymentReceipts } from '../../shared/schema';
import { desc, eq, or, and, sql, gte } from 'drizzle-orm';
import { fileURLToPath } from "url";
import { dirname } from "path";
import { notificationService } from '../notificationService';
import { users } from '../../shared/schema';
import { Logger } from '../logger';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get private key from environment or generate a development one
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x' + '1'.repeat(64); // Valid but insecure development key
const NETWORK = NetworkConfig.CELO_ALFAJORES;

const mockPriceOracle = async (tokenAddress: string): Promise<number> => {
  const prices: Record<string, number> = {
    'native': 2500, // ETH price
    '0x...': 1.0 // USDC price
  };
  return prices[tokenAddress] || 0;
};

// Only initialize wallet if we have a valid private key
let wallet: EnhancedAgentWallet | null = null;
try {
  if (PRIVATE_KEY && PRIVATE_KEY !== 'your_private_key_here') {
    wallet = new EnhancedAgentWallet(
      PRIVATE_KEY,
      NETWORK,
      undefined, // permissionCheck
      undefined, // contributionLogger
      undefined, // billingLogger
      mockPriceOracle
    );
  }
} catch (error) {
  console.warn('Failed to initialize wallet:', error);
}

// RiskManager instance (demo: limits hardcoded)
import { RiskManager, TransactionAnalytics } from '../agent_wallet';
const riskManager = new RiskManager(wallet!, 10000, 5000); // Non-null assertion as it's expected to be initialized or cause a warning
const analytics = new TransactionAnalytics();

const router = express.Router();

// --- RBAC Middleware ---
function requireRole(...roles: string[]) {
  return (req: any, res: any, next: any) => {
    // Assume req.user is set by auth middleware
    const user = req.user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }
    next();
  };
}

// In-memory allowed tokens set for demo (replace with DB in prod)
let allowedTokens = new Set<string>();
// POST /api/wallet/risk/validate
router.post('/risk/validate', async (req, res) => {
  try {
    const { amount, tokenAddress, toAddress } = req.body;
    const result = await riskManager.validateTransfer(amount, tokenAddress, toAddress);
    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/analytics/report
router.get('/analytics/report', async (req, res) => {
  try {
    const { timeframe } = req.query;
    const report = analytics.generateReport(Number(timeframe) || 7 * 24 * 60 * 60 * 1000);
    res.json(report);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet/multisig/info (admin/elder only)
router.post('/multisig/info', requireRole('admin', 'elder'), async (req, res) => {
  try {
    const { multisigAddress } = req.body;
    const info = await wallet!.getMultisigInfo(multisigAddress); // Non-null assertion
    res.json(info);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet/multisig/submit (admin/elder only)
router.post('/multisig/submit', requireRole('admin', 'elder'), async (req, res) => {
  try {
    const { multisigAddress, destination, value, data } = req.body;
    const result = await wallet!.submitMultisigTransaction(multisigAddress, destination, value, data); // Non-null assertion
    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// --- DAO Treasury Allowed Tokens Management (demo: in-memory) ---
// GET /api/wallet/allowed-tokens (admin/elder only)
router.get('/allowed-tokens', requireRole('admin', 'elder'), (req, res) => {
  res.json({ allowedTokens: Array.from(allowedTokens) });
});

// POST /api/wallet/allowed-tokens/add (admin/elder only)
router.post('/allowed-tokens/add', requireRole('admin', 'elder'), (req, res) => {
  const { tokenAddress } = req.body;
  if (WalletManager.validateAddress(tokenAddress)) {
    allowedTokens.add(tokenAddress);
    res.json({ success: true, allowedTokens: Array.from(allowedTokens) });
  } else {
    res.status(400).json({ error: 'Invalid token address' });
  }
});

// POST /api/wallet/allowed-tokens/remove (admin/elder only)
router.post('/allowed-tokens/remove', requireRole('admin', 'elder'), (req, res) => {
  const { tokenAddress } = req.body;
  allowedTokens.delete(tokenAddress);
  res.json({ success: true, allowedTokens: Array.from(allowedTokens) });
});


// GET /api/wallet/analytics - Get wallet analytics (placeholder)
router.get('/analytics', async (req, res) => {
  try {
    const walletAddress = req.query.address as string;
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    // Fetch transactions for the wallet
    const transactions = await db
      .select({
        id: walletTransactions.id,
        type: walletTransactions.type,
        amount: walletTransactions.amount,
        currency: walletTransactions.currency,
        createdAt: walletTransactions.createdAt,
        status: walletTransactions.status
      })
      .from(walletTransactions)
      .where(eq(walletTransactions.walletAddress, walletAddress));

    // Calculate analytics
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalContributions = 0;
    let totalTransfers = 0;
    let depositCount = 0;
    let withdrawalCount = 0;
    let contributionCount = 0;
    let transferCount = 0;
    const byCurrency: Record<string, { deposits: number; withdrawals: number; contributions: number; transfers: number }> = {};

    transactions.forEach(tx => {
      const amount = parseFloat(tx.amount);
      const currency = tx.currency || 'UNKNOWN';
      if (!byCurrency[currency]) {
        byCurrency[currency] = { deposits: 0, withdrawals: 0, contributions: 0, transfers: 0 };
      }
      switch (tx.type) {
        case 'deposit':
          totalDeposits += amount;
          depositCount++;
          byCurrency[currency].deposits += amount;
          break;
        case 'withdrawal':
          totalWithdrawals += amount;
          withdrawalCount++;
          byCurrency[currency].withdrawals += amount;
          break;
        case 'contribution':
          totalContributions += amount;
          contributionCount++;
          byCurrency[currency].contributions += amount;
          break;
        case 'transfer':
          totalTransfers += amount;
          transferCount++;
          byCurrency[currency].transfers += amount;
          break;
      }
    });

    res.json({
      success: true,
      analytics: {
        totalDeposits,
        totalWithdrawals,
        totalContributions,
        totalTransfers,
        depositCount,
        withdrawalCount,
        contributionCount,
        transferCount,
        byCurrency
      },
      transactionCount: transactions.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/wallet/pending-payments - Get pending payments overview
router.get('/pending-payments', async (req, res) => {
  try {
    const { walletAddress, userId } = req.query;


    // Build where conditions
    const conditions = [eq(paymentRequests.status, 'pending')];
    if (walletAddress) {
      conditions.push(eq(paymentRequests.toAddress, walletAddress as string));
    } else if (userId) {
      conditions.push(eq(paymentRequests.toUserId, userId as string));
    }
    const pending = await db
      .select({
        id: paymentRequests.id,
        fromUserId: paymentRequests.fromUserId,
        toUserId: paymentRequests.toUserId,
        toAddress: paymentRequests.toAddress,
        amount: paymentRequests.amount,
        currency: paymentRequests.currency,
        description: paymentRequests.description,
        status: paymentRequests.status,
        expiresAt: paymentRequests.expiresAt,
        createdAt: paymentRequests.createdAt,
      })
      .from(paymentRequests)
      .where(and(...conditions))
      .orderBy(desc(paymentRequests.createdAt));

    // Calculate totals by currency
    const totalsByCurrency = pending.reduce((acc, payment) => {
      const currency = payment.currency;
      if (!acc[currency]) {
        acc[currency] = { total: 0, count: 0 };
      }
      acc[currency].total += parseFloat(payment.amount);
      acc[currency].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);

    res.json({
      success: true,
      data: {
        payments: pending,
        summary: {
          totalPending: pending.length,
          byCurrency: totalsByCurrency,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/wallet/balance-trends - Get balance trends over time
router.get('/balance-trends', async (req, res) => {
  try {
    const { walletAddress, period = 'weekly' } = req.query;
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const daysBack = period === 'monthly' ? 30 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get transactions for the period
    const transactions = await db
      .select({
        date: sql<string>`DATE(${walletTransactions.createdAt})`,
        type: walletTransactions.type,
        amount: walletTransactions.amount,
        currency: walletTransactions.currency,
      })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.walletAddress, walletAddress as string),
          gte(walletTransactions.createdAt, startDate)
        )
      )
      .orderBy(walletTransactions.createdAt);

    // Group by date and calculate running balance
    const balanceByDate: Record<string, Record<string, number>> = {};

    transactions.forEach((tx) => {
      const currency = tx.currency;
      if (!currency) return; // skip null currency
      if (!balanceByDate[tx.date]) {
        balanceByDate[tx.date] = {};
      }
      if (!balanceByDate[tx.date][currency]) {
        balanceByDate[tx.date][currency] = 0;
      }

      const amount = parseFloat(tx.amount);
      if (tx.type === 'deposit' || tx.type === 'contribution') {
        balanceByDate[tx.date][currency] += amount;
      } else if (tx.type === 'withdrawal' || tx.type === 'transfer') {
        balanceByDate[tx.date][currency] -= amount;
      }
    });

    // Format for chart
    const chartData = Object.entries(balanceByDate).map(([date, currencies]) => ({
      date,
      ...currencies,
    }));

    res.json({
      success: true,
      data: {
        period,
        chartData,
        currencies: [...new Set(transactions.map(tx => tx.currency))],
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/wallet/network-info
router.get('/network-info', async (req, res) => {
  try {
    const info = await wallet!.getNetworkInfo(); // Non-null assertion
    res.json(info);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/balance/:address?
router.get('/balance/:address?', async (req, res) => {
  try {
    const address = req.params.address || wallet!.address; // Non-null assertion
    const balance = await wallet!.getBalanceEth(address); // Non-null assertion
    res.json({ address, balance });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/balance/celo
router.get('/balance/celo', async (req, res) => {
  try {
    const { user } = req.query;
    const address = user as string || wallet!.address;
    const balance = await wallet!.getBalanceEth(address);
    res.json({ address, balance, symbol: 'CELO' });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/balance/cusd
router.get('/balance/cusd', async (req, res) => {
  try {
    const { user } = req.query;
    const address = user as string || wallet!.address;
    // Get cUSD token address for Celo network
    const CUSD_TOKEN_ADDRESS = '0x765DE816845861e75A25fCA122bb6898B8B1282a'; // Celo mainnet cUSD
    const balance = await wallet!.getBalance();
    res.json({ address, balance, symbol: 'cUSD' });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/token-info/:tokenAddress
router.get('/token-info/:tokenAddress', async (req, res) => {
  try {
    const info = await wallet!.getTokenInfo(req.params.tokenAddress); // Non-null assertion
    res.json(info);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet/send-native
router.post('/send-native', async (req, res) => {
  try {
    const { toAddress, amount, userId } = req.body;

    // Check KYC limits
    if (userId) {
      const { kycService } = await import('../services/kycService');
      const limitCheck = await kycService.checkTransactionLimit(userId, parseFloat(amount), 'CELO');
      if (!limitCheck.allowed) {
        return res.status(403).json({ error: limitCheck.reason });
      }
    }

    const result = await wallet!.sendNativeToken(toAddress, amount); // Non-null assertion

    // Create notification for successful transaction
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

    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet/send-token
router.post('/send-token', async (req, res) => {
  try {
    const { tokenAddress, toAddress, amount, userId } = req.body;
    const result = await wallet!.sendTokenHuman(tokenAddress, toAddress, amount); // Non-null assertion

    // Create notification for successful token transaction
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

    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet/send-to-address - Direct wallet address transfer
router.post('/send-to-address', async (req, res) => {
  try {
    const { fromUserId, toAddress, amount, currency, description } = req.body;

    // Validate address format
    if (!WalletManager.validateAddress(toAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    // Send transaction
    const result = currency === 'CELO' 
      ? await wallet!.sendNativeToken(toAddress, amount)
      : await wallet!.sendTokenHuman(currency, toAddress, amount);

    // Record transaction
    await db.insert(walletTransactions).values({
      fromUserId,
      toUserId: null, // External address
      walletAddress: toAddress,
      amount,
      currency,
      type: 'transfer',
      status: 'completed',
      transactionHash: result.hash,
      description: description || `Transfer to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`
    });

    // Notification
    if (fromUserId && result.hash) {
      await notificationService.createNotification({
        userId: fromUserId,
        type: 'transaction',
        title: 'Transfer Successful',
        message: `Sent ${amount} ${currency} to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`,
        metadata: {
          transactionHash: result.hash,
          amount,
          currency,
          toAddress
        }
      });
    }

    res.json({ success: true, txHash: result.hash, message: 'Transfer successful' });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet/approve-token
router.post('/approve-token', async (req, res) => {
  try {
    const { tokenAddress, spender, amount } = req.body;
    const result = await wallet!.approveToken(tokenAddress, spender, amount); // Non-null assertion
    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/allowance/:tokenAddress/:spender
router.get('/allowance/:tokenAddress/:spender', async (req, res) => {
  try {
    const { tokenAddress, spender } = req.params;
    const allowance = await wallet!.getAllowance(tokenAddress, spender); // Non-null assertion
    res.json({ tokenAddress, spender, allowance });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});


// POST /api/wallet/portfolio (enhanced)
router.post('/portfolio', async (req, res) => {
  try {
    if (!wallet) {
      return res.status(503).json({ error: 'Wallet service not available' });
    }
    const { tokenAddresses } = req.body;
    const addresses = Array.isArray(tokenAddresses) ? tokenAddresses as string[] : [];
    const portfolio = await wallet.getEnhancedPortfolio(addresses);
    res.json(portfolio);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet/batch-transfer
router.post('/batch-transfer', async (req, res) => {
  try {
    const { transfers } = req.body;
    const results = await wallet!.batchTransfer(transfers); // Non-null assertion
    res.json(results);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/analytics/tx-history
router.get('/analytics/tx-history', async (req, res) => {
  try {
    const { limit } = req.query;
    const txs = await wallet!.getTransactionHistory(Number(limit) || 10); // Non-null assertion
    res.json(txs);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/tx-status/:txHash
router.get('/tx-status/:txHash', async (req, res) => {
  try {
    const status = await wallet!.getTransactionStatus(req.params.txHash); // Non-null assertion
    res.json(status);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// === SAVINGS ACCOUNT ENDPOINTS (New Unified API) ===

// GET /api/wallet/savings - Get all savings accounts for user
router.get('/savings', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const savingsAccounts = await db
      .select()
      .from(lockedSavings)
      .where(eq(lockedSavings.userId, userId))
      .orderBy(desc(lockedSavings.createdAt));

    // Calculate current values and interest
    const enrichedSavings = savingsAccounts.map(saving => {
      const now = new Date();
      const unlocksAt = new Date(saving.unlocksAt);
      const isMatured = now >= unlocksAt;
      const daysRemaining = Math.max(0, Math.ceil((unlocksAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Calculate earned interest based on time elapsed
      const lockedAt = new Date(saving.lockedAt);
      const daysElapsed = Math.floor((now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60 * 24));
      const dailyRate = parseFloat(saving.interestRate) / 365;
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

    res.json({ savings: enrichedSavings });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    Logger.getLogger().error('Failed to fetch savings accounts:', err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet/savings/create - Create new savings account
router.post('/savings/create', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amount, lockPeriodDays } = req.body;
    
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!lockPeriodDays || lockPeriodDays < 30) {
      return res.status(400).json({ error: 'Lock period must be at least 30 days' });
    }

    // Calculate interest rate based on lock period
    let interestRate = '0.08'; // 8% for 30 days
    if (lockPeriodDays >= 365) interestRate = '0.15'; // 15% for 1 year
    else if (lockPeriodDays >= 180) interestRate = '0.12'; // 12% for 6 months
    else if (lockPeriodDays >= 90) interestRate = '0.10'; // 10% for 3 months

    // Get or create default vault for user
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
    unlocksAt.setDate(unlocksAt.getDate() + Number(lockPeriodDays));

    const [lockedSaving] = await db.insert(lockedSavings).values({
      userId,
      vaultId: vault.id,
      amount: amount.toString(),
      currency: 'cUSD',
      lockPeriod: Number(lockPeriodDays),
      interestRate,
      unlocksAt,
      status: 'locked'
    }).returning();

    res.json(lockedSaving);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    Logger.getLogger().error('Failed to create savings account:', err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet/savings/withdraw/:id - Withdraw from savings account
router.post('/savings/withdraw/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
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
      return res.status(404).json({ error: 'Savings account not found' });
    }

    if (saving.status === 'withdrawn') {
      return res.status(400).json({ error: 'Already withdrawn' });
    }

    const now = new Date();
    const unlocksAt = new Date(saving.unlocksAt);
    const isMatured = now >= unlocksAt;

    let penalty = 0;
    if (force && !isMatured) {
      // 10% penalty for early withdrawal
      penalty = parseFloat(saving.amount) * 0.1;
    }

    // Calculate final amount with interest
    const lockedAt = new Date(saving.lockedAt);
    const daysElapsed = Math.floor((now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60 * 24));
    const dailyRate = parseFloat(saving.interestRate) / 365;
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
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    Logger.getLogger().error('Failed to withdraw savings:', err);
    res.status(500).json({ error: errorMsg });
  }
});

// === LEGACY LOCKED SAVINGS ENDPOINTS (Deprecated - use /savings instead) ===

// POST /api/wallet/locked-savings/create
router.post('/locked-savings/create', async (req, res) => {
  try {
    const { userId, amount, currency, lockPeriod, interestRate } = req.body;
    
    // Get or create default vault
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
        currency: currency || 'cUSD',
        vaultType: 'savings',
        isActive: true
      }).returning();
      vault = newVault;
    }

    const unlocksAt = new Date();
    unlocksAt.setDate(unlocksAt.getDate() + Number(lockPeriod));
    
    const [lockedSaving] = await db.insert(lockedSavings).values({
      userId,
      vaultId: vault.id,
      amount,
      currency: currency || 'cUSD',
      lockPeriod: Number(lockPeriod),
      interestRate: interestRate || '0.05',
      unlocksAt,
      status: 'locked'
    }).returning();
    
    res.json(lockedSaving);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/locked-savings/:userId
router.get('/locked-savings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const savings = await db
      .select()
      .from(lockedSavings)
      .where(eq(lockedSavings.userId, userId))
      .orderBy(desc(lockedSavings.createdAt));
    res.json(savings);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet/locked-savings/withdraw/:id
router.post('/locked-savings/withdraw/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isEarlyWithdrawal } = req.body;
    // Get the locked saving
    const saving = await db
      .select()
      .from(lockedSavings)
      .where(eq(lockedSavings.id, id))
      .limit(1);
    if (!saving.length) {
      return res.status(404).json({ error: 'Locked saving not found' });
    }
    const lockSaving = saving[0];
    const now = new Date();
    const isUnlocked = now >= new Date(lockSaving.unlocksAt);
    let penalty = 0;
    if (isEarlyWithdrawal && !isUnlocked) {
      // Apply 10% penalty for early withdrawal
      penalty = parseFloat(lockSaving.amount) * 0.1;
    }
    const withdrawalAmount = parseFloat(lockSaving.amount) - penalty;
    // Update status
    await db
      .update(lockedSavings)
      .set({ 
        status: 'withdrawn',
        penalty: penalty.toString(),
        updatedAt: new Date()
      })
      .where(eq(lockedSavings.id, id));
    res.json({ 
      withdrawalAmount, 
      penalty, 
      isEarlyWithdrawal: isEarlyWithdrawal && !isUnlocked 
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// === SAVINGS GOALS ENDPOINTS ===

// POST /api/wallet/savings-goals/create
router.post('/savings-goals/create', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title, description, targetAmount, targetDate, category, currency } = req.body;
    
    if (!title || !targetAmount || parseFloat(targetAmount) <= 0) {
      return res.status(400).json({ error: 'Invalid goal parameters' });
    }

    const [goal] = await db.insert(savingsGoals).values({
      userId,
      title,
      description,
      targetAmount: targetAmount.toString(),
      targetDate: targetDate ? new Date(targetDate) : null,
      category: category || 'general',
      currency: currency || 'cUSD',
      currentAmount: '0'
    }).returning();
    
    res.json(goal);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    Logger.getLogger().error('Failed to create savings goal:', err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/savings-goals/:userId
router.get('/savings-goals/:userId', async (req, res) => {
  try {
    const userId = req.user?.id || req.params.userId;
    
    const goals = await db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.userId, userId))
      .orderBy(desc(savingsGoals.createdAt));
    
    res.json(goals);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    Logger.getLogger().error('Failed to fetch savings goals:', err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet/savings-goals/:id/contribute
router.post('/savings-goals/:id/contribute', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    // Get current goal
    const goal = await db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.id, id))
      .limit(1);
    if (!goal.length) {
      return res.status(404).json({ error: 'Savings goal not found' });
    }
    const currentGoal = goal[0];
    const newAmount = parseFloat(currentGoal.currentAmount ?? '0') + parseFloat(amount);
    const isCompleted = newAmount >= parseFloat(currentGoal.targetAmount);
    await db
      .update(savingsGoals)
      .set({ 
        currentAmount: newAmount.toString(),
        isCompleted,
        updatedAt: new Date()
      })
      .where(eq(savingsGoals.id, id));
    res.json({ newAmount, isCompleted });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// === CONTRIBUTION TRACKING WITH WALLET TRANSACTIONS ===

// POST /api/wallet/contribute
router.post('/contribute', async (req, res) => {
  try {
    const { userId, daoId, proposalId, amount, currency, transactionHash, purpose, isAnonymous = false } = req.body;

    // Create contribution record
    const contribution = await db.insert(contributions).values({
      userId,
      daoId,
      proposalId,
      amount,
      currency: currency || 'cUSD',
      purpose: purpose || 'general',
      isAnonymous,
      transactionHash,
      vault: true // Link to vault system
    }).returning();

    // Create corresponding wallet transaction
    if (transactionHash) {
      await db.insert(walletTransactions).values({
        walletAddress: userId, // Use userId as wallet address for now
        amount,
        currency: currency || 'cUSD',
        type: 'contribution',
        status: 'completed',
        transactionHash,
        description: `Contribution to DAO ${daoId}${proposalId ? ` for proposal ${proposalId}` : ''}`
      });
    }

    // Send real-time notification
    if (userId) {
      await notificationService.createNotification({
        userId,
        type: 'contribution',
        title: 'Contribution Recorded',
        message: `Successfully contributed ${amount} ${currency} to ${isAnonymous ? 'DAO' : `DAO ${daoId}`}`,
        metadata: {
          contributionId: contribution[0].id,
          amount,
          currency,
          daoId,
          proposalId,
          transactionHash
        }
      });
    }

    res.json({
      success: true,
      contribution: contribution[0],
      message: 'Contribution successfully tracked and linked to wallet transaction'
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/contributions/:userId
router.get('/contributions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { daoId, timeframe = '30' } = req.query;

    // Build where conditions
    const conditions = [eq(contributions.userId, userId)];
    if (daoId) {
      conditions.push(eq(contributions.daoId, daoId as string));
    }

    // Date filter
    const dateFilter = new Date();
    dateFilter.setDate(dateFilter.getDate() - parseInt(timeframe as string));

    const userContributions = await db
      .select()
      .from(contributions)
      .where(and(...conditions))
      .orderBy(desc(contributions.createdAt));

    // Calculate contribution analytics
    const totalContributed = userContributions.reduce((sum, contrib) => 
      sum + parseFloat(contrib.amount), 0
    );

    const contributionsByDAO = userContributions.reduce((acc, contrib) => {
      const daoId = contrib.daoId;
      if (!acc[daoId]) acc[daoId] = { count: 0, total: 0 };
      acc[daoId].count++;
      acc[daoId].total += parseFloat(contrib.amount);
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    res.json({
      contributions: userContributions,
      analytics: {
        totalContributed,
        contributionCount: userContributions.length,
        contributionsByDAO,
        averageContribution: userContributions.length > 0 ? totalContributed / userContributions.length : 0
      }
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// === ENHANCED TRANSACTION HISTORY ===

// GET /api/wallet/transactions
router.get('/transactions', async (req, res) => {
  try {
    const { 
      userId, 
      walletAddress, 
      type, 
      status, 
      currency, 
      search, 
      dateRange = '30',
      page = '1',
      limit = '10'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build where conditions
    const conditions = [];
    if (userId) {
      conditions.push(or(eq(walletTransactions.fromUserId, userId as string), eq(walletTransactions.toUserId, userId as string)));
    }
    if (walletAddress) {
      conditions.push(eq(walletTransactions.walletAddress, walletAddress as string));
    }
    if (type) {
      conditions.push(eq(walletTransactions.type, type as string));
    }
    if (status) {
      conditions.push(eq(walletTransactions.status, status as string));
    }
    if (currency) {
      conditions.push(eq(walletTransactions.currency, currency as string));
    }

    // Date range filter
    const dateFilter = new Date();
    dateFilter.setDate(dateFilter.getDate() - parseInt(dateRange as string));

    let whereClause = undefined;
    if (conditions.length > 0) {
      whereClause = and(...conditions);
    }

    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(whereClause)
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limitNum)
      .offset(offset);

    // If search is provided, filter in memory (for simple implementation)
    let filteredTransactions = transactions;
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      filteredTransactions = transactions.filter(tx => 
        tx.description?.toLowerCase().includes(searchTerm) ||
        tx.transactionHash?.toLowerCase().includes(searchTerm) ||
        tx.type?.toLowerCase().includes(searchTerm)
      );
    }

    res.json({
      transactions: filteredTransactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredTransactions.length
      }
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// === PAYMENT LINKS ===

// POST /api/wallet/payment-links
router.post('/payment-links', async (req, res) => {
  try {
    const { userId, amount, currency, description, expiresInHours } = req.body;

    const linkId = `pl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (expiresInHours || 24));

    // Get user wallet address
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const paymentLink = {
      id: linkId,
      userId,
      walletAddress: user[0].walletAddress,
      amount,
      currency,
      description,
      expiresAt,
      url: `${process.env.APP_URL}/pay/${linkId}`,
      isActive: true,
      createdAt: new Date()
    };

    // Store in payment requests table
    await db.insert(paymentRequests).values({
      fromUserId: userId,
      toAddress: user[0].walletAddress || '',
      amount,
      currency,
      description,
      expiresAt,
      metadata: { linkId, isPaymentLink: true }
    });

    res.json(paymentLink);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});



// === BILL SPLITTING ===

// POST /api/wallet/split-bill
router.post('/split-bill', async (req, res) => {
  try {
    const { creatorId, totalAmount, currency, description, participants, splitType } = req.body;
    // splitType: 'equal' | 'custom' | 'percentage'

    const billId = `bill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let splits: any[] = [];

    if (splitType === 'equal') {
      const amountPerPerson = parseFloat(totalAmount) / participants.length;
      splits = participants.map((p: any) => ({
        userId: p.userId,
        amount: amountPerPerson.toFixed(2),
        paid: p.userId === creatorId
      }));
    } else if (splitType === 'custom') {
      splits = participants.map((p: any) => ({
        userId: p.userId,
        amount: p.amount,
        paid: p.userId === creatorId
      }));
    } else if (splitType === 'percentage') {
      splits = participants.map((p: any) => ({
        userId: p.userId,
        amount: (parseFloat(totalAmount) * (p.percentage / 100)).toFixed(2),
        paid: p.userId === creatorId
      }));
    }

    // Create payment requests for each participant (except creator)
    for (const split of splits) {
      if (split.userId !== creatorId) {
        await db.insert(paymentRequests).values({
          fromUserId: creatorId,
          toUserId: split.userId,
          amount: split.amount,
          currency,
          description: `${description} - Your share`,
          metadata: { billId, splitType, totalAmount }
        });

        // Send notification
        await notificationService.createNotification({
          userId: split.userId,
          type: 'payment_request',
          title: 'Bill Split Request',
          message: `${description} - You owe ${split.amount} ${currency}`,
          metadata: { billId, amount: split.amount, currency }
        });
      }
    }

    res.json({
      billId,
      totalAmount,
      currency,
      description,
      splits,
      message: 'Bill split created successfully'
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/split-bills/:userId
router.get('/split-bills/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const bills = await db.select()
      .from(paymentRequests)
      .where(
        or(
          eq(paymentRequests.fromUserId, userId),
          eq(paymentRequests.toUserId, userId)
        )
      )
      .orderBy(desc(paymentRequests.createdAt));

    const splitBills = bills.filter(b => b.metadata && (b.metadata as any).billId);

    res.json(splitBills);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/payment-links/:linkId
router.get('/payment-links/:linkId', async (req, res) => {
  try {
    const { linkId } = req.params;

    const link = await db.select()
      .from(paymentRequests)
      .where(sql`metadata->>'linkId' = ${linkId}`)
      .limit(1);

    if (!link.length) {
      return res.status(404).json({ error: 'Payment link not found' });
    }

    const paymentLink = link[0];

    // Check if expired
    if (paymentLink.expiresAt && new Date() > new Date(paymentLink.expiresAt)) {
      return res.status(410).json({ error: 'Payment link expired' });
    }

    res.json(paymentLink);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// === RECURRING PAYMENTS ===

// GET /api/wallet/recurring-payments
router.get('/recurring-payments', async (req, res) => {
  try {
    const { walletAddress } = req.query;

    // For demo, return mock data. In production, query from database
    const recurringPayments = [
      {
        id: '1',
        title: 'Monthly DAO Contribution',
        description: 'Regular contribution to community vault',
        amount: '50.00',
        currency: 'cUSD',
        toAddress: '0x742d35Cc6634C0532925a3b8D421C63F10bFe2D0',
        frequency: 'monthly',
        nextPayment: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        createdAt: new Date().toISOString(),
        lastPayment: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        totalPaid: '200.00',
        paymentCount: 4
      }
    ];

    res.json({ payments: recurringPayments });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet/recurring-payments
router.post('/recurring-payments', async (req, res) => {
  try {
    const { title, description, amount, currency, toAddress, frequency, walletAddress } = req.body;

    // In production, save to database
    const newPayment = {
      id: Date.now().toString(),
      title,
      description,
      amount,
      currency,
      toAddress,
      frequency,
      walletAddress,
      isActive: true,
      createdAt: new Date().toISOString(),
      nextPayment: calculateNextPayment(frequency),
      totalPaid: '0.00',
      paymentCount: 0
    };

    res.json(newPayment);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// PATCH /api/wallet/recurring-payments/:id/toggle
router.patch('/recurring-payments/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // In production, update in database
    res.json({ success: true, id, isActive });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// DELETE /api/wallet/recurring-payments/:id
router.delete('/recurring-payments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // In production, delete from database
    res.json({ success: true, id });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// === EXCHANGE RATES ===

// GET /api/wallet/exchange-rates
router.get('/exchange-rates', async (req, res) => {
  try {
    // In production, fetch from external APIs like CoinGecko, CoinMarketCap, etc.
    const mockRates = {
      'CELO-USD': { pair: 'CELO-USD', rate: 0.65, change24h: 2.5, lastUpdated: new Date().toISOString() },
      'cUSD-USD': { pair: 'cUSD-USD', rate: 1.0, change24h: 0.1, lastUpdated: new Date().toISOString() },
      'cEUR-EUR': { pair: 'cEUR-EUR', rate: 1.0, change24h: -0.05, lastUpdated: new Date().toISOString() },
      'USD-KES': { pair: 'USD-KES', rate: 150.25, change24h: 1.2, lastUpdated: new Date().toISOString() },
      'USD-NGN': { pair: 'USD-NGN', rate: 825.50, change24h: -0.8, lastUpdated: new Date().toISOString() },
      'USD-GHS': { pair: 'USD-GHS', rate: 12.85, change24h: 0.5, lastUpdated: new Date().toISOString() }
    };

    res.json({ rates: mockRates });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// === ENHANCED MULTISIG ENDPOINTS ===

// POST /api/wallet/multisig/create
router.post('/multisig/create', requireRole('admin', 'elder'), async (req, res) => {
  try {
    const { owners, threshold } = req.body;

    // In production, deploy multisig contract
    const mockMultisig = {
      address: '0x' + Math.random().toString(16).substr(2, 40),
      owners,
      threshold,
      transactionCount: 0
    };

    res.json(mockMultisig);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/multisig/:address/transactions
router.get('/multisig/:address/transactions', requireRole('admin', 'elder'), async (req, res) => {
  try {
    const { address } = req.params;
    const { pending } = req.query;

    // In production, fetch from blockchain
  const mockTransactions: any[] = [];

    res.json({ transactions: mockTransactions });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// Helper function
function calculateNextPayment(frequency: string): string {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
    case 'yearly':
      now.setFullYear(now.getFullYear() + 1);
      break;
  }
  return now.toISOString();
}

// === PAYMENT REQUESTS ===

// POST /api/wallet/payment-requests
router.post('/payment-requests', async (req, res) => {
  try {
    const { toAddress, toUserId, amount, currency, description, qrCode, celoUri, expiresAt, recipientEmail } = req.body;

    const request = await db.insert(paymentRequests).values({
      fromUserId: req.user?.id || 'anonymous',
      toUserId,
      toAddress,
      amount,
      currency,
      description,
      qrCode,
      celoUri,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      metadata: { recipientEmail }
    }).returning();

    res.json(request[0]);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/payment-requests/:id
router.get('/payment-requests/:id', async (req, res) => {
  try {
    const request = await db.query.paymentRequests.findFirst({
      where: eq(paymentRequests.id, req.params.id)
    });

    if (!request) {
      return res.status(404).json({ error: 'Payment request not found' });
    }

    res.json(request);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet/payment-requests/:id/pay
router.post('/payment-requests/:id/pay', async (req, res) => {
  try {
    const { transactionHash } = req.body;

    const request = await db.query.paymentRequests.findFirst({
      where: eq(paymentRequests.id, req.params.id)
    });

    if (!request) {
      return res.status(404).json({ error: 'Payment request not found' });
    }

    if (request.status === 'paid') {
      return res.status(400).json({ error: 'Payment request already paid' });
    }

    await db.update(paymentRequests)
      .set({
        status: 'paid',
        paidAt: new Date(),
        transactionHash,
        updatedAt: new Date()
      })
      .where(eq(paymentRequests.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// === PAYMENT RECEIPTS ===

// POST /api/wallet/receipts/generate
router.post('/receipts/generate', async (req, res) => {
  try {
    const { transactionId, paymentRequestId } = req.body;

    // Generate unique receipt number
    const receiptNumber = `MTAA-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Get transaction details
    let transaction;
    if (transactionId) {
      transaction = await db.query.walletTransactions.findFirst({
        where: eq(walletTransactions.id, transactionId)
      });
    }

    // Create receipt record
    const receipt = await db.insert(paymentReceipts).values({
      transactionId,
      paymentRequestId,
      receiptNumber,
      metadata: { transaction }
    }).returning();

    res.json({
      ...receipt[0],
      downloadUrl: `/api/wallet/receipts/${receipt[0].id}/download`
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/receipts/:id/download
router.get('/receipts/:id/download', async (req, res) => {
  try {
    const receipt = await db.query.paymentReceipts.findFirst({
      where: eq(paymentReceipts.id, req.params.id)
    });

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // Generate PDF (placeholder - implement with pdfkit or similar)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${receipt.receiptNumber}.pdf`);

    // TODO: Implement actual PDF generation
    res.send('PDF generation coming soon');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

export default router;