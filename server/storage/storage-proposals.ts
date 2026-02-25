import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { proposals, votes, proposalComments, proposalLikes, commentLikes } from '../../shared/schema';

// Type aliases
type Proposal = typeof proposals.$inferSelect;
type InsertProposal = typeof proposals.$inferInsert;
type ProposalComment = typeof proposalComments.$inferSelect;
type InsertProposalComment = typeof proposalComments.$inferInsert;
type ProposalLike = typeof proposalLikes.$inferSelect;
type InsertProposalLike = typeof proposalLikes.$inferInsert;
type CommentLike = typeof commentLikes.$inferSelect;
type InsertCommentLike = typeof commentLikes.$inferInsert;

/**
 * Storage module for proposals and engagement features
 * Handles: Proposals CRUD, voting, comments, likes
 */
export class ProposalStorage {
  private db = db;

  /**
   * Create a new proposal
   * ⚠️ PERSISTENCE GAP: No draft state support, proposals must be published immediately
   */
  async createProposal(proposal: any): Promise<any> {
    if (!proposal.title || !proposal.daoId) throw new Error('Proposal must have title and daoId');
    proposal.createdAt = new Date();
    proposal.updatedAt = new Date();
    const result = await this.db.insert(proposals).values(proposal).returning();
    if (!result[0]) throw new Error('Failed to create proposal');
    return result[0];
  }

  /**
   * Get all proposals sorted by creation date
   */
  async getProposals(): Promise<any> {
    return await this.db.select().from(proposals)
      .orderBy(desc(proposals.createdAt));
  }

  /**
   * Get proposal by ID
   */
  async getProposal(id: string): Promise<any> {
    if (!id) throw new Error('Proposal ID required');
    const result = await this.db.select().from(proposals)
      .where(eq(proposals.id, id));
    if (!result[0]) throw new Error('Proposal not found');
    return result[0];
  }

  /**
   * Update proposal
   */
  async updateProposal(id: string, data: any, userId: string): Promise<Proposal> {
    if (!id || !data.title) throw new Error('Proposal ID and title required');
    const proposal = await this.getProposal(id);
    if (proposal.userId !== userId) throw new Error('Only proposal creator can update');
    const result = await this.db.update(proposals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(proposals.id, id))
      .returning();
    if (!result[0]) throw new Error('Failed to update proposal');
    return result[0];
  }

  /**
   * Delete proposal
   */
  async deleteProposal(id: string, userId: string): Promise<void> {
    const proposal = await this.getProposal(id);
    // For now, just check creator - would need getDaoMembership for admin check
    if (proposal.userId !== userId) {
      throw new Error('Only proposal creator can delete');
    }
    await this.db.delete(proposals).where(eq(proposals.id, id));
  }

  /**
   * Update proposal vote counts
   * ⚠️ PERSISTENCE GAP: No vote time locks, deadlines, or vote change audit trail
   */
  async updateProposalVotes(proposalId: string, voteType: string): Promise<any> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    const field = voteType === 'yes' ? 'yesVotes' : 'noVotes';
    const update: any = { updatedAt: new Date() };
    update[field] = (proposal[field] || 0) + 1;
    const result = await this.db.update(proposals)
      .set(update)
      .where(eq(proposals.id, proposalId))
      .returning();
    if (!result[0]) throw new Error('Failed to update proposal votes');
    return result[0];
  }

  /**
   * Create a vote on a proposal
   */
  async createVote(vote: any): Promise<any> {
    if (!vote.proposalId || !vote.userId) throw new Error('Vote must have proposalId and userId');
    vote.createdAt = new Date();
    vote.updatedAt = new Date();
    const result = await this.db.insert(votes).values(vote).returning();
    if (!result[0]) throw new Error('Failed to create vote');
    return result[0];
  }

  /**
   * Get user's vote on a specific proposal
   */
  async getVote(proposalId: string, userId: string): Promise<any> {
    if (!proposalId || !userId) throw new Error('Proposal ID and User ID required');
    const result = await this.db.select().from(votes)
      .where(and(eq(votes.proposalId, proposalId), eq(votes.userId, userId)));
    if (!result[0]) throw new Error('Vote not found');
    return result[0];
  }

  /**
   * Get all votes on a proposal
   */
  async getVotesByProposal(proposalId: string): Promise<any> {
    if (!proposalId) throw new Error('Proposal ID required');
    return await this.db.select().from(votes)
      .where(eq(votes.proposalId, proposalId));
  }

  /**
   * Get user's votes in a specific DAO
   */
  async getVotesByUserAndDao(userId: string, daoId: string): Promise<any> {
    if (!userId || !daoId) throw new Error('User ID and DAO ID required');
    return await this.db.select().from(votes)
      .where(and(eq(votes.userId, userId), eq(votes.daoId, daoId)));
  }

  /**
   * Count votes for a proposal in a DAO
   */
  async getVotesCount(daoId: string, proposalId: string): Promise<number> {
    if (!proposalId || !daoId) throw new Error('User ID and DAO ID required');
    const result = await this.db.select().from(votes)
      .where(and(eq(votes.userId, proposalId), eq(votes.daoId, daoId)));
    return result.length;
  }

  /**
   * Create a comment on a proposal
   * ⚠️ PERSISTENCE GAP: No edit history or comment timestamp tracking
   */
  async createProposalComment(comment: InsertProposalComment): Promise<ProposalComment> {
    const [result] = await this.db.insert(proposalComments).values({
      ...comment,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    if (!result) {
      throw new Error('Failed to create proposal comment');
    }
    
    return result;
  }

  /**
   * Get comments on a proposal
   */
  async getProposalComments(
    proposalId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ProposalComment[]> {
    if (!proposalId) throw new Error('Proposal ID required');
    return await this.db.select()
      .from(proposalComments)
      .where(eq(proposalComments.proposalId, proposalId))
      .orderBy(desc(proposalComments.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Update a proposal comment
   */
  async updateProposalComment(
    commentId: string,
    updates: Partial<ProposalComment>
  ): Promise<ProposalComment> {
    const [result] = await this.db.update(proposalComments)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(proposalComments.id, commentId))
      .returning();

    if (!result) {
      throw new Error('Failed to update proposal comment');
    }

    return result;
  }

  /**
   * Delete a proposal comment
   */
  async deleteProposalComment(commentId: string): Promise<boolean> {
    try {
      const result = await this.db.delete(proposalComments)
        .where(eq(proposalComments.id, commentId));
      return !!result;
    } catch (error) {
      throw new Error('Failed to delete proposal comment');
    }
  }

  /**
   * Toggle like on a proposal comment
   */
  async toggleProposalLike(
    proposalId: string,
    userId: string
  ): Promise<ProposalLike | null> {
    const existingLike = await this.db.select()
      .from(proposalLikes)
      .where(and(
        eq(proposalLikes.proposalId, proposalId),
        eq(proposalLikes.userId, userId)
      ))
      .limit(1);

    if (existingLike.length > 0) {
      await this.db.delete(proposalLikes).where(
        and(
          eq(proposalLikes.proposalId, proposalId),
          eq(proposalLikes.userId, userId)
        )
      );
      return null;
    }

    const [newLike] = await this.db.insert(proposalLikes).values({
      proposalId,
      userId,
      createdAt: new Date(),
    }).returning();

    return newLike;
  }

  /**
   * Get likes on a proposal
   */
  async getProposalLikes(proposalId: string): Promise<ProposalLike[]> {
    if (!proposalId) throw new Error('Proposal ID required');
    return await this.db.select()
      .from(proposalLikes)
      .where(eq(proposalLikes.proposalId, proposalId));
  }

  /**
   * Toggle like on a comment
   */
  async toggleCommentLike(
    commentId: string,
    userId: string
  ): Promise<CommentLike | null> {
    const existingLike = await this.db.select()
      .from(commentLikes)
      .where(and(
        eq(commentLikes.commentId, commentId),
        eq(commentLikes.userId, userId)
      ))
      .limit(1);

    if (existingLike.length > 0) {
      await this.db.delete(commentLikes).where(
        and(
          eq(commentLikes.commentId, commentId),
          eq(commentLikes.userId, userId)
        )
      );
      return null;
    }

    const [newLike] = await this.db.insert(commentLikes).values({
      commentId,
      userId,
      createdAt: new Date(),
    }).returning();

    return newLike;
  }

  /**
   * Get likes on a comment
   */
  async getCommentLikes(commentId: string): Promise<CommentLike[]> {
    if (!commentId) throw new Error('Comment ID required');
    return await this.db.select()
      .from(commentLikes)
      .where(eq(commentLikes.commentId, commentId));
  }

  /**
   * Save proposal as draft (Gap #3: Proposal draft support)
   */
  async saveProposalDraft(draftData: any): Promise<any> {
    if (!draftData.title || !draftData.daoId || !draftData.proposerId) {
      throw new Error('Draft must have title, daoId, and proposerId');
    }
    const result = await this.db.insert(proposals).values({
      title: draftData.title,
      description: draftData.description || '',
      proposalType: draftData.proposalType || 'general',
      proposerId: draftData.proposerId,
      proposer: draftData.proposerId,
      userId: draftData.proposerId,
      daoId: draftData.daoId,
      status: 'draft',
      isDraft: true,
      voteEndTime: draftData.voteEndTime || new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours default
      tags: draftData.tags || [],
      metadata: draftData.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  /**
   * Get draft proposals for a user/DAO
   */
  async getDraftProposals(daoId: string, proposerId?: string): Promise<any[]> {
    if (!daoId) throw new Error('DAO ID required');
    if (proposerId) {
      return await this.db.select().from(proposals)
        .where(and(
          eq(proposals.daoId, daoId),
          eq(proposals.isDraft, true),
          eq(proposals.proposerId, proposerId)
        ))
        .orderBy(desc(proposals.createdAt));
    }
    return await this.db.select().from(proposals)
      .where(and(
        eq(proposals.daoId, daoId),
        eq(proposals.isDraft, true)
      ))
      .orderBy(desc(proposals.createdAt));
  }

  /**
   * Publish a draft proposal
   */
  async publishDraft(proposalId: string, publishData?: any): Promise<any> {
    if (!proposalId) throw new Error('Proposal ID required');
    const result = await this.db.update(proposals)
      .set({
        isDraft: false,
        status: 'active',
        voteStartTime: publishData?.voteStartTime || new Date(),
        voteEndTime: publishData?.voteEndTime || new Date(Date.now() + 72 * 60 * 60 * 1000),
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, proposalId))
      .returning();
    return result[0];
  }

  /**
   * Delete draft proposal
   */
  async deleteDraft(proposalId: string): Promise<boolean> {
    if (!proposalId) throw new Error('Proposal ID required');
    const result = await this.db.delete(proposals)
      .where(and(
        eq(proposals.id, proposalId),
        eq(proposals.isDraft, true)
      ));
    return result.rowCount > 0;
  }

  /**
   * Record comment edit history (Medium Gap #5: Comment edit history)
   */
  async recordCommentEditHistory(commentId: string, previousContent: string, newContent: string, editedBy: string): Promise<any> {
    if (!commentId || !previousContent || !newContent || !editedBy) {
      throw new Error('Comment ID, previous content, new content, and edited by required');
    }
    
    // Store in JSON for now - ideally should have dedicated table
    const result = await this.db.update(proposalComments)
      .set({
        content: newContent,
        editHistory: JSON.stringify([
          {
            previousContent,
            newContent,
            editedBy,
            editedAt: new Date().toISOString(),
          }
        ]),
        lastEditedAt: new Date(),
        lastEditedBy: editedBy,
        updatedAt: new Date(),
      })
      .where(eq(proposalComments.id, commentId))
      .returning();
    return result[0];
  }

  /**
   * Get comment edit history
   */
  async getCommentEditHistory(commentId: string): Promise<any> {
    if (!commentId) throw new Error('Comment ID required');
    const result = await this.db.select().from(proposalComments)
      .where(eq(proposalComments.id, commentId));
    
    if (!result[0]) throw new Error('Comment not found');
    return {
      commentId,
      editHistory: result[0].editHistory ? JSON.parse(result[0].editHistory) : [],
      lastEditedAt: result[0].lastEditedAt,
      lastEditedBy: result[0].lastEditedBy,
    };
  }



  /**
   * Get comments edited by specific user
   */
  async getCommentsByEditor(userId: string): Promise<any[]> {
    if (!userId) throw new Error('User ID required');
    return await this.db.select().from(proposalComments)
      .where(eq(proposalComments.lastEditedBy, userId))
      .orderBy(desc(proposalComments.lastEditedAt));
  }
}

// Export singleton instance
export const proposalStorage = new ProposalStorage();
