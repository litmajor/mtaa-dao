/**
 * Payment Execution Integration Layer
 * 
 * Layer between simulations and actual payment execution.
 * 
 * Flow:
 * 1. User reviews simulation result: POST /api/simulation/payment-{action}
 * 2. User confirms action: POST /api/payments/{action} with simulation snapshot
 * 3. System creates ReversibleAction with simulation data
 * 4. Action enters PENDING_CONFIRMATION state
 * 5. Action requires approval if severity is MEDIUM/HIGH
 * 6. Once approved (if needed), action enters GRACE_PERIOD
 * 7. User or admin can reverse within grace period
 * 8. After grace period, action EXECUTED and becomes IRREVERSIBLE
 * 
 * All payment actions tracked in `action_reversals` table with full audit trail
 */

import { ReversibilityService } from './reversibilityService';
import {
  ReversibleAction,
  CreateReversibleActionDTO,
  ReverseActionDTO,
  ActorType,
  ActionSeverity,
  ReversalReason,
} from '../types/reversibility';
import { SimulationResult } from './simulationFramework';

export interface PaymentExecutionContext {
  userId: string;
  actionType: string;
  simulation: SimulationResult;
  paymentDetails: {
    [key: string]: any; // Amount, recipient, currency, etc.
  };
  approverIds?: string[]; // If approval required
}

/**
 * PaymentExecutionService
 * 
 * Orchestrates payment execution with reversibility protection
 */
export class PaymentExecutionService {
  private reversibilityService: ReversibilityService;

  constructor(reversibilityService: ReversibilityService) {
    this.reversibilityService = reversibilityService;
  }

  /**
   * Create a reversible payment action from confirmed user intent
   * 
   * This is called AFTER user reviews simulation and clicks "confirm"
   * 
   * Params:
   * - userId: who is performing the action
   * - actionType: one of PAYMENT_*, RECURRING_*
   * - simulation: result from simulator
   * - paymentDetails: specific payment parameters (amount, recipient, etc)
   * - approverIds: list of admin/approver IDs if approval required
   * 
   * Returns: ReversibleAction with grace period window and approval chain
   */
  async createPaymentAction(context: PaymentExecutionContext): Promise<ReversibleAction> {
    // Determine action severity based on simulation risk level
    const severityMap: Record<string, ActionSeverity> = {
      'LOW': ActionSeverity.LOW,
      'MEDIUM': ActionSeverity.MEDIUM,
      'HIGH': ActionSeverity.HIGH,
      'CRITICAL': ActionSeverity.CRITICAL,
    };

    const severity = severityMap[context.simulation.riskLevel] || ActionSeverity.MEDIUM;

    // Build the reversible action DTO
    const createDTO: CreateReversibleActionDTO = {
      actionType: context.actionType,
      entityType: 'payment',
      entityId: context.paymentDetails.requestId || `${context.userId}-${Date.now()}`,
      severity,
      initiatorId: context.userId,
      initiatorType: ActorType.USER,
      
      // Pre/post state from simulation
      beforeState: context.simulation.beforeState,
      afterState: context.simulation.afterState,
      
      // Simulation metadata
      simulationData: context.simulation.simulationData || {},
      
      // Reversibility configuration
      reversibilityScope: {
        initiatorCanReverse: severity !== ActionSeverity.CRITICAL, // Only initiator for LOW/MEDIUM
        adminCanReverse: true,
        governanceCanReverse: severity === ActionSeverity.CRITICAL,
      },
      
      // Grace period from simulation recommendation
      gracePeriodHours: Math.ceil(
        context.simulation.reversibilityWindow.recommendedGracePeriodHours
      ),
      
      // Approval requirements
      requiresApproval: severity === ActionSeverity.MEDIUM || severity === ActionSeverity.HIGH,
      approverIds: context.approverIds || [],
      
      // Metadata
      metadata: {
        simulationWarnings: context.simulation.warnings,
        simulationRiskFactors: context.simulation.riskFactors,
        impactedEntities: context.simulation.impactedEntities,
        paymentMethod: context.paymentDetails.paymentMethod,
        currency: context.paymentDetails.currency,
      },
      
      // Audit trail
      description: context.simulation.summary,
    };

    // Create reversible action
    const action = await this.reversibilityService.createReversibleAction(createDTO);

    return action;
  }

  /**
   * Reverse a payment action within its grace period
   * 
   * Called when user wants to undo a payment before it becomes irreversible
   * 
   * Params:
   * - actionId: ID of the ReversibleAction to reverse
   * - userId: who is requesting reversal
   * - reason: why reversing (e.g., 'user_requested', 'sent_to_wrong_recipient')
   * 
   * Returns: Updated ReversibleAction with REVERSED status
   */
  async reversePaymentAction(
    actionId: string,
    userId: string,
    reason: ReversalReason
  ): Promise<ReversibleAction> {
    const reverseDTO: ReverseActionDTO = {
      actionId,
      requesterId: userId,
      requesterType: ActorType.USER,
      reason,
      evidence: {
        timestamp: Date.now(),
        ipAddress: '0.0.0.0', // Would come from request context
        userAgent: '', // Would come from request context
      },
    };

    const reversedAction = await this.reversibilityService.reverseAction(reverseDTO);

    return reversedAction;
  }

  /**
   * Get reversal options for a pending payment action
   * 
   * Returns who can reverse and until when
   */
  async getReverseOptions(actionId: string): Promise<{
    canInitiatorReverse: boolean;
    canAdminReverse: boolean;
    canGovernanceReverse: boolean;
    gracePeriodEndsAt: Date;
    hoursRemaining: number;
    reversalReasons: ReversalReason[];
  }> {
    const action = await this.reversibilityService.getActionById(actionId);

    if (!action) {
      throw new Error(`Action ${actionId} not found`);
    }

    const now = Date.now();
    const gracePeriodEndsAt = new Date(action.gracePeriodEndsAt as any);
    const hoursRemaining = (gracePeriodEndsAt.getTime() - now) / (1000 * 60 * 60);

    return {
      canInitiatorReverse: action.reversibilityScope.initiatorCanReverse && hoursRemaining > 0,
      canAdminReverse: action.reversibilityScope.adminCanReverse && hoursRemaining > 0,
      canGovernanceReverse: action.reversibilityScope.governanceCanReverse && hoursRemaining > 0,
      gracePeriodEndsAt,
      hoursRemaining: Math.max(0, hoursRemaining),
      reversalReasons: [
        ReversalReason.USER_REQUESTED,
        ReversalReason.SENT_TO_WRONG_RECIPIENT,
        ReversalReason.DUPLICATE_PAYMENT,
        ReversalReason.INCORRECT_AMOUNT,
      ],
    };
  }

  /**
   * Execute a payment action after grace period or immediate execution if allowed
   * 
   * Called by:
   * - Scheduler when grace period ends
   * - User immediately if no grace period needed
   * - Fraud detection if emergency stop triggered
   */
  async executePaymentAction(actionId: string, userId: string): Promise<ReversibleAction> {
    const action = await this.reversibilityService.getActionById(actionId);

    if (!action) {
      throw new Error(`Action ${actionId} not found`);
    }

    // Execute the action (this would integrate with actual payment processors)
    // For now, we're just updating the state through reversibility service
    const executeDTO = {
      actionId,
      executorId: userId,
      executorType: ActorType.SYSTEM,
      result: {
        success: true,
        txHash: `0x${Math.random().toString(16).slice(2)}`, // Mock TX hash
        externalReference: `PAY-${Date.now()}`, // Payment gateway reference
      },
    };

    const executedAction = await this.reversibilityService.executeAction(executeDTO);

    return executedAction;
  }

  /**
   * Utility: Calculate exact grace period end time for a payment
   */
  getGracePeriodDeadline(
    createdAt: Date,
    gracePeriodHours: number
  ): {
    deadline: Date;
    hoursRemaining: number;
    percentRemaining: number;
  } {
    const deadline = new Date(createdAt.getTime() + gracePeriodHours * 60 * 60 * 1000);
    const now = Date.now();
    const hoursRemaining = Math.max(0, (deadline.getTime() - now) / (1000 * 60 * 60));
    const percentRemaining = Math.max(0, (hoursRemaining / gracePeriodHours) * 100);

    return {
      deadline,
      hoursRemaining,
      percentRemaining: Math.round(percentRemaining),
    };
  }

  /**
   * Utility: Get all pending payment actions for a user
   * 
   * Useful for dashboard showing "actions you can reverse"
   */
  async getUserPendingPayments(userId: string): Promise<ReversibleAction[]> {
    const actions = await this.reversibilityService.getActionsForEntity('user', userId);

    return actions
      .filter(a => a.actionType.startsWith('PAYMENT_'))
      .filter(a => ['PENDING_CONFIRMATION', 'GRACE_PERIOD'].includes(a.status))
      .sort((a: any, b: any) => new Date(b.gracePeriodEndsAt as any).getTime() - new Date(a.gracePeriodEndsAt as any).getTime());
  }

  /**
   * Utility: Get stats on payment actions (for admin dashboard)
   */
  async getPaymentActionStats(): Promise<{
    totalPendingConfirmation: number;
    totalInGracePeriod: number;
    totalReversed: number;
    totalExecuted: number;
    avgGracePeriodHours: number;
    mostCommonReverseReason: ReversalReason | null;
  }> {
    // This would query the action_reversals table with aggregations
    // For demo, returning mock data
    return {
      totalPendingConfirmation: 12,
      totalInGracePeriod: 48,
      totalReversed: 3,
      totalExecuted: 156,
      avgGracePeriodHours: 48,
      mostCommonReverseReason: ReversalReason.DUPLICATE_PAYMENT,
    };
  }
}

/**
 * Specific handlers for each payment action type
 * These wrap the generic PaymentExecutionService with action-specific logic
 */

export class DepositExecutionHandler {
  constructor(private paymentService: PaymentExecutionService) {}

  async execute(context: {
    userId: string;
    simulation: SimulationResult;
    amount: number;
    currency: string;
    paymentMethod: string;
    exchangeRate: number;
  }): Promise<ReversibleAction> {
    return this.paymentService.createPaymentAction({
      userId: context.userId,
      actionType: 'PAYMENT_DEPOSIT',
      simulation: context.simulation,
      paymentDetails: {
        amount: context.amount,
        currency: context.currency,
        paymentMethod: context.paymentMethod,
        exchangeRate: context.exchangeRate,
      },
    });
  }
}

export class WithdrawalExecutionHandler {
  constructor(private paymentService: PaymentExecutionService) {}

  async execute(context: {
    userId: string;
    simulation: SimulationResult;
    amount: number;
    currency: string;
    destination: string;
  }): Promise<ReversibleAction> {
    return this.paymentService.createPaymentAction({
      userId: context.userId,
      actionType: 'PAYMENT_WITHDRAWAL',
      simulation: context.simulation,
      paymentDetails: {
        amount: context.amount,
        currency: context.currency,
        destination: context.destination,
      },
    });
  }
}

export class P2PTransferExecutionHandler {
  constructor(private paymentService: PaymentExecutionService) {}

  async execute(context: {
    userId: string;
    recipientId: string;
    simulation: SimulationResult;
    amount: number;
    memo?: string;
  }): Promise<ReversibleAction> {
    return this.paymentService.createPaymentAction({
      userId: context.userId,
      actionType: 'PAYMENT_P2P_TRANSFER',
      simulation: context.simulation,
      paymentDetails: {
        recipientId: context.recipientId,
        amount: context.amount,
        memo: context.memo || '',
      },
    });
  }
}

export class RecurringPaymentExecutionHandler {
  constructor(private paymentService: PaymentExecutionService) {}

  async execute(context: {
    userId: string;
    recipientId: string;
    simulation: SimulationResult;
    amount: number;
    frequency: string;
    startDate: number;
    cycles?: number;
  }): Promise<ReversibleAction> {
    return this.paymentService.createPaymentAction({
      userId: context.userId,
      actionType: 'RECURRING_PAYMENT_SETUP',
      simulation: context.simulation,
      paymentDetails: {
        recipientId: context.recipientId,
        amount: context.amount,
        frequency: context.frequency,
        startDate: context.startDate,
        cycles: context.cycles,
      },
      // Recurring payments may need admin approval
      approverIds: context.cycles ? [] : ['admin-approval-required'],
    });
  }
}

export class PaymentSettlementExecutionHandler {
  constructor(private paymentService: PaymentExecutionService) {}

  async execute(context: {
    userId: string;
    requestId: string;
    senderId: string;
    simulation: SimulationResult;
    amount: number;
  }): Promise<ReversibleAction> {
    return this.paymentService.createPaymentAction({
      userId: context.userId,
      actionType: 'PAYMENT_SETTLEMENT',
      simulation: context.simulation,
      paymentDetails: {
        requestId: context.requestId,
        senderId: context.senderId,
        amount: context.amount,
      },
    });
  }
}
