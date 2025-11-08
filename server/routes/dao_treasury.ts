import express, { Request, Response } from 'express';
import { db } from '../db';
import { config, walletTransactions } from '../../shared/schema';
import { sql, eq, and } from 'drizzle-orm';
import EnhancedAgentWallet, { NetworkConfig, DaoTreasuryManager } from '../agent_wallet';
import { isAuthenticated } from '../nextAuthMiddleware';
import { storage } from '../storage';
import { treasuryMultisigService } from '../services/treasuryMultisigService';
import { db } from '../db';
import { treasuryMultisigTransactions, treasuryBudgetAllocations, treasuryAuditLog } from '../../shared/schema';
import { eq, desc, and } from 'drizzle-orm';

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
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

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

// POST /api/dao-treasury/revenue-distribution - Configure automated revenue distribution
router.post('/revenue-distribution', async (req, res) => {
  try {
    const { daoId, distributions } = req.body;

    // Validate distributions array
    if (!Array.isArray(distributions)) {
      return res.status(400).json({ error: 'Distributions must be an array' });
    }

    // Ensure percentages add up to 100
    const totalPercentage = distributions.reduce((sum, d) => sum + d.percentage, 0);
    if (totalPercentage !== 100) {
      return res.status(400).json({ error: 'Distribution percentages must total 100%' });
    }

    // Store in config table
    await db.insert(config).values({
      key: `revenue_distribution_${daoId}`,
      value: distributions,
    }).onConflictDoUpdate({
      target: config.key,
      set: { value: distributions, updatedAt: new Date() },
    });

    res.json({
      success: true,
      message: 'Revenue distribution configured',
      distributions,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dao-treasury/revenue-distribution/:daoId - Get revenue distribution config
router.get('/revenue-distribution/:daoId', async (req, res) => {
  try {
    const { daoId } = req.params;

    const result = await db
      .select()
      .from(config)
      .where(eq(config.key, `revenue_distribution_${daoId}`))
      .limit(1);

    if (!result.length) {
      return res.json({
        success: true,
        data: {
          distributions: [],
          configured: false,
        },
      });
    }

    res.json({
      success: true,
      data: {
        distributions: result[0].value,
        configured: true,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/dao-treasury/budget-allocation - Set budget allocation per project/team
router.post('/budget-allocation', async (req, res) => {
  try {
    const { daoId, allocations } = req.body;

    // Store budget allocations
    await db.insert(config).values({
      key: `budget_allocation_${daoId}`,
      value: allocations,
    }).onConflictDoUpdate({
      target: config.key,
      set: { value: allocations, updatedAt: new Date() },
    });

    res.json({
      success: true,
      message: 'Budget allocation saved',
      allocations,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dao-treasury/budget-allocation/:daoId - Get budget allocation
router.get('/budget-allocation/:daoId', async (req, res) => {
  try {
    const { daoId } = req.params;

    const result = await db
      .select()
      .from(config)
      .where(eq(config.key, `budget_allocation_${daoId}`))
      .limit(1);

    if (!result.length) {
      return res.json({
        success: true,
        data: {
          allocations: [],
          configured: false,
        },
      });
    }

    // Calculate spending vs allocation
    const allocations = result[0].value as any[];
    const enrichedAllocations = await Promise.all(
      allocations.map(async (allocation: any) => {
        const spent = await db
          .select({ total: sql<number>`COALESCE(SUM(CAST(${walletTransactions.amount} AS DECIMAL)), 0)` })
          .from(walletTransactions)
          .where(
            and(
              eq(walletTransactions.daoId, daoId),
              sql`${walletTransactions.description} LIKE ${`%${allocation.category}%`}`
            )
          );

        return {
          ...allocation,
          spent: spent[0]?.total || 0,
          remaining: allocation.budget - (spent[0]?.total || 0),
          utilization: ((spent[0]?.total || 0) / allocation.budget) * 100,
        };
      })
    );

    res.json({
      success: true,
      data: {
        allocations: enrichedAllocations,
        configured: true,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/dao-treasury/yield-farming - Configure treasury yield farming
router.post('/yield-farming', async (req, res) => {
  try {
    const { daoId, strategy, allocation } = req.body;

    // Supported strategies
    const supportedStrategies = ['moola_lending', 'ubeswap_lp', 'celo_staking', 'mento_pool'];
    
    if (!supportedStrategies.includes(strategy)) {
      return res.status(400).json({ error: 'Unsupported yield strategy' });
    }

    // Store yield farming config
    await db.insert(config).values({
      key: `yield_farming_${daoId}`,
      value: { strategy, allocation, enabled: true },
    }).onConflictDoUpdate({
      target: config.key,
      set: { value: { strategy, allocation, enabled: true }, updatedAt: new Date() },
    });

    res.json({
      success: true,
      message: 'Yield farming configured',
      strategy,
      allocation,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dao-treasury/yield-farming/:daoId - Get yield farming status
router.get('/yield-farming/:daoId', async (req, res) => {
  try {
    const { daoId } = req.params;


// --- CRITICAL: Multi-Sig Treasury Operations ---

// POST /api/dao-treasury/:daoId/multisig/propose - Propose withdrawal
router.post('/:daoId/multisig/propose', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { amount, recipient, purpose, currency } = req.body;
    const userId = (req as any).user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const transaction = await treasuryMultisigService.proposeWithdrawal(
      daoId,
      userId,
      parseFloat(amount),
      recipient,
      purpose,
      currency || 'cUSD'
    );

    res.json({
      success: true,
      transaction,
      message: `Withdrawal proposed. Requires ${transaction.requiredSignatures} signatures.`
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/dao-treasury/:daoId/multisig/:txId/sign - Sign transaction
router.post('/:daoId/multisig/:txId/sign', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { txId } = req.params;
    const userId = (req as any).user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await treasuryMultisigService.signTransaction(txId, userId);

    res.json({
      success: true,
      ...result,
      message: result.approved 
        ? 'Transaction approved and ready for execution'
        : `Signature added. ${result.signatures} signatures collected.`
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/dao-treasury/:daoId/multisig/:txId/execute - Execute approved transaction
router.post('/:daoId/multisig/:txId/execute', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { txId } = req.params;
    const userId = (req as any).user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await treasuryMultisigService.executeTransaction(txId, userId);

    res.json({
      success: true,
      ...result,
      message: 'Withdrawal executed successfully'
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/dao-treasury/:daoId/multisig/pending - Get pending transactions
router.get('/:daoId/multisig/pending', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;

    const pending = await db.select().from(treasuryMultisigTransactions)
      .where(and(
        eq(treasuryMultisigTransactions.daoId, daoId),
        eq(treasuryMultisigTransactions.status, 'pending')
      ))
      .orderBy(desc(treasuryMultisigTransactions.createdAt));

    res.json({ success: true, transactions: pending });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Budget Management ---

// GET /api/dao-treasury/:daoId/budget - Get budget allocations
router.get('/:daoId/budget', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;

    const allocations = await db.select().from(treasuryBudgetAllocations)
      .where(and(
        eq(treasuryBudgetAllocations.daoId, daoId),
        eq(treasuryBudgetAllocations.isActive, true)
      ))
      .orderBy(desc(treasuryBudgetAllocations.periodStart));

    res.json({ success: true, allocations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Audit Trail ---

// GET /api/dao-treasury/:daoId/audit - Get audit logs
router.get('/:daoId/audit', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { limit = 100, severity } = req.query;

    let query = db.select().from(treasuryAuditLog)
      .where(eq(treasuryAuditLog.daoId, daoId));

    if (severity) {
      query = query.where(eq(treasuryAuditLog.severity, severity as string));
    }

    const logs = await query
      .orderBy(desc(treasuryAuditLog.timestamp))
      .limit(parseInt(limit as string));

    res.json({ success: true, logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


    const result = await db
      .select()
      .from(config)
      .where(eq(config.key, `yield_farming_${daoId}`))
      .limit(1);

    if (!result.length) {
      return res.json({
        success: true,
        data: {
          enabled: false,
          strategy: null,
          allocation: 0,
          estimatedAPY: 0,
        },
      });
    }

    const farmingConfig = result[0].value as any;

    // Estimated APYs by strategy
    const apyMap: Record<string, number> = {
      moola_lending: 8.5,
      ubeswap_lp: 12.3,
      celo_staking: 6.2,
      mento_pool: 7.8,
    };

    res.json({
      success: true,
      data: {
        ...farmingConfig,
        estimatedAPY: apyMap[farmingConfig.strategy] || 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
