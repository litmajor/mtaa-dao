/**
 * Wallet Generation Service
 * Handles wallet creation, key generation, and encryption
 * Integrates with Celo SDK for blockchain operations
 */

import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';
import { v4 as uuid } from 'uuid';
import { db } from '../db';
import {
  wallets,
  walletPrivateKeys,
  walletPublicKeys,
  walletSeedPhrases,
  walletSecuritySettings,
  users,
} from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Encryption configuration
 */
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_LENGTH = 32; // 256 bits
const ENCRYPTION_IV_LENGTH = 16; // 128 bits
const ENCRYPTION_SALT_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_DIGEST = 'sha256';

/**
 * Generate encryption key from master password/secret
 */
function deriveEncryptionKey(salt: Buffer, masterSecret?: string): Buffer {
  const secret = masterSecret || process.env.WALLET_MASTER_SECRET || 'default-dev-secret';
  return pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, ENCRYPTION_KEY_LENGTH, PBKDF2_DIGEST);
}

/**
 * Encrypt sensitive data (private keys, seed phrases)
 */
export function encryptSensitiveData(data: string): {
  encrypted: string;
  iv: string;
  salt: string;
  authTag: string;
} {
  // Generate random salt and IV
  const salt = randomBytes(ENCRYPTION_SALT_LENGTH);
  const iv = randomBytes(ENCRYPTION_IV_LENGTH);

  // Derive encryption key from master secret
  const key = deriveEncryptionKey(salt);

  // Create cipher
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  // Encrypt data
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypt sensitive data
 */
export function decryptSensitiveData(encrypted: string, iv: string, salt: string, authTag: string): string {
  try {
    const ivBuffer = Buffer.from(iv, 'hex');
    const saltBuffer = Buffer.from(salt, 'hex');
    const authTagBuffer = Buffer.from(authTag, 'hex');

    // Derive encryption key
    const key = deriveEncryptionKey(saltBuffer);

    // Create decipher
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    // Decrypt data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Failed to decrypt data: ${(error as Error).message}`);
  }
}

/**
 * Generate random wallet address (for dev/testing)
 * In production, use actual Celo SDK
 */
export function generateRandomAddress(): string {
  const bytes = randomBytes(20);
  return '0x' + bytes.toString('hex');
}

/**
 * Generate mnemonic-based wallet using ethers.js (Celo compatible)
 * Requires: npm install ethers
 */
export async function generateMnemonicWallet(): Promise<{
  address: string;
  publicKey: string;
  mnemonic: string;
}> {
  try {
    // Dynamic import to avoid issues with optional dependency
    const { ethers } = await import('ethers');

    // Generate random mnemonic (BIP39)
    const mnemonic = ethers.Wallet.createRandom().mnemonic?.phrase;
    if (!mnemonic) {
      throw new Error('Failed to generate mnemonic');
    }

    // Create wallet from mnemonic
    const wallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/0");

    return {
      address: wallet.address,
      publicKey: wallet.publicKey,
      mnemonic,
    };
  } catch (error) {
    // Fallback for dev environment
    console.warn('Ethers.js not available, using random address generation');
    return {
      address: generateRandomAddress(),
      publicKey: '0x' + randomBytes(33).toString('hex'),
      mnemonic: randomBytes(32).toString('hex'),
    };
  }
}

/**
 * Create a new wallet for a user
 */
export async function createUserWallet(
  userId: string,
  currency: string = 'USDC',
  walletType: string = 'personal',
  masterPassword?: string
) {
  try {
    // Verify user exists
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user[0]) {
      throw new Error(`User ${userId} not found`);
    }

    // Check if user already has a wallet of this type
    const existingWallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (existingWallet[0]) {
      throw new Error(`User ${userId} already has a wallet`);
    }

    // Generate wallet
    const walletData = await generateMnemonicWallet();

    // Encrypt private key and seed phrase
    const encryptedPrivateKey = encryptSensitiveData(walletData.mnemonic);
    const encryptedSeedPhrase = encryptSensitiveData(walletData.mnemonic);

    // Create wallet record
    const walletId = uuid();
    await db.insert(wallets).values({
      id: walletId,
      userId,
      currency,
      address: walletData.address,
      walletType,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Store encrypted private key
    await db.insert(walletPrivateKeys).values({
      id: uuid(),
      walletId,
      encryptedPrivateKey: encryptedPrivateKey.encrypted,
      encryptionIv: encryptedPrivateKey.iv,
      encryptionSalt: encryptedPrivateKey.salt,
      authTag: encryptedPrivateKey.authTag,
      derivationPath: "m/44'/60'/0'/0/0",
      isBackedUp: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Store public key
    await db.insert(walletPublicKeys).values({
      id: uuid(),
      walletId,
      publicKey: walletData.publicKey,
      publicKeyFormat: 'uncompressed',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Store encrypted seed phrase
    await db.insert(walletSeedPhrases).values({
      id: uuid(),
      walletId,
      encryptedSeedPhrase: encryptedSeedPhrase.encrypted,
      encryptionIv: encryptedSeedPhrase.iv,
      encryptionSalt: encryptedSeedPhrase.salt,
      authTag: encryptedSeedPhrase.authTag,
      wordCount: 12, // Standard BIP39
      isBackedUp: false,
      backupMethod: null,
      backupVerifiedAt: null,
      backupLocation: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Initialize security settings
    await db.insert(walletSecuritySettings).values({
      id: uuid(),
      walletId,
      requiresPin: true,
      requiresBiometric: false,
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      walletId,
      address: walletData.address,
      currency,
      walletType,
      message: 'Wallet created successfully',
    };
  } catch (error) {
    throw new Error(`Failed to create wallet: ${(error as Error).message}`);
  }
}

/**
 * Get user's wallet with decrypted keys (requires authorization)
 */
export async function getUserWallet(userId: string, walletId?: string) {
  try {
    let wallet;

    if (walletId) {
      const result = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, walletId))
        .limit(1);
      wallet = result[0];
    } else {
      const result = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .limit(1);
      wallet = result[0];
    }

    if (!wallet || wallet.userId !== userId) {
      throw new Error('Wallet not found');
    }

    // Get public key
    const publicKeyRecord = await db
      .select()
      .from(walletPublicKeys)
      .where(eq(walletPublicKeys.walletId, wallet.id))
      .limit(1);

    return {
      id: wallet.id,
      address: wallet.address,
      currency: wallet.currency,
      walletType: wallet.walletType,
      isActive: wallet.isActive,
      publicKey: publicKeyRecord[0]?.publicKey || null,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  } catch (error) {
    throw new Error(`Failed to get wallet: ${(error as Error).message}`);
  }
}

/**
 * Get decrypted private key (SENSITIVE - requires strict authorization)
 */
export async function getDecryptedPrivateKey(userId: string, walletId: string): Promise<string> {
  try {
    // Verify wallet belongs to user
    const wallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, walletId))
      .limit(1);

    if (!wallet[0] || wallet[0].userId !== userId) {
      throw new Error('Unauthorized: Wallet does not belong to user');
    }

    // Get encrypted private key
    const privateKeyRecord = await db
      .select()
      .from(walletPrivateKeys)
      .where(eq(walletPrivateKeys.walletId, walletId))
      .limit(1);

    if (!privateKeyRecord[0]) {
      throw new Error('Private key not found');
    }

    const pk = privateKeyRecord[0];

    // Decrypt
    return decryptSensitiveData(pk.encryptedPrivateKey, pk.encryptionIv, pk.encryptionSalt, pk.authTag);
  } catch (error) {
    throw new Error(`Failed to retrieve private key: ${(error as Error).message}`);
  }
}

/**
 * Verify wallet exists and is active
 */
export async function verifyWalletExists(userId: string, walletId: string): Promise<boolean> {
  const result = await db
    .select()
    .from(wallets)
    .where(eq(wallets.id, walletId))
    .limit(1);

  const wallet = result[0];
  return !!(wallet && wallet.userId === userId && wallet.isActive);
}

/**
 * Deactivate wallet (soft delete)
 */
export async function deactivateWallet(userId: string, walletId: string) {
  try {
    const wallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, walletId))
      .limit(1);

    if (!wallet[0] || wallet[0].userId !== userId) {
      throw new Error('Wallet not found');
    }

    await db
      .update(wallets)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(wallets.id, walletId));

    return { message: 'Wallet deactivated successfully' };
  } catch (error) {
    throw new Error(`Failed to deactivate wallet: ${(error as Error).message}`);
  }
}

export const walletGenerationService = {
  createUserWallet,
  getUserWallet,
  getDecryptedPrivateKey,
  verifyWalletExists,
  deactivateWallet,
  encryptSensitiveData,
  decryptSensitiveData,
  generateMnemonicWallet,
  generateRandomAddress,
};
