/**
 * Advanced Features Routes - Phase 4
 * REST API endpoints for MEV protection, LP management, staking, options, analytics, and risk management
 */

import { Router, Request, Response, NextFunction } from "express";
import {
  createMEVStrategy,
  recordMEVTransaction,
  getMEVSavingsSummary,
  createLPPosition,
  claimLPFees,
  calculateImpermanentLoss,
  getLPPortfolioSummary,
  createStakingPosition,
  claimStakingRewards,
  calculateUnstakePenalty,
  getStakingSummary,
  createOptionsStrategy,
  addOptionLeg,
  closeOptionPosition,
  getOptionsPortfolioSummary,
  createPortfolioSnapshot,
  calculatePortfolioMetrics,
  getPortfolioPerformance,
  calculateValueAtRisk,
  createRiskAlert,
  getActiveRiskAlerts,
  calculateLiquidationRisk,
  getRiskSummary,
  getWalletAdvancedStatus,
} from "../services/advanced-features-service";
import { authenticateToken } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import {
  mevStrategySchema,
  lpPositionSchema,
  stakingPositionSchema,
  optionStrategySchema,
} from "@shared/advancedFeaturesSchema";
import { z } from "zod";

const router = Router();

// ==================== MEV PROTECTION ====================

/**
 * POST /api/advanced/mev/strategies
 * Create MEV protection strategy
 */
router.post(
  "/mev/strategies",
  validateRequest(mevStrategySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const strategy = await createMEVStrategy(
        req.body.walletConnectionId,
        req.body.strategyName,
        req.body.strategyType,
        req.body.protectionLevel
      );

      res.status(201).json({
        success: true,
        data: strategy,
        message: "MEV strategy created",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/advanced/mev/strategies/:strategyId/transactions
 * Record MEV-protected transaction
 */
router.post(
  "/mev/strategies/:strategyId/transactions",
  validateRequest(
    z.object({
      transactionId: z.string().uuid(),
      originalGasPrice: z.string(),
      protectedGasPrice: z.string(),
      estimatedMevLoss: z.string(),
      actualMevSavings: z.string(),
      executionPath: z.string(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mevTx = await recordMEVTransaction(
        req.params.strategyId,
        req.body.transactionId,
        req.body.originalGasPrice,
        req.body.protectedGasPrice,
        req.body.estimatedMevLoss,
        req.body.actualMevSavings,
        req.body.executionPath
      );

      res.status(201).json({
        success: true,
        data: mevTx,
        message: "MEV transaction recorded",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/advanced/mev/:walletId/summary
 * Get MEV savings summary
 */
router.get(
  "/mev/:walletId/summary",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await getMEVSavingsSummary(req.params.walletId);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== LIQUIDITY PROVIDER ====================

/**
 * POST /api/advanced/lp/positions
 * Create LP position
 */
router.post(
  "/lp/positions",
  validateRequest(lpPositionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const position = await createLPPosition(
        req.body.walletConnectionId,
        req.body.poolId,
        req.body.token0Amount,
        req.body.token1Amount,
        req.body.token0Amount, // simplified USD calculation
        req.body.token1Amount,
        req.body.priceRangeLow,
        req.body.priceRangeHigh
      );

      res.status(201).json({
        success: true,
        data: position,
        message: "LP position created",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/advanced/lp/positions/:positionId/claim-fees
 * Claim LP fees
 */
router.post(
  "/lp/positions/:positionId/claim-fees",
  validateRequest(
    z.object({
      feesAmount: z.string(),
      feesAmountUsd: z.string(),
      token0Fees: z.string().optional(),
      token1Fees: z.string().optional(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const claimId = await claimLPFees(
        req.params.positionId,
        req.body.feesAmount,
        req.body.feesAmountUsd,
        req.body.token0Fees,
        req.body.token1Fees
      );

      res.status(201).json({
        success: true,
        data: { claimId },
        message: "LP fees claimed",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/advanced/lp/positions/:positionId/calculate-il
 * Calculate impermanent loss
 */
router.post(
  "/lp/positions/:positionId/calculate-il",
  validateRequest(
    z.object({
      currentPrice0: z.string(),
      currentPrice1: z.string(),
      initialPrice0: z.string(),
      initialPrice1: z.string(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const il = await calculateImpermanentLoss(
        req.params.positionId,
        req.body.currentPrice0,
        req.body.currentPrice1,
        req.body.initialPrice0,
        req.body.initialPrice1
      );

      res.json({
        success: true,
        data: { impermanentLoss: il },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/advanced/lp/:walletId/summary
 * Get LP portfolio summary
 */
router.get(
  "/lp/:walletId/summary",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await getLPPortfolioSummary(req.params.walletId);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== STAKING ====================

/**
 * POST /api/advanced/staking/positions
 * Create staking position
 */
router.post(
  "/staking/positions",
  validateRequest(stakingPositionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const position = await createStakingPosition(
        req.body.walletConnectionId,
        req.body.protocolId,
        req.body.stakedAmount,
        req.body.stakedAmount // simplified USD calc
      );

      res.status(201).json({
        success: true,
        data: position,
        message: "Staking position created",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/advanced/staking/positions/:positionId/claim-rewards
 * Claim staking rewards
 */
router.post(
  "/staking/positions/:positionId/claim-rewards",
  validateRequest(
    z.object({
      rewardAmount: z.string(),
      rewardAmountUsd: z.string(),
      rewardRate: z.number(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rewardId = await claimStakingRewards(
        req.params.positionId,
        req.body.rewardAmount,
        req.body.rewardAmountUsd,
        req.body.rewardRate
      );

      res.status(201).json({
        success: true,
        data: { rewardId },
        message: "Staking rewards claimed",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/advanced/staking/positions/:positionId/calculate-penalty
 * Calculate unstake penalty
 */
router.post(
  "/staking/positions/:positionId/calculate-penalty",
  validateRequest(z.object({ currentPrice: z.string() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const penalty = await calculateUnstakePenalty(req.params.positionId, req.body.currentPrice);

      res.json({
        success: true,
        data: { penaltyUsd: penalty },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/advanced/staking/:walletId/summary
 * Get staking summary
 */
router.get(
  "/staking/:walletId/summary",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await getStakingSummary(req.params.walletId);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== OPTIONS ====================

/**
 * POST /api/advanced/options/strategies
 * Create options strategy
 */
router.post(
  "/options/strategies",
  validateRequest(optionStrategySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const strategy = await createOptionsStrategy(
        req.body.walletConnectionId,
        req.body.strategyName,
        req.body.strategyType,
        req.body.underlyingAsset
      );

      res.status(201).json({
        success: true,
        data: strategy,
        message: "Options strategy created",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/advanced/options/strategies/:strategyId/legs
 * Add option leg to strategy
 */
router.post(
  "/options/strategies/:strategyId/legs",
  validateRequest(
    z.object({
      optionType: z.enum(["call", "put"]),
      positionType: z.enum(["long", "short"]),
      strikePrice: z.string(),
      expirationDate: z.string().datetime(),
      quantity: z.number(),
      premium: z.string(),
      premiumUsd: z.string(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const legId = await addOptionLeg(
        req.params.strategyId,
        req.body.optionType,
        req.body.positionType,
        req.body.strikePrice,
        new Date(req.body.expirationDate),
        req.body.quantity,
        req.body.premium,
        req.body.premiumUsd
      );

      res.status(201).json({
        success: true,
        data: { legId },
        message: "Option leg added",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/advanced/options/legs/:legId/close
 * Close option position
 */
router.post(
  "/options/legs/:legId/close",
  validateRequest(
    z.object({
      closurePrice: z.string(),
      realizedPnl: z.string(),
      pnlPercent: z.number(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const closureId = await closeOptionPosition(
        req.params.legId,
        req.body.closurePrice,
        req.body.realizedPnl,
        req.body.pnlPercent
      );

      res.json({
        success: true,
        data: { closureId },
        message: "Option position closed",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/advanced/options/:walletId/summary
 * Get options portfolio summary
 */
router.get(
  "/options/:walletId/summary",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await getOptionsPortfolioSummary(req.params.walletId);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== PORTFOLIO ANALYTICS ====================

/**
 * POST /api/advanced/portfolio/snapshots
 * Create portfolio snapshot
 */
router.post(
  "/portfolio/snapshots",
  validateRequest(
    z.object({
      walletConnectionId: z.string().uuid(),
      totalAssetsUsd: z.string(),
      totalDebtUsd: z.string(),
      breakdown: z.object({
        cash: z.string(),
        staking: z.string(),
        lp: z.string(),
        yieldFarming: z.string(),
        options: z.string(),
      }),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const snapshot = await createPortfolioSnapshot(
        req.body.walletConnectionId,
        req.body.totalAssetsUsd,
        req.body.totalDebtUsd,
        req.body.breakdown
      );

      res.status(201).json({
        success: true,
        data: snapshot,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/advanced/portfolio/:walletId/performance
 * Get portfolio performance
 */
router.get(
  "/portfolio/:walletId/performance",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const daysBack = Math.min(parseInt(req.query.daysBack as string) || 30, 365);
      const performance = await getPortfolioPerformance(req.params.walletId, daysBack);

      res.json({
        success: true,
        data: performance,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== RISK MANAGEMENT ====================

/**
 * POST /api/advanced/risk/var
 * Calculate Value at Risk
 */
router.post(
  "/risk/var",
  validateRequest(
    z.object({
      walletConnectionId: z.string().uuid(),
      portfolioValue: z.number(),
      volatility: z.number(),
      confidence: z.number().optional(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const varModel = await calculateValueAtRisk(
        req.body.walletConnectionId,
        req.body.portfolioValue,
        req.body.volatility,
        req.body.confidence
      );

      res.status(201).json({
        success: true,
        data: varModel,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/advanced/risk/alerts
 * Create risk alert
 */
router.post(
  "/risk/alerts",
  validateRequest(
    z.object({
      walletConnectionId: z.string().uuid(),
      alertType: z.string(),
      severity: z.enum(["info", "warning", "critical"]),
      riskMetric: z.string(),
      currentValue: z.string(),
      threshold: z.string(),
      recommendation: z.string().optional(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alert = await createRiskAlert(
        req.body.walletConnectionId,
        req.body.alertType,
        req.body.severity,
        req.body.riskMetric,
        req.body.currentValue,
        req.body.threshold,
        req.body.recommendation
      );

      res.status(201).json({
        success: true,
        data: alert,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/advanced/risk/:walletId/alerts
 * Get active risk alerts
 */
router.get(
  "/risk/:walletId/alerts",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alerts = await getActiveRiskAlerts(req.params.walletId);

      res.json({
        success: true,
        data: alerts,
        count: alerts.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/advanced/risk/liquidation
 * Calculate liquidation risk
 */
router.post(
  "/risk/liquidation",
  validateRequest(
    z.object({
      walletConnectionId: z.string().uuid(),
      protocolName: z.string(),
      totalBorrowedUsd: z.number(),
      totalCollateralUsd: z.number(),
      liquidationThreshold: z.number().optional(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const risk = await calculateLiquidationRisk(
        req.body.walletConnectionId,
        req.body.protocolName,
        req.body.totalBorrowedUsd,
        req.body.totalCollateralUsd,
        req.body.liquidationThreshold
      );

      res.status(201).json({
        success: true,
        data: risk,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/advanced/risk/:walletId/summary
 * Get comprehensive risk summary
 */
router.get(
  "/risk/:walletId/summary",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await getRiskSummary(req.params.walletId);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== COMPREHENSIVE STATUS ====================

/**
 * GET /api/advanced/:walletId/status
 * Get complete advanced features status
 */
router.get(
  "/:walletId/status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await getWalletAdvancedStatus(req.params.walletId);

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
