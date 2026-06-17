import { Request, Response } from 'express';
import { vaultService, type CreateVaultRequest } from '../services/vaultService';
import { TokenRegistry } from '../../shared/tokenRegistry';
import { vaultValidation } from '../middleware/validation';
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

// Helper to run express-style middleware inside handlers
const runMiddleware = (req: Request, res: Response, mw: any) => {
  return new Promise<void>((resolve, reject) => {
    try {
      mw(req, res, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
};

export async function createVaultHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.claims?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    // Run shared validation middleware for createVault (if routes call it this will be noop)
    try {
      await runMiddleware(req, res, vaultValidation.createVault);
    } catch (err) {
      logger.warn('Validation middleware rejected request', err);
      return res.status(400).json({ error: 'Invalid request payload' });
    }

    const validated = createVaultBodySchema.parse(req.body);

    // Normalise currency field (some validation layers use `currency`)
    const primaryCurrency = (validated as any).primaryCurrency ?? (validated as any).currency;
    // Validate primary currency against token registry
    const token = TokenRegistry.getToken(primaryCurrency as string);
    if (!token) {
      return res.status(400).json({ error: 'Unsupported primary currency' });
    }

    const vault = await vaultService.createVault({
      name: validated.name,
      description: validated.description,
      userId: validated.daoId ? undefined : userId,
      daoId: validated.daoId || undefined,
      vaultType: validated.vaultType as CreateVaultRequest['vaultType'],
      primaryCurrency: validated.primaryCurrency as any,
      yieldStrategy: validated.yieldStrategy,
      riskLevel: validated.riskLevel,
      minDeposit: validated.minDeposit !== undefined ? String(validated.minDeposit) : undefined,
      maxDeposit: validated.maxDeposit !== undefined ? String(validated.maxDeposit) : undefined,
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
      logger.warn('Gateway price enrichment skipped:', e);
    }

    res.json({ success: true, vault });
  } catch (error: any) {
    logger.error('createVaultHandler error', error);
    res.status(500).json({ error: error.message || 'Failed to create vault' });
  }
}

export async function depositToVaultHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.claims?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    try {
      await runMiddleware(req, res, vaultValidation.depositToVault);
    } catch (err) {
      logger.warn('Validation middleware rejected request', err);
      return res.status(400).json({ error: 'Invalid request payload' });
    }

    const params = vaultIdParamsSchema.parse(req.params);
    const body = depositWithdrawBodySchema.parse(req.body);

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
    res.status(500).json({ error: error.message || 'Failed to deposit to vault' });
  }
}

export async function withdrawFromVaultHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.claims?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    try {
      await runMiddleware(req, res, vaultValidation.withdrawFromVault);
    } catch (err) {
      logger.warn('Validation middleware rejected request', err);
      return res.status(400).json({ error: 'Invalid request payload' });
    }

    const params = vaultIdParamsSchema.parse(req.params);
    const body = depositWithdrawBodySchema.parse(req.body);

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
    res.status(500).json({ error: error.message || 'Failed to withdraw from vault' });
  }
}

export async function allocateToStrategyHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.claims?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const params = vaultIdParamsSchema.parse(req.params);
    const body = allocateToStrategyBodySchema.parse(req.body);

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
    res.status(500).json({ error: error.message || 'Failed to allocate to strategy' });
  }
}

export async function rebalanceVaultHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.claims?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const params = vaultIdParamsSchema.parse(req.params);

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
      logger.warn('Gateway execution check failed or unavailable, proceeding with rebalance:', e);
    }

    await vaultService.rebalanceVault(params.vaultId, userId);

    res.json({ success: true, message: 'Vault rebalanced successfully' });
  } catch (error: any) {
    logger.error('rebalanceVaultHandler error', error);
    res.status(500).json({ error: error.message || 'Failed to rebalance vault' });
  }
}

export async function getVaultPerformanceHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.claims?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const params = vaultIdParamsSchema.parse(req.params);

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
      logger.warn('Gateway enrichment failed for performance:', e);
    }

    res.json({ performance });
  } catch (error: any) {
    logger.error('getVaultPerformanceHandler error', error);
    res.status(500).json({ error: error.message || 'Failed to fetch vault performance' });
  }
}

export async function assessVaultRiskHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.claims?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const params = vaultIdParamsSchema.parse(req.params);

    await vaultService.performRiskAssessment(params.vaultId);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('assessVaultRiskHandler error', error);
    res.status(500).json({ error: error.message || 'Failed to assess vault risk' });
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
