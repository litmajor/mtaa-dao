/**
 * Multi-Chain Withdrawal API Routes
 * Phase 3: Cross-chain withdrawal orchestration
 * Endpoints for retrieving routing options and executing transfers
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { getWithdrawalRouter } from '../services/withdrawalRouter';
import { getBridgeIntegration } from '../services/bridgeIntegration';
import { getLiquidityOptimizer } from '../services/liquidityOptimizer';
import { getServiceAccountManager } from '../services/serviceAccountManager';
import { getWithdrawalExecutor } from '../services/withdrawalExecutor';
import { getBridgeStatusPoller } from '../services/bridgeStatusPoller';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger('multichain-withdrawals-api');

/**
 * Validation schemas
 */
const getRoutingOptionsSchema = z.object({
  targetChain: z.enum(['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'tron', 'avalanche']),
  token: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,18})?$/),
  priority: z.enum(['cost', 'speed', 'balanced']).default('balanced'),
  maxSlippage: z.number().positive().optional(),
  minReceived: z.string().optional(),
});

const executeWithdrawalSchema = z.object({
  targetChain: z.enum(['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'tron', 'avalanche']),
  token: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,18})?$/),
  recipientAddress: z.string().min(26), // Min address length
  priority: z.enum(['cost', 'speed', 'balanced']).default('balanced'),
  maxSlippage: z.number().positive().optional(),
  password: z.string().min(6), // For security: user confirmation password
});

const checkBridgeStatusSchema = z.object({
  withdrawalId: z.string().uuid(),
});

const getWithdrawalHistorySchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

/**
 * GET /api/multichain/status
 * Get service account status and liquidity across all chains
 */
router.get(
  '/status',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountManager = getServiceAccountManager();
      const status = await accountManager.getStatus();

      res.json({
        success: true,
        data: {
          status,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.error(`Status check failed: ${(error as any).message}`);
      next(error);
    }
  }
);

/**
 * POST /api/multichain/routing-options
 * Get routing options for a potential withdrawal
 * Shows user the best routes with cost/time tradeoffs
 */
router.post(
  '/routing-options',
  authenticateToken,
  validateRequest(getRoutingOptionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { targetChain, token, amount, priority, maxSlippage, minReceived } = req.body;

      const router = getWithdrawalRouter();
      const optimizer = getLiquidityOptimizer();

      // Get routing decision
      const routingDecision = await router.routeWithdrawal({
        userAddress: req.user!.id, // From auth middleware
        targetChain,
        token,
        amount,
        priority: priority || 'balanced',
        maxSlippage,
        minReceived,
      });

      if (!routingDecision.isValid) {
        return res.status(400).json({
          success: false,
          errors: routingDecision.validationErrors,
          data: null,
        });
      }

      // Get optimized paths
      const optimizedPaths = await optimizer.findOptimalPaths({
        targetChain,
        sourceToken: token,
        targetToken: token,
        amount,
        priority: priority || 'balanced',
      });

      res.json({
        success: true,
        data: {
          selectedRoute: routingDecision.selectedRoute,
          alternateRoutes: routingDecision.alternateRoutes,
          executionPlan: routingDecision.executionSteps,
          optimizedPaths: optimizedPaths.topPaths.slice(0, 3), // Top 3 recommendations
          recommendation: optimizedPaths.recommendation,
          estimatedTime: routingDecision.selectedRoute.estimatedTimeSeconds,
          totalCost: routingDecision.selectedRoute.totalCostUSD,
          costPercent: routingDecision.selectedRoute.totalCostPercent,
          reason: routingDecision.routingReason,
        },
      });
    } catch (error) {
      logger.error(`Routing failed: ${(error as any).message}`);
      next(error);
    }
  }
);

/**
 * POST /api/multichain/execute
 * Execute a multi-chain withdrawal
 * Initiates the full transfer process (swap → bridge → monitor)
 */
router.post(
  '/execute',
  authenticateToken,
  validateRequest(executeWithdrawalSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { targetChain, token, amount, recipientAddress, priority, maxSlippage, password } =
        req.body;
      const userId = req.user!.id;

      logger.info(`Executing withdrawal: ${amount} ${token} to ${targetChain} for user ${userId}`);

      // TODO: Validate password against user's PIN/password hash
      // For now, simplified validation
      if (!password || password.length < 6) {
        return res.status(401).json({
          success: false,
          error: 'Invalid password',
        });
      }

      // Initialize execution
      const executor = getWithdrawalExecutor();

      const executionResult = await executor.executeWithdrawal({
        userId,
        targetChain,
        token,
        amount,
        recipientAddress,
        priority: priority || 'balanced',
        maxSlippage,
      });

      if (!executionResult.success) {
        return res.status(400).json({
          success: false,
          error: executionResult.error,
          data: null,
        });
      }

      res.json({
        success: true,
        data: {
          withdrawalId: executionResult.withdrawalId,
          transactionHash: executionResult.transactionHash,
          status: executionResult.status,
          estimatedTime: executionResult.estimatedTime,
          estimatedCost: executionResult.estimatedCost,
          message: `Withdrawal initiated. Transaction hash: ${executionResult.transactionHash}`,
        },
      });
    } catch (error) {
      logger.error(`Execution failed: ${(error as any).message}`);
      next(error);
    }
  }
);

/**
 * GET /api/multichain/withdrawal/:withdrawalId
 * Get status of a specific multi-chain withdrawal
 */
router.get(
  '/withdrawal/:withdrawalId',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { withdrawalId } = req.params;

      const poller = getBridgeStatusPoller();
      const status = await poller.getWithdrawalStatus(withdrawalId);

      if (!status) {
        return res.status(404).json({
          success: false,
          error: 'Withdrawal not found',
        });
      }

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error(`Status retrieval failed: ${(error as any).message}`);
      next(error);
    }
  }
);

/**
 * GET /api/multichain/history
 * Get user's multi-chain withdrawal history
 */
router.get(
  '/history',
  authenticateToken,
  validateRequest(getWithdrawalHistorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit, offset } = req.query as { limit?: string; offset?: string };
      const userId = req.user!.id;

      const router = getWithdrawalRouter();
      const history = await router.getRoutingHistory(userId, parseInt(limit || '20'));

      res.json({
        success: true,
        data: {
          total: history.length,
          limit: parseInt(limit || '20'),
          offset: parseInt(offset || '0'),
          withdrawals: history,
        },
      });
    } catch (error) {
      logger.error(`History retrieval failed: ${(error as any).message}`);
      next(error);
    }
  }
);

/**
 * POST /api/multichain/cancel/:withdrawalId
 * Cancel an in-progress withdrawal (if possible)
 */
router.post(
  '/cancel/:withdrawalId',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { withdrawalId } = req.params;

      const executor = getWithdrawalExecutor();
      const result = await executor.cancelWithdrawal(withdrawalId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      res.json({
        success: true,
        message: `Withdrawal ${withdrawalId} cancellation initiated`,
        data: result,
      });
    } catch (error) {
      logger.error(`Cancellation failed: ${(error as any).message}`);
      next(error);
    }
  }
);

/**
 * GET /api/multichain/supported-chains
 * Get list of supported chains with liquidity info
 */
router.get(
  '/supported-chains',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountManager = getServiceAccountManager();
      const unifiedLiquidity = await accountManager.getUnifiedLiquidity();

      const chainsInfo = unifiedLiquidity.chains.map((chain) => ({
        chain: chain.chain,
        token: chain.token,
        available: parseFloat(chain.balance) > 0,
        balance: chain.balance,
        balanceUSD: chain.balanceUSD,
        lastSync: chain.lastUpdated,
      }));

      res.json({
        success: true,
        data: {
          chains: chainsInfo,
          totalLiquidity: unifiedLiquidity.totalValueUSD,
          liquidityScore: unifiedLiquidity.liquidityScore,
          riskScore: unifiedLiquidity.riskScore,
        },
      });
    } catch (error) {
      logger.error(`Chains info retrieval failed: ${(error as any).message}`);
      next(error);
    }
  }
);

/**
 * GET /api/multichain/bridge-protocols
 * Get available bridge protocols for chain pairs
 */
router.get(
  '/bridge-protocols',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourceChain, targetChain } = req.query as {
        sourceChain?: string;
        targetChain?: string;
      };

      if (!sourceChain || !targetChain) {
        return res.status(400).json({
          success: false,
          error: 'sourceChain and targetChain query parameters required',
        });
      }

      const bridge = getBridgeIntegration();
      const protocols = bridge.getSupportedProtocols(
        sourceChain as any,
        targetChain as any
      );
      const recommended = bridge.recommendProtocol(sourceChain as any, targetChain as any);

      res.json({
        success: true,
        data: {
          sourceChain,
          targetChain,
          supportedProtocols: protocols,
          recommended,
        },
      });
    } catch (error) {
      logger.error(`Bridge protocols retrieval failed: ${(error as any).message}`);
      next(error);
    }
  }
);

export default router;
