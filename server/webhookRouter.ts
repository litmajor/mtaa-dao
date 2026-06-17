import express from 'express';
import crypto from 'crypto';
import { db } from './db';
import { paymentTransactions } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from './utils/logger';
import { creditUserWalletOnDeposit } from './services/ledgerService';

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

    if (event === 'charge.success') {
      await updateTransactionState(reference, 'completed', { gatewayResponse: data });
    } else if (['charge.failed', 'transfer.failed'].includes(event)) {
      await updateTransactionState(reference, 'failed', { gatewayResponse: data, reason: data.gateway_response });
    }

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

    if (status === 'successful') {
      await updateTransactionState(reference, 'completed', { gatewayResponse: payload.data || payload });
    } else if (['failed', 'cancelled'].includes(status)) {
      await updateTransactionState(reference, 'failed', { gatewayResponse: payload.data || payload });
    }

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

    // Look up transaction mapping by unique CheckoutRequestID tracked during instantiation
    const [txRecord] = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.reference, checkoutRequestId))
      .limit(1);

    if (!txRecord) {
      logger.warn('[M-PESA CALLBACK] Transaction frame missing inside relational storage frameworks.', { checkoutRequestId });
      return res.status(404).send('Transaction reference unmapped.');
    }

    if (resultCode === 0) {
      // ResultCode 0 indicates absolute payment verification execution
      const callbackMetadata = callbackData.CallbackMetadata?.Item || [];
      const mpesaReceiptNumber = callbackMetadata.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value;
      
      await updateTransactionState(txRecord.reference, 'completed', {
        mpesaReceipt: mpesaReceiptNumber,
        rawCallback: callbackData
      });
    } else {
      // User cancelled, timed out, or insufficient balances
      await updateTransactionState(txRecord.reference, 'failed', {
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

// HELPER COMPILING LIFECYCLE CONTROLLERS
async function updateTransactionState(
  reference: string, 
  status: 'completed' | 'failed', 
  additionalMetadata: Record<string, any>
) {
  try {
    const [existingTx] = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.reference, reference))
      .limit(1);

    if (!existingTx) {
      logger.warn(`[STATE RECONCILIATION SKIP] Tracking frame ${reference} not identified within system states.`);
      return;
    }

    // Prevent handling duplicate webhook triggers if final state is already stored
    if (['completed', 'failed'].includes(existingTx.status)) {
      logger.info(`[IDEMPOTENT WEBHOOK SKIP] Transaction ${reference} already resolved with status: ${existingTx.status}`);
      return;
    }

    const mergedMetadata = {
      ...(typeof existingTx.metadata === 'object' ? existingTx.metadata : {}),
      webhookProcessedAt: new Date().toISOString(),
      ...additionalMetadata
    };

    await db
      .update(paymentTransactions)
      .set({
        status,
        metadata: mergedMetadata,
        updatedAt: new Date()
      })
      .where(eq(paymentTransactions.reference, reference));

    logger.info(`[TRANSACTION UPDATED SUCCESSFULLY] Reference: ${reference} converted to [${status}]`);
    
    // If transaction completed, attempt to compile wallet ledger and update cached balance.
    if (status === 'completed') {
      try {
        await creditUserWalletOnDeposit(reference);
      } catch (err: any) {
        // Log but don't throw; webhook lifecycle should remain idempotent and acknowledged.
        logger.error('[LEDGER COMMIT FAILED]', { reference, error: err?.message || err });
      }
    }

  } catch (error: any) {
    logger.error(`[CRITICAL DATABASE STATE MISMATCH] Failed updating status registry on index: ${reference}`, { error: error.message });
    throw error;
  }
}

export default router;
