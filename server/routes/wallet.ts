import express from 'express';

import EnhancedAgentWallet, { NetworkConfig, WalletManager } from '../agent_wallet';

import { db } from '../storage';
import { walletTransactions } from '../../shared/schema';
import { desc, eq, or } from 'drizzle-orm';
import { fileURLToPath } from "url";
import { dirname } from "path";

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
    const { toAddress, amount } = req.body;
    const result = await wallet!.sendNativeToken(toAddress, amount); // Non-null assertion
    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet/send-token
router.post('/send-token', async (req, res) => {
  try {
    const { tokenAddress, toAddress, amount } = req.body;
    const result = await wallet!.sendTokenHuman(tokenAddress, toAddress, amount); // Non-null assertion
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
    unlocksAt.setDate(unlocksAt.getDate() + lockPeriod);
    
    const lockedSaving = await db.insert(lockedSavings).values({
      userId,
      amount,
      currency: currency || 'KES',
      lockPeriod,
      interestRate: interestRate || '0.05',
      unlocksAt,
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
    const newAmount = parseFloat(currentGoal.currentAmount) + parseFloat(amount);
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

export default router;