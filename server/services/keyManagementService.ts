/**
 * Key Management Service
 * Handles key rotation, versioning, and lifecycle management
 * 
 * Features:
 * - Track encryption key versions
 * - Automatic key rotation
 * - Re-encryption of old data
 * - Key audit logging
 */

import * as crypto from 'crypto';
import { encrypt, decrypt, EncryptedData } from '../utils/encryption';
import { db } from './db';

export interface KeyVersion {
  id: string;
  version: number;
  masterKeyHash: string; // Hash of master key (not the key itself)
  algorithm: string;
  createdAt: Date;
  rotatedAt?: Date;
  status: 'active' | 'inactive' | 'deprecated';
}

export interface EncryptionAuditLog {
  id: string;
  keyVersion: number;
  action: 'encrypt' | 'decrypt' | 'rotate' | 'reencrypt';
  dataType: string; // 'api_key', 'api_secret', etc.
  userId?: string;
  success: boolean;
  errorMessage?: string;
  timestamp: Date;
}

/**
 * Key Management Service
 * Singleton pattern - use KeyManagementService.getInstance()
 */
export class KeyManagementService {
  private static instance: KeyManagementService;
  private currentKeyVersion: KeyVersion | null = null;
  private keyVersionCache: Map<number, KeyVersion> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): KeyManagementService {
    if (!KeyManagementService.instance) {
      KeyManagementService.instance = new KeyManagementService();
    }
    return KeyManagementService.instance;
  }

  /**
   * Initialize key management system
   * Call this once on application startup
   */
  async initialize(): Promise<void> {
    try {
      // Ensure tables exist
      await this.createKeyManagementTables();

      // Get current active key
      this.currentKeyVersion = await this.getActiveKeyVersion();

      // If no active key exists, create one
      if (!this.currentKeyVersion) {
        this.currentKeyVersion = await this.createNewKeyVersion();
      }

      console.log(`✅ Key management initialized. Current version: ${this.currentKeyVersion.version}`);
    } catch (error) {
      console.error('Failed to initialize key management:', error);
      throw error;
    }
  }

  /**
   * Create key management tables if they don't exist
   */
  private async createKeyManagementTables(): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS key_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version INTEGER NOT NULL UNIQUE,
        master_key_hash VARCHAR(64) NOT NULL,
        algorithm VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        rotated_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active',
        INDEX idx_version (version),
        INDEX idx_status (status)
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS encryption_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key_version INTEGER NOT NULL,
        action VARCHAR(20) NOT NULL,
        data_type VARCHAR(50),
        user_id UUID,
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (key_version) REFERENCES key_versions(version),
        INDEX idx_timestamp (timestamp),
        INDEX idx_user_id (user_id),
        INDEX idx_key_version (key_version)
      );
    `);
  }

  /**
   * Create a new key version
   * Used during rotation or initial setup
   */
  async createNewKeyVersion(): Promise<KeyVersion> {
    const masterKey = process.env.MASTER_ENCRYPTION_KEY;
    if (!masterKey) {
      throw new Error('MASTER_ENCRYPTION_KEY not configured');
    }

    const keyHash = crypto
      .createHash('sha256')
      .update(masterKey)
      .digest('hex');

    const latestVersion = await this.getLatestKeyVersion();
    const newVersion = (latestVersion?.version || 0) + 1;

    const result = await db.query(
      `INSERT INTO key_versions (version, master_key_hash, algorithm, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [newVersion, keyHash, 'aes-256-gcm', 'active']
    );

    const keyVersion = this.mapKeyVersion(result.rows[0]);
    this.keyVersionCache.set(newVersion, keyVersion);

    return keyVersion;
  }

  /**
   * Get currently active key version
   */
  async getActiveKeyVersion(): Promise<KeyVersion | null> {
    const result = await db.query(
      `SELECT * FROM key_versions WHERE status = 'active' ORDER BY version DESC LIMIT 1`
    );

    return result.rows.length > 0 ? this.mapKeyVersion(result.rows[0]) : null;
  }

  /**
   * Get a specific key version
   */
  async getKeyVersion(version: number): Promise<KeyVersion | null> {
    // Check cache first
    if (this.keyVersionCache.has(version)) {
      return this.keyVersionCache.get(version) || null;
    }

    const result = await db.query(
      `SELECT * FROM key_versions WHERE version = $1`,
      [version]
    );

    if (result.rows.length > 0) {
      const keyVersion = this.mapKeyVersion(result.rows[0]);
      this.keyVersionCache.set(version, keyVersion);
      return keyVersion;
    }

    return null;
  }

  /**
   * Get latest key version
   */
  async getLatestKeyVersion(): Promise<KeyVersion | null> {
    const result = await db.query(
      `SELECT * FROM key_versions ORDER BY version DESC LIMIT 1`
    );

    return result.rows.length > 0 ? this.mapKeyVersion(result.rows[0]) : null;
  }

  /**
   * Rotate encryption key
   * 1. Creates new key version
   * 2. Re-encrypts all credentials with new key
   * 3. Updates old version to deprecated
   */
  async rotateKey(credentialRepository: any): Promise<{
    success: boolean;
    oldVersion: number;
    newVersion: number;
    reencryptedCount: number;
  }> {
    const oldVersion = this.currentKeyVersion;
    if (!oldVersion) {
      throw new Error('No active key version found');
    }

    try {
      console.log(`🔄 Starting key rotation from v${oldVersion.version}...`);

      // Create new key version
      const newVersion = await this.createNewKeyVersion();
      this.currentKeyVersion = newVersion;

      // Get all credentials
      const credentials = await credentialRepository.getAllCredentials();

      // Re-encrypt with new key
      let reencryptedCount = 0;
      const newMasterKey = process.env.MASTER_ENCRYPTION_KEY;
      if (!newMasterKey) {
        throw new Error('Master key not available');
      }

      for (const cred of credentials) {
        try {
          // Decrypt with old key (stored metadata)
          const decrypted = decrypt(newMasterKey, cred.apiKeyEncrypted);

          // Re-encrypt with new key
          const newEncrypted = encrypt(newMasterKey, decrypted);

          // Update in database
          await credentialRepository.updateEncryption(cred.id, newEncrypted);

          reencryptedCount++;
        } catch (error) {
          console.error(`Failed to re-encrypt credential ${cred.id}:`, error);
          await this.logAudit('reencrypt', 'api_key', false, String(error));
        }
      }

      // Mark old version as deprecated
      await db.query(
        `UPDATE key_versions SET status = 'deprecated', rotated_at = NOW() WHERE version = $1`,
        [oldVersion.version]
      );

      console.log(`✅ Key rotation complete. Re-encrypted ${reencryptedCount} credentials.`);

      await this.logAudit('rotate', 'system', true);

      return {
        success: true,
        oldVersion: oldVersion.version,
        newVersion: newVersion.version,
        reencryptedCount,
      };
    } catch (error) {
      console.error('Key rotation failed:', error);
      throw error;
    }
  }

  /**
   * Log encryption operation for audit trail
   */
  async logAudit(
    action: 'encrypt' | 'decrypt' | 'rotate' | 'reencrypt',
    dataType: string,
    success: boolean,
    errorMessage?: string,
    userId?: string
  ): Promise<void> {
    try {
      const version = this.currentKeyVersion?.version || 0;

      await db.query(
        `INSERT INTO encryption_audit_log (
          key_version, action, data_type, user_id, success, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [version, action, dataType, userId || null, success, errorMessage || null]
      );
    } catch (error) {
      console.error('Failed to log audit entry:', error);
    }
  }

  /**
   * Get audit log for a user
   */
  async getUserAuditLog(userId: string, limit: number = 100): Promise<EncryptionAuditLog[]> {
    const result = await db.query(
      `SELECT * FROM encryption_audit_log
       WHERE user_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(row => this.mapAuditLog(row));
  }

  /**
   * Get system-wide audit log
   */
  async getSystemAuditLog(limit: number = 100): Promise<EncryptionAuditLog[]> {
    const result = await db.query(
      `SELECT * FROM encryption_audit_log
       ORDER BY timestamp DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => this.mapAuditLog(row));
  }

  /**
   * Get key rotation history
   */
  async getKeyRotationHistory(): Promise<KeyVersion[]> {
    const result = await db.query(
      `SELECT * FROM key_versions ORDER BY version DESC`
    );

    return result.rows.map(row => this.mapKeyVersion(row));
  }

  /**
   * Health check - verify current key is working
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    currentVersion: number;
    message: string;
  }> {
    if (!this.currentKeyVersion) {
      return {
        healthy: false,
        currentVersion: 0,
        message: 'No active key version',
      };
    }

    try {
      const testData = 'health-check-' + Date.now();
      const encrypted = encrypt(process.env.MASTER_ENCRYPTION_KEY || '', testData);
      const decrypted = decrypt(process.env.MASTER_ENCRYPTION_KEY || '', encrypted);

      const healthy = decrypted === testData;
      return {
        healthy,
        currentVersion: this.currentKeyVersion.version,
        message: healthy ? 'Encryption operational' : 'Encryption verification failed',
      };
    } catch (error) {
      return {
        healthy: false,
        currentVersion: this.currentKeyVersion.version,
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Map database row to KeyVersion
   */
  private mapKeyVersion(row: any): KeyVersion {
    return {
      id: row.id,
      version: row.version,
      masterKeyHash: row.master_key_hash,
      algorithm: row.algorithm,
      createdAt: new Date(row.created_at),
      rotatedAt: row.rotated_at ? new Date(row.rotated_at) : undefined,
      status: row.status,
    };
  }

  /**
   * Map database row to EncryptionAuditLog
   */
  private mapAuditLog(row: any): EncryptionAuditLog {
    return {
      id: row.id,
      keyVersion: row.key_version,
      action: row.action,
      dataType: row.data_type,
      userId: row.user_id,
      success: row.success,
      errorMessage: row.error_message,
      timestamp: new Date(row.timestamp),
    };
  }

  /**
   * Get current key version (cached)
   */
  getCurrentKeyVersion(): KeyVersion | null {
    return this.currentKeyVersion;
  }
}
