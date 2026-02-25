/**
 * Payment Flow Simulation Routes
 * 
 * Endpoints for simulating destructive payment actions before execution
 * Each endpoint accepts simulation parameters and returns before/after state
 * 
 * Integration:
 * - Simulation result populates ReversibleAction.beforeState/afterState
 * - User reviews simulation before confirming execution
 * - On confirmation, ReversibilityService.createReversibleAction() called
 * - Action enters PENDING_CONFIRMATION state with simulation snapshot
 */

import { Router, Request, Response } from 'express';
import {
  PaymentDepositSimulator,
  PaymentWithdrawalSimulator,
  PaymentP2PTransferSimulator,
  RecurringPaymentSetupSimulator,
  PaymentSettlementSimulator,
} from '../services/paymentFlowSimulator';
import { ReversibilityService } from '../services/reversibilityService';
import { SimulationStatus } from '../services/simulationFramework';

const router = Router();
const depositSimulator = new PaymentDepositSimulator();
const withdrawalSimulator = new PaymentWithdrawalSimulator();
const p2pTransferSimulator = new PaymentP2PTransferSimulator();
const recurringSimulator = new RecurringPaymentSetupSimulator();
const settlementSimulator = new PaymentSettlementSimulator();

// Assuming these are available from your project
const reversibilityService = new ReversibilityService();

/**
 * POST /api/simulation/payment-deposit
 * 
 * Simulate a deposit of funds into the platform
 * 
 * Body params:
 * - amount: number
 * - currency: 'USD' | 'EUR' | 'BTC' | 'ETH' | 'MTAA'
 * - paymentMethod: 'bank_transfer' | 'card' | 'wallet'
 * - exchangeRate?: number (default: 1.0)
 * 
 * Response:
 * - status: 'SUCCESS' | 'WARNING' | 'ERROR'
 * - beforeState: Platform state before deposit
 * - afterState: Platform state after deposit
 * - delta: Changes
 * - riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
 * - reversibilityWindow: Grace period options
 * - warnings: Any warnings about this deposit
 */
router.post('/payment-deposit', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.body.userId; // From auth context or body
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const simulationResult = await depositSimulator.simulate({
      userId,
      ...req.body,
    });

    // Add action reference if user wants to proceed
    const actionInitiation = {
      actionType: 'PAYMENT_DEPOSIT',
      severity: 'LOW', // Deposits are low risk
      reversibilityScope: {
        initiatorCanReverse: true,
        adminCanReverse: true,
        governanceCanReverse: true,
      },
      gracePeriodHours: simulationResult.reversibilityWindow.recommendedGracePeriodHours,
      requiresApproval: false, // Low risk = no approval needed
      estimatedIrreversibleAt: new Date(
        Date.now() + simulationResult.reversibilityWindow.recommendedGracePeriodHours * 60 * 60 * 1000
      ),
    };

    return res.json({
      simulation: simulationResult,
      nextStep: {
        message: 'Review simulation and confirm deposit',
        endpoint: 'POST /api/payments/deposit',
        actionInitiation,
      },
    });
  } catch (error) {
    console.error('Deposit simulation error:', error);
    return res.status(500).json({
      error: 'Simulation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/simulation/payment-withdrawal
 * 
 * Simulate withdrawal of funds from the platform
 * 
 * Body params:
 * - amount: number (in MTAA)
 * - currency: 'USD' | 'EUR' | 'BTC' | 'ETH'
 * - destination: 'bank' | 'wallet' | 'card'
 * - userBalance: number (current balance)
 * 
 * Response: Same as deposit, but with withdrawal-specific warnings
 */
router.post('/payment-withdrawal', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const simulationResult = await withdrawalSimulator.simulate({
      userId,
      ...req.body,
    });

    // Determine if approval is needed based on simulation
    const requiresApproval = simulationResult.riskLevel === 'HIGH' || simulationResult.riskLevel === 'CRITICAL';
    const gracePeriodHours = requiresApproval ? 48 : 24;

    const actionInitiation = {
      actionType: 'PAYMENT_WITHDRAWAL',
      severity: 'MEDIUM', // Withdrawals are riskier than deposits
      reversibilityScope: {
        initiatorCanReverse: true,
        adminCanReverse: true,
        governanceCanReverse: true,
      },
      gracePeriodHours,
      requiresApproval,
      estimatedIrreversibleAt: new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000),
    };

    return res.json({
      simulation: simulationResult,
      nextStep: {
        message: 'Review simulation and confirm withdrawal',
        endpoint: 'POST /api/payments/withdraw',
        actionInitiation,
      },
    });
  } catch (error) {
    console.error('Withdrawal simulation error:', error);
    return res.status(500).json({
      error: 'Simulation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/simulation/payment-p2p
 * 
 * Simulate P2P transfer between two users
 * 
 * Body params:
 * - recipientId: string
 * - amount: number (in MTAA)
 * - memo?: string
 * - userBalance: number
 * 
 * Response: Transfer simulation with impact on both accounts
 */
router.post('/payment-p2p', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const simulationResult = await p2pTransferSimulator.simulate({
      userId,
      ...req.body,
    });

    // Check if memo suggests unregistered securities
    const hasConcerns = simulationResult.riskFactors.includes('potential-securities');

    const actionInitiation = {
      actionType: 'PAYMENT_P2P_TRANSFER',
      severity: hasConcerns ? 'MEDIUM' : 'LOW',
      reversibilityScope: {
        initiatorCanReverse: true,
        adminCanReverse: true,
        governanceCanReverse: true,
      },
      gracePeriodHours: 48,
      requiresApproval: hasConcerns,
      estimatedIrreversibleAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    };

    return res.json({
      simulation: simulationResult,
      nextStep: {
        message: 'Review simulation and confirm P2P transfer',
        endpoint: 'POST /api/payments/transfer-p2p',
        actionInitiation,
      },
    });
  } catch (error) {
    console.error('P2P transfer simulation error:', error);
    return res.status(500).json({
      error: 'Simulation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/simulation/recurring-payment-setup
 * 
 * Simulate setup of recurring/scheduled payments
 * 
 * Body params:
 * - recipientId: string
 * - amount: number (per cycle)
 * - frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'
 * - startDate: number (unix timestamp, must be future)
 * - cycles?: number (undefined = perpetual)
 * - userBalance: number
 * 
 * Response: Setup impact and projected annual burden
 */
router.post('/recurring-payment-setup', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const simulationResult = await recurringSimulator.simulate({
      userId,
      ...req.body,
    });

    // Perpetual payments require approval
    const isPerpetual = !req.body.cycles;
    const highBurden = simulationResult.riskFactors.includes('high-commitment');
    const requiresApproval = isPerpetual || highBurden;

    const actionInitiation = {
      actionType: 'RECURRING_PAYMENT_SETUP',
      severity: highBurden ? 'HIGH' : 'MEDIUM',
      reversibilityScope: {
        initiatorCanReverse: true, // Can cancel anytime
        adminCanReverse: true,
        governanceCanReverse: true,
      },
      gracePeriodHours: 48,
      requiresApproval,
      estimatedIrreversibleAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    };

    return res.json({
      simulation: simulationResult,
      nextStep: {
        message: 'Review recurring payment schedule and confirm setup',
        endpoint: 'POST /api/payments/setup-recurring',
        actionInitiation,
        warningNote: isPerpetual ? 'This is a perpetual payment - active until cancelled' : null,
      },
    });
  } catch (error) {
    console.error('Recurring payment simulation error:', error);
    return res.status(500).json({
      error: 'Simulation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/simulation/payment-settlement
 * 
 * Simulate settlement of a pending payment request
 * 
 * Body params:
 * - requestId: string
 * - senderId: string (who requested payment)
 * - amount: number
 * - userBalance: number
 * 
 * Response: Settlement impact and resolution
 */
router.post('/payment-settlement', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const simulationResult = await settlementSimulator.simulate({
      userId,
      ...req.body,
    });

    const actionInitiation = {
      actionType: 'PAYMENT_SETTLEMENT',
      severity: 'LOW',
      reversibilityScope: {
        initiatorCanReverse: true,
        adminCanReverse: true,
        governanceCanReverse: false, // Can't override payment settlements
      },
      gracePeriodHours: 24,
      requiresApproval: false,
      estimatedIrreversibleAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    return res.json({
      simulation: simulationResult,
      nextStep: {
        message: 'Review settlement and confirm payment',
        endpoint: 'POST /api/payments/settle',
        actionInitiation,
      },
    });
  } catch (error) {
    console.error('Settlement simulation error:', error);
    return res.status(500).json({
      error: 'Simulation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/simulation/summary
 * 
 * Get summary of all payment flow simulators available
 * Useful for frontend to discover available simulations
 */
router.get('/summary', (req: Request, res: Response) => {
  return res.json({
    simulators: [
      {
        id: 'payment-deposit',
        name: 'Deposit',
        description: 'Simulate fund deposits into platform',
        severity: 'LOW',
        depth: 'BASIC',
        requiredParams: ['amount', 'currency', 'paymentMethod'],
        optionalParams: ['exchangeRate'],
      },
      {
        id: 'payment-withdrawal',
        name: 'Withdrawal',
        description: 'Simulate fund withdrawals from platform',
        severity: 'MEDIUM',
        depth: 'BASIC',
        requiredParams: ['amount', 'currency', 'destination', 'userBalance'],
        optionalParams: [],
      },
      {
        id: 'payment-p2p',
        name: 'P2P Transfer',
        description: 'Simulate direct user-to-user transfers',
        severity: 'LOW',
        depth: 'BASIC',
        requiredParams: ['recipientId', 'amount', 'userBalance'],
        optionalParams: ['memo'],
      },
      {
        id: 'recurring-payment-setup',
        name: 'Recurring Payment Setup',
        description: 'Simulate setup of scheduled recurring payments',
        severity: 'MEDIUM',
        depth: 'BASIC',
        requiredParams: ['recipientId', 'amount', 'frequency', 'startDate', 'userBalance'],
        optionalParams: ['cycles'],
      },
      {
        id: 'payment-settlement',
        name: 'Payment Settlement',
        description: 'Simulate settlement of pending payment requests',
        severity: 'LOW',
        depth: 'BASIC',
        requiredParams: ['requestId', 'senderId', 'amount', 'userBalance'],
        optionalParams: [],
      },
    ],
  });
});

export default router;
