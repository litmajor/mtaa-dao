import { Router, Request, Response } from 'express';
import agentProposalService, { CreateProposalDTO } from '../../services/agentProposalService';
import adminAuthService from '../../services/adminAuthService';
import adminAuditLogger from '../../services/adminAuditLogger';
import { agentStatusService } from '../../services/agentStatusService';
import { circuitBreakerRegistry } from '../../core/consolidation/CircuitBreakerConsolidation';
import { healthRegistry } from '../../core/consolidation/HealthRegistryConsolidation';
// Migration Status (Phase 5):
// PARTIAL: Agent status lookups can use healthRegistry.getAllAgents() for read-only access
// TODO: Full migration of deactivateAgent/activateAgent to pure consolidation API in Phase 6
// See deprecation notice in agentStatusService.ts for details

const router = Router();

// Extend Express Request type to include authContext
declare global {
  namespace Express {
    interface Request {
      authContext?: {
        userId: string;
        email: string;
        role: string;
        isSuperuser: boolean;
        ipAddress?: string;
        userAgent?: string;
        timestamp: Date;
      };
      user?: {
        id: string;
      };
    }
  }
}

/**
 * Middleware: Check if user is superuser
 */
const requireSuperuser = async (req: Request, res: Response, next: Function) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'No auth token provided' });
    }

    // Verify superuser status
    const user = await adminAuthService.verifySuperuser(userId);
    req.authContext = adminAuthService.extractAuthContext(
      user.id,
      user.email,
      user.role,
      user.is_superuser,
      req.ip,
      req.get('user-agent')
    );

    next();
  } catch (error: any) {
    return res.status(403).json({ error: 'Forbidden', message: error.message });
  }
};

/**
 * POST /api/admin/agents/:agentId/propose
 * Agent proposes an action (via safe mode)
 */
router.post('/agents/:agentId/propose', requireSuperuser, async (req: Request, res: Response) => {
  try {
    if (!req.authContext) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Auth context required' });
    }

    const { actionType, proposedArgs } = req.body;
    const agentId = req.params.agentId;

    // Validate input
    if (!actionType || !proposedArgs) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'actionType and proposedArgs are required',
      });
    }

    // Get agent and treasury balance
    const agent = await agentStatusService.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Agent ${agentId} not found`,
      });
    }

    // Mock treasury balance (in real world, fetch from treasury service)
    const treasuryBalance = proposedArgs.treasuryBalance || 1000000;

    // Create proposal (with risk analysis)
    const proposal = await agentProposalService.createProposal(
      {
        agentId,
        actionType,
        proposedArgs,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
      treasuryBalance
    );

    // Log audit
    await adminAuditLogger.logAction({
      adminUserId: req.authContext.userId,
      actionType: 'CREATE_PROPOSAL',
      resourceType: 'PROPOSAL',
      resourceId: proposal.id,
      afterState: { status: proposal.status, riskScore: proposal.risk_score },
      reason: 'Agent proposal submitted',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({
      success: true,
      proposal,
      riskAnalysis: {
        score: proposal.risk_score,
        category: proposal.risk_category,
        breakdown: proposal.risk_breakdown,
      },
      nextAction: `/api/admin/proposals/${proposal.id}/approve`,
    });
  } catch (error: any) {
    console.error('Error creating proposal:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * GET /api/admin/proposals
 * List all proposals (with optional filtering)
 */
router.get('/proposals', requireSuperuser, async (req: Request, res: Response) => {
  try {
    const { status, agentId, limit = 20, offset = 0 } = req.query;

    const proposals = await agentProposalService.getProposals({
      status: status as any,
      agentId: agentId as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    // Count pending proposals
    const pendingProposals = await agentProposalService.getProposals({
      status: 'PENDING',
      limit: 1000,
    });

    return res.status(200).json({
      success: true,
      totalProposals: proposals.length,
      pendingCount: pendingProposals.length,
      proposals,
    });
  } catch (error: any) {
    console.error('Error fetching proposals:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * GET /api/admin/proposals/:proposalId
 * Get single proposal details
 */
router.get('/proposals/:proposalId', requireSuperuser, async (req: Request, res: Response) => {
  try {
    const proposal = await agentProposalService.getProposal(req.params.proposalId);

    if (!proposal) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Proposal ${req.params.proposalId} not found`,
      });
    }

    // Get audit trail for this proposal
    const auditLogs = await adminAuditLogger.getResourceActionLogs('PROPOSAL', proposal.id);

    return res.status(200).json({
      success: true,
      proposal,
      auditTrail: auditLogs,
    });
  } catch (error: any) {
    console.error('Error fetching proposal:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * POST /api/admin/proposals/:proposalId/approve
 * Admin approves a proposal
 */
router.post('/proposals/:proposalId/approve', requireSuperuser, async (req: Request, res: Response) => {
  try {
    if (!req.authContext) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Auth context required' });
    }

    const { reason } = req.body;
    const proposalId = req.params.proposalId;

    // Validate reason
    if (!reason || reason.length < 10) {
      return res.status(400).json({
        powerChecklistItem: 6,
        error: 'Intent confirmation required',
        message: 'You must provide a reason (min 10 characters)',
        hint: 'Example: "Risk score is acceptable, slippage is minimal"',
      });
    }

    // Get proposal
    const beforeProposal = await agentProposalService.getProposal(proposalId);
    if (!beforeProposal) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Proposal ${proposalId} not found`,
      });
    }

    // Approve proposal
    const approvedProposal = await agentProposalService.approveProposal(
      proposalId,
      req.authContext.userId,
      reason
    );

    // Log audit
    await adminAuditLogger.logAction({
      adminUserId: req.authContext.userId,
      actionType: 'APPROVE_PROPOSAL',
      resourceType: 'PROPOSAL',
      resourceId: proposalId,
      beforeState: { status: beforeProposal.status },
      afterState: { status: approvedProposal.status, approvedAt: approvedProposal.approved_at },
      reason: reason,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({
      powerChecklistItems: [1, 2, 3, 6, 7, 8, 9, 10],
      success: true,
      proposal: approvedProposal,
      narrative: {
        action: 'Proposal Approved',
        impact: {
          agent: approvedProposal.agent_id,
          effect: `Will execute ${approvedProposal.action_type} action as proposed`,
          dataLoss: false,
        },
        timeline: {
          approvedAt: approvedProposal.approved_at,
          approvedBy: req.authContext.email,
          authority: req.authContext.role,
          reversible: 'YES - use POST /reject anytime before execution',
        },
      },
      auditLog: {
        actionType: 'APPROVE_PROPOSAL',
        actor: req.authContext.email,
        timestamp: new Date(),
        ipAddress: req.ip,
      },
    });
  } catch (error: any) {
    console.error('Error approving proposal:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * POST /api/admin/proposals/:proposalId/reject
 * Admin rejects a proposal
 */
router.post('/proposals/:proposalId/reject', requireSuperuser, async (req: Request, res: Response) => {
  try {
    if (!req.authContext) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Auth context required' });
    }

    const { reason } = req.body;
    const proposalId = req.params.proposalId;

    // Validate reason
    if (!reason || reason.length < 10) {
      return res.status(400).json({
        powerChecklistItem: 6,
        error: 'Intent confirmation required',
        message: 'You must provide a reason (min 10 characters)',
        hint: 'Example: "Risk score too high - needs security review"',
      });
    }

    // Get proposal
    const beforeProposal = await agentProposalService.getProposal(proposalId);
    if (!beforeProposal) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Proposal ${proposalId} not found`,
      });
    }

    // Reject proposal
    const rejectedProposal = await agentProposalService.rejectProposal(
      proposalId,
      req.authContext.userId,
      reason
    );

    // Log audit
    await adminAuditLogger.logAction({
      adminUserId: req.authContext.userId,
      actionType: 'REJECT_PROPOSAL',
      resourceType: 'PROPOSAL',
      resourceId: proposalId,
      beforeState: { status: beforeProposal.status },
      afterState: { status: rejectedProposal.status, rejectedAt: rejectedProposal.rejected_at },
      reason: reason,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({
      success: true,
      proposal: rejectedProposal,
      narrative: {
        action: 'Proposal Rejected',
        impact: {
          agent: rejectedProposal.agent_id,
          effect: 'Proposal will not be executed. Agent notified.',
          dataLoss: false,
        },
      },
      feedbackToAgent: `Your ${beforeProposal.action_type} proposal was rejected. Reason: ${reason}`,
    });
  } catch (error: any) {
    console.error('Error rejecting proposal:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * POST /api/admin/proposals/:proposalId/execute
 * Mark proposal as executed (after on-chain execution)
 */
router.post('/proposals/:proposalId/execute', requireSuperuser, async (req: Request, res: Response) => {
  try {
    if (!req.authContext) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Auth context required' });
    }

    const { executionHash } = req.body;
    const proposalId = req.params.proposalId;

    // Get proposal
    const beforeProposal = await agentProposalService.getProposal(proposalId);
    if (!beforeProposal) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Proposal ${proposalId} not found`,
      });
    }

    // Mark as executed
    const executedProposal = await agentProposalService.markExecuted(proposalId, executionHash);

    // Log audit
    await adminAuditLogger.logAction({
      adminUserId: req.authContext.userId,
      actionType: 'EXECUTE_PROPOSAL',
      resourceType: 'PROPOSAL',
      resourceId: proposalId,
      beforeState: { status: beforeProposal.status },
      afterState: {
        status: executedProposal.status,
        executedAt: executedProposal.executed_at,
        executionHash,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({
      success: true,
      proposal: executedProposal,
    });
  } catch (error: any) {
    console.error('Error executing proposal:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

export default router;
