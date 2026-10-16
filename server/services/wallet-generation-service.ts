/**
 * Wallet Generation Service (Production)
 *
 * Non-custodial by design:
 * • Server never persists mnemonic or private key
 * • Primary path: registerClientGeneratedWallet + ownership signature
 * • Legacy path: createUserWallet returns mnemonic once (feature-flagged)
 * • No server-side signing (getDecryptedPrivateKey throws)
 *
 * DB writes are transactional. List/update helpers match /v1/wallets router.
 */

import { randomBytes } from 'crypto';
import { v4 as uuid } from 'uuid';
import { and, eq, desc, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  wallets,
  walletPublicKeys,
  walletSecuritySettings,
  users,
} from '@shared/schema';
import { logger } from '../utils/logger';
import { redisService } from './redis';

// ─────────────────────────────────────────────────────────────
// Config / errors
// ─────────────────────────────────────────────────────────────

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/** Server-side mnemonic generation is never enabled in production. */
function allowServerMnemonic(): boolean {
  if (isProduction()) return false;
  return process.env.ALLOW_SERVER_WALLET_MNEMONIC !== 'false';
}

export class WalletError extends Error {
  constructor(
    message: string,
    public code:
      | 'USER_NOT_FOUND'
      | 'WALLET_EXISTS'
      | 'WALLET_NOT_FOUND'
      | 'INVALID_ADDRESS'
      | 'INVALID_SIGNATURE'
      | 'GENERATION_FAILED'
      | 'FORBIDDEN'
      | 'NOT_IMPLEMENTED'
      | 'CHALLENGE_INVALID',
    public status = 400
  ) {
    super(message);
    this.name = 'WalletError';
  }
}

export type WalletType = 'personal' | 'dao' | 'treasury' | 'smart_contract';

export interface CreateWalletOptions {
  masterPassword?: string; // ignored server-side (client encryption only)
  label?: string;
}

export interface ListWalletsOptions {
  limit?: number;
  offset?: number;
  includeInactive?: boolean;
}

export interface UpdateWalletPatch {
  label?: string;
  currency?: string;
  walletType?: WalletType;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const CHALLENGE_TTL_SECONDS = CHALLENGE_TTL_MS / 1000;
const OWNERSHIP_CHALLENGE_PREFIX = 'otp:wallet-ownership-challenge:';
const OWNERSHIP_CHALLENGE_USED_PREFIX = 'otp:wallet-ownership-challenge-used:';

// ─────────────────────────────────────────────────────────────
// Crypto helpers
// ─────────────────────────────────────────────────────────────

export function generateRandomAddress(): string {
  return '0x' + randomBytes(20).toString('hex');
}

export async function generateMnemonicWallet(): Promise<{
  address: string;
  publicKey: string;
  mnemonic: string;
}> {
  try {
    const ethers = await import('ethers');
    const wallet = ethers.Wallet.createRandom();
    const mnemonic = wallet.mnemonic?.phrase;
    if (!mnemonic) {
      throw new Error('Failed to generate mnemonic');
    }
    return {
      address: wallet.address,
      publicKey: wallet.publicKey,
      mnemonic,
    };
  } catch (error) {
    if (isProduction()) {
      throw new WalletError(
        `Wallet generation failed: ${(error as Error).message}; no fallback is permitted in production`,
        'GENERATION_FAILED',
        500
      );
    }
    logger.warn(
      '[DEV ONLY] ethers unavailable — non-cryptographic placeholder wallet'
    );
    return {
      address: generateRandomAddress(),
      publicKey: '0x' + randomBytes(33).toString('hex'),
      mnemonic: randomBytes(32).toString('hex'),
    };
  }
}

function assertAddress(address: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new WalletError('Invalid address format', 'INVALID_ADDRESS');
  }
  return '0x' + address.slice(2);
}

function normalizeAddress(address: string): string {
  return assertAddress(address).toLowerCase();
}

// ─────────────────────────────────────────────────────────────
// Ownership challenge (register path)
// ─────────────────────────────────────────────────────────────

/**
 * Issue a one-time message the client must sign with the wallet key.
 */
export async function createOwnershipChallenge(
  userId: string,
  address: string
): Promise<{ challengeId: string; message: string; expiresAt: string }> {
  const addr = assertAddress(address);
  const challengeId = uuid();
  const nonce = randomBytes(16).toString('hex');
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  const message =
    `MtaaDAO wallet registration\n` +
    `User: ${userId}\n` +
    `Address: ${addr}\n` +
    `Nonce: ${nonce}\n` +
    `Issued: ${new Date().toISOString()}`;

  await redisService.set(`${OWNERSHIP_CHALLENGE_PREFIX}${challengeId}`, {
    message,
    address: normalizeAddress(addr),
    userId,
    exp: expiresAt,
  }, CHALLENGE_TTL_SECONDS);

  return {
    challengeId,
    message,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

async function consumeChallenge(
  challengeId: string,
  userId: string,
  address: string
): Promise<string> {
  const key = `${OWNERSHIP_CHALLENGE_PREFIX}${challengeId}`;
  const used = await redisService.setnx(
    `${OWNERSHIP_CHALLENGE_USED_PREFIX}${challengeId}`,
    '1',
    CHALLENGE_TTL_SECONDS
  );
  if (!used) {
    throw new WalletError('Challenge has already been used', 'CHALLENGE_INVALID');
  }

  const row = await redisService.get<{
    message: string;
    address: string;
    userId: string;
    exp: number;
  }>(key);
  await redisService.delete(key);
  if (!row || row.exp < Date.now()) {
    throw new WalletError('Challenge expired or unknown', 'CHALLENGE_INVALID');
  }
  if (row.userId !== userId) {
    throw new WalletError('Challenge user mismatch', 'CHALLENGE_INVALID');
  }
  if (row.address !== normalizeAddress(address)) {
    throw new WalletError('Challenge address mismatch', 'CHALLENGE_INVALID');
  }
  return row.message;
}

async function verifyOwnershipSignature(
  message: string,
  signature: string,
  expectedAddress: string
): Promise<void> {
  try {
    const { verifyMessage } = await import('ethers');
    const recovered = verifyMessage(message, signature);
    if (normalizeAddress(recovered) !== normalizeAddress(expectedAddress)) {
      throw new WalletError(
        'Signature does not match address',
        'INVALID_SIGNATURE',
        403
      );
    }
  } catch (e) {
    if (e instanceof WalletError) throw e;
    throw new WalletError('Invalid signature', 'INVALID_SIGNATURE', 403);
  }
}

// ─────────────────────────────────────────────────────────────
// Internal persistence
// ─────────────────────────────────────────────────────────────

async function assertUserExists(userId: string) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new WalletError(`User ${userId} not found`, 'USER_NOT_FOUND', 404);
  }
}

async function assertNoDuplicate(
  userId: string,
  currency: string,
  walletType: string,
  executor: any = db
) {
  const [existing] = await executor
    .select({ id: wallets.id })
    .from(wallets)
    .where(
      and(
        eq(wallets.userId, userId),
        eq(wallets.currency, currency),
        eq(wallets.walletType, walletType),
        eq(wallets.isActive, true)
      )
    )
    .limit(1);

  if (existing) {
    throw new WalletError(
      `User already has an active ${currency} ${walletType} wallet`,
      'WALLET_EXISTS',
      409
    );
  }
}

async function insertWalletBundle(
  executor: any,
  input: {
    walletId: string;
    userId: string;
    currency: string;
    address: string;
    walletType: string;
    publicKey?: string | null;
    label?: string;
  }
) {
  const now = new Date();

  await executor.insert(wallets).values({
    id: input.walletId,
    userId: input.userId,
    currency: input.currency,
    address: input.address,
    walletType: input.walletType,
    isActive: true,
    label: input.label ?? null,
    createdAt: now,
    updatedAt: now,
  } as any);

  if (input.publicKey) {
    await executor.insert(walletPublicKeys).values({
      id: uuid(),
      walletId: input.walletId,
      publicKey: input.publicKey,
      publicKeyFormat: 'ethers',
      createdAt: now,
      updatedAt: now,
    });
  }

  await executor.insert(walletSecuritySettings).values({
    id: uuid(),
    walletId: input.walletId,
    requiresPin: true,
    requiresBiometric: false,
    twoFactorEnabled: false,
    createdAt: now,
    updatedAt: now,
  });
}

function toPublicWallet(wallet: any, publicKey?: string | null) {
  return {
    id: wallet.id,
    address: wallet.address,
    currency: wallet.currency,
    walletType: wallet.walletType,
    isActive: wallet.isActive,
    label: wallet.label ?? null,
    publicKey: publicKey ?? null,
    createdAt: wallet.createdAt,
    updatedAt: wallet.updatedAt,
  };
}

// ─────────────────────────────────────────────────────────────
// Create (server mnemonic — legacy / gated)
// ─────────────────────────────────────────────────────────────

/**
 * Server generates mnemonic and returns it ONCE.
 * Prefer registerClientGeneratedWallet in production.
 * Never log the return value.
 */
export async function createUserWallet(
  userId: string,
  currency: string = 'USDC',
  walletType: string = 'personal',
  options: CreateWalletOptions = {}
) {
  if (!allowServerMnemonic()) {
    throw new WalletError(
      'Server-side mnemonic generation is disabled. Generate keys on device and call registerClientGeneratedWallet.',
      'FORBIDDEN',
      403
    );
  }

  await assertUserExists(userId);
  const cur = currency.toUpperCase();

  const walletData = await generateMnemonicWallet();
  const walletId = uuid();

  await db.transaction(async (tx) => {
    await assertNoDuplicate(userId, cur, walletType, tx);
    await insertWalletBundle(tx, {
      walletId,
      userId,
      currency: cur,
      address: walletData.address,
      walletType,
      publicKey: walletData.publicKey,
      label: options.label,
    });
  });

  logger.info('Wallet created (server mnemonic path)', {
    userId,
    walletId,
    currency: cur,
    walletType,
    // never log mnemonic
  });

  return {
    walletId,
    address: walletData.address,
    publicKey: walletData.publicKey,
    currency: cur,
    walletType,
    label: options.label ?? null,
    /** @sensitive one-time — do not log or cache */
    mnemonic: walletData.mnemonic,
    message:
      'Wallet created — save your recovery phrase now; it cannot be shown again',
  };
}

// ─────────────────────────────────────────────────────────────
// Register client-generated (primary)
// ─────────────────────────────────────────────────────────────

export async function registerClientGeneratedWallet(
  userId: string,
  address: string,
  currency: string = 'USDC',
  walletType: string = 'personal',
  opts?: {
    challengeId: string;
    signature: string;
    publicKey?: string;
    label?: string;
  }
) {
  await assertUserExists(userId);
  const addr = assertAddress(address);
  const cur = currency.toUpperCase();

  if (!opts?.challengeId || !opts?.signature) {
    throw new WalletError(
      'challengeId and signature are required to prove address ownership',
      'INVALID_SIGNATURE',
      400
    );
  }

  const message = await consumeChallenge(opts.challengeId, userId, addr);
  await verifyOwnershipSignature(message, opts.signature, addr);

  const walletId = uuid();

  await db.transaction(async (tx) => {
    await assertNoDuplicate(userId, cur, walletType, tx);

    // Optional: reject if address already linked to another user
    const [addrTaken] = await tx
      .select({ id: wallets.id, userId: wallets.userId })
      .from(wallets)
      .where(sql`lower(${wallets.address}) = ${normalizeAddress(addr)}`)
      .limit(1);
    if (addrTaken && addrTaken.userId !== userId) {
      throw new WalletError(
        'Address already registered',
        'WALLET_EXISTS',
        409
      );
    }

    await insertWalletBundle(tx, {
      walletId,
      userId,
      currency: cur,
      address: addr,
      walletType,
      publicKey: opts.publicKey ?? null,
      label: opts.label,
    }).catch((error: unknown) => {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new WalletError('Wallet address or active wallet already registered', 'WALLET_EXISTS', 409);
      }
      throw error;
    });
  });

  logger.info('Wallet registered (client-generated)', {
    userId,
    walletId,
    currency: cur,
    walletType,
  });

  return {
    walletId,
    address: addr,
    currency: cur,
    walletType,
    label: opts.label ?? null,
    message:
      'Wallet registered — back up your keys on device; server has no recovery copy',
  };
}

// ─────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────

export async function getUserWallet(userId: string, walletId?: string) {
  if (walletId) {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, walletId))
      .limit(1);

    if (!wallet || wallet.userId !== userId) {
      throw new WalletError('Wallet not found', 'WALLET_NOT_FOUND', 404);
    }

    const [pk] = await db
      .select()
      .from(walletPublicKeys)
      .where(eq(walletPublicKeys.walletId, wallet.id))
      .limit(1);

    return toPublicWallet(wallet, pk?.publicKey);
  }

  // Legacy single-wallet helper — prefer getUserWallets
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.isActive, true)))
    .orderBy(desc(wallets.createdAt))
    .limit(1);

  if (!wallet) {
    throw new WalletError('Wallet not found', 'WALLET_NOT_FOUND', 404);
  }

  const [pk] = await db
    .select()
    .from(walletPublicKeys)
    .where(eq(walletPublicKeys.walletId, wallet.id))
    .limit(1);

  return toPublicWallet(wallet, pk?.publicKey);
}

export async function getUserWallets(
  userId: string,
  options: ListWalletsOptions = {}
) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  const conditions = [eq(wallets.userId, userId)];
  if (!options.includeInactive) {
    conditions.push(eq(wallets.isActive, true));
  }

  const rows = await db
    .select()
    .from(wallets)
    .where(and(...conditions))
    .orderBy(desc(wallets.createdAt))
    .limit(limit)
    .offset(offset);

  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const pks = await db
    .select()
    .from(walletPublicKeys)
    .where(inArray(walletPublicKeys.walletId, ids));

  const pkMap = new Map(pks.map((p) => [p.walletId, p.publicKey]));

  return rows.map((w) => toPublicWallet(w, pkMap.get(w.id) ?? null));
}

// ─────────────────────────────────────────────────────────────
// Update / deactivate
// ─────────────────────────────────────────────────────────────

export async function updateWallet(
  userId: string,
  walletId: string,
  patch: UpdateWalletPatch
) {
  const updated = await db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.id, walletId))
      .limit(1);

    if (!wallet || wallet.userId !== userId) {
      throw new WalletError('Wallet not found', 'WALLET_NOT_FOUND', 404);
    }

    const next: Partial<typeof wallets.$inferInsert> = { updatedAt: new Date() };
    if (patch.label !== undefined) next.label = patch.label;
    if (patch.currency !== undefined) next.currency = patch.currency.toUpperCase();
    if (patch.walletType !== undefined) next.walletType = patch.walletType;

    const newCurrency = next.currency ?? wallet.currency;
    const newType = next.walletType ?? wallet.walletType ?? 'personal';
    if (newCurrency !== wallet.currency || newType !== wallet.walletType) {
      const [duplicate] = await tx
        .select({ id: wallets.id })
        .from(wallets)
        .where(and(
          eq(wallets.userId, userId),
          eq(wallets.currency, newCurrency),
          eq(wallets.walletType, newType),
          eq(wallets.isActive, true),
          sql`${wallets.id} <> ${walletId}`
        ))
        .limit(1);
      if (duplicate) {
        throw new WalletError(
          `User already has an active ${newCurrency} ${newType} wallet`,
          'WALLET_EXISTS',
          409
        );
      }
    }

    const [result] = await tx
      .update(wallets)
      .set(next)
      .where(eq(wallets.id, walletId))
      .returning();
    return result;
  }).catch((error: unknown) => {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505'
    ) {
      throw new WalletError('Wallet address or active wallet already registered', 'WALLET_EXISTS', 409);
    }
    throw error;
  });

  logger.info('Wallet updated', { userId, walletId, fields: Object.keys(patch) });
  return toPublicWallet(updated);
}

export async function deactivateWallet(userId: string, walletId: string) {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.id, walletId))
    .limit(1);

  if (!wallet || wallet.userId !== userId) {
    throw new WalletError('Wallet not found', 'WALLET_NOT_FOUND', 404);
  }

  await db
    .update(wallets)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(wallets.id, walletId));

  // Cancel would-be marketplace listings etc. can hook here

  logger.info('Wallet deactivated', { userId, walletId });
  return { id: walletId, isActive: false, message: 'Wallet deactivated successfully' };
}

export async function verifyWalletExists(
  userId: string,
  walletId: string
): Promise<boolean> {
  const [wallet] = await db
    .select({ id: wallets.id, userId: wallets.userId, isActive: wallets.isActive })
    .from(wallets)
    .where(eq(wallets.id, walletId))
    .limit(1);
  return !!(wallet && wallet.userId === userId && wallet.isActive);
}

/**
 * Removed: server holds no keys.
 */
export async function getDecryptedPrivateKey(
  _userId: string,
  _walletId: string
): Promise<never> {
  throw new WalletError(
    'getDecryptedPrivateKey removed: keys are not stored server-side. Sign client-side or via WalletConnect.',
    'NOT_IMPLEMENTED',
    501
  );
}

// ─────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────

export const walletGenerationService = {
  createUserWallet,
  registerClientGeneratedWallet,
  createOwnershipChallenge,
  getUserWallet,
  getUserWallets,
  updateWallet,
  getDecryptedPrivateKey,
  verifyWalletExists,
  deactivateWallet,
  generateMnemonicWallet,
  generateRandomAddress,
};