/**
 * Wallet Vault Service — blind encrypted backup storage.
 *
 * HARD RULE FOR THIS FILE: nothing in here ever imports a decryption
 * function, ever handles a passphrase, or ever attempts to read the
 * plaintext content of encryptedBlob. If a future change to this file needs
 * to do any of those things, that change breaks the entire non-custodial
 * argument and should not happen here.
 *
 * What this file DOES do: validate that a submitted blob is structurally a
 * well-formed Web3 Secret Storage keystore (shape only — presence and type
 * of expected fields), store it, return it to its owner, and log every
 * access. That's the whole job.
 */

import { v4 as uuid } from 'uuid';
import { db } from '../db';
import { wallets } from '@shared/schema';
import { walletVaultBackups, walletVaultAccessLogs } from '@shared/walletVaultSchema';
import { eq, and } from 'drizzle-orm';

/**
 * Structural validation of a Web3 Secret Storage JSON keystore (EIP-2335 /
 * standard ethers.Wallet.encrypt() output shape). This checks SHAPE ONLY —
 * it cannot and does not verify the ciphertext is valid or decryptable with
 * any particular passphrase. Its only job is to reject obvious garbage
 * before it's persisted, so a corrupted or malformed backup is caught at
 * write time rather than discovered during an actual recovery attempt.
 */
export function isStructurallyValidKeystore(blob: unknown): blob is {
  version: number;
  id: string;
  address: string;
  crypto: {
    ciphertext: string;
    cipherparams: Record<string, unknown>;
    cipher: string;
    kdf: string;
    kdfparams: Record<string, unknown>;
    mac: string;
  };
} {
  if (typeof blob !== 'object' || blob === null) return false;
  const b = blob as any;

  if (typeof b.version !== 'number') return false;
  if (typeof b.id !== 'string') return false;
  if (typeof b.address !== 'string' || !/^[0-9a-fA-F]{40}$/.test(b.address.replace(/^0x/, ''))) return false;

  const c = b.crypto;
  if (typeof c !== 'object' || c === null) return false;
  if (typeof c.ciphertext !== 'string' || c.ciphertext.length === 0) return false;
  if (typeof c.cipher !== 'string') return false;
  if (typeof c.kdf !== 'string') return false;
  if (typeof c.mac !== 'string' || c.mac.length === 0) return false;
  if (typeof c.cipherparams !== 'object') return false;
  if (typeof c.kdfparams !== 'object') return false;

  return true;
}

/**
 * Store a vault backup. Overwrites any existing backup for this wallet
 * (a user re-backing-up after changing their passphrase should replace the
 * old one — an old, differently-encrypted backup that silently lingers is a
 * recovery footgun, not a feature).
 */
export async function saveVaultBackup(
  userId: string,
  walletId: string,
  encryptedBlobRaw: unknown,
  context: { ipAddress?: string; userAgent?: string }
): Promise<{ success: true; backedUpAt: Date }> {
  // Ownership check: the wallet must actually belong to this user.
  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
  if (!wallet || wallet.userId !== userId) {
    throw new Error('Wallet not found or does not belong to this user');
  }

  if (!isStructurallyValidKeystore(encryptedBlobRaw)) {
    throw new Error('Submitted backup is not a structurally valid keystore — refusing to store it');
  }

  // Address in the keystore must match the registered wallet address — a
  // mismatch here means either client-side corruption or someone trying to
  // back up a different wallet's keystore under this wallet's ID.
  const keystoreAddress = encryptedBlobRaw.address.toLowerCase().replace(/^0x/, '');
  const walletAddress = wallet.address.toLowerCase().replace(/^0x/, '');
  if (keystoreAddress !== walletAddress) {
    throw new Error('Keystore address does not match registered wallet address');
  }

  const blobString = JSON.stringify(encryptedBlobRaw);
  const now = new Date();

  const existing = await db
    .select()
    .from(walletVaultBackups)
    .where(and(eq(walletVaultBackups.walletId, walletId), eq(walletVaultBackups.userId, userId)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(walletVaultBackups)
      .set({
        encryptedBlob: blobString,
        keystoreVersion: encryptedBlobRaw.version,
        address: wallet.address,
        updatedAt: now,
      })
      .where(eq(walletVaultBackups.id, existing[0].id));
  } else {
    await db.insert(walletVaultBackups).values({
      id: uuid(),
      walletId,
      userId,
      encryptedBlob: blobString,
      keystoreVersion: encryptedBlobRaw.version,
      address: wallet.address,
      createdAt: now,
      updatedAt: now,
    });
  }

  await logVaultAccess(walletId, userId, 'backup_created', context);

  return { success: true, backedUpAt: now };
}

/**
 * Retrieve a vault backup. Caller (the route) is responsible for confirming
 * req.user.id === userId before calling this — this function additionally
 * re-checks ownership itself as defense in depth, since this is the single
 * highest-stakes read in the wallet system.
 */
export async function getVaultBackup(
  requestingUserId: string,
  walletId: string,
  context: { ipAddress?: string; userAgent?: string }
): Promise<{ encryptedBlob: unknown; keystoreVersion: number; address: string; backedUpAt: Date } | null> {
  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
  if (!wallet || wallet.userId !== requestingUserId) {
    await logVaultAccess(walletId, requestingUserId, 'backup_retrieval_denied', context);
    throw new Error('Access denied');
  }

  const [backup] = await db
    .select()
    .from(walletVaultBackups)
    .where(and(eq(walletVaultBackups.walletId, walletId), eq(walletVaultBackups.userId, requestingUserId)))
    .limit(1);

  if (!backup) {
    await logVaultAccess(walletId, requestingUserId, 'backup_retrieval_denied', context);
    return null;
  }

  await logVaultAccess(walletId, requestingUserId, 'backup_retrieved', context);

  return {
    encryptedBlob: JSON.parse(backup.encryptedBlob),
    keystoreVersion: backup.keystoreVersion,
    address: backup.address,
    backedUpAt: backup.updatedAt,
  };
}

async function logVaultAccess(
  walletId: string,
  userId: string,
  action: 'backup_created' | 'backup_retrieved' | 'backup_retrieval_denied',
  context: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  try {
    await db.insert(walletVaultAccessLogs).values({
      id: uuid(),
      walletId,
      userId,
      action,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
      createdAt: new Date(),
    });
  } catch (err) {
    // Logging failure must never block the actual operation, but must not
    // be silent either — a gap in this audit trail is itself worth knowing about.
    console.error('[walletVaultService] Failed to write access log', err);
  }
}