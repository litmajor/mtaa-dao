import { db } from '../db';
// Use global fetch (Node 18+).
import { paymentTransactions } from '../../shared/schema';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { creditUserWalletOnDeposit } from '../services/ledgerService';
import { KotanipayService } from '../services/kotanipayService';
import { logConsolidatedAuditEvent } from '../services/auditConsolidated';
import {
  webhookReconciliationRuns,
  webhookReconciliationSuccess,
  webhookReconciliationFailure,
  webhookReconciliationExternalCalls,
} from '../utils/metrics';

// Kotani config
const KOTANI_BASE_URL = process.env.KOTANI_API_URL || 'https://sandbox.kotaniapi.com';
const KOTANI_API_KEY = process.env.KOTANIPAY_API_KEY;

// Reconcile pending transactions older than 15 minutes by querying provider APIs
const RECONCILE_OLDER_THAN_MS = 15 * 60 * 1000;
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000; // run every 5 minutes

async function fetchJson<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const fetchFn = (globalThis as unknown as { fetch?: (input: RequestInfo, init?: RequestInit) => Promise<Response> }).fetch;
  if (!fetchFn) throw new Error('fetch not available in globalThis');
  const res = await fetchFn(url, opts);
  const text = await res.text();
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

async function checkPaystack(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error('PAYSTACK_SECRET_KEY not configured');
  const url = `https://api.paystack.co/transaction/verify/${reference}`;
  webhookReconciliationExternalCalls.inc({ provider: 'paystack', endpoint: url });
  const data = await fetchJson<unknown>(url, { headers: { Authorization: `Bearer ${secret}` } });
  return data;
}

async function checkFlutterwave(reference: string) {
  const secret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secret) throw new Error('FLUTTERWAVE_SECRET_KEY not configured');
  const url = `https://api.flutterwave.com/v3/transactions/resolve?tx_ref=${encodeURIComponent(reference)}`;
  webhookReconciliationExternalCalls.inc({ provider: 'flutterwave', endpoint: url });
  const data = await fetchJson<unknown>(url, { headers: { Authorization: `Bearer ${secret}` } });
  return data;
}

async function getMpesaToken(): Promise<string> {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error('MPESA credentials missing');
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const url = process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
  webhookReconciliationExternalCalls.inc({ provider: 'mpesa', endpoint: url });
  const fetchFn = (globalThis as unknown as { fetch?: (input: RequestInfo, init?: RequestInit) => Promise<Response> }).fetch;
  if (!fetchFn) throw new Error('fetch not available in globalThis');
  const res = await fetchFn(url, { headers: { Authorization: `Basic ${auth}` } });
  const jsonText = await res.text();
  try {
    const parsed = JSON.parse(jsonText) as { access_token?: string };
    return parsed.access_token || '';
  } catch {
    return '';
  }
}

async function checkMpesa(checkoutRequestId: string) {
  // STK Push Query API
  const token = await getMpesaToken();
  const shortcode = process.env.MPESA_BUSINESS_SHORTCODE;
  if (!shortcode) throw new Error('MPESA_BUSINESS_SHORTCODE not configured');

  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const passphrase = process.env.MPESA_PASSKEY || '';
  const password = Buffer.from(`${shortcode}${passphrase}${timestamp}`).toString('base64');

  const url = process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
    : 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query';

  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId
  };

  webhookReconciliationExternalCalls.inc({ provider: 'mpesa', endpoint: url });
  const res = await fetchJson<unknown>(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });

  return res;
}

async function reconcileOnce() {
  webhookReconciliationRuns.inc();
  const cutoff = new Date(Date.now() - RECONCILE_OLDER_THAN_MS).toISOString();

  // Find stale pending transactions
  const rows = (await db.select().from(paymentTransactions).where(sql`status = 'pending' AND created_at < ${cutoff}`)) as typeof paymentTransactions.$inferSelect[];
  if (!rows || !rows.length) return;

  logger.info(`[RECONCILE] Found ${rows.length} stale pending transactions to evaluate.`);

  for (const tx of rows) {
    try {
      logger.debug('[RECONCILE] Inspecting', { reference: tx.reference, provider: tx.provider });

      let providerResponse: unknown = null;
      if (tx.provider === 'paystack') {
        providerResponse = await checkPaystack(tx.reference);
        // paystack returns { status: true, data: { status: 'success' } }
        const dataObj = (providerResponse as any)?.data;
        const success = dataObj && dataObj.status === 'success';
        if (success) {
          await markCompleted(tx.reference, { gatewayVerified: true, gatewayResponse: providerResponse });
          webhookReconciliationSuccess.inc({ provider: 'paystack' });
          await logConsolidatedAuditEvent({
            actorId: 'system',
            actionType: 'PAYMENT_RECONCILED',
            targetType: 'payment_transaction',
            targetId: tx.id,
            result: 'success',
            metadata: { provider: 'paystack', reference: tx.reference },
          });
          continue;
        }
        // If paystack explicitly failed, mark failed
        const failed = dataObj && ['failed', 'cancelled'].includes(dataObj.status);
        if (failed) {
          await markFailed(tx.reference, { gatewayVerified: true, gatewayResponse: providerResponse });
          webhookReconciliationFailure.inc({ provider: 'paystack' });
        }
      } else if (tx.provider === 'flutterwave') {
        providerResponse = await checkFlutterwave(tx.reference);
        const fwStatus = (providerResponse as any)?.data?.status;
        const success = (providerResponse as any)?.status === 'success' && fwStatus === 'successful';
        if (success) {
          await markCompleted(tx.reference, { gatewayVerified: true, gatewayResponse: providerResponse });
          webhookReconciliationSuccess.inc({ provider: 'flutterwave' });
          await logConsolidatedAuditEvent({
            actorId: 'system',
            actionType: 'PAYMENT_RECONCILED',
            targetType: 'payment_transaction',
            targetId: tx.id,
            result: 'success',
            metadata: { provider: 'flutterwave', reference: tx.reference },
          });
          continue;
        }
        const failed = (providerResponse as any)?.status === 'success' && ['failed', 'cancelled'].includes(fwStatus);
        if (failed) {
          await markFailed(tx.reference, { gatewayVerified: true, gatewayResponse: providerResponse });
          webhookReconciliationFailure.inc({ provider: 'flutterwave' });
        }
      } else if (tx.provider === 'mpesa') {
        // For MPesa, prefer CheckoutRequestID from metadata otherwise use reference
        const metadata = (tx.metadata as Record<string, unknown> | null) || {};
        const checkoutId = (metadata.checkoutRequestId as string | undefined) || (metadata.checkout_request_id as string | undefined) || tx.reference;
        try {
          providerResponse = await checkMpesa(checkoutId);
          const resultCode = (providerResponse as any)?.ResponseCode;
          if (resultCode === '0' || resultCode === 0) {
            await markCompleted(tx.reference, { gatewayVerified: true, gatewayResponse: providerResponse });
            webhookReconciliationSuccess.inc({ provider: 'mpesa' });
            await logConsolidatedAuditEvent({
              actorId: 'system',
              actionType: 'PAYMENT_RECONCILED',
              targetType: 'payment_transaction',
              targetId: tx.id,
              result: 'success',
              metadata: { provider: 'mpesa', reference: tx.reference },
            });
            continue;
          }
          if (resultCode && resultCode !== '0') {
            await markFailed(tx.reference, { gatewayVerified: true, gatewayResponse: providerResponse });
            webhookReconciliationFailure.inc({ provider: 'mpesa' });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn('[RECONCILE][MPESA] Soft failure during MPesa status check', { err: msg });
        }
      } else {
        logger.debug('[RECONCILE] Unsupported provider for automated reconciliation', { provider: tx.provider });
      }

      // KotaniPay: check Kotani transaction status and use KotanipayService to complete/fail
      if (tx.provider === 'kotanipay') {
        try {
          const metadata = (tx.metadata as Record<string, unknown> | null) || {};
          const checkoutId = (metadata.checkoutRequestId as string | undefined) || (metadata.checkout_request_id as string | undefined) || tx.reference;
          if (!checkoutId) {
            logger.warn('[RECONCILE][KOTANI] Missing reference/checkout id for tx', { txId: tx.id });
            continue;
          }

          const url = `${KOTANI_BASE_URL}/v1/transactions/${checkoutId}`;
          webhookReconciliationExternalCalls.inc({ provider: 'kotanipay', endpoint: url });
          const fetchFn = (globalThis as unknown as { fetch?: (input: RequestInfo, init?: RequestInit) => Promise<Response> }).fetch;
          if (!fetchFn) throw new Error('fetch not available in globalThis');
          const resp = await fetchFn(url, { headers: { Authorization: `Bearer ${KOTANI_API_KEY}` } });
          const text = await resp.text();
          let externalTx: unknown;
          try { externalTx = JSON.parse(text); } catch { externalTx = text; }

          const status = String(((externalTx as any)?.status || (externalTx as any)?.state || '')).toLowerCase();
          if (['successful', 'completed', 'success'].includes(status)) {
            const mpesaReceipt = (externalTx as any)?.mpesaReceiptNumber || (externalTx as any)?.reference || checkoutId;
            logger.info('[RECONCILE][KOTANI] Confirmed successful upstream for', { checkoutId });
            try {
              await KotanipayService.completeDeposit(checkoutId, mpesaReceipt, externalTx);
              webhookReconciliationSuccess.inc({ provider: 'kotanipay' });
              await logConsolidatedAuditEvent({
                actorId: 'system',
                actionType: 'PAYMENT_RECONCILED',
                targetType: 'payment_transaction',
                targetId: tx.id,
                result: 'success',
                metadata: { provider: 'kotanipay', reference: tx.reference },
              });
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              logger.error('[RECONCILE][KOTANI] Failed completing deposit', { checkoutId, err: msg });
            }
            continue;
          }

          if (['failed', 'rejected', 'cancelled'].includes(status)) {
            logger.info('[RECONCILE][KOTANI] Upstream marked failed for', { checkoutId });
            try {
              await KotanipayService.failDeposit(checkoutId, (externalTx as any)?.failureReason || 'Upstream failure');
              webhookReconciliationFailure.inc({ provider: 'kotanipay' });
              await logConsolidatedAuditEvent({
                actorId: 'system',
                actionType: 'PAYMENT_RECONCILED',
                targetType: 'payment_transaction',
                targetId: tx.id,
                result: 'failed',
                metadata: { provider: 'kotanipay', reference: tx.reference },
              });
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              logger.error('[RECONCILE][KOTANI] Failed failing deposit', { checkoutId, err: msg });
            }
            continue;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn('[RECONCILE][KOTANI] Soft failure checking Kotani status', { err: msg });
        }
      }

    } catch (err: any) {
      logger.error('[RECONCILE] Error reconciling transaction', { reference: tx.reference, error: err.message });
    }
  }
}

async function markCompleted(reference: string, additionalMetadata: Record<string, any> = {}) {
  const [existing] = await db.select().from(paymentTransactions).where(sql`reference = ${reference}`).limit(1);
  if (!existing) return;
  if (existing.status === 'completed') return;

  const merged = { ...(typeof existing.metadata === 'object' ? existing.metadata : {}), reconciledAt: new Date().toISOString(), ...additionalMetadata };
  await db.update(paymentTransactions).set({ status: 'completed', metadata: merged, updatedAt: new Date() }).where(sql`reference = ${reference}`);
  try {
    await creditUserWalletOnDeposit(reference);
  } catch (err: any) {
    logger.error('[RECONCILE][LEDGER_FAILED]', { reference, error: err.message });
  }
}

async function markFailed(reference: string, additionalMetadata: Record<string, any> = {}) {
  const [existing] = await db.select().from(paymentTransactions).where(sql`reference = ${reference}`).limit(1);
  if (!existing) return;
  if (existing.status === 'failed') return;

  const merged = { ...(typeof existing.metadata === 'object' ? existing.metadata : {}), reconciledAt: new Date().toISOString(), ...additionalMetadata };
  await db.update(paymentTransactions).set({ status: 'failed', metadata: merged, updatedAt: new Date() }).where(sql`reference = ${reference}`);
}

let intervalHandle: NodeJS.Timeout | null = null;

export function startWebhookReconciliationWorker() {
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    reconcileOnce().catch(err => logger.error('[RECONCILE][LOOP]', { error: err.message }));
  }, RECONCILE_INTERVAL_MS);
  // kick off immediate run
  reconcileOnce().catch(err => logger.error('[RECONCILE][IMMEDIATE]', { error: err.message }));
  logger.info('Webhook reconciliation worker started.');
}

export function stopWebhookReconciliationWorker() {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
}

export default { startWebhookReconciliationWorker, stopWebhookReconciliationWorker };
