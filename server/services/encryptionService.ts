/**
 * Encryption Service
 * 
 * Provides secure encryption/decryption for sensitive data using libsodium
 * (libsodium-wrappers for Node.js).
 * 
 * Uses XSalsa20-Poly1305 (secretbox) with:
 * - Versioned master key from ENCRYPTION_KEY_V{version} or the legacy ENCRYPTION_KEY env variable
 * - Random nonce and key-version header prepended to new ciphertexts
 * - Authenticated encryption (prevents tampering)
 * 
 * Key Rotation: To rotate keys:
 * 1. Keep the previous key in ENCRYPTION_KEY_V{oldVersion}
 * 2. Set ENCRYPTION_KEY_V{newVersion} and ENCRYPTION_KEY_VERSION={newVersion}
 * 3. Re-encrypt stored credentials; old versioned ciphertexts remain decryptable
 */

import sodium from 'libsodium-wrappers';
import { logger } from '../utils/logger';

// Sodium constants
const NONCE_LENGTH = 24; // XSalsa20-Poly1305 nonce size
const KEY_LENGTH = 32;   // 256-bit key for secretbox
const POLY1305_TAG_LENGTH = 16; // Authentication tag size
const ENVELOPE_MAGIC = Buffer.from('MTAAKEY1', 'ascii');
const ENVELOPE_HEADER_LENGTH = ENVELOPE_MAGIC.length + 1;
const keyCache = new Map<number, Buffer>();

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
function getMasterKey(version = getActiveKeyVersion()): Buffer {
  const cached = keyCache.get(version);
  if (cached) return cached;

  const variableName = `ENCRYPTION_KEY_V${version}`;
  const keyEnv = process.env[variableName] ?? (version === 1 ? process.env.ENCRYPTION_KEY : undefined);
  if (!keyEnv) {
    throw new Error(`${variableName}${version === 1 ? ' (or ENCRYPTION_KEY)' : ''} environment variable not set`);
  }
  if (!/^[0-9a-f]{64}$/i.test(keyEnv)) {
    throw new Error(`${variableName} must be exactly 64 hexadecimal characters (32 bytes)`);
  }

  const key = Buffer.from(keyEnv, 'hex');
  keyCache.set(version, key);
  return key;
}

function getActiveKeyVersion(): number {
  const rawVersion = process.env.ENCRYPTION_KEY_VERSION ?? '1';
  const version = Number(rawVersion);
  if (!Number.isInteger(version) || version < 1 || version > 255) {
    throw new Error('ENCRYPTION_KEY_VERSION must be an integer between 1 and 255');
  }
  return version;
}

/**
 * Encrypt a value using XSalsa20-Poly1305
 * 
 * Format: [magic (3 bytes)][key version (1 byte)][nonce (24 bytes)][ciphertext + tag].
 * Legacy nonce-prefixed ciphertexts continue to decrypt using key version 1.
 * 
 * @param plaintext - Value to encrypt (string)
 * @returns Encrypted value as Buffer (version header + nonce + ciphertext)
 */
export async function encrypt(plaintext: string): Promise<Buffer> {
  await initSodium();

  try {
    const keyVersion = getActiveKeyVersion();
    const key = getMasterKey(keyVersion);
    
    // Validate key length
    if (key.length !== KEY_LENGTH) {
      throw new Error(`Invalid key length: expected ${KEY_LENGTH}, got ${key.length}`);
    }

    // Generate random nonce
    const nonce = sodium.randombytes_buf(NONCE_LENGTH);
    
    // Encrypt plaintext with authenticated encryption
    // Buffer is a Uint8Array, the byte-array type required by libsodium.
    const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, new Uint8Array(key));

    // Combine nonce + ciphertext (so we know which nonce to use for decryption)
    const header = Buffer.concat([ENVELOPE_MAGIC, Buffer.from([keyVersion])]);
    const encrypted = Buffer.concat([header, nonce, Buffer.from(ciphertext)]);
    
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
 * Supports versioned envelopes and legacy [nonce][ciphertext] values.
 * 
 * @param encrypted - Encrypted value as Buffer
 * @returns Decrypted plaintext string
 */
export async function decrypt(encrypted: Buffer): Promise<string> {
  await initSodium();

  try {
    const hasVersionedHeader = encrypted.length >= ENVELOPE_HEADER_LENGTH
      && encrypted.subarray(0, ENVELOPE_MAGIC.length).equals(ENVELOPE_MAGIC);
    const keyVersion = hasVersionedHeader ? encrypted[ENVELOPE_MAGIC.length] : 1;
    const payloadOffset = hasVersionedHeader ? ENVELOPE_HEADER_LENGTH : 0;
    if (hasVersionedHeader && keyVersion === 0) throw new Error('Unsupported encryption key version: 0');
    const key = getMasterKey(keyVersion);

    const minimumLength = payloadOffset + NONCE_LENGTH + POLY1305_TAG_LENGTH;
    if (encrypted.length < minimumLength) {
      throw new Error(`Invalid ciphertext length: ${encrypted.length} (minimum: ${minimumLength})`);
    }

    const nonce = encrypted.subarray(payloadOffset, payloadOffset + NONCE_LENGTH);
    const ciphertext = encrypted.subarray(payloadOffset + NONCE_LENGTH);

    // Decrypt with authenticated decryption
    const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, new Uint8Array(key));
    
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
  const keyBytes = sodium.randombytes_buf(KEY_LENGTH);
  return sodium.to_hex(keyBytes);
}

export default {
  encrypt,
  decrypt,
  isEncryptionKeyConfigured,
  generateMasterKey,
};
