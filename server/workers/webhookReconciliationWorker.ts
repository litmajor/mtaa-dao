/**
 * Webhook Reconciliation Worker (Production)
 *
 * Periodically finds payment transactions that have been stuck in `pending`
 * longer than a configurable threshold and queries the upstream provider to
 * determine the real outcome.  Results are applied through the domain command
 * bus so the rest of the payment pipeline stays consistent.
 *
 * Safety features
 * ─────────────────────────────────────────────────────────────
 * • Distributed Redis lock – only one process runs reconciliation
 * • Configurable age, interval, batch size, concurrency, give-up age
 * • AbortSignal timeouts on every external HTTP call
 * • Correct M-Pesa STK Query parsing (ResultCode)
 * • Cached M-Pesa OAuth token
 * • Soft-failure isolation per transaction
 * • Prometheus metrics + consolidated audit events
 */

import crypto from 'crypto';
import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { paymentTransactions } from '../../shared/schema';
import { logger } from '../utils/logger';
import { logConsolidatedAuditEvent } from '../services/auditConsolidated';
import { commandBus } from '../domain/setup';
import { PaymentCommandTypes } from '../domain/payments/PaymentCommands';
import { getRedisInstanceAsync } from '../config/redisConnectionManager';
import { KotanipayService } from '../services/kotanipayService';
import {
  webhookReconciliationRuns,
  webhookReconciliationSuccess,
  webhookReconciliationFailure,
  webhookReconciliationExternalCalls,
} from '../utils/metrics';

// ─────────────────────────────────────────────────────────────
// Configuration (env-overridable)
// ─────────────────────────────────────────────────────────────

const cfg = {
  olderThanMs: Number(process.env.RECONCILE_OLDER_THAN_MS ?? 15 * 60 * 1000),
  intervalMs: Number(process.env.RECONCILE_INTERVAL_MS ?? 5 * 60 * 1000),
  giveUpMs: Number(process.env.RECONCILE_GIVE_UP_MS ?? 7 * 24 * 60 * 60 * 1000), // 7 days
  batchSize: Number(process.env.RECONCILE_BATCH_SIZE ?? 50),
  concurrency: Number(process.env.RECONCILE_CONCURRENCY ?? 5),
  httpTimeoutMs: Number(process.env.RECONCILE_HTTP_TIMEOUT_MS ?? 12_000),
  lockTtlMs: Number(process.env.RECONCILE_LOCK_TTL_MS ?? 4 * 60 * 1000), // slightly < interval
};

const KOTANI_BASE_URL = process.env.KOTANI_API_URL || 'https://sandbox.kotaniapi.com';
const KOTANI_API_KEY = process.env.KOTANIPAY_API_KEY;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type PaymentRow = typeof paymentTransactions.$inferSelect;

type ProviderResult =
  | { outcome: 'success'; raw: unknown }
  | { outcome: 'failed'; raw: unknown; reason?: string }
  | { outcome: 'pending'; raw: unknown }
  | { outcome: 'unknown'; raw?: unknown; error?: string };

// ─────────────────────────────────────────────────────────────
// HTTP helper with timeout
// ─────────────────────────────────────────────────────────────

async function fetchJson<T = unknown>(
  url: string,
  opts: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = cfg.httpTimeoutMs, ...init } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────
// Provider status checkers
// ─────────────────────────────────────────────────────────────

async function checkPaystack(reference: string): Promise<ProviderResult> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return { outcome: 'unknown', error: 'PAYSTACK_SECRET_KEY not configured' };

  const url = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;
  webhookReconciliationExternalCalls.inc({ provider: 'paystack', endpoint: 'verify' });

  try {
    const data = await fetchJson<{
      status?: boolean;
      data?: { status?: string };
    }>(url, { headers: { Authorization: `Bearer ${secret}` } });

    const status = data?.data?.status?.toLowerCase();
    if (status === 'success') return { outcome: 'success', raw: data };
    if (status === 'failed' || status === 'abandoned' || status === 'reversed') {
      return { outcome: 'failed', raw: data, reason: status };
    }
    return { outcome: 'pending', raw: data };
  } catch (err) {
    return { outcome: 'unknown', error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkFlutterwave(reference: string): Promise<ProviderResult> {
  const secret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secret) return { outcome: 'unknown', error: 'FLUTTERWAVE_SECRET_KEY not configured' };

  const url = `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`;
  webhookReconciliationExternalCalls.inc({ provider: 'flutterwave', endpoint: 'verify_by_reference' });

  try {
    const data = await fetchJson<{
      status?: string;
      data?: { status?: string };
    }>(url, { headers: { Authorization: `Bearer ${secret}` } });

    const outer = data?.status?.toLowerCase();
    const inner = data?.data?.status?.toLowerCase();

    if (outer === 'success' && inner === 'successful') {
      return { outcome: 'success', raw: data };
    }
    if (outer === 'success' && (inner === 'failed' || inner === 'cancelled')) {
      return { outcome: 'failed', raw: data, reason: inner };
    }
    return { outcome: 'pending', raw: data };
  } catch (err) {
    return { outcome: 'unknown', error: err instanceof Error ? err.message : String(err) };
  }
}

// ── M-Pesa token cache ───────────────────────────────────────

let mpesaTokenCache: { token: string; expiresAt: number } | null = null;

async function getMpesaToken(): Promise<string> {
  if (mpesaTokenCache && Date.now() < mpesaTokenCache.expiresAt - 30_000) {
    return mpesaTokenCache.token;
  }

  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error('MPESA credentials missing');

  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const base =
    process.env.MPESA_ENV === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  const url = `${base}/oauth/v1/generate?grant_type=client_credentials`;

  webhookReconciliationExternalCalls.inc({ provider: 'mpesa', endpoint: 'oauth' });

  const data = await fetchJson<{ access_token?: string; expires_in?: string }>(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!data?.access_token) throw new Error('Failed to obtain M-Pesa access token');

  const expiresInSec = Number(data.expires_in ?? 3599);
  mpesaTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + expiresInSec * 1000,
  };
  return data.access_token;
}

async function checkMpesa(checkoutRequestId: string): Promise<ProviderResult> {
  try {
    const token = await getMpesaToken();
    const shortcode = process.env.MPESA_BUSINESS_SHORTCODE;
    if (!shortcode) return { outcome: 'unknown', error: 'MPESA_BUSINESS_SHORTCODE not configured' };

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    const passkey = process.env.MPESA_PASSKEY || '';
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const base =
      process.env.MPESA_ENV === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
    const url = `${base}/mpesa/stkpushquery/v1/query`;

    webhookReconciliationExternalCalls.inc({ provider: 'mpesa', endpoint: 'stkpushquery' });

    const body = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    const data = await fetchJson<{
      ResponseCode?: string | number;
      ResultCode?: string | number;
      ResultDesc?: string;
      errorCode?: string;
      errorMessage?: string;
    }>(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // ResponseCode === '0' means the *query* itself succeeded.
    // The actual payment outcome is in ResultCode.
    const responseCode = String(data?.ResponseCode ?? '');
    const resultCode = String(data?.ResultCode ?? '');

    if (responseCode !== '0') {
      // Query failed or still processing
      if (data?.errorCode || data?.errorMessage) {
        return { outcome: 'unknown', raw: data, error: data.errorMessage };
      }
      return { outcome: 'pending', raw: data };
    }

    if (resultCode === '0') {
      return { outcome: 'success', raw: data };
    }

    // Common failure codes: 1032 (cancelled by user), 1037 (timeout), 1xxx etc.
    if (resultCode && resultCode !== '0') {
      return {
        outcome: 'failed',
        raw: data,
        reason: data?.ResultDesc || `ResultCode ${resultCode}`,
      };
    }

    return { outcome: 'pending', raw: data };
  } catch (err) {
    return { outcome: 'unknown', error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkKotani(checkoutId: string): Promise<ProviderResult> {
  if (!KOTANI_API_KEY) {
    return { outcome: 'unknown', error: 'KOTANIPAY_API_KEY not configured' };
  }

  const url = `${KOTANI_BASE_URL}/v1/transactions/${encodeURIComponent(checkoutId)}`;
  webhookReconciliationExternalCalls.inc({ provider: 'kotanipay', endpoint: 'transactions' });

  try {
    const data = await fetchJson<{
      status?: string;
      state?: string;
      mpesaReceiptNumber?: string;
      reference?: string;
      failureReason?: string;
    }>(url, {
      headers: { Authorization: `Bearer ${KOTANI_API_KEY}` },
    });

    const status = String(data?.status || data?.state || '').toLowerCase();

    if (['successful', 'completed', 'success'].includes(status)) {
      return { outcome: 'success', raw: data };
    }
    if (['failed', 'rejected', 'cancelled'].includes(status)) {
      return {
        outcome: 'failed',
        raw: data,
        reason: data?.failureReason || status,
      };
    }
    return { outcome: 'pending', raw: data };
  } catch (err) {
    return { outcome: 'unknown', error: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────────────────────────────────────────
// Domain command helpers
// ─────────────────────────────────────────────────────────────

async function markCompleted(
  reference: string,
  additionalMetadata: Record<string, unknown> = {}
): Promise<boolean> {
  const correlationId = crypto.randomUUID();

  const receiveResult = await commandBus.dispatch({
    id: crypto.randomUUID(),
    type: PaymentCommandTypes.ReceiveWebhook,
    actor: 'system-reconciliation',
    correlationId,
    timestamp: new Date(),
    payload: { reference, providerData: additionalMetadata },
  });

  if (!receiveResult.success) {
    logger.warn(`[RECONCILE] ReceiveWebhook failed for ${reference}`, {
      error: receiveResult.error,
    });
    return false;
  }

  const completeResult = await commandBus.dispatch({
    id: crypto.randomUUID(),
    type: PaymentCommandTypes.CompletePayment,
    actor: 'system-reconciliation',
    correlationId,
    timestamp: new Date(),
    payload: {
      reference,
      providerMetadata: {
        reconciledAt: new Date().toISOString(),
        ...additionalMetadata,
      },
    },
  });

  if (!completeResult.success) {
    logger.error(`[RECONCILE] CompletePayment failed for ${reference}`, {
      error: completeResult.error,
    });
    return false;
  }
  return true;
}

async function markFailed(
  reference: string,
  additionalMetadata: Record<string, unknown> = {}
): Promise<boolean> {
  const correlationId = crypto.randomUUID();

  const receiveResult = await commandBus.dispatch({
    id: crypto.randomUUID(),
    type: PaymentCommandTypes.ReceiveWebhook,
    actor: 'system-reconciliation',
    correlationId,
    timestamp: new Date(),
    payload: { reference, providerData: additionalMetadata },
  });

  if (!receiveResult.success) {
    logger.warn(`[RECONCILE] ReceiveWebhook failed for ${reference}`, {
      error: receiveResult.error,
    });
    return false;
  }

  const failResult = await commandBus.dispatch({
    id: crypto.randomUUID(),
    type: PaymentCommandTypes.FailPayment,
    actor: 'system-reconciliation',
    correlationId,
    timestamp: new Date(),
    payload: {
      reference,
      reason: additionalMetadata.reason || 'Reconciliation marked as failed',
      providerData: {
        reconciledAt: new Date().toISOString(),
        ...additionalMetadata,
      },
    },
  });

  if (!failResult.success) {
    logger.error(`[RECONCILE] FailPayment failed for ${reference}`, {
      error: failResult.error,
    });
    return false;
  }
  return true;
}

async function markAbandoned(tx: PaymentRow): Promise<void> {
  // Direct status update for rows that have exceeded the give-up window.
  // Prefer a dedicated command if you have one; otherwise a guarded update is fine.
  await db
    .update(paymentTransactions)
    .set({
      status: 'abandoned',
      metadata: sql`COALESCE(${paymentTransactions.metadata}, '{}'::jsonb) || ${JSON.stringify({
        abandonedAt: new Date().toISOString(),
        reason: 'Exceeded reconciliation give-up age',
      })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentTransactions.id, tx.id),
        eq(paymentTransactions.status, 'pending')
      )
    );

  await logConsolidatedAuditEvent({
    actorId: 'system',
    actionType: 'PAYMENT_ABANDONED',
    targetType: 'payment_transaction',
    targetId: tx.id,
    result: 'success',
    metadata: { reference: tx.reference, provider: tx.provider },
  });
}

// ─────────────────────────────────────────────────────────────
// Per-transaction reconciliation
// ─────────────────────────────────────────────────────────────

async function reconcileTransaction(tx: PaymentRow): Promise<void> {
  if (!tx.createdAt) {
    logger.warn('[RECONCILE] Skipping transaction without a creation timestamp', {
      transactionId: tx.id,
      reference: tx.reference,
    });
    return;
  }

  const ageMs = Date.now() - new Date(tx.createdAt).getTime();

  // Give-up path
  if (ageMs > cfg.giveUpMs) {
    logger.info('[RECONCILE] Abandoning stale transaction', {
      reference: tx.reference,
      ageDays: Math.round(ageMs / 86_400_000),
    });
    await markAbandoned(tx);
    return;
  }

  logger.debug('[RECONCILE] Inspecting', {
    reference: tx.reference,
    provider: tx.provider,
  });

  const metadata = (tx.metadata as Record<string, unknown> | null) || {};
  let result: ProviderResult;

  switch (tx.provider) {
    case 'paystack':
      result = await checkPaystack(tx.reference);
      break;

    case 'flutterwave':
      result = await checkFlutterwave(tx.reference);
      break;

    case 'mpesa': {
      const checkoutId =
        (metadata.checkoutRequestId as string | undefined) ||
        (metadata.checkout_request_id as string | undefined) ||
        tx.reference;
      result = await checkMpesa(checkoutId);
      break;
    }

    case 'kotanipay': {
      const checkoutId =
        (metadata.checkoutRequestId as string | undefined) ||
        (metadata.checkout_request_id as string | undefined) ||
        tx.reference;

      if (!checkoutId) {
        logger.warn('[RECONCILE][KOTANI] Missing checkout id', { txId: tx.id });
        return;
      }

      result = await checkKotani(checkoutId);

      // Kotani has its own completion helpers
      if (result.outcome === 'success') {
        const raw = result.raw as Record<string, unknown> | undefined;
        const receipt =
          (raw?.mpesaReceiptNumber as string) ||
          (raw?.reference as string) ||
          checkoutId;
        try {
          await KotanipayService.completeDeposit(checkoutId, receipt, result.raw);
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
          logger.error('[RECONCILE][KOTANI] completeDeposit failed', {
            checkoutId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }

      if (result.outcome === 'failed') {
        try {
          await KotanipayService.failDeposit(
            checkoutId,
            result.reason || 'Upstream failure'
          );
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
          logger.error('[RECONCILE][KOTANI] failDeposit failed', {
            checkoutId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }
      // pending / unknown → fall through
      return;
    }

    default:
      logger.debug('[RECONCILE] Unsupported provider', { provider: tx.provider });
      return;
  }

  // Generic providers (Paystack / Flutterwave / M-Pesa)
  if (result.outcome === 'success') {
    const ok = await markCompleted(tx.reference, {
      gatewayVerified: true,
      gatewayResponse: result.raw,
    });
    if (ok) {
      webhookReconciliationSuccess.inc({ provider: tx.provider });
      await logConsolidatedAuditEvent({
        actorId: 'system',
        actionType: 'PAYMENT_RECONCILED',
        targetType: 'payment_transaction',
        targetId: tx.id,
        result: 'success',
        metadata: { provider: tx.provider, reference: tx.reference },
      });
    }
  } else if (result.outcome === 'failed') {
    const ok = await markFailed(tx.reference, {
      gatewayVerified: true,
      gatewayResponse: result.raw,
      reason: result.reason,
    });
    if (ok) {
      webhookReconciliationFailure.inc({ provider: tx.provider });
    }
  } else if (result.outcome === 'unknown') {
    logger.warn('[RECONCILE] Provider check returned unknown', {
      reference: tx.reference,
      provider: tx.provider,
      error: result.error,
    });
  }
  // 'pending' → leave untouched
}

// ─────────────────────────────────────────────────────────────
// Concurrency helper
// ─────────────────────────────────────────────────────────────

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()!;
      try {
        await fn(item);
      } catch (err) {
        logger.error('[RECONCILE] Unhandled error in worker', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });
  await Promise.all(workers);
}

// ─────────────────────────────────────────────────────────────
// Distributed lock
// ─────────────────────────────────────────────────────────────

const LOCK_KEY = 'webhook-reconciliation:lock';

async function acquireLock(): Promise<string | null> {
  const redis = await getRedisInstanceAsync();
  const token = crypto.randomUUID();
  const ok = await redis.set(LOCK_KEY, token, {
    PX: cfg.lockTtlMs,
    NX: true,
  });
  return ok === 'OK' ? token : null;
}

async function releaseLock(token: string): Promise<void> {
  const redis = await getRedisInstanceAsync();
  // Safe release – only delete if we still own the lock
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, {
    keys: [LOCK_KEY],
    arguments: [token],
  });
}

// ─────────────────────────────────────────────────────────────
// Main reconciliation tick
// ─────────────────────────────────────────────────────────────

async function reconcileOnce(): Promise<void> {
  const lockToken = await acquireLock();
  if (!lockToken) {
    logger.debug('[RECONCILE] Another instance holds the lock – skipping');
    return;
  }

  webhookReconciliationRuns.inc();

  try {
    const cutoff = new Date(Date.now() - cfg.olderThanMs);

    const rows = await db
      .select()
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.status, 'pending'),
          lt(paymentTransactions.createdAt, cutoff)
        )
      )
      .limit(cfg.batchSize);

    if (!rows.length) return;

    logger.info(`[RECONCILE] Evaluating ${rows.length} stale pending transaction(s)`);

    await mapWithConcurrency(rows, cfg.concurrency, reconcileTransaction);
  } catch (err) {
    logger.error('[RECONCILE] Tick failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await releaseLock(lockToken);
  }
}

// ─────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────

let intervalHandle: NodeJS.Timeout | null = null;

export function startWebhookReconciliationWorker(): void {
  if (intervalHandle) return;

  intervalHandle = setInterval(() => {
    reconcileOnce().catch((err) =>
      logger.error('[RECONCILE][LOOP]', {
        error: err instanceof Error ? err.message : String(err),
      })
    );
  }, cfg.intervalMs);

  // Immediate first run
  reconcileOnce().catch((err) =>
    logger.error('[RECONCILE][IMMEDIATE]', {
      error: err instanceof Error ? err.message : String(err),
    })
  );

  logger.info('Webhook reconciliation worker started', {
    olderThanMs: cfg.olderThanMs,
    intervalMs: cfg.intervalMs,
    giveUpMs: cfg.giveUpMs,
    batchSize: cfg.batchSize,
    concurrency: cfg.concurrency,
  });
}

export function stopWebhookReconciliationWorker(): void {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
  logger.info('Webhook reconciliation worker stopped');
}

export default {
  startWebhookReconciliationWorker,
  stopWebhookReconciliationWorker,
};