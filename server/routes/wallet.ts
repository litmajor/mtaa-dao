import express from 'express';

import EnhancedAgentWallet, { NetworkConfig, WalletManager } from '../agent_wallet';

import { db } from '../storage';
import { walletTransactions } from '../../shared/schema';
import { desc, eq, or } from 'drizzle-orm';

// You may want to load these from env/config in production

const PRIVATE_KEY = 'YOUR_PRIVATE_KEY';
const NETWORK = NetworkConfig.CELO_ALFAJORES;
// Mock price oracle for demonstration
const mockPriceOracle = async (tokenAddress: string): Promise<number> => {
  const prices: Record<string, number> = {
    'native': 2500, // ETH price
    '0x...': 1.0 // USDC price
  };
  return prices[tokenAddress] || 0;
};

const wallet = new EnhancedAgentWallet(
  PRIVATE_KEY,
  NETWORK,
  undefined, // permissionCheck
  undefined, // contributionLogger
  undefined, // billingLogger
  mockPriceOracle
);

// RiskManager instance (demo: limits hardcoded)
import { RiskManager, TransactionAnalytics } from '../agent_wallet';
const riskManager = new RiskManager(wallet, 10000, 5000);
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
    const info = await wallet.getMultisigInfo(multisigAddress);
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
    const result = await wallet.submitMultisigTransaction(multisigAddress, destination, value, data);
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
    const info = await wallet.getNetworkInfo();
    res.json(info);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/balance/:address?
router.get('/balance/:address?', async (req, res) => {
  try {
    const address = req.params.address || wallet.address;
    const balance = await wallet.getBalanceEth(address);
    res.json({ address, balance });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/token-info/:tokenAddress
router.get('/token-info/:tokenAddress', async (req, res) => {
  try {
    const info = await wallet.getTokenInfo(req.params.tokenAddress);
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
    const result = await wallet.sendNativeToken(toAddress, amount);
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
    const result = await wallet.sendTokenHuman(tokenAddress, toAddress, amount);
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
    const result = await wallet.approveToken(tokenAddress, spender, amount);
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
    const allowance = await wallet.getAllowance(tokenAddress, spender);
    res.json({ tokenAddress, spender, allowance });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});


// POST /api/wallet/portfolio (enhanced)
router.post('/portfolio', async (req, res) => {
  try {
    const { tokenAddresses } = req.body;
    const portfolio = await wallet.getEnhancedPortfolio(tokenAddresses);
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
    const results = await wallet.batchTransfer(transfers);
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
    const txs = await wallet.getTransactionHistory(Number(limit) || 10);
    res.json(txs);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet/tx-status/:txHash
router.get('/tx-status/:txHash', async (req, res) => {
  try {
    const status = await wallet.getTransactionStatus(req.params.txHash);
    res.json(status);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

export default router;
