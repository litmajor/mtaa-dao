/**
 * CONSOLIDATED PAYMENT ROUTES
 * 
 * Integrates: PaymentGatewayService, PaymentRecoveryWorkflowService,
 *             PaymentRecoverySAGAOrchestrator, PaymentExecutionService
 * 
 * CHANGES:
 * - All provider initiations route through paymentGatewayService (single path)
 * - Webhooks use sharedIdempotencyManager to prevent duplicate processing
 * - SAGA dispatch extracts real wallet IDs from user accounts
 * - Recovery workflow endpoints for manual intervention resolution
 * - Reversibility endpoints for grace-period reversals
 * - SAGA admin endpoints for reconciliation
 * - All error handling uses updated PaymentErrorHandler signatures
 */

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from './db';
import { paymentTransactions, accounts, users } from '../shared/schema';
import { eq, sql, and } from 'drizzle-orm';
import { paymentGatewayService } from './services/paymentGatewayService';
import { paymentRecoveryWorkflowService } from './services/paymentRecoveryWorkflowService';
import { paymentRecoverySAGA } from './services/PaymentRecoverySAGAOrchestrator';
import { PaymentExecutionService } from './services/paymentExecutionService';
import { sharedIdempotencyManager } from './services/sharedIdempotencyManager';
import { ReversibilityService } from './services/reversibilityService';
import {
  PaymentError,
  PaymentErrorHandler,
  PaymentErrorCode,
  PaymentValidator
} from './services/paymentErrorHandler';
import { PaymentErrorMonitoringService } from './services/paymentErrorMonitoringService';
import { isAuthenticated } from './auth';
import { logger } from './utils/logger';
import { rateLimitMiddleware, withdrawalLimits, depositLimits } from './middleware/rateLimitConfig';
import { getEventEmitter } from './middleware/websocket-event-emitter';
import { validatePaystackSignature, constructStripeEventFromRaw } from './middleware/webhookValidators';

const router = express.Router();

// ===== TYPE DEFINITIONS =====

type Provider = 'stripe' | 'paystack' | 'flutterwave' | 'mpesa' | 'kotanipay' | 'crypto' | 'minipay';

interface AuthenticatedRequest extends Request {
  user?: any;
}

import type { PaymentResponse } from './services/paymentGatewayService';

function isPaymentResponse(obj: any): obj is PaymentResponse {
  return obj && typeof obj === 'object' && 'success' in obj && 'reference' in obj;
}

// ===== HELPERS =====

function requireUserId(req: AuthenticatedRequest, res: Response): string | null {
  const userId = req.user?.claims?.id || req.body?.userId;
  if (!userId) {
    res.status(400).json({ success: false, message: 'userId is required' });
    return null;
  }
  return String(userId);
}

function makeReference(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function validateAmount(amount: any): number {
  return PaymentValidator.validateAmount(amount, { service: 'gateway', operation: 'routeValidation' });
}

async function getUserWalletIds(userId: string): Promise<{ walletFrom: string; walletTo?: string }> {
  const [wallet] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.accountType, 'wallet')))
    .limit(1);

  if (!wallet) {
    throw PaymentErrorHandler.createError(
      PaymentErrorCode.INVALID_USER,
      'User has no wallet account',
      { service: 'gateway', operation: 'getUserWalletIds', userId }
    );
  }

  return { walletFrom: wallet.id };
}

/**
 * Dispatch SAGA with real wallet IDs extracted from database.
 * Wrapped in idempotency to prevent duplicate execution.
 */
async function dispatchPaymentSAGA(
  reference: string,
  userId: string,
  amount: number,
  currency: string,
  metadata: Record<string, any>
): Promise<void> {
  const idempotencyKey = `saga-dispatch:${reference}`;
  const acquired = await sharedIdempotencyManager.startProcessing(idempotencyKey);
  if (!acquired) {
    logger.info(`[SAGA-DISPATCH] Already dispatched for ${reference}`);
    return;
  }

  try {
    const { walletFrom } = await getUserWalletIds(userId);
    const vaultId = metadata.vaultId || process.env.DEFAULT_VAULT_ID;

    await paymentRecoverySAGA.executePaymentSAGA({
      userId,
      amount,
      currency,
      walletFrom,
      walletTo: metadata.walletTo || walletFrom, // Self-transfer if no destination specified
      vaultId,
      metadata: {
        originalReference: reference,
        provider: metadata.provider,
        ...metadata
      }
    });

    await sharedIdempotencyManager.recordResult(idempotencyKey, { success: true, dispatchedAt: new Date() }, 86400);
    logger.info(`[SAGA-DISPATCH] Success for ${reference}`);
  } catch (error: any) {
    await sharedIdempotencyManager.recordResult(idempotencyKey, { success: false, error: error.message }, 86400);
    logger.error(`[SAGA-DISPATCH] Failed for ${reference}`, error);
    // Don't throw — webhook should return 200 to provider, but log for reconciliation
  }
}

/**
 * Process webhook with idempotency and atomic DB update.
 */
async function processWebhook(
  provider: Provider,
  reference: string,
  status: 'completed' | 'failed',
  metadata: Record<string, any>
): Promise<boolean> {
  const idempotencyKey = `webhook:${provider}:${reference}`;
  const acquired = await sharedIdempotencyManager.startProcessing(idempotencyKey);
  if (!acquired) {
    logger.info(`[WEBHOOK] Already processed ${provider}:${reference}`);
    return false;
  }

  const result = await db.transaction(async (tx) => {
    const rows = await tx.execute(sql`
      SELECT * FROM payment_transactions 
      WHERE reference = ${reference} 
      FOR UPDATE
    `);
    const record = rows.rows[0] as any;

    if (!record || record.status === 'completed') {
      await sharedIdempotencyManager.recordResult(idempotencyKey, { processed: false, reason: 'already_completed' }, 86400);
      return false;
    }

    await tx.execute(sql`
      UPDATE payment_transactions 
      SET status = ${status}, 
          metadata = metadata || ${JSON.stringify(metadata)}::jsonb,
          updated_at = NOW()
      WHERE reference = ${reference}
    `);

    return status === 'completed';
  });

  await sharedIdempotencyManager.recordResult(idempotencyKey, { processed: result, status }, 86400);
  return result;
}

// ===== DEPOSIT / WITHDRAWAL (via PaymentGatewayService) =====

router.post('/deposit', [isAuthenticated, rateLimitMiddleware(depositLimits)], async (req: Request, res: Response) => {
  const traceId = PaymentErrorHandler.generateTraceId();
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = requireUserId(authReq, res);
    if (!userId) return;

    const { provider, amount, currency, method, metadata, idempotencyKey: clientKey } = req.body;

    const result = await paymentGatewayService.initiateDeposit(provider, {
      userId,
      amount,
      currency,
      method,
      metadata,
      callbackUrl: `${process.env.APP_URL}/api/payments/webhooks/${provider}`,
      idempotencyKey: clientKey
    });

    if (isPaymentResponse(result) ? (result.success || result.status === 'pending') : false) {
      const wsEmitter = getEventEmitter();
      const txId = isPaymentResponse(result) ? result.transactionId : `deposit_${Date.now()}`;
      wsEmitter.emitActivity('payment', txId, userId, 'initiated', {
        type: 'deposit',
        provider,
        amount,
        currency,
        method,
        status: isPaymentResponse(result) ? result.status : (result as any).status,
        transactionId: isPaymentResponse(result) ? result.transactionId : undefined,
        traceId
      });
    }

    const statusCode = isPaymentResponse(result) ? (result.success ? 200 : (result.status === 'pending' ? 202 : 400)) : 400;
    res.status(statusCode).json({ ...result, traceId });

  } catch (error: any) {
    logger.error('Deposit endpoint error', { traceId, message: error.message, code: error.code });

    if (error instanceof PaymentError) {
      PaymentErrorMonitoringService.recordError({
        timestamp: new Date(),
        errorCode: error.code,
        errorCategory: 'validation',
        provider: req.body.provider || 'unknown',
        operation: 'deposit',
        userId: req.user?.claims?.id,
        count: 1,
        retryCount: 0,
        statusCode: error.statusCode,
        message: error.message,
        context: error.context,
      });
      return res.status(error.statusCode).json(PaymentErrorHandler.toResponse(error));
    }

    const paymentError = PaymentErrorHandler.createError(
      PaymentErrorCode.UNKNOWN_ERROR,
      'Deposit request failed',
      { service: 'gateway', operation: 'deposit', traceId, userId: req.user?.claims?.id }
    );
    res.status(500).json(PaymentErrorHandler.toResponse(paymentError));
  }
});

router.post('/withdraw', [isAuthenticated, rateLimitMiddleware(withdrawalLimits)], async (req: Request, res: Response) => {
  const traceId = PaymentErrorHandler.generateTraceId();
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = requireUserId(authReq, res);
    if (!userId) return;

    const { provider, amount, currency, method, metadata, idempotencyKey: clientKey } = req.body;

    const result = await paymentGatewayService.initiateWithdrawal(provider, {
      userId,
      amount,
      currency,
      method,
      metadata,
      idempotencyKey: clientKey
    });

    if (isPaymentResponse(result) ? (result.success || result.status === 'pending') : false) {
      const wsEmitter = getEventEmitter();
      const txId = isPaymentResponse(result) ? result.transactionId : `withdrawal_${Date.now()}`;
      wsEmitter.emitActivity('payment', txId, userId, 'initiated', {
        type: 'withdrawal',
        provider,
        amount,
        currency,
        method,
        status: isPaymentResponse(result) ? result.status : (result as any).status,
        transactionId: isPaymentResponse(result) ? result.transactionId : undefined,
        traceId
      });
    }

    const statusCode = isPaymentResponse(result) ? (result.success ? 200 : (result.status === 'pending' ? 202 : 400)) : 400;
    res.status(statusCode).json({ ...result, traceId });

  } catch (error: any) {
    logger.error('Withdrawal endpoint error', { traceId, message: error.message });

    if (error instanceof PaymentError) {
      PaymentErrorMonitoringService.recordError({
        timestamp: new Date(),
        errorCode: error.code,
        errorCategory: 'validation',
        provider: req.body.provider || 'unknown',
        operation: 'withdrawal',
        userId: req.user?.claims?.id,
        count: 1,
        retryCount: 0,
        statusCode: error.statusCode,
        message: error.message,
        context: error.context,
      });
      return res.status(error.statusCode).json(PaymentErrorHandler.toResponse(error));
    }

    const paymentError = PaymentErrorHandler.createError(
      PaymentErrorCode.UNKNOWN_ERROR,
      'Withdrawal request failed',
      { service: 'gateway', operation: 'withdrawal', traceId, userId: req.user?.claims?.id }
    );
    res.status(500).json(PaymentErrorHandler.toResponse(paymentError));
  }
});

// ===== VERIFICATION =====

router.get('/verify/:provider/:reference', isAuthenticated, async (req: Request, res: Response) => {
  const traceId = PaymentErrorHandler.generateTraceId();
  try {
    const { provider, reference } = req.params;

    const result = await paymentGatewayService.verifyTransaction(provider, reference);

    res.json({ success: true, data: result, traceId });

  } catch (error: any) {
    logger.error('Verify transaction error', { traceId, provider: req.params.provider, reference: req.params.reference, message: error.message });

    if (error instanceof PaymentError) {
      return res.status(error.statusCode).json(PaymentErrorHandler.toResponse(error));
    }

    const paymentError = PaymentErrorHandler.handleProviderError(
      req.params.provider,
      error,
      { service: 'gateway', operation: 'verifyTransaction', traceId, reference: req.params.reference }
    );
    res.status(paymentError.statusCode).json(PaymentErrorHandler.toResponse(paymentError));
  }
});

// ===== P2P TRANSFER (via PaymentExecutionService) =====

router.post('/p2p/transfer', isAuthenticated, async (req: Request, res: Response) => {
  const traceId = PaymentErrorHandler.generateTraceId();
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = requireUserId(authReq, res);
    if (!userId) return;

    const { recipientId, amount, memo, simulation } = req.body;
    if (!recipientId || !amount) {
      return res.status(400).json({ success: false, message: 'recipientId and amount are required', traceId });
    }

    const executionService = new PaymentExecutionService(new ReversibilityService(db as any));
    const handler = new (await import('./services/paymentExecutionService')).P2PTransferExecutionHandler(executionService);

    const action = await handler.execute({
      userId,
      recipientId,
      amount: Number(amount),
      memo,
      simulation: simulation || {
        riskLevel: 'LOW',
        reversibilityWindow: { recommendedGracePeriodHours: 24 },
        summary: 'P2P transfer',
        beforeState: {},
        afterState: {},
        warnings: [],
        riskFactors: [],
        impactedEntities: []
      }
    });

    res.json({ success: true, action, traceId });

  } catch (error: any) {
    logger.error('P2P transfer error', { traceId, message: error.message });
    if (error instanceof PaymentError) {
      return res.status(error.statusCode).json(PaymentErrorHandler.toResponse(error));
    }
    res.status(500).json({ success: false, message: error.message, traceId });
  }
});

// ===== REVERSIBILITY ENDPOINTS =====

router.post('/reverse/:actionId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = requireUserId(authReq, res);
    if (!userId) return;

    const { actionId } = req.params;
    const { reason } = req.body;

    const executionService = new PaymentExecutionService(new ReversibilityService(db as any));
    const reversed = await executionService.reversePaymentAction(actionId, userId, reason, (req.user as any)?.claims?.role);

    res.json({ success: true, reversed });

  } catch (error: any) {
    logger.error('Reverse action error', { actionId: req.params.actionId, message: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/reverse-options/:actionId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const executionService = new PaymentExecutionService(new ReversibilityService(db as any));
    const options = await executionService.getReverseOptions(req.params.actionId);
    res.json({ success: true, options });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/pending-actions', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = requireUserId(authReq, res);
    if (!userId) return;

    const executionService = new PaymentExecutionService(new ReversibilityService(db as any));
    const pending = await executionService.getUserPendingPayments(userId);
    res.json({ success: true, pending });

  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== RECOVERY WORKFLOW ENDPOINTS =====

router.post('/recovery/:workflowId/consent', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = requireUserId(authReq, res);
    if (!userId) return;

    const workflow = await paymentRecoveryWorkflowService.grantUserConsent(req.params.workflowId, userId);
    res.json({ success: true, workflow });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/recovery/:workflowId/resolve', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { resolutionType, notes } = req.body;
    const resolverId = authReq.user?.claims?.id;

    if (!resolverId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const result = await paymentRecoveryWorkflowService.resolveManualIntervention(
      req.params.workflowId,
      resolverId,
      { type: resolutionType, notes }
    );

    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/recovery/metrics', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const hoursBack = Number(req.query.hours) || 24;
    const metrics = await paymentRecoveryWorkflowService.getRecoveryMetrics(hoursBack);
    res.json({ success: true, metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== SAGA ADMIN ENDPOINTS =====

router.post('/saga/:sagaId/reconcile', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const result = await paymentRecoverySAGA.reconcileSaga(req.params.sagaId);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/saga/:sagaId/abandon', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    await paymentRecoverySAGA.abandonSAGA(req.params.sagaId, reason || 'Manual abandonment');
    res.json({ success: true, message: 'SAGA abandoned' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/saga/:sagaId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const saga = await paymentRecoverySAGA.getSAGAState(req.params.sagaId);
    if (!saga) return res.status(404).json({ success: false, message: 'SAGA not found' });
    res.json({ success: true, saga });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== WEBHOOKS (all providers) =====

// Stripe webhook
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeSecret) {
      return res.status(500).json({ success: false, message: 'Stripe webhook not configured' });
    }

    const event = constructStripeEventFromRaw(req, stripeSecret) as any;
    const object = event?.data?.object || {};
    const reference = object?.metadata?.reference;

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Missing reference' });
    }

    const status = event.type === 'payment_intent.succeeded' ? 'completed' : 'failed';
    const shouldDispatch = await processWebhook('stripe', reference, status, {
      stripeId: object.id,
      eventType: event.type
    });

    if (shouldDispatch) {
      const rec = await db.select().from(paymentTransactions).where(eq(paymentTransactions.reference, reference)).then(r => r[0]);
      if (rec) {
        await dispatchPaymentSAGA(reference, rec.userId, Number(rec.amount), rec.currency, {
          provider: 'stripe',
          stripePaymentIntentId: object.id
        });
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    logger.error('Stripe webhook error', { message: error.message });
    res.status(400).json({ success: false, message: error.message });
  }
});

// Paystack webhook
router.post('/webhooks/paystack', async (req: Request, res: Response) => {
  try {
    if (!validatePaystackSignature(req)) {
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const event = req.body;
    const reference = event?.data?.reference;
    if (!reference) {
      return res.status(400).json({ success: false, message: 'Missing reference' });
    }

    const status = event.event === 'charge.success' ? 'completed' : 'failed';
    const shouldDispatch = await processWebhook('paystack', reference, status, {
      paystackEvent: event.event,
      paystackId: event.data.id
    });

    if (shouldDispatch) {
      const rec = await db.select().from(paymentTransactions).where(eq(paymentTransactions.reference, reference)).then(r => r[0]);
      if (rec) {
        await dispatchPaymentSAGA(reference, rec.userId, Number(rec.amount), rec.currency, {
          provider: 'paystack',
          paystackTransactionId: event.data.id
        });
      }
    }

    res.json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    logger.error('Paystack webhook error', { message: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// Flutterwave webhook
router.post('/webhooks/flutterwave', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['verif-hash'] as string;
    const flwSecret = process.env.FLUTTERWAVE_SECRET_HASH;

    if (flwSecret && signature !== flwSecret) {
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const event = req.body;
    const reference = event?.data?.tx_ref;
    if (!reference) {
      return res.status(400).json({ success: false, message: 'Missing reference' });
    }

    const status = event?.data?.status === 'successful' ? 'completed' : 'failed';
    const shouldDispatch = await processWebhook('flutterwave', reference, status, {
      flutterwaveStatus: event.data.status,
      flutterwaveTransactionId: event.data.id
    });

    if (shouldDispatch) {
      const rec = await db.select().from(paymentTransactions).where(eq(paymentTransactions.reference, reference)).then(r => r[0]);
      if (rec) {
        await dispatchPaymentSAGA(reference, rec.userId, Number(rec.amount), rec.currency, {
          provider: 'flutterwave',
          flutterwaveTransactionId: event.data.id
        });
      }
    }

    res.json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    logger.error('Flutterwave webhook error', { message: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// M-Pesa Daraja callback
router.post('/webhooks/mpesa', async (req: Request, res: Response) => {
  try {
    const callbackData = req.body?.Body?.stkCallback;
    if (!callbackData) {
      return res.status(400).json({ success: false, message: 'Invalid callback structure' });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc } = callbackData;
    const status = ResultCode === 0 ? 'completed' : 'failed';

    // Find by CheckoutRequestID in metadata
    const [record] = await db
      .select()
      .from(paymentTransactions)
      .where(sql`metadata->>'CheckoutRequestID' = ${CheckoutRequestID}`)
      .limit(1);

    if (!record) {
      logger.warn('M-Pesa callback: transaction not found', { CheckoutRequestID });
      return res.json({ ResultCode: '0', ResultDesc: 'Accepted' });
    }

    const shouldDispatch = await processWebhook('mpesa', record.reference, status, {
      mpesaResultCode: ResultCode,
      mpesaResultDesc: ResultDesc,
      mpesaCallback: callbackData
    });

    if (shouldDispatch) {
      await dispatchPaymentSAGA(record.reference, record.userId, Number(record.amount), record.currency, {
        provider: 'mpesa',
        mpesaCheckoutRequestId: CheckoutRequestID
      });
    }

    res.json({ ResultCode: '0', ResultDesc: 'Accepted' });
  } catch (error: any) {
    logger.error('M-Pesa webhook error', { message: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// KotaniPay webhook
router.post('/webhooks/kotanipay', async (req: Request, res: Response) => {
  try {
    const signature = (req.headers['x-kotani-signature'] as string) || '';
    if (process.env.NODE_ENV === 'production' && !signature) {
      return res.status(401).json({ success: false, message: 'Missing signature' });
    }

    if (signature && process.env.KOTANIPAY_WEBHOOK_SECRET) {
      const computed = crypto
        .createHmac('sha256', process.env.KOTANIPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed))) {
        return res.status(401).json({ success: false, message: 'Invalid signature' });
      }
    }

    const { externalId, status, txhash } = req.body;
    if (!externalId) {
      return res.status(400).json({ success: false, message: 'Missing externalId' });
    }

    const mappedStatus = ['success', 'completed', 'successful'].includes(String(status).toLowerCase()) ? 'completed' : 'failed';
    const shouldDispatch = await processWebhook('kotanipay', externalId, mappedStatus, {
      kotaniStatus: status,
      txhash
    });

    if (shouldDispatch) {
      const rec = await db.select().from(paymentTransactions).where(eq(paymentTransactions.reference, externalId)).then(r => r[0]);
      if (rec) {
        await dispatchPaymentSAGA(externalId, rec.userId, Number(rec.amount), rec.currency, {
          provider: 'kotanipay',
          txhash
        });
      }
    }

    res.json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    logger.error('KotaniPay webhook error', { message: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// Generic crypto webhook
router.post('/webhooks/crypto', async (req: Request, res: Response) => {
  try {
    const { paymentReference, txHash, status } = req.body;
    if (!paymentReference || !txHash) {
      return res.status(400).json({ success: false, message: 'paymentReference and txHash required' });
    }

    const mapped = ['confirmed', 'success', 'completed'].includes(String(status).toLowerCase()) ? 'completed' : 'failed';
    const shouldDispatch = await processWebhook('crypto', paymentReference, mapped, { txHash });

    if (shouldDispatch) {
      const rec = await db.select().from(paymentTransactions).where(eq(paymentTransactions.reference, paymentReference)).then(r => r[0]);
      if (rec) {
        await dispatchPaymentSAGA(paymentReference, rec.userId, Number(rec.amount), rec.currency, {
          provider: 'crypto',
          txHash
        });
      }
    }

    res.json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    logger.error('Crypto webhook error', { message: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// MiniPay confirmation
router.post('/webhooks/minipay', async (req: Request, res: Response) => {
  try {
    const { paymentReference, txHash } = req.body;
    if (!paymentReference || !txHash) {
      return res.status(400).json({ success: false, message: 'paymentReference and txHash required' });
    }

    const shouldDispatch = await processWebhook('minipay', paymentReference, 'completed', { txHash });

    if (shouldDispatch) {
      const rec = await db.select().from(paymentTransactions).where(eq(paymentTransactions.reference, paymentReference)).then(r => r[0]);
      if (rec) {
        await dispatchPaymentSAGA(paymentReference, rec.userId, Number(rec.amount), rec.currency, {
          provider: 'minipay',
          txHash
        });
      }
    }

    res.json({ success: true, message: 'MiniPay confirmed' });
  } catch (error: any) {
    logger.error('MiniPay webhook error', { message: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== LEGACY DIRECT INITIATIONS (redirect to gateway service) =====

// These maintain backward compatibility but route through gateway service
router.post('/:provider/initiate', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  const traceId = PaymentErrorHandler.generateTraceId();
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const provider = req.params.provider as Provider;
    const { amount, currency, method, metadata, daoId } = req.body;

    // Map legacy routes to gateway service
    const result = await paymentGatewayService.initiateDeposit(provider, {
      userId,
      amount,
      currency: currency || 'KES',
      method: method || 'mobile_money',
      metadata: { ...metadata, daoId },
      callbackUrl: `${process.env.APP_URL}/api/payments/webhooks/${provider}`
    });

    res.status(result.success ? 200 : 202).json({ ...result, traceId });

  } catch (error: any) {
    logger.error('Legacy initiate error', { traceId, provider: req.params.provider, message: error.message });
    res.status(500).json({ success: false, message: error.message, traceId });
  }
});

export default router;