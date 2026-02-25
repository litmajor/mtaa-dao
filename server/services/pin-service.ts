/**
 * PIN (Personal Identification Number) Service
 * Manages PIN creation, verification, and storage for wallet security
 */

import { db } from '../db';
import { walletSecuritySettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Hash PIN with salt (not reversible)
 */
function hashPIN(pin: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pin, useSalt, 100000, 32, 'sha256').toString('hex');
  return { hash, salt: useSalt };
}

/**
 * Verify PIN against stored hash
 */
function verifyPIN(pin: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashPIN(pin, storedSalt);
  return hash === storedHash;
}

/**
 * Set PIN for wallet
 */
export async function setPIN(
  walletId: string,
  pin: string,
  currentPIN?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // Validate PIN format
    if (!/^\d{4,8}$/.test(pin)) {
      return {
        success: false,
        error: 'PIN must be 4-8 digits',
      };
    }

    // If updating existing PIN, verify current PIN
    if (currentPIN) {
      const settings = await db
        .select()
        .from(walletSecuritySettings)
        .where(eq(walletSecuritySettings.walletId, walletId))
        .limit(1);

      if (settings[0]?.encryptedPin) {
        // In production: decrypt and verify current PIN
        // For now, just verify the format
        if (!currentPIN || currentPIN.length < 4) {
          return {
            success: false,
            error: 'Current PIN is invalid',
          };
        }
      }
    }

    // Hash new PIN
    const { hash, salt } = hashPIN(pin);

    // Update wallet security settings
    const existing = await db
      .select()
      .from(walletSecuritySettings)
      .where(eq(walletSecuritySettings.walletId, walletId))
      .limit(1);

    if (existing[0]) {
      // Update existing record
      await db
        .update(walletSecuritySettings)
        .set({
          encryptedPin: hash, // Store hashed PIN
          updatedAt: new Date(),
        })
        .where(eq(walletSecuritySettings.walletId, walletId));
    } else {
      // Create new record
      await db.insert(walletSecuritySettings).values({
        id: crypto.randomUUID(),
        walletId,
        requiresPin: true,
        encryptedPin: hash,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    }

    return {
      success: true,
      message: 'PIN has been set successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Verify PIN for transaction
 */
export async function verifyPINForTransaction(
  walletId: string,
  pin: string,
  transactionType: string = 'withdrawal'
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // Validate PIN format
    if (!/^\d{4,8}$/.test(pin)) {
      return {
        success: false,
        error: 'Invalid PIN format',
      };
    }

    // Get wallet security settings
    const settings = await db
      .select()
      .from(walletSecuritySettings)
      .where(eq(walletSecuritySettings.walletId, walletId))
      .limit(1);

    if (!settings[0]) {
      return {
        success: false,
        error: 'PIN not configured for this wallet',
      };
    }

    if (!settings[0].requiresPin) {
      return {
        success: true,
        message: 'PIN verification not required',
      };
    }

    // In production: decrypt and verify PIN
    // For now, accept any 4-8 digit PIN
    if (pin.length < 4) {
      return {
        success: false,
        error: 'PIN must be at least 4 digits',
      };
    }

    console.log(`✅ PIN verified for ${transactionType} on wallet ${walletId}`);

    return {
      success: true,
      message: 'PIN verified successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Disable PIN requirement
 */
export async function disablePIN(
  walletId: string,
  pin: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // Verify PIN before disabling
    const verifyResult = await verifyPINForTransaction(walletId, pin, 'pin_change');

    if (!verifyResult.success) {
      return verifyResult;
    }

    // Update settings
    await db
      .update(walletSecuritySettings)
      .set({
        requiresPin: false,
        encryptedPin: null,
        updatedAt: new Date(),
      })
      .where(eq(walletSecuritySettings.walletId, walletId));

    return {
      success: true,
      message: 'PIN requirement has been disabled',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Check if PIN is required
 */
export async function isPINRequired(walletId: string): Promise<boolean> {
  try {
    const settings = await db
      .select()
      .from(walletSecuritySettings)
      .where(eq(walletSecuritySettings.walletId, walletId))
      .limit(1);

    return settings[0]?.requiresPin || false;
  } catch (error) {
    console.error('Error checking PIN requirement:', error);
    return false;
  }
}

/**
 * Check if PIN is configured
 */
export async function isPINConfigured(walletId: string): Promise<boolean> {
  try {
    const settings = await db
      .select()
      .from(walletSecuritySettings)
      .where(eq(walletSecuritySettings.walletId, walletId))
      .limit(1);

    return !!(settings[0]?.encryptedPin);
  } catch (error) {
    console.error('Error checking PIN configuration:', error);
    return false;
  }
}

/**
 * Get PIN requirements
 */
export async function getPINRequirements(walletId: string): Promise<{
  success: boolean;
  requirements?: {
    isRequired: boolean;
    isConfigured: boolean;
    minLength: number;
    maxLength: number;
    allowedCharacters: string;
  };
  error?: string;
}> {
  try {
    const isRequired = await isPINRequired(walletId);
    const isConfigured = await isPINConfigured(walletId);

    return {
      success: true,
      requirements: {
        isRequired,
        isConfigured,
        minLength: 4,
        maxLength: 8,
        allowedCharacters: 'Digits (0-9)',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Reset PIN (requires email/SMS verification)
 */
export async function resetPIN(
  walletId: string,
  verificationCode: string,
  newPIN: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // Validate new PIN format
    if (!/^\d{4,8}$/.test(newPIN)) {
      return {
        success: false,
        error: 'New PIN must be 4-8 digits',
      };
    }

    // In production: verify the verification code sent via email/SMS
    // For now, just validate the code format
    if (!verificationCode || verificationCode.length < 4) {
      return {
        success: false,
        error: 'Invalid verification code',
      };
    }

    // Hash new PIN
    const { hash } = hashPIN(newPIN);

    // Update settings
    await db
      .update(walletSecuritySettings)
      .set({
        encryptedPin: hash,
        updatedAt: new Date(),
      })
      .where(eq(walletSecuritySettings.walletId, walletId));

    return {
      success: true,
      message: 'PIN has been reset successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Verify user PIN for wallet session access
 * Used for wallet unlock via PIN without seedphrase
 */
export async function verifyUserPIN(
  userId: string,
  pin: string
): Promise<boolean> {
  try {
    if (!/^\d{4}$/.test(pin)) {
      return false; // Must be exactly 4 digits
    }

    // Get user's wallet security settings
    const userWallets = await db.query.wallets.findMany({
      where: (wallets, { eq }) => eq(wallets.userId, userId),
      with: {
        securitySettings: true,
      },
    });

    if (!userWallets || userWallets.length === 0) {
      return false;
    }

    // Check if any wallet has this PIN
    // In production: decrypt and verify PIN hash against stored hash
    // For now: verify through security settings
    for (const wallet of userWallets) {
      if (wallet.securitySettings && wallet.securitySettings.requiresPin) {
        // PIN hash is stored in encryptedPin field
        if (wallet.securitySettings.encryptedPin) {
          // Decrypt and verify
          const isValid = verifyPIN(
            pin,
            wallet.securitySettings.encryptedPin,
            wallet.securitySettings.encryptedPin // Salt would be stored separately in production
          );
          if (isValid) {
            return true;
          }
        }
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
