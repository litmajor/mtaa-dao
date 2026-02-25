/**
 * Secure Vault Manager
 * Runtime secret injection, rotation policies, and drift detection
 * No hardcoded secrets; all sensitive data encrypted or in-memory only
 */

import { createHash, randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  SecureCredential,
  SecureVault,
  CredentialType,
  SecretRotationPolicy,
  DriftDetection,
  OperationalFrameworkConfig,
  VaultError,
} from '../types';
import { getAuditLogger } from '../audit/logger';

export class SecureVaultManager extends EventEmitter {
  private vault: SecureVault;
  private config: OperationalFrameworkConfig;
  private rotationTimers: Map<string, NodeJS.Timeout> = new Map();
  private secretAccessLog: Array<{ credentialId: string; accessedBy: string; timestamp: Date }> = [];

  // In-memory secrets storage (never serialized or logged)
  private secretsMemory: Map<string, string> = new Map();

  constructor(config: OperationalFrameworkConfig) {
    super();
    this.config = config;
    this.vault = {
      credentials: new Map(),
      rotationSchedule: new Map(),
      driftDetections: [],
    };
  }

  /**
   * Initialize vault and start rotation scheduler
   */
  async initialize(): Promise<void> {
    console.log('[VaultManager] Initializing secure vault...');

    if (this.config.vault.rotationEnabled) {
      this.startRotationScheduler();
    }

    this.emit('vault:initialized', {
      timestamp: new Date(),
      rotationEnabled: this.config.vault.rotationEnabled,
    });
  }

  /**
   * Register a credential in the vault
   * Secret is never stored; only hash and metadata
   */
  async registerCredential(
    serviceId: string,
    secretValue: string,
    credentialType: CredentialType,
    rotationPolicy: SecretRotationPolicy = SecretRotationPolicy.WEEKLY,
    expiresAt?: Date
  ): Promise<SecureCredential> {
    const credentialId = uuidv4();
    const secretHash = this.hashSecret(secretValue);
    const now = new Date();

    // Store secret in memory only (never in credential object)
    this.secretsMemory.set(credentialId, secretValue);

    // Calculate next rotation
    const nextRotation = this.calculateNextRotation(rotationPolicy);

    const credential: SecureCredential = {
      id: credentialId,
      serviceId,
      credentialType,
      secretHash,
      rotationPolicy,
      lastRotated: now,
      nextRotationDue: nextRotation,
      expiresAt,
      lastAccessedAt: undefined,
      accessCount: 0,
      accessedByServices: [],
      isExpired: false,
      isCompromised: false,
    };

    this.vault.credentials.set(credentialId, credential);
    this.vault.rotationSchedule.set(serviceId, nextRotation);

    // Log registration in audit trail
    await getAuditLogger().logEvent(
      'credential_rotated',
      'vault_manager',
      serviceId,
      `credential_${credentialId}`,
      undefined,
      { credentialType, rotationPolicy },
      `New credential registered for ${serviceId}`
    );

    this.emit('credential:registered', {
      credentialId,
      serviceId,
      credentialType,
      timestamp: now,
    });

    console.log(`[VaultManager] Credential registered: ${credentialId} for ${serviceId}`);

    return credential;
  }

  /**
   * Retrieve secret value (never logged, only access tracked)
   * Throws error if secret is expired or compromised
   */
  async getSecret(credentialId: string, accessedByService: string): Promise<string> {
    const credential = this.vault.credentials.get(credentialId);

    if (!credential) {
      throw new VaultError(`Credential not found: ${credentialId}`, { credentialId });
    }

    if (credential.isExpired) {
      throw new VaultError(`Credential expired: ${credentialId}`, {
        credentialId,
        expiresAt: credential.expiresAt,
      });
    }

    if (credential.isCompromised) {
      throw new VaultError(`Credential compromised: ${credentialId}`, { credentialId });
    }

    const secret = this.secretsMemory.get(credentialId);

    if (!secret) {
      throw new VaultError(`Secret not in memory: ${credentialId}`, { credentialId });
    }

    // Update access metadata (not the secret itself)
    credential.lastAccessedAt = new Date();
    credential.accessCount++;

    if (!credential.accessedByServices.includes(accessedByService)) {
      credential.accessedByServices.push(accessedByService);
    }

    // Log access (NOT the secret value)
    this.secretAccessLog.push({
      credentialId,
      accessedBy: accessedByService,
      timestamp: new Date(),
    });

    // Keep last 1000 access records
    if (this.secretAccessLog.length > 1000) {
      this.secretAccessLog.shift();
    }

    await getAuditLogger().logEvent(
      'secret_accessed',
      accessedByService,
      undefined,
      `credential_${credentialId}`,
      undefined,
      undefined,
      `Secret retrieved for ${credential.credentialType}`
    );

    return secret;
  }

  /**
   * Rotate a credential (generate new secret)
   * Caller responsible for updating service with new value
   */
  async rotateCredential(credentialId: string, newSecretValue: string): Promise<SecureCredential> {
    const credential = this.vault.credentials.get(credentialId);

    if (!credential) {
      throw new VaultError(`Credential not found for rotation: ${credentialId}`, { credentialId });
    }

    const oldSecretHash = credential.secretHash;
    const newSecretHash = this.hashSecret(newSecretValue);
    const now = new Date();

    // Replace in-memory secret
    this.secretsMemory.delete(credentialId);
    this.secretsMemory.set(credentialId, newSecretValue);

    // Update credential metadata
    credential.secretHash = newSecretHash;
    credential.lastRotated = now;
    credential.nextRotationDue = this.calculateNextRotation(credential.rotationPolicy);
    credential.isCompromised = false; // Clear compromise flag on rotation

    // Update schedule
    this.vault.rotationSchedule.set(credential.serviceId, credential.nextRotationDue);

    // Log rotation
    await getAuditLogger().logEvent(
      'credential_rotated',
      'vault_manager',
      credential.serviceId,
      `credential_${credentialId}`,
      { secretHash: oldSecretHash },
      { secretHash: newSecretHash },
      `Credential rotated for ${credential.credentialType}`,
      { rotationPolicy: credential.rotationPolicy }
    );

    this.emit('credential:rotated', {
      credentialId,
      serviceId: credential.serviceId,
      timestamp: now,
      nextRotationDue: credential.nextRotationDue,
    });

    console.log(`[VaultManager] Credential rotated: ${credentialId}`);

    return credential;
  }

  /**
   * Mark credential as compromised
   * Requires manual intervention to restore
   */
  async markCompromised(credentialId: string, reason: string): Promise<void> {
    const credential = this.vault.credentials.get(credentialId);

    if (!credential) {
      throw new VaultError(`Credential not found: ${credentialId}`, { credentialId });
    }

    credential.isCompromised = true;

    // Clear from memory immediately
    this.secretsMemory.delete(credentialId);

    await getAuditLogger().logEvent(
      'credential_rotated', // Uses existing action type
      'vault_manager',
      credential.serviceId,
      `credential_${credentialId}`,
      { isCompromised: false },
      { isCompromised: true },
      `Credential marked as compromised: ${reason}`
    );

    this.emit('credential:compromised', {
      credentialId,
      serviceId: credential.serviceId,
      reason,
      timestamp: new Date(),
    });

    console.error(`[VaultManager] Credential marked compromised: ${credentialId} - ${reason}`);
  }

  /**
   * Detect hardcoded secrets in configuration or source code
   * Returns list of suspected hardcoded secrets found
   */
  async detectDrift(searchPatterns: { location: string; content: string }[]): Promise<DriftDetection[]> {
    const detections: DriftDetection[] = [];

    for (const pattern of searchPatterns) {
      // Check for common secret patterns
      const secretPatterns = [
        /password\s*[=:]\s*['"]([^'"]{8,})['"]/gi,
        /api[_-]?key\s*[=:]\s*['"]([^'"]{20,})['"]/gi,
        /secret\s*[=:]\s*['"]([^'"]{20,})['"]/gi,
        /token\s*[=:]\s*['"]([^'"]{20,})['"]/gi,
        /private[_-]?key\s*[=:]\s*['"]([^'"]{50,})['"]/gi,
      ];

      for (const regex of secretPatterns) {
        const matches = pattern.content.matchAll(regex);

        for (const match of matches) {
          const secretValue = match[1];
          const secretHash = this.hashSecret(secretValue);

          // Check if this secret is already in vault
          const isVaulted = Array.from(this.secretsMemory.values()).some(
            (s) => this.hashSecret(s) === secretHash
          );

          if (!isVaulted) {
            const drift: DriftDetection = {
              id: uuidv4(),
              detectedAt: new Date(),
              type: 'hardcoded_secret',
              location: pattern.location,
              severity: 'critical',
              remediation: `Move secret to vault: registerCredential('serviceId', secretValue, credentialType)`,
              resolved: false,
            };

            detections.push(drift);
            this.vault.driftDetections.push(drift);
          }
        }
      }
    }

    if (detections.length > 0) {
      this.emit('vault:drift_detected', {
        detections,
        timestamp: new Date(),
      });

      console.warn(`[VaultManager] Detected ${detections.length} hardcoded secrets`);
    }

    return detections;
  }

  /**
   * Get credential by service ID
   */
  getCredentialForService(serviceId: string): SecureCredential | undefined {
    for (const credential of this.vault.credentials.values()) {
      if (credential.serviceId === serviceId) {
        return credential;
      }
    }
    return undefined;
  }

  /**
   * Get all credentials due for rotation
   */
  getCredentialsDueForRotation(): SecureCredential[] {
    const now = new Date();
    return Array.from(this.vault.credentials.values()).filter(
      (c) => !c.isExpired && !c.isCompromised && c.nextRotationDue <= now
    );
  }

  /**
   * Get drift detections
   */
  getDriftDetections(): DriftDetection[] {
    return [...this.vault.driftDetections];
  }

  /**
   * Mark drift as resolved
   */
  async resolveDrift(driftId: string): Promise<void> {
    const drift = this.vault.driftDetections.find((d) => d.id === driftId);

    if (!drift) {
      throw new VaultError(`Drift not found: ${driftId}`, { driftId });
    }

    drift.resolved = true;

    await getAuditLogger().logEvent(
      'config_changed',
      'vault_manager',
      undefined,
      `drift_${driftId}`,
      { resolved: false },
      { resolved: true },
      `Drift resolved: ${drift.type}`
    );

    this.emit('drift:resolved', { driftId, timestamp: new Date() });
  }

  /**
   * Get vault statistics
   */
  getStatistics() {
    const dueForRotation = this.getCredentialsDueForRotation();

    return {
      totalCredentials: this.vault.credentials.size,
      totalSecretsInMemory: this.secretsMemory.size,
      credentialsDueForRotation: dueForRotation.length,
      expiredCredentials: Array.from(this.vault.credentials.values()).filter((c) => c.isExpired).length,
      compromisedCredentials: Array.from(this.vault.credentials.values()).filter((c) => c.isCompromised).length,
      hardcodedSecretsFound: this.vault.driftDetections.filter((d) => d.type === 'hardcoded_secret' && !d.resolved)
        .length,
      secretAccessLogSize: this.secretAccessLog.length,
    };
  }

  /**
   * Start rotation scheduler
   * Checks for credentials due for rotation at regular intervals
   */
  private startRotationScheduler(): void {
    const checkInterval = setInterval(() => {
      const dueForRotation = this.getCredentialsDueForRotation();

      if (dueForRotation.length > 0) {
        this.emit('vault:rotation_due', {
          credentialCount: dueForRotation.length,
          credentials: dueForRotation.map((c) => ({ id: c.id, serviceId: c.serviceId })),
          timestamp: new Date(),
        });

        console.warn(
          `[VaultManager] ${dueForRotation.length} credentials due for rotation. Please rotate immediately.`
        );
      }
    }, 60 * 1000); // Check every minute

    this.rotationTimers.set('rotation_scheduler', checkInterval);
  }

  /**
   * Calculate next rotation date based on policy
   */
  private calculateNextRotation(policy: SecretRotationPolicy): Date {
    const now = new Date();

    switch (policy) {
      case SecretRotationPolicy.DAILY:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case SecretRotationPolicy.WEEKLY:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case SecretRotationPolicy.MONTHLY:
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      case SecretRotationPolicy.NEVER:
        return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      case SecretRotationPolicy.ON_DEMAND:
        return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // Default to 1 year
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Hash secret value (SHA256)
   * Used for comparison without exposing secret
   */
  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  /**
   * Shutdown vault and cleanup
   */
  async shutdown(): Promise<void> {
    // Clear all timers
    for (const timer of this.rotationTimers.values()) {
      clearInterval(timer);
    }
    this.rotationTimers.clear();

    // Clear secrets from memory
    this.secretsMemory.clear();

    console.log('[VaultManager] Vault shutdown complete');
  }
}

// Export singleton
let vaultInstance: SecureVaultManager | null = null;

export function initializeVault(config: OperationalFrameworkConfig): SecureVaultManager {
  if (!vaultInstance) {
    vaultInstance = new SecureVaultManager(config);
  }
  return vaultInstance;
}

export function getVault(): SecureVaultManager {
  if (!vaultInstance) {
    throw new Error('SecureVaultManager not initialized. Call initializeVault first.');
  }
  return vaultInstance;
}
