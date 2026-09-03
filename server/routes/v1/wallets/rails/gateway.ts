import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../../../../db';
import { paymentTransactions, accounts, users } from '../../../../../shared/schema';
import { eq, sql, and } from 'drizzle-orm';
import { paymentGatewayService } from '../../../../services/paymentGatewayService';
import { paymentRecoverySAGA } from '../../../../services/PaymentRecoverySAGAOrchestrator';
import { sharedIdempotencyManager } from '../../../../services/sharedIdempotencyManager';
import { isAuthenticated } from '../../../../auth';
import { logger } from '../../../../utils/logger';
import {
  PaymentError,
  PaymentErrorHandler,
  PaymentErrorCode
} from '../../../../services/paymentErrorHandler';
import { PaymentErrorMonitoringService } from '../../../../services/paymentErrorMonitoringService';
import { rateLimitMiddleware, withdrawalLimits, depositLimits } from '../../../../middleware/rateLimitConfig';
import { getEventEmitter } from '../../../../middleware/websocket-event-emitter';

const router = express.Router();

async function verifyMpesaPhoneOwnership(req: Request, res: Response, next: express.NextFunction) {
  if (req.body.provider === 'mpesa') {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.claims?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    
    const requestPhone = req.body.metadata?.phone;
    if (!requestPhone) {
      res.status(400).json({ success: false, message: 'Phone number is required for M-Pesa deposit' });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const userPhone = user?.phone;
    if (!userPhone) {
      res.status(403).json({ success: false, message: 'User does not have a verified phone number' });
      return;
    }

    const normReq = requestPhone.replace(/\D/g, '').slice(-9);
    const normUser = userPhone.replace(/\D/g, '').slice(-9);

    if (normReq !== normUser) {
      res.status(403).json({ success: false, message: 'phone number does not match verified account' });
      return;
    }
  }
  next();
}

// ===== TYPES =====

interface AuthenticatedRequest extends Request {
  user?: any;
}

import type { PaymentResponse } from '../../../../services/paymentGatewayService';

function isPaymentResponse(obj: any): obj is PaymentResponse {
  return obj && typeof obj === 'object' && 'success' in obj && 'reference' in obj;
}

// ===== HELPERS =====

function requireUserId(req: AuthenticatedRequest, res: Response): string | null {
  const userId = req.user?.claims?.id;
  if (!userId) {
    res.status(401).json(
      PaymentErrorHandler.toResponse(
        PaymentErrorHandler.createError(
          PaymentErrorCode.INVALID_USER,
          'User ID is required',
          { service: 'gateway', operation: 'requireUserId' }
        )
      )
    );
    return null;
  }
  return String(userId);
}

/**
 * Extract real wallet IDs from user accounts for SAGA dispatch.
 * The old code passed empty strings — SAGA couldn't reconcile.
 */
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
 * Idempotent SAGA dispatch with real wallet IDs.
 * Prevents duplicate execution on webhook retries.
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
      walletTo: metadata.walletTo || walletFrom,
      vaultId,
      metadata: {
        originalReference: reference,
        provider: metadata.provider,
        ...metadata
      }
    });

    await sharedIdempotencyManager.recordResult(idempotencyKey, { success: true, dispatchedAt: new Date() }, 86400);
    logger.info(`[SAGA-DISPATCH] Success for ${reference}`);

    // Emit WebSocket event
    try {
      const wsEmitter = getEventEmitter();
      wsEmitter.emitActivity('payment', reference, userId, 'saga_dispatched', {
        amount,
        currency,
        provider: metadata.provider
      });
    } catch (wsError) {
      logger.warn('WebSocket emit failed for SAGA dispatch', { wsError, reference });
    }

  } catch (error: any) {
    await sharedIdempotencyManager.recordResult(idempotencyKey, { success: false, error: error.message }, 86400);
    logger.error(`[SAGA-DISPATCH] Failed for ${reference}`, error);
    // Don't throw — webhook must return 200 to provider
  }
}

/**
 * Idempotent webhook processing with atomic DB update.
 * Returns true if status transitioned to 'completed' (caller should dispatch SAGA).
 */
async function processWebhook(
  provider: string,
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
      SELECT * FROM payment_transactions WHERE reference = ${reference} FOR UPDATE
    `);
    const record = rows.rows[0] as any;

    if (!record || record.status === 'completed') {
      await sharedIdempotencyManager.recordResult(idempotencyKey, { processed: false, reason: 'already_completed_or_missing' }, 86400);
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

// ===== DEPOSIT =====

router.post('/deposit', [isAuthenticated, verifyMpesaPhoneOwnership, rateLimitMiddleware(depositLimits)], async (req: Request, res: Response) => {
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
      callbackUrl: `${process.env.APP_URL}/api/v1/wallets/rails/gateway/webhooks/${provider}`,
      idempotencyKey: clientKey
    });

    // Emit WebSocket on pending/success
    if (isPaymentResponse(result) ? (result.success || result.status === 'pending' || result.status === 'processing') : false) {
      try {
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
      } catch (wsError) {
        logger.warn('WebSocket emit failed', { wsError, traceId });
      }
    }

    const statusCode = isPaymentResponse(result) ? (result.success ? 200 : (result.status === 'pending' ? 202 : 400)) : 400;
    res.status(statusCode).json({ ...result, traceId });

  } catch (error: any) {
    const authReq = req as AuthenticatedRequest;
    logger.error('Deposit endpoint error', { traceId, message: error.message, code: error.code });

    if (error instanceof PaymentError) {
      PaymentErrorMonitoringService.recordError({
        timestamp: new Date(),
        errorCode: error.code,
        errorCategory: error.context.service || 'validation',
        provider: req.body.provider || 'unknown',
        operation: 'deposit',
        userId: authReq.user?.claims?.id,
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
      { service: 'gateway', operation: 'deposit', traceId, userId: authReq.user?.claims?.id }
    );
    res.status(500).json(PaymentErrorHandler.toResponse(paymentError));
  }
});

// ===== WITHDRAWAL =====

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

    if (isPaymentResponse(result) ? (result.success || result.status === 'pending' || result.status === 'processing') : false) {
      try {
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
      } catch (wsError) {
        logger.warn('WebSocket emit failed', { wsError, traceId });
      }
    }

    const statusCode = isPaymentResponse(result) ? (result.success ? 200 : (result.status === 'pending' ? 202 : 400)) : 400;
    res.status(statusCode).json({ ...result, traceId });

  } catch (error: any) {
    const authReq = req as AuthenticatedRequest;
    logger.error('Withdrawal endpoint error', { traceId, message: error.message });

    if (error instanceof PaymentError) {
      PaymentErrorMonitoringService.recordError({
        timestamp: new Date(),
        errorCode: error.code,
        errorCategory: error.context.service || 'validation',
        provider: req.body.provider || 'unknown',
        operation: 'withdrawal',
        userId: authReq.user?.claims?.id,
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
      { service: 'gateway', operation: 'withdrawal', traceId, userId: authReq.user?.claims?.id }
    );
    res.status(500).json(PaymentErrorHandler.toResponse(paymentError));
  }
});

// ===== VERIFY =====

router.get('/verify/:provider/:reference', isAuthenticated, async (req: Request, res: Response) => {
  const traceId = PaymentErrorHandler.generateTraceId();
  try {
    const { provider, reference } = req.params;
    const result = await paymentGatewayService.verifyTransaction(provider, reference);
    res.json({ success: true, data: result, traceId });

  } catch (error: any) {
    logger.error('Verify error', { traceId, provider: req.params.provider, reference: req.params.reference, message: error.message });

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

// ===== FLUTTERWAVE WEBHOOK =====

router.post('/flutterwave/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['verif-hash'] as string;
    const flwSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;

    if (!signature || !flwSecret || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(flwSecret))) {
      logger.warn('Invalid Flutterwave webhook signature');
      return res.status(401).json(
        PaymentErrorHandler.toResponse(
          PaymentErrorHandler.createError(
            PaymentErrorCode.WEBHOOK_SIGNATURE_INVALID,
            'Invalid webhook signature',
            { service: 'gateway', operation: 'flutterwaveWebhook' }
          )
        )
      );
    }

    const payload = req.body;
    if (!payload.data?.id || !payload.data?.tx_ref) {
      return res.status(400).json(
        PaymentErrorHandler.toResponse(
          PaymentErrorHandler.createError(
            PaymentErrorCode.PROVIDER_API_ERROR,
            'Invalid webhook payload',
            { service: 'gateway', operation: 'flutterwaveWebhook' }
          )
        )
      );
    }

    const reference = payload.data.tx_ref;
    const status = payload.data.status === 'successful' ? 'completed' : 'failed';

    const shouldDispatch = await processWebhook('flutterwave', reference, status, {
      flutterwaveStatus: payload.data.status,
      flutterwaveTransactionId: payload.data.id,
      webhookReceivedAt: new Date().toISOString()
    });

    if (shouldDispatch) {
      const rec = await db.select().from(paymentTransactions).where(eq(paymentTransactions.reference, reference)).then(r => r[0]);
      if (rec) {
        await dispatchPaymentSAGA(reference, rec.userId, Number(rec.amount), rec.currency, {
          provider: 'flutterwave',
          flutterwaveTransactionId: payload.data.id
        });
      }
    }

    logger.info('Flutterwave webhook processed', { reference, status });
    res.json({ success: true, message: 'Webhook processed' });

  } catch (error: any) {
    logger.error('Flutterwave webhook error', { message: error.message });
    res.status(500).json(
      PaymentErrorHandler.toResponse(
        PaymentErrorHandler.createError(
          PaymentErrorCode.UNKNOWN_ERROR,
          'Webhook processing failed',
          { service: 'gateway', operation: 'flutterwaveWebhook' }
        )
      )
    );
  }
});

// ===== PAYSTACK WEBHOOK =====

router.post('/paystack/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
    if (!signature) {
      return res.status(401).json(
        PaymentErrorHandler.toResponse(
          PaymentErrorHandler.createError(
            PaymentErrorCode.WEBHOOK_SIGNATURE_INVALID,
            'Missing signature',
            { service: 'gateway', operation: 'paystackWebhook' }
          )
        )
      );
    }

    // Validate signature (your validatePaystackSignature middleware should handle this)
    const { validatePaystackSignature } = await import('../../../../middleware/webhookValidators');
    if (!validatePaystackSignature(req)) {
      return res.status(401).json(
        PaymentErrorHandler.toResponse(
          PaymentErrorHandler.createError(
            PaymentErrorCode.WEBHOOK_SIGNATURE_INVALID,
            'Invalid signature',
            { service: 'gateway', operation: 'paystackWebhook' }
          )
        )
      );
    }

    const payload = req.body;
    if (!payload.data?.reference) {
      return res.status(400).json(
        PaymentErrorHandler.toResponse(
          PaymentErrorHandler.createError(
            PaymentErrorCode.PROVIDER_API_ERROR,
            'Invalid payload',
            { service: 'gateway', operation: 'paystackWebhook' }
          )
        )
      );
    }

    const reference = payload.data.reference;
    const status = payload.event === 'charge.success' ? 'completed' : 'failed';

    const shouldDispatch = await processWebhook('paystack', reference, status, {
      paystackEvent: payload.event,
      paystackTransactionId: payload.data.id,
      webhookReceivedAt: new Date().toISOString()
    });

    if (shouldDispatch) {
      const rec = await db.select().from(paymentTransactions).where(eq(paymentTransactions.reference, reference)).then(r => r[0]);
      if (rec) {
        await dispatchPaymentSAGA(reference, rec.userId, Number(rec.amount), rec.currency, {
          provider: 'paystack',
          paystackTransactionId: payload.data.id
        });
      }
    }

    logger.info('Paystack webhook processed', { reference, status });
    res.json({ success: true, message: 'Webhook processed' });

  } catch (error: any) {
    logger.error('Paystack webhook error', { message: error.message });
    res.status(500).json(
      PaymentErrorHandler.toResponse(
        PaymentErrorHandler.createError(
          PaymentErrorCode.UNKNOWN_ERROR,
          'Webhook processing failed',
          { service: 'gateway', operation: 'paystackWebhook' }
        )
      )
    );
  }
});

// ===== M-PESA CALLBACK =====

router.post('/mpesa/callback', async (req: Request, res: Response) => {
  try {
    const callbackData = req.body?.Body?.stkCallback;
    if (!callbackData) {
      return res.status(400).json({ ResultCode: 1, ResultDesc: 'Invalid callback structure' });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc } = callbackData;
    const status = ResultCode === 0 ? 'completed' : 'failed';

    // Find transaction by CheckoutRequestID
    const [record] = await db
      .select()
      .from(paymentTransactions)
      .where(sql`metadata->>'CheckoutRequestID' = ${CheckoutRequestID}`)
      .limit(1);

    if (!record) {
      logger.warn('M-Pesa callback: transaction not found', { CheckoutRequestID });
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' }); // Accept to stop retries
    }

    const metadata: Record<string, any> = {
      mpesaResultCode: ResultCode,
      mpesaResultDesc: ResultDesc,
      mpesaCallback: callbackData,
      webhookReceivedAt: new Date().toISOString()
    };

    if (ResultCode === 0) {
      const callbackMetadata = callbackData.CallbackMetadata?.Item || [];
      metadata.mpesaReceiptNumber = callbackMetadata.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value;
      metadata.mpesaAmount = callbackMetadata.find((item: any) => item.Name === 'Amount')?.Value;
      metadata.mpesaPhone = callbackMetadata.find((item: any) => item.Name === 'PhoneNumber')?.Value;
    }

    const shouldDispatch = await processWebhook('mpesa', record.reference, status, metadata);

    if (shouldDispatch) {
      await dispatchPaymentSAGA(record.reference, record.userId, Number(record.amount), record.currency, {
        provider: 'mpesa',
        mpesaCheckoutRequestId: CheckoutRequestID,
        mpesaReceiptNumber: metadata.mpesaReceiptNumber
      });
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  } catch (error: any) {
    logger.error('M-Pesa callback error', { message: error.message });
    // Always return 0/Accepted to M-Pesa to stop retries, log error for reconciliation
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

export default router;