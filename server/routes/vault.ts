
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
  const userId = req.user?.id; // Assuming auth middleware sets req.user
  
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

    // Simulate blockchain transaction hash for demo
    const txHash = `0x${Math.random().toString(16).substring(2, 66)}`;

    res.json({
      success: true,
      txHash,
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
  const userId = req.user?.id;
  
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

    // Simulate blockchain transaction hash for demo
    const txHash = `0x${Math.random().toString(16).substring(2, 66)}`;

    res.json({
      success: true,
      txHash,
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
    // For demo purposes, simulate approval transaction
    // In real implementation, this would interact with the blockchain
    const txHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    res.json({
      success: true,
      txHash,
      message: 'Approval transaction submitted'
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
    // For demo, return mock performance data
    const mockData = {
      apy: '8.5',
      totalReturn: '12.3',
      period: period || '7d',
      data: generateMockChartData(period as string),
    };

    res.json(mockData);
  } catch (error) {
    logger.error('Failed to get vault performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
}));

// Get vault transactions
router.get('/transactions', asyncHandler(async (req, res) => {
  const { vault, page = '1' } = req.query;
  const userId = req.user?.id;
  
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
  const userId = req.user?.id;
  
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

// Get user's vaults
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

// Create new vault
router.post('/create', asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  
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

// Helper function to generate mock chart data
function generateMockChartData(period: string) {
  const points = period === '24h' ? 24 : period === '7d' ? 7 : 30;
  const data = [];
  let value = 1000;
  
  for (let i = 0; i < points; i++) {
    const change = (Math.random() - 0.5) * 20;
    value += change;
    data.push({
      timestamp: new Date(Date.now() - (points - i) * (period === '24h' ? 3600000 : 86400000)).toISOString(),
      value: Math.max(value, 900),
      apy: 8.5 + (Math.random() - 0.5) * 2,
    });
  }
  
  return data;
}

export default router;
