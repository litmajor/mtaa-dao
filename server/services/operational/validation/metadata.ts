/**
 * System Metadata Model & Architecture Validator
 * Generates system topology metadata and detects gaps, inconsistencies, configurations drifts
 */

import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  SystemMetadata,
  ServiceInstance,
  ServiceDependency,
  DependencyGraph,
  DependencyType,
  RiskZone,
  ArchitectureGap,
  ArchitectureValidationReport,
  ServiceHealthStatus,
  ServiceType,
  PrivilegeLevel,
  OperationalFrameworkConfig,
} from '../types';
import { getDiscovery } from '../discovery/discovery';

export class SystemMetadataModel extends EventEmitter {
  private metadata: SystemMetadata | null = null;
  private dependencyGraph: DependencyGraph | null = null;
  private previousTopologyHash: string | null = null;
  private config: OperationalFrameworkConfig;

  constructor(config: OperationalFrameworkConfig) {
    super();
    this.config = config;
  }

  /**
   * Generate current system metadata from discovery
   */
  async generateMetadata(expectedServices: ServiceInstance[] = []): Promise<SystemMetadata> {
    const discovery = getDiscovery();
    const discoveredServices = discovery.getServices();
    const now = new Date();

    // Build dependency graph
    this.dependencyGraph = this.buildDependencyGraph(discoveredServices);

    // Identify gaps
    const missingServices = this.identifyMissingServices(discoveredServices, expectedServices);
    const unexpectedServices = this.identifyUnexpectedServices(discoveredServices, expectedServices);

    // Build privilege matrix
    const privilegeMatrix = this.buildPrivilegeMatrix(discoveredServices);

    // Compute topology hash
    const topologyHash = this.computeTopologyHash(discoveredServices);
    const changesSinceLastCapture = this.previousTopologyHash
      ? this.detectTopologyChanges(this.previousTopologyHash, topologyHash)
      : [];

    this.metadata = {
      id: uuidv4(),
      version: now.toISOString(),
      capturedAt: now,
      services: discoveredServices,
      dependencies: Array.from(this.dependencyGraph.edges.values()).flat(),
      privilegeMatrix,
      expectedServices,
      missingServices,
      unexpectedServices,
      topologyHash,
      previousTopologyHash: this.previousTopologyHash,
      changesSinceLastCapture,
    };

    this.previousTopologyHash = topologyHash;

    this.emit('metadata:generated', {
      timestamp: now,
      serviceCount: discoveredServices.length,
      dependencyCount: this.dependencyGraph.edges.size,
      hasChanges: changesSinceLastCapture.length > 0,
    });

    console.log(
      `[SystemMetadata] Generated metadata: ${discoveredServices.length} services, ${changesSinceLastCapture.length} changes`
    );

    return this.metadata;
  }

  /**
   * Get current metadata
   */
  getMetadata(): SystemMetadata | null {
    return this.metadata;
  }

  /**
   * Get dependency graph
   */
  getDependencyGraph(): DependencyGraph | null {
    return this.dependencyGraph;
  }

  /**
   * Build dependency graph from service connections
   */
  private buildDependencyGraph(services: ServiceInstance[]): DependencyGraph {
    const nodes = new Map<string, ServiceInstance>();
    const edges = new Map<string, ServiceDependency[]>();
    const cycles: string[][] = [];

    // Add all services as nodes
    services.forEach((service) => nodes.set(service.id, service));

    // Build edges from dependency relationships
    services.forEach((service) => {
      const serviceDependencies: ServiceDependency[] = [];

      for (const depId of service.dependencies) {
        const depService = nodes.get(depId);

        if (depService) {
          const dependency: ServiceDependency = {
            sourceServiceId: service.id,
            targetServiceId: depId,
            type: this.inferDependencyType(service.type, depService.type),
            dataClassification: this.inferDataClassification(service.type, depService.type),
            privilegeRequired: Math.max(service.privilegeLevel as any, depService.privilegeLevel as any),
            isAuthenticatedConnection: this.requiresAuthentication(service.type, depService.type),
            potentialEscalationPath: this.detectEscalationPath(service, depService),
            circularDependency: false, // Will be updated after full graph
          };

          serviceDependencies.push(dependency);
        }
      }

      if (serviceDependencies.length > 0) {
        edges.set(service.id, serviceDependencies);
      }
    });

    // Detect circular dependencies
    const detectedCycles = this.detectCycles(edges);
    detectedCycles.forEach((cycle) => {
      for (let i = 0; i < cycle.length; i++) {
        const sourceId = cycle[i];
        const deps = edges.get(sourceId);
        if (deps) {
          const dep = deps.find((d) => d.targetServiceId === cycle[(i + 1) % cycle.length]);
          if (dep) {
            dep.circularDependency = true;
          }
        }
      }
    });

    // Identify risk zones
    const riskZones = this.identifyRiskZones(nodes, edges);

    return {
      nodes,
      edges,
      cycles: detectedCycles,
      riskZones,
    };
  }

  /**
   * Build privilege matrix (who can access what)
   */
  private buildPrivilegeMatrix(services: ServiceInstance[]): Record<string, string[]> {
    const matrix: Record<string, string[]> = {};

    services.forEach((service) => {
      if (service.canAccess.length > 0) {
        matrix[service.id] = service.canAccess;
      }
    });

    return matrix;
  }

  /**
   * Identify missing services (expected but not discovered)
   */
  private identifyMissingServices(
    discovered: ServiceInstance[],
    expected: ServiceInstance[]
  ): ServiceInstance[] {
    const discoveredIds = new Set(discovered.map((s) => s.id));
    return expected.filter((e) => !discoveredIds.has(e.id));
  }

  /**
   * Identify unexpected services (discovered but not expected)
   */
  private identifyUnexpectedServices(
    discovered: ServiceInstance[],
    expected: ServiceInstance[]
  ): ServiceInstance[] {
    const expectedIds = new Set(expected.map((s) => s.id));

    if (expectedIds.size === 0) {
      // If no expected services defined, all are expected
      return [];
    }

    return discovered.filter((d) => !expectedIds.has(d.id));
  }

  /**
   * Infer dependency type based on service types
   */
  private inferDependencyType(sourceType: ServiceType, targetType: ServiceType): DependencyType {
    if (targetType === ServiceType.DATABASE) return DependencyType.DATABASE_QUERY;
    if (targetType === ServiceType.CACHE) return DependencyType.CACHE_ACCESS;
    if (targetType === ServiceType.MESSAGE_QUEUE) return DependencyType.MESSAGE_QUEUE;
    if (targetType === ServiceType.BLOCKCHAIN_NODE) return DependencyType.BLOCKCHAIN_RPC;
    if (targetType === ServiceType.WEBSOCKET_HUB) return DependencyType.WEBSOCKET;
    return DependencyType.HTTP_REQUEST;
  }

  /**
   * Infer data classification based on service types
   */
  private inferDataClassification(
    sourceType: ServiceType,
    targetType: ServiceType
  ): 'public' | 'internal' | 'confidential' | 'secret' {
    if (targetType === ServiceType.DATABASE || targetType === ServiceType.PAYMENT_GATEWAY) {
      return 'secret';
    }
    if (targetType === ServiceType.CACHE || targetType === ServiceType.MESSAGE_QUEUE) {
      return 'confidential';
    }
    return 'internal';
  }

  /**
   * Check if connection requires authentication
   */
  private requiresAuthentication(sourceType: ServiceType, targetType: ServiceType): boolean {
    if (targetType === ServiceType.DATABASE) return true;
    if (targetType === ServiceType.PAYMENT_GATEWAY) return true;
    if (targetType === ServiceType.BLOCKCHAIN_NODE) return true;
    return false;
  }

  /**
   * Detect potential privilege escalation paths
   */
  private detectEscalationPath(source: ServiceInstance, target: ServiceInstance): boolean {
    // If source can access a higher privilege target, it's an escalation path
    return source.privilegeLevel < target.privilegeLevel;
  }

  /**
   * Detect circular dependencies in the graph
   */
  private detectCycles(edges: Map<string, ServiceDependency[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = edges.get(node) || [];

      for (const dep of neighbors) {
        if (!visited.has(dep.targetServiceId)) {
          dfs(dep.targetServiceId, [...path]);
        } else if (recursionStack.has(dep.targetServiceId)) {
          // Found cycle
          const cycleStart = path.indexOf(dep.targetServiceId);
          if (cycleStart !== -1) {
            cycles.push([...path.slice(cycleStart), dep.targetServiceId]);
          }
        }
      }

      recursionStack.delete(node);
    };

    for (const node of edges.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Identify risk zones (clusters of risky services)
   */
  private identifyRiskZones(
    nodes: Map<string, ServiceInstance>,
    edges: Map<string, ServiceDependency[]>
  ): RiskZone[] {
    const riskZones: RiskZone[] = [];

    // Payment gateway zone
    const paymentServices = Array.from(nodes.values()).filter((s) => s.type === ServiceType.PAYMENT_GATEWAY);
    if (paymentServices.length > 0) {
      riskZones.push({
        serviceIds: paymentServices.map((s) => s.id),
        riskLevel: 'critical',
        reason: 'Financial transaction processing - highest privilege',
        escalationPaths: this.findEscalationPaths(paymentServices, nodes, edges),
      });
    }

    // Database zone
    const dbServices = Array.from(nodes.values()).filter((s) => s.type === ServiceType.DATABASE);
    if (dbServices.length > 0) {
      riskZones.push({
        serviceIds: dbServices.map((s) => s.id),
        riskLevel: 'critical',
        reason: 'Data storage and retrieval - sensitive information',
        escalationPaths: this.findEscalationPaths(dbServices, nodes, edges),
      });
    }

    return riskZones;
  }

  /**
   * Find escalation paths to/from services
   */
  private findEscalationPaths(
    targetServices: ServiceInstance[],
    nodes: Map<string, ServiceInstance>,
    edges: Map<string, ServiceDependency[]>
  ): string[][] {
    const paths: string[][] = [];
    const targetIds = new Set(targetServices.map((s) => s.id));

    // Find all paths that lead to these services
    for (const [source, dependencies] of edges) {
      for (const dep of dependencies) {
        if (targetIds.has(dep.targetServiceId) && dep.potentialEscalationPath) {
          paths.push([source, dep.targetServiceId]);
        }
      }
    }

    return paths;
  }

  /**
   * Compute topology hash for change detection
   */
  private computeTopologyHash(services: ServiceInstance[]): string {
    const data = JSON.stringify(
      services
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((s) => ({
          id: s.id,
          type: s.type,
          host: s.host,
          port: s.port,
          healthStatus: s.healthStatus,
        }))
    );

    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Detect specific topology changes between old and new topology
   * Returns detailed list of what changed
   */
  private detectTopologyChanges(oldHash: string, newHash: string): string[] {
    if (oldHash === newHash) {
      return [];
    }

    const changes: string[] = [];
    const discovery = getDiscovery();
    const currentServices = discovery.getServices();
    
    // Get previous services from metadata (if available)
    const previousServices = this.metadata?.services || [];
    const previousServiceMap = new Map(previousServices.map((s) => [s.id, s]));
    const currentServiceMap = new Map(currentServices.map((s) => [s.id, s]));

    // Check for added services
    for (const [id, service] of currentServiceMap) {
      if (!previousServiceMap.has(id)) {
        changes.push(`[ADDED] Service: ${service.name} (${service.type}) at ${service.host}:${service.port}`);
      }
    }

    // Check for removed services
    for (const [id, service] of previousServiceMap) {
      if (!currentServiceMap.has(id)) {
        changes.push(`[REMOVED] Service: ${service.name} (${service.type})`);
      }
    }

    // Check for changed services
    for (const [id, currentService] of currentServiceMap) {
      const previousService = previousServiceMap.get(id);
      if (!previousService) continue;

      const changeDetails: string[] = [];

      // Health status changed
      if (currentService.healthStatus !== previousService.healthStatus) {
        changeDetails.push(
          `health_status: ${previousService.healthStatus} → ${currentService.healthStatus}`
        );
      }

      // Response time changed significantly (> 50% delta)
      if (Math.abs(currentService.lastResponseTime - previousService.lastResponseTime) > 
          previousService.lastResponseTime * 0.5) {
        changeDetails.push(
          `response_time: ${previousService.lastResponseTime}ms → ${currentService.lastResponseTime}ms`
        );
      }

      // Dependencies changed
      const prevDeps = new Set(previousService.dependencies);
      const currDeps = new Set(currentService.dependencies);
      const addedDeps = [...currDeps].filter(d => !prevDeps.has(d));
      const removedDeps = [...prevDeps].filter(d => !currDeps.has(d));

      if (addedDeps.length > 0) {
        changeDetails.push(`dependencies_added: [${addedDeps.join(', ')}]`);
      }
      if (removedDeps.length > 0) {
        changeDetails.push(`dependencies_removed: [${removedDeps.join(', ')}]`);
      }

      // Port changed
      if (currentService.port !== previousService.port) {
        changeDetails.push(`port: ${previousService.port} → ${currentService.port}`);
      }

      // Host changed
      if (currentService.host !== previousService.host) {
        changeDetails.push(`host: ${previousService.host} → ${currentService.host}`);
      }

      // Last check time changed (indicates activity)
      if (currentService.lastHealthCheck.getTime() !== previousService.lastHealthCheck.getTime()) {
        const failureCount = currentService.consecutiveFailures - previousService.consecutiveFailures;
        if (failureCount !== 0) {
          changeDetails.push(`consecutive_failures: ${failureCount > 0 ? '+' : ''}${failureCount}`);
        }
      }

      if (changeDetails.length > 0) {
        changes.push(`[CHANGED] ${currentService.name}: ${changeDetails.join(' | ')}`);
      }
    }

    // If significant changes but hashes differ, log it
    if (changes.length === 0 && oldHash !== newHash) {
      changes.push('[INFO] Topology hash mismatch detected but no service-level changes found (possible metadata change)');
    }

    return changes;
  }
}

/**
 * Architecture Validator
 * Detects gaps, inconsistencies, missing components
 */
export class ArchitectureValidator extends EventEmitter {
  private config: OperationalFrameworkConfig;
  private model: SystemMetadataModel;

  constructor(config: OperationalFrameworkConfig, model: SystemMetadataModel) {
    super();
    this.config = config;
    this.model = model;
  }

  /**
   * Validate system architecture and generate report
   */
  async validate(): Promise<ArchitectureValidationReport> {
    const metadata = this.model.getMetadata();

    if (!metadata) {
      throw new Error('No metadata available. Call generateMetadata first.');
    }

    const gaps: ArchitectureGap[] = [];

    // Run all validations
    gaps.push(...this.validateServiceHealth(metadata));
    gaps.push(...this.validateDependencies(metadata));
    gaps.push(...this.validatePrivileges(metadata));
    gaps.push(...this.validateCriticalServices(metadata));
    gaps.push(...this.validateCircularDependencies(metadata));

    // Compute statistics
    const healthyServices = metadata.services.filter((s) => s.healthStatus === ServiceHealthStatus.HEALTHY).length;
    const degradedServices = metadata.services.filter((s) => s.healthStatus === ServiceHealthStatus.DEGRADED).length;
    const offlineServices = metadata.services.filter((s) => s.healthStatus === ServiceHealthStatus.OFFLINE).length;

    const dependencyGraph = this.model.getDependencyGraph();
    const brokenDependencies = dependencyGraph
      ? Array.from(dependencyGraph.edges.values())
          .flat()
          .filter((d) => {
            const targetService = metadata.services.find((s) => s.id === d.targetServiceId);
            return targetService && targetService.healthStatus !== ServiceHealthStatus.HEALTHY;
          }).length
      : 0;

    const circularDependencies = dependencyGraph?.cycles || [];

    // Determine health status
    const healthStatus =
      gaps.filter((g) => g.severity === 'critical').length > 0
        ? 'critical'
        : gaps.filter((g) => g.severity === 'warning').length > 0
          ? 'degraded'
          : 'healthy';

    // Generate recommendations
    const recommendations = this.generateRecommendations(gaps, metadata);

    const report: ArchitectureValidationReport = {
      id: uuidv4(),
      generatedAt: new Date(),
      systemMetadata: metadata,
      gaps,
      healthStatus,
      totalServices: metadata.services.length,
      healthyServices,
      degradedServices,
      offlineServices,
      totalDependencies: metadata.dependencies.length,
      brokenDependencies,
      circularDependencies: circularDependencies.map((c) => c),
      recommendations,
    };

    this.emit('validation:complete', {
      timestamp: new Date(),
      healthStatus,
      gapCount: gaps.length,
    });

    console.log(`[ArchitectureValidator] Validation complete: ${gaps.length} gaps found, status=${healthStatus}`);

    return report;
  }

  /**
   * Validate service health status
   */
  private validateServiceHealth(metadata: SystemMetadata): ArchitectureGap[] {
    const gaps: ArchitectureGap[] = [];

    const offlineServices = metadata.services.filter((s) => s.healthStatus === ServiceHealthStatus.OFFLINE);

    offlineServices.forEach((service) => {
      gaps.push({
        id: uuidv4(),
        detectedAt: new Date(),
        category: 'unhealthy_service',
        severity: service.criticalityLevel === 'critical' ? 'critical' : 'warning',
        affectedServices: [service.id],
        description: `Service ${service.name} is offline`,
        impact: `${service.name} (${service.type}) at ${service.host}:${service.port} is not responding`,
        suggestedRemediation: `Check service logs and restart: systemctl restart ${service.name}`,
        resolved: false,
      });
    });

    return gaps;
  }

  /**
   * Validate dependencies are resolvable
   */
  private validateDependencies(metadata: SystemMetadata): ArchitectureGap[] {
    const gaps: ArchitectureGap[] = [];
    const serviceIds = new Set(metadata.services.map((s) => s.id));

    for (const service of metadata.services) {
      for (const depId of service.dependencies) {
        if (!serviceIds.has(depId)) {
          gaps.push({
            id: uuidv4(),
            detectedAt: new Date(),
            category: 'broken_dependency',
            severity: 'warning',
            affectedServices: [service.id, depId],
            description: `Unresolved dependency: ${service.name} depends on unknown service ${depId}`,
            impact: `${service.name} may fail if dependency is required`,
            suggestedRemediation: `Register missing service or remove dependency declaration`,
            resolved: false,
          });
        }
      }
    }

    return gaps;
  }

  /**
   * Validate privilege assignments
   */
  private validatePrivileges(metadata: SystemMetadata): ArchitectureGap[] {
    const gaps: ArchitectureGap[] = [];

    // Detect overly permissive services
    for (const service of metadata.services) {
      if (service.privilegeLevel === PrivilegeLevel.ROOT && service.type !== ServiceType.DATABASE) {
        gaps.push({
          id: uuidv4(),
          detectedAt: new Date(),
          category: 'privilege_violation',
          severity: 'warning',
          affectedServices: [service.id],
          description: `Non-database service has ROOT privilege: ${service.name}`,
          impact: `Service has excessive permissions that could lead to privilege escalation`,
          suggestedRemediation: `Reduce privilege level to ADMIN or SERVICE`,
          resolved: false,
        });
      }
    }

    return gaps;
  }

  /**
   * Validate critical services are healthy
   */
  private validateCriticalServices(metadata: SystemMetadata): ArchitectureGap[] {
    const gaps: ArchitectureGap[] = [];

    const criticalOffline = metadata.services.filter(
      (s) => s.criticalityLevel === 'critical' && s.healthStatus !== ServiceHealthStatus.HEALTHY
    );

    if (criticalOffline.length > 0) {
      gaps.push({
        id: uuidv4(),
        detectedAt: new Date(),
        category: 'unhealthy_service',
        severity: 'critical',
        affectedServices: criticalOffline.map((s) => s.id),
        description: `${criticalOffline.length} critical services are not healthy`,
        impact: `System functionality is impaired or degraded`,
        suggestedRemediation: `Immediately investigate and restore critical services`,
        resolved: false,
      });
    }

    return gaps;
  }

  /**
   * Validate circular dependencies
   */
  private validateCircularDependencies(metadata: SystemMetadata): ArchitectureGap[] {
    const gaps: ArchitectureGap[] = [];
    const dependencyGraph = this.model.getDependencyGraph();

    if (dependencyGraph && dependencyGraph.cycles.length > 0) {
      dependencyGraph.cycles.forEach((cycle) => {
        gaps.push({
          id: uuidv4(),
          detectedAt: new Date(),
          category: 'broken_dependency',
          severity: 'warning',
          affectedServices: cycle,
          description: `Circular dependency detected: ${cycle.join(' -> ')}`,
          impact: `Potential deadlock or initialization ordering issues`,
          suggestedRemediation: `Refactor to break cycle by introducing intermediate service or message queue`,
          resolved: false,
        });
      });
    }

    return gaps;
  }

  /**
   * Generate recommendations based on gaps
   */
  private generateRecommendations(gaps: ArchitectureGap[], metadata: SystemMetadata): string[] {
    const recommendations: string[] = [];

    const criticalGaps = gaps.filter((g) => g.severity === 'critical');
    if (criticalGaps.length > 0) {
      recommendations.push(`URGENT: Address ${criticalGaps.length} critical gaps immediately`);
    }

    if (metadata.missingServices.length > 0) {
      recommendations.push(`Deploy missing services: ${metadata.missingServices.map((s) => s.name).join(', ')}`);
    }

    if (metadata.unexpectedServices.length > 0) {
      recommendations.push(`Investigate unexpected services: ${metadata.unexpectedServices.map((s) => s.name).join(', ')}`);
    }

    const offlineServices = metadata.services.filter((s) => s.healthStatus === ServiceHealthStatus.OFFLINE);
    if (offlineServices.length > 0) {
      recommendations.push(
        `Restart offline services: ${offlineServices.map((s) => s.name).join(', ')}`
      );
    }

    const dependencyGraph = this.model.getDependencyGraph();
    if (dependencyGraph && dependencyGraph.cycles.length > 0) {
      recommendations.push(`Refactor to eliminate ${dependencyGraph.cycles.length} circular dependencies`);
    }

    return recommendations;
  }
}
