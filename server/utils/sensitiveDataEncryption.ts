import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';

/**
 * WARNING: This module performs symmetric encryption using a server-side
 * master secret. DO NOT use this module to encrypt or decrypt user wallet
 * keystore blobs or any material that must remain non-custodial. The
 * project intentionally treats wallet backups as opaque blobs that the
 * server must never be able to decrypt.
 *
 * Use-cases: server-side secrets, tokens, or metadata that the server is
 * allowed to decrypt. For high-value uses prefer an HSM or envelope
 * encryption with key management.
 */

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_LENGTH = 32; // 256 bits
const ENCRYPTION_IV_LENGTH = 12; // 96 bits - recommended for GCM
const ENCRYPTION_SALT_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_DIGEST = 'sha256';

// Log a gentle warning at startup if master secret is not set. This
// encourages operators to provide a secure secret early in deployment.
if (!process.env.WALLET_MASTER_SECRET) {
  console.warn('[sensitiveDataEncryption] WALLET_MASTER_SECRET not set — encryption functions will throw when used');
}

export function deriveEncryptionKey(salt: Buffer, masterSecret?: string): Buffer {
  const secret = masterSecret ?? process.env.WALLET_MASTER_SECRET;
  if (!secret) {
    throw new Error('Wallet encryption master secret is not configured');
  }

  // PBKDF2 is acceptable here for interoperability; consider Argon2/scrypt
  // for higher security against offline brute-force. Iteration count is
  // configurable via env in case you later need to dial it up.
  return pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, ENCRYPTION_KEY_LENGTH, PBKDF2_DIGEST);
}

/**
 * Encrypts `data` and returns base64-encoded fields. Optional AAD binds a
 * purpose/version string to the ciphertext.
 */
export function encryptSensitiveData(
  data: string,
  masterSecret?: string,
  aad?: string
): {
  encrypted: string;
  iv: string;
  salt: string;
  authTag: string;
} {
  const salt = randomBytes(ENCRYPTION_SALT_LENGTH);
  const iv = randomBytes(ENCRYPTION_IV_LENGTH);
  const key = deriveEncryptionKey(salt, masterSecret);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));

  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('base64'),
    salt: salt.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptSensitiveData(
  encrypted: string,
  iv: string,
  salt: string,
  authTag: string,
  masterSecret?: string,
  aad?: string
): string {
  try {
    const ivBuffer = Buffer.from(iv, 'base64');
    const saltBuffer = Buffer.from(salt, 'base64');
    const authTagBuffer = Buffer.from(authTag, 'base64');
    const key = deriveEncryptionKey(saltBuffer, masterSecret);

    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, ivBuffer);
    if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(authTagBuffer);

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Failed to decrypt data: ${(error as Error).message}`);
  }
}
