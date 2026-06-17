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
import { createRateLimiter } from '../middleware/rateLimiting';
import { evaluateGovernanceRules, formatRuleRejectionMessage, logRuleEvaluation } from '../services/rules-integration';
import { logConsolidatedAuditEvent, AuditEventType } from '../services/auditConsolidated';
import { proposalSimulationService } from '../services/proposalSimulationService';
import { sanitizeObject } from '../middleware/security';
import { governanceLeaderboardService } from '../services/governanceLeaderboardService';
import { logger } from '../utils/logger';

const router = express.Router();

// 🔴 CRITICAL: Rate limiter for proposal execution (critical governance operation)
const proposalExecutionLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // Max 5 executions per minute per user
  keyGenerator: (req) => `gov:execute:${(req as any).user?.id || req.ip}`,
});

// Calculate dynamic quorum for a DAO
router.get('/quorum', isAuthenticated, async (req, res) => {
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
// 🔴 CRITICAL: Rate limited - proposal execution is critical governance operation
router.post('/proposals/:proposalId/execute', isAuthenticated, proposalExecutionLimiter, async (req, res) => {
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

    // Evaluate governance rules before execution
    const ruleResult = await evaluateGovernanceRules(proposalData.daoId, {
      proposalId,
      proposalType: proposalData.proposalType || 'general',
      votesFor: yesVotes,
      votesAgainst: noVotes,
      totalMembers: memberCount,
      createdAt: new Date(),
    });

    if (!ruleResult.approved) {
      await db.update(proposals)
        .set({ 
          status: 'failed',
          metadata: sql`jsonb_set(
            COALESCE(metadata, '{}'::jsonb), 
            '{failure_reason}', 
            ${JSON.stringify(`Proposal rejected by governance rules: ${formatRuleRejectionMessage(ruleResult.results)}`)}
          )`
        })
        .where(eq(proposals.id, proposalId));

      logRuleEvaluation(proposalData.daoId, 'proposal', proposalId, ruleResult.results);
      return res.status(403).json({
        success: false,
        message: 'Proposal execution blocked by governance rules',
        reason: formatRuleRejectionMessage(ruleResult.results),
        rules: ruleResult.results,
      });
    }

    // Add to execution queue with CRITICAL 48-hour timelock
    // This prevents immediate execution of malicious proposals
    let delay = 24; // Default 48 hours for security
    const daoSettings = await db.select().from(daos).where(eq(daos.id, proposalData.daoId)).limit(1);
    if (daoSettings.length && typeof daoSettings[0].executionDelay === 'number') {
      // Enforce minimum 12-hour delay even if DAO sets lower
      delay = Math.max(12, daoSettings[0].executionDelay);
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

    logRuleEvaluation(proposalData.daoId, 'proposal', proposalId, ruleResult.results);

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

// Cancel a proposal with three permission levels
// 1. Proposer: Can always cancel their own proposal
// 2. DAO Admin: Can cancel any proposal with a reason
// 3. Emergency Superuser: Can cancel for critical safety (requires approval board)
router.post('/proposals/:proposalId/cancel', isAuthenticated, async (req, res) => {
  try {
    const { daoId, proposalId } = req.params;
    const { reason, approvalBoardApproved } = req.body;
    const userId = (req.user as any).claims.sub;

    // Get proposal details
    const proposal = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
    if (!proposal.length) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    const proposalData = proposal[0];

    // Proposal must be in queued or active status to be cancelled
    if (!proposalData.status || !['queued', 'active', 'passed'].includes(proposalData.status)) {
      return res.status(400).json({
        success: false,
        message: `Proposal cannot be cancelled in ${proposalData.status} status`,
        data: {
          currentStatus: proposalData.status,
          allowedStatuses: ['queued', 'active', 'passed']
        }
      });
    }

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
    if (!dao.length) {
      return res.status(404).json({ message: 'DAO not found' });
    }

    // Get user's membership and role in DAO
    const membership = await db.select().from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      )).limit(1);

    const userRole = membership.length ? membership[0].role : null;
    const isProposer = proposalData.proposerId === userId;
    const isAdmin = userRole === 'admin';
    const isSuperuser = userRole === 'superuser';

    // Permission Level 1: Proposer can always cancel their own proposal
    if (isProposer) {
      // Proposer cancellation - proceed without restrictions
      await db.update(proposals)
        .set({
          status: 'cancelled',
          metadata: sql`jsonb_set(
            COALESCE(metadata, '{}'::jsonb), 
            '{cancellation}', 
            ${JSON.stringify({
              cancelledBy: userId,
              cancelledAt: new Date(),
              reason: reason || 'Cancelled by proposer',
              permissionLevel: 'proposer'
            })}
          )`
        })
        .where(eq(proposals.id, proposalId));

      // Remove from execution queue if present
      await db.delete(proposalExecutionQueue)
        .where(eq(proposalExecutionQueue.proposalId, proposalId));

      // Log the cancellation
      await logConsolidatedAuditEvent({
        actorId: userId,
        actorType: 'user',
        actionType: AuditEventType.PROPOSAL_CANCELLED,
        actionCategory: 'governance',
        targetType: 'proposal',
        targetId: proposalId,
        targetName: proposalData.title,
        result: 'success',
        metadata: {
          permissionLevel: 'proposer',
          reason: reason || 'Cancelled by proposer',
          daoId
        }
      });

      return res.json({
        success: true,
        message: 'Proposal cancelled successfully by proposer',
        data: {
          proposalId,
          status: 'cancelled',
          permissionLevel: 'proposer',
          cancelledAt: new Date()
        }
      });
    }

    // Permission Level 2: DAO Admin can cancel any proposal
    if (isAdmin) {
      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'DAO admins must provide a reason for cancellation',
          data: {
            requiredFields: ['reason']
          }
        });
      }

      // Admin cancellation - requires reason
      await db.update(proposals)
        .set({
          status: 'cancelled',
          metadata: sql`jsonb_set(
            COALESCE(metadata, '{}'::jsonb), 
            '{cancellation}', 
            ${JSON.stringify({
              cancelledBy: userId,
              cancelledAt: new Date(),
              reason: reason,
              permissionLevel: 'admin'
            })}
          )`
        })
        .where(eq(proposals.id, proposalId));

      // Remove from execution queue if present
      await db.delete(proposalExecutionQueue)
        .where(eq(proposalExecutionQueue.proposalId, proposalId));

      // Log the cancellation
      await logConsolidatedAuditEvent({
        actorId: userId,
        actorType: 'admin',
        actionType: AuditEventType.PROPOSAL_CANCELLED,
        actionCategory: 'governance',
        targetType: 'proposal',
        targetId: proposalId,
        targetName: proposalData.title,
        result: 'success',
        metadata: {
          permissionLevel: 'admin',
          reason: reason,
          daoId
        }
      });

      return res.json({
        success: true,
        message: 'Proposal cancelled successfully by admin',
        data: {
          proposalId,
          status: 'cancelled',
          permissionLevel: 'admin',
          reason: reason,
          cancelledAt: new Date()
        }
      });
    }

    // Permission Level 3: Emergency Superuser (requires special handling)
    if (isSuperuser) {
      // For emergency cancellations, superuser needs to provide approval board status
      // In this implementation, we require explicit approval board acknowledgement
      if (!approvalBoardApproved) {
        return res.status(400).json({
          success: false,
          message: 'Superuser emergency cancellation requires approval board approval',
          data: {
            requiredFields: ['reason', 'approvalBoardApproved'],
            permissionLevel: 'superuser_emergency'
          }
        });
      }

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Superuser must provide a reason for emergency cancellation',
          data: {
            requiredFields: ['reason']
          }
        });
      }

      // Superuser emergency cancellation
      await db.update(proposals)
        .set({
          status: 'cancelled',
          metadata: sql`jsonb_set(
            COALESCE(metadata, '{}'::jsonb), 
            '{cancellation}', 
            ${JSON.stringify({
              cancelledBy: userId,
              cancelledAt: new Date(),
              reason: reason,
              permissionLevel: 'superuser_emergency',
              approvalBoardApproved: true
            })}
          )`
        })
        .where(eq(proposals.id, proposalId));

      // Remove from execution queue if present
      await db.delete(proposalExecutionQueue)
        .where(eq(proposalExecutionQueue.proposalId, proposalId));

      // Log the cancellation
      await logConsolidatedAuditEvent({
        actorId: userId,
        actorType: 'super_admin',
        actionType: AuditEventType.PROPOSAL_CANCELLED,
        actionCategory: 'governance',
        targetType: 'proposal',
        targetId: proposalId,
        targetName: proposalData.title,
        result: 'success',
        severity: 'critical',
        metadata: {
          permissionLevel: 'superuser_emergency',
          reason: reason,
          approvalBoardApproved: true,
          daoId
        }
      });

      return res.json({
        success: true,
        message: 'Proposal emergency cancelled by superuser',
        data: {
          proposalId,
          status: 'cancelled',
          permissionLevel: 'superuser_emergency',
          reason: reason,
          cancelledAt: new Date()
        }
      });
    }

    // If user has none of these permissions
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions to cancel this proposal',
      data: {
        isProposer,
        isAdmin,
        isSuperuser,
        userRole
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel proposal',
      error: error.message
    });
  }
});

// Simulate proposal execution (read-only)
router.post('/proposals/:proposalId/simulate', isAuthenticated, async (req, res) => {
  try {
    const { daoId, proposalId } = req.params;

    // Run simulation
    const result = await proposalSimulationService.simulate(proposalId, daoId);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Simulation failed',
      error: error.message
    });
  }
});

// Get proposal templates
router.get('/templates', isAuthenticated, async (req, res) => {
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
router.post('/templates', isAuthenticated, async (req, res) => {
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
router.post('/delegate', isAuthenticated, async (req, res) => {
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
router.get('/delegations', isAuthenticated, async (req, res) => {
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
router.delete('/delegate/:delegationId', isAuthenticated, async (req, res) => {
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
  // Issue deprecation warning
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 01 Sep 2026 00:00:00 GMT');
  res.setHeader('Link', '</api/dao/:daoId/quorum/check>; rel="successor-version"');
  res.setHeader('Warning', '299 - "POST /api/governance/proposals/:proposalId/check-quorum is deprecated. Use POST /api/dao/:daoId/quorum/check instead"');

  try {
    const { proposalId } = req.params as { proposalId: string };

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
    const yesVotes = proposalData.yesVotes || 0;
    const noVotes = proposalData.noVotes || 0;
    const totalVotes = yesVotes + noVotes + (proposalData.abstainVotes || 0);

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
    const majorityReached = yesVotes > noVotes;
    const quorumMet = totalVotes >= requiredQuorum;
    const passed = requiredQuorum > 0 && totalVotes >= requiredQuorum && majorityReached; // Ensure quorum is met and majority reached

    let newStatus = 'failed';
    let failureReason = '';

    if (!quorumMet) { // This check should be redundant if the above block is correctly executed
      newStatus = 'failed';
      failureReason = `Quorum not met: ${totalVotes}/${requiredQuorum} votes (${(totalVotes / totalActiveMembers * 100).toFixed(2)}% participation)`;
    } else if (!majorityReached) {
      newStatus = 'failed';
      failureReason = `Majority not reached: ${yesVotes} yes vs ${noVotes} no votes`;
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

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 2: GOVERNANCE LEADERBOARDS (DUAL-SCOPE: SYSTEM-WIDE + DAO-SPECIFIC)
// ════════════════════════════════════════════════════════════════════════════════

// ████████████████████████████████████████████████████████████████████████████████
// SYSTEM-WIDE LEADERBOARDS (No daoId - Global metrics)
// ████████████████████████████████████████████████████████████████████████████████

/**
 * GET /api/v1/governance/leaderboard/referrals
 * Global referral leaderboard - ranks users by total referrals across platform
 */
router.get('/leaderboard/referrals', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await governanceLeaderboardService.getSystemRefferalLeaderboard(limit, offset);

    res.json({
      success: true,
      type: 'system-referral-leaderboard',
      data: result,
      pagination: { limit, offset, total: result.totalParticipants },
    });
  } catch (error) {
    logger.error('Error fetching system referral leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch referral leaderboard' });
  }
});

/**
 * GET /api/v1/governance/leaderboard/contributors
 * Global contributors leaderboard - ranks users by total contribution amount
 */
router.get('/leaderboard/contributors', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await governanceLeaderboardService.getSystemContributorsLeaderboard(limit, offset);

    res.json({
      success: true,
      type: 'system-contributors-leaderboard',
      data: result,
      pagination: { limit, offset, total: result.totalParticipants },
    });
  } catch (error) {
    logger.error('Error fetching system contributors leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch contributors leaderboard' });
  }
});

/**
 * GET /api/v1/governance/leaderboard/consolidated
 * Global consolidated governance statistics
 */
router.get('/leaderboard/consolidated', async (req, res) => {
  try {
    const stats = await governanceLeaderboardService.getSystemConsolidatedStats();

    res.json({
      success: true,
      type: 'system-consolidated-stats',
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching system consolidated stats:', error);
    res.status(500).json({ error: 'Failed to fetch consolidated stats' });
  }
});

/**
 * GET /api/v1/governance/leaderboard
 * Main system leaderboard endpoint (returns top referrers and contributors)
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

    const [referrals, contributors, stats] = await Promise.all([
      governanceLeaderboardService.getSystemRefferalLeaderboard(limit, 0),
      governanceLeaderboardService.getSystemContributorsLeaderboard(limit, 0),
      governanceLeaderboardService.getSystemConsolidatedStats(),
    ]);

    res.json({
      success: true,
      type: 'system-leaderboard',
      data: {
        referrals: referrals.leaderboard,
        contributors: contributors.leaderboard,
        stats,
      },
    });
  } catch (error) {
    logger.error('Error fetching system leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /api/v1/governance/stats
 * Overall governance metrics (system-wide)
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await governanceLeaderboardService.getSystemConsolidatedStats();

    res.json({
      success: true,
      type: 'governance-stats',
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching governance stats:', error);
    res.status(500).json({ error: 'Failed to fetch governance stats' });
  }
});

/**
 * GET /api/v1/governance/me/referral-rank
 * Get current authenticated user's referral rank (system-wide)
 */
router.get('/me/referral-rank', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const rank = await governanceLeaderboardService.getUserReferralRank(userId);

    res.json({
      success: true,
      type: 'user-referral-rank',
      data: rank,
    });
  } catch (error) {
    logger.error('Error fetching user referral rank:', error);
    res.status(500).json({ error: 'Failed to fetch user rank' });
  }
});

// ████████████████████████████████████████████████████████████████████████████████
// DAO-SPECIFIC LEADERBOARDS (With daoId - Per-DAO metrics)
// ████████████████████████████████████████████████████████████████████████████████

/**
 * GET /api/v1/daos/:daoId/governance/leaderboard
 * Main DAO leaderboard - returns top contributors and voters
 */
router.get('/daos/:daoId/governance/leaderboard', isAuthenticated, async (req: any, res) => {
  try {
    const { daoId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

    const [activity, contributions] = await Promise.all([
      governanceLeaderboardService.getDAOActivityLeaderboard(daoId, limit, 0),
      governanceLeaderboardService.getDAOContributionsLeaderboard(daoId, limit, 0),
    ]);

    res.json({
      success: true,
      type: 'dao-leaderboard',
      daoId,
      data: {
        activity: activity.leaderboard,
        contributions: contributions.leaderboard,
      },
    });
  } catch (error) {
    logger.error(`Error fetching DAO ${req.params.daoId} leaderboard:`, error);
    res.status(500).json({ error: 'Failed to fetch DAO leaderboard' });
  }
});

/**
 * GET /api/v1/daos/:daoId/governance/leaderboard/activity
 * DAO activity leaderboard - ranks members by contributions, proposals, and votes
 */
router.get('/daos/:daoId/governance/leaderboard/activity', isAuthenticated, async (req: any, res) => {
  try {
    const { daoId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await governanceLeaderboardService.getDAOActivityLeaderboard(daoId, limit, offset);

    res.json({
      success: true,
      type: 'dao-activity-leaderboard',
      daoId,
      data: result,
      pagination: { limit, offset, total: result.totalParticipants },
    });
  } catch (error) {
    logger.error(`Error fetching DAO ${req.params.daoId} activity leaderboard:`, error);
    res.status(500).json({ error: 'Failed to fetch activity leaderboard' });
  }
});

/**
 * GET /api/v1/daos/:daoId/governance/leaderboard/contributions
 * DAO contributions leaderboard - ranks members by total contributions
 */
router.get('/daos/:daoId/governance/leaderboard/contributions', isAuthenticated, async (req: any, res) => {
  try {
    const { daoId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await governanceLeaderboardService.getDAOContributionsLeaderboard(daoId, limit, offset);

    res.json({
      success: true,
      type: 'dao-contributions-leaderboard',
      daoId,
      data: result,
      pagination: { limit, offset, total: result.totalParticipants },
    });
  } catch (error) {
    logger.error(`Error fetching DAO ${req.params.daoId} contributions leaderboard:`, error);
    res.status(500).json({ error: 'Failed to fetch contributions leaderboard' });
  }
});

/**
 * GET /api/v1/daos/:daoId/governance/leaderboard/voting
 * DAO voting leaderboard - ranks members by voting participation
 */
router.get('/daos/:daoId/governance/leaderboard/voting', isAuthenticated, async (req: any, res) => {
  try {
    const { daoId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await governanceLeaderboardService.getDAOVotingLeaderboard(daoId, limit, offset);

    res.json({
      success: true,
      type: 'dao-voting-leaderboard',
      daoId,
      data: result,
      pagination: { limit, offset, total: result.totalParticipants },
    });
  } catch (error) {
    logger.error(`Error fetching DAO ${req.params.daoId} voting leaderboard:`, error);
    res.status(500).json({ error: 'Failed to fetch voting leaderboard' });
  }
});

/**
 * GET /api/v1/daos/:daoId/governance/stats
 * DAO consolidated governance statistics
 */
router.get('/daos/:daoId/governance/stats', isAuthenticated, async (req: any, res) => {
  try {
    const { daoId } = req.params;

    const stats = await governanceLeaderboardService.getDAOConsolidatedStats(daoId);

    res.json({
      success: true,
      type: 'dao-governance-stats',
      daoId,
      data: stats,
    });
  } catch (error) {
    logger.error(`Error fetching DAO ${req.params.daoId} stats:`, error);
    res.status(500).json({ error: 'Failed to fetch DAO stats' });
  }
});

/**
 * GET /api/v1/daos/:daoId/governance/me/rank
 * Get current authenticated user's rank in DAO activity leaderboard
 */
router.get('/daos/:daoId/governance/me/rank', isAuthenticated, async (req: any, res) => {
  try {
    const { daoId } = req.params;
    const userId = req.user?.id || req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const rank = await governanceLeaderboardService.getUserDAOActivityRank(userId, daoId);

    res.json({
      success: true,
      type: 'user-dao-activity-rank',
      daoId,
      data: rank,
    });
  } catch (error) {
    logger.error(`Error fetching user DAO ${req.params.daoId} activity rank:`, error);
    res.status(500).json({ error: 'Failed to fetch user rank' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// END PHASE 2: GOVERNANCE LEADERBOARDS
// ════════════════════════════════════════════════════════════════════════════════

export default router;