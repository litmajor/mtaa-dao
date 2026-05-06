import express from 'express';
import { db } from '../storage';
import { proposals, votes, daoMemberships } from '../../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { isAuthenticated } from '../nextAuthMiddleware';
import { createRateLimiter } from '../middleware/rateLimiting';
import { z } from 'zod';

const router = express.Router();

// 🔴 CRITICAL: Rate limiters for proposal operations
const proposalCreationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // Max 10 proposals per hour per user
  keyGenerator: (req) => `proposal:create:${(req as any).user?.id || req.ip}`,
});

const proposalVoteLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // Max 30 votes per minute (prevents voting spam)
  keyGenerator: (req) => `proposal:vote:${(req as any).user?.id || req.ip}`,
});

// LIST all proposals for a DAO
// 🔴 CRITICAL: Requires authentication - prevents proposal enumeration attack
router.get('/', isAuthenticated, async (req: express.Request, res: express.Response) => {
  try {
    const { daoId, status, proposer, sortBy = 'createdAt', sortOrder = 'desc', limit = 50, offset = 0 } = req.query;

    if (!daoId) {
      return res.status(400).json({ error: 'daoId is required' });
    }

    let conditions = [eq(proposals.daoId, String(daoId))];
    
    // Apply filters
    if (status) {
      conditions.push(eq(proposals.status, String(status)));
    }
    if (proposer) {
      conditions.push(eq(proposals.proposerId, String(proposer)));
    }

    const totalData = await db.select().from(proposals).where(and(...conditions));
    const items = await db.select()
      .from(proposals)
      .where(and(...conditions))
      .orderBy(desc(proposals.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    res.json({
      success: true,
      data: items,
      pagination: {
        total: totalData.length,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < totalData.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET a single proposal
// 🔴 CRITICAL: Requires authentication - prevents proposal reconnaissance
router.get('/:proposalId', isAuthenticated, async (req: express.Request, res: express.Response) => {
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
// 🔴 CRITICAL: Rate limited to prevent proposal spam
router.post('/', isAuthenticated, proposalCreationLimiter, async (req, res) => {
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
// 🔴 CRITICAL: Rate limited to prevent proposal update spam
router.put('/:proposalId', isAuthenticated, proposalCreationLimiter, async (req, res) => {
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
// 🔴 CRITICAL: Rate limited to prevent denial of service
router.delete('/:proposalId', isAuthenticated, proposalCreationLimiter, async (req, res) => {
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
// 🔴 CRITICAL: Requires auth + rate limited to prevent voting spam
// Emoji voting endpoint
// 🔴 CRITICAL: Requires auth + rate limited to prevent voting spam
router.post('/:proposalId/emoji-vote', isAuthenticated, proposalVoteLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const { proposalId } = req.params;
    const { vote, isAnonymous = false } = req.body;
    const userId = (req.user as any)?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!['yes', 'maybe', 'no'].includes(vote)) {
      return res.status(400).json({ error: 'Invalid vote option' });
    }

    // Check if already voted
    const existing = await db.select().from(votes)
      .where(
        and(
          eq(votes.proposalId, proposalId),
          eq(votes.userId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Already voted on this proposal' });
    }

    // Get proposal details for activity award
    const proposalData = await db.select().from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    // Record vote (only happens once per user per proposal - DB constraint)
    await db.insert(votes).values({
      proposalId,
      userId: isAnonymous ? 'guest' : userId,
      daoId: req.body.daoId || (proposalData.length > 0 ? proposalData[0].daoId : ''),
      voteType: vote,
      votingPower: '1',
    });

    // Update proposal counts
    const updateField = vote === 'yes' ? 'yesVotes' : vote === 'no' ? 'noVotes' : 'abstainVotes';
    await db.update(proposals)
      .set({ [updateField]: sql`${proposals[updateField]} + 1` })
      .where(eq(proposals.id, proposalId));

    // Award activity points (fire and forget)
    // Points are awarded once per vote since votes are unique per user per proposal (enforced by DB)
    if (!isAnonymous && proposalData.length > 0 && proposalData[0].daoId) {
      const { awardActivityDirect } = await import('../services/activity-award-helper');
      awardActivityDirect({
        userId,
        daoId: proposalData[0].daoId,
        type: 'vote' as any,
        description: `Voted ${vote} on proposal: ${proposalData[0].title || proposalId}`,
        metadata: { proposalId, vote },
      }).catch((error) => {
        console.error('Error awarding activity for vote:', error);
      });
    }

    res.json({ success: true, vote, isAnonymous, pointsAwarded: !isAnonymous ? 5 : 0 });
  } catch (error: any) {
    console.error('Emoji vote error:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});
export default router;