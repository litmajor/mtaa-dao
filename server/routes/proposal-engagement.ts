import { Router } from 'express';
import { db } from '../db';
import { logger } from '../utils/logger';
import { proposals, proposalLikes, proposalComments, commentLikes, users } from '../../shared/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { authenticate } from '../auth';

const router = Router();

// =====================================================
// PROPOSAL LIKES
// =====================================================

// Get likes for a proposal
router.get('/proposals/:proposalId/likes', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    
    // Get total likes count
    const proposal = await db
      .select({ likesCount: proposals.likesCount })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);
    
    if (!proposal.length) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    
    // Check if current user has liked
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
  } catch (error) {
    logger.error('Error fetching proposal likes:', error);
    res.status(500).json({ error: 'Failed to fetch likes' });
  }
});

// Toggle like on a proposal
router.post('/proposals/:proposalId/like', authenticate, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const userId = req.user!.id;
    
    // Get proposal to verify it exists and get daoId
    const proposal = await db
      .select({ daoId: proposals.daoId })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);
    
    if (!proposal.length) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    
    const daoId = proposal[0].daoId;
    
    // Check if user already liked
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
      // Unlike - remove like
      await db
        .delete(proposalLikes)
        .where(eq(proposalLikes.id, existingLike[0].id));
      
      res.json({ 
        success: true, 
        action: 'unliked',
        message: 'Proposal unliked successfully'
      });
    } else {
      // Like - add like
      await db
        .insert(proposalLikes)
        .values({
          proposalId,
          userId,
          daoId,
        });
      
      res.json({ 
        success: true, 
        action: 'liked',
        message: 'Proposal liked successfully'
      });
    }
  } catch (error) {
    logger.error('Error toggling proposal like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// =====================================================
// PROPOSAL COMMENTS
// =====================================================

// Get comments for a proposal
router.get('/proposals/:proposalId/comments', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    const { limit = 50, parentCommentId } = req.query;
    
    // Build where condition
    let whereCondition: any = eq(proposalComments.proposalId, proposalId);
    
    // Filter by parent comment if specified (for nested comments)
    if (parentCommentId === 'null' || !parentCommentId) {
      // Top-level comments (no parent)
      whereCondition = and(
        whereCondition,
        sql`${proposalComments.parentCommentId} IS NULL`
      );
    } else if (parentCommentId) {
      // Replies to a specific comment
      whereCondition = and(
        whereCondition,
        eq(proposalComments.parentCommentId, parentCommentId as string)
      );
    }
    
    // Fetch comments with user info
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
    
    // If user is authenticated, check which comments they've liked
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
    
    // Enhance comments with user like status
    const enhancedComments = comments.map(c => ({
      ...c,
      userName: c.userName || `${c.userFirstName || ''} ${c.userLastName || ''}`.trim() || 'Anonymous',
      userLiked: userLikes.includes(c.id),
    }));
    
    res.json({ comments: enhancedComments });
  } catch (error) {
    logger.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Create a comment on a proposal
router.post('/proposals/:proposalId/comments', authenticate, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const userId = req.user!.id;
    const { content, parentCommentId } = req.body;
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    
    // Get proposal to verify it exists and get daoId
    const proposal = await db
      .select({ daoId: proposals.daoId })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);
    
    if (!proposal.length) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    
    const daoId = proposal[0].daoId;
    
    // Create comment
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
    
    // Fetch user info for response
    const user = await db
      .select({
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    res.json({
      success: true,
      comment: {
        ...newComment,
        userName: user[0]?.username || `${user[0]?.firstName || ''} ${user[0]?.lastName || ''}`.trim() || 'Anonymous',
        likesCount: 0,
        userLiked: false,
      },
    });
  } catch (error) {
    logger.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// Update a comment
router.put('/comments/:commentId', authenticate, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user!.id;
    const { content } = req.body;
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    
    // Verify comment belongs to user
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
    
    // Update comment
    const [updatedComment] = await db
      .update(proposalComments)
      .set({
        content: content.trim(),
        isEdited: true,
        updatedAt: new Date(),
      })
      .where(eq(proposalComments.id, commentId))
      .returning();
    
    res.json({
      success: true,
      comment: updatedComment,
    });
  } catch (error) {
    logger.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// Delete a comment
router.delete('/comments/:commentId', authenticate, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user!.id;
    
    // Verify comment belongs to user
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
    
    // Delete comment (cascade will handle likes and nested comments)
    await db
      .delete(proposalComments)
      .where(eq(proposalComments.id, commentId));
    
    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    logger.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// =====================================================
// COMMENT LIKES
// =====================================================

// Toggle like on a comment
router.post('/comments/:commentId/like', authenticate, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user!.id;
    
    // Get comment to verify it exists and get daoId
    const comment = await db
      .select({ daoId: proposalComments.daoId })
      .from(proposalComments)
      .where(eq(proposalComments.id, commentId))
      .limit(1);
    
    if (!comment.length) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    const daoId = comment[0].daoId;
    
    // Check if user already liked
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
      // Unlike - remove like
      await db
        .delete(commentLikes)
        .where(eq(commentLikes.id, existingLike[0].id));
      
      res.json({ 
        success: true, 
        action: 'unliked',
        message: 'Comment unliked successfully'
      });
    } else {
      // Like - add like
      await db
        .insert(commentLikes)
        .values({
          commentId,
          userId,
          daoId,
        });
      
      res.json({ 
        success: true, 
        action: 'liked',
        message: 'Comment liked successfully'
      });
    }
  } catch (error) {
    logger.error('Error toggling comment like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

export default router;

