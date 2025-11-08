import express from 'express';
import { db } from '../storage';
import { proposals, votes, daos } from '../../shared/schema'; // Assuming 'daos' schema is needed for quorum
import { eq, sql, and } from 'drizzle-orm';
import { isAuthenticated } from '../auth';

const router = express.Router();

// Vote on a poll proposal
router.post('/:proposalId/poll-vote', isAuthenticated, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { optionIds } = req.body;
    const userId = (req.user as any).claims.sub;

    if (!optionIds || !Array.isArray(optionIds) || optionIds.length === 0) {
      return res.status(400).json({ message: 'Invalid option selection' });
    }

    // Get proposal
    const proposal = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
    if (!proposal.length) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    const proposalData = proposal[0];

    // Check if voting is still open
    if (new Date() > proposalData.voteEndTime || proposalData.status !== 'active') {
      return res.status(400).json({ message: 'Voting is closed' });
    }

    // Check if it's a poll type
    if (proposalData.proposalType !== 'poll') {
      return res.status(400).json({ message: 'Not a poll proposal' });
    }

    // Check if already voted
    const existingVote = await db.select().from(votes)
      .where(and(eq(votes.proposalId, proposalId), eq(votes.userId, userId)))
      .limit(1);

    if (existingVote.length) {
      return res.status(400).json({ message: 'You have already voted on this poll' });
    }

    // Update poll options votes
    const pollOptions = proposalData.pollOptions as any[] || [];
    const updatedOptions = pollOptions.map(opt => {
      if (optionIds.includes(opt.id)) {
        return { ...opt, votes: (opt.votes || 0) + 1 };
      }
      return opt;
    });

    await db.update(proposals)
      .set({ pollOptions: updatedOptions })
      .where(eq(proposals.id, proposalId));

    // Record the vote
    await db.insert(votes).values({
      proposalId: String(proposalId),
      userId,
      daoId: proposalData.daoId,
      voteType: 'poll',
      votingPower: '1'
    });

    res.json({
      success: true,
      message: 'Vote recorded successfully',
      updatedOptions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to record vote',
      error: error.message
    });
  }
});

// Execute poll proposal with quorum validation
router.post('/:proposalId/execute', isAuthenticated, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const userId = (req.user as any).claims.sub;
    
    const proposal = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
    if (!proposal.length) {
      return res.status(404).json({ message: 'Proposal not found' });
    }
    
    const proposalData = proposal[0];
    const now = new Date();
    
    // Check if voting period has ended
    if (now <= proposalData.voteEndTime) {
      return res.status(400).json({ message: 'Voting period has not ended' });
    }
    
    // Check if already executed
    if (proposalData.status !== 'active') {
      return res.status(400).json({ message: 'Proposal already processed' });
    }
    
    // Get DAO configuration
    const dao = await db.select().from(daos).where(eq(daos.id, proposalData.daoId)).limit(1);
    if (!dao.length) {
      return res.status(404).json({ message: 'DAO not found' });
    }
    
    const daoData = dao[0];
    const requiredQuorumPercentage = daoData.quorumPercentage || 20; // Default 20%
    const memberCount = daoData.memberCount || 1;
    
    // Calculate votes from poll options
    const pollOptions = proposalData.pollOptions as any[] || [];
    const totalVotes = pollOptions.reduce((sum, opt) => sum + (opt.votes || 0), 0);
    const participationRate = (totalVotes / memberCount) * 100;
    
    // CRITICAL: Enforce quorum
    if (participationRate < requiredQuorumPercentage) {
      await db.update(proposals)
        .set({
          status: 'failed',
          metadata: sql`jsonb_set(
            COALESCE(metadata, '{}'::jsonb), 
            '{rejection_reason}', 
            ${JSON.stringify(`Failed to meet quorum: ${participationRate.toFixed(2)}% participation (required: ${requiredQuorumPercentage}%)`)}
          )`
        })
        .where(eq(proposals.id, proposalId));
      
      return res.json({
        success: false,
        message: 'Proposal failed due to insufficient quorum',
        data: {
          participationRate: participationRate.toFixed(2),
          requiredQuorum: requiredQuorumPercentage,
          totalVotes,
          memberCount
        }
      });
    }
    
    // Find winning option
    const winningOption = pollOptions.reduce((max, opt) => 
      (opt.votes || 0) > (max.votes || 0) ? opt : max
    , pollOptions[0]);
    
    const winningPercentage = totalVotes > 0 ? ((winningOption.votes || 0) / totalVotes) * 100 : 0;
    const approvalThreshold = 50; // Simple majority
    
    if (winningPercentage >= approvalThreshold) {
      await db.update(proposals)
        .set({
          status: 'passed',
          metadata: sql`jsonb_set(
            COALESCE(metadata, '{}'::jsonb), 
            '{execution_details}', 
            ${JSON.stringify({
              winningOption: winningOption.text,
              winningPercentage: winningPercentage.toFixed(2),
              totalVotes,
              quorumMet: true,
              participationRate: participationRate.toFixed(2)
            })}
          )`
        })
        .where(eq(proposals.id, proposalId));
      
      res.json({
        success: true,
        message: 'Proposal passed successfully',
        data: {
          status: 'passed',
          winningOption: winningOption.text,
          winningPercentage: winningPercentage.toFixed(2),
          participationRate: participationRate.toFixed(2),
          quorumMet: true
        }
      });
    } else {
      await db.update(proposals)
        .set({
          status: 'failed',
          metadata: sql`jsonb_set(
            COALESCE(metadata, '{}'::jsonb), 
            '{rejection_reason}', 
            ${JSON.stringify(`Failed to reach approval threshold: ${winningPercentage.toFixed(2)}% (required: ${approvalThreshold}%)`)}
          )`
        })
        .where(eq(proposals.id, proposalId));
      
      res.json({
        success: false,
        message: 'Proposal failed to reach approval threshold',
        data: {
          status: 'failed',
          winningPercentage: winningPercentage.toFixed(2),
          approvalThreshold,
          participationRate: participationRate.toFixed(2)
        }
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to execute proposal',
      error: error.message
    });
  }
});


export default router;