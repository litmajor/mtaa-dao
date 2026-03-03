/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ADMIN 2FA (TOTP) SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Handles TOTP-based 2FA setup, verification, and backup codes for admin accounts
 * 
 * Features:
 * - Generate TOTP secrets with encryption
 * - Generate QR codes for authentication apps
 * - Verify TOTP codes
 * - Generate and manage backup codes
 * - Encrypt/decrypt sensitive 2FA data
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import crypto from 'crypto';
import QRCode from 'qrcode';

/**
 * TOTP Configuration
 */
const TOTP_CONFIG = {
  window: 2, // allow 2 time windows before/after current time
  time: 30, // 30-second time window
};

/**
 * Encryption Configuration
 */
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * Generate random secret for TOTP
 * 
 * @param length - Length of the secret (default 32 bytes = 256 bits)
 * @returns Base32-encoded secret
 */
export function generateTOTPSecret(length: number = 32): string {
  const buffer = crypto.randomBytes(length);
  // Implement Base32 encoding (simplified)
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  let bits = 0;
  let value = 0;

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      secret += base32chars[(value >> bits) & 31];
    }
  }

  if (bits > 0) {
    secret += base32chars[(value << (5 - bits)) & 31];
  }

  return secret;
}

/**
 * Generate backup codes for account recovery
 * Creates 10 single-use backup codes
 * 
 * @returns Array of backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Format: XXXX-XXXX-XXXX (3 groups of 4 hex characters)
    const code = crypto
      .randomBytes(6)
      .toString('hex')
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join('-') || '';
    codes.push(code);
  }
  return codes;
}

/**
 * Encrypt sensitive data (TOTP secret, backup codes)
 * 
 * @param data - Data to encrypt
 * @param encryptionKey - Encryption key (from environment)
 * @returns JSON with iv, ciphertext, authTag
 */
export function encryptData(data: string, encryptionKey: string): {
  iv: string;
  ciphertext: string;
  authTag: string;
} {
  try {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(encryptionKey, 'hex');

    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let ciphertext = cipher.update(data, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      ciphertext,
      authTag: authTag.toString('hex'),
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${(error as Error).message}`);
  }
}

/**
 * Decrypt sensitive data
 * 
 * @param encrypted - Encrypted data object
 * @param encryptionKey - Encryption key (from environment)
 * @returns Decrypted plaintext
 */
export function decryptData(
  encrypted: { iv: string; ciphertext: string; authTag: string },
  encryptionKey: string
): string {
  try {
    const iv = Buffer.from(encrypted.iv, 'hex');
    const ciphertext = Buffer.from(encrypted.ciphertext, 'hex');
    const authTag = Buffer.from(encrypted.authTag, 'hex');
    const key = Buffer.from(encryptionKey, 'hex');

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  } catch (error) {
    throw new Error(`Decryption failed: ${(error as Error).message}`);
  }
}

/**
 * Generate HMAC-based OTP (HOTP)
 * Used internally by TOTP
 * 
 * @param secret - Base32-encoded secret
 * @param counter - Time counter value
 * @returns 6-digit OTP code
 */
function generateHOTP(secret: string, counter: number): string {
  const secretBuffer = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);

  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = counter & 0xff;
    counter = counter >> 8;
  }

  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const code = (digest[offset] & 0x7f) << 24
    | (digest[offset + 1] & 0xff) << 16
    | (digest[offset + 2] & 0xff) << 8
    | (digest[offset + 3] & 0xff);

  return `${code % 1000000}`.padStart(6, '0');
}

/**
 * Decode Base32 string to buffer
 * 
 * @param secret - Base32-encoded secret
 * @returns Buffer
 */
function base32Decode(secret: string): Buffer {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits: number[] = [];
  let value = 0;
  let bits_count = 0;

  for (const char of secret) {
    const n = base32chars.indexOf(char);
    if (n < 0) throw new Error('Invalid base32 character');

    value = (value << 5) | n;
    bits_count += 5;

    if (bits_count >= 8) {
      bits_count -= 8;
      bits.push((value >> bits_count) & 255);
    }
  }

  return Buffer.from(bits);
}

/**
 * Generate TOTP code (Time-based OTP)
 * Valid for current and adjacent time windows
 * 
 * @param secret - Base32-encoded TOTP secret
 * @returns 6-digit OTP code
 */
export function generateTOTP(secret: string): string {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / TOTP_CONFIG.time);
  return generateHOTP(secret, counter);
}

/**
 * Verify TOTP code against secret
 * Allows for time window drift (before/after current time)
 * 
 * @param secret - Base32-encoded TOTP secret
 * @param token - 6-digit token to verify
 * @returns true if valid, false otherwise
 */
export function verifyTOTP(secret: string, token: string): boolean {
  try {
    if (!/^\d{6}$/.test(token)) {
      return false;
    }

    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / TOTP_CONFIG.time);

    // Check current window and adjacent windows
    for (let i = -TOTP_CONFIG.window; i <= TOTP_CONFIG.window; i++) {
      const testCounter = counter + i;
      const testToken = generateHOTP(secret, testCounter);

      if (testToken === token) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
}

/**
 * Generate QR code for 2FA setup
 * Used to display in UI for scanning with authenticator app
 * 
 * @param userEmail - Admin email (identifier)
 * @param secret - Base32-encoded TOTP secret
 * @param appName - Application name (default: MTAA DAO)
 * @returns Data URL for QR code image
 */
export async function generateQRCode(
  userEmail: string,
  secret: string,
  appName: string = 'MTAA DAO'
): Promise<string> {
  try {
    // Format: otpauth://totp/LABEL?secret=SECRET&issuer=ISSUER
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(
      userEmail
    )}?secret=${secret}&issuer=${encodeURIComponent(appName)}`;

    const qrCode = await QRCode.toDataURL(otpauthUrl);
    return qrCode;
  } catch (error) {
    throw new Error(`QR code generation failed: ${(error as Error).message}`);
  }
}

/**
 * Validate backup code format and mark as used
 * Stores used backup codes to prevent reuse
 * 
 * @param backupCode - Backup code to validate (XXXX-XXXX-XXXX format)
 * @param backupCodes - Array of stored backup codes
 * @returns { valid: boolean, remaining: string[] }
 */
export function validateAndUseBackupCode(
  backupCode: string,
  backupCodes: string[]
): { valid: boolean; remaining: string[] } {
  // Normalize input (case-insensitive, remove spaces)
  const normalized = backupCode.toUpperCase().replace(/\s+/g, '');

  // Find and remove matching code
  const index = backupCodes.findIndex(
    (code) => code.replace(/\s+/g, '') === normalized
  );

  if (index === -1) {
    return { valid: false, remaining: backupCodes };
  }

  // Remove used code and return remaining
  const remaining = [...backupCodes];
  remaining.splice(index, 1);

  return { valid: true, remaining };
}

/**
 * 2FA Setup Data
 * Returned by setup endpoint
 */
export interface TwoFASetupData {
  secret: string; // Encrypted TOTP secret
  iv: string;
  authTag: string;
  qrCode: string; // Data URL for QR code
  backupCodes: string[]; // Unencrypted (display only)
}

/**
 * 2FA Status
 * Current 2FA configuration for user
 */
export interface TwoFAStatus {
  enabled: boolean;
  method: 'totp' | 'sms' | 'email';
  setupAt?: Date;
  verifiedAt?: Date;
  recoveryEmail?: string;
  backupCodesRemaining: number;
}

/**
 * Initialize 2FA setup for admin
 * Generates secret, QR code, and backup codes
 * 
 * @param userEmail - Admin email
 * @param encryptionKey - Key to encrypt secret
 * @returns Setup data with QR code and backup codes
 */
export async function initiateTwoFASetup(
  userEmail: string,
  encryptionKey: string
): Promise<TwoFASetupData> {
  try {
    // Generate secret
    const secret = generateTOTPSecret();

    // Encrypt secret
    const encrypted = encryptData(secret, encryptionKey);

    // Generate QR code
    const qrCode = await generateQRCode(userEmail, secret);

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    return {
      secret: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      qrCode,
      backupCodes,
    };
  } catch (error) {
    throw new Error(`2FA setup initialization failed: ${(error as Error).message}`);
  }
}

/**
 * Complete 2FA setup verification
 * Validates TOTP code before confirming setup
 * 
 * @param totpCode - 6-digit TOTP code from user's authenticator
 * @param encryptedSecret - Encrypted TOTP secret
 * @param encryptionKey - Key to decrypt secret
 * @returns true if verification successful
 */
export function completeTwoFASetup(
  totpCode: string,
  encryptedData: { ciphertext: string; iv: string; authTag: string },
  encryptionKey: string
): boolean {
  try {
    // Decrypt secret
    const secret = decryptData(encryptedData, encryptionKey);

    // Verify code
    return verifyTOTP(secret, totpCode);
  } catch (error) {
    console.error('2FA setup completion failed:', error);
    return false;
  }
}

/**
 * Verify 2FA code for login or sensitive operations
 * 
 * @param totpCode - 6-digit TOTP code
 * @param encryptedSecret - Encrypted TOTP secret from database
 * @param encryptionKey - Key to decrypt secret
 * @returns true if code is valid
 */
export function verify2FACode(
  totpCode: string,
  encryptedData: { ciphertext: string; iv: string; authTag: string },
  encryptionKey: string
): boolean {
  try {
    // Decrypt secret
    const secret = decryptData(encryptedData, encryptionKey);

    // Verify code
    return verifyTOTP(secret, totpCode);
  } catch (error) {
    console.error('2FA code verification failed:', error);
    return false;
  }
}

/**
 * Regenerate backup codes
 * Called when user wants new backup codes
 * 
 * @returns Array of new backup codes
 */
export function regenerateBackupCodes(): string[] {
  return generateBackupCodes();
}

/**
 * Export all service functions
 */
export const adminTOTPService = {
  generateTOTPSecret,
  generateBackupCodes,
  encryptData,
  decryptData,
  generateTOTP,
  verifyTOTP,
  generateQRCode,
  validateAndUseBackupCode,
  initiateTwoFASetup,
  completeTwoFASetup,
  verify2FACode,
  regenerateBackupCodes,
};
