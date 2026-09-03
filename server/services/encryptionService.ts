/**
 * Encryption Service
 * 
 * Provides secure encryption/decryption for sensitive data using libsodium
 * (libsodium-wrappers for Node.js).
 * 
 * Uses XSalsa20-Poly1305 (secretbox) with:
 * - Master key from ENCRYPTION_KEY env variable
 * - Random nonce prepended to ciphertext for each encryption
 * - Authenticated encryption (prevents tampering)
 * 
 * Key Rotation: To rotate keys:
 * 1. Decrypt all credentials with old key
 * 2. Re-encrypt with new key
 * 3. Update ENCRYPTION_KEY env variable
 */

import sodium from 'libsodium-wrappers';
import { logger } from '../utils/logger';

// Sodium constants
const NONCE_LENGTH = 24; // XSalsa20-Poly1305 nonce size
const KEY_LENGTH = 32;   // 256-bit key for secretbox
const POLY1305_TAG_LENGTH = 16; // Authentication tag size

let sodiumReady = false;

/**
 * Initialize sodium library (must be called before using encryption)
 */
async function initSodium(): Promise<void> {
  if (sodiumReady) return;
  
  try {
    await sodium.ready;
    sodiumReady = true;
    logger.info('[EncryptionService] Libsodium initialized');
  } catch (err) {
    logger.error('[EncryptionService] Failed to initialize libsodium:', err);
    throw err;
  }
}

/**
 * Get master encryption key from environment
 * Must be a 32-byte hex string (64 hex chars)
 */
function getMasterKey(): Buffer {
  const keyEnv = process.env.ENCRYPTION_KEY;
  
  if (!keyEnv) {
    throw new Error('ENCRYPTION_KEY environment variable not set');
  }

  // Expect 64 hex characters = 32 bytes
  if (keyEnv.length !== 64) {
    throw new Error(`ENCRYPTION_KEY must be 64 hex characters (32 bytes), got ${keyEnv.length}`);
  }

  try {
    return Buffer.from(keyEnv, 'hex');
  } catch (err) {
    throw new Error(`ENCRYPTION_KEY must be valid hex string: ${err}`);
  }
}

/**
 * Encrypt a value using XSalsa20-Poly1305
 * 
 * Format: [nonce (24 bytes)][ciphertext + tag (variable)]
 * The nonce is prepended so decryption knows which nonce was used.
 * 
 * @param plaintext - Value to encrypt (string)
 * @returns Encrypted value as Buffer (nonce + ciphertext)
 */
export async function encrypt(plaintext: string): Promise<Buffer> {
  await initSodium();

  try {
    const key = getMasterKey();
    
    // Validate key length
    if (key.length !== KEY_LENGTH) {
      throw new Error(`Invalid key length: expected ${KEY_LENGTH}, got ${key.length}`);
    }

    // Generate random nonce
    const nonce = sodium.randombytes(NONCE_LENGTH);
    
    // Encrypt plaintext with authenticated encryption
    const ciphertext = sodium.crypto_secretbox_easy(
      plaintext,
      nonce,
      key
    );

    // Combine nonce + ciphertext (so we know which nonce to use for decryption)
    const encrypted = Buffer.concat([nonce, Buffer.from(ciphertext)]);
    
    logger.debug(`[EncryptionService] Encrypted ${plaintext.length} bytes → ${encrypted.length} bytes`);
    
    return encrypted;
  } catch (err) {
    logger.error('[EncryptionService] Encryption failed:', err);
    throw new Error(`Encryption failed: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Decrypt a value encrypted with encrypt()
 * 
 * Assumes format: [nonce (24 bytes)][ciphertext + tag (variable)]
 * 
 * @param encrypted - Encrypted value as Buffer
 * @returns Decrypted plaintext string
 */
export async function decrypt(encrypted: Buffer): Promise<string> {
  await initSodium();

  try {
    const key = getMasterKey();
    
    // Validate key length
    if (key.length !== KEY_LENGTH) {
      throw new Error(`Invalid key length: expected ${KEY_LENGTH}, got ${key.length}`);
    }

    // Validate ciphertext length (must be at least nonce + tag)
    if (encrypted.length < NONCE_LENGTH + POLY1305_TAG_LENGTH) {
      throw new Error(`Invalid ciphertext length: ${encrypted.length} (minimum: ${NONCE_LENGTH + POLY1305_TAG_LENGTH})`);
    }

    // Extract nonce and ciphertext
    const nonce = encrypted.slice(0, NONCE_LENGTH);
    const ciphertext = encrypted.slice(NONCE_LENGTH);

    // Decrypt with authenticated decryption
    const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
    
    const result = sodium.to_string(plaintext);
    logger.debug(`[EncryptionService] Decrypted ${encrypted.length} bytes → ${result.length} bytes`);
    
    return result;
  } catch (err) {
    logger.error('[EncryptionService] Decryption failed:', err);
    throw new Error(`Decryption failed: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Check if encryption key is properly configured
 */
export function isEncryptionKeyConfigured(): boolean {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a new master encryption key (for setup/key rotation)
 * Returns as 64-character hex string (suitable for env variable)
 */
export async function generateMasterKey(): Promise<string> {
  await initSodium();
  const keyBytes = sodium.randombytes(KEY_LENGTH);
  return sodium.to_hex(keyBytes);
}

export default {
  encrypt,
  decrypt,
  isEncryptionKeyConfigured,
  generateMasterKey,
};
