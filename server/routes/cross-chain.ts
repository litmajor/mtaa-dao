
import { Router } from 'express';
import { crossChainService } from '../services/crossChainService';
import { crossChainGovernanceService } from '../services/crossChainGovernanceService';
import { bridgeRelayerService } from '../services/bridgeRelayerService';
import { asyncHandler } from '../middleware/errorHandler';
import { isAuthenticated } from '../nextAuthMiddleware';
import { z } from 'zod';

const router = Router();

const transferSchema = z.object({
  sourceChain: z.string(),
  destinationChain: z.string(),
  tokenAddress: z.string(),
  amount: z.string(),
  destinationAddress: z.string(),
  vaultId: z.string().optional()
});

// Initiate cross-chain transfer
router.post('/transfer', isAuthenticated, asyncHandler(async (req, res) => {
  const userId = (req.user as any)?.claims?.sub;
  const validated = transferSchema.parse(req.body);

  const status = await crossChainService.initiateTransfer({
    userId,
    ...validated as any
  });

  res.json({
    success: true,
    data: status
  });
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
  const { sourceChain, destinationChain, amount } = req.body;
  
  const fees = await crossChainService.estimateBridgeFees(
    sourceChain,
    destinationChain,
    amount
  );

  res.json({
    success: true,
    data: fees
  });


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

export default router;
