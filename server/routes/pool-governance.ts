import { Router } from 'express';
import { db } from '../db';
import { logger } from '../utils/logger';
import {
  poolProposals,
  poolVotes,
  poolGovernanceSettings,
} from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { poolGovernanceService } from '../services/poolGovernanceService';

const router = Router();

// =====================================================
// POOL GOVERNANCE - WEIGHTED VOTING
// =====================================================

// GET /api/pool-governance/:poolId/voting-power - Get user's voting power
router.get('/:poolId/voting-power', async (req, res) => {
  try {
    const { poolId } = req.params;
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const votingPower = await poolGovernanceService.calculateVotingPower(poolId, userId);

    res.json(votingPower);
  } catch (error) {
    logger.error('Error fetching voting power:', error);
    res.status(500).json({ error: 'Failed to fetch voting power' });
  }
});

// GET /api/pool-governance/:poolId/proposals - Get all proposals for a pool
router.get('/:poolId/proposals', async (req, res) => {
  try {
    const { poolId } = req.params;
    const { status } = req.query;

    const proposals = await poolGovernanceService.getProposals(poolId, status as string);

    res.json({ proposals });
  } catch (error) {
    logger.error('Error fetching proposals:', error);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

// GET /api/pool-governance/proposal/:proposalId - Get proposal details
router.get('/proposal/:proposalId', async (req, res) => {
  try {
    const { proposalId } = req.params;

    const [proposal] = await db
      .select()
      .from(poolProposals)
      .where(eq(poolProposals.id, proposalId));

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Get votes
    const votes = await poolGovernanceService.getProposalVotes(proposalId);

    // Check current status
    const result = await poolGovernanceService.checkAndFinalizeProposal(proposalId);

    res.json({
      proposal,
      votes,
      result,
    });
  } catch (error) {
    logger.error('Error fetching proposal:', error);
    res.status(500).json({ error: 'Failed to fetch proposal' });
  }
});

// POST /api/pool-governance/:poolId/proposals - Create a new proposal
router.post('/:poolId/proposals', async (req, res) => {
  try {
    const { poolId } = req.params;
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { title, description, proposalType, details } = req.body;

    if (!title || !description || !proposalType) {
      return res.status(400).json({ error: 'Title, description, and proposal type are required' });
    }

    const proposal = await poolGovernanceService.createProposal(
      poolId,
      userId,
      title,
      description,
      proposalType,
      details || {}
    );

    res.json({
      proposal,
      message: 'Proposal created successfully',
    });
  } catch (error) {
    logger.error('Error creating proposal:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create proposal' 
    });
  }
});

// POST /api/pool-governance/proposal/:proposalId/vote - Vote on a proposal
router.post('/proposal/:proposalId/vote', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { vote, reason } = req.body;

    if (!vote || !['for', 'against', 'abstain'].includes(vote)) {
      return res.status(400).json({ error: 'Valid vote choice required (for, against, abstain)' });
    }

    const voteRecord = await poolGovernanceService.vote(
      proposalId,
      userId,
      vote,
      reason
    );

    res.json({
      vote: voteRecord,
      message: 'Vote cast successfully',
    });
  } catch (error) {
    logger.error('Error casting vote:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to cast vote' 
    });
  }
});

// POST /api/pool-governance/proposal/:proposalId/execute - Execute a passed proposal
router.post('/proposal/:proposalId/execute', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await poolGovernanceService.executeProposal(proposalId, userId);

    res.json(result);
  } catch (error) {
    logger.error('Error executing proposal:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to execute proposal' 
    });
  }
});

// GET /api/pool-governance/:poolId/settings - Get governance settings
router.get('/:poolId/settings', async (req, res) => {
  try {
    const { poolId } = req.params;

    const [settings] = await db
      .select()
      .from(poolGovernanceSettings)
      .where(eq(poolGovernanceSettings.poolId, poolId));

    if (!settings) {
      return res.status(404).json({ error: 'Governance settings not found' });
    }

    res.json(settings);
  } catch (error) {
    logger.error('Error fetching governance settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/pool-governance/:poolId/settings - Update governance settings (admin only)
router.put('/:poolId/settings', async (req, res) => {
  try {
    const { poolId } = req.params;
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // TODO: Add admin check

    const updates = req.body;

    await db
      .update(poolGovernanceSettings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(poolGovernanceSettings.poolId, poolId));

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    logger.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;

