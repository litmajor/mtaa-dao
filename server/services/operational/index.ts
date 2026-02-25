/**
 * Operational Framework Orchestrator
 * Main integration point for all operational modules
 * Coordinates discovery, auditing, validation, remediation
 */

import { EventEmitter } from 'events';
import {
  OperationalFrameworkConfig,
  OperationalState,
  ServiceType,
  PrivilegeLevel,
  TrustLevel,
} from './types';
import { initializeDiscovery, getDiscovery } from './discovery/discovery';
import { initializeAuditLogger, getAuditLogger } from './audit/logger';
import { initializeVault, getVault } from './vault/manager';
import { SystemMetadataModel, ArchitectureValidator } from './validation/metadata';
import { initializeRemediation, getRemediation } from './remediation/executor';

export class OperationalFramework extends EventEmitter {
  private config: OperationalFrameworkConfig;
  private isInitialized: boolean = false;
  private state: OperationalState | null = null;

  private metadataModel: SystemMetadataModel | null = null;
  private validator: ArchitectureValidator | null = null;
  private validationInterval: NodeJS.Timeout | null = null;

  constructor(config: OperationalFrameworkConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize all operational framework components
   * Must be called once on application startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('[OperationalFramework] Already initialized');
      return;
    }

    console.log('[OperationalFramework] Initializing operational framework...');

    try {
      // Initialize core components
      if (this.config.discovery.enabled) {
        console.log('[OperationalFramework] Initializing service discovery...');
        initializeDiscovery(this.config);
        const discovery = getDiscovery();
        await discovery.start();
      }

      if (this.config.audit.enabled) {
        console.log('[OperationalFramework] Initializing audit logger...');
        initializeAuditLogger(this.config);
        const auditLogger = getAuditLogger();

        // Log framework startup
        await auditLogger.logEvent(
          'deployment_initiated',
          'system',
          undefined,
          'operational_framework',
          undefined,
          { version: '1.0.0' },
          'Operational Framework initialized'
        );
      }

      if (this.config.vault.enabled) {
        console.log('[OperationalFramework] Initializing secure vault...');
        const vault = initializeVault(this.config);
        await vault.initialize();
      }

      if (this.config.remediation.enabled) {
        console.log('[OperationalFramework] Initializing remediation executor...');
        initializeRemediation(this.config);
      }

      // Initialize validation components
      if (this.config.validation.enabled) {
        console.log('[OperationalFramework] Initializing architecture validator...');
        this.metadataModel = new SystemMetadataModel(this.config);
        this.validator = new ArchitectureValidator(this.config, this.metadataModel);

        // Schedule validation
        this.scheduleValidation();
      }

      this.isInitialized = true;

      this.emit('framework:initialized', {
        timestamp: new Date(),
        config: {
          discoveryEnabled: this.config.discovery.enabled,
          auditEnabled: this.config.audit.enabled,
          vaultEnabled: this.config.vault.enabled,
          validationEnabled: this.config.validation.enabled,
          remediationEnabled: this.config.remediation.enabled,
        },
      });

      console.log('[OperationalFramework] Framework initialized successfully');
    } catch (error) {
      console.error(
        `[OperationalFramework] Initialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Shutdown all operational framework components
   * Should be called on application shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[OperationalFramework] Shutting down...');

    if (this.validationInterval) {
      clearInterval(this.validationInterval);
    }

    if (this.config.discovery.enabled) {
      const discovery = getDiscovery();
      await discovery.stop();
    }

    if (this.config.vault.enabled) {
      const vault = getVault();
      await vault.shutdown();
    }

    this.isInitialized = false;

    this.emit('framework:shutdown', new Date());
    console.log('[OperationalFramework] Shutdown complete');
  }

  /**
   * Get current operational state
   * Complete snapshot of system topology, health, and audit trail
   */
  async getOperationalState(): Promise<OperationalState> {
    if (!this.isInitialized) {
      throw new Error('Framework not initialized');
    }

    const now = new Date();
    const discovery = getDiscovery();
    const auditLogger = getAuditLogger();
    const vault = getVault();
    const remediation = getRemediation();
    const metadata = this.metadataModel?.getMetadata();

    const state: OperationalState = {
      id: `state_${Date.now()}`,
      timestamp: now,
      registry: discovery.getRegistry(),
      metadata: metadata || ({} as any),
      dependencyGraph: this.metadataModel?.getDependencyGraph() || ({} as any),
      vault: {
        credentials: new Map(),
        rotationSchedule: new Map(),
        driftDetections: vault.getDriftDetections(),
      },
      recentAuditEvents: auditLogger.getEvents().slice(-50),
      recentRemediations: remediation.getActions().slice(-20),
      recentGaps: [],
      overallHealth: 'healthy',
      lastValidationTime: now,
      nextValidationTime: new Date(now.getTime() + this.config.validation.intervalMs),
      criticalAlerts: [],
      warningAlerts: [],
    };

    // Compute overall health
    const offlineServices = discovery.getServices().filter((s) => s.healthStatus === 'offline');
    if (offlineServices.length > 0) {
      state.overallHealth = 'degraded';
      state.warningAlerts.push(
        `${offlineServices.length} services offline: ${offlineServices.map((s) => s.name).join(', ')}`
      );
    }

    const vaultStats = vault.getStatistics();
    if (vaultStats.compromisedCredentials > 0) {
      state.overallHealth = 'critical';
      state.criticalAlerts.push(
        `${vaultStats.compromisedCredentials} credentials compromised - immediate action required`
      );
    }

    if (vaultStats.credentialsDueForRotation > 0) {
      state.warningAlerts.push(`${vaultStats.credentialsDueForRotation} credentials due for rotation`);
    }

    return state;
  }

  /**
   * Perform full system validation
   * Runs architecture validation and generates report
   */
  async validate(): Promise<any> {
    if (!this.validator || !this.metadataModel) {
      throw new Error('Validator not initialized');
    }

    // Generate fresh metadata
    const expectedServices = this.buildExpectedServices();
    await this.metadataModel.generateMetadata(expectedServices);

    // Run validation
    const report = await this.validator.validate();

    // Update gaps in state
    if (this.state) {
      this.state.recentGaps = report.gaps;
    }

    this.emit('validation:complete', {
      timestamp: new Date(),
      report,
    });

    return report;
  }

  /**
   * Schedule periodic validation
   */
  private scheduleValidation(): void {
    this.validationInterval = setInterval(async () => {
      try {
        await this.validate();
      } catch (error) {
        console.error(
          `[OperationalFramework] Validation failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }, this.config.validation.intervalMs);
  }

  /**
   * Build expected services list from configuration
   * Maps config to ServiceInstance format
   */
  private buildExpectedServices(): any[] {
    // This would be populated from your system configuration
    // For now, return empty - discovery will find what's running
    return [];
  }

  /**
   * Check if framework is initialized
   */
  isInitialized_(): boolean {
    return this.isInitialized;
  }

  /**
   * Export full operational state for forensics
   */
  async exportState(): Promise<string> {
    const state = await this.getOperationalState();
    const auditLogger = getAuditLogger();

    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        operationalState: state,
        auditTrail: auditLogger.getTrail(),
        auditStatistics: auditLogger.getStatistics(),
      },
      null,
      2
    );
  }

  /**
   * Get framework statistics
   */
  getStatistics() {
    const discovery = getDiscovery();
    const auditLogger = getAuditLogger();
    const vault = getVault();
    const remediation = getRemediation();

    return {
      discovery: discovery.getMetrics(),
      audit: auditLogger.getStatistics(),
      vault: vault.getStatistics(),
      remediation: remediation.getStatistics(),
      framework: {
        initialized: this.isInitialized,
        uptime: 'N/A', // Would track from initialization
      },
    };
  }
}

// Export singleton instance
let frameworkInstance: OperationalFramework | null = null;

/**
 * Initialize the operational framework singleton
 * Call this once during application startup
 */
export async function initializeOperationalFramework(
  config: OperationalFrameworkConfig
): Promise<OperationalFramework> {
  if (!frameworkInstance) {
    frameworkInstance = new OperationalFramework(config);
  }

  await frameworkInstance.initialize();
  return frameworkInstance;
}

/**
 * Get the operational framework singleton
 */
export function getOperationalFramework(): OperationalFramework {
  if (!frameworkInstance) {
    throw new Error('OperationalFramework not initialized. Call initializeOperationalFramework first.');
  }

  return frameworkInstance;
}
