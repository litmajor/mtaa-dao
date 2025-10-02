
import express from 'express';
import { db } from '../storage';
import { proposals, votes } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';
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
      .where(eq(votes.proposalId, proposalId))
      .where(eq(votes.userId, userId))
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
      proposalId,
      userId,
      voteType: 'poll',
      votingPower: 1,
      metadata: { selectedOptions: optionIds }
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

export default router;
