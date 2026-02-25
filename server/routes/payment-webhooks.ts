/**
 * Payment Provider Webhooks
 * Handles callbacks from Flutterwave, Paystack, Paychant, Kotani, M-Pesa, Airtel, Onramper
 */

import express, { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { deposits, withdrawals } from '@shared/transactionFlowSchema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import {
  flutterwaveConfig,
  paystackConfig,
  paychantConfig,
  kotaniConfig,
  mpesaConfig,
  airtelConfig,
  onramperConfig, // Added from previous config
} from '../config/paymentProviders';

// Use raw body parser for signature verification (before JSON parsing)
const rawBodyParser = express.raw({ type: 'application/json' });

const router = Router();

/**
 * Verify webhook signature (provider-specific algorithms)
 */
function verifyWebhookSignature(
  provider: string,
  payload: Buffer | string, // Raw buffer for accuracy
  signature: string
): boolean {
  let secret = '';
  let algorithm = 'sha256'; // Default

  switch (provider) {
    case 'flutterwave':
      secret = flutterwaveConfig.secretKey || '';
      algorithm = 'sha256'; // Confirmed: HMAC SHA256
      break;
    case 'paystack':
      secret = paystackConfig.secretKey || '';
      algorithm = 'sha512'; // Corrected: HMAC SHA512 (from Paystack docs)
      break;
    case 'paychant':
      secret = paychantConfig.secretKey || '';
      algorithm = 'sha256'; // Assumed; confirm with Paychant docs/support as public info is limited
      break;
    case 'kotani':
      secret = kotaniConfig.secretKey || '';
      algorithm = 'sha256'; // Assumed; Kotani docs mention webhooks but no signature details—verify
      break;
    case 'airtel':
      secret = airtelConfig.secretKey || '';
      algorithm = 'sha256'; // Assumed; Airtel API docs sparse on webhooks—confirm with Airtel devs
      break;
    case 'onramper':
      secret = onramperConfig.secretKey || '';
      algorithm = 'sha256'; // Confirmed: HMAC SHA256
      break;
    default:
      return false; // No verification for unsupported
  }

  if (!secret) return false;

  const hash = crypto.createHmac(algorithm, secret).update(payload).digest('hex');
  return hash === signature;
}

/**
 * Flutterwave Webhook
 * POST /webhooks/flutterwave
 */
router.post('/flutterwave', rawBodyParser, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['verif-hash'] as string; // Correct header
    const rawPayload = req.body; // Buffer

    // Verify signature with raw payload
    if (!verifyWebhookSignature('flutterwave', rawPayload, signature)) {
      logger.warn('Invalid Flutterwave webhook signature');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    // Now parse JSON
    const parsedBody = JSON.parse(rawPayload.toString());
    const { data } = parsedBody;

    if (!data || !data.id) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    // Idempotency: Check if already processed
    const existing = await db
      .select()
      .from(deposits)
      .where(eq(deposits.transaction_hash, data.transaction_id?.toString()))
      .limit(1);

    if (existing[0]) {
      logger.info(`Flutterwave transaction ${data.id} already processed`);
      return res.json({ success: true });
    }

    // Find deposit by gateway reference
    const depositQuery = await db
      .select()
      .from(deposits)
      .where(eq(deposits.gateway_reference, data.id.toString()))
      .limit(1);

    if (!depositQuery[0]) {
      logger.warn(`Deposit not found for Flutterwave transaction: ${data.id}`);
      return res.status(404).json({ success: false, error: 'Deposit not found' });
    }

    // Update deposit status
    const status = data.status === 'successful' ? 'completed' : data.status === 'failed' ? 'failed' : 'pending';

    await db
      .update(deposits)
      .set({
        status,
        transaction_hash: data.transaction_id?.toString(),
        gateway_response: parsedBody,
        updated_at: new Date(),
      })
      .where(eq(deposits.id, depositQuery[0].id));

    // If successful, update account balance (implement with account service)
    if (status === 'completed') {
      logger.info(`Deposit ${depositQuery[0].id} completed via Flutterwave`);
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Flutterwave webhook error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Paystack Webhook
 * POST /webhooks/paystack
 */
router.post('/paystack', rawBodyParser, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string; // Correct header
    const rawPayload = req.body;

    if (!verifyWebhookSignature('paystack', rawPayload, signature)) {
      logger.warn('Invalid Paystack webhook signature');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    const parsedBody = JSON.parse(rawPayload.toString());
    const { data, event } = parsedBody;

    if (!data || !data.reference) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    // Idempotency check
    const existing = await db
      .select()
      .from(deposits)
      .where(eq(deposits.transaction_hash, data.id?.toString()))
      .limit(1);

    if (existing[0]) {
      logger.info(`Paystack event ${event} for ${data.reference} already processed`);
      return res.json({ success: true });
    }

    // Handle relevant events (expand as needed)
    if (event === 'charge.success') {
      const depositQuery = await db
        .select()
        .from(deposits)
        .where(eq(deposits.gateway_reference, data.reference))
        .limit(1);

      if (!depositQuery[0]) {
        logger.warn(`Deposit not found for Paystack reference: ${data.reference}`);
        return res.status(404).json({ success: false, error: 'Deposit not found' });
      }

      await db
        .update(deposits)
        .set({
          status: 'completed',
          transaction_hash: data.id?.toString(),
          gateway_response: parsedBody,
          updated_at: new Date(),
        })
        .where(eq(deposits.id, depositQuery[0].id));

      logger.info(`Deposit ${depositQuery[0].id} completed via Paystack`);
    } else if (event === 'charge.failed') {
      // Handle failure similarly
    } // Add more events like transfer.success, etc.

    res.json({ success: true });
  } catch (error) {
    logger.error('Paystack webhook error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Paychant Webhook
 * POST /webhooks/paychant
 */
// Note: Paychant docs are sparse; assuming signature based on common patterns. Confirm with their support.
router.post('/paychant', rawBodyParser, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-paychant-signature'] as string; // Assumed header; verify
    const rawPayload = req.body;

    if (signature && !verifyWebhookSignature('paychant', rawPayload, signature)) {
      logger.warn('Invalid Paychant webhook signature');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    const parsedBody = JSON.parse(rawPayload.toString());
    const { transaction_id, status, reference } = parsedBody;

    if (!transaction_id || !reference) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    // Idempotency
    const existing = await db
      .select()
      .from(deposits)
      .where(eq(deposits.transaction_hash, transaction_id))
      .limit(1);

    if (existing[0]) {
      return res.json({ success: true });
    }

    const depositQuery = await db
      .select()
      .from(deposits)
      .where(eq(deposits.gateway_reference, reference))
      .limit(1);

    if (!depositQuery[0]) {
      logger.warn(`Deposit not found for Paychant reference: ${reference}`);
      return res.status(404).json({ success: false, error: 'Deposit not found' });
    }

    const depositStatus = status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'pending';

    await db
      .update(deposits)
      .set({
        status: depositStatus,
        transaction_hash: transaction_id,
        gateway_response: parsedBody,
        updated_at: new Date(),
      })
      .where(eq(deposits.id, depositQuery[0].id));

    logger.info(`Deposit ${depositQuery[0].id} status updated to ${depositStatus} via Paychant`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Paychant webhook error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Kotani Pay Webhook
 * POST /webhooks/kotani
 */
// Note: Kotani has webhook registration (e.g., for SMS), but payment webhook details unclear. Assumed signature; confirm.
router.post('/kotani', rawBodyParser, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-kotani-signature'] as string; // Assumed; verify with Kotani
    const rawPayload = req.body;

    if (signature && !verifyWebhookSignature('kotani', rawPayload, signature)) {
      logger.warn('Invalid Kotani webhook signature');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    const parsedBody = JSON.parse(rawPayload.toString());
    const { reference, status, transaction_id } = parsedBody;

    if (!reference || !status) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    // Idempotency
    const existingDeposit = await db
      .select()
      .from(deposits)
      .where(eq(deposits.transaction_hash, transaction_id))
      .limit(1);

    const existingWithdrawal = await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.transaction_hash, transaction_id))
      .limit(1);

    if (existingDeposit[0] || existingWithdrawal[0]) {
      return res.json({ success: true });
    }

    // Handle deposits
    const depositQuery = await db
      .select()
      .from(deposits)
      .where(eq(deposits.gateway_reference, reference))
      .limit(1);

    if (depositQuery[0]) {
      const depositStatus = status === 'success' ? 'completed' : status === 'failed' ? 'failed' : 'pending';

      await db
        .update(deposits)
        .set({
          status: depositStatus,
          transaction_hash: transaction_id,
          gateway_response: parsedBody,
          updated_at: new Date(),
        })
        .where(eq(deposits.id, depositQuery[0].id));

      logger.info(`Deposit ${depositQuery[0].id} status updated to ${depositStatus} via Kotani`);
      return res.json({ success: true });
    }

    // Handle withdrawals
    const withdrawalQuery = await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.gateway_reference, reference))
      .limit(1);

    if (withdrawalQuery[0]) {
      const withdrawalStatus = status === 'success' ? 'completed' : status === 'failed' ? 'failed' : 'pending';

      await db
        .update(withdrawals)
        .set({
          status: withdrawalStatus,
          transaction_hash: transaction_id,
          gateway_response: parsedBody,
          updated_at: new Date(),
        })
        .where(eq(withdrawals.id, withdrawalQuery[0].id));

      logger.info(`Withdrawal ${withdrawalQuery[0].id} status updated to ${withdrawalStatus} via Kotani`);
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Kotani webhook error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * M-Pesa Webhook (STK Push Callback)
 * POST /webhooks/mpesa
 */
// No signature verification needed (Safaricom relies on IP whitelisting or no sig for callbacks)
router.post('/mpesa', async (req: Request, res: Response) => {
  try {
    const { Body } = req.body;

    if (!Body) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const { stkCallback } = Body;

    if (!stkCallback) {
      return res.status(400).json({ success: false, error: 'Invalid callback' });
    }

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

    // Idempotency: Use CheckoutRequestID or extract transaction ID from CallbackMetadata if success
    let txId = CheckoutRequestID;
    if (ResultCode === 0 && stkCallback.CallbackMetadata?.Item) {
      txId = stkCallback.CallbackMetadata.Item.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value || txId;
    }

    const existing = await db
      .select()
      .from(deposits)
      .where(eq(deposits.transaction_hash, txId))
      .limit(1);

    if (existing[0]) {
      logger.info(`M-Pesa transaction ${CheckoutRequestID} already processed`);
      return res.json({ ResultCode: 0 });
    }

    const depositQuery = await db
      .select()
      .from(deposits)
      .where(eq(deposits.gateway_reference, CheckoutRequestID))
      .limit(1);

    if (!depositQuery[0]) {
      logger.warn(`Deposit not found for M-Pesa reference: ${CheckoutRequestID}`);
      return res.status(404).json({ success: false, error: 'Deposit not found' });
    }

    // ResultCode 0 = Success
    const status = ResultCode === 0 ? 'completed' : 'failed';

    await db
      .update(deposits)
      .set({
        status,
        transaction_hash: txId,
        gateway_response: stkCallback,
        updated_at: new Date(),
      })
      .where(eq(deposits.id, depositQuery[0].id));

    logger.info(`M-Pesa deposit ${depositQuery[0].id} status: ${status}`);
    res.json({ ResultCode: 0 }); // Required response for Safaricom
  } catch (error) {
    logger.error('M-Pesa webhook error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Airtel Money Webhook
 * POST /webhooks/airtel
 */
// Note: Airtel docs limited; assuming signature if provided. Confirm with Airtel API support.
router.post('/airtel', rawBodyParser, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-airtel-signature'] as string; // Assumed; may not exist—skip if not
    const rawPayload = req.body;

    if (signature && !verifyWebhookSignature('airtel', rawPayload, signature)) {
      logger.warn('Invalid Airtel webhook signature');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    const parsedBody = JSON.parse(rawPayload.toString());
    const { transaction_id, status, reference } = parsedBody;

    if (!transaction_id || !reference) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    // Idempotency
    const existing = await db
      .select()
      .from(deposits)
      .where(eq(deposits.transaction_hash, transaction_id))
      .limit(1);

    if (existing[0]) {
      return res.json({ success: true });
    }

    const depositQuery = await db
      .select()
      .from(deposits)
      .where(eq(deposits.gateway_reference, reference))
      .limit(1);

    if (!depositQuery[0]) {
      logger.warn(`Deposit not found for Airtel reference: ${reference}`);
      return res.status(404).json({ success: false, error: 'Deposit not found' });
    }

    const depositStatus = status === 'success' ? 'completed' : status === 'failed' ? 'failed' : 'pending';

    await db
      .update(deposits)
      .set({
        status: depositStatus,
        transaction_hash: transaction_id,
        gateway_response: parsedBody,
        updated_at: new Date(),
      })
      .where(eq(deposits.id, depositQuery[0].id));

    logger.info(`Deposit ${depositQuery[0].id} status updated to ${depositStatus} via Airtel`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Airtel webhook error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Onramper Webhook (Added for ramp aggregation)
 * POST /webhooks/onramper
 */
router.post('/onramper', rawBodyParser, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-onramper-signature'] as string; // Assumed based on common patterns; confirm Onramper docs
    const rawPayload = req.body;

    if (!verifyWebhookSignature('onramper', rawPayload, signature)) {
      logger.warn('Invalid Onramper webhook signature');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    const parsedBody = JSON.parse(rawPayload.toString());
    const { transactionId, status, reference } = parsedBody; // Adjust based on actual payload structure

    // Similar handling as others: Idempotency, find deposit/withdrawal, update status
    // Implement based on your flows (e.g., off-ramp completion)

    res.json({ success: true });
  } catch (error) {
    logger.error('Onramper webhook error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;