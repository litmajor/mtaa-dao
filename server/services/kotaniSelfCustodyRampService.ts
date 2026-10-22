import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, asc, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { z } from 'zod';
import {
  selfCustodyRampTransactions,
  selfCustodyRampWebhookEvents,
} from '../../shared/financialEnhancedSchema';
import { users, wallets } from '../../shared/schema';
import { db } from '../db';
import { Logger } from '../utils/logger';

const DEFAULT_SANDBOX_API_URL = 'https://sandbox-api.kotanipay.io/v3';
const PRODUCTION_API_URL = 'https://api.kotanipay.io/api/v3';
const API_KEY = process.env.KOTANIPAY_API_KEY;
const WEBHOOK_SECRET = process.env.KOTANIPAY_WEBHOOK_SECRET;
const ENABLED = process.env.KOTANIPAY_ONOFFRAMP_ENABLED === 'true';
const SIGNATURE_MODE = process.env.KOTANIPAY_ONOFFRAMP_SIGNATURE_MODE;
const QUOTE_TTL_MS = 10 * 60 * 1000;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const logger = Logger.getLogger();

const providerEnvelopeSchema = z.object({
  success: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  message: z.string().optional(),
}).passthrough();

export interface RampQuoteRequest {
  userId: string;
  phoneNumber: string;
  walletAddress: string;
  fiatAmount?: string;
  cryptoAmount?: string;
}

export class RampServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'RampServiceError';
  }
}

function requireEnabled(): void {
  if (!ENABLED) throw new RampServiceError('RAMP_DISABLED', 'KotaniPay self-custody ramps are not enabled.', 503);
  if (!API_KEY || !WEBHOOK_SECRET) {
    throw new RampServiceError('PROVIDER_CONFIGURATION_REQUIRED', 'KotaniPay ramp credentials are not configured.', 503);
  }
  if (!isWebhookUrlConfigured()) {
    throw new RampServiceError('WEBHOOK_CONFIGURATION_REQUIRED', 'KotaniPay webhook URL is not configured.', 503);
  }
  if (!['raw-body-header', 'canonical-envelope'].includes(SIGNATURE_MODE || '')) {
    throw new RampServiceError('WEBHOOK_SIGNATURE_MODE_REQUIRED', 'KotaniPay webhook signature mode is not configured.', 503);
  }
}

function isWebhookUrlConfigured(): boolean {
  const configuredUrl = process.env.KOTANIPAY_ONOFFRAMP_WEBHOOK_URL;
  if (!configuredUrl) return false;
  try {
    const parsedUrl = new URL(configuredUrl);
    return parsedUrl.protocol === 'https:'
      && parsedUrl.hostname !== 'localhost'
      && parsedUrl.hostname !== '127.0.0.1';
  } catch {
    return false;
  }
}

function getObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readPositiveNumber(value: unknown, field: string): string {
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  const decimalValue = typeof value === 'number' ? String(value) : value;
  if (typeof decimalValue !== 'string'
    || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(decimalValue)
    || !Number.isFinite(parsed)
    || parsed <= 0) {
    throw new Error(`KotaniPay quote returned an invalid ${field}.`);
  }
  return decimalValue;
}

function readRateId(data: Record<string, unknown>): string {
  const rateId = data.rateId ?? data.id;
  if (typeof rateId !== 'string' || !rateId.trim() || rateId.trim() !== rateId) {
    throw new Error('KotaniPay quote did not return a rate ID.');
  }
  return rateId;
}

function resolveApiBaseUrl(): URL {
  const configuredUrl = process.env.KOTANIPAY_V3_API_URL
    || (process.env.NODE_ENV === 'production' ? PRODUCTION_API_URL : DEFAULT_SANDBOX_API_URL);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new RampServiceError('PROVIDER_CONFIGURATION_REQUIRED', 'KotaniPay v3 API URL is invalid.', 503);
  }

  const allowedRoots = new Map([
    ['sandbox-api.kotanipay.io/v3', 'sandbox'],
    ['api.kotanipay.io/api/v3', 'production'],
  ]);
  const root = `${parsedUrl.hostname}${parsedUrl.pathname.replace(/\/+$/, '')}`;
  const environment = allowedRoots.get(root);
  if (parsedUrl.protocol !== 'https:'
    || parsedUrl.port
    || parsedUrl.username
    || parsedUrl.password
    || parsedUrl.search
    || parsedUrl.hash
    || !environment
    || (process.env.NODE_ENV === 'production' && environment !== 'production')) {
    throw new RampServiceError(
      'PROVIDER_CONFIGURATION_REQUIRED',
      'KotaniPay v3 API URL must exactly match the approved sandbox or production API root; production requires the production root.',
      503,
    );
  }
  return parsedUrl;
}

if (ENABLED) resolveApiBaseUrl();

function buildApiUrl(path: string): URL {
  const base = resolveApiBaseUrl();
  const resourcePath = path.replace(/^\/api\/v3(?=\/)/, '').replace(/^\/v3(?=\/)/, '');
  return new URL(`${base.pathname.replace(/\/+$/, '')}${resourcePath}`, base.origin);
}

function assertQuoteAssets(
  quote: Record<string, unknown>,
  expectedFrom: string,
  expectedTo: string,
): void {
  const assetChecks: Array<[unknown, string, string]> = [
    [quote.from, 'from', expectedFrom],
    [quote.to, 'to', expectedTo],
    [quote.chain, 'chain', 'CELO'],
    [quote.token, 'token', 'CUSD'],
  ];
  for (const [value, field, expected] of assetChecks) {
    if (value !== undefined && value !== null
      && (typeof value !== 'string' || value.trim().toUpperCase() !== expected)) {
      throw new Error(`KotaniPay quote returned an unexpected ${field} asset.`);
    }
  }
}

function readQuoteExpiry(data: Record<string, unknown>): string | undefined {
  const expiryValue = data.expiresAt ?? data.expires_at ?? data.validUntil ?? data.valid_until;
  if (expiryValue === undefined || expiryValue === null) return undefined;
  let expiryMs: number;
  if (typeof expiryValue === 'string') {
    expiryMs = Date.parse(expiryValue);
  } else if (typeof expiryValue === 'number' && Number.isFinite(expiryValue)) {
    expiryMs = expiryValue < 1_000_000_000_000 ? expiryValue * 1000 : expiryValue;
  } else {
    throw new Error('KotaniPay quote returned an invalid expiry.');
  }
  if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) {
    throw new Error('KotaniPay quote is already expired or has an invalid expiry.');
  }
  return new Date(expiryMs).toISOString();
}

async function kotaniRequest(
  path: string,
  body?: Record<string, unknown>,
  method: 'GET' | 'POST' = 'POST',
): Promise<Record<string, unknown>> {
  requireEnabled();
  const response = await fetch(buildApiUrl(path), {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const responseText = await response.text();
  let parsedBody: unknown;
  try {
    parsedBody = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(`KotaniPay returned an invalid JSON response (${response.status}).`);
  }

  const envelope = providerEnvelopeSchema.safeParse(parsedBody);
  if (!response.ok) {
    throw new Error(typeof envelope.success === 'boolean' && envelope.success && typeof envelope.data?.message === 'string'
      ? envelope.data.message
      : `KotaniPay request failed (${response.status}).`);
  }
  if (!envelope.success) {
    throw new Error(`KotaniPay returned an invalid response (${envelope.error.issues.map((issue) => issue.message).join('; ')}).`);
  }
  if (envelope.data.success === false) {
    throw new Error(typeof envelope.data.message === 'string'
      ? envelope.data.message
      : `KotaniPay request failed (${response.status}).`);
  }
  return getObject(envelope.data?.data ?? envelope.data);
}

function callbackUrl(): string {
  const configuredUrl = process.env.KOTANIPAY_ONOFFRAMP_WEBHOOK_URL;
  if (!configuredUrl) throw new Error('KotaniPay self-custody webhook URL is not configured.');
  return new URL(configuredUrl).toString();
}

function toInitiationResponse(transaction: typeof selfCustodyRampTransactions.$inferSelect) {
  return {
    referenceId: transaction.referenceId,
    direction: transaction.direction,
    status: transaction.status,
    fiatAmount: transaction.fiatAmount,
    fiatCurrency: transaction.fiatCurrency,
    cryptoAmount: transaction.cryptoAmount,
    token: transaction.token,
    chain: transaction.chain,
    walletAddress: transaction.walletAddress,
    depositAddress: transaction.depositAddress ?? undefined,
  };
}

export class KotaniSelfCustodyRampService {
  static isAvailable(): boolean {
    let apiUrlConfigured = true;
    try {
      resolveApiBaseUrl();
    } catch {
      apiUrlConfigured = false;
    }
    return ENABLED
      && apiUrlConfigured
      && Boolean(API_KEY && WEBHOOK_SECRET && isWebhookUrlConfigured())
      && ['raw-body-header', 'canonical-envelope'].includes(SIGNATURE_MODE || '');
  }

  static getWebhookSignatureMode(): string | undefined {
    return SIGNATURE_MODE;
  }

  static async createOnrampQuote(request: RampQuoteRequest & { fiatAmount: string }) {
    requireEnabled();
    await this.validateCommon(request);
    let quote: Record<string, unknown>;
    try {
      quote = await kotaniRequest('/api/v3/rate/onramp', {
        from: 'KES',
        to: 'CUSD',
        fiatAmount: Number(request.fiatAmount),
        source: 'fiat',
      });
    } catch (error) {
      throw new RampServiceError(
        'PROVIDER_QUOTE_FAILED',
        error instanceof Error ? error.message : 'KotaniPay could not provide an onramp quote.',
        502,
      );
    }
    let rateId: string;
    let cryptoAmount: string;
    let exchangeRate: string | null;
    let quoteExpiresAt: string | undefined;
    try {
      assertQuoteAssets(quote, 'KES', 'CUSD');
      rateId = readRateId(quote);
      cryptoAmount = readPositiveNumber(quote.cryptoAmount, 'crypto amount');
      exchangeRate = quote.value == null ? null : readPositiveNumber(quote.value, 'exchange rate');
      quoteExpiresAt = readQuoteExpiry(quote);
    } catch (error) {
      throw new RampServiceError(
        'PROVIDER_QUOTE_INVALID',
        error instanceof Error ? error.message : 'KotaniPay returned an invalid onramp quote.',
        502,
      );
    }
    const effectiveQuoteExpiresAt = quoteExpiresAt ?? new Date(Date.now() + QUOTE_TTL_MS).toISOString();
    const referenceId = randomUUID();

    const [transaction] = await db.insert(selfCustodyRampTransactions).values({
      referenceId,
      userId: request.userId,
      direction: 'onramp',
      status: 'quoted',
      fiatAmount: request.fiatAmount,
      cryptoAmount,
      exchangeRate,
      phoneNumber: request.phoneNumber,
      walletAddress: request.walletAddress,
      providerMetadata: { rateId, quoteExpiresAt: effectiveQuoteExpiresAt },
    }).returning();

    return {
      referenceId: transaction.referenceId,
      direction: 'onramp',
      status: transaction.status,
      fiatAmount: transaction.fiatAmount,
      fiatCurrency: transaction.fiatCurrency,
      cryptoAmount: transaction.cryptoAmount,
      token: transaction.token,
      chain: transaction.chain,
      exchangeRate: transaction.exchangeRate,
      quoteExpiresAt: effectiveQuoteExpiresAt,
    };
  }

  static async createOfframpQuote(request: RampQuoteRequest & { cryptoAmount: string }) {
    requireEnabled();
    await this.validateCommon(request);
    let quote: Record<string, unknown>;
    try {
      quote = await kotaniRequest('/api/v3/rate/offramp', {
        from: 'CUSD',
        to: 'KES',
        cryptoAmount: Number(request.cryptoAmount),
        source: 'crypto',
      });
    } catch (error) {
      throw new RampServiceError(
        'PROVIDER_QUOTE_FAILED',
        error instanceof Error ? error.message : 'KotaniPay could not provide an offramp quote.',
        502,
      );
    }
    let rateId: string;
    let fiatAmount: string;
    let exchangeRate: string | null;
    let quoteExpiresAt: string | undefined;
    try {
      assertQuoteAssets(quote, 'CUSD', 'KES');
      rateId = readRateId(quote);
      fiatAmount = readPositiveNumber(quote.fiatAmount, 'fiat amount');
      exchangeRate = quote.value == null ? null : readPositiveNumber(quote.value, 'exchange rate');
      quoteExpiresAt = readQuoteExpiry(quote);
    } catch (error) {
      throw new RampServiceError(
        'PROVIDER_QUOTE_INVALID',
        error instanceof Error ? error.message : 'KotaniPay returned an invalid offramp quote.',
        502,
      );
    }
    const effectiveQuoteExpiresAt = quoteExpiresAt ?? new Date(Date.now() + QUOTE_TTL_MS).toISOString();
    const referenceId = randomUUID();

    const [transaction] = await db.insert(selfCustodyRampTransactions).values({
      referenceId,
      userId: request.userId,
      direction: 'offramp',
      status: 'quoted',
      fiatAmount,
      cryptoAmount: request.cryptoAmount,
      exchangeRate,
      phoneNumber: request.phoneNumber,
      walletAddress: request.walletAddress,
      providerMetadata: { rateId, quoteExpiresAt: effectiveQuoteExpiresAt },
    }).returning();

    return {
      referenceId: transaction.referenceId,
      direction: 'offramp',
      status: transaction.status,
      cryptoAmount: transaction.cryptoAmount,
      token: transaction.token,
      chain: transaction.chain,
      fiatAmount: transaction.fiatAmount,
      fiatCurrency: transaction.fiatCurrency,
      exchangeRate: transaction.exchangeRate,
      quoteExpiresAt: effectiveQuoteExpiresAt,
    };
  }

  static async initiate(userId: string, referenceId: string) {
    requireEnabled();
    const [transaction] = await db.select()
      .from(selfCustodyRampTransactions)
      .where(and(
        eq(selfCustodyRampTransactions.userId, userId),
        eq(selfCustodyRampTransactions.referenceId, referenceId),
      ))
      .limit(1);
    if (!transaction) throw new RampServiceError('QUOTE_NOT_FOUND', 'Ramp quote not found.', 404);
    await this.requireOwnedActiveWallet(userId, transaction.walletAddress);
    if (transaction.status !== 'quoted') {
      throw new RampServiceError('QUOTE_UNAVAILABLE', 'Ramp quote has already been used or is no longer available.', 409);
    }
    if (Date.now() - transaction.createdAt.getTime() > QUOTE_TTL_MS) {
      await db.update(selfCustodyRampTransactions)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(selfCustodyRampTransactions.id, transaction.id));
      throw new RampServiceError('QUOTE_EXPIRED', 'Ramp quote expired. Request a fresh quote.', 409);
    }

    const metadata = getObject(transaction.providerMetadata);
    const rateId = typeof metadata.rateId === 'string' ? metadata.rateId : undefined;
    if (!rateId) throw new RampServiceError('QUOTE_INVALID', 'Stored KotaniPay quote is missing its rate ID.', 409);
    if (typeof metadata.quoteExpiresAt === 'string'
      && (!Number.isFinite(Date.parse(metadata.quoteExpiresAt)) || Date.parse(metadata.quoteExpiresAt) <= Date.now())) {
      await db.update(selfCustodyRampTransactions)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(and(
          eq(selfCustodyRampTransactions.id, transaction.id),
          eq(selfCustodyRampTransactions.status, 'quoted'),
        ));
      throw new RampServiceError('QUOTE_EXPIRED', 'KotaniPay quote expired. Request a fresh quote.', 409);
    }
    const [profile] = await db.select({
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
    }).from(users).where(eq(users.id, userId)).limit(1);
    const accountName = [profile?.firstName, profile?.lastName]
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part))
      .join(' ') || profile?.name?.trim() || undefined;

    const [claimedQuote] = await db.update(selfCustodyRampTransactions)
      .set({ status: 'initiating', updatedAt: new Date() })
      .where(and(
        eq(selfCustodyRampTransactions.id, transaction.id),
        eq(selfCustodyRampTransactions.status, 'quoted'),
      ))
      .returning({ id: selfCustodyRampTransactions.id });
    if (!claimedQuote) {
      throw new RampServiceError('QUOTE_UNAVAILABLE', 'Ramp quote has already been used or is no longer available.', 409);
    }

    try {
      const providerResponse = transaction.direction === 'onramp'
        ? await kotaniRequest('/api/v3/onramp', {
            fiatAmount: Number(transaction.fiatAmount),
            currency: transaction.fiatCurrency,
            chain: transaction.chain,
            token: transaction.token,
            receiverAddress: transaction.walletAddress,
            referenceId: transaction.referenceId,
            callbackUrl: callbackUrl(),
            rateId,
            mobileMoney: {
              phoneNumber: transaction.phoneNumber,
              providerNetwork: 'MPESA',
              ...(accountName ? { accountName } : {}),
            },
          })
        : await kotaniRequest('/api/v3/offramp', {
            cryptoAmount: Number(transaction.cryptoAmount),
            currency: transaction.fiatCurrency,
            chain: transaction.chain,
            token: transaction.token,
            senderAddress: transaction.walletAddress,
            referenceId: transaction.referenceId,
            callbackUrl: callbackUrl(),
            rateId,
            mobileMoneyReceiver: {
              phoneNumber: transaction.phoneNumber,
              providerNetwork: 'MPESA',
              ...(accountName ? { accountName } : {}),
            },
          });

      const depositAddress = providerResponse.escrowAddress;
      if (transaction.direction === 'offramp'
        && (typeof depositAddress !== 'string' || !ADDRESS_PATTERN.test(depositAddress))) {
        throw new Error('KotaniPay did not return a valid Celo escrow address.');
      }

      const providerTransactionId = providerResponse.id;
      const [updated] = await db.update(selfCustodyRampTransactions)
        .set({
          status: 'pending',
          depositAddress: typeof depositAddress === 'string' ? depositAddress : null,
          providerTransactionId: typeof providerTransactionId === 'string' ? providerTransactionId : null,
          providerMetadata: { ...metadata, rateId, providerStatus: providerResponse.status },
          updatedAt: new Date(),
        })
        .where(and(
          eq(selfCustodyRampTransactions.id, transaction.id),
          eq(selfCustodyRampTransactions.status, 'initiating'),
        ))
        .returning();
      if (updated) return toInitiationResponse(updated);

      const [latest] = await db.select()
        .from(selfCustodyRampTransactions)
        .where(eq(selfCustodyRampTransactions.id, transaction.id))
        .limit(1);
      if (latest) return toInitiationResponse(latest);
      throw new Error('Ramp transaction disappeared during provider initiation.');
    } catch (error) {
      logger.error('KotaniPay ramp initiation could not be confirmed', {
        referenceId: transaction.referenceId,
        error: error instanceof Error ? error.message : 'Unknown provider error',
      });
      await db.update(selfCustodyRampTransactions)
        .set({ status: 'initiation_unknown', updatedAt: new Date() })
        .where(and(
          eq(selfCustodyRampTransactions.id, transaction.id),
          eq(selfCustodyRampTransactions.status, 'initiating'),
        ));
      const [latest] = await db.select()
        .from(selfCustodyRampTransactions)
        .where(eq(selfCustodyRampTransactions.id, transaction.id))
        .limit(1);
      if (latest && latest.status !== 'initiation_unknown' && latest.status !== 'initiating') {
        return toInitiationResponse(latest);
      }
      throw new RampServiceError(
        'INITIATION_UNKNOWN',
        'KotaniPay initiation could not be confirmed. Do not retry; check the transaction status or contact support.',
        502,
      );
    }
  }

  static async getUserTransaction(userId: string, referenceId: string) {
    const [transaction] = await db.select()
      .from(selfCustodyRampTransactions)
      .where(and(
        eq(selfCustodyRampTransactions.userId, userId),
        eq(selfCustodyRampTransactions.referenceId, referenceId),
      ))
      .limit(1);
    return transaction;
  }

  static async listUserTransactions(userId: string) {
    return db.select({
      referenceId: selfCustodyRampTransactions.referenceId,
      direction: selfCustodyRampTransactions.direction,
      status: selfCustodyRampTransactions.status,
      fiatAmount: selfCustodyRampTransactions.fiatAmount,
      fiatCurrency: selfCustodyRampTransactions.fiatCurrency,
      cryptoAmount: selfCustodyRampTransactions.cryptoAmount,
      token: selfCustodyRampTransactions.token,
      chain: selfCustodyRampTransactions.chain,
      transactionHash: selfCustodyRampTransactions.transactionHash,
      refundTransactionHash: selfCustodyRampTransactions.refundTransactionHash,
      createdAt: selfCustodyRampTransactions.createdAt,
      completedAt: selfCustodyRampTransactions.completedAt,
    }).from(selfCustodyRampTransactions)
      .where(eq(selfCustodyRampTransactions.userId, userId))
      .orderBy(desc(selfCustodyRampTransactions.createdAt))
      .limit(50);
  }

  static async listOpenTransactions() {
    return db.select({
      referenceId: selfCustodyRampTransactions.referenceId,
      direction: selfCustodyRampTransactions.direction,
      status: selfCustodyRampTransactions.status,
      fiatAmount: selfCustodyRampTransactions.fiatAmount,
      fiatCurrency: selfCustodyRampTransactions.fiatCurrency,
      cryptoAmount: selfCustodyRampTransactions.cryptoAmount,
      token: selfCustodyRampTransactions.token,
      chain: selfCustodyRampTransactions.chain,
      providerTransactionId: selfCustodyRampTransactions.providerTransactionId,
      providerEvent: selfCustodyRampTransactions.providerEvent,
      onchainStatus: selfCustodyRampTransactions.onchainStatus,
      fiatStatus: selfCustodyRampTransactions.fiatStatus,
      createdAt: selfCustodyRampTransactions.createdAt,
      updatedAt: selfCustodyRampTransactions.updatedAt,
    }).from(selfCustodyRampTransactions)
      .where(inArray(selfCustodyRampTransactions.status, [
        'quoted',
        'initiating',
        'initiation_unknown',
        'pending',
        'processing',
        'reconciliation_required',
        'refund_pending',
        'refund_failed',
      ]))
      .orderBy(asc(selfCustodyRampTransactions.updatedAt))
      .limit(100);
  }

  static async listUnresolvedWebhookEvents() {
    return db.select({
      referenceId: selfCustodyRampWebhookEvents.referenceId,
      event: selfCustodyRampWebhookEvents.event,
      status: selfCustodyRampWebhookEvents.status,
      attempts: selfCustodyRampWebhookEvents.attempts,
      lastError: selfCustodyRampWebhookEvents.lastError,
      receivedAt: selfCustodyRampWebhookEvents.receivedAt,
      updatedAt: selfCustodyRampWebhookEvents.updatedAt,
    }).from(selfCustodyRampWebhookEvents)
      .where(inArray(selfCustodyRampWebhookEvents.status, ['pending', 'failed', 'processing']))
      .orderBy(asc(selfCustodyRampWebhookEvents.receivedAt))
      .limit(100);
  }

  static async persistWebhookEvent(
    eventDigest: string,
    event: string,
    data: Record<string, unknown>,
  ) {
    const referenceIdValue = data.referenceId ?? data.reference_id;
    if (typeof referenceIdValue !== 'string' || !referenceIdValue) {
      throw new Error('Webhook referenceId is required.');
    }
    const persistableFields = new Set([
      'referenceId',
      'reference_id',
      'status',
      'onchainStatus',
      'depositStatus',
      'fiatStatus',
      'chain',
      'token',
      'transactionHash',
      'receiverAddress',
      'recipientAddress',
      'senderAddress',
      'escrowAddress',
      'cryptoAmountReceived',
      'cryptoAmount',
      'fiatAmount',
      'refundTransactionHash',
      'refundAmount',
    ]);
    const payload = Object.fromEntries(
      Object.entries(data).filter(([key]) => persistableFields.has(key)),
    );
    payload.referenceId = referenceIdValue;

    await db.insert(selfCustodyRampWebhookEvents)
      .values({
        eventDigest,
        referenceId: referenceIdValue,
        event,
        payload,
      })
      .onConflictDoNothing({ target: selfCustodyRampWebhookEvents.eventDigest });

    const [stored] = await db.select({
      status: selfCustodyRampWebhookEvents.status,
    }).from(selfCustodyRampWebhookEvents)
      .where(eq(selfCustodyRampWebhookEvents.eventDigest, eventDigest))
      .limit(1);
    if (!stored) throw new Error('Could not persist the KotaniPay webhook event.');
    return stored;
  }

  static async markWebhookEventProcessed(eventDigest: string): Promise<void> {
    await db.update(selfCustodyRampWebhookEvents)
      .set({ status: 'processed', lastError: null, processedAt: new Date(), updatedAt: new Date() })
      .where(eq(selfCustodyRampWebhookEvents.eventDigest, eventDigest));
  }

  static async markWebhookEventFailed(eventDigest: string, error: string): Promise<void> {
    await db.update(selfCustodyRampWebhookEvents)
      .set({ status: 'failed', lastError: error.slice(0, 1000), updatedAt: new Date() })
      .where(eq(selfCustodyRampWebhookEvents.eventDigest, eventDigest));
  }

  static async claimWebhookEvent(eventDigest: string): Promise<boolean> {
    const [claimed] = await db.update(selfCustodyRampWebhookEvents)
      .set({
        status: 'processing',
        attempts: sql`${selfCustodyRampWebhookEvents.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(selfCustodyRampWebhookEvents.eventDigest, eventDigest),
        inArray(selfCustodyRampWebhookEvents.status, ['pending', 'failed']),
      ))
      .returning({ id: selfCustodyRampWebhookEvents.id });
    return Boolean(claimed);
  }

  static async processWebhookInbox(batchSize = 50): Promise<{ checked: number; processed: number; failed: number }> {
    const staleProcessingBefore = new Date(Date.now() - 5 * 60 * 1000);
    await db.update(selfCustodyRampWebhookEvents)
      .set({ status: 'failed', lastError: 'Recovered after interrupted webhook processing.', updatedAt: new Date() })
      .where(and(
        eq(selfCustodyRampWebhookEvents.status, 'processing'),
        lt(selfCustodyRampWebhookEvents.updatedAt, staleProcessingBefore),
      ));

    const retryBefore = new Date(Date.now() - 60_000);
    const events = await db.select().from(selfCustodyRampWebhookEvents)
      .where(or(
        eq(selfCustodyRampWebhookEvents.status, 'pending'),
        and(
          eq(selfCustodyRampWebhookEvents.status, 'failed'),
          lt(selfCustodyRampWebhookEvents.updatedAt, retryBefore),
        ),
      ))
      .orderBy(asc(selfCustodyRampWebhookEvents.receivedAt))
      .limit(batchSize);
    let processed = 0;
    let failed = 0;
    for (const inboxEvent of events) {
      if (!await this.claimWebhookEvent(inboxEvent.eventDigest)) continue;

      try {
        const result = await this.reconcileWebhook(getObject(inboxEvent.payload), inboxEvent.event);
        if (!result) throw new Error('No matching ramp transaction exists yet.');
        await this.markWebhookEventProcessed(inboxEvent.eventDigest);
        processed += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : 'Unknown webhook processing error';
        await this.markWebhookEventFailed(inboxEvent.eventDigest, message);
        logger.warn('KotaniPay webhook inbox event remains unprocessed', {
          referenceId: inboxEvent.referenceId,
          event: inboxEvent.event,
          error: message,
        });
      }
    }
    return { checked: events.length, processed, failed };
  }

  static async reconcileProviderStatuses(batchSize = 25): Promise<{ checked: number; reconciled: number; failed: number }> {
    const transactions = await this.listOpenTransactions();
    const pollableStatuses = new Set([
      'initiation_unknown',
      'pending',
      'processing',
      'reconciliation_required',
      'refund_pending',
    ]);
    let checked = 0;
    let reconciled = 0;
    let failed = 0;
    for (const transaction of transactions.filter((item) => pollableStatuses.has(item.status)).slice(0, batchSize)) {
      checked += 1;
      try {
        const statusData = await kotaniRequest(
          `/api/v3/${transaction.direction}/${encodeURIComponent(transaction.referenceId)}`,
          undefined,
          'GET',
        );
        const data = { ...statusData, referenceId: statusData.referenceId ?? transaction.referenceId };
        const result = await this.reconcileWebhook(data, `transaction.${transaction.direction}.status.updated`);
        if (result) reconciled += 1;
      } catch (error) {
        failed += 1;
        logger.warn('KotaniPay status reconciliation failed', {
          referenceId: transaction.referenceId,
          direction: transaction.direction,
          error: error instanceof Error ? error.message : 'Unknown reconciliation error',
        });
      }
    }
    return { checked, reconciled, failed };
  }

  static async recordOfframpTransaction(userId: string, referenceId: string, transactionHash: string) {
    const [transaction] = await db.select()
      .from(selfCustodyRampTransactions)
      .where(and(
        eq(selfCustodyRampTransactions.userId, userId),
        eq(selfCustodyRampTransactions.referenceId, referenceId),
      ))
      .limit(1);
    if (!transaction
      || transaction.direction !== 'offramp'
      || !['pending', 'processing', 'completed'].includes(transaction.status)) {
      throw new Error('Pending self-custody offramp not found.');
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash)) {
      throw new Error('Invalid Celo transaction hash.');
    }
    if (transaction.transactionHash && transaction.transactionHash !== transactionHash) {
      throw new Error('A different transaction hash is already recorded for this offramp.');
    }
    const [updated] = await db.update(selfCustodyRampTransactions)
      .set({ transactionHash, updatedAt: new Date() })
      .where(eq(selfCustodyRampTransactions.id, transaction.id))
      .returning({ referenceId: selfCustodyRampTransactions.referenceId });
    return updated;
  }

  static async reconcileWebhook(data: Record<string, unknown>, event: string) {
    const referenceId = typeof data.referenceId === 'string' ? data.referenceId : undefined;
    if (!referenceId) throw new Error('Webhook referenceId is required.');
    const [transaction] = await db.select()
      .from(selfCustodyRampTransactions)
      .where(eq(selfCustodyRampTransactions.referenceId, referenceId))
      .limit(1);
    if (!transaction) return null;
    if (event === 'refund.completed' || event === 'refund.failed') {
      return this.reconcileRefund(transaction, data, event);
    }
    if (transaction.direction === 'onramp' && !event.startsWith('transaction.onramp.')
      || transaction.direction === 'offramp' && !event.startsWith('transaction.offramp.')) {
      throw new Error('Webhook event direction does not match the stored ramp transaction.');
    }

    const upper = (value: unknown) => typeof value === 'string' ? value.toUpperCase() : '';
    const providerStatus = upper(data.status);
    const onchainStatus = upper(data.onchainStatus);
    const fiatStatus = upper(data.depositStatus ?? data.fiatStatus);
    const chain = upper(data.chain);
    const token = upper(data.token);
    const transactionHash = typeof data.transactionHash === 'string' ? data.transactionHash : undefined;
    const callbackWallet = transaction.direction === 'onramp' ? data.receiverAddress : data.senderAddress;
    const callbackAddress = transaction.direction === 'offramp' ? data.escrowAddress : undefined;

    if (typeof callbackWallet === 'string' && callbackWallet.toLowerCase() !== transaction.walletAddress.toLowerCase()) {
      throw new Error('Webhook wallet address does not match the stored ramp request.');
    }
    if (chain && chain !== transaction.chain || token && token !== transaction.token) {
      throw new Error('Webhook asset does not match the stored ramp request.');
    }
    if (transaction.direction === 'offramp'
      && typeof callbackAddress === 'string'
      && transaction.depositAddress
      && callbackAddress.toLowerCase() !== transaction.depositAddress.toLowerCase()) {
      throw new Error('Webhook escrow address does not match the stored offramp.');
    }
    if (transaction.direction === 'offramp'
      && transaction.transactionHash
      && transactionHash
      && transaction.transactionHash.toLowerCase() !== transactionHash.toLowerCase()) {
      throw new Error('Webhook transaction hash does not match the user-submitted hash.');
    }

    const failed = ['FAILED', 'REVERSED', 'CANCELLED'].includes(providerStatus);
    const settledCryptoValue = transaction.direction === 'onramp' ? data.cryptoAmountReceived : data.cryptoAmount;
    const settledCryptoAmount = settledCryptoValue == null ? undefined : readPositiveNumber(settledCryptoValue, 'settled crypto amount');
    const settledFiatAmount = data.fiatAmount == null ? undefined : readPositiveNumber(data.fiatAmount, 'settled fiat amount');
    const amountRequirementsMet = transaction.direction === 'onramp'
      ? settledCryptoAmount !== undefined
        && new Decimal(settledCryptoAmount).gte(transaction.cryptoAmount)
        && settledFiatAmount !== undefined
        && new Decimal(settledFiatAmount).eq(transaction.fiatAmount)
      : settledCryptoAmount !== undefined
        && new Decimal(settledCryptoAmount).eq(transaction.cryptoAmount)
        && settledFiatAmount !== undefined
        && new Decimal(settledFiatAmount).gte(transaction.fiatAmount);
    const identitiesVerified = typeof callbackWallet === 'string'
      && callbackWallet.toLowerCase() === transaction.walletAddress.toLowerCase()
      && chain === transaction.chain
      && token === transaction.token
      && (transaction.direction === 'onramp'
        || typeof callbackAddress === 'string'
          && Boolean(transaction.depositAddress)
          && callbackAddress.toLowerCase() === transaction.depositAddress!.toLowerCase());
    const fullySettled = providerStatus === 'SUCCESSFUL'
      && onchainStatus === 'SUCCESSFUL'
      && (transaction.direction === 'onramp' ? fiatStatus === 'SUCCESSFUL' : true)
      && identitiesVerified
      && amountRequirementsMet
      && Boolean(transactionHash && /^0x[a-fA-F0-9]{64}$/.test(transactionHash));
    const settlementReported = providerStatus === 'SUCCESSFUL' && onchainStatus === 'SUCCESSFUL';
    const status = fullySettled
      ? 'completed'
      : failed
        ? transaction.direction === 'offramp'
          && (onchainStatus === 'SUCCESSFUL' || Boolean(transaction.transactionHash))
          ? 'refund_pending'
          : 'failed'
        : settlementReported
          ? 'reconciliation_required'
          : 'processing';
    if (transaction.status === 'completed') {
      return { referenceId: transaction.referenceId, status: transaction.status };
    }
    if (['failed', 'refunded', 'refund_failed'].includes(transaction.status)) {
      return { referenceId: transaction.referenceId, status: transaction.status };
    }
    if (['reconciliation_required', 'refund_pending'].includes(transaction.status) && status === 'processing') {
      return { referenceId: transaction.referenceId, status: transaction.status };
    }

    const [updated] = await db.update(selfCustodyRampTransactions)
      .set({
        status,
        onchainStatus: typeof data.onchainStatus === 'string' ? data.onchainStatus : transaction.onchainStatus,
        fiatStatus: typeof (data.depositStatus ?? data.fiatStatus) === 'string'
          ? String(data.depositStatus ?? data.fiatStatus)
          : transaction.fiatStatus,
        transactionHash: transactionHash ?? transaction.transactionHash,
        providerEvent: event,
        cryptoAmountSettled: settledCryptoAmount ?? transaction.cryptoAmountSettled,
        fiatAmountSettled: settledFiatAmount ?? transaction.fiatAmountSettled,
        providerMetadata: {
          ...getObject(transaction.providerMetadata),
          lastWebhook: {
            status: data.status,
            depositStatus: data.depositStatus,
            fiatStatus: data.fiatStatus,
            onchainStatus: data.onchainStatus,
            chain: data.chain,
            token: data.token,
          },
        },
        updatedAt: new Date(),
        completedAt: fullySettled ? new Date() : transaction.completedAt,
      })
      .where(eq(selfCustodyRampTransactions.id, transaction.id))
      .returning({ referenceId: selfCustodyRampTransactions.referenceId, status: selfCustodyRampTransactions.status });
    return updated;
  }

  private static async reconcileRefund(
    transaction: typeof selfCustodyRampTransactions.$inferSelect,
    data: Record<string, unknown>,
    event: 'refund.completed' | 'refund.failed',
  ) {
    if (transaction.direction !== 'offramp') {
      throw new Error('Refund event does not match an offramp transaction.');
    }
    if (transaction.status === 'completed') {
      throw new Error('A completed offramp cannot be marked as refunded.');
    }
    if (transaction.status === 'refunded') {
      return { referenceId: transaction.referenceId, status: transaction.status };
    }
    if (event === 'refund.failed') {
      const [updated] = await db.update(selfCustodyRampTransactions)
        .set({ status: 'refund_failed', providerEvent: event, updatedAt: new Date() })
        .where(eq(selfCustodyRampTransactions.id, transaction.id))
        .returning({ referenceId: selfCustodyRampTransactions.referenceId, status: selfCustodyRampTransactions.status });
      return updated;
    }

    const refundRecipient = data.receiverAddress ?? data.recipientAddress ?? data.senderAddress;
    const refundHash = data.refundTransactionHash ?? data.transactionHash;
    const refundAmount = data.refundAmount ?? data.cryptoAmount;
    if (typeof refundRecipient !== 'string'
      || refundRecipient.toLowerCase() !== transaction.walletAddress.toLowerCase()) {
      throw new Error('Refund recipient does not match the user wallet.');
    }
    if (typeof data.chain !== 'string' || data.chain.toUpperCase() !== transaction.chain
      || typeof data.token !== 'string' || data.token.toUpperCase() !== transaction.token) {
      throw new Error('Refund asset does not match the offramp asset.');
    }
    if (typeof refundHash !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(refundHash)) {
      throw new Error('Refund event is missing its on-chain transaction hash.');
    }
    if (refundAmount == null
      || !new Decimal(readPositiveNumber(refundAmount, 'refund amount')).eq(transaction.cryptoAmount)) {
      throw new Error('Refund amount does not match the original cUSD amount.');
    }
    const [updated] = await db.update(selfCustodyRampTransactions)
      .set({
        status: 'refunded',
        refundTransactionHash: refundHash,
        providerEvent: event,
        updatedAt: new Date(),
      })
      .where(eq(selfCustodyRampTransactions.id, transaction.id))
      .returning({ referenceId: selfCustodyRampTransactions.referenceId, status: selfCustodyRampTransactions.status });
    return updated;
  }

  static verifyWebhookSignature(
    rawBody: Buffer,
    signature: string | undefined,
    secret = WEBHOOK_SECRET,
    signedBody?: Buffer,
  ): boolean {
    if (!secret || !signature) return false;
    const supplied = signature.replace(/^sha256=/i, '').trim();
    if (!/^[a-fA-F0-9]{64}$/.test(supplied)) return false;
    const expected = createHmac('sha256', secret).update(signedBody ?? rawBody).digest();
    const actual = Buffer.from(supplied, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  static getWebhookSignedBody(rawBody: Buffer): Buffer {
    try {
      const parsed: unknown = JSON.parse(rawBody.toString('utf8'));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)
        || !Object.prototype.hasOwnProperty.call(parsed, 'signature')) {
        return rawBody;
      }
      const signedPayload = { ...parsed as Record<string, unknown> };
      delete signedPayload.signature;
      return Buffer.from(JSON.stringify(signedPayload));
    } catch {
      return rawBody;
    }
  }

  private static async validateCommon(request: RampQuoteRequest): Promise<void> {
    if (!request.userId || !/^\+?[1-9]\d{7,14}$/.test(request.phoneNumber)) {
      throw new Error('Valid user and international phone number are required.');
    }
    if (!ADDRESS_PATTERN.test(request.walletAddress)) throw new Error('A valid EVM wallet address is required.');
    await this.requireOwnedActiveWallet(request.userId, request.walletAddress);
  }

  private static async requireOwnedActiveWallet(userId: string, walletAddress: string): Promise<void> {
    const wallet = await db.query.wallets.findFirst({
      where: and(
        eq(wallets.userId, userId),
        eq(wallets.isActive, true),
        sql`lower(${wallets.address}) = ${walletAddress.toLowerCase()}`,
      ),
      columns: { address: true },
    });
    if (!wallet) {
      throw new RampServiceError(
        'RAMP_WALLET_NOT_VERIFIED',
        'Register and verify this active wallet on your account before requesting a self-custody ramp.',
        403,
      );
    }
  }
}
