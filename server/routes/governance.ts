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

// Execute passed proposals with quorum enforcement
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

    // CRITICAL: Validate quorum before execution
    const yesVotes = typeof proposalData.yesVotes === 'number' ? proposalData.yesVotes : 0;
    const noVotes = typeof proposalData.noVotes === 'number' ? proposalData.noVotes : 0;
    const abstainVotes = typeof proposalData.abstainVotes === 'number' ? proposalData.abstainVotes : 0;
    const totalVotes = yesVotes + noVotes + abstainVotes;

    // Get DAO quorum requirements
    const dao = await db.select().from(daos).where(eq(daos.id, proposalData.daoId)).limit(1);
    if (!dao.length) {
      return res.status(404).json({ message: 'DAO not found' });
    }

    const requiredQuorumPercentage = dao[0].quorumPercentage || 20;
    const memberCount = dao[0].memberCount || 1;
    const requiredQuorum = Math.ceil((memberCount * requiredQuorumPercentage) / 100);
    const participationRate = (totalVotes / memberCount) * 100;

    // Enforce quorum
    if (totalVotes < requiredQuorum) {
      await db.update(proposals)
        .set({ 
          status: 'failed',
          metadata: sql`jsonb_set(
            COALESCE(metadata, '{}'::jsonb), 
            '{failure_reason}', 
            ${JSON.stringify(`Quorum not met: ${totalVotes}/${requiredQuorum} votes (${participationRate.toFixed(2)}% participation)`)}
          )`
        })
        .where(eq(proposals.id, proposalId));

      return res.status(400).json({
        success: false,
        message: 'Proposal execution blocked: Quorum not met',
        data: {
          totalVotes,
          requiredQuorum,
          participationRate: participationRate.toFixed(2),
          requiredQuorumPercentage
        }
      });
    }

    // Check if proposal has passed
    if (proposalData.status !== 'passed') {
      return res.status(400).json({ message: 'Proposal must be in passed status to execute' });
    }

    // Verify majority vote
    const approvalPercentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;
    if (approvalPercentage < 50) {
      return res.status(400).json({
        success: false,
        message: 'Proposal execution blocked: Majority not reached',
        data: {
          approvalPercentage: approvalPercentage.toFixed(2),
          yesVotes,
          totalVotes
        }
      });
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

    // Add to execution queue with CRITICAL 48-hour timelock
    // This prevents immediate execution of malicious proposals
    let delay = 48; // Default 48 hours for security
    const daoSettings = await db.select().from(daos).where(eq(daos.id, proposalData.daoId)).limit(1);
    if (daoSettings.length && typeof daoSettings[0].executionDelay === 'number') {
      // Enforce minimum 24-hour delay even if DAO sets lower
      delay = Math.max(24, daoSettings[0].executionDelay);
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

    // CRITICAL: Check delegation cap (10% of total voting power)
    const daoInfo = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
    if (!daoInfo.length) {
      return res.status(404).json({ message: 'DAO not found' });
    }

    const maxDelegationPercentage = daoInfo[0].maxDelegationPercentage || 10;
    const totalMembers = daoInfo[0].memberCount || 1;
    const maxDelegationsAllowed = Math.ceil((totalMembers * maxDelegationPercentage) / 100);

    // Count current active delegations to this delegate
    const existingDelegations = await db.select().from(voteDelegations)
      .where(and(
        eq(voteDelegations.daoId, daoId),
        eq(voteDelegations.delegateId, delegateId),
        eq(voteDelegations.isActive, true)
      ));

    if (existingDelegations.length >= maxDelegationsAllowed) {
      return res.status(400).json({
        success: false,
        message: `Delegation cap exceeded: ${delegateId} has reached maximum of ${maxDelegationsAllowed} delegations (${maxDelegationPercentage}% of ${totalMembers} members)`,
        data: {
          currentDelegations: existingDelegations.length,
          maxAllowed: maxDelegationsAllowed,
          capPercentage: maxDelegationPercentage
        }
      });
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

// Check proposal quorum and update status with enforcement
router.post('/proposals/:proposalId/check-quorum', isAuthenticated, async (req, res) => {
  try {
    const { proposalId } = req.params;

    const proposal = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
    if (!proposal.length) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    const proposalData = proposal[0];

    // Check if voting period has ended
    if (new Date() < new Date(proposalData.voteEndTime)) {
      return res.status(400).json({ message: 'Voting period has not ended yet' });
    }

    // CRITICAL: Calculate and enforce quorum
    const dao = await db.select().from(daos).where(eq(daos.id, proposalData.daoId)).limit(1);
    if (!dao.length) {
      return res.status(404).json({ message: 'DAO not found' });
    }

    const daoData = dao[0];
    const activeMemberCount = await db.select({ count: sql<number>`count(*)` })
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, proposalData.daoId),
        eq(daoMemberships.status, 'approved'),
        eq(daoMemberships.isBanned, false)
      ));

    const totalActiveMembers = activeMemberCount[0]?.count || 0;
    const quorumPercentage = daoData.quorumPercentage || 20;
    const requiredQuorum = Math.ceil((totalActiveMembers * quorumPercentage) / 100);

    // Calculate vote totals
    const totalVotes = proposalData.yesVotes + proposalData.noVotes + (proposalData.abstainVotes || 0);

    // CRITICAL: Enforce quorum requirement
    if (totalVotes < requiredQuorum) {
      await db.update(proposals)
        .set({ 
          status: 'failed',
          metadata: sql`jsonb_set(COALESCE(metadata, '{}'::jsonb), '{failureReason}', '"Quorum not met"')`
        })
        .where(eq(proposals.id, proposalId));

      // Record quorum failure in history
      await db.insert(quorumHistory).values({
        daoId: proposalData.daoId,
        proposalId: proposalId,
        activeMemberCount: totalActiveMembers,
        requiredQuorum: requiredQuorum,
        achievedQuorum: totalVotes,
        quorumMet: false
      });

      return res.status(400).json({ 
        success: false,
        message: `Quorum not met. Required: ${requiredQuorum} votes (${quorumPercentage}% of ${totalActiveMembers} members), Got: ${totalVotes}`,
        data: {
          totalActiveMembers,
          quorumPercentage,
          requiredQuorum,
          totalVotes,
          quorumMet: false
        }
      });
    }

    // Record successful quorum in history
    await db.insert(quorumHistory).values({
      daoId: proposalData.daoId,
      proposalId: proposalId,
      activeMemberCount: totalActiveMembers,
      requiredQuorum: requiredQuorum,
      achievedQuorum: totalVotes,
      quorumMet: true
    });

    // Proceed with checking majority and updating status as before
    const majorityReached = proposalData.yesVotes > proposalData.noVotes;
    const passed = requiredQuorum > 0 && totalVotes >= requiredQuorum && majorityReached; // Ensure quorum is met and majority reached

    let newStatus = 'failed';
    let failureReason = '';

    if (!quorumMet) { // This check should be redundant if the above block is correctly executed
      newStatus = 'failed';
      failureReason = `Quorum not met: ${totalVotes}/${requiredQuorum} votes (${(totalVotes / totalActiveMembers * 100).toFixed(2)}% participation)`;
    } else if (!majorityReached) {
      newStatus = 'failed';
      failureReason = `Majority not reached: ${proposalData.yesVotes} yes vs ${proposalData.noVotes} no votes`;
    } else {
      newStatus = 'passed';
    }

    await db.update(proposals)
      .set({ 
        status: newStatus,
        metadata: failureReason ? sql`jsonb_set(
          COALESCE(metadata, '{}'::jsonb), 
          '{failure_reason}', 
          ${JSON.stringify(failureReason)}
        )` : proposalData.metadata
      })
      .where(eq(proposals.id, proposalId));


    res.json({
      success: true,
      data: {
        quorumMet: true, // Since we passed the quorum check above
        majorityReached,
        passed,
        totalVotes,
        requiredQuorum,
        participationRate: (totalVotes / totalActiveMembers * 100).toFixed(2),
        yesVotes: proposalData.yesVotes,
        noVotes: proposalData.noVotes,
        abstainVotes: proposalData.abstainVotes,
        status: newStatus
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