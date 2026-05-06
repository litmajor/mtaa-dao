/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 DAO Proposals Router
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * DAO-scoped proposal management with:
 * - Proposal CRUD operations
 * - Proposal engagement (comments, likes)
 * - Proposal voting and execution
 * - Status tracking and queue management
 *
 * Base Path: /api/v1/daos/:daoId/proposals
 * Parent ensures: isAuthenticated, validateDaoId
 *
 * Migration Sources:
 * - /api/proposals/* → /api/v1/daos/:daoId/proposals/*
 * - /api/proposal-execution/* → /api/v1/daos/:daoId/proposals/execution/*
 * - /api/proposal-engagement/* → /api/v1/daos/:daoId/proposals/engagement/*
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response, Router } from 'express';
import { db } from '../../../../storage';
import { logger } from '../../../../utils/logger';
import { 
  proposals, 
  votes, 
  daoMemberships, 
  proposalLikes,
  proposalComments, 
  commentLikes,
  proposalExecutionQueue,
  users
} from '../../../../../shared/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { createRateLimiter } from '../../../../middleware/rateLimiting';
import { ProposalExecutionService } from '../../../../proposalExecutionService';

const router: Router = express.Router({ mergeParams: true });

// ════════════════════════════════════════════════════════════════════════════════
// RATE LIMITERS
// ════════════════════════════════════════════════════════════════════════════════
const proposalCreationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  keyGenerator: (req) => `proposal:create:${(req as any).user?.id || req.ip}`,
});

const proposalVoteLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,
  keyGenerator: (req) => `proposal:vote:${(req as any).user?.id || req.ip}`,
});

// In-memory idempotency store (use Redis in production)
const executionIdempotencyMap = new Map<string, {
  idempotencyKey: string;
  executedAt: Date;
  result: any;
}>();

// Helper to get userId with proper type narrowing
function getUserId(req: any): string | null {
  return (req.user as any)?.id || (req.user as any)?.claims?.sub || null;
}

// Helper to get daoId from params
function getDaoId(req: any): string {
  return req.params?.daoId || '';
}

// ════════════════════════════════════════════════════════════════════════════════
// PROPOSALS - CRUD OPERATIONS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/daos/:daoId/proposals
 * List all proposals for this DAO
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const { status, proposer, sortBy = 'createdAt', sortOrder = 'desc', limit = 50, offset = 0 } = req.query;

    let conditions: any[] = [eq(proposals.daoId, daoId)];
    
    // Apply filters
    if (status) {
      conditions.push(eq(proposals.status, String(status)));
    }
    if (proposer) {
      conditions.push(eq(proposals.userId, String(proposer)));
    }

    // Get total count
    const totalData = await db.select().from(proposals).where(and(...conditions));
    
    // Get paginated results
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
    logger.error(`Error fetching proposals for DAO ${req.params.daoId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/daos/:daoId/proposals
 * Create a new proposal
 */
router.post('/', proposalCreationLimiter, async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const {
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

    // Validation
    if (!title || !description || !voteEndTime) {
      return res.status(400).json({
        error: 'Missing required fields: title, description, voteEndTime'
      });
    }

    // Verify user is DAO member with proposal creation permission
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId), 
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (!membership.length) {
      return res.status(403).json({ error: 'You are not a member of this DAO' });
    }

    const allowedRoles = ['admin', 'proposer', 'elder', 'creator'];
    if (!allowedRoles.includes(membership[0].role || '')) {
      return res.status(403).json({ error: 'You do not have permission to create proposals' });
    }

    // Create proposal
    const [newProposal] = await db.insert(proposals).values({
      daoId,
      title,
      description,
      proposalType,
      userId,
      proposerId: userId,
      proposer: userId,
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
    logger.error(`Error creating proposal for DAO ${req.params.daoId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/daos/:daoId/proposals/:proposalId
 * Get specific proposal details with vote breakdown
 */
router.get('/:proposalId', async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const { proposalId } = (req as any).params;

    const proposal = await db.select()
      .from(proposals)
      .where(and(
        eq(proposals.id, proposalId),
        eq(proposals.daoId, daoId)
      ))
      .limit(1);

    if (!proposal.length) {
      return res.status(404).json({ success: false, error: 'Proposal not found' });
    }

    // Get vote details
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
    logger.error(`Error fetching proposal ${req.params.proposalId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/v1/daos/:daoId/proposals/:proposalId
 * Update a proposal (only draft/active status or by proposer)
 */
router.put('/:proposalId', proposalCreationLimiter, async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const { proposalId } = (req as any).params;
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { title, description, proposalType, voteEndTime, quorumRequired, tags, imageUrl } = req.body;

    const proposal = await db.select()
      .from(proposals)
      .where(and(
        eq(proposals.id, proposalId),
        eq(proposals.daoId, daoId)
      ))
      .limit(1);

    if (!proposal.length) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Only proposer can update
    if (proposal[0].userId !== userId) {
      return res.status(403).json({ error: 'You can only update your own proposals' });
    }

    // Can only update if not yet voting completed
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
    logger.error(`Error updating proposal ${req.params.proposalId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/v1/daos/:daoId/proposals/:proposalId
 * Delete a proposal (only draft/active status or by proposer/admin)
 */
router.delete('/:proposalId', proposalCreationLimiter, async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const { proposalId } = (req as any).params;
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const proposal = await db.select()
      .from(proposals)
      .where(and(
        eq(proposals.id, proposalId),
        eq(proposals.daoId, daoId)
      ))
      .limit(1);

    if (!proposal.length) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Check if proposer or DAO admin
    const isMember = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    const isProposer = proposal[0].userId === userId;
    const isAdmin = isMember.length && isMember[0].role === 'admin';

    if (!isProposer && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to delete this proposal' });
    }

    // Can only delete if draft or not yet started voting
    if (proposal[0].status && !['draft', 'active'].includes(proposal[0].status)) {
      return res.status(400).json({ error: 'Cannot delete proposals that have started voting' });
    }

    // Delete associated data (votes, comments, likes)
    await db.delete(votes).where(eq(votes.proposalId, proposalId));
    await db.delete(proposalComments).where(eq(proposalComments.proposalId, proposalId));
    await db.delete(proposalLikes).where(eq(proposalLikes.proposalId, proposalId));

    // Delete proposal
    await db.delete(proposals).where(eq(proposals.id, proposalId));

    res.json({ success: true, message: 'Proposal deleted successfully' });
  } catch (error: any) {
    logger.error(`Error deleting proposal ${req.params.proposalId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// PROPOSALS - VOTING
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/daos/:daoId/proposals/:proposalId/vote
 * Submit a vote on a proposal (yes/no/abstain)
 */
router.post('/:proposalId/vote', proposalVoteLimiter, async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const { proposalId } = (req as any).params;
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { vote, isAnonymous = false } = req.body;

    if (!['yes', 'no', 'abstain'].includes(vote)) {
      return res.status(400).json({ error: 'Invalid vote option (yes/no/abstain)' });
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

    // Get proposal for validation
    const proposalData = await db.select().from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposalData.length || proposalData[0].daoId !== daoId) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Record vote
    await db.insert(votes).values({
      proposalId,
      userId: isAnonymous ? 'guest' : userId,
      daoId,
      voteType: vote,
      votingPower: '1',
    });

    // Update vote counts
    const updateField = vote === 'yes' ? 'yesVotes' : vote === 'no' ? 'noVotes' : 'abstainVotes';
    await db.update(proposals)
      .set({ [updateField]: sql`${proposals[updateField] as any} + 1` })
      .where(eq(proposals.id, proposalId));

    res.json({ success: true, vote, isAnonymous, pointsAwarded: !isAnonymous ? 5 : 0 });
  } catch (error: any) {
    logger.error(`Error voting on proposal ${req.params.proposalId}:`, error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// PROPOSALS - LIKES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/daos/:daoId/proposals/:proposalId/likes
 * Get proposal likes
 */
router.get('/:proposalId/likes', async (req: Request, res: Response) => {
  try {
    const { proposalId } = (req as any).params;
    const userId = getUserId(req);
    
    const proposal = await db
      .select({ likesCount: proposals.likesCount })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);
    
    if (!proposal.length) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    
    let userLiked = false;
    if (userId) {
      const userLike = await db
        .select()
        .from(proposalLikes)
        .where(
          and(
            eq(proposalLikes.proposalId, proposalId),
            eq(proposalLikes.userId, userId)
          )
        )
        .limit(1);
      
      userLiked = userLike.length > 0;
    }
    
    res.json({
      count: proposal[0].likesCount || 0,
      userLiked,
    });
  } catch (error: any) {
    logger.error(`Error fetching proposal likes:`, error);
    res.status(500).json({ error: 'Failed to fetch likes' });
  }
});

/**
 * POST /api/v1/daos/:daoId/proposals/:proposalId/like
 * Toggle like on a proposal
 */
router.post('/:proposalId/like', async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const { proposalId } = (req as any).params;
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const proposal = await db
      .select({ daoId: proposals.daoId })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);
    
    if (!proposal.length) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    
    if (proposal[0].daoId !== daoId) {
      return res.status(404).json({ error: 'Proposal not found in this DAO' });
    }
    
    const existingLike = await db
      .select()
      .from(proposalLikes)
      .where(
        and(
          eq(proposalLikes.proposalId, proposalId),
          eq(proposalLikes.userId, userId)
        )
      )
      .limit(1);
    
    if (existingLike.length > 0) {
      await db.delete(proposalLikes).where(eq(proposalLikes.id, existingLike[0].id));
      res.json({ success: true, action: 'unliked' });
    } else {
      await db.insert(proposalLikes).values({
        proposalId,
        userId,
        daoId,
      });
      res.json({ success: true, action: 'liked' });
    }
  } catch (error: any) {
    logger.error(`Error toggling proposal like:`, error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// PROPOSALS - COMMENTS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/daos/:daoId/proposals/:proposalId/comments
 * Get comments for a proposal (with nested support)
 */
router.get('/:proposalId/comments', async (req: Request, res: Response) => {
  try {
    const { proposalId } = (req as any).params;
    const userId = getUserId(req);
    const { limit = 50, parentCommentId } = req.query;
    
    let whereCondition: any = eq(proposalComments.proposalId, proposalId);
    
    // Filter by parent comment if specified (for nested comments)
    if (parentCommentId === 'null' || !parentCommentId) {
      whereCondition = and(whereCondition, sql`${proposalComments.parentCommentId} IS NULL`);
    } else if (parentCommentId) {
      whereCondition = and(whereCondition, eq(proposalComments.parentCommentId, parentCommentId as string));
    }
    
    const comments = await db
      .select({
        id: proposalComments.id,
        proposalId: proposalComments.proposalId,
        userId: proposalComments.userId,
        userName: users.username,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        content: proposalComments.content,
        parentCommentId: proposalComments.parentCommentId,
        isEdited: proposalComments.isEdited,
        likesCount: proposalComments.likesCount,
        createdAt: proposalComments.createdAt,
        updatedAt: proposalComments.updatedAt,
      })
      .from(proposalComments)
      .leftJoin(users, eq(proposalComments.userId, users.id))
      .where(whereCondition)
      .orderBy(desc(proposalComments.createdAt))
      .limit(parseInt(limit as string));
    
    let userLikes: string[] = [];
    if (userId && comments.length > 0) {
      const commentIds = comments.map(c => c.id);
      const likes = await db
        .select({ commentId: commentLikes.commentId })
        .from(commentLikes)
        .where(
          and(
            inArray(commentLikes.commentId, commentIds),
            eq(commentLikes.userId, userId)
          )
        );
      
      userLikes = likes.map(l => l.commentId);
    }
    
    const enhancedComments = comments.map(c => ({
      ...c,
      userName: c.userName || `${c.userFirstName || ''} ${c.userLastName || ''}`.trim() || 'Anonymous',
      userLiked: userLikes.includes(c.id),
    }));
    
    res.json({ comments: enhancedComments });
  } catch (error: any) {
    logger.error(`Error fetching comments:`, error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

/**
 * POST /api/v1/daos/:daoId/proposals/:proposalId/comments
 * Create a comment on a proposal
 */
router.post('/:proposalId/comments', async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const { proposalId } = (req as any).params;
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { content, parentCommentId } = req.body;
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    
    const proposal = await db
      .select({ daoId: proposals.daoId })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);
    
    if (!proposal.length || proposal[0].daoId !== daoId) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    
    const [newComment] = await db
      .insert(proposalComments)
      .values({
        proposalId,
        userId,
        daoId,
        content: content.trim(),
        parentCommentId: parentCommentId || null,
      })
      .returning();
    
    const user = await db
      .select({
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    res.status(201).json({
      success: true,
      comment: {
        ...newComment,
        userName: user[0]?.username || `${user[0]?.firstName || ''} ${user[0]?.lastName || ''}`.trim() || 'Anonymous',
        likesCount: 0,
        userLiked: false,
      },
    });
  } catch (error: any) {
    logger.error(`Error creating comment:`, error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

/**
 * PUT /api/v1/daos/:daoId/proposals/comments/:commentId
 * Update a comment (author only)
 */
router.put('/comments/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = getUserId(req as any);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { content } = req.body;
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    
    const comment = await db
      .select({ userId: proposalComments.userId })
      .from(proposalComments)
      .where(eq(proposalComments.id, commentId))
      .limit(1);
    
    if (!comment.length) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    if (comment[0].userId !== userId) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }
    
    const [updatedComment] = await db
      .update(proposalComments)
      .set({
        content: content.trim(),
        isEdited: true,
        updatedAt: new Date(),
      })
      .where(eq(proposalComments.id, commentId))
      .returning();
    
    res.json({ success: true, comment: updatedComment });
  } catch (error: any) {
    logger.error(`Error updating comment:`, error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

/**
 * DELETE /api/v1/daos/:daoId/proposals/comments/:commentId
 * Delete a comment (author only)
 */
router.delete('/comments/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = getUserId(req as any);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const comment = await db
      .select({ userId: proposalComments.userId })
      .from(proposalComments)
      .where(eq(proposalComments.id, commentId))
      .limit(1);
    
    if (!comment.length) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    if (comment[0].userId !== userId) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }
    
    await db.delete(commentLikes).where(eq(commentLikes.commentId, commentId));
    await db.delete(proposalComments).where(eq(proposalComments.id, commentId));
    
    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error: any) {
    logger.error(`Error deleting comment:`, error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

/**
 * POST /api/v1/daos/:daoId/proposals/comments/:commentId/like
 * Toggle like on a comment
 */
router.post('/comments/:commentId/like', async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = getUserId(req as any);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const comment = await db
      .select({ daoId: proposalComments.daoId })
      .from(proposalComments)
      .where(eq(proposalComments.id, commentId))
      .limit(1);
    
    if (!comment.length) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    const existingLike = await db
      .select()
      .from(commentLikes)
      .where(
        and(
          eq(commentLikes.commentId, commentId),
          eq(commentLikes.userId, userId)
        )
      )
      .limit(1);
    
    if (existingLike.length > 0) {
      await db.delete(commentLikes).where(eq(commentLikes.id, existingLike[0].id));
      res.json({ success: true, action: 'unliked' });
    } else {
      await db.insert(commentLikes).values({
        commentId,
        userId,
        daoId: comment[0].daoId,
      });
      res.json({ success: true, action: 'liked' });
    }
  } catch (error: any) {
    logger.error(`Error toggling comment like:`, error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// PROPOSALS - EXECUTION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Helper: Validate execution permission
 */
async function validateExecutionPermission(userId: string, daoId: string): Promise<boolean> {
  try {
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.daoId, daoId)
      ))
      .limit(1);
    
    if (!membership.length) return false;
    
    const allowedRoles = ['creator', 'admin', 'elder', 'treasury_manager'];
    return allowedRoles.includes(membership[0].role || '');
  } catch (error) {
    logger.error('Error validating execution permission:', error);
    return false;
  }
}

/**
 * GET /api/v1/daos/:daoId/proposals/execution/queue
 * Get proposal execution queue for this DAO
 */
router.get('/execution/queue', async (req, res) => {
  try {
    const daoId = getDaoId(req as any);
    const userId = getUserId(req as any);
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    // Check DAO membership (read permission)
    const isMember = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.daoId, daoId)
      ))
      .limit(1);
    
    if (!isMember.length) {
      return res.status(403).json({ success: false, message: 'You do not have permission to view this DAO' });
    }
    
    const executions = await db.select()
      .from(proposalExecutionQueue)
      .where(eq(proposalExecutionQueue.daoId, daoId))
      .orderBy(desc(proposalExecutionQueue.createdAt));
    
    res.json({ success: true, data: executions });
  } catch (error: any) {
    logger.error('Error fetching execution queue:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch execution queue', error: error.message });
  }
});

/**
 * POST /api/v1/daos/:daoId/proposals/:proposalId/execute
 * Execute a proposal (requires idempotency key)
 */
router.post('/:proposalId/execute', async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const { proposalId } = (req as any).params;
    const userId = getUserId(req);
    const idempotencyKey = req.headers['idempotency-key'] as string;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    // Require idempotency key for critical operation
    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: 'Idempotency-Key header is required for proposal execution',
        code: 'MISSING_IDEMPOTENCY_KEY'
      });
    }
    
    // Check for idempotency
    const executionKey = `${daoId}:${proposalId}`;
    const existingExecution = executionIdempotencyMap.get(executionKey);
    
    if (existingExecution && existingExecution.idempotencyKey === idempotencyKey) {
      return res.status(200).json({
        success: true,
        message: 'Proposal execution already completed (idempotent response)',
        data: existingExecution.result,
        executedAt: existingExecution.executedAt,
        isIdempotentResponse: true
      });
    }
    
    if (existingExecution && existingExecution.idempotencyKey !== idempotencyKey) {
      return res.status(409).json({
        success: false,
        message: 'Proposal already executed with a different Idempotency-Key',
        code: 'IDEMPOTENCY_KEY_CONFLICT',
        previousExecutionTime: existingExecution.executedAt
      });
    }
    
    // Check permissions (admin/elder/treasury_manager only)
    const hasPermission = await validateExecutionPermission(userId, daoId);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to execute proposals for this DAO'
      });
    }
    
    // Get pending execution from queue
    const execution = await db.select()
      .from(proposalExecutionQueue)
      .where(and(
        eq(proposalExecutionQueue.proposalId, proposalId),
        eq(proposalExecutionQueue.daoId, daoId),
        eq(proposalExecutionQueue.status, 'pending')
      ))
      .limit(1);
    
    if (!execution.length) {
      return res.status(404).json({
        success: false,
        message: 'No pending execution found for this proposal'
      });
    }
    
    // Execute proposal
    const executionResult = await ProposalExecutionService.executeProposal(execution[0], userId);
    
    // Store idempotency key
    executionIdempotencyMap.set(executionKey, {
      idempotencyKey,
      executedAt: new Date(),
      result: executionResult
    });
    
    // Clean up old entries after 24 hours
    setTimeout(() => executionIdempotencyMap.delete(executionKey), 24 * 60 * 60 * 1000);
    
    logger.info(`[AUDIT] Proposal ${proposalId} executed by user ${userId} in DAO ${daoId}`);
    
    res.json({
      success: true,
      message: 'Proposal executed successfully',
      data: executionResult,
      executedAt: new Date()
    });
  } catch (error: any) {
    logger.error(`Error executing proposal:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute proposal',
      error: error.message
    });
  }
});

/**
 * DELETE /api/v1/daos/:daoId/proposals/execution/:executionId
 * Cancel a proposal execution
 */
router.delete('/execution/:executionId', async (req, res) => {
  try {
    const daoId = getDaoId(req as any);
    const { executionId } = (req as any).params;
    const userId = getUserId(req as any);
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    // Check permissions
    const hasPermission = await validateExecutionPermission(userId, daoId);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to cancel proposal executions'
      });
    }
    
    await db.update(proposalExecutionQueue)
      .set({ status: 'cancelled' })
      .where(and(
        eq(proposalExecutionQueue.id, executionId),
        eq(proposalExecutionQueue.daoId, daoId)
      ));
    
    logger.info(`[AUDIT] Execution ${executionId} cancelled by user ${userId}`);
    
    res.json({ success: true, message: 'Execution cancelled successfully' });
  } catch (error: any) {
    logger.error(`Error cancelling execution:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel execution',
      error: error.message
    });
  }
});

export default router;
