import { Request, Response } from 'express';
import { vaultService } from '../services/vaultService';
import { TokenRegistry } from '../../shared/tokenRegistry';
import { vaultValidation } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { Logger } from '../utils/logger';

const logger = new Logger('vault-api');

// Create a new vault
export async function createVaultHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.claims?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      name,
      description,
      daoId,
      vaultType,
      primaryCurrency,
      yieldStrategy,
      riskLevel,
      minDeposit,
      maxDeposit
    } = req.body;

    if (!name || !primaryCurrency || !vaultType) {
      return res.status(400).json({ 
        error: 'Name, primary currency, and vault type are required' 
      });
    }

    const vault = await vaultService.createVault({
      name,
      description,
      userId: daoId ? undefined : userId,
      daoId: daoId || undefined,
      vaultType,
      primaryCurrency,
      yieldStrategy,
      riskLevel,
      minDeposit,
      maxDeposit
    });

    res.json({ vault });
  } catch (error: any) {
    console.error('Error creating vault:', error);
    res.status(500).json({ error: error.message || 'Failed to create vault' });
  }
}

// Get user's vaults
export async function getUserVaultsHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.claims?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { daoId } = req.query;

    // For now, we'll implement a simple query to get vaults
    // This should be enhanced with proper filtering in the VaultService
    const vaults = await vaultService.getUserVaults(userId, daoId as string);

    res.json({ vaults });
  } catch (error: any) {
    console.error('Error fetching vaults:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch vaults' });
  }
}

// Get specific vault details
export async function getVaultHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const portfolio = await vaultService.getVaultPortfolio(vaultId, userId);

    res.json(portfolio);
  } catch (error: any) {
    console.error('Error fetching vault:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch vault' });
  }
}

// Deposit to vault
export async function depositToVaultHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;
    const { tokenSymbol, amount, transactionHash } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!tokenSymbol || !amount) {
      return res.status(400).json({ 
        error: 'Token symbol and amount are required' 
      });
    }

    const transaction = await vaultService.depositToken({
      vaultId,
      userId,
      tokenSymbol,
      amount,
      transactionHash
    });

    res.json({ transaction });
  } catch (error: any) {
    console.error('Error depositing to vault:', error);
    res.status(500).json({ error: error.message || 'Failed to deposit to vault' });
  }
}

// Withdraw from vault
export async function withdrawFromVaultHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;
    const { tokenSymbol, amount, transactionHash } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!tokenSymbol || !amount) {
      return res.status(400).json({ 
        error: 'Token symbol and amount are required' 
      });
    }

    const transaction = await vaultService.withdrawToken({
      vaultId,
      userId,
      tokenSymbol,
      amount,
      transactionHash
    });

    res.json({ transaction });
  } catch (error: any) {
    console.error('Error withdrawing from vault:', error);
    res.status(500).json({ error: error.message || 'Failed to withdraw from vault' });
  }
}

// Allocate to strategy
export async function allocateToStrategyHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;
    const { strategyId, tokenSymbol, allocationPercentage } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!strategyId || !tokenSymbol || allocationPercentage === undefined) {
      return res.status(400).json({ 
        error: 'Strategy ID, token symbol, and allocation percentage are required' 
      });
    }

    await vaultService.allocateToStrategy({
      vaultId,
      userId,
      strategyId,
      tokenSymbol,
      allocationPercentage
    });

    res.json({ success: true, message: 'Strategy allocation updated' });
  } catch (error: any) {
    console.error('Error allocating to strategy:', error);
    res.status(500).json({ error: error.message || 'Failed to allocate to strategy' });
  }
}

// Rebalance vault
export async function rebalanceVaultHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await vaultService.rebalanceVault(vaultId, userId);

    res.json({ success: true, message: 'Vault rebalanced successfully' });
  } catch (error: any) {
    console.error('Error rebalancing vault:', error);
    res.status(500).json({ error: error.message || 'Failed to rebalance vault' });
  }
}

// Get vault portfolio
export async function getVaultPortfolioHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const portfolio = await vaultService.getVaultPortfolio(vaultId, userId);

    res.json(portfolio);
  } catch (error: any) {
    console.error('Error fetching vault portfolio:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch vault portfolio' });
  }
}

// Get vault performance
export async function getVaultPerformanceHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const performance = await vaultService.getVaultPerformance(vaultId, userId);

    res.json({ performance });
  } catch (error: any) {
    console.error('Error fetching vault performance:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch vault performance' });
  }
}

// Assess vault risk
export async function assessVaultRiskHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await vaultService.performRiskAssessment(vaultId);

    res.json({ success: true, message: 'Risk assessment completed' });
  } catch (error: any) {
    console.error('Error assessing vault risk:', error);
    res.status(500).json({ error: error.message || 'Failed to assess vault risk' });
  }
}

// Get vault transactions
export const getVaultTransactionsHandler = [
  vaultValidation.getVaultTransactions,
  asyncHandler(async (req: Request, res: Response) => {
    const requestLogger = logger.child({
      requestId: req.headers['x-request-id'],
      userId: req.user?.claims?.id,
      vaultId: req.params.vaultId,
    });

    const userId = req.user?.claims?.id;
    if (!userId) {
      requestLogger.warn('Unauthorized access attempt');
      return res.status(401).json({ 
        success: false,
        error: {
          message: 'Authentication required',
          code: 'UNAUTHORIZED',
          statusCode: 401,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
        }
      });
    }

    const { vaultId } = req.params;
    const { page, limit } = req.query as { page?: number; limit?: number };

    requestLogger.info('Fetching vault transactions', { page, limit });

    const transactions = await vaultService.getVaultTransactions(
      vaultId, 
      userId, 
      page || 1, 
      limit || 20
    );

    requestLogger.info('Vault transactions fetched successfully', { count: transactions.length });

    res.json({ 
      success: true,
      data: { transactions },
      message: 'Vault transactions fetched successfully'
    });
  })
];

// Get supported tokens
export async function getSupportedTokensHandler(req: Request, res: Response) {
  try {
    const tokens = TokenRegistry.getAllTokens();
    res.json({ tokens });
  } catch (error: any) {
    console.error('Error fetching supported tokens:', error);
    res.status(500).json({ error: 'Failed to fetch supported tokens' });
  }
}

// Get token price
export async function getTokenPriceHandler(req: Request, res: Response) {
  try {
    const { tokenAddress } = req.params;

    // For now, return mock price - this should integrate with actual price feeds
    const mockPrices: Record<string, number> = {
      'CELO': 0.65,
      'cUSD': 1.00,
      'cEUR': 1.08,
      'USDT': 1.00,
      'MTAA': 0.10
    };

    const token = TokenRegistry.getTokenByAddress(tokenAddress);
    const price = token ? mockPrices[token.symbol] || 0.30 : 0;

    res.json({ price, currency: 'USD' });
  } catch (error: any) {
    console.error('Error fetching token price:', error);
    res.status(500).json({ error: 'Failed to fetch token price' });
  }
}