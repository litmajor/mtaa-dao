import crypto from 'crypto';
import { promisify } from 'util';
import { ethers } from 'ethers';

// Promisify intensive crypto operations to keep the event loop non-blocking
const pbkdf2Async = promisify(crypto.pbkdf2);

// Configuration Constants
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 600000; // OWASP recommendation for PBKDF2-HMAC-SHA256
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

// Standard Ethereum derivation path
const DEFAULT_DERIVATION_PATH = "m/44'/60'/0'/0/0";

export interface WalletCredentials {
  address: string;
  privateKey: string;
  mnemonic?: string;
}

export interface EncryptedWallet {
  encryptedData: string;
  salt: string;
  iv: string;
  authTag: string;
}

/**
 * Normalizes and validates a private key string's FORMAT ONLY (64 hex
 * chars). This does not guarantee the value is a valid secp256k1 scalar —
 * a well-formatted key can still be out of curve range (e.g. all zeros,
 * or >= curve order n). Callers that construct an ethers.Wallet from the
 * result must still handle that case; see safeWalletFromKey below.
 */
export function normalizePrivateKey(key: string | undefined | null): string | null {
  if (!key) return null;
  let pk = String(key).trim();
  if (!pk.startsWith('0x')) pk = `0x${pk}`;
  return /^0x[0-9a-fA-F]{64}$/.test(pk) ? pk : null;
}

/**
 * Constructs an ethers.Wallet from a normalized key, catching the
 * curve-range validation ethers itself performs (throws on keys that are
 * zero or >= secp256k1's order). Returns null on any failure instead of
 * throwing, so every caller in this file has one consistent contract:
 * invalid key in, null out — never an uncaught exception.
 */
function safeWalletFromKey(normalizedKey: string, provider?: ethers.Provider): ethers.Wallet | null {
  try {
    return provider ? new ethers.Wallet(normalizedKey, provider) : new ethers.Wallet(normalizedKey);
  } catch {
    return null;
  }
}

/**
 * Validates a BIP39 mnemonic phrase using native Ethers v6 methods.
 */
export function isValidMnemonic(mnemonic: string | undefined | null): boolean {
  if (!mnemonic) return false;
  return ethers.Mnemonic.isValidMnemonic(mnemonic.trim());
}

/**
 * Generate a new wallet with an Ethers-native BIP39 mnemonic.
 */
export function generateWalletFromMnemonic(wordCount: 12 | 24 = 12): WalletCredentials {
  const entropyLength = wordCount === 12 ? 16 : 32;
  const entropy = crypto.randomBytes(entropyLength);

  // Create phrase directly from secure entropy source
  const mnemonicPhrase = ethers.Mnemonic.entropyToPhrase(entropy);
  const mnemonicInstance = ethers.Mnemonic.fromPhrase(mnemonicPhrase);
  const hdNode = ethers.HDNodeWallet.fromMnemonic(mnemonicInstance, DEFAULT_DERIVATION_PATH);

  return {
    address: hdNode.address,
    privateKey: hdNode.privateKey,
    mnemonic: mnemonicPhrase,
  };
}

/**
 * Recover a wallet from a mnemonic phrase securely.
 */
export function recoverWalletFromMnemonic(mnemonic: string, path = DEFAULT_DERIVATION_PATH): WalletCredentials {
  const cleanedMnemonic = mnemonic.trim();
  if (!isValidMnemonic(cleanedMnemonic)) {
    throw new Error('WalletRecoveryError: Invalid BIP39 mnemonic phrase provided.');
  }

  const mnemonicInstance = ethers.Mnemonic.fromPhrase(cleanedMnemonic);
  const hdNode = ethers.HDNodeWallet.fromMnemonic(mnemonicInstance, path);

  return {
    address: hdNode.address,
    privateKey: hdNode.privateKey,
    mnemonic: cleanedMnemonic,
  };
}

/**
 * Import a wallet from a raw private key string.
 * FIX: previously called `new ethers.Wallet(normalizedKey)` unguarded —
 * a regex-valid but curve-invalid key (e.g. all zeros) threw an
 * undocumented ethers-native error instead of the documented
 * WalletImportError. Now routed through safeWalletFromKey so the
 * documented contract actually holds.
 */
export function importWalletFromPrivateKey(privateKey: string): WalletCredentials {
  const normalizedKey = normalizePrivateKey(privateKey);
  if (!normalizedKey) {
    throw new Error('WalletImportError: Invalid private key format. Must be a 32-byte hex string.');
  }

  const wallet = safeWalletFromKey(normalizedKey);
  if (!wallet) {
    throw new Error('WalletImportError: Private key is not a valid secp256k1 scalar.');
  }

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

/**
 * Encrypt wallet credentials using non-blocking asynchronous AES-256-GCM.
 */
export async function encryptWallet(walletData: WalletCredentials, password: string): Promise<EncryptedWallet> {
  const salt = crypto.randomBytes(SALT_LENGTH);

  // Offloads expensive key derivation math to the libuv thread pool
  const key = await pbkdf2Async(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  const dataToEncrypt = JSON.stringify({
    privateKey: walletData.privateKey,
    mnemonic: walletData.mnemonic,
  });

  let encrypted = cipher.update(dataToEncrypt, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypt wallet credentials using non-blocking asynchronous AES-256-GCM.
 */
export async function decryptWallet(encryptedWallet: EncryptedWallet, password: string): Promise<WalletCredentials> {
  const salt = Buffer.from(encryptedWallet.salt, 'hex');

  // Offloads expensive key derivation math to the libuv thread pool
  const key = await pbkdf2Async(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST);
  const iv = Buffer.from(encryptedWallet.iv, 'hex');
  const authTag = Buffer.from(encryptedWallet.authTag, 'hex');

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted: string;
  try {
    decrypted = decipher.update(encryptedWallet.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
  } catch {
    throw new Error('WalletDecryptionError: Failed to decrypt wallet. Invalid password or tampered data.');
  }

  const walletData = JSON.parse(decrypted);
  const normalizedKey = normalizePrivateKey(walletData.privateKey);

  if (!normalizedKey) {
    throw new Error('WalletDecryptionError: Decrypted private key is malformed or corrupted.');
  }

  const wallet = safeWalletFromKey(normalizedKey);
  if (!wallet) {
    throw new Error('WalletDecryptionError: Decrypted private key is not a valid secp256k1 scalar.');
  }

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: walletData.mnemonic,
  };
}

/**
 * Helper to safely instantiate an Ethers wallet instance for on-chain
 * interactions. FIX: previously threw uncaught on a regex-valid but
 * curve-invalid key, contradicting its own name/contract ("IfValid").
 * Now genuinely returns null for any invalid key, never throws.
 */
export function createWalletInstance(key: string | undefined | null, provider?: ethers.Provider): ethers.Wallet | null {
  const normalizedKey = normalizePrivateKey(key);
  if (!normalizedKey) return null;
  return safeWalletFromKey(normalizedKey, provider);
}

export const createWalletIfValid = createWalletInstance; // Alias for clarity in context of private key usage