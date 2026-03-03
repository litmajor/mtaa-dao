import express from 'express';
import { db } from '../storage';
import { proposals, votes, daoMemberships } from '../../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { isAuthenticated } from '../middleware/auth';
import { z } from 'zod';

const router = express.Router();

// LIST all proposals for a DAO
router.get('/', async (req, res) => {
  try {
    const { daoId, status, proposer, sortBy = 'createdAt', sortOrder = 'desc', limit = 50, offset = 0 } = req.query;

    if (!daoId) {
      return res.status(400).json({ error: 'daoId is required' });
    }

    let query = db.select().from(proposals).where(eq(proposals.daoId, String(daoId)));

    // Apply filters
    if (status) {
      query = query.where(eq(proposals.status, String(status)));
    }
    if (proposer) {
      query = query.where(eq(proposals.proposerId, String(proposer)));
    }

    const totalCount = await query;
    const items = await query
      .orderBy(proposals[sortBy as keyof typeof proposals] || proposals.createdAt, sortOrder === 'asc' ? 'asc' : 'desc')
      .limit(Number(limit))
      .offset(Number(offset));

    res.json({
      success: true,
      data: items,
      pagination: {
        total: totalCount.length,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < totalCount.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET a single proposal
router.get('/:proposalId', async (req, res) => {
  try {
    const { proposalId } = req.params;

    const proposal = await db.select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal.length) {
      return res.status(404).json({ success: false, error: 'Proposal not found' });
    }

    // Get vote count details
    const voteData = await db.select()
      .from(votes)
      .where(eq(votes.proposalId, proposalId));

    res.json({
      success: true,
      data: {
        ...proposal[0],
        voteCount: voteData.length,
        voteBreakdown: {
          yes: proposal[0].yesVotes || 0,
          no: proposal[0].noVotes || 0,
          abstain: proposal[0].abstainVotes || 0
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// CREATE a new proposal
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const {
      daoId,
      title,
      description,
      proposalType = 'general',
      voteEndTime,
      quorumRequired,
      pollOptions,
      allowMultipleChoices,
      executionData,
      tags = [],
      imageUrl
    } = req.body;
    const userId = (req.user as any)?.claims?.sub;

    // Validation
    if (!daoId || !title || !description || !voteEndTime) {
      return res.status(400).json({
        error: 'Missing required fields: daoId, title, description, voteEndTime'
      });
    }

    // Verify user is member of DAO
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, userId)))
      .limit(1);

    if (!membership.length) {
      return res.status(403).json({ error: 'You are not a member of this DAO' });
    }

    // Check proposer role permission
    const allowedRoles = ['admin', 'proposer', 'elder'];
    if (!allowedRoles.includes(membership[0].role || '')) {
      return res.status(403).json({ error: 'You do not have permission to create proposals' });
    }

    // Create proposal
    const [newProposal] = await db.insert(proposals).values({
      daoId,
      title,
      description,
      proposalType,
      proposerId: userId,
      proposer: userId,
      userId,
      voteEndTime: new Date(voteEndTime),
      voteStartTime: new Date(),
      quorumRequired: quorumRequired || 100,
      pollOptions: pollOptions || [],
      allowMultipleChoices: allowMultipleChoices || false,
      executionData: executionData || {},
      tags: tags || [],
      imageUrl,
      status: 'active',
      yesVotes: 0,
      noVotes: 0,
      abstainVotes: 0
    }).returning();

    res.status(201).json({ success: true, data: newProposal });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE a proposal (only draft status or by proposer)
router.put('/:proposalId', isAuthenticated, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const userId = (req.user as any)?.claims?.sub;
    const { title, description, proposalType, voteEndTime, quorumRequired, tags, imageUrl } = req.body;

    const proposal = await db.select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal.length) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Only proposer can update
    if (proposal[0].proposerId !== userId && proposal[0].proposer !== userId) {
      return res.status(403).json({ error: 'You can only update your own proposals' });
    }

    // Can only update if not yet voting
    if (proposal[0].status && !['draft', 'active'].includes(proposal[0].status)) {
      return res.status(400).json({ error: 'Cannot update proposals that are past voting stage' });
    }

    const [updated] = await db.update(proposals)
      .set({
        title: title || proposal[0].title,
        description: description || proposal[0].description,
        proposalType: proposalType || proposal[0].proposalType,
        voteEndTime: voteEndTime ? new Date(voteEndTime) : proposal[0].voteEndTime,
        quorumRequired: quorumRequired || proposal[0].quorumRequired,
        tags: tags || proposal[0].tags,
        imageUrl: imageUrl || proposal[0].imageUrl,
        updatedAt: new Date()
      })
      .where(eq(proposals.id, proposalId))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE a proposal (only draft status or by proposer)
router.delete('/:proposalId', isAuthenticated, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const userId = (req.user as any)?.claims?.sub;

    const proposal = await db.select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal.length) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Only proposer or DAO admin can delete
    const isMember = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, proposal[0].daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    const isProposer = proposal[0].proposerId === userId || proposal[0].proposer === userId;
    const isAdmin = isMember.length && isMember[0].role === 'admin';

    if (!isProposer && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to delete this proposal' });
    }

    // Can only delete if draft or not yet started voting
    if (proposal[0].status && !['draft', 'active'].includes(proposal[0].status)) {
      return res.status(400).json({ error: 'Cannot delete proposals that have started voting' });
    }

    // Delete associated votes
    await db.delete(votes).where(eq(votes.proposalId, proposalId));

    // Delete proposal
    await db.delete(proposals).where(eq(proposals.id, proposalId));

    res.json({ success: true, message: 'Proposal deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Emoji voting endpoint
router.post('/:proposalId/emoji-vote', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { vote, isAnonymous } = req.body;
    const userId = (req.user as any)?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!['yes', 'maybe', 'no'].includes(vote)) {
      return res.status(400).json({ error: 'Invalid vote option' });
    }

    // Check if already voted
    const existing = await db.query.votes.findFirst({
      where: and(
        eq(votes.proposalId, proposalId),
        eq(votes.userId, userId)
      )
    });

    if (existing) {
      return res.status(400).json({ error: 'Already voted on this proposal' });
    }

    // Get proposal details for activity award
    const proposalData = await db.query.proposals.findFirst({
      where: eq(proposals.id, proposalId)
    });

    // Record vote (only happens once per user per proposal - DB constraint)
    await db.insert(votes).values({
      proposalId,
      userId: isAnonymous ? 'guest' : userId,
      daoId: req.body.daoId || proposalData?.daoId || '',
      voteType: vote,
      votingPower: '1',
      metadata: { isAnonymous, originalUserId: isAnonymous ? userId : undefined }
    });

    // Update proposal counts
    const updateField = vote === 'yes' ? 'yesVotes' : vote === 'no' ? 'noVotes' : 'abstainVotes';
    await db.update(proposals)
      .set({ [updateField]: sql`${proposals[updateField]} + 1` })
      .where(eq(proposals.id, proposalId));

    // Award activity points (fire and forget)
    // Points are awarded once per vote since votes are unique per user per proposal (enforced by DB)
    if (!isAnonymous && proposalData?.daoId) {
      const { awardActivityDirect } = await import('../services/activity-award-helper');
      awardActivityDirect({
        userId,
        daoId: proposalData.daoId,
        type: 'vote' as any,
        description: `Voted ${vote} on proposal: ${proposalData.title || proposalId}`,
        metadata: { proposalId, vote },
      }).catch((error) => {
        console.error('Error awarding activity for vote:', error);
      });
    }

    res.json({ success: true, vote, isAnonymous, pointsAwarded: !isAnonymous ? 5 : 0 });
  } catch (error) {
    console.error('Emoji vote error:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});
export default router;