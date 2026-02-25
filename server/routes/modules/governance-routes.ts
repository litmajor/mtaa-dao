import { Router } from 'express';
import { z } from 'zod';
import { crossChainGovernanceService } from '../../services/crossChainGovernanceService';
import { asyncHandler } from '../../middleware/errorHandler';
import { isAuthenticated } from '../../nextAuthMiddleware';
import { governanceProposalSchema, governanceVoteSchema } from './validation-schemas';

const router = Router();

// Create cross-chain proposal
router.post('/governance/proposal', isAuthenticated, asyncHandler(async (req, res) => {
  try {
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid proposal data',
        errors: error.errors
      });
    }
    throw error;
  }
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
  try {
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vote data',
        errors: error.errors
      });
    }
    throw error;
  }
}));

export const governanceRoutes = router;
