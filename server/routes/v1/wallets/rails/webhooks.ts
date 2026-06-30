/**
 * Payment Provider Webhooks - Rails Layer
 * Handles callbacks from Flutterwave, Paystack, Paychant, Kotani, M-Pesa, Airtel, Onramper
 */

import express, { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../../../../db';
import { deposits, withdrawals } from '@shared/transactionFlowSchema';
import { eq } from 'drizzle-orm';
import { logger } from '../../../../utils/logger';
import gatewayService from '../../../../services/gatewayService';
import { userStorage } from '../../../../storage/storage-user';
import {
  flutterwaveConfig,
  paystackConfig,
  paychantConfig,
  kotaniConfig,
  mpesaConfig,
  airtelConfig,
  onramperConfig,
} from '../../../../config/paymentProviders';

// Use raw body parser for signature verification (before JSON parsing)
const rawBodyParser = express.raw({ type: 'application/json' });

const router = Router();

// Rate limiting for M-Pesa webhooks (prevent replay/flood attacks)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const mpesaRateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 5; // Max 5 transactions per minute per reference

/**
 * Check rate limit for M-Pesa transactions
 */
function checkMpesaRateLimit(gatewayReference: string): boolean {
  const now = Date.now();
  const entry = mpesaRateLimitMap.get(gatewayReference);

  if (!entry || now > entry.resetTime) {
    // New window
    mpesaRateLimitMap.set(gatewayReference, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    logger.warn(`M-Pesa rate limit exceeded for reference: ${gatewayReference}`, {
      count: entry.count,
      window: RATE_LIMIT_WINDOW,
    });
    return false;
  }

  entry.count++;
  return true;
}

// Cleanup old rate limit entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of mpesaRateLimitMap.entries()) {
    if (now > value.resetTime) {
      mpesaRateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Verify webhook signature (provider-specific algorithms)
 * Uses timing-safe comparison to prevent timing attacks
 */
function verifyWebhookSignature(
  provider: string,
  payload: Buffer | string,
  signature: string
): boolean {
  let secret = '';
  let algorithm = 'sha256';

  switch (provider) {
    case 'flutterwave':
      secret = flutterwaveConfig.secretKey || '';
      algorithm = 'sha256';
      break;
    case 'paystack':
      secret = paystackConfig.secretKey || '';
      algorithm = 'sha512';
      break;
    case 'paychant':
      secret = paychantConfig.secretKey || '';
      algorithm = 'sha256';
      break;
    case 'kotani':
      secret = kotaniConfig.secretKey || '';
      algorithm = 'sha256';
      break;
    case 'airtel':
      secret = airtelConfig.secretKey || '';
      algorithm = 'sha256';
      break;
    case 'onramper':
      secret = onramperConfig.secretKey || '';
      algorithm = 'sha256';
      break;
    default:
      return false;
  }

  if (!secret) return false;

  try {
    const hash = crypto.createHmac(algorithm, secret).update(payload).digest('hex');
    const expectedBuffer = Buffer.from(hash);
    const actualBuffer = Buffer.from(signature);

    crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    return true;
  } catch (error) {
    logger.debug(`Webhook signature verification failed for ${provider}`, { error: (error as Error).message });
    return false;
  }
}

/**
 * Flutterwave Webhook
 * POST /api/v1/wallets/rails/webhooks/flutterwave
 */
router.post('/flutterwave', rawBodyParser, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['verif-hash'] as string;
    const rawPayload = req.body;

    if (!verifyWebhookSignature('flutterwave', rawPayload, signature)) {
      logger.warn('Invalid Flutterwave webhook signature');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    const parsedBody = JSON.parse(rawPayload.toString());
    const { data } = parsedBody;

    if (!data || !data.id) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const existing = await db
      .select()
      .from(deposits)
      .where(eq(deposits.transactionHash, data.transaction_id?.toString()))
      .limit(1);

    if (existing[0]) {
      logger.info(`Flutterwave transaction ${data.id} already processed`);
      return res.json({ success: true });
    }

    const depositQuery = await db
      .select()
      .from(deposits)
      .where(eq(deposits.externalReference, data.id.toString()))
      .limit(1);

    if (!depositQuery[0]) {
      logger.warn(`Deposit not found for Flutterwave transaction: ${data.id}`);
      return res.status(404).json({ success: false, error: 'Deposit not found' });
    }

    const status = data.status === 'successful' ? 'completed' : data.status === 'failed' ? 'failed' : 'pending';

    await db
      .update(deposits)
      .set({
        status,
        transactionHash: data.transaction_id?.toString(),
        metadata: JSON.stringify(parsedBody),
        completedAt: status === 'completed' ? new Date() : undefined,
      })
      .where(eq(deposits.id, depositQuery[0].id));

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
 * POST /api/v1/wallets/rails/webhooks/paystack
 */
router.post('/paystack', rawBodyParser, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
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

    const existing = await db
      .select()
      .from(deposits)
      .where(eq(deposits.transactionHash, data.id?.toString()))
      .limit(1);

    if (existing[0]) {
      logger.info(`Paystack event ${event} for ${data.reference} already processed`);
      return res.json({ success: true });
    }

    if (event === 'charge.success') {
      const depositQuery = await db
        .select()
        .from(deposits)
        .where(eq(deposits.externalReference, data.reference))
        .limit(1);

      if (!depositQuery[0]) {
        logger.warn(`Deposit not found for Paystack reference: ${data.reference}`);
        return res.status(404).json({ success: false, error: 'Deposit not found' });
      }

      await db
        .update(deposits)
        .set({
          status: 'completed',
          transactionHash: data.id?.toString(),
          metadata: JSON.stringify(parsedBody),
          completedAt: new Date(),
        })
        .where(eq(deposits.id, depositQuery[0].id));

      logger.info(`Deposit ${depositQuery[0].id} completed via Paystack`);
    } else if (event === 'charge.failed') {
      // Handle failure
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Paystack webhook error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Paychant Webhook
 * POST /api/v1/wallets/rails/webhooks/paychant
 */
router.post('/paychant', rawBodyParser, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-paychant-signature'] as string;
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

    const existing = await db
      .select()
      .from(deposits)
      .where(eq(deposits.transactionHash, transaction_id))
      .limit(1);

    if (existing[0]) {
      return res.json({ success: true });
    }

    const depositQuery = await db
      .select()
      .from(deposits)
      .where(eq(deposits.externalReference, reference))
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
        transactionHash: transaction_id,
        metadata: JSON.stringify(parsedBody),
        completedAt: depositStatus === 'completed' ? new Date() : undefined,
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
 * POST /api/v1/wallets/rails/webhooks/kotani
 */
router.post('/kotani', rawBodyParser, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-kotani-signature'] as string;
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

    const existingDeposit = await db
      .select()
      .from(deposits)
      .where(eq(deposits.transactionHash, transaction_id))
      .limit(1);

    const existingWithdrawal = await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.transactionHash, transaction_id))
      .limit(1);

    if (existingDeposit[0] || existingWithdrawal[0]) {
      return res.json({ success: true });
    }

    const depositQuery = await db
      .select()
      .from(deposits)
      .where(eq(deposits.externalReference, reference))
      .limit(1);

    if (depositQuery[0]) {
      const depositStatus = status === 'success' ? 'completed' : status === 'failed' ? 'failed' : 'pending';

      await db
        .update(deposits)
        .set({
          status: depositStatus,
          transactionHash: transaction_id,
          metadata: JSON.stringify(parsedBody),
          completedAt: depositStatus === 'completed' ? new Date() : undefined,
        })
        .where(eq(deposits.id, depositQuery[0].id));

      logger.info(`Deposit ${depositQuery[0].id} status updated to ${depositStatus} via Kotani`);
      return res.json({ success: true });
    }

    const withdrawalQuery = await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.externalReference, reference))
      .limit(1);

    if (withdrawalQuery[0]) {
      const withdrawalStatus = status === 'success' ? 'completed' : status === 'failed' ? 'failed' : 'pending';

      await db
        .update(withdrawals)
        .set({
          status: withdrawalStatus,
          transactionHash: transaction_id,
          metadata: JSON.stringify(parsedBody),
          completedAt: withdrawalStatus === 'completed' ? new Date() : undefined,
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
 * POST /api/v1/wallets/rails/webhooks/mpesa
 */
router.post('/mpesa', async (req: Request, res: Response) => {
  const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
  
  try {
    const { Body } = req.body;

    if (!Body) {
      logger.warn('M-Pesa webhook - Invalid payload (missing Body)', {
        ip: clientIP,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const { stkCallback } = Body;

    if (!stkCallback) {
      logger.warn('M-Pesa webhook - Invalid payload (missing stkCallback)', {
        ip: clientIP,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ success: false, error: 'Invalid callback' });
    }

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

    if (!checkMpesaRateLimit(CheckoutRequestID)) {
      logger.error('M-Pesa webhook - Rate limit exceeded', {
        checkoutRequestID: CheckoutRequestID,
        ip: clientIP,
        timestamp: new Date().toISOString(),
      });
      return res.status(429).json({ 
        ResultCode: -1,
        error: 'Rate limit exceeded' 
      });
    }

    let txId = CheckoutRequestID;
    if (ResultCode === 0 && stkCallback.CallbackMetadata?.Item) {
      txId = stkCallback.CallbackMetadata.Item.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value || txId;
    }

    const existing = await db
      .select()
      .from(deposits)
      .where(eq(deposits.transactionHash, txId))
      .limit(1);

    if (existing[0]) {
      logger.info('M-Pesa webhook - Duplicate transaction (idempotency)', {
        transactionHash: txId,
        checkoutRequestID: CheckoutRequestID,
        existingDepositId: existing[0].id,
        ip: clientIP,
      });
      return res.json({ ResultCode: 0 });
    }

    const depositQuery = await db
      .select()
      .from(deposits)
      .where(eq(deposits.externalReference, CheckoutRequestID))
      .limit(1);

    if (!depositQuery[0]) {
      logger.warn('M-Pesa webhook - Deposit not found', {
        checkoutRequestID: CheckoutRequestID,
        resultCode: ResultCode,
        resultDesc: ResultDesc,
        ip: clientIP,
        timestamp: new Date().toISOString(),
      });
      return res.status(404).json({ success: false, error: 'Deposit not found' });
    }

    const status = ResultCode === 0 ? 'completed' : 'failed';

    await db
      .update(deposits)
      .set({
        status,
        transactionHash: txId,
        metadata: JSON.stringify(stkCallback),
        completedAt: status === 'completed' ? new Date() : undefined,
      })
      .where(eq(deposits.id, depositQuery[0].id));

    logger.info('M-Pesa webhook - Transaction processed', {
      depositId: depositQuery[0].id,
      transactionHash: txId,
      checkoutRequestID: CheckoutRequestID,
      merchantRequestID: MerchantRequestID,
      status,
      resultCode: ResultCode,
      resultDesc: ResultDesc,
      ip: clientIP,
      timestamp: new Date().toISOString(),
    });

    // If this deposit was intended as an agent payment, attempt to call
    // the on-chain AgentPaymentGateway to record the KES payment and
    // activate the subscription. This is best-effort and does not block
    // the webhook response (fire-and-forget).
    try {
      const metadata = depositQuery[0].metadata ? JSON.parse(depositQuery[0].metadata) : {};
      const agentId = metadata?.agentId || metadata?.agent_id || metadata?.agent;
      if (agentId) {
        // Prefer explicit amount from the STK callback metadata
        let kesAmount = Number(depositQuery[0].amount || 0);
        if (ResultCode === 0 && stkCallback?.CallbackMetadata?.Item) {
          const amt = stkCallback.CallbackMetadata.Item.find((i: any) => i.Name === 'Amount')?.Value;
          if (amt) kesAmount = Number(amt);
        }

        // Resolve user's primary blockchain wallet
        let payerWallet: string | null = null;
        try {
          const wallets = await userStorage.getWalletAddresses(depositQuery[0].userId);
          if (wallets && wallets.length) payerWallet = wallets[0].walletAddress;
        } catch (e) {
          logger.warn('Failed to resolve user wallet for on-chain gateway call', { error: (e as Error).message });
        }

        if (!payerWallet) {
          logger.warn('No blockchain wallet found for user; skipping on-chain gateway call', { userId: depositQuery[0].userId, depositId: depositQuery[0].id });
        } else {
          void (async () => {
            try {
              const tx = await gatewayService.payAgentInKES(agentId, Math.round(kesAmount), payerWallet as string, txId);
              logger.info('Triggered on-chain payAgentInKES', { depositId: depositQuery[0].id, txHash: tx.hash || tx.transactionHash });
            } catch (err: any) {
              logger.error('Failed on-chain payAgentInKES invocation', { error: err?.message || String(err), depositId: depositQuery[0].id });
            }
          })();
        }
      }
    } catch (err: any) {
      logger.debug('Could not parse deposit metadata or invoke gateway', { error: err?.message || String(err) });
    }

    res.json({ ResultCode: 0 });
  } catch (error) {
    logger.error('M-Pesa webhook error', {
      error: error instanceof Error ? error.message : String(error),
      ip: clientIP,
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Airtel Money Webhook
 * POST /api/v1/wallets/rails/webhooks/airtel
 */
router.post('/airtel', rawBodyParser, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-airtel-signature'] as string;
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

    const existing = await db
      .select()
      .from(deposits)
      .where(eq(deposits.transactionHash, transaction_id))
      .limit(1);

    if (existing[0]) {
      return res.json({ success: true });
    }

    const depositQuery = await db
      .select()
      .from(deposits)
      .where(eq(deposits.externalReference, reference))
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
        transactionHash: transaction_id,
        metadata: JSON.stringify(parsedBody),
        completedAt: depositStatus === 'completed' ? new Date() : undefined,
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
 * Onramper Webhook
 * POST /api/v1/wallets/rails/webhooks/onramper
 */
router.post('/onramper', rawBodyParser, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-onramper-signature'] as string;
    const rawPayload = req.body;

    if (!verifyWebhookSignature('onramper', rawPayload, signature)) {
      logger.warn('Invalid Onramper webhook signature');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    const parsedBody = JSON.parse(rawPayload.toString());
    const { transactionId, status, reference } = parsedBody;

    // Similar handling as others: Idempotency, find deposit/withdrawal, update status

    res.json({ success: true });
  } catch (error) {
    logger.error('Onramper webhook error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
