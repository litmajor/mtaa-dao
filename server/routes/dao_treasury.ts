import express, { Request, Response } from 'express';
import EnhancedAgentWallet, { NetworkConfig, DaoTreasuryManager } from '../agent_wallet';
import { isAuthenticated } from '../nextAuthMiddleware';
import { storage } from '../storage';

const router = express.Router();

// --- DAO Treasury: Monitor Treasury Balances ---
router.get('/:daoId/balance', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: 'DAO or treasury wallet not found' });
    }
    const config = NetworkConfig.CELO_ALFAJORES; // TODO: Make dynamic
    // Mock price oracle for demonstration
    const mockPriceOracle = async (tokenAddress: string): Promise<number> => {
      const prices: Record<string, number> = {
        'native': 2500, // ETH price
        '0x...': 1.0 // USDC price
      };
      return prices[tokenAddress] || 0;
    };
    const wallet = new EnhancedAgentWallet(
      dao.treasuryPrivateKey,
      config,
      undefined,
      undefined,
      undefined,
      mockPriceOracle
    );
    // Use DaoTreasuryManager for advanced snapshot
    const treasuryManager = new DaoTreasuryManager(wallet, dao.treasuryAddress, dao.allowedTokens || []);
    const snapshot = await treasuryManager.getTreasurySnapshot();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// --- DAO Treasury: Transfer Native Token ---
router.post('/:daoId/transfer/native', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { toAddress, amount } = req.body;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: 'DAO or treasury wallet not found' });
    }
    const config = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle = async (tokenAddress: string): Promise<number> => {
      const prices: Record<string, number> = {
        'native': 2500,
        '0x...': 1.0
      };
      return prices[tokenAddress] || 0;
    };
    const wallet = new EnhancedAgentWallet(
      dao.treasuryPrivateKey,
      config,
      undefined,
      undefined,
      undefined,
      mockPriceOracle
    );
    const tx = await wallet.sendNativeToken(toAddress, amount);
    res.json({ tx });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// --- DAO Treasury: Transfer ERC-20 Token ---
router.post('/:daoId/transfer/token', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { tokenAddress, toAddress, amount } = req.body;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: 'DAO or treasury wallet not found' });
    }
    const config = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle = async (tokenAddress: string): Promise<number> => {
      const prices: Record<string, number> = {
        'native': 2500,
        '0x...': 1.0
      };
      return prices[tokenAddress] || 0;
    };
    const wallet = new EnhancedAgentWallet(
      dao.treasuryPrivateKey,
      config,
      undefined,
      undefined,
      undefined,
      mockPriceOracle
    );
    const tx = await wallet.sendTokenHuman(tokenAddress, toAddress, amount);
    res.json({ tx });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// --- DAO Treasury: Automate Payouts/Grants/Bounties ---
router.post('/:daoId/automation/payout', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { payouts } = req.body; // [{ toAddress, amount, tokenAddress? }]
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: 'DAO or treasury wallet not found' });
    }
    const config = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle = async (tokenAddress: string): Promise<number> => {
      const prices: Record<string, number> = {
        'native': 2500,
        '0x...': 1.0
      };
      return prices[tokenAddress] || 0;
    };
    const wallet = new EnhancedAgentWallet(
      dao.treasuryPrivateKey,
      config,
      undefined,
      undefined,
      undefined,
      mockPriceOracle
    );
    // Use batchTransfer for payouts
    const results = await wallet.batchTransfer(payouts);
    res.json({ results });

// --- DAO Treasury: Advanced Snapshot & Report ---
router.get('/:daoId/snapshot', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: 'DAO or treasury wallet not found' });
    }
    const config = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle = async (tokenAddress: string): Promise<number> => {
      const prices: Record<string, number> = {
        'native': 2500,
        '0x...': 1.0
      };
      return prices[tokenAddress] || 0;
    };
    const wallet = new EnhancedAgentWallet(
      dao.treasuryPrivateKey,
      config,
      undefined,
      undefined,
      undefined,
      mockPriceOracle
    );
    const treasuryManager = new DaoTreasuryManager(wallet, dao.treasuryAddress, dao.allowedTokens || []);
    const snapshot = await treasuryManager.getTreasurySnapshot();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// --- DAO Treasury: Generate Report ---
router.get('/:daoId/report', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { period } = req.query;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: 'DAO or treasury wallet not found' });
    }
    const config = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle = async (tokenAddress: string): Promise<number> => {
      const prices: Record<string, number> = {
        'native': 2500,
        '0x...': 1.0
      };
      return prices[tokenAddress] || 0;
    };
    const wallet = new EnhancedAgentWallet(
      dao.treasuryPrivateKey,
      config,
      undefined,
      undefined,
      undefined,
      mockPriceOracle
    );
    const treasuryManager = new DaoTreasuryManager(wallet, dao.treasuryAddress, dao.allowedTokens || []);
    const report = await treasuryManager.generateTreasuryReport((period as any) || 'monthly');
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// --- DAO Treasury: Get Treasury Analytics ---
router.get('/:daoId/analytics', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { period = '30d' } = req.query;
    
    const dao = await storage.getDao(daoId);
    if (!dao) {
      return res.status(404).json({ message: 'DAO not found' });
    }

    // Calculate period in days
    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    // Get transaction history
    // Query walletTransactions for this DAO
    const { db } = require('../storage');
    const { walletTransactions } = require('../../shared/schema');
    const { eq, desc, and } = require('drizzle-orm');
    const transactions = await db.select().from(walletTransactions)
      .where(eq(walletTransactions.daoId, daoId))
      .where(desc(walletTransactions.createdAt))
      .where(and(
        eq(walletTransactions.daoId, daoId),
        walletTransactions.createdAt >= startDate
      ));
    
    // Calculate metrics
    const totalInflow = transactions
      .filter((tx: any) => tx.type === 'deposit' || tx.type === 'contribution')
      .reduce((sum: number, tx: any) => sum + parseFloat(tx.amount), 0);
    
    const totalOutflow = transactions
      .filter((tx: any) => tx.type === 'withdrawal' || tx.type === 'disbursement')
      .reduce((sum: number, tx: any) => sum + parseFloat(tx.amount), 0);

    const netFlow = totalInflow - totalOutflow;
    const currentBalance = parseFloat(dao.treasuryBalance || '0');

    // Transaction volume by day
    const dailyVolume = transactions.reduce((acc: any, tx: any) => {
      const date = new Date(tx.createdAt).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = { inflow: 0, outflow: 0 };
      
      const amount = parseFloat(tx.amount);
      if (tx.type === 'deposit' || tx.type === 'contribution') {
        acc[date].inflow += amount;
      } else {
        acc[date].outflow += amount;
      }
      return acc;
    }, {});

    res.json({
      success: true,
      analytics: {
        currentBalance,
        totalInflow,
        totalOutflow,
        netFlow,
        transactionCount: transactions.length,
        averageTransactionSize: transactions.length > 0 ? (totalInflow + totalOutflow) / transactions.length : 0,
        dailyVolume,
        period: `${periodDays}d`
      }
    });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// --- DAO Treasury: Set Treasury Limits ---
router.post('/:daoId/limits', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { dailyLimit, transactionLimit, approvalThreshold } = req.body;
    
    const dao = await storage.getDao(daoId);
    if (!dao) {
      return res.status(404).json({ message: 'DAO not found' });
    }

    // Update DAO with treasury limits
    // Directly update the DAO record
    const { db } = require('../storage');
    const { daos } = require('../../shared/schema');
    const { eq } = require('drizzle-orm');
    await db.update(daos)
      .set({
        treasuryLimits: {
          dailyLimit: dailyLimit || 1000,
          transactionLimit: transactionLimit || 500,
          approvalThreshold: approvalThreshold || 1000
        },
        updatedAt: new Date()
      })
      .where(eq(daos.id, daoId));

    res.json({
      success: true,
      message: 'Treasury limits updated successfully'
    });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
