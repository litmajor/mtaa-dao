/**
 * Payment Flow Simulation Routes
 * 
 * Endpoints for simulating destructive payment actions before execution.
 * Each endpoint accepts simulation parameters and returns before/after state.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  PaymentDepositSimulator,
  PaymentWithdrawalSimulator,
  PaymentP2PTransferSimulator,
  RecurringPaymentSetupSimulator,
  PaymentSettlementSimulator,
} from '../services/paymentFlowSimulator';

const router = Router();

const depositSimulator = new PaymentDepositSimulator();
const withdrawalSimulator = new PaymentWithdrawalSimulator();
const p2pTransferSimulator = new PaymentP2PTransferSimulator();
const recurringSimulator = new RecurringPaymentSetupSimulator();
const settlementSimulator = new PaymentSettlementSimulator();

// Helper to convert hours to Date expiry
const getExpiryDate = (hours: number): Date => new Date(Date.now() + hours * 60 * 60 * 1000);

/**
 * Helper to ensure strictly authenticated user context
 */
const getAuthUserId = (req: Request, res: Response): string | null => {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Unauthorized context' });
    return null;
  }
  return req.user.id;
};

/**
 * POST /api/simulation/payment-deposit
 */
router.post('/payment-deposit', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;

    const { amount, currency, paymentMethod, exchangeRate } = req.body;

    const simulationResult = await depositSimulator.simulate({
      userId,
      amount,
      currency,
      paymentMethod,
      exchangeRate,
    });

    const gracePeriodHours = simulationResult.reversibilityWindow.recommendedGracePeriodHours;

    const actionInitiation = {
      actionType: 'PAYMENT_DEPOSIT',
      severity: 'LOW',
      reversibilityScope: {
        initiatorCanReverse: true,
        adminCanReverse: true,
        governanceCanReverse: true,
      },
      gracePeriodHours,
      requiresApproval: false,
      estimatedIrreversibleAt: getExpiryDate(gracePeriodHours),
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
 */
router.post('/payment-withdrawal', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;

    const { amount, currency, destination } = req.body;

    const simulationResult = await withdrawalSimulator.simulate({
      userId,
      amount,
      currency,
      destination,
    });

    const requiresApproval = simulationResult.riskLevel === 'HIGH' || simulationResult.riskLevel === 'CRITICAL';
    const gracePeriodHours = requiresApproval ? 48 : 24;

    const actionInitiation = {
      actionType: 'PAYMENT_WITHDRAWAL',
      severity: 'MEDIUM',
      reversibilityScope: {
        initiatorCanReverse: true,
        adminCanReverse: true,
        governanceCanReverse: true,
      },
      gracePeriodHours,
      requiresApproval,
      estimatedIrreversibleAt: getExpiryDate(gracePeriodHours),
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
 */
router.post('/payment-p2p', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;

    const { recipientId, amount, memo } = req.body;

    const simulationResult = await p2pTransferSimulator.simulate({
      userId,
      recipientId,
      amount,
      memo,
    });

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
      estimatedIrreversibleAt: getExpiryDate(48),
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
 */
router.post('/recurring-payment-setup', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;

    const { recipientId, amount, frequency, startDate, cycles } = req.body;

    const simulationResult = await recurringSimulator.simulate({
      userId,
      recipientId,
      amount,
      frequency,
      startDate,
      cycles,
    });

    const isPerpetual = !cycles;
    const highBurden = simulationResult.riskFactors.includes('high-commitment');
    const requiresApproval = isPerpetual || highBurden;

    const actionInitiation = {
      actionType: 'RECURRING_PAYMENT_SETUP',
      severity: highBurden ? 'HIGH' : 'MEDIUM',
      reversibilityScope: {
        initiatorCanReverse: true,
        adminCanReverse: true,
        governanceCanReverse: true,
      },
      gracePeriodHours: 48,
      requiresApproval,
      estimatedIrreversibleAt: getExpiryDate(48),
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
 */
router.post('/payment-settlement', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;

    const { requestId, senderId, amount } = req.body;

    const simulationResult = await settlementSimulator.simulate({
      userId,
      requestId,
      senderId,
      amount,
    });

    const actionInitiation = {
      actionType: 'PAYMENT_SETTLEMENT',
      severity: 'LOW',
      reversibilityScope: {
        initiatorCanReverse: true,
        adminCanReverse: true,
        governanceCanReverse: false,
      },
      gracePeriodHours: 24,
      requiresApproval: false,
      estimatedIrreversibleAt: getExpiryDate(24),
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
 */
router.get('/summary', (_req: Request, res: Response) => {
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
        requiredParams: ['amount', 'currency', 'destination'],
        optionalParams: [],
      },
      {
        id: 'payment-p2p',
        name: 'P2P Transfer',
        description: 'Simulate direct user-to-user transfers',
        severity: 'LOW',
        depth: 'BASIC',
        requiredParams: ['recipientId', 'amount'],
        optionalParams: ['memo'],
      },
      {
        id: 'recurring-payment-setup',
        name: 'Recurring Payment Setup',
        description: 'Simulate setup of scheduled recurring payments',
        severity: 'MEDIUM',
        depth: 'BASIC',
        requiredParams: ['recipientId', 'amount', 'frequency', 'startDate'],
        optionalParams: ['cycles'],
      },
      {
        id: 'payment-settlement',
        name: 'Payment Settlement',
        description: 'Simulate settlement of pending payment requests',
        severity: 'LOW',
        depth: 'BASIC',
        requiredParams: ['requestId', 'senderId', 'amount'],
        optionalParams: [],
      },
    ],
  });
});

export default router;