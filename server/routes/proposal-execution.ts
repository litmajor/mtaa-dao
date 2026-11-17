
import express from 'express';
import { db } from '../storage';
import { 
  proposalExecutionQueue, 
  proposals,
  daos,
  daoMemberships
} from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { isAuthenticated } from '../auth';
import { ProposalExecutionService } from '../proposalExecutionService';
import { rateLimitMiddleware, proposalVotingLimits } from '../middleware/rateLimitConfig';

const router = express.Router();

// ============================================
// PHASE 1 FIX: Access Control Helper
// ============================================
/**
 * Verify user has permission to execute proposals for this DAO
 * Only DAO admins, elders, and superusers can execute proposals
 */
async function validateExecutionPermission(userId: string, daoId: string): Promise<boolean> {
  try {
    // Check if user is DAO member with proper role
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.daoId, daoId)
      ))
      .limit(1);
    
    if (!membership.length) {
      return false; // Not a DAO member
    }
    
    const memberRole = membership[0].role || '';
    const allowedRoles = ['creator', 'admin', 'elder', 'treasury_manager'];
    
    return allowedRoles.includes(memberRole);
  } catch (error) {
    console.error('Error validating execution permission:', error);
    return false;
  }
}

/**
 * Verify user is a DAO member (read-only operations)
 */
async function isDAOMember(userId: string, daoId: string): Promise<boolean> {
  try {
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.daoId, daoId)
      ))
      .limit(1);
    
    return membership.length > 0;
  } catch (error) {
    console.error('Error checking DAO membership:', error);
    return false;
  }
}

// Get execution queue for a DAO
router.get('/:daoId/queue', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = (req.user as any)?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    // Check if user is a DAO member (read permission)
    const isMember = await isDAOMember(userId, daoId);
    
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this DAO\'s execution queue'
      });
    }
    
    const executions = await db.select()
      .from(proposalExecutionQueue)
      .where(eq(proposalExecutionQueue.daoId, daoId))
      .orderBy(desc(proposalExecutionQueue.createdAt));
    
    res.json({
      success: true,
      data: executions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch execution queue',
      error: error.message
    });
  }
});

// Manually execute a proposal
// 🔴 CRITICAL: RATE LIMITED - Idempotency enforced to prevent double-execution
// Requires: Idempotency-Key header for financial safety
router.post('/:daoId/execute/:proposalId', [isAuthenticated, rateLimitMiddleware(proposalVotingLimits)], async (req: any, res: any) => {
  try {
    const { daoId, proposalId } = req.params;
    const userId = (req.user as any).claims.sub;
    const idempotencyKey = req.headers['idempotency-key'];
    
    // 🔴 CRITICAL: Require idempotency key for critical operation
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Idempotency-Key header must contain 1 to 200 characters',
        code: 'MISSING_IDEMPOTENCY_KEY'
      });
    }
    
    // PHASE 1 FIX: Check permissions (admin/elder/treasury_manager only)
    const hasPermission = await validateExecutionPermission(userId, daoId);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to execute proposals for this DAO. Only admins, elders, and treasury managers can execute proposals.'
      });
    }
    
    // Load any state so a retry can return the persisted result instead of re-running.
    const execution = await db.select()
      .from(proposalExecutionQueue)
      .where(and(
        eq(proposalExecutionQueue.proposalId, proposalId),
        eq(proposalExecutionQueue.daoId, daoId)
      ))
      .limit(2);
    
    if (!execution.length) {
      return res.status(404).json({
        success: false,
        message: 'No pending execution found for this proposal'
      });
    }
    if (execution.length > 1) {
      return res.status(409).json({
        success: false,
        message: 'Multiple execution queue records exist for this proposal; reconciliation is required',
        code: 'DUPLICATE_EXECUTION_RECORDS',
      });
    }
    
    const executionResult = await ProposalExecutionService.executeProposal(execution[0], userId, idempotencyKey);
    
    // Log execution for audit trail
    console.log(`[AUDIT] Proposal ${proposalId} executed by user ${userId} in DAO ${daoId} with idempotency key ${idempotencyKey}`);
    
    const resultStatus = executionResult.status ?? 'reconciliation_required';
    const unresolvedFailure = ['failed', 'reconciliation_required'].includes(resultStatus);
    const statusCode = unresolvedFailure ? 409 : resultStatus === 'completed' ? 200 : 202;
    res.status(statusCode).json({
      success: !unresolvedFailure,
      message: resultStatus === 'completed'
        ? 'Proposal execution completed'
        : unresolvedFailure
          ? 'Proposal execution requires reconciliation before it can continue'
        : 'Proposal is not yet settled; multisig submission and on-chain confirmation are required',
      data: executionResult,
      executedAt: resultStatus === 'completed' ? new Date() : undefined,
    });
  } catch (error: any) {
    const conflict = /already claimed|already assigned|not due|different idempotency|not in the approved/i.test(error.message || '');
    res.status(conflict ? 409 : 500).json({
      success: false,
      message: 'Proposal execution did not complete',
      error: error.message
    });
  }
});

router.post('/:daoId/executions/:executionId/reconcile', isAuthenticated, async (req: any, res: any) => {
  try {
    const { daoId, executionId } = req.params;
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });
    const hasPermission = await validateExecutionPermission(userId, daoId);
    if (!hasPermission) return res.status(403).json({ success: false, message: 'Insufficient permission to reconcile proposal execution' });

    const [execution] = await db.select()
      .from(proposalExecutionQueue)
      .where(and(eq(proposalExecutionQueue.id, executionId), eq(proposalExecutionQueue.daoId, daoId)))
      .limit(1);
    if (!execution) return res.status(404).json({ success: false, message: 'Execution not found' });

    const result = await ProposalExecutionService.reconcileOnchainExecution(executionId);
    const resultStatus = 'status' in result ? result.status : undefined;
    const responseStatus = resultStatus === 'completed' ? 200
      : resultStatus === 'failed' || resultStatus === 'reconciliation_required' ? 409
        : 202;
    return res.status(responseStatus).json({ success: responseStatus !== 409, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to reconcile proposal execution', error: error.message });
  }
});

// Cancel proposal execution
router.delete('/:daoId/cancel/:executionId', isAuthenticated, async (req, res) => {
  try {
    const { daoId, executionId } = req.params;
    const userId = (req.user as any).claims.sub;
    
    // PHASE 1 FIX: Check permissions
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
    
    // Log cancellation for audit trail
    console.log(`[AUDIT] Execution ${executionId} cancelled by user ${userId}`);
    
    res.json({
      success: true,
      message: 'Execution cancelled successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel execution',
      error: error.message
    });
  }
});

export default router;
