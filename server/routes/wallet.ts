import express from 'express';

import EnhancedAgentWallet, { NetworkConfig, WalletManager } from '../agent_wallet';

import { db } from '../storage';
import { walletTransactions, contributions } from '../../shared/schema';
import { lockedSavings, savingsGoals } from '../../shared/schema';
import { desc, eq, or } from 'drizzle-orm';
import { and } from 'drizzle-orm';
import { fileURLToPath } from "url";
import { dirname } from "path";
import { notificationService } from '../notificationService';

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


// GET /api/wallet/analytics
router.get('/analytics', async (req, res) => {
  try {
    // Optionally filter by userId or walletAddress
    const { userId, walletAddress } = req.query;
    let whereClause = undefined;
    if (typeof userId === 'string') {
      whereClause = or(eq(walletTransactions.fromUserId, userId), eq(walletTransactions.toUserId, userId));
    } else if (typeof walletAddress === 'string') {
      whereClause = eq(walletTransactions.walletAddress, walletAddress);
    }
    const txs = await db
      .select()
      .from(walletTransactions)
      .where(whereClause)
      .orderBy(desc(walletTransactions.createdAt));

    // Portfolio value over time (simple: sum by month)
    const valueOverTime: Record<string, number> = {};
    const tokenBreakdown: Record<string, number> = {};
    let total = 0;
    for (const tx of txs) {
      const month = tx.createdAt ? new Date(tx.createdAt).toISOString().slice(0, 7) : 'unknown';
      const amt = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
      if (!valueOverTime[month]) valueOverTime[month] = 0;
      valueOverTime[month] += amt;
      const currency = tx.currency || 'UNKNOWN';
      if (!tokenBreakdown[currency]) tokenBreakdown[currency] = 0;
      tokenBreakdown[currency] += amt;
      total += amt;
    }

    // Transaction type summary
    const typeSummary: Record<string, number> = {};
    for (const tx of txs) {
      const type = tx.type || 'unknown';
      if (!typeSummary[type]) typeSummary[type] = 0;
      const amt = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
      typeSummary[type] += amt;
    }

    res.json({
      valueOverTime,
      tokenBreakdown,
      typeSummary,
      total,
      txCount: txs.length,
      recent: txs.slice(0, 10),
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
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
    const balance = await wallet!.getTokenBalance(CUSD_TOKEN_ADDRESS, address);
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

// === LOCKED SAVINGS ENDPOINTS ===

// POST /api/wallet/locked-savings/create
router.post('/locked-savings/create', async (req, res) => {
  try {
    const { userId, amount, currency, lockPeriod, interestRate } = req.body;
    // Calculate unlock date
    const unlocksAt = new Date();
    unlocksAt.setDate(unlocksAt.getDate() + Number(lockPeriod));
    const lockedSaving = await db.insert(lockedSavings).values({
      userId,
      amount,
      currency: currency || 'KES',
      lockPeriod: Number(lockPeriod),
      interestRate: interestRate || '0.05',
      unlocksAt,
      vaultId: 'default-vault', // Provide a valid vaultId or get from req.body
    }).returning();
    res.json(lockedSaving[0]);
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
    const { userId, title, description, targetAmount, targetDate, category, currency } = req.body;
    const goal = await db.insert(savingsGoals).values({
      userId,
      title,
      description,
      targetAmount,
      targetDate: targetDate ? new Date(targetDate) : null,
      category: category || 'general',
      currency: currency || 'KES',
    }).returning();
    res.json(goal[0]);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/savings-goals/:userId
router.get('/savings-goals/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const goals = await db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.userId, userId))
      .orderBy(desc(savingsGoals.createdAt));
    res.json(goals);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
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
        fromUserId: userId,
        toUserId: daoId,
        amount,
        currency: currency || 'cUSD',
        type: 'contribution',
        status: 'completed',
        transactionHash,
        description: `Contribution to DAO ${daoId}${proposalId ? ` for proposal ${proposalId}` : ''}`,
        contributionId: contribution[0].id
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

export default router;