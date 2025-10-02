
import express from 'express';
import { db } from '../storage';
import { 
  proposals, 
  votes, 
  daoMemberships, 
  daos,
  proposalExecutionQueue,
  quorumHistory,
  voteDelegations,
  proposalTemplates
} from '../../shared/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { isAuthenticated } from '../nextAuthMiddleware';

const router = express.Router();

// Calculate dynamic quorum for a DAO
router.get('/:daoId/quorum', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    
    // Get DAO settings
    const dao = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
    if (!dao.length) {
      return res.status(404).json({ message: 'DAO not found' });
    }
    
    // Get active members (active in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeMembers = await db
      .select({ count: sql<number>`count(*)` })
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.status, 'approved'),
          gte(daoMemberships.lastActive, thirtyDaysAgo)
        )
      );
    
    const activeMemberCount = activeMembers[0]?.count || 0;
    const quorumPercentage = dao[0].quorumPercentage || 20;
    const requiredQuorum = Math.ceil((activeMemberCount * quorumPercentage) / 100);
    
    res.json({
      success: true,
      data: {
        activeMemberCount,
        quorumPercentage,
        requiredQuorum,
        calculatedAt: new Date()
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to calculate quorum',
      error: error.message
    });
  }
});

// Execute passed proposals
router.post('/proposals/:proposalId/execute', isAuthenticated, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const userId = (req.user as any).claims.sub;
    
    // Get proposal details
    const proposal = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
    if (!proposal.length) {
      return res.status(404).json({ message: 'Proposal not found' });
    }
    
    const proposalData = proposal[0];
    
    // Check if proposal has passed
    if (proposalData.status !== 'passed') {
      return res.status(400).json({ message: 'Proposal must be in passed status to execute' });
    }
    
    // Check if user has permission to execute
    const membership = await db.select().from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, proposalData.daoId),
        eq(daoMemberships.userId, userId)
      )).limit(1);
    
  if (!membership.length || !['admin', 'elder'].includes(membership[0].role ?? '')) {
      return res.status(403).json({ message: 'Insufficient permissions to execute proposal' });
    }
    
    // Add to execution queue
    // Always use DAO's executionDelay
    let delay = 24;
    const dao = await db.select().from(daos).where(eq(daos.id, proposalData.daoId)).limit(1);
    if (dao.length && typeof dao[0].executionDelay === 'number') {
      delay = dao[0].executionDelay;
    }
    const executionTime = new Date(Date.now() + delay * 60 * 60 * 1000);
    
    await db.insert(proposalExecutionQueue).values({
      proposalId: String(proposalId ?? ''),
      daoId: String(proposalData.daoId ?? ''),
      scheduledFor: executionTime,
      executionType: String(proposalData.proposalType ?? ''),
      executionData: proposalData.executionData || {},
      status: 'pending'
    });
    
    res.json({
      success: true,
      message: 'Proposal queued for execution',
      scheduledFor: executionTime
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to queue proposal for execution',
      error: error.message
    });
  }
});

// Get proposal templates
router.get('/:daoId/templates', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    
    // Get DAO-specific and global templates
    const templates = await db.select().from(proposalTemplates)
      .where(
        and(
          eq(proposalTemplates.daoId, daoId),
          eq(proposalTemplates.isGlobal, true)
        )
      )
      .orderBy(desc(proposalTemplates.createdAt));
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposal templates',
      error: error.message
    });
  }
});

// Create proposal template
router.post('/:daoId/templates', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = (req.user as any).claims.sub;
    const templateData = req.body;
    
    // Check permissions
    const membership = await db.select().from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      )).limit(1);
    
  if (!membership.length || !['admin', 'elder'].includes(membership[0].role ?? '')) {
      return res.status(403).json({ message: 'Insufficient permissions to create templates' });
    }
    
    const template = await db.insert(proposalTemplates).values({
      ...templateData,
      daoId,
      createdBy: userId
    }).returning();
    
    res.json({
      success: true,
      data: template[0]
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to create proposal template',
      error: error.message
    });
  }
});

// Delegate vote
router.post('/:daoId/delegate', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = (req.user as any).claims.sub;
    const { delegateId, scope, category, proposalId } = req.body;
    
    // Validate delegate is a member
    const delegateMembership = await db.select().from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, delegateId),
        eq(daoMemberships.status, 'approved')
      )).limit(1);
    
    if (!delegateMembership.length) {
      return res.status(400).json({ message: 'Delegate must be an active DAO member' });
    }
    
    // Deactivate existing delegation if any
    await db.update(voteDelegations)
      .set({ isActive: false })
      .where(and(
        eq(voteDelegations.delegatorId, userId),
        eq(voteDelegations.daoId, daoId),
        eq(voteDelegations.isActive, true)
      ));
    
    // Create new delegation
    const delegation = await db.insert(voteDelegations).values({
      delegatorId: userId,
      delegateId,
      daoId,
      scope,
      category,
      proposalId,
      isActive: true
    }).returning();
    
    res.json({
      success: true,
      data: delegation[0]
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to create vote delegation',
      error: error.message
    });
  }
});

// Get user's delegations
router.get('/:daoId/delegations', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = (req.user as any).claims.sub;
    
    const delegations = await db.select().from(voteDelegations)
      .where(and(
        eq(voteDelegations.daoId, daoId),
        eq(voteDelegations.delegatorId, userId),
        eq(voteDelegations.isActive, true)
      ));
    
    res.json({
      success: true,
      data: delegations
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delegations',
      error: error.message
    });
  }
});

// Revoke delegation
router.delete('/:daoId/delegate/:delegationId', isAuthenticated, async (req, res) => {
  try {
    const { daoId, delegationId } = req.params;
    const userId = (req.user as any).claims.sub;
    
    await db.update(voteDelegations)
      .set({ isActive: false })
      .where(and(
        eq(voteDelegations.id, delegationId),
        eq(voteDelegations.delegatorId, userId),
        eq(voteDelegations.daoId, daoId)
      ));
    
    res.json({
      success: true,
      message: 'Delegation revoked successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to revoke delegation',
      error: error.message
    });
  }
});

// Check proposal quorum and update status
router.post('/proposals/:proposalId/check-quorum', isAuthenticated, async (req, res) => {
  try {
    const { proposalId } = req.params;
    
    const proposal = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
    if (!proposal.length) {
      return res.status(404).json({ message: 'Proposal not found' });
    }
    
    const proposalData = proposal[0];
    
    // Calculate total votes
  const yesVotes = typeof proposalData.yesVotes === 'number' ? proposalData.yesVotes : 0;
  const noVotes = typeof proposalData.noVotes === 'number' ? proposalData.noVotes : 0;
  const abstainVotes = typeof proposalData.abstainVotes === 'number' ? proposalData.abstainVotes : 0;
  const totalVotes = yesVotes + noVotes + abstainVotes;
    
    // Get required quorum
    const quorumResponse = await fetch(`/api/governance/${proposalData.daoId}/quorum`);
    const quorumData = await quorumResponse.json();
    const requiredQuorum = quorumData.data.requiredQuorum;
    
    const quorumMet = totalVotes >= requiredQuorum;
  const passed = quorumMet && yesVotes > noVotes;
    
    // Record quorum history
    await db.insert(quorumHistory).values({
      daoId: proposalData.daoId,
      proposalId,
      activeMemberCount: quorumData.data.activeMemberCount,
      requiredQuorum,
      achievedQuorum: totalVotes,
      quorumMet
    });
    
    // Update proposal status if voting ended
    if (new Date() > proposalData.voteEndTime) {
      let newStatus = 'failed';
      if (quorumMet && passed) {
        newStatus = 'passed';
      } else if (!quorumMet) {
        newStatus = 'failed'; // Failed due to lack of quorum
      }
      
      await db.update(proposals)
        .set({ status: newStatus })
        .where(eq(proposals.id, proposalId));
    }
    
    res.json({
      success: true,
      data: {
        quorumMet,
        passed,
        totalVotes,
        requiredQuorum,
        status: passed && quorumMet ? 'passed' : 'failed'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to check proposal quorum',
      error: error.message
    });
  }
});

export default router;
