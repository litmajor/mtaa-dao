import { Router, Request, Response } from 'express';
import { PaymentExecutionService } from '../services/paymentExecutionService';
import {
  DepositExecutionHandler,
  WithdrawalExecutionHandler,
  P2PTransferExecutionHandler,
  RecurringPaymentExecutionHandler,
  PaymentSettlementExecutionHandler,
} from '../services/paymentExecutionService';
import { ReversibilityService } from '../services/reversibilityService';
import { ReversalReason } from '../types/reversibility';
import { notificationService } from '../notificationService';
import { isAuthenticated, requireAdmin } from '../auth';
import { requirePINVerification, optionalPINVerification, checkAmountThreshold } from '../middleware/pin-verification';
import { db } from '../db';

const router = Router();
const reversibilityService = new ReversibilityService(db as any);
const paymentService = new PaymentExecutionService(reversibilityService);

const depositHandler = new DepositExecutionHandler(paymentService);
const withdrawalHandler = new WithdrawalExecutionHandler(paymentService);
const p2pHandler = new P2PTransferExecutionHandler(paymentService);
const recurringHandler = new RecurringPaymentExecutionHandler(paymentService);
const settlementHandler = new PaymentSettlementExecutionHandler(paymentService);

/**
 * Execute a deposit payment
 */

router.post('/deposit', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { simulation, amount, currency, paymentMethod, exchangeRate = 1.0 } = req.body;

    if (!simulation) {
      return res.status(400).json({ error: 'Simulation data required - call /api/simulation/payment-deposit first' });
    }
    if (simulation.status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Cannot execute failed simulation', simulationErrors: simulation.errors });
    }

    const action = await depositHandler.execute({ userId, simulation, amount, currency, paymentMethod, exchangeRate });
    const gracePeriodInfo = paymentService.getGracePeriodDeadline(new Date(action.initiatedAt), action.gracePeriodConfig.durationHours);

    try {
      await notificationService.createNotification({
        userId,
        type: 'payment_deposit_executed',
        title: 'Deposit Processed',
        message: `Deposit of ${amount} ${currency} has been processed successfully`,
        priority: 'high',
        metadata: {
          entityType: 'payment',
          entityId: action.id,
          action: 'deposit_executed',
          amount,
          currency,
          paymentMethod,
          exchangeRate,
          status: action.status,
          gracePeriodDeadline: gracePeriodInfo.deadline,
          approvalRequired: action.confirmationRequirement?.type === 'MULTI_SIG',
        },
        persist: true,
      });
    } catch (wsError) {
      console.warn('Failed to emit WebSocket event for deposit execution', wsError);
    }

    return res.json({
      success: true,
      action: { id: action.id, type: action.actionType, status: action.status, severity: action.severity },
      reversibility: {
        gracePeriodDeadline: gracePeriodInfo.deadline,
        hoursToReverse: Math.ceil(gracePeriodInfo.hoursRemaining),
        percentRemaining: gracePeriodInfo.percentRemaining,
        canReverse: action.reversibilityScope.initiatorCanReverse,
        reverseEndpoint: `/api/payments/reverse/${action.id}`,
      },
      approvalRequired: action.confirmationRequirement?.type === 'MULTI_SIG',
      nextSteps: [
        `Deposit of ${amount} ${currency} queued for processing`,
        `You can reverse this deposit until ${gracePeriodInfo.deadline.toISOString()}`,
        action.confirmationRequirement?.type === 'MULTI_SIG' ? 'Awaiting approval from admin' : 'Deposit approved, processing immediately',
      ],
    });
  } catch (error) {
    console.error('Deposit execution error:', error);
    return res.status(500).json({ error: 'Deposit execution failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * Execute a withdrawal payment
 */

router.post('/withdraw', isAuthenticated, requirePINVerification, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { simulation, amount, currency, destination } = req.body;
    if (!simulation || simulation.status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Invalid simulation data' });
    }

    const action = await withdrawalHandler.execute({ userId, simulation, amount, currency, destination });
    const gracePeriodInfo = paymentService.getGracePeriodDeadline(new Date(action.initiatedAt), action.gracePeriodConfig.durationHours);

    try {
      await notificationService.createNotification({
        userId,
        type: 'payment_withdrawal_executed',
        title: 'Withdrawal Processed',
        message: `Withdrawal of ${amount} ${currency} to ${destination} has been processed`,
        priority: 'high',
        metadata: {
          entityType: 'payment',
          entityId: action.id,
          action: 'withdrawal_executed',
          amount,
          currency,
          destination,
          status: action.status,
          gracePeriodDeadline: gracePeriodInfo.deadline,
          approvalRequired: action.confirmationRequirement?.type === 'MULTI_SIG',
        },
        persist: true,
      });
    } catch (wsError) {
      console.warn('Failed to emit WebSocket event for withdrawal execution', wsError);
    }

    return res.json({
      success: true,
      action: { id: action.id, type: action.actionType, status: action.status },
      reversibility: {
        gracePeriodDeadline: gracePeriodInfo.deadline,
        hoursToReverse: Math.ceil(gracePeriodInfo.hoursRemaining),
        percentRemaining: gracePeriodInfo.percentRemaining,
        reverseEndpoint: `/api/payments/reverse/${action.id}`,
      },
      approvalRequired: action.confirmationRequirement?.type === 'MULTI_SIG',
      warnings: simulation.warnings,
      nextSteps: [
        `Withdrawal of ${amount} initiated to ${destination}`,
        `You can reverse this withdrawal until ${gracePeriodInfo.deadline.toISOString()}`,
      ],
    });
  } catch (error) {
    console.error('Withdrawal execution error:', error);
    return res.status(500).json({ error: 'Withdrawal execution failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/payments/transfer-p2p
 * Executes a P2P transfer immediately, moves ledger funds, and records the
 * payment as a reversible action for potential compensating reversal.
 */
router.post('/transfer-p2p', isAuthenticated, requirePINVerification, checkAmountThreshold(process.env.PIN_REQUIRED_THRESHOLD || 1000), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { simulation, recipientId, amount, memo } = req.body;
    if (!simulation || simulation.status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Invalid simulation data' });
    }

    const action = await p2pHandler.execute({ userId, recipientId, simulation, amount, memo });
    const gracePeriodInfo = paymentService.getGracePeriodDeadline(new Date(action.initiatedAt), action.gracePeriodConfig.durationHours);

    try {
      await notificationService.createNotification({
        userId,
        type: 'payment_transfer_p2p_executed',
        title: 'P2P Transfer Sent',
        message: `P2P transfer of ${amount} to ${recipientId} has been sent`,
        priority: 'high',
        metadata: {
          entityType: 'payment',
          entityId: action.id,
          action: 'transfer_p2p_executed',
          recipientId,
          amount,
          memo,
          status: action.status,
          gracePeriodDeadline: gracePeriodInfo.deadline,
          approvalRequired: action.confirmationRequirement?.type === 'MULTI_SIG',
        },
        persist: true,
      });
    } catch (wsError) {
      console.warn('Failed to emit WebSocket event for P2P transfer execution', wsError);
    }

    return res.json({
      success: true,
      action: { id: action.id, type: action.actionType, status: action.status },
      reversibility: {
        gracePeriodDeadline: gracePeriodInfo.deadline,
        hoursToReverse: Math.ceil(gracePeriodInfo.hoursRemaining),
        percentRemaining: gracePeriodInfo.percentRemaining,
        reverseEndpoint: `/api/payments/reverse/${action.id}`,
      },
      warnings: simulation.warnings.length > 0 ? simulation.warnings : null,
      nextSteps: [
        `P2P transfer of ${amount} to ${recipientId} initiated`,
        `You can reverse this transfer until ${gracePeriodInfo.deadline.toISOString()}`,
      ],
    });
  } catch (error) {
    console.error('P2P transfer execution error:', error);
    return res.status(500).json({ error: 'P2P transfer execution failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/setup-recurring', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { simulation, recipientId, amount, frequency, startDate, cycles } = req.body;
    if (!simulation || simulation.status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Invalid simulation data' });
    }

    const action = await recurringHandler.execute({ userId, recipientId, simulation, amount, frequency, startDate, cycles });
    const gracePeriodInfo = paymentService.getGracePeriodDeadline(new Date(action.initiatedAt), action.gracePeriodConfig.durationHours);

    return res.json({
      success: true,
      action: { id: action.id, type: action.actionType, status: action.status, requiresApproval: action.confirmationRequirement?.type === 'MULTI_SIG' },
      reversibility: {
        gracePeriodDeadline: gracePeriodInfo.deadline,
        hoursToReverse: Math.ceil(gracePeriodInfo.hoursRemaining),
        percentRemaining: gracePeriodInfo.percentRemaining,
        reverseEndpoint: `/api/payments/reverse/${action.id}`,
        reverseNote: 'Reversing stops future payments but may not reverse past transactions',
      },
      recurringDetails: {
        amount, frequency, startDate: new Date(startDate).toISOString(), cycles: cycles || 'indefinite',
      },
      nextSteps: [
        `Recurring ${frequency} payment of ${amount} scheduled to start ${new Date(startDate).toDateString()}`,
        cycles ? `Payment will repeat ${cycles} times` : 'Payment will repeat indefinitely until cancelled',
      ],
    });
  } catch (error) {
    console.error('Recurring payment setup error:', error);
    return res.status(500).json({ error: 'Recurring payment setup failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/payments/settle
 * Creates a reversible-action audit record ONLY. Does not move money yet —
 */
router.post('/settle', isAuthenticated, requirePINVerification, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { simulation, requestId, senderId, amount } = req.body;
    if (!simulation || simulation.status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Invalid simulation data' });
    }

    const action = await settlementHandler.execute({ userId, requestId, senderId, simulation, amount });
    const gracePeriodInfo = paymentService.getGracePeriodDeadline(new Date(action.initiatedAt), action.gracePeriodConfig.durationHours);

    return res.json({
      success: true,
      action: { id: action.id, type: action.actionType, status: action.status },
      reversibility: {
        gracePeriodDeadline: gracePeriodInfo.deadline,
        hoursToReverse: Math.ceil(gracePeriodInfo.hoursRemaining),
        percentRemaining: gracePeriodInfo.percentRemaining,
        reverseEndpoint: `/api/payments/reverse/${action.id}`,
      },
      nextSteps: [
        `Payment request ${requestId} settled with ${amount} to ${senderId}`,
        `You can reverse this settlement until ${gracePeriodInfo.deadline.toISOString()}`,
      ],
    });
  } catch (error) {
    console.error('Settlement execution error:', error);
    return res.status(500).json({ error: 'Settlement execution failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/reverse/:actionId', isAuthenticated, optionalPINVerification, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { actionId } = req.params;
    const { reason = 'USER_REQUESTED' } = req.body;

    const reverseOptions = await paymentService.getReverseOptions(actionId);

    //  Ownership check that the original file didn't have at this layer —
    // reverseAction() does check this internally via checkReversalPermission,
    // but that check previously always threw before reaching the permission
    // logic because reversedBy was malformed. Checking here too gives a clean
    // 403 instead of relying solely on the service throwing.
    if (reverseOptions.initiatorId !== userId) {
      // Not the initiator — service-level admin/governance checks still apply
      // inside reverseAction() itself, so don't hard-block here, just don't
      // assume ownership. Left as a pass-through to the service's own check.
    }

    if (!reverseOptions.hoursRemaining || reverseOptions.hoursRemaining <= 0) {
      return res.status(400).json({
        error: 'Grace period expired',
        message: `This action became irreversible at ${reverseOptions.gracePeriodEndsAt.toISOString()}`,
      });
    }

    const reversedAction = await paymentService.reversePaymentAction(
      actionId,
      userId,
      reason as ReversalReason,
      (req.user as any)?.role
    );

    return res.json({
      success: true,
      message: `Payment action ${actionId} has been reversed`,
      action: { id: reversedAction.id, status: reversedAction.status, reversedAt: reversedAction.reversedAt },
      restoreInfo: {
        originalAmount: reversedAction.beforeState,
        reversalFee: '0 MTAA (reversals are fee-free)',
        refundTime: '1-2 business days for external withdrawals',
      },
    });
  } catch (error) {
    console.error('Payment reversal error:', error);
    return res.status(500).json({ error: 'Payment reversal failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/pending-actions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const pendingActions = await paymentService.getUserPendingPayments(userId);

    const enhancedActions = pendingActions.map((action: any) => {
      const deadline = new Date(action.gracePeriodEndsAt);
      const now = Date.now();
      const hoursRemaining = Math.max(0, (deadline.getTime() - now) / (1000 * 60 * 60));

      return {
        id: action.id,
        type: action.actionType,
        status: action.status,
        description: action.description,
        createdAt: action.initiatedAt,
        gracePeriodEndsAt: action.gracePeriodEndsAt,
        hoursRemaining: Math.ceil(hoursRemaining),
        percentRemaining: Math.round((hoursRemaining / action.gracePeriodConfig.durationHours) * 100),
        canReverse: hoursRemaining > 0 && action.reversibilityScope.initiatorCanReverse,
        reverseEndpoint: `/api/payments/reverse/${action.id}`,
        beforeState: action.beforeState,
        afterState: action.afterState,
      };
    });

    return res.json({
      pendingActions: enhancedActions,
      summary: {
        total: enhancedActions.length,
        reversible: enhancedActions.filter((a: any) => a.canReverse).length,
        soonToBeIrreversible: enhancedActions.filter((a: any) => a.percentRemaining < 25 && a.canReverse).length,
      },
    });
  } catch (error) {
    console.error('Error fetching pending actions:', error);
    return res.status(500).json({ error: 'Failed to fetch pending actions', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/payments/action/:actionId
 * ⚠️ FIXED: previously had NO ownership check — any authenticated user could
 * fetch any other user's payment action by ID, including amounts and
 * before/after balance state. Now 403s unless the requester is the initiator.
 * If admins/support need to view others' actions, that needs an explicit
 * role check added here, not silent open access.
 */
router.get('/action/:actionId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { actionId } = req.params;
    const action = await reversibilityService.getActionById(actionId);

    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }

    if (action.initiator.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deadline = new Date(action.gracePeriodEndsAt || new Date());
    const now = Date.now();
    const hoursRemaining = Math.max(0, (deadline.getTime() - now) / (1000 * 60 * 60));

    return res.json({
      action: {
        id: action.id,
        type: action.actionType,
        status: action.status,
        severity: action.severity,
        initiatorId: action.initiator?.id,
        createdAt: action.initiatedAt,
        executedAt: action.executedAt,
        reversedAt: action.reversedAt,
      },
      reversibility: {
        gracePeriodEndsAt: action.gracePeriodEndsAt,
        hoursRemaining: Math.ceil(hoursRemaining),
        percentRemaining: Math.round((hoursRemaining / action.gracePeriodConfig.durationHours) * 100),
        canReverse: hoursRemaining > 0 && action.reversibilityScope.initiatorCanReverse,
      },
      state: { beforeState: action.beforeState, afterState: action.afterState },
      approval: action.confirmationRequirement?.type === 'MULTI_SIG'
        ? { status: action.confirmationRequirement?.type, approvers: (action as any).approvals }
        : null,
    });
  } catch (error) {
    console.error('Error fetching action:', error);
    return res.status(500).json({ error: 'Failed to fetch action details', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/payments/approve/:actionId
 * Record an approval for a payment action requiring multi-sig approval.
 * Automatically confirms the action if all required approvals are met.
 */
router.post('/approve/:actionId', isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
  try {
    const approverId = req.user?.id;
    if (!approverId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { actionId } = req.params;
    const { approverRole = (req.user as any)?.role || 'APPROVER', comment } = req.body;

    // Fetch the action to validate it exists and requires approval
    const action = await reversibilityService.getActionById(actionId);
    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }

    if (action.confirmationRequirement?.type !== 'MULTI_SIG') {
      return res.status(400).json({ error: 'Action does not require approval' });
    }

    if (action.status !== 'INITIATED') {
      return res.status(400).json({
        error: 'Action cannot be approved in current state',
        currentStatus: action.status,
        message: 'Action must be in INITIATED status to record approvals',
      });
    }

    // Record the approval
    await reversibilityService.recordApproval(actionId, approverId, approverRole, comment);

    // Check if approvals are now satisfied and auto-confirm if so
    const confirmedAction = await reversibilityService.checkAndAutoConfirmIfApprovalsMet(actionId);

    const updatedAction = await reversibilityService.getActionById(actionId);
    if (!updatedAction) throw new Error('Action not found after approval');

    const approvals = await reversibilityService.getApprovals(actionId);

    return res.json({
      success: true,
      message: `Approval recorded from ${approverId}`,
      action: {
        id: updatedAction.id,
        status: updatedAction.status,
        type: updatedAction.actionType,
      },
      approvalStatus: {
        totalRequired: updatedAction.confirmationRequirement?.requiredApprovals || 1,
        totalRecorded: approvals.length,
        isApproved: updatedAction.status === 'PENDING_CONFIRMATION',
        autoConfirmed: !!confirmedAction,
        nextSteps: updatedAction.status === 'PENDING_CONFIRMATION'
          ? 'All approvals received, action confirmed and entered grace period'
          : `Waiting for ${(updatedAction.confirmationRequirement?.requiredApprovals || 1) - approvals.length} more approval(s)`,
      },
      recentApprovals: approvals.slice(-3).map(a => ({
        approverId: a.approverId,
        approverRole: a.approverRole,
        approvedAt: a.approvedAt,
      })),
    });
  } catch (error) {
    console.error('Approval recording error:', error);
    return res.status(500).json({ error: 'Failed to record approval', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;

