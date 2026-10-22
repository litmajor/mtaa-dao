/**
 * CEX Credential Manager Service
 * 
 * Purpose: Manages per-user CEX account credentials with automatic decryption
 * and client initialization. Enables multi-user multi-account support while
 * maintaining security (keys never stored in memory unencrypted for long).
 * 
 * Architecture:
 * - Fetch encrypted credentials from DB on-demand
 * - Decrypt using encryption service
 * - Build exchange-specific CCXT instance
 * - Cache instance for TTL (5 minutes), then rebuild
 * - Support credential rotation without service restart
 */

import { pool } from '../db';
import { logger } from '../utils/logger';
import NodeCache from 'node-cache';
import ccxt from 'ccxt';
import { decrypt, isEncryptionKeyConfigured } from './encryptionService';

interface StoredCredential {
  id: string;
  user_id: string;
  exchange: string;
  api_key_encrypted: Buffer;
  api_secret_encrypted: Buffer;
  passphrase_encrypted?: Buffer;
  is_sandbox: boolean;
  is_active: boolean;
}

interface DecryptedCredential {
  credentialId: string;
  userId: string;
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  isSandbox: boolean;
}

/**
 * Credential Manager - handles per-user CEX account management
 */
export class CEXCredentialManager {
  private clientCache = new NodeCache({ stdTTL: 300 }); // 5-minute TTL for instances
  private credentialCache = new NodeCache({ stdTTL: 60 }); // 1-minute TTL for decrypted creds

  /**
   * Get or create CCXT client for a specific credential
   * 
   * @param credentialId - UUID of the stored credential row
   * @param userId - User ID for authorization check
   * @returns CCXT exchange instance (authenticated with credential's keys)
   */
  async getClientForCredential(credentialId: string, userId: string): Promise<any> {
    // Check cache first
    const cacheKey = `client:${credentialId}`;
    const cached = this.clientCache.get<any>(cacheKey);
    if (cached) {
      logger.debug(`[CEXCredentialManager] Using cached CCXT instance for credential ${credentialId}`);
      return cached;
    }

    // Fetch and decrypt credential from DB
    const credential = await this.getCredential(credentialId, userId);
    
    // Build CCXT instance
    const ExchangeClass = ccxt[credential.exchange.toLowerCase() as keyof typeof ccxt] as any;
    if (!ExchangeClass || typeof ExchangeClass !== 'function') {
      throw new Error(`Exchange class not found for ${credential.exchange}`);
    }

    const exchangeConfig: any = {
      enableRateLimit: true,
      rateLimit: this.calculateRateLimit(credential.exchange),
      timeout: Math.min(
        3000,
        Math.max(500, Number.parseInt(process.env.CCXT_TIMEOUT || '3000', 10) || 3000),
      ),
      apiKey: credential.apiKey,
      secret: credential.apiSecret,
      sandbox: credential.isSandbox,
    };

    // Exchange-specific configuration
    if (credential.exchange.toLowerCase() === 'kraken' || credential.exchange.toLowerCase() === 'okx') {
      exchangeConfig.password = credential.passphrase;
    }

    const client = new ExchangeClass(exchangeConfig);
    
    // Cache for TTL
    this.clientCache.set(cacheKey, client);
    logger.info(`[CEXCredentialManager] Created CCXT instance for ${credential.exchange} (credential: ${credentialId})`);
    
    return client;
  }

  /**
   * Fetch and decrypt a stored credential
   */
  private async getCredential(credentialId: string, userId: string): Promise<DecryptedCredential> {
    // Check cache first
    const cacheKey = `credential:${credentialId}`;
    const cached = this.credentialCache.get<DecryptedCredential>(cacheKey);
    if (cached) {
      logger.debug(`[CEXCredentialManager] Using cached decrypted credential for ${credentialId}`);
      return cached;
    }

    // Query DB
    const result = await pool.query(
      `SELECT id, user_id, exchange, api_key_encrypted, api_secret_encrypted, passphrase_encrypted, is_sandbox, is_active
       FROM cex_credentials WHERE id = $1 AND user_id = $2`,
      [credentialId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Credential ${credentialId} not found or unauthorized for user ${userId}`);
    }

    const row = result.rows[0] as StoredCredential;

    if (!row.is_active) {
      throw new Error(`Credential ${credentialId} is no longer active`);
    }

    // Decrypt
    const decrypted: DecryptedCredential = {
      credentialId: row.id,
      userId: row.user_id,
      exchange: row.exchange,
      apiKey: await this.decryptField(row.api_key_encrypted),
      apiSecret: await this.decryptField(row.api_secret_encrypted),
      passphrase: row.passphrase_encrypted ? await this.decryptField(row.passphrase_encrypted) : undefined,
      isSandbox: row.is_sandbox,
    };

    // Cache decrypted credential
    this.credentialCache.set(cacheKey, decrypted);
    return decrypted;
  }

  /**
   * Decrypt a credential field using the encryption service
   * 
   * Uses libsodium's secretbox (XSalsa20-Poly1305) for authenticated encryption
   */
  private async decryptField(encrypted: Buffer): Promise<string> {
    try {
      if (!isEncryptionKeyConfigured()) {
        logger.error('[CEXCredentialManager] ENCRYPTION_KEY not configured; cannot decrypt credentials');
        throw new Error('Encryption key not configured');
      }
      return await decrypt(encrypted);
    } catch (err) {
      logger.error('[CEXCredentialManager] Decryption failed:', err);
      throw new Error(`Failed to decrypt credential: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Invalidate cached client (e.g., after credential update)
   */
  invalidateCache(credentialId: string): void {
    const clientKey = `client:${credentialId}`;
    const credentialKey = `credential:${credentialId}`;
    
    this.clientCache.del(clientKey);
    this.credentialCache.del(credentialKey);
    logger.info(`[CEXCredentialManager] Invalidated cache for credential ${credentialId}`);
  }

  /**
   * Check if a credential is valid and active
   */
  async isCredentialValid(credentialId: string, userId: string): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT is_active FROM cex_credentials WHERE id = $1 AND user_id = $2`,
        [credentialId, userId]
      );
      return result.rows.length > 0 && result.rows[0].is_active;
    } catch (err) {
      logger.error('[CEXCredentialManager] Failed to check credential validity:', err);
      return false;
    }
  }

  /**
   * Get all credentials for a user
   */
  async getCredentialsForUser(userId: string): Promise<any[]> {
    try {
      const result = await pool.query(
        `SELECT id, exchange, is_sandbox, is_active, last_used_at, created_at 
         FROM cex_credentials WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      return result.rows;
    } catch (err) {
      logger.error('[CEXCredentialManager] Failed to get user credentials:', err);
      return [];
    }
  }

  /**
   * Calculate CCXT rate limit based on exchange
   */
  private calculateRateLimit(exchangeName: string): number {
    const limits: Record<string, number> = {
      binance: 50,      // 1200 requests per minute = 20 req/s
      kraken: 100,      // 15 requests per second
      coinbase: 150,    // 10 requests per second
      okx: 100,         // 10 requests per second
      bybit: 100,       // 10 requests per second
      kucoin: 100,      // 15 requests per second
      gateio: 100,      // 10 requests per second
    };
    return limits[exchangeName.toLowerCase()] || 100;
  }

  /**
   * Clear all caches (e.g., on credential compromise)
   */
  clearAllCaches(): void {
    this.clientCache.flushAll();
    this.credentialCache.flushAll();
    logger.warn('[CEXCredentialManager] Cleared all credential and client caches');
  }
}

/**
 * Singleton instance
 */
export const cexCredentialManager = new CEXCredentialManager();
