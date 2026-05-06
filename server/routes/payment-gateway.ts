
import express from 'express';
import { paymentGatewayService } from '../services/paymentGatewayService';
import { isAuthenticated } from '../auth';
import { logger } from '../utils/logger';
import {
  PaymentError,
  PaymentErrorHandler,
  PaymentErrorCode
} from '../services/paymentErrorHandler';
import { PaymentErrorMonitoringService } from '../services/paymentErrorMonitoringService';
import { rateLimitMiddleware, withdrawalLimits, depositLimits } from '../middleware/rateLimitConfig';
import { getEventEmitter } from '../middleware/websocket-event-emitter';

const router = express.Router();

// POST /api/payment-gateway/deposit
// 🔴 CRITICAL: Rate limited to prevent deposit spam/flood attacks
router.post('/deposit', [isAuthenticated, rateLimitMiddleware(depositLimits)], async (req: express.Request, res: express.Response) => {
  try {
    const { provider, amount, currency, method, metadata } = req.body;
    const userId = (req.user as any)?.claims?.id;

    if (!userId) {
      return res.status(401).json(
        PaymentErrorHandler.toResponse(
          PaymentErrorHandler.createError(
            PaymentErrorCode.INVALID_USER,
            'User ID is required'
          )
        )
      );
    }

    const result = await paymentGatewayService.initiateDeposit(provider, {
      userId,
      amount,
      currency,
      method,
      metadata,
      callbackUrl: `${process.env.APP_URL}/payment/callback`
    });

    // Emit WebSocket event on successful deposit initiation
    if (result.success || result.status === 'pending' || result.status === 'processing') {
      try {
        const wsEmitter = getEventEmitter();
        wsEmitter.emitActivity('payment', result.transactionId || `deposit_${Date.now()}`, userId, 'initiated', {
          type: 'deposit',
          provider,
          amount,
          currency,
          method,
          status: result.status,
          transactionId: result.transactionId
        });
      } catch (wsError) {
        logger.warn('Failed to emit WebSocket event for deposit', { wsError });
      }
    }

    // Set appropriate status code based on result
    const statusCode = result.success ? 200 : (result.status === 'pending' || result.status === 'processing' ? 202 : 400);
    res.status(statusCode).json(result);

  } catch (error: any) {
    logger.error('Deposit endpoint error', { 
      message: error.message,
      code: error.code 
    });

    if (error instanceof PaymentError) {
      // Record error in monitoring service
      PaymentErrorMonitoringService.recordError({
        timestamp: new Date(),
        errorCode: error.code,
        errorCategory: 'validation',
        provider: req.body.provider || 'unknown',
        operation: 'deposit',
        userId: (req.user as any)?.claims?.id,
        count: 1,
        retryCount: 0,
        statusCode: error.statusCode,
        message: error.message,
        context: error.metadata,
      });
      return res.status(error.statusCode).json(PaymentErrorHandler.toResponse(error));
    }

    const paymentError = PaymentErrorHandler.createError(
      PaymentErrorCode.UNKNOWN_ERROR,
      'Deposit request failed'
    );

    // Record error in monitoring service
    PaymentErrorMonitoringService.recordError({
      timestamp: new Date(),
      errorCode: paymentError.code,
      errorCategory: 'unknown',
      provider: req.body.provider || 'unknown',
      operation: 'deposit',
      userId: (req.user as any)?.claims?.id,
      count: 1,
      retryCount: 0,
      statusCode: 500,
      message: error.message,
    });

    res.status(500).json(PaymentErrorHandler.toResponse(paymentError));
  }
});

// POST /api/payment-gateway/withdraw
// PHASE 1: SAFETY - Rate limited to 10 withdrawals per hour per user
router.post('/withdraw', [isAuthenticated, rateLimitMiddleware(withdrawalLimits)], async (req: express.Request, res: express.Response) => {
  try {
    const { provider, amount, currency, method, metadata } = req.body;
    const userId = (req.user as any)?.claims?.id;

    if (!userId) {
      return res.status(401).json(
        PaymentErrorHandler.toResponse(
          PaymentErrorHandler.createError(
            PaymentErrorCode.INVALID_USER,
            'User ID is required'
          )
        )
      );
    }

    const result = await paymentGatewayService.initiateWithdrawal(provider, {
      userId,
      amount,
      currency,
      method,
      metadata
    });

    // Emit WebSocket event on successful withdrawal initiation
    if (result.success || result.status === 'pending' || result.status === 'processing') {
      try {
        const wsEmitter = getEventEmitter();
        wsEmitter.emitActivity('payment', result.transactionId || `withdrawal_${Date.now()}`, userId, 'initiated', {
          type: 'withdrawal',
          provider,
          amount,
          currency,
          method,
          status: result.status,
          transactionId: result.transactionId
        });
      } catch (wsError) {
        logger.warn('Failed to emit WebSocket event for withdrawal', { wsError });
      }
    }

    const statusCode = result.success ? 200 : (result.status === 'pending' || result.status === 'processing' ? 202 : 400);
    res.status(statusCode).json(result);

  } catch (error: any) {
    logger.error('Withdrawal endpoint error', { 
      message: error.message,
      code: error.code 
    });

    if (error instanceof PaymentError) {
      // Record error in monitoring service
      PaymentErrorMonitoringService.recordError({
        timestamp: new Date(),
        errorCode: error.code,
        errorCategory: 'validation',
        provider: req.body.provider || 'unknown',
        operation: 'withdrawal',
        userId: (req.user as any)?.claims?.id,
        count: 1,
        retryCount: 0,
        statusCode: error.statusCode,
        message: error.message,
        context: error.metadata,
      });
      return res.status(error.statusCode).json(PaymentErrorHandler.toResponse(error));
    }

    const paymentError = PaymentErrorHandler.createError(
      PaymentErrorCode.UNKNOWN_ERROR,
      'Withdrawal request failed'
    );

    // Record error in monitoring service
    PaymentErrorMonitoringService.recordError({
      timestamp: new Date(),
      errorCode: paymentError.code,
      errorCategory: 'unknown',
      provider: req.body.provider || 'unknown',
      operation: 'withdrawal',
      userId: (req.user as any)?.claims?.id,
      count: 1,
      retryCount: 0,
      statusCode: 500,
      message: error.message,
    });

    res.status(500).json(PaymentErrorHandler.toResponse(paymentError));
  }
});

// GET /api/payment-gateway/verify/:provider/:reference
router.get('/verify/:provider/:reference', isAuthenticated, async (req, res) => {
  try {
    const { provider, reference } = req.params;

    const result = await paymentGatewayService.verifyTransaction(provider, reference);

    res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    logger.error('Verify transaction error', {
      provider: req.params.provider,
      reference: req.params.reference,
      message: error.message
    });

    if (error instanceof PaymentError) {
      return res.status(error.statusCode).json(PaymentErrorHandler.toResponse(error));
    }

    const paymentError = PaymentErrorHandler.handleProviderError(
      req.params.provider,
      error,
      { reference: req.params.reference }
    );
    res.status(paymentError.statusCode).json(PaymentErrorHandler.toResponse(paymentError));
  }
});

// POST /api/payment-gateway/flutterwave/webhook
router.post('/flutterwave/webhook', async (req, res) => {
  try {
    const signature = req.headers['verif-hash'] as string;
    
    // Verify webhook signature
    if (!signature || signature !== process.env.FLUTTERWAVE_WEBHOOK_SECRET) {
      const error = PaymentErrorHandler.createError(
        PaymentErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'Invalid webhook signature',
        { provider: 'flutterwave' }
      );
      logger.warn('Invalid Flutterwave webhook signature');
      return res.status(401).json(PaymentErrorHandler.toResponse(error));
    }

    const payload = req.body;

    // Validate webhook payload
    if (!payload.data?.id || !payload.data?.tx_ref) {
      const error = PaymentErrorHandler.createError(
        PaymentErrorCode.PROVIDER_API_ERROR,
        'Invalid webhook payload structure',
        { provider: 'flutterwave' }
      );
      logger.warn('Invalid Flutterwave webhook payload', { payload });
      return res.status(400).json(PaymentErrorHandler.toResponse(error));
    }

    // Process webhook with retry
    await processFlutterwaveWebhook(payload);

    logger.info('Flutterwave webhook processed successfully', {
      reference: payload.data.tx_ref,
      status: payload.data.status
    });

    res.json({ success: true, message: 'Webhook processed' });

  } catch (error: any) {
    logger.error('Flutterwave webhook processing error', {
      message: error.message,
      code: error.code
    });

    if (error instanceof PaymentError) {
      return res.status(error.statusCode).json(PaymentErrorHandler.toResponse(error));
    }

    res.status(500).json(
      PaymentErrorHandler.toResponse(
        PaymentErrorHandler.createError(
          PaymentErrorCode.UNKNOWN_ERROR,
          'Webhook processing failed'
        )
      )
    );
  }
});

async function processFlutterwaveWebhook(payload: any): Promise<void> {
  const { db } = await import('../storage');
  const { paymentTransactions } = await import('../../shared/schema');
  const { eq } = await import('drizzle-orm');
  const { RetryService, DEFAULT_RETRY_POLICIES } = await import('../services/retryService');

  const reference = payload.data.tx_ref;
  const status = payload.data.status === 'successful' ? 'completed' : 'failed';
  const userId = payload.data.customer?.id || payload.data.metadata?.userId;

  await RetryService.executeWithRetry(
    () => db.update(paymentTransactions)
      .set({ 
        status, 
        metadata: { 
          ...payload.data,
          webhookReceivedAt: new Date().toISOString()
        },
        updatedAt: new Date() 
      })
      .where(eq(paymentTransactions.reference, reference))
      .execute(),
    DEFAULT_RETRY_POLICIES.database,
    { reference, provider: 'flutterwave' }
  );

  // Emit WebSocket event for payment status update
  try {
    const { getEventEmitter } = await import('../middleware/websocket-event-emitter');
    const wsEmitter = getEventEmitter();
    
    if (status === 'completed') {
      wsEmitter.emitActivity('payment', reference, userId || 'system', 'completed', {
        provider: 'flutterwave',
        amount: payload.data.amount,
        currency: payload.data.currency,
        reference,
        transactionId: payload.data.id
      });
    } else {
      wsEmitter.emitAlert('payment_failed', 'medium', `Flutterwave payment ${reference} failed`, userId || 'system', {
        provider: 'flutterwave',
        reference,
        reason: payload.data.status
      });
    }
  } catch (wsError) {
    logger.warn('Failed to emit WebSocket event for Flutterwave webhook', { wsError });
  }
}

// POST /api/payment-gateway/paystack/webhook
router.post('/paystack/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
    
    // Verify webhook signature
    if (!signature) {
      const error = PaymentErrorHandler.createError(
        PaymentErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'Missing webhook signature',
        { provider: 'paystack' }
      );
      logger.warn('Missing Paystack webhook signature');
      return res.status(401).json(PaymentErrorHandler.toResponse(error));
    }

    const payload = req.body;

    // Validate webhook payload
    if (!payload.data?.reference) {
      const error = PaymentErrorHandler.createError(
        PaymentErrorCode.PROVIDER_API_ERROR,
        'Invalid webhook payload structure',
        { provider: 'paystack' }
      );
      logger.warn('Invalid Paystack webhook payload', { payload });
      return res.status(400).json(PaymentErrorHandler.toResponse(error));
    }

    // Process webhook with retry
    await processPaystackWebhook(payload);

    logger.info('Paystack webhook processed successfully', {
      reference: payload.data.reference,
      status: payload.data.status
    });

    res.json({ success: true, message: 'Webhook processed' });

  } catch (error: any) {
    logger.error('Paystack webhook processing error', {
      message: error.message,
      code: error.code
    });

    if (error instanceof PaymentError) {
      return res.status(error.statusCode).json(PaymentErrorHandler.toResponse(error));
    }

    res.status(500).json(
      PaymentErrorHandler.toResponse(
        PaymentErrorHandler.createError(
          PaymentErrorCode.UNKNOWN_ERROR,
          'Webhook processing failed'
        )
      )
    );
  }
});

async function processPaystackWebhook(payload: any): Promise<void> {
  const { db } = await import('../storage');
  const { paymentTransactions } = await import('../../shared/schema');
  const { eq } = await import('drizzle-orm');
  const { RetryService, DEFAULT_RETRY_POLICIES } = await import('../services/retryService');

  const reference = payload.data.reference;
  const status = payload.data.status === 'success' ? 'completed' : 'failed';
  const userId = payload.data.customer?.id || payload.data.metadata?.userId;

  await RetryService.executeWithRetry(
    () => db.update(paymentTransactions)
      .set({ 
        status, 
        metadata: { 
          ...payload.data,
          webhookReceivedAt: new Date().toISOString()
        },
        updatedAt: new Date() 
      })
      .where(eq(paymentTransactions.reference, reference))
      .execute(),
    DEFAULT_RETRY_POLICIES.database,
    { reference, provider: 'paystack' }
  );

  // Emit WebSocket event for payment status update
  try {
    const { getEventEmitter } = await import('../middleware/websocket-event-emitter');
    const wsEmitter = getEventEmitter();
    
    if (status === 'completed') {
      wsEmitter.emitActivity('payment', reference, userId || 'system', 'completed', {
        provider: 'paystack',
        amount: payload.data.amount,
        currency: payload.data.currency,
        reference,
        transactionId: payload.data.id
      });
    } else {
      wsEmitter.emitAlert('payment_failed', 'medium', `Paystack payment ${reference} failed`, userId || 'system', {
        provider: 'paystack',
        reference,
        reason: payload.data.status
      });
    }
  } catch (wsError) {
    logger.warn('Failed to emit WebSocket event for Paystack webhook', { wsError });
  }
}

// POST /api/payment-gateway/mpesa/callback
router.post('/mpesa/callback', async (req, res) => {
  try {
    const payload = req.body;
    
    console.log('M-Pesa callback received:', JSON.stringify(payload, null, 2));

    // Extract callback data
    const { Body } = payload;
    const { stkCallback } = Body;
    
    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

    // Update transaction status
    const { db } = await import('../db');
    const { paymentTransactions } = await import('../../shared/schema');
    const { eq, and, sql } = await import('drizzle-orm');

    if (ResultCode === 0) {
      // Payment successful
      const callbackMetadata = stkCallback.CallbackMetadata?.Item || [];
      const amount = callbackMetadata.find((item: any) => item.Name === 'Amount')?.Value;
      const mpesaReceiptNumber = callbackMetadata.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = callbackMetadata.find((item: any) => item.Name === 'TransactionDate')?.Value;
      const phoneNumber = callbackMetadata.find((item: any) => item.Name === 'PhoneNumber')?.Value;

      await db.update(paymentTransactions)
        .set({ 
          status: 'completed',
          metadata: sql`metadata || ${JSON.stringify({
            mpesaReceiptNumber,
            transactionDate,
            phoneNumber,
            completedAt: new Date().toISOString()
          })}::jsonb`,
          updatedAt: new Date()
        })
        .where(
          and(
            sql`metadata->>'checkoutRequestID' = ${CheckoutRequestID}`,
            eq(paymentTransactions.provider, 'mpesa')
          )
        );

      // TODO: Credit user's wallet with the amount
      console.log(`✅ M-Pesa payment completed: ${mpesaReceiptNumber} - ${amount} KES`);
    } else {
      // Payment failed or cancelled
      await db.update(paymentTransactions)
        .set({ 
          status: 'failed',
          metadata: sql`metadata || ${JSON.stringify({
            failureReason: ResultDesc,
            failedAt: new Date().toISOString()
          })}::jsonb`,
          updatedAt: new Date()
        })
        .where(
          and(
            sql`metadata->>'checkoutRequestID' = ${CheckoutRequestID}`,
            eq(paymentTransactions.provider, 'mpesa')
          )
        );

      console.log(`❌ M-Pesa payment failed: ${ResultDesc}`);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error: any) {
    console.error('M-Pesa callback error:', error);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal Server Error' });
  }
});

export default router;
