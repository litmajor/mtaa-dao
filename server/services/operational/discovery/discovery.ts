/**
 * System Discovery Module
 * Real-time service detection and health monitoring
 * Continuously maintains current service inventory with health status
 */

import { EventEmitter } from 'events';
import axios, { AxiosError } from 'axios';
import { createHash } from 'crypto';
import {
  ServiceInstance,
  ServiceRegistry,
  ServiceHealthStatus,
  ServiceType,
  PrivilegeLevel,
  TrustLevel,
  OperationalFrameworkConfig,
  ServiceDiscoveryError,
} from '../types';

export class SystemDiscovery extends EventEmitter {
  private registry: ServiceRegistry;
  private discoveryInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private config: OperationalFrameworkConfig;
  private isRunning: boolean = false;
  private discoveredServices: Map<string, ServiceInstance> = new Map();
  
  // Metrics for diagnostics
  private metrics = {
    totalDiscoveries: 0,
    lastDiscoveryTime: 0,
    failedHealthChecks: 0,
    successfulHealthChecks: 0,
  };

  constructor(config: OperationalFrameworkConfig) {
    super();
    this.config = config;
    this.registry = {
      services: new Map(),
      lastUpdated: new Date(),
      sourceAgent: 'SystemDiscovery',
    };
  }

  /**
   * Start the discovery and health monitoring process
   * Runs discovery once on startup, then schedules periodic health checks
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[SystemDiscovery] Already running, skipping start');
      return;
    }

    this.isRunning = true;
    console.log('[SystemDiscovery] Starting system discovery and monitoring...');

    try {
      // Initial full discovery
      await this.discoverAll();

      // Schedule continuous health checks
      this.healthCheckInterval = setInterval(
        () => this.performHealthChecks(),
        this.config.discovery.intervalMs
      );

      // Emit started event
      this.emit('discovery:started', {
        timestamp: new Date(),
        servicesDiscovered: this.discoveredServices.size,
      });

      console.log(`[SystemDiscovery] Initialized with ${this.discoveredServices.size} services`);
    } catch (error) {
      this.isRunning = false;
      const err = new ServiceDiscoveryError(
        `Failed to start discovery: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
      this.emit('discovery:error', err);
      throw err;
    }
  }

  /**
   * Stop all discovery and monitoring processes
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    console.log('[SystemDiscovery] Stopped');
    this.emit('discovery:stopped', new Date());
  }

  /**
   * Discover all expected services based on configuration
   * Attempts to connect to each service and captures metadata
   */
  private async discoverAll(): Promise<void> {
    console.log('[SystemDiscovery] Running full service discovery...');
    const startTime = Date.now();
    this.metrics.totalDiscoveries++;

    const discoveryPromises = this.config.discovery.expectedServices.map((serviceConfig) =>
      this.discoverService({
        name: serviceConfig.name,
        type: serviceConfig.type,
        host: serviceConfig.host,
        port: serviceConfig.port,
        protocol: serviceConfig.protocol as 'http' | 'https' | 'tcp' | 'udp' | 'ws' | 'wss',
        trustLevel: TrustLevel.TRUSTED,
        privilegeLevel: this.mapServicePrivilege(serviceConfig.type),
        dependencies: [],
        criticalityLevel: this.mapServiceCriticality(serviceConfig.type),
      }).catch((error) => {
        console.error(
          `[SystemDiscovery] Failed to discover ${serviceConfig.name}: ${error instanceof Error ? error.message : String(error)}`
        );
        return null;
      })
    );

    const results = await Promise.all(discoveryPromises);
    const discovered = results.filter((s) => s !== null) as ServiceInstance[];

    this.discoveredServices.clear();
    discovered.forEach((service) => {
      this.discoveredServices.set(service.id, service);
    });

    this.registry.services = this.discoveredServices;
    this.registry.lastUpdated = new Date();
    this.metrics.lastDiscoveryTime = Date.now() - startTime;

    console.log(
      `[SystemDiscovery] Discovery complete: ${discovered.length} services in ${this.metrics.lastDiscoveryTime}ms`
    );
  }

  /**
   * Discover a single service by attempting connection and health check
   */
  private async discoverService(partial: Partial<ServiceInstance>): Promise<ServiceInstance> {
    const serviceId = this.generateServiceId(partial.name || 'unknown');
    const now = new Date();

    const service: ServiceInstance = {
      id: serviceId,
      name: partial.name || 'unknown',
      type: partial.type || ServiceType.EXTERNAL_API,
      host: partial.host || 'localhost',
      port: partial.port || 0,
      protocol: partial.protocol || 'http',
      trustLevel: partial.trustLevel || TrustLevel.UNTRUSTED,
      privilegeLevel: partial.privilegeLevel || PrivilegeLevel.GUEST,
      healthStatus: ServiceHealthStatus.UNKNOWN,
      canAccess: partial.canAccess || [],
      canBeAccessedBy: partial.canBeAccessedBy || [],
      dependencies: partial.dependencies || [],
      criticalityLevel: partial.criticalityLevel || 'low',
      createdAt: now,
      discoveredAt: now,
      lastModifiedAt: now,
    };

    // Attempt health check to determine if service is running
    await this.checkServiceHealth(service);

    this.emit('service:discovered', service);

    return service;
  }

  /**
   * Check health of a single service
   * Updates health status and response time metrics
   */
  async checkServiceHealth(service: ServiceInstance): Promise<void> {
    const startTime = Date.now();

    try {
      const healthCheckUrl = service.healthCheckUrl || this.buildHealthCheckUrl(service);

      if (!healthCheckUrl) {
        service.healthStatus = ServiceHealthStatus.UNKNOWN;
        return;
      }

      const timeout = this.config.discovery.healthCheckTimeout;

      try {
        const response = await axios.get(healthCheckUrl, {
          timeout,
          validateStatus: () => true, // Don't throw on any status
          headers: {
            'User-Agent': 'OperationalFramework/1.0',
          },
        });

        const responseTime = Date.now() - startTime;

        // Track response times (keep last 10)
        if (!service.responseTimes) {
          service.responseTimes = [];
        }
        service.responseTimes.push(responseTime);
        if (service.responseTimes.length > 10) {
          service.responseTimes.shift();
        }

        const expectedStatus = service.responseExpectation || 200;

        if (response.status === expectedStatus || response.status === 200) {
          service.healthStatus = ServiceHealthStatus.HEALTHY;
          this.metrics.successfulHealthChecks++;
        } else if (response.status >= 500) {
          service.healthStatus = ServiceHealthStatus.DEGRADED;
          this.metrics.failedHealthChecks++;
        } else if (response.status >= 400) {
          service.healthStatus = ServiceHealthStatus.DEGRADED;
          this.metrics.failedHealthChecks++;
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
          service.healthStatus = ServiceHealthStatus.OFFLINE;
        } else if (axios.isAxiosError(error) && error.code === 'ETIMEDOUT') {
          service.healthStatus = ServiceHealthStatus.DEGRADED;
        } else {
          service.healthStatus = ServiceHealthStatus.OFFLINE;
        }
        this.metrics.failedHealthChecks++;
      }

      service.lastHealthCheck = new Date();
      service.lastModifiedAt = new Date();

      if (service.healthStatus !== ServiceHealthStatus.HEALTHY) {
        this.emit('service:unhealthy', {
          service: service.name,
          status: service.healthStatus,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      service.healthStatus = ServiceHealthStatus.UNKNOWN;
      console.error(
        `[SystemDiscovery] Health check failed for ${service.name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Perform health checks on all discovered services
   * Called periodically to maintain current system state
   */
  private async performHealthChecks(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const service of this.discoveredServices.values()) {
      promises.push(this.checkServiceHealth(service));
    }

    await Promise.allSettled(promises);

    // Update registry timestamp
    this.registry.lastUpdated = new Date();

    this.emit('health:checked', {
      timestamp: new Date(),
      serviceCount: this.discoveredServices.size,
    });
  }

  /**
   * Build a default health check URL based on service type and configuration
   */
  private buildHealthCheckUrl(service: ServiceInstance): string | null {
    if (!service.host || !service.port) {
      return null;
    }

    const baseUrl = `${service.protocol}://${service.host}:${service.port}`;

    switch (service.type) {
      case ServiceType.API_SERVER:
        return `${baseUrl}/health`;
      case ServiceType.DATABASE:
        return null; // Database health checks via connection test, not HTTP
      case ServiceType.CACHE:
        return null; // Redis health checks via connection test, not HTTP
      case ServiceType.MONITORING:
        return `${baseUrl}/-/healthy`;
      case ServiceType.LOAD_BALANCER:
        return `${baseUrl}/health`;
      case ServiceType.WEBSOCKET_HUB:
        return `${baseUrl}/health`;
      case ServiceType.LLM_SERVICE:
        return `${baseUrl}/health`;
      default:
        return null;
    }
  }

  /**
   * Generate unique service ID from service name
   */
  private generateServiceId(serviceName: string): string {
    const hash = createHash('sha256')
      .update(`${serviceName}-${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 12);
    return `svc_${hash}`;
  }

  /**
   * Map service type to default privilege level
   */
  private mapServicePrivilege(type: ServiceType): PrivilegeLevel {
    switch (type) {
      case ServiceType.API_SERVER:
        return PrivilegeLevel.SERVICE;
      case ServiceType.DATABASE:
        return PrivilegeLevel.ROOT;
      case ServiceType.CACHE:
        return PrivilegeLevel.SERVICE;
      case ServiceType.AGENT_SYSTEM:
        return PrivilegeLevel.ADMIN;
      case ServiceType.PAYMENT_GATEWAY:
        return PrivilegeLevel.ADMIN;
      default:
        return PrivilegeLevel.SERVICE;
    }
  }

  /**
   * Map service type to default criticality level
   */
  private mapServiceCriticality(type: ServiceType): 'critical' | 'high' | 'medium' | 'low' {
    switch (type) {
      case ServiceType.API_SERVER:
        return 'critical';
      case ServiceType.DATABASE:
        return 'critical';
      case ServiceType.CACHE:
        return 'high';
      case ServiceType.MONITORING:
        return 'medium';
      case ServiceType.PAYMENT_GATEWAY:
        return 'critical';
      default:
        return 'medium';
    }
  }

  /**
   * Get current service registry snapshot
   */
  getRegistry(): ServiceRegistry {
    return {
      ...this.registry,
      services: new Map(this.discoveredServices), // Return copy
    };
  }

  /**
   * Get all discovered services
   */
  getServices(): ServiceInstance[] {
    return Array.from(this.discoveredServices.values());
  }

  /**
   * Get specific service by ID
   */
  getService(id: string): ServiceInstance | undefined {
    return this.discoveredServices.get(id);
  }

  /**
   * Get services by type
   */
  getServicesByType(type: ServiceType): ServiceInstance[] {
    return Array.from(this.discoveredServices.values()).filter((s) => s.type === type);
  }

  /**
   * Get services by health status
   */
  getServicesByHealth(status: ServiceHealthStatus): ServiceInstance[] {
    return Array.from(this.discoveredServices.values()).filter((s) => s.healthStatus === status);
  }

  /**
   * Get discovery metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Check if discovery is currently running
   */
  isDiscoveryRunning(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
let discoveryInstance: SystemDiscovery | null = null;

export function initializeDiscovery(config: OperationalFrameworkConfig): SystemDiscovery {
  if (!discoveryInstance) {
    discoveryInstance = new SystemDiscovery(config);
  }
  return discoveryInstance;
}

export function getDiscovery(): SystemDiscovery {
  if (!discoveryInstance) {
    throw new Error('SystemDiscovery not initialized. Call initializeDiscovery first.');
  }
  return discoveryInstance;
}
