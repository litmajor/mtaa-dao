/**
 * PIN Service
 *
 *  ARCHITECTURE CLARIFICATION — READ BEFORE MODIFYING: this PIN NEVER
 * derives, substitutes for, or gains access to the actual wallet encryption
 * key. The passphrase (see walletVaultClient.ts) is the only thing that can
 * ever decrypt a keystore. This PIN's only job is to re-authorize access to
 * an ALREADY-DECRYPTED in-memory session signer — i.e. the user unlocked
 * with their real passphrase at some point in this session, the signer is
 * cached in memory, and the PIN is a lighter-weight "prove it's still you"
 * check before that cached signer is allowed to sign again. If nothing in
 * the current session has been unlocked with the real passphrase yet, PIN
 * verification succeeding does NOT mean signing is possible — there's no
 * key to use. This was flagged as an open question pending this file, and
 * I'm implementing it under this interpretation; if the intent was actually
 * "PIN alone unlocks the wallet with no passphrase ever needed," that's a
 * different and materially weaker design and needs to be an explicit,
 * discussed decision — not something that happens by default.
 *
 */

import { db } from '../db';
import { walletSecuritySettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { otpService } from './otpService';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function hashPIN(pin: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pin, useSalt, 100000, 32, 'sha256').toString('hex');
  return { hash, salt: useSalt };
}

/** Pack hash+salt into the single existing `encryptedPin` text column. */
function packPINRecord(hash: string, salt: string): string {
  return `${hash}:${salt}`;
}

/** Unpack; returns null if the stored value predates this fix (no salt present). */
function unpackPINRecord(stored: string | null): { hash: string; salt: string } | null {
  if (!stored) return null;
  const parts = stored.split(':');
  if (parts.length !== 2) return null; // old-format record with no persisted salt — cannot be verified
  return { hash: parts[0], salt: parts[1] };
}

function verifyPIN(pin: string, stored: string | null): boolean {
  const record = unpackPINRecord(stored);
  if (!record) return false; // no verifiable record — fail closed, not open
  const { hash } = hashPIN(pin, record.salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(record.hash));
}

/**
 * Check and update lockout state. Returns { locked: true, retryAfter } if
 * currently locked out, or increments the failure counter and returns
 * { locked: false } otherwise. Caller is responsible for resetting the
 * counter to 0 on successful verification.
 */
async function checkAndRecordFailure(walletId: string): Promise<{ locked: boolean; retryAfterMs?: number }> {
  const [settings] = await db
    .select()
    .from(walletSecuritySettings)
    .where(eq(walletSecuritySettings.walletId, walletId))
    .limit(1);

  if (!settings) return { locked: false };

  const now = Date.now();
  if (settings.pinLockedUntil && new Date(settings.pinLockedUntil).getTime() > now) {
    return { locked: true, retryAfterMs: new Date(settings.pinLockedUntil).getTime() - now };
  }

  const newFailCount = (settings.failedPinAttempts || 0) + 1;
  const shouldLock = newFailCount >= MAX_FAILED_ATTEMPTS;

  await db
    .update(walletSecuritySettings)
    .set({
      failedPinAttempts: shouldLock ? 0 : newFailCount,
      pinLockedUntil: shouldLock ? new Date(now + LOCKOUT_DURATION_MS) : null,
      updatedAt: new Date(),
    })
    .where(eq(walletSecuritySettings.walletId, walletId));

  return shouldLock ? { locked: true, retryAfterMs: LOCKOUT_DURATION_MS } : { locked: false };
}

async function resetFailureCount(walletId: string): Promise<void> {
  await db
    .update(walletSecuritySettings)
    .set({ failedPinAttempts: 0, pinLockedUntil: null, updatedAt: new Date() })
    .where(eq(walletSecuritySettings.walletId, walletId));
}

export async function setPIN(
  walletId: string,
  pin: string,
  currentPIN?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    if (!/^\d{4,8}$/.test(pin)) {
      return { success: false, error: 'PIN must be 4-8 digits' };
    }

    const existing = await db
      .select()
      .from(walletSecuritySettings)
      .where(eq(walletSecuritySettings.walletId, walletId))
      .limit(1);

    if (currentPIN && existing[0]?.encryptedPin) {
      const isCurrentValid = verifyPIN(currentPIN, existing[0].encryptedPin);
      if (!isCurrentValid) {
        return { success: false, error: 'Current PIN is incorrect' };
      }
    }

    const { hash, salt } = hashPIN(pin);
    const packed = packPINRecord(hash, salt);

    if (existing[0]) {
      await db
        .update(walletSecuritySettings)
        .set({
          encryptedPin: packed,
          failedPinAttempts: 0,
          pinLockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(walletSecuritySettings.walletId, walletId));
    } else {
      await db.insert(walletSecuritySettings).values({
        id: crypto.randomUUID(),
        walletId,
        requiresPin: true,
        encryptedPin: packed,
        failedPinAttempts: 0,
        pinLockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    }

    return { success: true, message: 'PIN has been set successfully' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Verify PIN before allowing a transaction to use the CURRENT session's
 * already-unlocked signer. Does NOT unlock or decrypt anything itself.
 */
export async function verifyPINForTransaction(
  walletId: string,
  pin: string,
  transactionType: string = 'withdrawal'
): Promise<{ success: boolean; message?: string; error?: string; lockedForMs?: number }> {
  try {
    if (!/^\d{4,8}$/.test(pin)) {
      return { success: false, error: 'Invalid PIN format' };
    }

    const [settings] = await db
      .select()
      .from(walletSecuritySettings)
      .where(eq(walletSecuritySettings.walletId, walletId))
      .limit(1);

    if (!settings) {
      return { success: false, error: 'PIN not configured for this wallet' };
    }

    if (!settings.requiresPin) {
      return { success: true, message: 'PIN verification not required' };
    }

    if (settings.pinLockedUntil && new Date(settings.pinLockedUntil).getTime() > Date.now()) {
      const retryAfterMs = new Date(settings.pinLockedUntil).getTime() - Date.now();
      return { success: false, error: 'Too many failed attempts. Try again later.', lockedForMs: retryAfterMs };
    }

    const isValid = verifyPIN(pin, settings.encryptedPin);

    if (!isValid) {
      const failureResult = await checkAndRecordFailure(walletId);
      return {
        success: false,
        error: failureResult.locked ? 'Too many failed attempts. Wallet locked temporarily.' : 'Incorrect PIN',
        lockedForMs: failureResult.retryAfterMs,
      };
    }

    await resetFailureCount(walletId);
    return { success: true, message: 'PIN verified successfully' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function disablePIN(walletId: string, pin: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const verifyResult = await verifyPINForTransaction(walletId, pin, 'pin_change');
    if (!verifyResult.success) {
      return verifyResult;
    }

    await db
      .update(walletSecuritySettings)
      .set({ requiresPin: false, encryptedPin: null, failedPinAttempts: 0, pinLockedUntil: null, updatedAt: new Date() })
      .where(eq(walletSecuritySettings.walletId, walletId));

    return { success: true, message: 'PIN requirement has been disabled' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function isPINRequired(walletId: string): Promise<boolean> {
  try {
    const [settings] = await db.select().from(walletSecuritySettings).where(eq(walletSecuritySettings.walletId, walletId)).limit(1);
    return settings?.requiresPin || false;
  } catch (error) {
    console.error('Error checking PIN requirement:', error);
    return false;
  }
}

export async function isPINConfigured(walletId: string): Promise<boolean> {
  try {
    const [settings] = await db.select().from(walletSecuritySettings).where(eq(walletSecuritySettings.walletId, walletId)).limit(1);
    return !!settings?.encryptedPin;
  } catch (error) {
    console.error('Error checking PIN configuration:', error);
    return false;
  }
}

export async function getPINRequirements(walletId: string): Promise<{
  success: boolean;
  requirements?: { isRequired: boolean; isConfigured: boolean; minLength: number; maxLength: number; allowedCharacters: string };
  error?: string;
}> {
  try {
    const isRequired = await isPINRequired(walletId);
    const isConfigured = await isPINConfigured(walletId);
    return {
      success: true,
      requirements: { isRequired, isConfigured, minLength: 4, maxLength: 8, allowedCharacters: 'Digits (0-9)' },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Request a PIN reset by sending a real verification code through the
 * dedicated OTP delivery flow. This uses the same OTP infrastructure as
 * registration so the reset path is verifiable and auditable.
 */
export async function requestPINReset(
  walletId: string,
  userId: string,
  phone?: string,
  email?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const identifier = email ? `email:${userId}:${email}` : `phone:${userId}:${phone}`;

    if (!identifier || (!phone && !email)) {
      return { success: false, error: 'A phone number or email address is required for PIN reset' };
    }

    const code = await otpService.storeOTP(identifier, '');

    if (email) {
      await otpService.sendEmailOTP(email, code);
      return { success: true, message: `Verification code sent to ${email}` };
    }

    if (phone) {
      await otpService.sendSMSOTP(phone, code);
      return { success: true, message: `Verification code sent to ${phone}` };
    }

    return { success: false, error: 'No delivery method available for PIN reset' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Verify the reset code through the same OTP flow used for registration,
 * then update the wallet PIN if the code is valid.
 */
export async function resetPIN(
  walletId: string,
  userId: string,
  phoneOrEmail: string,
  verificationCode: string,
  newPIN: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    if (!/^\d{4,8}$/.test(newPIN)) {
      return { success: false, error: 'New PIN must be 4-8 digits' };
    }

    const identifier = phoneOrEmail.includes('@') ? `email:${userId}:${phoneOrEmail}` : `phone:${userId}:${phoneOrEmail}`;
    const verification = await otpService.verifyOTP(identifier, verificationCode);
    if (!verification.valid) {
      return { success: false, error: verification.error || 'Invalid or expired verification code' };
    }
    // OTPService.verifyOTP already deletes the OTP on success — it cannot
    // be reused for a second reset attempt.

    const { hash, salt } = hashPIN(newPIN);

    await db
      .update(walletSecuritySettings)
      .set({ encryptedPin: packPINRecord(hash, salt), failedPinAttempts: 0, pinLockedUntil: null, updatedAt: new Date() })
      .where(eq(walletSecuritySettings.walletId, walletId));

    return { success: true, message: 'PIN has been reset successfully' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Re-authorize the CURRENT session's already-unlocked signer via PIN,
 * across all of a user's wallets. This does not decrypt anything — it
 * exists purely so the client can gate "sign with the already-cached
 * in-memory signer" behind something lighter than re-entering the full
 * passphrase every time.
 */
export async function verifyUserPIN(userId: string, pin: string): Promise<boolean> {
  try {
    if (!/^\d{4,8}$/.test(pin)) {
      return false;
    }

    const userWallets = await db.query.wallets.findMany({
      where: (wallets: any, { eq }: any) => eq(wallets.userId, userId),
      with: { securitySettings: true },
    });

    if (!userWallets || userWallets.length === 0) {
      return false;
    }

    for (const wallet of userWallets as any[]) {
      const settings = wallet.securitySettings;
      if (!settings?.requiresPin || !settings.encryptedPin) continue;

      if (settings.pinLockedUntil && new Date(settings.pinLockedUntil).getTime() > Date.now()) {
        continue; // locked out — skip rather than leak lockout state per-wallet
      }

      if (verifyPIN(pin, settings.encryptedPin)) {
        await resetFailureCount(wallet.id);
        return true;
      } else {
        await checkAndRecordFailure(wallet.id);
      }
    }

    return false;
  } catch (error) {
    console.error('PIN verification error:', error);
    return false;
  }
}

export const pinService = {
  setPIN,
  verifyPINForTransaction,
  verifyUserPIN,
  disablePIN,
  isPINRequired,
  isPINConfigured,
  getPINRequirements,
  resetPIN,
};
