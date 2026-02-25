/**
 * CEX Credential Repository
 * Data access layer for API credential management
 */

import { db } from '../db';
import { CEXCredential } from '../../types/cex.types';

export class CEXCredentialRepository {
  /**
   * Store encrypted API credentials
   */
  static async storeCredentials(
    userId: string,
    exchange: string,
    apiKeyEncrypted: Buffer,
    apiSecretEncrypted: Buffer,
    passphraseEncrypted?: Buffer
  ): Promise<CEXCredential> {
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
      [userId, exchange, apiKeyEncrypted, apiSecretEncrypted, passphraseEncrypted]
    );
    return this.mapToCamelCase(result.rows[0]);
  }

  /**
   * Get credentials by user ID (returns encrypted data)
   */
  static async getCredentialsByUserId(
    userId: string
  ): Promise<CEXCredential | null> {
    const result = await db.query(
      `SELECT * FROM cex_credentials WHERE user_id = $1`,
      [userId]
    );
    return result.rows.length > 0 ? this.mapToCamelCase(result.rows[0]) : null;
  }

  /**
   * Get credentials by ID
   */
  static async getCredentialsById(id: string): Promise<CEXCredential | null> {
    const result = await db.query(
      `SELECT * FROM cex_credentials WHERE id = $1`,
      [id]
    );
    return result.rows.length > 0 ? this.mapToCamelCase(result.rows[0]) : null;
  }

  /**
   * Check if credentials exist for user
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
   * Delete credentials
   */
  static async deleteCredentials(userId: string): Promise<void> {
    await db.query(
      `DELETE FROM cex_credentials WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * Get all active credentials (for background jobs)
   */
  static async getAllActiveCredentials(): Promise<CEXCredential[]> {
    const result = await db.query(
      `SELECT * FROM cex_credentials WHERE is_active = true`
    );
    return result.rows.map(row => this.mapToCamelCase(row));
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
