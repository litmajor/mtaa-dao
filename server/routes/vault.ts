
import { Router } from 'express';
import { vaultService } from '../services/vaultService';
import { tokenService } from '../services/tokenService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { z } from 'zod';

const router = Router();

// Validation schemas
const depositSchema = z.object({
  amount: z.string(),
  currency: z.string(),
  vaultAddress: z.string(),
});

const withdrawSchema = z.object({
  amount: z.string(),
  currency: z.string(),
  destination: z.string(),
});

const approveSchema = z.object({
  tokenAddress: z.string(),
  spender: z.string(),
  amount: z.string(),
});

// Get vault balance in USD
router.get('/balance-usd', asyncHandler(async (req, res) => {
  const { shares, vault } = req.query;
  
  if (!shares || !vault) {
    return res.status(400).json({ error: 'Missing shares or vault parameter' });
  }

  try {
    // Get current token price and calculate USD value
    const shareValue = await tokenService.getVaultShareValue(vault as string, shares as string);
    
    res.json({ valueUSD: shareValue.toFixed(2) });
  } catch (error) {
    logger.error('Failed to get vault balance USD:', error);
    res.status(500).json({ error: 'Failed to calculate USD value' });
  }
}));

// Deposit to vault
router.post('/deposit', asyncHandler(async (req, res) => {
  const userId = (req.user as any)?.claims?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const validatedData = depositSchema.parse(req.body);
  
  try {
    // Process deposit through vault service
    const result = await vaultService.depositToken({
      vaultId: validatedData.vaultAddress,
      userId,
      tokenSymbol: validatedData.currency as any,
      amount: validatedData.amount,
    });

    res.json({
      success: true,
      transaction: result,
      message: 'Deposit completed successfully'
    });
  } catch (error) {
    logger.error('Deposit failed:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Deposit failed' 
    });
  }
}));

// Withdraw from vault
router.post('/withdraw', asyncHandler(async (req, res) => {
  const userId = (req.user as any)?.claims?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const validatedData = withdrawSchema.parse(req.body);
  
  try {
    // Process withdrawal through vault service
    const result = await vaultService.withdrawToken({
      vaultId: req.body.vaultAddress || 'default-vault',
      userId,
      tokenSymbol: validatedData.currency as any,
      amount: validatedData.amount,
    });

    res.json({
      success: true,
      transaction: result,
      message: 'Withdrawal completed successfully'
    });
  } catch (error) {
    logger.error('Withdrawal failed:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Withdrawal failed' 
    });
  }
}));

// Approve token spending
router.post('/approve', asyncHandler(async (req, res) => {
  const validatedData = approveSchema.parse(req.body);
  
  try {
    // Token approval is handled client-side via wallet interaction
    // This endpoint validates the approval parameters
    res.json({
      success: true,
      message: 'Approval parameters validated. Please confirm in your wallet.'
    });
  } catch (error) {
    logger.error('Approval failed:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Approval failed' 
    });
  }
}));

// Get vault performance data
router.get('/performance', asyncHandler(async (req, res) => {
  const { vault, period } = req.query;
  
  if (!vault) {
    return res.status(400).json({ error: 'Vault address required' });
  }

  try {
    // Get real performance data from vault service
    const performance = await vaultService.getVaultPerformanceHistory(vault as string);
    
    res.json({
      success: true,
      performance,
      period: period || '7d'
    });
  } catch (error) {
    logger.error('Failed to get vault performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
}));

// Get vault transactions
router.get('/transactions', asyncHandler(async (req, res) => {
  const { vault, page = '1' } = req.query;
  const userId = (req.user as any)?.claims?.id;
  
  if (!vault) {
    return res.status(400).json({ error: 'Vault address required' });
  }

  try {
    const transactions = await vaultService.getVaultTransactions(
      vault as string, 
      userId,
      parseInt(page as string)
    );

    res.json({
      success: true,
      data: transactions,
      page: parseInt(page as string),
    });
  } catch (error) {
    logger.error('Failed to get vault transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
}));

// Get vault info
router.get('/info/:vaultAddress', asyncHandler(async (req, res) => {
  const { vaultAddress } = req.params;
  const userId = (req.user as any)?.claims?.id;
  
  try {
    const portfolio = await vaultService.getVaultPortfolio(vaultAddress, userId);
    
    res.json({
      success: true,
      data: portfolio,
    });
  } catch (error) {
    logger.error('Failed to get vault info:', error);
    res.status(500).json({ error: 'Failed to fetch vault information' });
  }
}));

// Get current user's vaults
router.get('/user', asyncHandler(async (req, res) => {
  const userId = (req.user as any)?.claims?.id || (req.user as any)?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const vaults = await vaultService.getUserVaults(userId);
    
    res.json({
      success: true,
      vaults
    });
  } catch (error) {
    logger.error('Failed to get user vaults:', error);
    res.status(500).json({ error: 'Failed to fetch vaults' });
  }
}));

// Get user vault stats
router.get('/stats', asyncHandler(async (req, res) => {
  const userId = (req.user as any)?.claims?.id || (req.user as any)?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const stats = await vaultService.getUserVaultStats(userId);
    
    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    logger.error('Failed to get vault stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
}));

// Get user's vaults (legacy endpoint)
router.get('/user/:address', asyncHandler(async (req, res) => {
  const { address } = req.params;
  
  try {
    const userVaults = await vaultService.getUserVaults(address);
    
    res.json({
      success: true,
      vaults: userVaults,
      count: userVaults.length
    });
  } catch (error) {
    logger.error('Failed to get user vaults:', error);
    res.status(500).json({ error: 'Failed to fetch user vaults' });
  }
}));

// Get vault statistics for user
router.get('/stats/:address', asyncHandler(async (req, res) => {
  const { address } = req.params;
  
  try {
    const stats = await vaultService.getUserVaultStats(address);
    
    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    logger.error('Failed to get vault stats:', error);
    res.status(500).json({ error: 'Failed to fetch vault statistics' });
  }
}));

// Get LP positions for user
router.get('/lp-positions/:address', asyncHandler(async (req, res) => {
  const { address } = req.params;
  
  try {
    // Mock LP positions data - replace with actual service call
    const positions = [
      {
        pair: 'CELO/cUSD',
        value: '1,250.00',
        share: '0.45',
        rewards: '25.50'
      },
      {
        pair: 'cUSD/cEUR',
        value: '850.00', 
        share: '0.32',
        rewards: '18.25'
      }
    ];
    
    res.json({
      success: true,
      positions
    });
  } catch (error) {
    logger.error('Failed to get LP positions:', error);
    res.status(500).json({ error: 'Failed to fetch LP positions' });
  }
}));

// Get user's vault overview
router.get('/user/:userAddress', asyncHandler(async (req, res) => {
  const { userAddress } = req.params;
  const userId = (req.user as any)?.claims?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const vaults = await vaultService.getUserVaults(userAddress);
    const stats = await vaultService.getUserVaultStats(userAddress);

    res.json({
      success: true,
      vaults,
      stats
    });
  } catch (error) {
    logger.error('Failed to get user vault overview:', error);
    res.status(500).json({ error: 'Failed to fetch vault overview' });
  }
}));

// Create new vault
router.post('/create', asyncHandler(async (req, res) => {
  const userId = (req.user as any)?.claims?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const vaultData = req.body;
    const newVault = await vaultService.createVault({
      ...vaultData,
      userId
    });

    res.json({
      success: true,
      vault: newVault,
      message: 'Vault created successfully'
    });
  } catch (error) {
    logger.error('Failed to create vault:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create vault' 
    });
  }
}));

// Get vault disbursement alerts
router.get('/alerts/:vaultId', asyncHandler(async (req, res) => {
  const { vaultId } = req.params;
  
  try {
    const alerts = await vaultService.getVaultAlerts(vaultId);
    
    res.json({
      success: true,
      alerts
    });
  } catch (error) {
    logger.error('Failed to get vault alerts:', error);
    res.status(500).json({ error: 'Failed to fetch vault alerts' });
  }
}));

// GET /api/vault/transactions - Get vault transaction history
router.get('/transactions', asyncHandler(async (req, res) => {
  const userId = (req.user as any)?.claims?.id || req.user?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { currency, startDate, endDate, limit = '100', vaultId } = req.query;

  try {
    const { db } = await import('../db');
    const { vaultTransactions, vaults } = await import('../../shared/schema');
    const { eq, and, gte, lte, desc, sql } = await import('drizzle-orm');

    // Build query conditions
    const conditions = [eq(vaultTransactions.userId, userId)];
    
    if (currency) {
      conditions.push(eq(vaultTransactions.tokenSymbol, currency as string));
    }
    
    if (startDate) {
      conditions.push(gte(vaultTransactions.createdAt, new Date(startDate as string)));
    }
    
    if (endDate) {
      conditions.push(lte(vaultTransactions.createdAt, new Date(endDate as string)));
    }
    
    if (vaultId) {
      conditions.push(eq(vaultTransactions.vaultId, vaultId as string));
    }

    // Fetch transactions
    const transactions = await db
      .select({
        id: vaultTransactions.id,
        type: vaultTransactions.transactionType,
        amount: vaultTransactions.amount,
        currency: vaultTransactions.tokenSymbol,
        to: vaultTransactions.transactionHash,
        timestamp: vaultTransactions.createdAt,
        status: vaultTransactions.status,
        valueUSD: vaultTransactions.valueUSD,
      })
      .from(vaultTransactions)
      .where(and(...conditions))
      .orderBy(desc(vaultTransactions.createdAt))
      .limit(parseInt(limit as string));

    // Transform for frontend
    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      type: tx.type === 'deposit' ? 'receive' : 'send',
      amount: tx.amount,
      currency: tx.currency?.toUpperCase() || 'CUSD',
      to: tx.to || '0x0000...0000',
      timestamp: tx.timestamp?.toISOString() || new Date().toISOString(),
      status: tx.status || 'completed',
      valueUSD: tx.valueUSD || '0',
    }));

    res.json({
      success: true,
      transactions: formattedTransactions,
      count: formattedTransactions.length,
    });
  } catch (error) {
    logger.error('Failed to get vault transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
}));

export default router;
