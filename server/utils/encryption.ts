/**
 * Encryption Utility
 * AES-256-GCM encryption/decryption for API credentials
 * 
 * Security Features:
 * - AES-256 in GCM mode (authenticated encryption)
 * - Random IV per encryption (prevents pattern recognition)
 * - Authentication tag (detects tampering)
 * - PBKDF2 key derivation from master key
 */

import * as crypto from 'crypto';

/**
 * Encryption configuration and constants
 */
export const ENCRYPTION_CONFIG = {
  ALGORITHM: 'aes-256-gcm',
  IV_LENGTH: 16, // 128 bits
  SALT_LENGTH: 32, // 256 bits
  TAG_LENGTH: 16, // 128 bits for GCM authentication
  KEY_LENGTH: 32, // 256 bits
  PBKDF2_ITERATIONS: 100000, // NIST recommendation for 2024
  PBKDF2_DIGEST: 'sha256',
};

/**
 * Encrypted data structure
 * Contains all information needed for decryption
 */
export interface EncryptedData {
  iv: string; // Base64 encoded initialization vector
  salt: string; // Base64 encoded salt for key derivation
  tag: string; // Base64 encoded authentication tag
  encryptedData: string; // Base64 encoded encrypted content
  algorithm: string; // For future compatibility
}

/**
 * Derive encryption key from master key using PBKDF2
 * 
 * @param masterKey - The master encryption key from environment
 * @param salt - Salt for key derivation (random per encryption)
 * @returns Derived 256-bit key
 */
export function deriveKey(masterKey: string, salt: Buffer): Buffer {
  if (!masterKey || masterKey.length === 0) {
    throw new Error('Master key is required for encryption');
  }

  return crypto.pbkdf2Sync(
    masterKey,
    salt,
    ENCRYPTION_CONFIG.PBKDF2_ITERATIONS,
    ENCRYPTION_CONFIG.KEY_LENGTH,
    ENCRYPTION_CONFIG.PBKDF2_DIGEST
  );
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * 
 * @param masterKey - Master encryption key (from environment)
 * @param plaintext - Data to encrypt
 * @returns EncryptedData object with all components needed for decryption
 * 
 * @example
 * const encrypted = encrypt(process.env.MASTER_ENCRYPTION_KEY, 'my-api-key');
 * // Store encrypted.iv, encrypted.salt, encrypted.tag, encrypted.encryptedData in database
 */
export function encrypt(masterKey: string, plaintext: string): EncryptedData {
  try {
    // Generate random IV and salt
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.IV_LENGTH);
    const salt = crypto.randomBytes(ENCRYPTION_CONFIG.SALT_LENGTH);

    // Derive key from master key using PBKDF2
    const key = deriveKey(masterKey, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(
      ENCRYPTION_CONFIG.ALGORITHM,
      key,
      iv
    );

    // Encrypt the plaintext
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    // Get authentication tag
    const tag = cipher.getAuthTag();

    // Return all components as base64 for storage
    return {
      iv: iv.toString('base64'),
      salt: salt.toString('base64'),
      tag: tag.toString('base64'),
      encryptedData: encrypted.toString('base64'),
      algorithm: ENCRYPTION_CONFIG.ALGORITHM,
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decrypt data encrypted with encrypt()
 * 
 * @param masterKey - Master encryption key (must be same as used for encryption)
 * @param encryptedData - EncryptedData object returned from encrypt()
 * @returns Decrypted plaintext
 * 
 * @example
 * const decrypted = decrypt(process.env.MASTER_ENCRYPTION_KEY, encryptedData);
 * console.log(decrypted); // 'my-api-key'
 * 
 * @throws Error if decryption fails or authentication tag doesn't match
 */
export function decrypt(masterKey: string, encryptedData: EncryptedData): string {
  try {
    // Convert from base64
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const salt = Buffer.from(encryptedData.salt, 'base64');
    const tag = Buffer.from(encryptedData.tag, 'base64');
    const encrypted = Buffer.from(encryptedData.encryptedData, 'base64');

    // Derive the same key using same salt and master key
    const key = deriveKey(masterKey, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_CONFIG.ALGORITHM,
      key,
      iv
    );

    // Set authentication tag
    decipher.setAuthTag(tag);

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : String(error)}. ` +
      `This may indicate tampering or an incorrect master key.`
    );
  }
}

/**
 * Encrypt data and return as JSON string (for database storage)
 * 
 * @param masterKey - Master encryption key
 * @param plaintext - Data to encrypt
 * @returns JSON string of encrypted data
 */
export function encryptToJSON(masterKey: string, plaintext: string): string {
  const encrypted = encrypt(masterKey, plaintext);
  return JSON.stringify(encrypted);
}

/**
 * Decrypt data from JSON string
 * 
 * @param masterKey - Master encryption key
 * @param jsonData - JSON string of encrypted data
 * @returns Decrypted plaintext
 */
export function decryptFromJSON(masterKey: string, jsonData: string): string {
  try {
    const encryptedData = JSON.parse(jsonData) as EncryptedData;
    return decrypt(masterKey, encryptedData);
  } catch (error) {
    throw new Error(`Failed to parse or decrypt JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Hash a value for comparison (one-way, not for storage)
 * Useful for API key obfuscation in logs
 * 
 * @param data - Data to hash
 * @returns SHA-256 hash in hex
 */
export function hashValue(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Obfuscate a sensitive value for logging
 * Shows first 4 and last 4 characters, replaces middle with asterisks
 * 
 * @param value - Value to obfuscate
 * @returns Obfuscated string
 * 
 * @example
 * obfuscate('sk-1234567890abcdef') // Returns: 'sk-1...def'
 */
export function obfuscate(value: string): string {
  if (value.length <= 8) {
    return '*'.repeat(Math.max(1, value.length - 1));
  }
  return value.substring(0, 4) + '***' + value.substring(value.length - 4);
}

/**
 * Verify that decryption works (for health checks)
 * 
 * @param masterKey - Master encryption key to test
 * @returns true if encryption/decryption works
 */
export function verifyEncryption(masterKey: string): boolean {
  try {
    const testData = 'test-' + Date.now();
    const encrypted = encrypt(masterKey, testData);
    const decrypted = decrypt(masterKey, encrypted);
    return decrypted === testData;
  } catch (error) {
    console.error('Encryption verification failed:', error);
    return false;
  }
}

/**
 * Validate encryption setup
 * 
 * @returns Object with validation status and messages
 */
export function validateEncryptionSetup(): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  const masterKey = process.env.MASTER_ENCRYPTION_KEY;
  if (!masterKey) {
    issues.push('MASTER_ENCRYPTION_KEY environment variable not set');
  } else if (masterKey.length < 32) {
    issues.push('MASTER_ENCRYPTION_KEY should be at least 32 characters');
  }

  if (!verifyEncryption(masterKey || '')) {
    issues.push('Encryption/decryption verification failed');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Export for use in module integration
 */
export default {
  encrypt,
  decrypt,
  encryptToJSON,
  decryptFromJSON,
  deriveKey,
  hashValue,
  obfuscate,
  verifyEncryption,
  validateEncryptionSetup,
  ENCRYPTION_CONFIG,
};
