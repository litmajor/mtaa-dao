/**
 * operational-framework-routes.ts
 * Express routes for operational framework monitoring and admin
 * Mount at: /api/admin/operational
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getOperationalFramework, initializeOperationalFramework } from '../../services/operational/index';
import { getDiscovery } from '../../services/operational/discovery/discovery';
import { getAuditLogger } from '../../services/operational/audit/logger';
import { getVault } from '../../services/operational/vault/manager';
import { getRemediation } from '../../services/operational/remediation/executor';
import { OperationalFrameworkConfig } from '../../services/operational/types';

const router = Router();

// ============================================================================
// DISCOVERY & REGISTRY ROUTES
// ============================================================================

/**
 * GET /api/admin/operational/registry
 * Get current service registry
 */
router.get('/registry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const discovery = getDiscovery();
    const registry = discovery.getRegistry();

    res.json({
      success: true,
      data: {
        timestamp: registry.lastUpdated,
        serviceCount: registry.services.size,
        services: Array.from(registry.services.values()).map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          host: s.host,
          port: s.port,
          protocol: s.protocol,
          healthStatus: s.healthStatus,
          lastHealthCheck: s.lastHealthCheck,
          criticalityLevel: s.criticalityLevel,
          dependencyCount: s.dependencies.length,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/operational/services/:id
 * Get details for specific service
 */
router.get('/services/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const discovery = getDiscovery();
    const service = discovery.getService(req.params.id);

    if (!service) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }

    res.json({
      success: true,
      data: service,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/operational/services?type=api_server
 * Get services by type
 */
router.get('/services', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const discovery = getDiscovery();
    let services = discovery.getServices();

    if (req.query.type) {
      services = services.filter((s) => s.type === req.query.type);
    }

    if (req.query.health) {
      services = services.filter((s) => s.healthStatus === req.query.health);
    }

    res.json({
      success: true,
      data: {
        count: services.length,
        services,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/operational/health
 * Overall system health status
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const discovery = getDiscovery();
    const services = discovery.getServices();

    const healthy = services.filter((s) => s.healthStatus === 'healthy').length;
    const degraded = services.filter((s) => s.healthStatus === 'degraded').length;
    const offline = services.filter((s) => s.healthStatus === 'offline').length;

    const overallStatus =
      offline > 0 ? 'critical' : degraded > 0 ? 'degraded' : 'healthy';

    res.json({
      success: true,
      data: {
        status: overallStatus,
        timestamp: new Date(),
        services: {
          total: services.length,
          healthy,
          degraded,
          offline,
        },
        metrics: discovery.getMetrics(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// AUDIT TRAIL ROUTES
// ============================================================================

/**
 * GET /api/admin/operational/audit
 * Query audit events with filters
 */
router.get('/audit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auditLogger = getAuditLogger();

    const hoursBack = parseInt((req.query.hours as string) || '24');
    const timeRange = {
      startTime: new Date(Date.now() - hoursBack * 60 * 60 * 1000),
      endTime: new Date(),
    };

    const events = auditLogger.queryEvents({
      action: req.query.action as any,
      actor: req.query.actor as string,
      timeRange: req.query.hours ? timeRange : undefined,
    });

    res.json({
      success: true,
      data: {
        count: events.length,
        events: events.slice(0, 100), // Limit to 100
        statistics: auditLogger.getStatistics(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/operational/audit/verify
 * Verify audit trail integrity
 */
router.get('/audit/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auditLogger = getAuditLogger();
    const trail = auditLogger.getTrail();

    res.json({
      success: true,
      data: {
        chainIntegrity: trail.integrityVerified,
        totalEvents: trail.events.length,
        lastEventHash: trail.lastEventHash,
        message: trail.integrityVerified
          ? 'Audit chain is valid'
          : 'WARNING: Audit chain integrity violation detected',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/operational/audit/export
 * Export audit trail for compliance
 */
router.get('/audit/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auditLogger = getAuditLogger();
    const format = req.query.format || 'json';

    let exportData: string;

    if (format === 'csv') {
      exportData = auditLogger.exportToCSV();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-trail.csv"');
    } else {
      exportData = auditLogger.exportToJSON();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-trail.json"');
    }

    res.send(exportData);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// VAULT & SECRETS MANAGEMENT ROUTES
// ============================================================================

/**
 * GET /api/admin/operational/vault/status
 * Get vault status and statistics
 */
router.get('/vault/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vault = getVault();
    const stats = vault.getStatistics();

    res.json({
      success: true,
      data: {
        timestamp: new Date(),
        statistics: stats,
        alerting: {
          compromisedCredentials: stats.compromisedCredentials > 0,
          credentialsDueForRotation: stats.credentialsDueForRotation > 0,
          hardcodedSecretsFound: stats.hardcodedSecretsFound > 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/operational/vault/drift
 * Get detected configuration drift
 */
router.get('/vault/drift', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vault = getVault();
    const drifts = vault.getDriftDetections();

    const unresolved = drifts.filter((d) => !d.resolved);

    res.json({
      success: true,
      data: {
        unresolved: unresolved.length,
        resolved: drifts.filter((d) => d.resolved).length,
        drifts: unresolved.map((d) => ({
          id: d.id,
          type: d.type,
          location: d.location,
          severity: d.severity,
          remediation: d.remediation,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/operational/vault/drift/:id/resolve
 * Mark drift as resolved
 */
router.post('/vault/drift/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vault = getVault();
    await vault.resolveDrift(req.params.id);

    res.json({
      success: true,
      message: 'Drift marked as resolved',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// VALIDATION & ARCHITECTURE ROUTES
// ============================================================================

/**
 * GET /api/admin/operational/validate
 * Trigger architecture validation
 */
router.get('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const framework = getOperationalFramework();
    const report = await framework.validate();

    res.json({
      success: true,
      data: {
        healthStatus: report.healthStatus,
        totalGaps: report.gaps.length,
        criticalGaps: report.gaps.filter((g: any) => g.severity === 'critical').length,
        warningGaps: report.gaps.filter((g: any) => g.severity === 'warning').length,
        statistics: {
          totalServices: report.totalServices,
          healthyServices: report.healthyServices,
          degradedServices: report.degradedServices,
          offlineServices: report.offlineServices,
          brokenDependencies: report.brokenDependencies,
        },
        recommendations: report.recommendations,
        gaps: report.gaps.slice(0, 20), // Top 20 gaps
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// REMEDIATION ROUTES
// ============================================================================

/**
 * GET /api/admin/operational/remediation
 * Get remediation action history
 */
router.get('/remediation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const remediation = getRemediation();
    const actions = remediation.getActions();

    res.json({
      success: true,
      data: {
        statistics: remediation.getStatistics(),
        recentActions: actions.slice(-20),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/operational/remediation/:id/approve
 * Approve a remediation action
 */
router.post('/remediation/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const remediation = getRemediation();
    const actor = (req as any).user?.id || 'unknown';

    const action = await remediation.approveAction(req.params.id, actor);

    res.json({
      success: true,
      data: action,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/operational/remediation/:id/execute
 * Execute a remediation action
 */
router.post('/remediation/:id/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const remediation = getRemediation();
    const executor = (req as any).user?.id || 'unknown';

    const action = await remediation.executeAction(req.params.id, executor);

    res.json({
      success: true,
      data: action,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// OPERATIONAL STATE ROUTES
// ============================================================================

/**
 * GET /api/admin/operational/state
 * Get complete operational state
 */
router.get('/state', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const framework = getOperationalFramework();
    const state = await framework.getOperationalState();

    res.json({
      success: true,
      data: {
        timestamp: state.timestamp,
        overallHealth: state.overallHealth,
        criticalAlerts: state.criticalAlerts,
        warningAlerts: state.warningAlerts,
        services: {
          total: state.registry.services.size,
        },
        statistics: framework.getStatistics(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/operational/state/export
 * Export full operational state
 */
router.get('/state/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const framework = getOperationalFramework();
    const exportData = await framework.exportState();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="operational-state.json"');
    res.send(exportData);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// INITIALIZATION ROUTES
// ============================================================================

/**
 * POST /api/admin/operational/initialize
 * Initialize the operational framework
 * Only callable once; subsequent calls are no-ops
 */
router.post('/initialize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config: OperationalFrameworkConfig = req.body || {
      discovery: {
        enabled: true,
        intervalMs: 30000,
        healthCheckTimeout: 5000,
        retryAttempts: 2,
        expectedServices: [],
      },
      audit: {
        enabled: true,
        storageBackend: 'postgresql',
        immutabilityEnabled: true,
        hashChainVerification: true,
      },
      vault: {
        enabled: true,
        rotationEnabled: true,
        rotationIntervalDays: 7,
        driftDetectionEnabled: true,
      },
      validation: {
        enabled: true,
        intervalMs: 300000,
        criticalityThreshold: 'high',
      },
      remediation: {
        enabled: true,
        requiresApprovalForDestructive: true,
        maxAttemptsPerService24h: 3,
        autoRemediateNonDestructive: false,
      },
    };

    const framework = await initializeOperationalFramework(config);

    res.json({
      success: true,
      message: 'Operational framework initialized',
      isInitialized: framework.isInitialized_(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
