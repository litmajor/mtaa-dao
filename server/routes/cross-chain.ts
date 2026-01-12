
import { Router } from 'express';
import { crossChainService } from '../services/crossChainService';
import { crossChainGovernanceService } from '../services/crossChainGovernanceService';
import { bridgeRelayerService } from '../services/bridgeRelayerService';
import { crossChainSwapService } from '../services/crossChainSwapService';
import { asyncHandler } from '../middleware/errorHandler';
import { isAuthenticated } from '../nextAuthMiddleware';
import { z } from 'zod';

const router = Router();

// Validation schemas with sanitization
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

const feesSchema = z.object({
  sourceChain: chainNameSchema,
  destinationChain: chainNameSchema,
  amount: amountSchema
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
  quote: z.object({}).passthrough(),
  userAddress: addressSchema
});

// Initiate cross-chain transfer
router.post('/transfer', isAuthenticated, asyncHandler(async (req, res) => {
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
}));

// Get transfer status
router.get('/transfer/:transferId', isAuthenticated, asyncHandler(async (req, res) => {
  const { transferId } = req.params;
  
  const status = await crossChainService.getTransferStatus(transferId);
  
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

// Get supported chains
router.get('/chains', asyncHandler(async (req, res) => {
  const chains = crossChainService.getSupportedChains();
  
  res.json({
    success: true,
    data: chains
  });
}));

// Estimate bridge fees
router.post('/estimate-fees', asyncHandler(async (req, res) => {
  try {
    const validated = feesSchema.parse(req.body);
    
    const fees = await crossChainService.estimateBridgeFees(
      validated.sourceChain,
      validated.destinationChain,
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


// Create cross-chain proposal
router.post('/governance/proposal', isAuthenticated, asyncHandler(async (req, res) => {
  const { proposalId, chains, executionChain } = req.body;

  const crossChainProposalId = await crossChainGovernanceService.createCrossChainProposal(
    proposalId,
    chains,
    executionChain
  );

  res.json({
    success: true,
    data: { crossChainProposalId }
  });
}));

// Aggregate cross-chain votes
router.get('/governance/proposal/:proposalId/aggregate', asyncHandler(async (req, res) => {
  const { proposalId } = req.params;

  const aggregation = await crossChainGovernanceService.aggregateVotes(proposalId);

  res.json({
    success: true,
    data: aggregation
  });
}));

// Sync vote from chain
router.post('/governance/vote/sync', asyncHandler(async (req, res) => {
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
}));

// Retry failed transfer
router.post('/transfer/:transferId/retry', isAuthenticated, asyncHandler(async (req, res) => {
  const { transferId } = req.params;

  await bridgeRelayerService.retryTransfer(transferId);

  res.json({
    success: true,
    message: 'Transfer retry initiated'
  });
}));

// Get relayer status
router.get('/relayer/status', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      isRunning: true,
      pollInterval: 30000
    }
  });
}));

// Get bridge analytics
router.get('/analytics', asyncHandler(async (req, res) => {
  const { timeframe = 'day' } = req.query;
  const { bridgeMonitoringService } = await import('../services/bridgeMonitoringService');
  
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

}));

// Create cross-chain vault
router.post('/vault', isAuthenticated, asyncHandler(async (req, res) => {
  const userId = (req.user as any)?.claims?.sub;
  const { chains, name } = req.body;

  const vaultId = await crossChainService.createCrossChainVault(
    userId,
    chains,
    name
  );

  res.json({
    success: true,
    data: { vaultId }
  });
}));

// Get swap quote
router.post('/swap/quote', isAuthenticated, asyncHandler(async (req, res) => {
  try {
    const validated = swapQuoteSchema.parse(req.body);
    
    const quote = await crossChainSwapService.getSwapQuote(
      validated.fromChain,
      validated.toChain,
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

// Execute swap
router.post('/swap/execute', isAuthenticated, asyncHandler(async (req, res) => {
  try {
    const validated = swapExecuteSchema.parse(req.body);
    const userId = (req.user as any)?.claims?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const execution = await crossChainSwapService.executeSwap(
      userId,
      validated.quote,
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
}));

// Get swap status
router.get('/swap/:swapId', isAuthenticated, asyncHandler(async (req, res) => {
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

export default router;
