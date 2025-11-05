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

// Placeholder for a potential proposal execution endpoint which would use the quorum logic
// This section is based on the provided changes snippet and assumes a context where proposal execution happens.
// The original code provided does not contain this execution logic, so it's added here based on the changes.
// If this logic should reside elsewhere, it needs to be moved accordingly.

// Example structure for a proposal execution (conceptual, not directly in original code)
// router.post('/:proposalId/execute', isAuthenticated, async (req, res) => {
//   try {
//     const { proposalId } = req.params;
//     const userId = (req.user as any).claims.sub; // Assuming user is authenticated
//     const proposal = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
//     if (!proposal.length) {
//       return res.status(404).json({ message: 'Proposal not found' });
//     }
//     const proposalData = proposal[0];
//     const now = new Date();
//     const votingEndTime = proposalData.voteEndTime;
//     const yesVotes = (proposalData.pollOptions as any[] || []).find(opt => opt.id === 'yes')?.votes || 0;
//     const noVotes = (proposalData.pollOptions as any[] || []).find(opt => opt.id === 'no')?.votes || 0;
//
//     // Execute the proposal if voting period ended and it passed
//     if (now > votingEndTime && proposalData.status === 'active') {
//       const totalVotes = yesVotes + noVotes;
//       const passPercentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;
//
//       // CRITICAL: Check quorum (minimum participation)
//       const dao = await db.select().from(daos).where(eq(daos.id, proposalData.daoId)).limit(1);
//       const requiredQuorum = dao[0]?.quorumPercentage || 20; // Default 20%
//       const memberCount = dao[0]?.memberCount || 1;
//       const participationRate = (totalVotes / memberCount) * 100;
//
//       if (participationRate < requiredQuorum) {
//         // Failed quorum - reject proposal
//         await db.update(proposals)
//           .set({
//             status: 'rejected',
//             metadata: sql`jsonb_set(COALESCE(metadata, '{}'::jsonb), '{rejection_reason}', '"Failed to meet quorum"')`
//           })
//           .where(eq(proposals.id, proposalId));
//       } else if (passPercentage >= 60) {
//         await db.update(proposals)
//           .set({ status: 'approved' })
//           .where(eq(proposals.id, proposalId));
//         // TODO: Add logic to actually execute the proposal action here
//       } else {
//         await db.update(proposals)
//           .set({ status: 'rejected' })
//           .where(eq(proposals.id, proposalId));
//       }
//       res.json({ success: true, message: 'Proposal execution processed.' });
//     } else {
//       res.status(400).json({ message: 'Voting period not ended or proposal not active.' });
//     }
//   } catch (error: any) {
//     res.status(500).json({
//       success: false,
//       message: 'Failed to execute proposal',
//       error: error.message
//     });
//   }
// });


export default router;