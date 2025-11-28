
import crypto from 'crypto';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from 'bip39';
import { ethers } from 'ethers';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

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
 * Generate a new wallet with BIP39 mnemonic
 */
export function generateWalletFromMnemonic(wordCount: 12 | 24 = 12): WalletCredentials {
  const strength = wordCount === 12 ? 128 : 256;
  const mnemonic = generateMnemonic(strength);
  
  // Create wallet from mnemonic using ethers
  // Use ethers HDNode for derivation
  const mnemonicWallet = ethers.Mnemonic.fromPhrase(mnemonic);
  const hdnode = ethers.HDNodeWallet.fromMnemonic(mnemonicWallet, "m/44'/60'/0'/0/0");
  
  return {
    address: hdnode.address,
    privateKey: hdnode.privateKey,
    mnemonic
  };
}

/**
 * Recover wallet from mnemonic phrase
 */
export function recoverWalletFromMnemonic(mnemonic: string): WalletCredentials {
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }
  
  const mnemonicWallet = ethers.Mnemonic.fromPhrase(mnemonic);
  const hdnode = ethers.HDNodeWallet.fromMnemonic(mnemonicWallet, "m/44'/60'/0'/0/0");
  
  return {
    address: hdnode.address,
    privateKey: hdnode.privateKey,
    mnemonic
  };
}

/**
 * Import wallet from private key
 */
export function importWalletFromPrivateKey(privateKey: string): WalletCredentials {
  const wallet = new ethers.Wallet(privateKey);
  
  return {
    address: wallet.address,
    privateKey: wallet.privateKey
  };
}

/**
 * Encrypt wallet data with user password
 */
export function encryptWallet(walletData: WalletCredentials, password: string): EncryptedWallet {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  const dataToEncrypt = JSON.stringify({
    privateKey: walletData.privateKey,
    mnemonic: walletData.mnemonic
  });
  
  let encrypted = cipher.update(dataToEncrypt, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedData: encrypted,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt wallet data with user password
 */
export function decryptWallet(encryptedWallet: EncryptedWallet, password: string): WalletCredentials {
  const salt = Buffer.from(encryptedWallet.salt, 'hex');
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const iv = Buffer.from(encryptedWallet.iv, 'hex');
  const authTag = Buffer.from(encryptedWallet.authTag, 'hex');
  
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedWallet.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  const walletData = JSON.parse(decrypted);
  
  const wallet = new ethers.Wallet(walletData.privateKey);
  
  return {
    address: wallet.address,
    privateKey: walletData.privateKey,
    mnemonic: walletData.mnemonic
  };
}

/**
 * Validate mnemonic phrase
 */
export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic);
}
