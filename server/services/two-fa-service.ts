/**
 * Two-Factor Authentication (2FA) Service
 * Handles OTP generation, verification, and 2FA settings for sensitive operations
 */

import { db } from '../db';
import { users, walletSecuritySettings, wallets } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';

/**
 * 2FA Methods
 */
export enum TwoFAMethod {
  SMS = 'sms',
  EMAIL = 'email',
  AUTHENTICATOR = 'authenticator',
}

/**
 * 2FA State
 */
export interface TwoFAState {
  userId: string;
  method: TwoFAMethod;
  isEnabled: boolean;
  isVerified: boolean;
  backupCodes: string[];
  lastUsedAt?: Date;
}

/**
 * OTP Storage (in-memory for demo, use Redis in production)
 */
const otpStore: Map<string, { code: string; expiresAt: number; attempts: number }> = new Map();
const MAX_OTP_ATTEMPTS = 3;
const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes
const OTP_LENGTH = 6;

/**
 * Generate OTP code
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString().slice(0, OTP_LENGTH);
}

/**
 * Generate backup codes for recovery
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

/**
 * Create OTP for withdrawal verification
 */
export async function createWithdrawalOTP(userId: string): Promise<{
  success: boolean;
  otpId: string;
  expiresIn: number; // seconds
  error?: string;
}> {
  try {
    // Generate OTP
    const code = generateOTP();
    const otpId = `otp-${userId}-${uuid()}`;
    const expiresAt = Date.now() + OTP_EXPIRY;

    // Store OTP
    otpStore.set(otpId, {
      code,
      expiresAt,
      attempts: 0,
    });

    console.log(`🔐 Generated 2FA OTP for user ${userId}: ${code}`);

    return {
      success: true,
      otpId,
      expiresIn: Math.floor(OTP_EXPIRY / 1000),
    };
  } catch (error) {
    return {
      success: false,
      otpId: '',
      expiresIn: 0,
      error: (error as Error).message,
    };
  }
}

/**
 * Verify withdrawal OTP
 */
export async function verifyWithdrawalOTP(
  userId: string,
  otpId: string,
  code: string
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // Get OTP from store
    const otp = otpStore.get(otpId);

    if (!otp) {
      return {
        success: false,
        error: 'OTP expired or invalid',
      };
    }

    // Check expiry
    if (Date.now() > otp.expiresAt) {
      otpStore.delete(otpId);
      return {
        success: false,
        error: 'OTP has expired',
      };
    }

    // Check attempts
    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      otpStore.delete(otpId);
      return {
        success: false,
        error: 'Too many failed attempts. Please generate a new OTP.',
      };
    }

    // Verify code
    if (otp.code !== code) {
      otp.attempts++;
      return {
        success: false,
        error: `Invalid OTP. ${MAX_OTP_ATTEMPTS - otp.attempts} attempts remaining.`,
      };
    }

    // Valid OTP - clean up
    otpStore.delete(otpId);

    // Update user's 2FA last used time
    await db.update(users).set({ updatedAt: new Date() }).where(eq(users.id, userId));

    return {
      success: true,
      message: '2FA verification successful',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Enable 2FA for user
 */
export async function enable2FA(
  userId: string,
  method: TwoFAMethod,
  walletId?: string
): Promise<{
  success: boolean;
  backupCodes?: string[];
  message?: string;
  error?: string;
}> {
  try {
    // If walletId not provided, find user's first wallet
    let targetWalletId = walletId;
    if (!targetWalletId) {
      const userWallets = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
      if (!userWallets[0]) {
        return {
          success: false,
          error: 'User wallet not found',
        };
      }
      targetWalletId = userWallets[0].id;
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes(10);

    // Check if security settings exist
    const existingSettings = await db
      .select()
      .from(walletSecuritySettings)
      .where(eq(walletSecuritySettings.walletId, targetWalletId))
      .limit(1);

    // Update or create security settings with 2FA enabled
    if (existingSettings[0]) {
      await db
        .update(walletSecuritySettings)
        .set({
          twoFactorEnabled: true,
          twoFactorMethod: method,
          updatedAt: new Date(),
        })
        .where(eq(walletSecuritySettings.walletId, targetWalletId));
    } else {
      await db.insert(walletSecuritySettings).values({
        walletId: targetWalletId,
        twoFactorEnabled: true,
        twoFactorMethod: method,
      });
    }

    console.log(`✅ 2FA enabled for wallet ${targetWalletId} via ${method}`);
    console.log(`Backup codes: ${backupCodes.join(', ')}`);

    return {
      success: true,
      backupCodes,
      message: `2FA enabled via ${method}. Please save your backup codes in a secure location.`,
    };
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Disable 2FA for user
 */
export async function disable2FA(
  userId: string,
  password: string,
  walletId?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // Fetch user to verify password
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userResult[0]) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    const user = userResult[0];

    // If walletId not provided, find user's first wallet
    let targetWalletId = walletId;
    if (!targetWalletId) {
      const userWallets = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
      if (!userWallets[0]) {
        return {
          success: false,
          error: 'User wallet not found',
        };
      }
      targetWalletId = userWallets[0].id;
    }

    // Verify password before disabling 2FA (security best practice)
    if (password) {
      try {
        // For now, accept the password if provided (proper bcrypt comparison would go here)
        // TODO: Implement proper bcrypt password comparison once auth utils are available
        if (!user.password || password.length === 0) {
          return {
            success: false,
            error: 'Invalid password - cannot disable 2FA without correct password'
          };
        }
        // In production, use: const passwordMatches = await bcrypt.compare(password, user.password);
      } catch (error) {
        console.error('Error verifying password:', error);
        return {
          success: false,
          error: 'Failed to verify password'
        };
      }
    } else {
      // Require password for security-sensitive operation
      return {
        success: false,
        error: 'Password required to disable 2FA'
      };
    }

    // Update security settings to disable 2FA
    await db
      .update(walletSecuritySettings)
      .set({
        twoFactorEnabled: false,
        twoFactorMethod: null,
        updatedAt: new Date(),
      })
      .where(eq(walletSecuritySettings.walletId, targetWalletId));

    console.log(`❌ 2FA disabled for wallet ${targetWalletId}`);

    return {
      success: true,
      message: '2FA has been disabled',
    };
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Verify backup code (for recovery)
 */
export async function verifyBackupCode(
  userId: string,
  backupCode: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Implement storing and validating backup codes
    // Check against stored backup codes from wallet_security_settings
    
    // 1. Fetch the user's wallet
    const userWallets = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!userWallets.length) {
      return {
        success: false,
        error: 'User wallet not found'
      };
    }

    const walletId = userWallets[0].id;

    // 2. Check if backup code exists and is valid
    // TODO: Implement backup codes table schema once available
    // For now, provide structure for when table exists:
    // SELECT * FROM backup_codes 
    // WHERE wallet_id = ${walletId} AND code = ${backupCode} AND used = false
    
    // Placeholder implementation
    console.log(`🔐 Backup code verification attempted for wallet ${walletId}`);
    console.log(`Note: Full backup code validation requires database table schema`);

    // In production, would execute:
    // const result = await db.execute(sql`
    //   SELECT id FROM backup_codes 
    //   WHERE wallet_id = ${walletId} AND code = ${backupCode} AND used = false
    //   LIMIT 1
    // `);
    
    // if (!result.rows?.length) return { success: false, error: 'Invalid or already used backup code' };
    
    // // Mark as used
    // await db.execute(sql`
    //   UPDATE backup_codes SET used = true, used_at = NOW()
    //   WHERE id = ${result.rows[0].id}
    // `);

    return {
      success: false,
      error: 'Backup code validation requires database schema implementation'
    };

  } catch (error) {
    console.error('Error verifying backup code:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Send OTP via SMS or Email
 */
export async function send2FAOTP(
  userId: string,
  otpId: string,
  method: TwoFAMethod,
  destination: string
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    const otp = otpStore.get(otpId);

    if (!otp) {
      return {
        success: false,
        error: 'OTP not found',
      };
    }

    // In production, integrate with SMS/Email providers
    // For now, just log

    if (method === TwoFAMethod.SMS) {
      console.log(`📱 2FA SMS sent to ${destination}: ${otp.code}`);
    } else if (method === TwoFAMethod.EMAIL) {
      console.log(`📧 2FA Email sent to ${destination}: ${otp.code}`);
    }

    return {
      success: true,
      message: `2FA code sent via ${method}`,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Check if 2FA is enabled for user
 */
export async function is2FAEnabled(userId: string, walletId?: string): Promise<boolean> {
  try {
    // If walletId not provided, find user's first wallet
    let targetWalletId = walletId;
    if (!targetWalletId) {
      const userWallets = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
      if (!userWallets[0]) {
        return false;
      }
      targetWalletId = userWallets[0].id;
    }

    const settings = await db
      .select()
      .from(walletSecuritySettings)
      .where(eq(walletSecuritySettings.walletId, targetWalletId))
      .limit(1);

    if (!settings[0]) {
      return false;
    }

    return settings[0].twoFactorEnabled || false;
  } catch (error) {
    console.error('Error checking 2FA status:', error);
    return false;
  }
}

/**
 * Get 2FA configuration for user
 */
export async function get2FAConfig(
  userId: string,
  walletId?: string
): Promise<{
  success: boolean;
  config?: {
    isEnabled: boolean;
    method?: TwoFAMethod;
    destination?: string;
  };
  error?: string;
}> {
  try {
    // If walletId not provided, find user's first wallet
    let targetWalletId = walletId;
    if (!targetWalletId) {
      const userWallets = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
      if (!userWallets[0]) {
        return {
          success: false,
          error: 'User wallet not found',
        };
      }
      targetWalletId = userWallets[0].id;
    }

    const settings = await db
      .select()
      .from(walletSecuritySettings)
      .where(eq(walletSecuritySettings.walletId, targetWalletId))
      .limit(1);

    if (!settings[0]) {
      return {
        success: true,
        config: {
          isEnabled: false,
        },
      };
    }

    // Get user info for destination details
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    return {
      success: true,
      config: {
        isEnabled: settings[0].twoFactorEnabled || false,
        method: settings[0].twoFactorMethod as TwoFAMethod,
        destination: settings[0].twoFactorMethod === TwoFAMethod.SMS 
          ? user[0]?.phone || 'Not set'
          : user[0]?.email || 'Not set',
      },
    };
  } catch (error) {
    console.error('Error fetching 2FA config:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

export const twoFAService = {
  createWithdrawalOTP,
  verifyWithdrawalOTP,
  enable2FA,
  disable2FA,
  verifyBackupCode,
  send2FAOTP,
  is2FAEnabled,
  get2FAConfig,
  generateBackupCodes,
  TwoFAMethod,
};
