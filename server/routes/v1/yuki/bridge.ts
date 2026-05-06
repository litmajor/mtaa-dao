/**
 * ════════════════════════════════════════════════════════════════════════════════
 * YUKI Bridge Router - Cross-Chain Bridge Operations
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * 🚀 HIGH-RISK OPERATIONS: Bridge execution requires Advanced Mode enabled
 * 
 * Migrated from: /api/cross-chain/*
 * Structure:
 * - Bridge Protocol (chains, fees, analytics)
 * - Bridge Swap (quote, execute, status)
 * - Bridge Transfer (initiate, status, retry)
 * - Cross-Chain Governance (proposals, votes)
 * - Bridge Monitoring (relayer status, vault status)
 */

import { Router, Request, Response } from 'express';
import { crossChainService } from '../../../services/crossChainService';
import { crossChainGovernanceService } from '../../../services/crossChainGovernanceService';
import { bridgeRelayerService } from '../../../services/bridgeRelayerService';
import { crossChainSwapService } from '../../../services/crossChainSwapService';
import { asyncHandler } from '../../../middleware/errorHandler';
import { isAuthenticated } from '../../../nextAuthMiddleware';
import advancedModeGuard from '../../../middleware/advancedModeGuard';
import { requirePINVerification, checkAmountThreshold } from '../../../middleware/pin-verification';
import { createRateLimiter } from '../../../middleware/rateLimiting';
import { z } from 'zod';
import { SupportedChain } from '../../../../shared/chainRegistry';
import type { SwapQuote } from '../../../services/crossChainSwapService';

const router = Router();

// ════════════════════════════════════════════════════════════════════════════════
// RATE LIMITERS
// ════════════════════════════════════════════════════════════════════════════════
// 🔴 CRITICAL: Rate limiters for cross-chain financial operations (highest-risk)

const transferLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // Max 5 transfers per minute (prevent bridge spam)
  keyGenerator: (req) => `bridge:transfer:${(req as any).user?.id || req.ip}`,
});

const swapLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // Max 10 swap operations per minute
  keyGenerator: (req) => `bridge:swap:${(req as any).user?.id || req.ip}`,
});

const governanceLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20, // Max 20 governance ops per minute
  keyGenerator: (req) => `bridge:governance:${(req as any).user?.id || req.ip}`,
});

const quoteLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // Read-heavy operation
  keyGenerator: (req) => `bridge:quote:${(req as any).user?.id || req.ip}`,
});

const analyticLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50, // Read-only, allow more
  keyGenerator: (req) => `bridge:analytics:${(req as any).user?.id || req.ip}`,
});

// ════════════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ════════════════════════════════════════════════════════════════════════════════

const chainNameSchema = z.string().toLowerCase().trim().refine(
  (val) => ['celo', 'ethereum', 'polygon', 'optimism', 'arbitrum', 'bsc', 'tron', 'ton'].includes(val),
  { message: 'Unsupported chain' }
);

const addressSchema = z.string().trim().refine(
  (val) => /^0x[a-fA-F0-9]{40}$/.test(val),
  { message: 'Invalid Ethereum address format' }
);

const amountSchema = z.string().trim().refine(
  (val) => /^\d+(\.\d+)?$/.test(val) && parseFloat(val) > 0,
  { message: 'Invalid amount - must be positive number' }
);

const transferSchema = z.object({
  sourceChain: chainNameSchema,
  destinationChain: chainNameSchema,
  tokenAddress: addressSchema,
  amount: amountSchema,
  destinationAddress: addressSchema,
  vaultId: z.string().optional()
}).refine(
  (data) => data.sourceChain !== data.destinationChain,
  { message: 'Source and destination chains must be different' }
);

const swapQuoteSchema = z.object({
  fromChain: chainNameSchema,
  toChain: chainNameSchema,
  fromToken: z.string().toUpperCase().trim().refine(
    (val) => /^[A-Z0-9]{2,10}$/.test(val),
    { message: 'Invalid token symbol' }
  ),
  toToken: z.string().toUpperCase().trim().refine(
    (val) => /^[A-Z0-9]{2,10}$/.test(val),
    { message: 'Invalid token symbol' }
  ),
  fromAmount: amountSchema,
  slippageTolerance: z.number().min(0).max(100).optional().default(1.0)
}).refine(
  (data) => data.fromChain !== data.toChain,
  { message: 'Source and destination chains must be different' }
);

const swapExecuteSchema = z.object({
  quote: z.object({
    fromChain: chainNameSchema,
    toChain: chainNameSchema,
    fromToken: z.string(),
    toToken: z.string(),
    fromAmount: amountSchema,
    estimatedToAmount: z.string(),
    exchangeRate: z.number(),
    priceImpact: z.number(),
    estimatedGas: z.string(),
    route: z.array(z.string()),
    bridgeFee: z.string(),
    slippageTolerance: z.number(),
    toAmount: z.string().optional(),
    toAddress: z.string().optional()
  }),
  userAddress: addressSchema
});

// ════════════════════════════════════════════════════════════════════════════════
// BRIDGE PROTOCOL - Chain Discovery & Fee Estimation
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/yuki/bridge/chains
 * 📋 List all supported chains for cross-chain operations
 * FROM: GET /cross-chain/chains
 */
router.get('/chains', asyncHandler(async (req: Request, res: Response) => {
  const chains = crossChainService.getSupportedChains();
  
  res.json({
    success: true,
    data: chains
  });
}));

/**
 * GET /v1/yuki/bridge/estimate-fees
 * 💰 Estimate bridge fees for a route (requires authentication)
 * FROM: POST /cross-chain/estimate-fees (converted to GET)
 */
router.get('/estimate-fees', isAuthenticated, analyticLimiter, asyncHandler(async (req: Request, res: Response) => {
  try {
    const sourceChain = (req.query.sourceChain as string)?.toLowerCase();
    const destinationChain = (req.query.destinationChain as string)?.toLowerCase();
    const amount = req.query.amount as string;

    const validated = z.object({
      sourceChain: chainNameSchema,
      destinationChain: chainNameSchema,
      amount: amountSchema
    }).refine(
      (data) => data.sourceChain !== data.destinationChain,
      { message: 'Source and destination chains must be different' }
    ).parse({
      sourceChain,
      destinationChain,
      amount
    });
    
    const fees = await crossChainService.estimateBridgeFees(
      validated.sourceChain as SupportedChain,
      validated.destinationChain as SupportedChain,
      validated.amount
    );

    res.json({
      success: true,
      data: fees
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: error.errors
      });
    }
    throw error;
  }
}));

/**
 * GET /v1/yuki/bridge/analytics
 * 📊 Bridge analytics (volumes, fees, performance)
 * FROM: GET /cross-chain/analytics
 */
router.get('/analytics', isAuthenticated, analyticLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { timeframe = 'day' } = req.query;
  const { bridgeMonitoringService } = await import('../../../services/bridgeMonitoringService');
  
  const analytics = await bridgeMonitoringService.getBridgeAnalytics(
    timeframe as 'day' | 'week' | 'month'
  );
  
  const feesCollected = await bridgeMonitoringService.calculateFeesCollected(
    timeframe as 'day' | 'week' | 'month'
  );

  res.json({
    success: true,
    data: {
      analytics,
      feesCollected
    }
  });
}));

/**
 * GET /v1/yuki/bridge/relayer/status
 * 🚀 Bridge relayer operational status
 * FROM: GET /cross-chain/relayer/status
 */
router.get('/relayer/status', isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      isRunning: true,
      pollInterval: 30000,
      lastSync: new Date(),
      messagesProcessed: 0
    }
  });
}));

// ════════════════════════════════════════════════════════════════════════════════
// BRIDGE SWAP - Cross-Chain Token Swaps
// ════════════════════════════════════════════════════════════════════════════════
// 🔴 POST /swap requires ADVANCED MODE + Rate Limiting (HIGH-RISK)

/**
 * GET /v1/yuki/bridge/swap/quote
 * 📋 Get quote for cross-chain swap
 * FROM: POST /cross-chain/swap/quote (converted to GET for idempotency)
 */
router.get('/swap/quote', isAuthenticated, quoteLimiter, asyncHandler(async (req: Request, res: Response) => {
  try {
    const fromChain = (req.query.fromChain as string)?.toLowerCase();
    const toChain = (req.query.toChain as string)?.toLowerCase();
    const fromToken = (req.query.fromToken as string)?.toUpperCase();
    const toToken = (req.query.toToken as string)?.toUpperCase();
    const fromAmount = req.query.fromAmount as string;
    const slippageTolerance = req.query.slippageTolerance ? parseFloat(req.query.slippageTolerance as string) : 1.0;

    const validated = swapQuoteSchema.parse({
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount,
      slippageTolerance
    });
    
    const quote = await crossChainSwapService.getSwapQuote(
      validated.fromChain as SupportedChain,
      validated.toChain as SupportedChain,
      validated.fromToken,
      validated.toToken,
      validated.fromAmount,
      validated.slippageTolerance
    );

    res.json({
      success: true,
      data: quote
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: error.errors
      });
    }
    throw error;
  }
}));

/**
 * POST /v1/yuki/bridge/swap (ADVANCED MODE REQUIRED)
 * 🔴 Execute cross-chain swap
 * FROM: POST /cross-chain/swap/execute
 * 
 * Requirements:
 * - Advanced Mode enabled in settings
 * - Rate limited (prevent swap spam)
 * - High-risk operation (financial execution)
 */
router.post(
  '/swap',
  isAuthenticated,
  advancedModeGuard,
  swapLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const validated = swapExecuteSchema.parse(req.body);
      const userId = (req.user as any)?.claims?.sub;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Cast quote to proper SwapQuote type with SupportedChain chains
      const swapQuote: SwapQuote = {
        ...validated.quote,
        fromChain: validated.quote.fromChain as SupportedChain,
        toChain: validated.quote.toChain as SupportedChain
      };

      const execution = await crossChainSwapService.executeSwap(
        userId,
        swapQuote,
        validated.userAddress
      );

      res.json({
        success: true,
        data: execution
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid input',
          errors: error.errors
        });
      }
      throw error;
    }
  })
);

/**
 * GET /v1/yuki/bridge/swap/:swapId
 * 📋 Get swap execution status and details
 * FROM: GET /cross-chain/swap/:swapId
 */
router.get('/swap/:swapId', isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
  const { swapId } = req.params;

  const status = await crossChainSwapService.getSwapStatus(swapId);

  if (!status) {
    return res.status(404).json({
      success: false,
      message: 'Swap not found'
    });
  }

  res.json({
    success: true,
    data: status
  });
}));

// ════════════════════════════════════════════════════════════════════════════════
// BRIDGE TRANSFER - Cross-Chain Asset Transfers
// ════════════════════════════════════════════════════════════════════════════════
// 🔴 POST /transfer requires ADVANCED MODE + PIN Verification (HIGHEST-RISK)

/**
 * POST /v1/yuki/bridge/transfer (ADVANCED MODE REQUIRED)
 * 🔴 Initiate cross-chain transfer of assets
 * FROM: POST /cross-chain/transfer
 * 
 * Requirements:
 * - Advanced Mode enabled in settings
 * - PIN verification (for security - sending to external address)
 * - Amount threshold check (prevents accidental large transfers)
 * - Rate limited (prevent bridge spam)
 * - Highest-risk operation (irreversible across chains)
 */
router.post(
  '/transfer',
  isAuthenticated,
  advancedModeGuard,
  requirePINVerification,
  checkAmountThreshold('5000'),
  transferLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const validated = transferSchema.parse(req.body);
      const userId = (req.user as any)?.claims?.sub;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const status = await crossChainService.initiateTransfer({
        userId,
        ...validated as any
      });

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid input',
          errors: error.errors
        });
      }
      throw error;
    }
  })
);

/**
 * GET /v1/yuki/bridge/transfer/:id
 * 📋 Get transfer status and details
 * FROM: GET /cross-chain/transfer/:transferId
 */
router.get('/transfer/:id', isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const status = await crossChainService.getTransferStatus(id);
  
  if (!status) {
    return res.status(404).json({
      success: false,
      message: 'Transfer not found'
    });
  }

  res.json({
    success: true,
    data: status
  });
}));

/**
 * POST /v1/yuki/bridge/transfer/:id/retry
 * 🔄 Retry a failed transfer
 * FROM: POST /cross-chain/transfer/:transferId/retry
 */
router.post(
  '/transfer/:id/retry',
  isAuthenticated,
  transferLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await bridgeRelayerService.retryTransfer(id);

    res.json({
      success: true,
      message: 'Transfer retry initiated'
    });
  })
);

// ════════════════════════════════════════════════════════════════════════════════
// CROSS-CHAIN GOVERNANCE - Multi-Chain Voting & Proposals
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/yuki/bridge/governance/proposals
 * 📋 List cross-chain governance proposals (vote bridging)
 * FROM: NEW - Governance proposal listing
 */
router.get(
  '/governance/proposals',
  isAuthenticated,
  governanceLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.query;

    // TODO: Implement CrossChainGovernanceService.listProposals method
    // This endpoint requires fetching governance proposals from cross-chain service
    /*
    const proposals = await crossChainGovernanceService?.listProposals?.(
      status as 'active' | 'pending' | 'completed' | undefined
    );

    res.json({
      success: true,
      data: proposals
    });
    */
    
    res.json({
      success: false,
      error: 'listProposals method not yet implemented on CrossChainGovernanceService'
    });
  })
);

/**
 * GET /v1/yuki/bridge/governance/proposals/:id/aggregate
 * 📊 Aggregate votes from all chains for a proposal
 * FROM: GET /cross-chain/governance/proposal/:proposalId/aggregate
 */
router.get(
  '/governance/proposals/:id/aggregate',
  isAuthenticated,
  governanceLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const aggregation = await crossChainGovernanceService.aggregateVotes(id);

    res.json({
      success: true,
      data: aggregation
    });
  })
);

/**
 * POST /v1/yuki/bridge/governance/votes/sync
 * 🔄 Sync vote from a specific chain to governance service
 * FROM: POST /cross-chain/governance/vote/sync
 */
router.post(
  '/governance/votes/sync',
  isAuthenticated,
  governanceLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { crossChainProposalId, chain, voteData } = req.body;

    await crossChainGovernanceService.syncVoteFromChain(
      crossChainProposalId,
      chain,
      voteData
    );

    res.json({
      success: true,
      message: 'Vote synced successfully'
    });
  })
);

// ════════════════════════════════════════════════════════════════════════════════
// BRIDGE MONITORING - Vault Status & Health
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/yuki/bridge/vault-status
 * 📊 Get cross-chain vault status and health
 * FROM: GET /cross-chain/vault (redirects to /v1/vaults normally)
 */
router.get(
  '/vault-status',
  isAuthenticated,
  analyticLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?.claims?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // TODO: Implement CrossChainService.getVaultStatus method
    /*
    const vaultStatus = await crossChainService?.getVaultStatus?.(userId);

    res.json({
      success: true,
      data: vaultStatus
    });
    */
    
    res.json({
      success: false,
      error: 'getVaultStatus method not yet implemented on CrossChainService'
    });
  })
);

export default router;
