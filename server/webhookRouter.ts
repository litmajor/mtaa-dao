import express from 'express';
import crypto from 'crypto';
import { logger } from './utils/logger';
import { commandBus } from './domain/setup';
import { PaymentCommandTypes } from './domain/payments/PaymentCommands';

const router = express.Router();

/**
 * Express Middleware to capture the exact raw string body.
 * Crucial for valid HMAC signature evaluation against upstream providers.
 */
const rawBodySaver = express.json({
  verify: (req: any, _res, buf) => {
    if (buf && buf.length) {
      req.rawBody = buf.toString('utf8');
    }
  }
});

// Apply the raw body parser to all incoming webhook processing routes
router.use(rawBodySaver);

// ════════════════════════════════════════════════════════════════════════════════
// 1. PAYSTACK WEBHOOK CHANNEL (HMAC-SHA512 Verification)
// ════════════════════════════════════════════════════════════════════════════════
router.post('/paystack', async (req: any, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const secret = process.env.PAYSTACK_SECRET_KEY; // Or a dedicated PAYSTACK_WEBHOOK_SECRET

    if (!signature || !secret) {
      logger.warn('[PAYSTACK WEBHOOK] Missing validation context');
      return res.status(401).send('Unauthorized');
    }

    // Compute identical hash verification signature using Paystack protocol rules
    const hash = crypto
      .createHmac('sha512', secret)
      .update(req.rawBody || JSON.stringify(req.body))
      .digest('hex');

    if (hash !== signature) {
      logger.error('[PAYSTACK WEBHOOK] Cryptographic signature mismatch detected.');
      return res.status(401).send('Invalid Signature');
    }

    const { event, data } = req.body;
    const reference = data.reference;

    logger.info(`[PAYSTACK WEBHOOK] Processing event: ${event}`, { reference });

    await processWebhookEvent(reference, event === 'charge.success' ? 'completed' : 'failed', { gatewayResponse: data });

    // Always yield an explicit 200 OK status to acknowledge downstream queue emission
    return res.status(200).json({ status: 'success' });
  } catch (error: any) {
    logger.error('[PAYSTACK WEBHOOK FATAL]', { error: error.message });
    return res.status(500).send('Internal Server Error');
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// 2. FLUTTERWAVE WEBHOOK CHANNEL (Secret Hash Key Validation)
// ════════════════════════════════════════════════════════════════════════════════
router.post('/flutterwave', async (req: any, res) => {
  try {
    const signature = req.headers['verif-hash'];
    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET;

    if (!signature || signature !== secretHash) {
      logger.error('[FLUTTERWAVE WEBHOOK] Token hash authorization validation rejected.');
      return res.status(401).send('Unauthorized signature match.');
    }

    const payload = req.body;
    const reference = payload.txRef || payload.data?.tx_ref;
    const status = payload.status || payload.data?.status;

    logger.info(`[FLUTTERWAVE WEBHOOK] Event ingested`, { reference, status });

    const isSuccess = status === 'successful';
    await processWebhookEvent(reference, isSuccess ? 'completed' : 'failed', { gatewayResponse: payload.data || payload });

    return res.status(200).send('Webhook Evaluated');
  } catch (error: any) {
    logger.error('[FLUTTERWAVE WEBHOOK FATAL]', { error: error.message });
    return res.status(500).send('Internal Server Error');
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// 3. M-PESA / SAFARICOM WEBHOOK CHANNEL (STK-Push Callback Processing)
// ════════════════════════════════════════════════════════════════════════════════
router.post('/mpesa', async (req: any, res) => {
  try {
    const { Body } = req.body;
    if (!Body || !Body.stkCallback) {
      logger.warn('[M-PESA CALLBACK] Invalid structural response body payload signature parsing rules.');
      return res.status(400).send('Bad Request footprint.');
    }

    const callbackData = Body.stkCallback;
    const checkoutRequestId = callbackData.CheckoutRequestID;
    const resultCode = callbackData.ResultCode;
    const resultDesc = callbackData.ResultDesc;

    logger.info(`[M-PESA CALLBACK] Ingested state for ID: ${checkoutRequestId}`, { resultCode });

    if (resultCode === 0) {
      // ResultCode 0 indicates absolute payment verification execution
      const callbackMetadata = callbackData.CallbackMetadata?.Item || [];
      const mpesaReceiptNumber = callbackMetadata.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value;
      
      await processWebhookEvent(checkoutRequestId, 'completed', {
        mpesaReceipt: mpesaReceiptNumber,
        rawCallback: callbackData
      });
    } else {
      // User cancelled, timed out, or insufficient balances
      await processWebhookEvent(checkoutRequestId, 'failed', {
        reason: resultDesc,
        rawCallback: callbackData
      });
    }

    return res.status(200).json({ ResponseCode: '0', ResponseDesc: 'Success acknowledgement' });
  } catch (error: any) {
    logger.error('[M-PESA CALLBACK FATAL]', { error: error.message });
    return res.status(500).send('Internal Server Error');
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// HELPER COMPILING LIFECYCLE CONTROLLERS
// ════════════════════════════════════════════════════════════════════════════════
async function processWebhookEvent(reference: string, outcome: 'completed' | 'failed', providerData: Record<string, any>) {
  try {
    // 1. Dispatch ReceiveWebhook command
    const correlationId = crypto.randomUUID();
    const receiveResult = await commandBus.dispatch({
      id: crypto.randomUUID(),
      type: PaymentCommandTypes.ReceiveWebhook,
      actor: 'webhook-router',
      correlationId,
      timestamp: new Date(),
      payload: { reference, providerData }
    });

    if (!receiveResult.success) {
      logger.warn(`[WEBHOOK PROCESSING SKIP] Failed to receive webhook for ${reference}: ${receiveResult.error}`);
      return;
    }

    // 2. Dispatch Complete or Fail command
    let finalResult;
    if (outcome === 'completed') {
      finalResult = await commandBus.dispatch({
        id: crypto.randomUUID(),
        type: PaymentCommandTypes.CompletePayment,
        actor: 'webhook-router',
        correlationId,
        timestamp: new Date(),
        payload: { reference, providerMetadata: providerData }
      });
    } else {
      finalResult = await commandBus.dispatch({
        id: crypto.randomUUID(),
        type: PaymentCommandTypes.FailPayment,
        actor: 'webhook-router',
        correlationId,
        timestamp: new Date(),
        payload: { reference, reason: providerData.reason || 'Webhook reported failure', providerData }
      });
    }

    if (!finalResult.success) {
      logger.error(`[WEBHOOK FINALIZATION FAILED] Reference: ${reference}, Outcome: ${outcome}, Error: ${finalResult.error}`);
      return;
    }

    logger.info(`[TRANSACTION UPDATED SUCCESSFULLY] Reference: ${reference} converted to [${outcome}] via CommandBus`);

    // Post-commit side effects are handled by the PaymentCompleted consumer.
    // This keeps webhook handling fast and removes inline spawn orchestration.
  } catch (error: any) {
    logger.error(`[CRITICAL WEBHOOK DISPATCH ERROR] Failed processing webhook for index: ${reference}`, { error: error.message });
    throw error; // Re-throw so upstream catches 500
  }
}

export default router;
