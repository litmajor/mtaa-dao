/**
 * CEX Credential Repository - Updated with Encryption
 * Integration with encryption utility and key management
 * 
 * This module provides automatic encryption/decryption of sensitive API credentials
 */

import { db } from '../db';
import { CEXCredential } from '../../types/cex.types';
import { encrypt, decrypt, EncryptedData, obfuscate } from '../../utils/encryption';
import { KeyManagementService } from '../keyManagementService';

export class CEXCredentialRepository {
  private static keyManagement = KeyManagementService.getInstance();

  /**
   * Store encrypted API credentials
   * Automatically encrypts apiKey and apiSecret
   */
  static async storeCredentials(
    userId: string,
    exchange: string,
    apiKey: string,
    apiSecret: string,
    passphrase?: string
  ): Promise<CEXCredential> {
    try {
      const masterKey = process.env.MASTER_ENCRYPTION_KEY;
      if (!masterKey) {
        throw new Error('MASTER_ENCRYPTION_KEY not configured');
      }

      // Encrypt sensitive data
      const apiKeyEncrypted = encrypt(masterKey, apiKey);
      const apiSecretEncrypted = encrypt(masterKey, apiSecret);
      const passphraseEncrypted = passphrase ? encrypt(masterKey, passphrase) : null;

      const result = await db.query(
        `INSERT INTO cex_credentials (
          user_id, exchange, api_key_encrypted, api_secret_encrypted, passphrase_encrypted
        ) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET
           exchange = $2,
           api_key_encrypted = $3,
           api_secret_encrypted = $4,
           passphrase_encrypted = $5,
           updated_at = NOW()
         RETURNING *`,
        [
          userId,
          exchange,
          JSON.stringify(apiKeyEncrypted), // Store as JSON
          JSON.stringify(apiSecretEncrypted),
          passphraseEncrypted ? JSON.stringify(passphraseEncrypted) : null,
        ]
      );

      await this.keyManagement.logAudit('encrypt', 'api_credentials', true, undefined, userId);

      return this.mapToCamelCase(result.rows[0]);
    } catch (error) {
      await this.keyManagement.logAudit('encrypt', 'api_credentials', false, String(error), userId);
      throw new Error(`Failed to store credentials: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get credentials by user ID and decrypt them
   * Returns fully decrypted credentials
   */
  static async getCredentialsByUserId(userId: string): Promise<
    (CEXCredential & { apiKey: string; apiSecret: string; passphrase?: string }) | null
  > {
    try {
      const result = await db.query(
        `SELECT * FROM cex_credentials WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const masterKey = process.env.MASTER_ENCRYPTION_KEY;
      if (!masterKey) {
        throw new Error('MASTER_ENCRYPTION_KEY not configured');
      }

      // Decrypt sensitive fields
      const apiKeyEncrypted = JSON.parse(row.api_key_encrypted) as EncryptedData;
      const apiSecretEncrypted = JSON.parse(row.api_secret_encrypted) as EncryptedData;
      const apiKey = decrypt(masterKey, apiKeyEncrypted);
      const apiSecret = decrypt(masterKey, apiSecretEncrypted);

      let passphrase: string | undefined;
      if (row.passphrase_encrypted) {
        const passphraseEncrypted = JSON.parse(row.passphrase_encrypted) as EncryptedData;
        passphrase = decrypt(masterKey, passphraseEncrypted);
      }

      await this.keyManagement.logAudit('decrypt', 'api_credentials', true, undefined, userId);

      const credential = this.mapToCamelCase(row);
      return {
        ...credential,
        apiKey,
        apiSecret,
        passphrase,
      };
    } catch (error) {
      await this.keyManagement.logAudit('decrypt', 'api_credentials', false, String(error), userId);
      throw new Error(`Failed to retrieve credentials: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get credentials by ID and decrypt
   */
  static async getCredentialsById(id: string): Promise<
    (CEXCredential & { apiKey: string; apiSecret: string; passphrase?: string }) | null
  > {
    try {
      const result = await db.query(
        `SELECT * FROM cex_credentials WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const masterKey = process.env.MASTER_ENCRYPTION_KEY;
      if (!masterKey) {
        throw new Error('MASTER_ENCRYPTION_KEY not configured');
      }

      // Decrypt
      const apiKeyEncrypted = JSON.parse(row.api_key_encrypted) as EncryptedData;
      const apiSecretEncrypted = JSON.parse(row.api_secret_encrypted) as EncryptedData;
      const apiKey = decrypt(masterKey, apiKeyEncrypted);
      const apiSecret = decrypt(masterKey, apiSecretEncrypted);

      let passphrase: string | undefined;
      if (row.passphrase_encrypted) {
        const passphraseEncrypted = JSON.parse(row.passphrase_encrypted) as EncryptedData;
        passphrase = decrypt(masterKey, passphraseEncrypted);
      }

      const credential = this.mapToCamelCase(row);
      return {
        ...credential,
        apiKey,
        apiSecret,
        passphrase,
      };
    } catch (error) {
      throw new Error(`Failed to retrieve credentials: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if credentials exist for user (without decrypting)
   */
  static async credentialsExist(userId: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM cex_credentials WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Update last used timestamp
   */
  static async updateLastUsed(userId: string): Promise<void> {
    await db.query(
      `UPDATE cex_credentials
       SET last_used_at = NOW(), updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * Deactivate credentials
   */
  static async deactivateCredentials(userId: string): Promise<void> {
    await db.query(
      `UPDATE cex_credentials
       SET is_active = false, updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * Activate credentials
   */
  static async activateCredentials(userId: string): Promise<void> {
    await db.query(
      `UPDATE cex_credentials
       SET is_active = true, updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * Delete credentials (permanently)
   */
  static async deleteCredentials(userId: string): Promise<void> {
    await db.query(
      `DELETE FROM cex_credentials WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * Get all active credentials (for background jobs)
   * Returns encrypted data - decrypt before use
   */
  static async getAllActiveCredentials(): Promise<CEXCredential[]> {
    const result = await db.query(
      `SELECT id, user_id, exchange, is_sandbox, is_active, last_used_at, created_at, updated_at
       FROM cex_credentials WHERE is_active = true`
    );
    return result.rows.map(row => this.mapToCamelCase(row));
  }

  /**
   * Test credentials by attempting decryption
   */
  static async testCredentials(userId: string): Promise<{
    valid: boolean;
    exchange?: string;
    message: string;
  }> {
    try {
      const cred = await this.getCredentialsByUserId(userId);
      if (!cred) {
        return { valid: false, message: 'No credentials found' };
      }

      // If we got here, decryption succeeded
      return {
        valid: true,
        exchange: cred.exchange,
        message: `Credentials valid for ${cred.exchange}`,
      };
    } catch (error) {
      return {
        valid: false,
        message: `Credential test failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get credential summary for logging (without exposing keys)
   */
  static async getCredentialSummary(userId: string): Promise<{
    exchange: string;
    apiKeyPreview: string;
    isActive: boolean;
    lastUsedAt?: Date;
  } | null> {
    try {
      const result = await db.query(
        `SELECT exchange, is_active, last_used_at FROM cex_credentials WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const cred = await this.getCredentialsByUserId(userId);

      return {
        exchange: row.exchange,
        apiKeyPreview: obfuscate(cred?.apiKey || ''),
        isActive: row.is_active,
        lastUsedAt: row.last_used_at,
      };
    } catch (error) {
      throw new Error(`Failed to get credential summary: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Map snake_case to camelCase
   */
  private static mapToCamelCase(row: any): CEXCredential {
    return {
      id: row.id,
      userId: row.user_id,
      exchange: row.exchange,
      apiKeyEncrypted: row.api_key_encrypted,
      apiSecretEncrypted: row.api_secret_encrypted,
      passphraseEncrypted: row.passphrase_encrypted,
      isSandbox: row.is_sandbox,
      isActive: row.is_active,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
