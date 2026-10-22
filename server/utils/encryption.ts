/**
 * Encryption Utility (Production)
 * AES-256-GCM with PBKDF2 key derivation, key versioning, and AAD support.
 *
 * Design goals:
 * - Authenticated encryption (confidentiality + integrity)
 * - Unique IV + salt per encryption
 * - Non-blocking (async) crypto
 * - Support for key rotation
 * - Safe failure modes
 */

import { randomBytes, pbkdf2, createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'crypto';
import type { CipherGCM, DecipherGCM } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const ENCRYPTION_CONFIG = {
  ALGORITHM: 'aes-256-gcm' as const,
  IV_LENGTH: 12,          // 96-bit IV is recommended for GCM
  SALT_LENGTH: 32,        // 256-bit salt
  TAG_LENGTH: 16,         // 128-bit auth tag
  KEY_LENGTH: 32,         // 256-bit key
  PBKDF2_ITERATIONS: 210_000, // OWASP recommendation (2023+)
  PBKDF2_DIGEST: 'sha512' as const,
  CURRENT_KEY_VERSION: 1,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EncryptedPayload {
  /** Key version used for this ciphertext (for rotation) */
  v: number;
  /** Base64 IV */
  iv: string;
  /** Base64 salt */
  salt: string;
  /** Base64 authentication tag */
  tag: string;
  /** Base64 ciphertext */
  ct: string;
  /** Algorithm identifier */
  alg: string;
  /** Optional base64-encoded Additional Authenticated Data */
  aad?: string;
}

export type EncryptedData = EncryptedPayload;

export type EncryptOptions = {
  /** Additional Authenticated Data – bound to the ciphertext */
  aad?: string | Buffer;
  /** Override key version (normally use CURRENT_KEY_VERSION) */
  keyVersion?: number;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function requireMasterKey(masterKey: string): void {
  if (!masterKey || typeof masterKey !== 'string') {
    throw new Error('Master encryption key is required');
  }
  // Enforce minimum entropy: at least 32 bytes when base64-decoded, or 32 chars
  const looksBase64 = /^[A-Za-z0-9+/]+=*$/.test(masterKey) && masterKey.length >= 44;
  if (!looksBase64 && masterKey.length < 32) {
    throw new Error('Master encryption key must be at least 32 characters (or a strong base64 secret)');
  }
}

async function deriveKey(masterKey: string, salt: Buffer): Promise<Buffer> {
  return pbkdf2Async(
    masterKey,
    salt,
    ENCRYPTION_CONFIG.PBKDF2_ITERATIONS,
    ENCRYPTION_CONFIG.KEY_LENGTH,
    ENCRYPTION_CONFIG.PBKDF2_DIGEST
  );
}

function toBuffer(data: string | Buffer): Buffer {
  return Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
}

function safeZero(buf: Buffer): void {
  if (buf && buf.length) {
    buf.fill(0);
  }
}

function validatePayload(payload: unknown): asserts payload is EncryptedPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid encrypted payload: not an object');
  }
  const p = payload as Record<string, unknown>;

  const required = ['v', 'iv', 'salt', 'tag', 'ct', 'alg'] as const;
  for (const field of required) {
    if (typeof p[field] !== (field === 'v' ? 'number' : 'string')) {
      throw new Error(`Invalid encrypted payload: missing or invalid field "${field}"`);
    }
  }

  if (p.alg !== ENCRYPTION_CONFIG.ALGORITHM) {
    throw new Error(`Unsupported algorithm: ${p.alg}`);
  }
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * @param masterKey  High-entropy secret from environment / KMS
 * @param plaintext  Data to protect
 * @param options    Optional AAD and key version
 */
export async function encrypt(
  masterKey: string,
  plaintext: string,
  options: EncryptOptions = {}
): Promise<EncryptedPayload> {
  requireMasterKey(masterKey);

  if (typeof plaintext !== 'string') {
    throw new Error('Plaintext must be a string');
  }

  const iv = randomBytes(ENCRYPTION_CONFIG.IV_LENGTH);
  const salt = randomBytes(ENCRYPTION_CONFIG.SALT_LENGTH);
  let key: Buffer | null = null;

  try {
    key = await deriveKey(masterKey, salt);

    const cipher = createCipheriv(
      ENCRYPTION_CONFIG.ALGORITHM,
      key,
      iv
    ) as CipherGCM;

    const aadBuf = options.aad ? toBuffer(options.aad) : undefined;
    if (aadBuf) {
      cipher.setAAD(aadBuf);
    }

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    const payload: EncryptedPayload = {
      v: options.keyVersion ?? ENCRYPTION_CONFIG.CURRENT_KEY_VERSION,
      iv: iv.toString('base64'),
      salt: salt.toString('base64'),
      tag: tag.toString('base64'),
      ct: ciphertext.toString('base64'),
      alg: ENCRYPTION_CONFIG.ALGORITHM,
    };

    if (aadBuf) {
      payload.aad = aadBuf.toString('base64');
    }

    return payload;
  } catch (err) {
    throw new Error(
      `Encryption failed: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    if (key) safeZero(key);
  }
}

/**
 * Decrypt a payload previously produced by `encrypt`.
 *
 * Throws on any authentication / integrity failure.
 */
export async function decrypt(
  masterKey: string,
  payload: EncryptedPayload,
  options: { aad?: string | Buffer } = {}
): Promise<string> {
  requireMasterKey(masterKey);
  validatePayload(payload);

  const iv = Buffer.from(payload.iv, 'base64');
  const salt = Buffer.from(payload.salt, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const ciphertext = Buffer.from(payload.ct, 'base64');

  if (iv.length !== ENCRYPTION_CONFIG.IV_LENGTH) {
    throw new Error('Invalid IV length');
  }
  if (tag.length !== ENCRYPTION_CONFIG.TAG_LENGTH) {
    throw new Error('Invalid authentication tag length');
  }

  let key: Buffer | null = null;

  try {
    key = await deriveKey(masterKey, salt);

    const decipher = createDecipheriv(
      ENCRYPTION_CONFIG.ALGORITHM,
      key,
      iv
    ) as DecipherGCM;

    // Prefer caller-supplied AAD; fall back to the one stored in the payload
    const aadSource = options.aad ?? (payload.aad ? Buffer.from(payload.aad, 'base64') : undefined);
    if (aadSource) {
      decipher.setAAD(toBuffer(aadSource));
    }

    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (err) {
    // Never leak whether the failure was auth-tag, padding, or key mismatch
    throw new Error(
      'Decryption failed – data may be tampered with or the master key is incorrect'
    );
  } finally {
    if (key) safeZero(key);
  }
}

// ---------------------------------------------------------------------------
// Convenience wrappers (JSON storage)
// ---------------------------------------------------------------------------

export async function encryptToJSON(
  masterKey: string,
  plaintext: string,
  options?: EncryptOptions
): Promise<string> {
  const payload = await encrypt(masterKey, plaintext, options);
  return JSON.stringify(payload);
}

export async function decryptFromJSON(
  masterKey: string,
  json: string,
  options?: { aad?: string | Buffer }
): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid encrypted JSON');
  }
  return decrypt(masterKey, parsed as EncryptedPayload, options);
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * One-way SHA-256 hash (hex). Useful for log correlation, never for storage of secrets.
 */
export function hashValue(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Conservative obfuscation for logs.
 * Shows only the first 2 and last 2 characters when the value is long enough.
 */
export function obfuscate(value: string): string {
  if (!value) return '***';
  if (value.length <= 6) return '*'.repeat(value.length);
  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}

/**
 * Constant-time string comparison (for tokens, etc.)
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Health-check: encrypt → decrypt round-trip.
 */
export async function verifyEncryption(masterKey: string): Promise<boolean> {
  try {
    const test = `healthcheck-${Date.now()}-${randomBytes(8).toString('hex')}`;
    const encrypted = await encrypt(masterKey, test);
    const decrypted = await decrypt(masterKey, encrypted);
    return decrypted === test;
  } catch {
    return false;
  }
}

/**
 * Validate that the environment is correctly configured for encryption.
 */
export async function validateEncryptionSetup(): Promise<{
  isValid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;

  if (!masterKey) {
    issues.push('MASTER_ENCRYPTION_KEY environment variable is not set');
  } else {
    try {
      requireMasterKey(masterKey);
    } catch (err) {
      issues.push(err instanceof Error ? err.message : String(err));
    }

    const ok = await verifyEncryption(masterKey);
    if (!ok) {
      issues.push('Encryption/decryption round-trip verification failed');
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Key-rotation helper (optional but recommended)
// ---------------------------------------------------------------------------

/**
 * Re-encrypt a payload under a new master key / version.
 * Useful during key rotation ceremonies.
 */
export async function reEncrypt(
  oldMasterKey: string,
  newMasterKey: string,
  payload: EncryptedPayload,
  options?: { aad?: string | Buffer; newKeyVersion?: number }
): Promise<EncryptedPayload> {
  const plaintext = await decrypt(oldMasterKey, payload, { aad: options?.aad });
  return encrypt(newMasterKey, plaintext, {
    aad: options?.aad,
    keyVersion: options?.newKeyVersion ?? ENCRYPTION_CONFIG.CURRENT_KEY_VERSION + 1,
  });
}