/**
 * Wallet Generation Service
 *
 * ARCHITECTURE CHANGE FROM PREVIOUS VERSION: this service no longer stores
 * the mnemonic or private key server-side in ANY form — not encrypted, not
 * anywhere.
 *
 * What changed and why:
 *
 * 1. REMOVED: inserts into walletPrivateKeys and walletSeedPhrases. The
 *    previous version encrypted the mnemonic with a caller-supplied
 *    masterPassword (or, if that were ever missing entirely rather than an
 *    empty string, would have fallen back to a server-wide WALLET_MASTER_SECRET
 *    env var — which would have made this secretly custodial, contradicting
 *    the "keys never stored by MtaaDAO" copy already in WalletSetup.tsx). As
 *    actually called from the frontend (password: '' — an empty string, not
 *    undefined), deriveEncryptionKey's `!secret` check throws immediately,
 *    so wallet creation currently fails 100% of the time as wired. Removing
 *    server-side key storage entirely sidesteps that whole bug class rather
 *    than patching the secret-handling logic.
 *
 * 2. The mnemonic is now returned in the response from createUserWallet(),
 *    exactly once, and is never written to any table. This is the ONLY
 *    moment it will ever exist outside the user's own device. The caller
 *    (the API route) must:
 *      - never log this response
 *      - never cache it
 *      - deliver it directly to the client that made the authenticated request
 *    WalletSetup.tsx's seed-phrase modal already expects `data.data.mnemonic`
 *    in the response — previously that field was never populated (the old
 *    version discarded the mnemonic after encrypting it), so the modal always
 *    silently fell back to an empty string. That's fixed by this change too.
 *
 * 3. CONSEQUENCE THAT MATTERS FOR THE REST OF THE SYSTEM: since the server
 *    never holds the key, it also can never sign anything on the user's
 *    behalf. Any future on-chain transaction (P2P sends, withdrawals, etc.)
 *    MUST be signed either by a client-side keystore (browser/mobile,
 *    encrypted-at-rest on device, never transmitted) or delegated to an
 *    external signer like Valora/MiniPay via WalletConnect. This was already
 *    an open question from earlier in this build — this decision makes it a
 *    hard requirement rather than a nice-to-have, since there is now no
 *    fallback path where the server signs anything.
 *
 * 4. getDecryptedPrivateKey() is removed rather than left as dead code that
 *    fails confusingly — it now throws a clear, explicit error explaining why,
 *    so any caller still referencing it fails loudly and immediately.
 *
 * 5. walletPrivateKeys / walletSeedPhrases DB tables: this file no longer
 *    writes to them. I have NOT dropped them or altered the schema — that's
 *    a migration decision that needs a check across the rest of the codebase
 *    for any other reader/writer of those tables before removing them. Safe
 *    to leave unused for now; flag for cleanup once confirmed nothing else
 *    depends on them.
 *
 * 6. Dev-only fallback (non-ethers address generation) now hard-throws in
 *    production instead of silently returning an unrecoverable fake wallet
 *    that reports success. Previously this could fire on ANY exception from
 *    the ethers import, not just "package missing" — meaning a transient
 *    failure in production could silently hand a user an address with no
 *    real keypair behind it, with no error surfaced.
 */

import { randomBytes } from 'crypto';
import { v4 as uuid } from 'uuid';
import { db } from '../db';
import {
  wallets,
  walletPublicKeys,
  walletSecuritySettings,
  users,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Generate random wallet address — DEV/TEST ONLY. Never used in production;
 * see generateMnemonicWallet() below, which now enforces this explicitly.
 */
export function generateRandomAddress(): string {
  const bytes = randomBytes(20);
  return '0x' + bytes.toString('hex');
}

/**
 * Generate a real BIP39 mnemonic-based wallet via ethers.js.
 *
 * In production this NO LONGER falls back to fake random data on failure.
 * If ethers fails to generate a real wallet in production, that's a hard
 * stop — better to fail the request loudly than hand a user an address with
 * no real private key behind it while reporting success.
 */
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
      // Hard fail. Do not hand out an address with no real keypair behind it.
      throw new Error(
        `Wallet generation failed and no fallback is permitted in production: ${(error as Error).message}`
      );
    }

    console.warn('[DEV ONLY] ethers.js unavailable — using non-cryptographic placeholder wallet. This must never happen in production.');
    return {
      address: generateRandomAddress(),
      publicKey: '0x' + randomBytes(33).toString('hex'),
      mnemonic: randomBytes(32).toString('hex'), // NOT a valid BIP39 mnemonic — dev placeholder only
    };
  }
}

/**
 * Create a new wallet for a user. Persists ONLY non-sensitive metadata
 * (address, public key, currency, wallet type). The mnemonic is returned
 * once and never written to the database.
 */
export async function createUserWallet(
  userId: string,
  currency: string = 'USDC',
  walletType: string = 'personal'
) {
  try {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user[0]) {
      throw new Error(`User ${userId} not found`);
    }

    // Scoped by currency + walletType, not just userId — a user can hold more
    // than one wallet (e.g. one per currency), matching how WalletSetup.tsx's
    // multi-asset-vault flow already expects to work.
    const existingWallet = await db
      .select()
      .from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.currency, currency), eq(wallets.walletType, walletType)))
      .limit(1);

    if (existingWallet[0]) {
      throw new Error(`User ${userId} already has a ${currency} ${walletType} wallet`);
    }

    const walletData = await generateMnemonicWallet();
    const walletId = uuid();

    await db.insert(wallets).values({
      id: walletId,
      userId,
      currency,
      address: walletData.address,
      walletType,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(walletPublicKeys).values({
      id: uuid(),
      walletId,
      publicKey: walletData.publicKey,
      publicKeyFormat: 'uncompressed',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // App-level access gating (PIN/biometric before the CLIENT allows signing
    // with its locally-held key). Nothing sensitive stored here — just policy.
    await db.insert(walletSecuritySettings).values({
      id: uuid(),
      walletId,
      requiresPin: true,
      requiresBiometric: false,
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      walletId,
      address: walletData.address,
      publicKey: walletData.publicKey,
      currency,
      walletType,
      // ⚠️ ONLY EXISTS HERE. Not persisted anywhere. Caller must deliver this
      // directly to the authenticated client and must not log or cache it.
      mnemonic: walletData.mnemonic,
      message: 'Wallet created successfully — save your recovery phrase now, it cannot be shown again',
    };
  } catch (error) {
    throw new Error(`Failed to create wallet: ${(error as Error).message}`);
  }
}

/**
 * Get user's wallet metadata (no key material — there is none to fetch).
 */
export async function getUserWallet(userId: string, walletId?: string) {
  try {
    let wallet;

    if (walletId) {
      const result = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
      wallet = result[0];
    } else {
      const result = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
      wallet = result[0];
    }

    if (!wallet || wallet.userId !== userId) {
      throw new Error('Wallet not found');
    }

    const publicKeyRecord = await db
      .select()
      .from(walletPublicKeys)
      .where(eq(walletPublicKeys.walletId, wallet.id))
      .limit(1);

    return {
      id: wallet.id,
      address: wallet.address,
      currency: wallet.currency,
      walletType: wallet.walletType,
      isActive: wallet.isActive,
      publicKey: publicKeyRecord[0]?.publicKey || null,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  } catch (error) {
    throw new Error(`Failed to get wallet: ${(error as Error).message}`);
  }
}

/**
 * ⚠️ REMOVED. There is no server-held private key to decrypt — that's the
 * whole point of this rewrite. Any caller still hitting this needs to be
 * updated to use client-side signing (local keystore) or a WalletConnect-
 * delegated signer (Valora/MiniPay) instead. Throws explicitly rather than
 * silently disappearing, so any remaining caller fails loudly and immediately
 * instead of getting a confusing "not a function" error.
 */
export async function getDecryptedPrivateKey(_userId: string, _walletId: string): Promise<never> {
  throw new Error(
    'getDecryptedPrivateKey has been removed: this service no longer stores private keys or mnemonics server-side. ' +
    'Signing must happen client-side or via a delegated external signer (WalletConnect/Valora/MiniPay).'
  );
}

export async function verifyWalletExists(userId: string, walletId: string): Promise<boolean> {
  const result = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
  const wallet = result[0];
  return !!(wallet && wallet.userId === userId && wallet.isActive);
}

export async function deactivateWallet(userId: string, walletId: string) {
  try {
    const wallet = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);

    if (!wallet[0] || wallet[0].userId !== userId) {
      throw new Error('Wallet not found');
    }

    await db
      .update(wallets)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(wallets.id, walletId));

    return { message: 'Wallet deactivated successfully' };
  } catch (error) {
    throw new Error(`Failed to deactivate wallet: ${(error as Error).message}`);
  }
}

/**
 * Register a wallet whose keypair was generated CLIENT-SIDE (the hybrid
 * split-vault model). The server never sees a mnemonic or private key here —
 * only the resulting address. This is now the primary creation path;
 * createUserWallet() above (server-side generation) is kept only as a
 * fallback for contexts with no client to generate a key at all (if you
 * have none, consider removing createUserWallet entirely rather than
 * maintaining two creation paths with different trust models).
 */
export async function registerClientGeneratedWallet(
  userId: string,
  address: string,
  currency: string = 'USDC',
  walletType: string = 'personal'
) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error('Invalid address format');
  }

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]) {
    throw new Error(`User ${userId} not found`);
  }

  const existingWallet = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.currency, currency), eq(wallets.walletType, walletType)))
    .limit(1);

  if (existingWallet[0]) {
    throw new Error(`User ${userId} already has a ${currency} ${walletType} wallet`);
  }

  const walletId = uuid();

  await db.insert(wallets).values({
    id: walletId,
    userId,
    currency,
    address,
    walletType,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(walletSecuritySettings).values({
    id: uuid(),
    walletId,
    requiresPin: true,
    requiresBiometric: false,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    walletId,
    address,
    currency,
    walletType,
    message: 'Wallet registered — back it up via /api/v1/wallets/vault/backup before relying on it',
  };
}

export const walletGenerationService = {
  createUserWallet, // server-side generation — legacy/fallback path, see note above
  registerClientGeneratedWallet, // primary path for the hybrid model
  getUserWallet,
  getDecryptedPrivateKey, // now throws — see note above
  verifyWalletExists,
  deactivateWallet,
  generateMnemonicWallet,
  generateRandomAddress,
}