import type { Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { daoMemberships } from '../../shared/schema';
import { vaultService, type CreateVaultRequest } from '../services/vaultService';
import { TokenRegistry } from '../../shared/tokenRegistry';
import { asyncHandler } from '../middleware/errorHandler';
import { Logger } from '../utils/logger';
import { getGatewayAgentService } from '../core/agents/gateway/service';
import {
  createVaultBodySchema,
  depositWithdrawBodySchema,
  allocateToStrategyBodySchema,
  vaultIdParamsSchema,
} from '../validators/vaults';

const logger = new Logger('vault-api');

function zodErrorResponse(res: Response, error: unknown) {
  return res.status(400).json({
    success: false,
    error: 'Invalid request payload',
    details: error instanceof Error ? error.message : 'Validation failed',
  });
}

async function ensureVaultAccess(userId: string, vaultId: string): Promise<boolean> {
  const vault = await vaultService.getVaultById(vaultId);
  if (!vault) return false;

  if (vault.userId === userId) return true;
  if (!vault.daoId) return false;

  const membership = await db.query.daoMemberships.findFirst({
    where: and(
      eq(daoMemberships.daoId, vault.daoId),
      eq(daoMemberships.userId, userId),
      eq(daoMemberships.status, 'approved')
    ),
  });

  return !!membership && !membership.isBanned;
}

export async function createVaultHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id ?? (req as any).user?.claims?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const validated = createVaultBodySchema.safeParse(req.body);
    if (!validated.success) {
      return zodErrorResponse(res, validated.error);
    }

    const data = validated.data;
    const primaryCurrency = data.primaryCurrency ?? (req.body as any)?.currency;
    const token = TokenRegistry.getToken(primaryCurrency as string);
    if (!token) {
      return res.status(400).json({ error: 'Unsupported primary currency' });
    }

    const vault = await vaultService.createVault({
      name: data.name,
      description: data.description,
      userId: data.daoId ? undefined : userId,
      daoId: data.daoId || undefined,
      vaultType: data.vaultType as CreateVaultRequest['vaultType'],
      primaryCurrency: data.primaryCurrency as any,
      yieldStrategy: data.yieldStrategy,
      riskLevel: data.riskLevel,
      minDeposit: data.minDeposit !== undefined ? String(data.minDeposit) : undefined,
      maxDeposit: data.maxDeposit !== undefined ? String(data.maxDeposit) : undefined,
    });

    // Optionally enrich response with a price from the gateway agent if available
    try {
      const gateway = getGatewayAgentService();
      if (typeof gateway.isHealthy === 'function' && gateway.isHealthy()) {
        const priceMsg = await gateway.requestPrices([primaryCurrency]);
        if (priceMsg && priceMsg.payload) {
          (vault as any).price = priceMsg.payload.prices?.[primaryCurrency] || null;
        }
      }
    } catch (e) {
      logger.warn('Gateway price enrichment skipped', { error: e instanceof Error ? e.message : String(e) });
    }

    res.json({ success: true, vault });
  } catch (error: any) {
    logger.error('createVaultHandler error', error);
    res.status(500).json({ error: 'Failed to create vault' });
  }
}

export async function depositToVaultHandler(req: Request, res: Response) {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const paramsResult = vaultIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return zodErrorResponse(res, paramsResult.error);
    }

    const bodyResult = depositWithdrawBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return zodErrorResponse(res, bodyResult.error);
    }

    const params = paramsResult.data;
    const body = bodyResult.data;

    // Validate token symbol
    const token = TokenRegistry.getToken(body.tokenSymbol);
    if (!token) return res.status(400).json({ error: 'Unsupported token symbol' });

    await vaultService.depositToken({
      vaultId: params.vaultId,
      userId,
      tokenSymbol: body.tokenSymbol,
      amount: String(body.amount),
      transactionHash: body.transactionHash,
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('depositToVaultHandler error', error);
    res.status(500).json({ error: 'Failed to deposit to vault' });
  }
}

function getAuthenticatedUserId(req: Request): string | undefined {
  return (req as any).user?.id ?? (req as any).user?.claims?.id;
}

export async function withdrawFromVaultHandler(req: Request, res: Response) {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const paramsResult = vaultIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return zodErrorResponse(res, paramsResult.error);
    }

    const bodyResult = depositWithdrawBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return zodErrorResponse(res, bodyResult.error);
    }

    const params = paramsResult.data;
    const body = bodyResult.data;

    // Validate token symbol
    const token = TokenRegistry.getToken(body.tokenSymbol);
    if (!token) return res.status(400).json({ error: 'Unsupported token symbol' });

    await vaultService.withdrawToken({
      vaultId: params.vaultId,
      userId,
      tokenSymbol: body.tokenSymbol,
      amount: String(body.amount),
      transactionHash: body.transactionHash,
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('withdrawFromVaultHandler error', error);
    res.status(500).json({ error: 'Failed to withdraw from vault' });
  }
}

export async function allocateToStrategyHandler(req: Request, res: Response) {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const paramsResult = vaultIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return zodErrorResponse(res, paramsResult.error);
    }

    const bodyResult = allocateToStrategyBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return zodErrorResponse(res, bodyResult.error);
    }

    const params = paramsResult.data;
    const body = bodyResult.data;

    // Ensure token symbol is supported for the strategy
    const supported = TokenRegistry.getSupportedTokensForStrategy(body.strategyId as any);
    const tokenOk = supported.some(t => t.symbol === body.tokenSymbol) || !!TokenRegistry.getToken(body.tokenSymbol);
    if (!tokenOk) return res.status(400).json({ error: 'Token not supported for this strategy' });

    await vaultService.allocateToStrategy({
      vaultId: params.vaultId,
      userId,
      strategyId: body.strategyId,
      tokenSymbol: body.tokenSymbol,
      allocationPercentage: body.allocationPercentage,
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('allocateToStrategyHandler error', error);
    res.status(500).json({ error: 'Failed to allocate to strategy' });
  }
}

export async function rebalanceVaultHandler(req: Request, res: Response) {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const paramsResult = vaultIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return zodErrorResponse(res, paramsResult.error);
    }

    const params = paramsResult.data;

    // Consult gateway agent for execution safety before rebalancing
    try {
      const gateway = getGatewayAgentService();
      if (gateway && typeof gateway.isHealthy === 'function' && gateway.isHealthy()) {
        const resp = await gateway.requestExecutionCheck({ vaultId: params.vaultId });
        const isSafe = resp?.payload?.data?.isSafeToExecute;
        if (isSafe === false) {
          return res.status(409).json({ success: false, message: 'Rebalance deferred: gateway flagged unsafe to execute', details: resp?.payload?.data?.details ?? null });
        }
      }
    } catch (e) {
      logger.warn('Gateway execution check failed or unavailable, proceeding with rebalance', { error: e instanceof Error ? e.message : String(e) });
    }

    await vaultService.rebalanceVault(params.vaultId, userId);

    res.json({ success: true, message: 'Vault rebalanced successfully' });
  } catch (error: any) {
    logger.error('rebalanceVaultHandler error', error);
    res.status(500).json({ error: 'Failed to rebalance vault' });
  }
}

export async function getVaultPerformanceHandler(req: Request, res: Response) {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const paramsResult = vaultIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return zodErrorResponse(res, paramsResult.error);
    }

    const params = paramsResult.data;

    const performance = await vaultService.getVaultPerformance(params.vaultId, userId);

    // Try to enrich performance with current price via gateway agent
    try {
      const gateway = getGatewayAgentService();
      if (gateway && typeof gateway.isHealthy === 'function' && gateway.isHealthy()) {
          const vault = await vaultService.getVaultById(params.vaultId);
          const vaultCurrency = (vault as any)?.primaryCurrency ?? (vault as any)?.currency;
          if (vaultCurrency) {
            const priceMsg = await gateway.requestPrices([vaultCurrency]);
            (performance as any).price = priceMsg?.payload?.prices?.[vaultCurrency] ?? null;
          }
        }
    } catch (e) {
      logger.warn('Gateway enrichment failed for performance', { error: e instanceof Error ? e.message : String(e) });
    }

    res.json({ performance });
  } catch (error: any) {
    logger.error('getVaultPerformanceHandler error', error);
    res.status(500).json({ error: 'Failed to fetch vault performance' });
  }
}

export async function assessVaultRiskHandler(req: Request, res: Response) {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const paramsResult = vaultIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return zodErrorResponse(res, paramsResult.error);
    }

    const params = paramsResult.data;
    const hasAccess = await ensureVaultAccess(userId, params.vaultId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Forbidden: you do not have access to this vault' });
    }

    await vaultService.performRiskAssessment(params.vaultId);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('assessVaultRiskHandler error', error);
    res.status(500).json({ error: 'Failed to assess vault risk' });
  }
}

// Export route-wrapped handlers (if routes import them directly)
export const createVault = asyncHandler(createVaultHandler);
export const depositToVault = asyncHandler(depositToVaultHandler);
export const withdrawFromVault = asyncHandler(withdrawFromVaultHandler);
export const allocateToStrategy = asyncHandler(allocateToStrategyHandler);
export const rebalanceVault = asyncHandler(rebalanceVaultHandler);
export const getVaultPerformance = asyncHandler(getVaultPerformanceHandler);
export const assessVaultRisk = asyncHandler(assessVaultRiskHandler);
