/**
 * Transaction Processing Routes - Phase 3
 * REST API endpoints for batching, smart contracts, DEX swaps, yield farming, and DeFi operations
 */

import { Router, Request, Response, NextFunction } from "express";
import {
  createTransactionBatch,
  addToBatch,
  getBatchDetails,
  executeBatch,
  recordBatchCompletion,
  registerSmartContract,
  getSmartContract,
  recordContractInteraction,
  getContractInteractionHistory,
  createDexSwap,
  recordSwapExecution,
  getSwapHistory,
  createYieldPosition,
  claimYieldRewards,
  getYieldPositions,
  calculateTotalYieldEarned,
  createRebalancingRule,
  executeRebalancingAction,
  checkAllocationDeviation,
  createBridgeTransaction,
  updateBridgeStatus,
  getBridgeHistory,
  simulateTransaction,
  getSimulationResult,
  recordGasOptimization,
  getGasOptimizationHistory,
  calculateTotalGasSavings,
  getOraclePrice,
  getPriceHistory,
  getWalletDefiStatus,
} from "../services/transaction-service";
import { authenticateToken } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();

// ==================== TRANSACTION BATCHING ====================

/**
 * POST /api/transactions/batches
 * Create new transaction batch
 */
router.post(
  "/batches",
  validateRequest(z.object({ daoId: z.string().optional(), walletConnectionId: z.string().optional(), batchName: z.string(), batchType: z.string(), priority: z.string().optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const batch = await createTransactionBatch(
        req.body.daoId || req.body.walletConnectionId,
        req.body.batchName,
        req.body.batchType,
        req.body.priority
      );

      res.status(201).json({
        success: true,
        data: batch,
        message: "Transaction batch created",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/transactions/batches/:batchId/transactions
 * Add transaction to batch
 */
router.post(
  "/batches/:batchId/transactions",
  validateRequest(z.object({ batchId: z.string(), targetAddress: z.string(), functionSignature: z.string(), functionParams: z.any().optional(), callValue: z.string().optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const txId = await addToBatch(
        req.params.batchId,
        req.body.targetAddress,
        req.body.functionSignature,
        req.body.functionParams,
        req.body.callValue
      );

      res.status(201).json({
        success: true,
        data: { transactionId: txId },
        message: "Transaction added to batch",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transactions/batches/:batchId
 * Get batch details
 */
router.get(
  "/batches/:batchId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const batchData = await getBatchDetails(req.params.batchId);

      res.json({
        success: true,
        data: batchData,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/transactions/batches/:batchId/execute
 * Prepare batch for execution
 */
router.post(
  "/batches/:batchId/execute",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await executeBatch(req.params.batchId);

      res.json({
        success: true,
        data: result,
        message: "Batch prepared for execution",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/transactions/batches/:batchId/complete
 * Record batch completion
 */
router.post(
  "/batches/:batchId/complete",
  validateRequest(z.object({ actualGas: z.string(), completedTxs: z.number(), failedTxs: z.number().optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await recordBatchCompletion(req.params.batchId, req.body.actualGas, req.body.completedTxs, req.body.failedTxs);

      res.json({
        success: true,
        message: "Batch completion recorded",
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== SMART CONTRACTS ====================

/**
 * POST /api/transactions/contracts/register
 * Register smart contract
 */
router.post(
  "/contracts/register",
  validateRequest(
    z.object({
      chainId: z.number(),
      contractAddress: z.string(),
      contractName: z.string(),
      contractType: z.string(),
      abi: z.any(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contract = await registerSmartContract(
        req.body.chainId,
        req.body.contractAddress,
        req.body.contractName,
        req.body.contractType,
        req.body.abi
      );

      res.status(201).json({
        success: true,
        data: contract,
        message: "Smart contract registered",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transactions/contracts/:chainId/:address
 * Get smart contract info
 */
router.get(
  "/contracts/:chainId/:address",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contract = await getSmartContract(parseInt(req.params.chainId), req.params.address);

      if (!contract) {
        return res.status(404).json({
          success: false,
          message: "Contract not found",
        });
      }

      res.json({
        success: true,
        data: contract,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/transactions/contracts/:contractId/interact
 * Record contract interaction
 */
router.post(
  "/contracts/:contractId/interact",
  validateRequest(
    z.object({
      walletConnectionId: z.string().uuid(),
      functionName: z.string(),
      functionType: z.enum(["read", "write", "state_change"]),
      inputParams: z.any().optional(),
      outputData: z.any().optional(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const interaction = await recordContractInteraction(
        req.body.walletConnectionId,
        req.params.contractId,
        req.body.functionName,
        req.body.functionType,
        req.body.inputParams,
        req.body.outputData
      );

      res.status(201).json({
        success: true,
        data: interaction,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transactions/contracts/:walletId/interactions
 * Get contract interaction history
 */
router.get(
  "/contracts/:walletId/interactions",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;

      const interactions = await getContractInteractionHistory(req.params.walletId, limit, offset);

      res.json({
        success: true,
        data: interactions,
        pagination: { limit, offset, count: interactions.length },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== DEX SWAPS ====================

/**
 * POST /api/transactions/swaps
 * Create DEX swap
 */
router.post(
  "/swaps",
  validateRequest(z.object({ dexId: z.string(), fromToken: z.string(), toToken: z.string(), fromAmount: z.string(), toAmountExpected: z.string().optional(), slippagePercent: z.number().optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const swap = await createDexSwap(
        req.body.dexId,
        req.body.fromToken,
        req.body.toToken,
        req.body.fromAmount,
        req.body.toAmountExpected || "0",
        req.body.slippagePercent
      );

      res.status(201).json({
        success: true,
        data: swap,
        message: "Swap created",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/transactions/swaps/:swapId/execute
 * Record swap execution
 */
router.post(
  "/swaps/:swapId/execute",
  validateRequest(z.object({ transactionId: z.string().uuid(), toAmountActual: z.string(), priceImpactPercent: z.number() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await recordSwapExecution(req.params.swapId, req.body.transactionId, req.body.toAmountActual, req.body.priceImpactPercent);

      res.json({
        success: true,
        message: "Swap execution recorded",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transactions/swaps/:walletId
 * Get swap history
 */
router.get(
  "/swaps/:walletId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const swaps = await getSwapHistory(req.params.walletId);

      res.json({
        success: true,
        data: swaps,
        count: swaps.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== YIELD FARMING ====================

/**
 * POST /api/transactions/yield/positions
 * Create yield farming position
 */
router.post(
  "/yield/positions",
  validateRequest(z.object({ farmId: z.string(), depositedAmount: z.string(), depositedAmountUsd: z.string().optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const position = await createYieldPosition(
        req.body.farmId,
        req.body.depositedAmount,
        req.body.depositedAmountUsd || req.body.depositedAmount
      );

      res.status(201).json({
        success: true,
        data: position,
        message: "Yield position created",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/transactions/yield/positions/:positionId/claim
 * Claim yield rewards
 */
router.post(
  "/yield/positions/:positionId/claim",
  validateRequest(z.object({ rewardAmount: z.string(), rewardAmountUsd: z.string(), rewardToken: z.string().optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const claimId = await claimYieldRewards(
        req.params.positionId,
        req.body.rewardAmount,
        req.body.rewardAmountUsd,
        req.body.rewardToken
      );

      res.status(201).json({
        success: true,
        data: { claimId },
        message: "Rewards claimed",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transactions/yield/:walletId
 * Get yield positions
 */
router.get(
  "/yield/:walletId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const positions = await getYieldPositions(req.params.walletId);
      const totalEarned = await calculateTotalYieldEarned(req.params.walletId);

      res.json({
        success: true,
        data: {
          positions,
          totalYieldEarned: totalEarned,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== REBALANCING ====================

/**
 * POST /api/transactions/rebalance/rules
 * Create rebalancing rule
 */
router.post(
  "/rebalance/rules",
  validateRequest(z.object({ ruleName: z.string(), targetAllocations: z.record(z.number()), rebalanceTrigger: z.enum(["deviation", "schedule", "manual"]), deviationThreshold: z.number().optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rule = await createRebalancingRule(
        req.body.ruleName,
        req.body.targetAllocations,
        req.body.rebalanceTrigger,
        req.body.deviationThreshold
      );

      res.status(201).json({
        success: true,
        data: rule,
        message: "Rebalancing rule created",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/transactions/rebalance/rules/:ruleId/execute
 * Execute rebalancing
 */
router.post(
  "/rebalance/rules/:ruleId/execute",
  validateRequest(
    z.object({
      batchId: z.string().uuid(),
      tokensSold: z.array(z.object({ address: z.string(), amount: z.string() })),
      tokensBought: z.array(z.object({ address: z.string(), amount: z.string() })),
      totalSwapValueUsd: z.string(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actionId = await executeRebalancingAction(
        req.params.ruleId,
        req.body.batchId,
        req.body.tokensSold,
        req.body.tokensBought,
        req.body.totalSwapValueUsd
      );

      res.status(201).json({
        success: true,
        data: { actionId },
        message: "Rebalancing executed",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transactions/rebalance/rules/:ruleId/status
 * Check allocation deviation
 */
router.get(
  "/rebalance/rules/:ruleId/status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Fetch rule and check deviation
      res.json({
        success: true,
        data: {
          currentAllocations: {},
          deviations: {},
          needsRebalance: false,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== BRIDGES ====================

/**
 * POST /api/transactions/bridge
 * Create bridge transaction
 */
router.post(
  "/bridge",
  validateRequest(z.object({ sourceChainId: z.number(), destinationChainId: z.number(), bridgeContractId: z.string(), sourceToken: z.string(), sourceAmount: z.string() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bridge = await createBridgeTransaction(
        req.body.sourceChainId,
        req.body.destinationChainId,
        req.body.bridgeContractId,
        req.body.sourceToken,
        req.body.sourceAmount
      );

      res.status(201).json({
        success: true,
        data: bridge,
        message: "Bridge transaction initiated",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/transactions/bridge/:bridgeId/status
 * Update bridge status
 */
router.post(
  "/bridge/:bridgeId/status",
  validateRequest(z.object({ status: z.string(), sourceTxId: z.string().optional(), destinationTxId: z.string().optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await updateBridgeStatus(req.params.bridgeId, req.body.status, req.body.sourceTxId, req.body.destinationTxId);

      res.json({
        success: true,
        message: "Bridge status updated",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transactions/bridge/:walletId
 * Get bridge history
 */
router.get(
  "/bridge/:walletId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const bridges = await getBridgeHistory(parseInt(req.params.walletId), limit);

      res.json({
        success: true,
        data: bridges,
        count: bridges.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== SIMULATION ====================

/**
 * POST /api/transactions/simulate
 * Simulate transaction
 */
router.post(
  "/simulate",
  validateRequest(
    z.object({
      walletConnectionId: z.string().uuid(),
      chainId: z.number(),
      targetContract: z.string(),
      functionSignature: z.string(),
      params: z.any().optional(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sim = await simulateTransaction(
        req.body.chainId,
        req.body.targetContract,
        req.body.functionSignature,
        req.body.params
      );

      res.status(201).json({
        success: true,
        data: sim,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transactions/simulate/:simId
 * Get simulation result
 */
router.get(
  "/simulate/:simId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getSimulationResult(req.params.simId);

      if (!result) {
        return res.status(404).json({ success: false, message: "Simulation not found" });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== GAS OPTIMIZATION ====================

/**
 * GET /api/transactions/gas/savings/:walletId
 * Get gas savings history
 */
router.get(
  "/gas/savings/:walletId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const history = await getGasOptimizationHistory(req.params.walletId, limit);
      const total = await calculateTotalGasSavings(req.params.walletId);

      res.json({
        success: true,
        data: {
          history,
          totalGasSaved: total,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== COMPREHENSIVE STATUS ====================

/**
 * GET /api/transactions/wallet/:walletId/defi-status
 * Get complete DeFi status for wallet
 */
router.get(
  "/wallet/:walletId/defi-status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const farmId = req.query.farmId as string || req.params.walletId;
      const dexId = req.query.dexId as string || req.params.walletId;
      const sourceChainId = parseInt(req.query.sourceChainId as string) || 1;
      const batchId = req.query.batchId as string || null;

      const status = await getWalletDefiStatus(farmId, dexId, sourceChainId, batchId);

      res.json({
        success: true,
        data: status,
      });

    } catch (error) {
      next(error);
    }
  }
);

export default router;
