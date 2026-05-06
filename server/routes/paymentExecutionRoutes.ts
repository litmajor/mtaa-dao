/**
 * Payment Execution Routes
 * 
 * Handles actual execution of payment actions after user reviews simulation
 * 
 * Full flow:
 * 1. POST /api/simulation/payment-{action} - Get simulation preview
 * 2. User reviews and clicks confirm
 * 3. POST /api/payments/{action} - Execute with reversibility protection
 * 4. Action enters grace period
 * 5. Can reverse via: POST /api/payments/reverse/{actionId}
 * 6. After grace period, action becomes irreversible
 */

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
import { getEventEmitter } from '../middleware/websocket-event-emitter';

const router = Router();
const reversibilityService = new ReversibilityService(process.env.DATABASE_URL || '');
const paymentService = new PaymentExecutionService(reversibilityService);

// Execution handlers
const depositHandler = new DepositExecutionHandler(paymentService);
const withdrawalHandler = new WithdrawalExecutionHandler(paymentService);
const p2pHandler = new P2PTransferExecutionHandler(paymentService);
const recurringHandler = new RecurringPaymentExecutionHandler(paymentService);
const settlementHandler = new PaymentSettlementExecutionHandler(paymentService);

/**
 * POST /api/payments/deposit
 * 
 * Execute a deposit action after user reviewed simulation
 * 
 * Body:
 * - simulation: SimulationResult (from /api/simulation/payment-deposit)
 * - amount: number
 * - currency: string
 * - paymentMethod: string
 * - exchangeRate: number
 * - confirmSimulationHash?: string (to verify user reviewed)
 * 
 * Response:
 * - action: ReversibleAction with grace period info
 * - gracePeriodDeadline: ISO date when action becomes irreversible
 * - hoursToReverse: how long user has to reverse
 * - reverseEndpoint: URL to reverse if needed
 * - nextConfirm: if action requires approval, approval chain info
 */
router.post('/deposit', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { simulation, amount, currency, paymentMethod, exchangeRate = 1.0 } = req.body;

    if (!simulation) {
      return res.status(400).json({ error: 'Simulation data required - call /api/simulation/payment-deposit first' });
    }

    if (simulation.status !== 'SUCCESS') {
      return res.status(400).json({
        error: 'Cannot execute failed simulation',
        simulationErrors: simulation.errors,
      });
    }

    // Execute deposit with reversibility protection
    const action = await depositHandler.execute({
      userId,
      simulation,
      amount,
      currency,
      paymentMethod,
      exchangeRate,
    });

    // Calculate grace period info
    const gracePeriodInfo = paymentService.getGracePeriodDeadline(
      new Date(action.initiatedAt),
      action.gracePeriodConfig.durationHours
    );

    // Emit WebSocket event for deposit execution
    try {
      const wsEmitter = getEventEmitter();
      wsEmitter.emitActivity('payment', action.id, userId, 'deposit_executed', {
        amount,
        currency,
        paymentMethod,
        exchangeRate,
        status: action.status,
        gracePeriodDeadline: gracePeriodInfo.deadline,
        approvalRequired: action.confirmationRequirement?.type === 'MULTI_SIG'
      });
    } catch (wsError) {
      console.warn('Failed to emit WebSocket event for deposit execution', wsError);
    }

    return res.json({
      success: true,
      action: {
        id: action.id,
        type: action.actionType,
        status: action.status,
        severity: action.severity,
      },
      reversibility: {
        gracePeriodDeadline: gracePeriodInfo.deadline,
        hoursToReverse: Math.ceil(gracePeriodInfo.hoursRemaining),
        percentRemaining: gracePeriodInfo.percentRemaining,
        canReverse: action.reversibilityScope.initiatorCanReverse,
        reverseEndpoint: `/api/payments/reverse/${action.id}`,
      },
      approvalRequired: action.confirmationRequirement?.type === 'MULTI_SIG',
      nextSteps: [
        `Deposit of ${amount} ${currency} (${simulation.simulationData.nativeAmount} MTAA) queued for processing`,
        `You can reverse this deposit until ${gracePeriodInfo.deadline.toISOString()}`,
        action.confirmationRequirement?.type === 'MULTI_SIG' ? 'Awaiting approval from admin' : 'Deposit approved, processing immediately',
      ],
    });
  } catch (error) {
    console.error('Deposit execution error:', error);
    return res.status(500).json({
      error: 'Deposit execution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/payments/withdraw
 * 
 * Execute a withdrawal action
 */
router.post('/withdraw', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { simulation, amount, currency, destination } = req.body;

    if (!simulation || simulation.status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Invalid simulation data' });
    }

    const action = await withdrawalHandler.execute({
      userId,
      simulation,
      amount,
      currency,
      destination,
    });

    const gracePeriodInfo = paymentService.getGracePeriodDeadline(
      new Date(action.initiatedAt),
      action.gracePeriodConfig.durationHours
    );

    // Emit WebSocket event for withdrawal execution
    try {
      const wsEmitter = getEventEmitter();
      wsEmitter.emitActivity('payment', action.id, userId, 'withdrawal_executed', {
        amount,
        currency,
        destination,
        status: action.status,
        gracePeriodDeadline: gracePeriodInfo.deadline,
        approvalRequired: action.confirmationRequirement?.type === 'MULTI_SIG'
      });
    } catch (wsError) {
      console.warn('Failed to emit WebSocket event for withdrawal execution', wsError);
    }

    return res.json({
      success: true,
      action: {
        id: action.id,
        type: action.actionType,
        status: action.status,
      },
      reversibility: {
        gracePeriodDeadline: gracePeriodInfo.deadline,
        hoursToReverse: Math.ceil(gracePeriodInfo.hoursRemaining),
        percentRemaining: gracePeriodInfo.percentRemaining,
        reverseEndpoint: `/api/payments/reverse/${action.id}`,
      },
      approvalRequired: action.confirmationRequirement?.type === 'MULTI_SIG',
      warnings: simulation.warnings,
      nextSteps: [
        `Withdrawal of ${amount} MTAA initiated to ${destination}`,
        `Expected delivery time based on destination method`,
        `You can reverse this withdrawal until ${gracePeriodInfo.deadline.toISOString()}`,
      ],
    });
  } catch (error) {
    console.error('Withdrawal execution error:', error);
    return res.status(500).json({
      error: 'Withdrawal execution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/payments/transfer-p2p
 * 
 * Execute a P2P transfer
 */
router.post('/transfer-p2p', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { simulation, recipientId, amount, memo } = req.body;

    if (!simulation || simulation.status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Invalid simulation data' });
    }

    const action = await p2pHandler.execute({
      userId,
      recipientId,
      simulation,
      amount,
      memo,
    });

    const gracePeriodInfo = paymentService.getGracePeriodDeadline(
      new Date(action.initiatedAt),
      action.gracePeriodConfig.durationHours
    );

    // Emit WebSocket event for P2P transfer execution
    try {
      const wsEmitter = getEventEmitter();
      wsEmitter.emitActivity('payment', action.id, userId, 'transfer_p2p_executed', {
        recipientId,
        amount,
        memo,
        status: action.status,
        gracePeriodDeadline: gracePeriodInfo.deadline,
        approvalRequired: action.confirmationRequirement?.type === 'MULTI_SIG'
      });
    } catch (wsError) {
      console.warn('Failed to emit WebSocket event for P2P transfer execution', wsError);
    }

    return res.json({
      success: true,
      action: {
        id: action.id,
        type: action.actionType,
        status: action.status,
      },
      reversibility: {
        gracePeriodDeadline: gracePeriodInfo.deadline,
        hoursToReverse: Math.ceil(gracePeriodInfo.hoursRemaining),
        percentRemaining: gracePeriodInfo.percentRemaining,
        reverseEndpoint: `/api/payments/reverse/${action.id}`,
      },
      warnings: simulation.warnings.length > 0 ? simulation.warnings : null,
      nextSteps: [
        `P2P transfer of ${amount} MTAA to ${recipientId} initiated`,
        `Recipient will receive transfer immediately`,
        `You can reverse this transfer until ${gracePeriodInfo.deadline.toISOString()}`,
      ],
    });
  } catch (error) {
    console.error('P2P transfer execution error:', error);
    return res.status(500).json({
      error: 'P2P transfer execution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/payments/setup-recurring
 * 
 * Execute setup of recurring payment
 */
router.post('/setup-recurring', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { simulation, recipientId, amount, frequency, startDate, cycles } = req.body;

    if (!simulation || simulation.status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Invalid simulation data' });
    }

    const action = await recurringHandler.execute({
      userId,
      recipientId,
      simulation,
      amount,
      frequency,
      startDate,
      cycles,
    });

    const gracePeriodInfo = paymentService.getGracePeriodDeadline(
      new Date(action.initiatedAt),
      action.gracePeriodConfig.durationHours
    );

    return res.json({
      success: true,
      action: {
        id: action.id,
        type: action.actionType,
        status: action.status,
        requiresApproval: action.confirmationRequirement?.type === 'MULTI_SIG',
      },
      reversibility: {
        gracePeriodDeadline: gracePeriodInfo.deadline,
        hoursToReverse: Math.ceil(gracePeriodInfo.hoursRemaining),
        percentRemaining: gracePeriodInfo.percentRemaining,
        reverseEndpoint: `/api/payments/reverse/${action.id}`,
        reverseNote: 'Reversing stops future payments but may not reverse past transactions',
      },
      recurringDetails: {
        amount,
        frequency,
        startDate: new Date(startDate).toISOString(),
        cycles: cycles || 'indefinite',
        setupFee: simulation.simulationData.setupFee,
      },
      nextSteps: [
        `Recurring ${frequency} payment of ${amount} MTAA scheduled to start ${new Date(startDate).toDateString()}`,
        `Setup fee: ${simulation.simulationData.setupFee} MTAA deducted immediately`,
        cycles ? `Payment will repeat ${cycles} times` : 'Payment will repeat indefinitely until cancelled',
        `You can cancel this recurring payment until ${gracePeriodInfo.deadline.toISOString()}`,
      ],
    });
  } catch (error) {
    console.error('Recurring payment setup error:', error);
    return res.status(500).json({
      error: 'Recurring payment setup failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/payments/settle
 * 
 * Execute settlement of pending payment request
 */
router.post('/settle', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { simulation, requestId, senderId, amount } = req.body;

    if (!simulation || simulation.status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Invalid simulation data' });
    }

    const action = await settlementHandler.execute({
      userId,
      requestId,
      senderId,
      simulation,
      amount,
    });

    const gracePeriodInfo = paymentService.getGracePeriodDeadline(
      new Date(action.initiatedAt),
      action.gracePeriodConfig.durationHours
    );

    return res.json({
      success: true,
      action: {
        id: action.id,
        type: action.actionType,
        status: action.status,
      },
      reversibility: {
        gracePeriodDeadline: gracePeriodInfo.deadline,
        hoursToReverse: Math.ceil(gracePeriodInfo.hoursRemaining),
        percentRemaining: gracePeriodInfo.percentRemaining,
        reverseEndpoint: `/api/payments/reverse/${action.id}`,
      },
      settledAmount: simulation.simulationData.netAmount,
      fee: simulation.simulationData.settlementFee,
      nextSteps: [
        `Payment request ${requestId} settled with ${amount} MTAA to ${senderId}`,
        `You can reverse this settlement until ${gracePeriodInfo.deadline.toISOString()}`,
      ],
    });
  } catch (error) {
    console.error('Settlement execution error:', error);
    return res.status(500).json({
      error: 'Settlement execution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/payments/reverse/{actionId}
 * 
 * Reverse a payment action within grace period
 * 
 * Body:
 * - reason: ReversalReason enum
 * - details?: string (explanation for reversal)
 * 
 * Validations:
 * - Must be within grace period
 * - User must have permission to reverse
 * - Action must not already be reversed
 */
router.post('/reverse/:actionId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { actionId } = req.params;
    const { reason = 'USER_REQUESTED', details } = req.body;

    // Check if action can be reversed
    const reverseOptions = await paymentService.getReverseOptions(actionId);

    if (!reverseOptions.hoursRemaining || reverseOptions.hoursRemaining <= 0) {
      return res.status(400).json({
        error: 'Grace period expired',
        message: `This action became irreversible at ${reverseOptions.gracePeriodEndsAt.toISOString()}`,
      });
    }

    // Reverse the action
    const reversedAction = await paymentService.reversePaymentAction(
      actionId,
      userId,
      reason as ReversalReason
    );

    return res.json({
      success: true,
      message: `Payment action ${actionId} has been reversed`,
      action: {
        id: reversedAction.id,
        status: reversedAction.status,
        reversedAt: reversedAction.reversedAt,
      },
      restoreInfo: {
        originalAmount: reversedAction.beforeState,
        reversalFee: '0 MTAA (reversals are fee-free)', // Align with business model
        refundTime: '1-2 business days for external withdrawals',
      },
    });
  } catch (error) {
    console.error('Payment reversal error:', error);
    return res.status(500).json({
      error: 'Payment reversal failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/payments/pending-actions
 * 
 * Get all pending payment actions for authenticated user
 * Useful for dashboard showing reversible actions
 */
router.get('/pending-actions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.query.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const pendingActions = await paymentService.getUserPendingPayments(userId as string);

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
    return res.status(500).json({
      error: 'Failed to fetch pending actions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/payments/action/{actionId}
 * 
 * Get details of a specific payment action
 */
router.get('/action/:actionId', async (req: Request, res: Response) => {
  try {
    const { actionId } = req.params;

    const action = await reversibilityService.getActionById(actionId);

    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
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
      state: {
        beforeState: action.beforeState,
        afterState: action.afterState,
      },
      approval: action.confirmationRequirement?.type === 'MULTI_SIG'
        ? {
            status: action.confirmationRequirement?.type,
            approvers: action.approvals,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching action:', error);
    return res.status(500).json({
      error: 'Failed to fetch action details',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
