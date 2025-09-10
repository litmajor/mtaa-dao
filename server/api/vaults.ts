
import { Request, Response } from 'express';
import { VaultService } from '../services/vaultService';
import { TokenService } from '../services/tokenService';
import { db } from '../storage';
import { vaults, daoMemberships } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const vaultService = new VaultService();
const tokenService = new TokenService();

// Validation schemas
const createVaultSchema = z.object({
  name: z.string().min(1, 'Vault name is required'),
  description: z.string().optional(),
  type: z.enum(['personal', 'dao']),
  daoId: z.string().optional(),
  isPublic: z.boolean().default(false),
  allowedTokens: z.array(z.string()).optional(),
  lockPeriodDays: z.number().min(0).optional(),
  yieldStrategy: z.string().optional()
});

const depositSchema = z.object({
  tokenAddress: z.string().min(1, 'Token address is required'),
  amount: z.string().min(1, 'Amount is required'),
  fromAddress: z.string().min(1, 'From address is required')
});

const withdrawalSchema = z.object({
  tokenAddress: z.string().min(1, 'Token address is required'),
  amount: z.string().min(1, 'Amount is required'),
  toAddress: z.string().min(1, 'To address is required'),
  reason: z.string().optional()
});

const allocationSchema = z.object({
  tokenAddress: z.string().min(1, 'Token address is required'),
  strategyId: z.string().min(1, 'Strategy ID is required'),
  amount: z.string().min(1, 'Amount is required')
});

// Middleware for vault access authorization
async function authorizeVaultAccess(req: any, res: Response, next: any) {
  try {
    const { vaultId } = req.params;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const vault = await db.select().from(vaults).where(eq(vaults.id, vaultId)).limit(1);
    if (!vault.length) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    const vaultData = vault[0];

    // Check access permissions
    if (vaultData.type === 'personal' && vaultData.userId !== userId) {
      return res.status(403).json({ error: 'Access denied to personal vault' });
    }

    if (vaultData.type === 'dao') {
      const membership = await db.select().from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, vaultData.daoId!),
          eq(daoMemberships.userId, userId),
          eq(daoMemberships.status, 'approved')
        )).limit(1);

      if (!membership.length) {
        return res.status(403).json({ error: 'Access denied to DAO vault' });
      }

      req.membership = membership[0];
    }

    req.vault = vaultData;
    next();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// CREATE VAULT
export async function createVaultHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = createVaultSchema.parse(req.body);

    // For DAO vaults, verify membership
    if (validatedData.type === 'dao' && validatedData.daoId) {
      const membership = await db.select().from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, validatedData.daoId),
          eq(daoMemberships.userId, userId),
          eq(daoMemberships.status, 'approved')
        )).limit(1);

      if (!membership.length || !['admin', 'elder'].includes(membership[0].role || '')) {
        return res.status(403).json({ error: 'Insufficient permissions to create DAO vault' });
      }
    }

    const vault = await vaultService.createVault({
      name: validatedData.name,
      description: validatedData.description,
      type: validatedData.type,
      userId: validatedData.type === 'personal' ? userId : undefined,
      daoId: validatedData.daoId,
      isPublic: validatedData.isPublic,
      allowedTokens: validatedData.allowedTokens,
      lockPeriodDays: validatedData.lockPeriodDays,
      yieldStrategy: validatedData.yieldStrategy
    });

    res.status(201).json({
      success: true,
      data: vault,
      message: 'Vault created successfully'
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
}

// GET USER'S VAULTS
export async function getUserVaultsHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { type, includeDao = 'true' } = req.query;

    const userVaults = await vaultService.getUserVaults(userId, {
      type: type as 'personal' | 'dao' | undefined,
      includeDao: includeDao === 'true'
    });

    res.json({
      success: true,
      data: userVaults
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// GET VAULT DETAILS
export async function getVaultHandler(req: Request, res: Response) {
  try {
    const { vaultId } = req.params;
    const vault = (req as any).vault;

    const vaultDetails = await vaultService.getVaultDetails(vaultId);

    res.json({
      success: true,
      data: vaultDetails
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// DEPOSIT TO VAULT
export async function depositToVaultHandler(req: Request, res: Response) {
  try {
    const { vaultId } = req.params;
    const userId = (req as any).user?.claims?.sub;
    const vault = (req as any).vault;
    
    const validatedData = depositSchema.parse(req.body);

    // Verify deposit permissions
    if (vault.type === 'dao') {
      const membership = (req as any).membership;
      if (!membership || !['admin', 'elder', 'member'].includes(membership.role || '')) {
        return res.status(403).json({ error: 'Insufficient permissions for deposit' });
      }
    }

    const result = await vaultService.deposit(
      vaultId,
      validatedData.tokenAddress,
      validatedData.amount,
      validatedData.fromAddress,
      userId
    );

    res.json({
      success: true,
      data: result,
      message: 'Deposit completed successfully'
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
}

// WITHDRAW FROM VAULT
export async function withdrawFromVaultHandler(req: Request, res: Response) {
  try {
    const { vaultId } = req.params;
    const userId = (req as any).user?.claims?.sub;
    const vault = (req as any).vault;
    
    const validatedData = withdrawalSchema.parse(req.body);

    // Verify withdrawal permissions
    if (vault.type === 'dao') {
      const membership = (req as any).membership;
      if (!membership || !['admin', 'elder'].includes(membership.role || '')) {
        return res.status(403).json({ error: 'Insufficient permissions for withdrawal' });
      }
    }

    const result = await vaultService.withdraw(
      vaultId,
      validatedData.tokenAddress,
      validatedData.amount,
      validatedData.toAddress,
      userId,
      validatedData.reason
    );

    res.json({
      success: true,
      data: result,
      message: 'Withdrawal completed successfully'
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
}

// GET VAULT PORTFOLIO
export async function getVaultPortfolioHandler(req: Request, res: Response) {
  try {
    const { vaultId } = req.params;
    
    const portfolio = await vaultService.getPortfolio(vaultId);

    res.json({
      success: true,
      data: portfolio
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// ALLOCATE TO YIELD STRATEGY
export async function allocateToStrategyHandler(req: Request, res: Response) {
  try {
    const { vaultId } = req.params;
    const userId = (req as any).user?.claims?.sub;
    const vault = (req as any).vault;
    
    const validatedData = allocationSchema.parse(req.body);

    // Verify allocation permissions
    if (vault.type === 'dao') {
      const membership = (req as any).membership;
      if (!membership || !['admin', 'elder'].includes(membership.role || '')) {
        return res.status(403).json({ error: 'Insufficient permissions for strategy allocation' });
      }
    }

    const result = await vaultService.allocateToStrategy(
      vaultId,
      validatedData.tokenAddress,
      validatedData.strategyId,
      validatedData.amount,
      userId
    );

    res.json({
      success: true,
      data: result,
      message: 'Strategy allocation completed successfully'
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
}

// GET VAULT PERFORMANCE
export async function getVaultPerformanceHandler(req: Request, res: Response) {
  try {
    const { vaultId } = req.params;
    const { timeframe = '30' } = req.query;
    
    const performance = await vaultService.getPerformance(vaultId, Number(timeframe));

    res.json({
      success: true,
      data: performance
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// ASSESS VAULT RISK
export async function assessVaultRiskHandler(req: Request, res: Response) {
  try {
    const { vaultId } = req.params;
    
    const riskAssessment = await vaultService.assessRisk(vaultId);

    res.json({
      success: true,
      data: riskAssessment
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// GET VAULT TRANSACTIONS
export async function getVaultTransactionsHandler(req: Request, res: Response) {
  try {
    const { vaultId } = req.params;
    const { 
      limit = '50', 
      offset = '0', 
      type,
      tokenAddress,
      dateFrom,
      dateTo 
    } = req.query;

    const transactions = await vaultService.getTransactionHistory(vaultId, {
      limit: Number(limit),
      offset: Number(offset),
      type: type as string,
      tokenAddress: tokenAddress as string,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined
    });

    res.json({
      success: true,
      data: transactions
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// GET SUPPORTED TOKENS
export async function getSupportedTokensHandler(req: Request, res: Response) {
  try {
    const tokens = await tokenService.getSupportedTokens();

    res.json({
      success: true,
      data: tokens
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// GET TOKEN PRICE
export async function getTokenPriceHandler(req: Request, res: Response) {
  try {
    const { tokenAddress } = req.params;
    
    const price = await tokenService.getTokenPrice(tokenAddress);

    res.json({
      success: true,
      data: { tokenAddress, price }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// REBALANCE VAULT
export async function rebalanceVaultHandler(req: Request, res: Response) {
  try {
    const { vaultId } = req.params;
    const userId = (req as any).user?.claims?.sub;
    const vault = (req as any).vault;

    // Verify rebalance permissions
    if (vault.type === 'dao') {
      const membership = (req as any).membership;
      if (!membership || !['admin', 'elder'].includes(membership.role || '')) {
        return res.status(403).json({ error: 'Insufficient permissions for rebalancing' });
      }
    }

    const result = await vaultService.rebalanceVault(vaultId, userId);

    res.json({
      success: true,
      data: result,
      message: 'Vault rebalanced successfully'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// Export middleware
export { authorizeVaultAccess };
