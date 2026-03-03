/**
 * operational-framework-routes.ts
 * Express routes for operational framework monitoring and admin
 * Mount at: /api/admin/operational
 * 
 * SECURITY: All endpoints require super_admin authentication
 * These are CRITICAL system-state mutating operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getOperationalFramework, initializeOperationalFramework } from '../../services/operational/index';
import { getDiscovery } from '../../services/operational/discovery/discovery';
import { getAuditLogger } from '../../services/operational/audit/logger';
import { getVault } from '../../services/operational/vault/manager';
import { getRemediation } from '../../services/operational/remediation/executor';
import { OperationalFrameworkConfig } from '../../services/operational/types';
import { requireRole } from '../../middleware/rbac';
import { createRateLimiter } from '../../middleware/rateLimiting';
import { auditConsolidated } from '../../services/auditConsolidated';
import { Logger } from '../../utils/logger';

const router = Router();
const logger = Logger.getLogger();

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION MIDDLEWARE FOR OPERATIONAL ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Middleware: Require super_admin role
 * All operational routes require this authentication
 */
const requireSuperAdmin = requireRole('super_admin');

/**
 * Rate limiter for read operations: 100 per 15 minutes per user
 * Operational diagnostics are informational, not as sensitive as mutations
 */
const operationalReadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.id || 'unknown';
    return `operational_read:${userId}`;
  }
});

/**
 * Rate limiter for mutation operations: 10 per 15 minutes per user
 * Critical: Remediation and state modifications are heavily rate limited
 */
const operationalMutateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.id || 'unknown';
    return `operational_mutate:${userId}`;
  }
});

/**
 * Audit middleware to log all operational actions
 */
async function auditOperationalAction(
  action: string,
  resourceId: string,
  status: 'success' | 'denied' | 'pending',
  details: Record<string, any>,
  req: Request
) {
  const userId = (req as any).user?.id || 'unknown';
  
  try {
    await auditConsolidated.logConsolidatedAuditEvent({
      userId,
      action,
      resourceId,
      status,
      details: {
        ...details,
        ip: req.ip,
        userAgent: req.get('user-agent')
      },
      severity: status === 'denied' ? 'high' : 'medium'
    });
  } catch (err) {
    logger.error(`Failed to audit operational action ${action}:`, err);
  }
}

// ============================================================================
// DISCOVERY & REGISTRY ROUTES (READ - Authentication Required)
// ============================================================================

/**
 * GET /api/admin/operational/registry
 * Get current service registry
 * SECURITY: Requires super_admin role + rate limiting
 */
router.get('/registry', requireSuperAdmin, operationalReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const discovery = getDiscovery();
    const registry = discovery.getRegistry();

    // Audit log read access
    await auditOperationalAction(
      'operational_registry_read',
      'service_registry',
      'success',
      { serviceCount: registry.services.size },
      req
    );

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
    logger.error('[Operational] Registry endpoint error:', error);
    next(error);
  }
});

/**
 * GET /api/admin/operational/services/:id
 * Get details for specific service
 * SECURITY: Requires super_admin role + rate limiting
 */
router.get('/services/:id', requireSuperAdmin, operationalReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const discovery = getDiscovery();
    const service = discovery.getService(req.params.id);

    // Audit log access
    await auditOperationalAction(
      'operational_service_read',
      req.params.id,
      service ? 'success' : 'denied',
      { found: !!service },
      req
    );

    if (!service) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }

    res.json({
      success: true,
      data: service,
    });
  } catch (error) {
    logger.error('[Operational] Service details endpoint error:', error);
    next(error);
  }
});

/**
 * GET /api/admin/operational/services?type=api_server
 * Get services by type
 * SECURITY: Requires super_admin role + rate limiting
 */
router.get('/services', requireSuperAdmin, operationalReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const discovery = getDiscovery();
    let services = discovery.getServices();

    if (req.query.type) {
      services = services.filter((s) => s.type === req.query.type);
    }

    if (req.query.health) {
      services = services.filter((s) => s.healthStatus === req.query.health);
    }

    // Audit log
    await auditOperationalAction(
      'operational_services_list',
      'services',
      'success',
      { filtered: !!req.query.type || !!req.query.health, count: services.length },
      req
    );

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
 * SECURITY: Requires super_admin role + rate limiting
 */
router.get('/health', requireSuperAdmin, operationalReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const discovery = getDiscovery();
    const services = discovery.getServices();

    const healthy = services.filter((s) => s.healthStatus === 'healthy').length;
    const degraded = services.filter((s) => s.healthStatus === 'degraded').length;
    const offline = services.filter((s) => s.healthStatus === 'offline').length;

    const overallStatus =
      offline > 0 ? 'critical' : degraded > 0 ? 'degraded' : 'healthy';

    // Audit log
    await auditOperationalAction(
      'operational_health_check',
      'system_health',
      'success',
      { overallStatus, healthy, degraded, offline },
      req
    );

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
    logger.error('[Operational] Health check error:', error);
    next(error);
  }
});

// ============================================================================
// AUDIT TRAIL ROUTES (READ - Authentication Required)
// ============================================================================

/**
 * GET /api/admin/operational/audit
 * Query audit events with filters
 * SECURITY: Requires super_admin role + rate limiting
 */
router.get('/audit', requireSuperAdmin, operationalReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
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

    // Audit log the audit query
    await auditOperationalAction(
      'operational_audit_query',
      'audit_logs',
      'success',
      { eventCount: events.length, hoursBack, action: req.query.action },
      req
    );

    res.json({
      success: true,
      data: {
        count: events.length,
        events: events.slice(0, 100), // Limit to 100
        statistics: auditLogger.getStatistics(),
      },
    });
  } catch (error) {
    logger.error('[Operational] Audit query error:', error);
    next(error);
  }
});

/**
 * GET /api/admin/operational/audit/verify
 * Verify audit trail integrity
 * SECURITY: Requires super_admin role + rate limiting
 */
router.get('/audit/verify', requireSuperAdmin, operationalReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auditLogger = getAuditLogger();
    const trail = auditLogger.getTrail();

    // Audit log
    await auditOperationalAction(
      'operational_audit_verify',
      'audit_trail',
      'success',
      { integrityVerified: trail.integrityVerified, eventCount: trail.events.length },
      req
    );

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
    logger.error('[Operational] Audit verify error:', error);
    next(error);
  }
});

/**
 * GET /api/admin/operational/audit/export
 * Export audit trail for compliance
 * SECURITY: Requires super_admin role + rate limiting
 */
router.get('/audit/export', requireSuperAdmin, operationalReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auditLogger = getAuditLogger();
    const format = req.query.format || 'json';

    // Audit log this compliance export
    await auditOperationalAction(
      'operational_audit_export',
      'audit_trail',
      'success',
      { format, exportTime: new Date().toISOString() },
      req
    );

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
// VAULT & SECRETS MANAGEMENT ROUTES (READ - Authentication Required)
// ============================================================================

/**
 * GET /api/admin/operational/vault/status
 * Get vault status and statistics
 * SECURITY: Requires super_admin role + rate limiting
 */
router.get('/vault/status', requireSuperAdmin, operationalReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vault = getVault();
    const stats = vault.getStatistics();

    // Audit log
    await auditOperationalAction(
      'operational_vault_status_read',
      'vault',
      'success',
      { 
        compromisedCredentials: stats.compromisedCredentials,
        credentialsDueForRotation: stats.credentialsDueForRotation
      },
      req
    );

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
    logger.error('[Operational] Vault status error:', error);
    next(error);
  }
});

/**
 * GET /api/admin/operational/vault/drift
 * Get detected configuration drift
 * SECURITY: Requires super_admin role + rate limiting
 */
router.get('/vault/drift', requireSuperAdmin, operationalReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vault = getVault();
    const drifts = vault.getDriftDetections();

    const unresolved = drifts.filter((d) => !d.resolved);

    // Audit log
    await auditOperationalAction(
      'operational_vault_drift_read',
      'vault_drift',
      'success',
      { unresolvedCount: unresolved.length, totalCount: drifts.length },
      req
    );

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
 * Mark drift as resolved (MUTATION - Highest Rate Limit)
 * SECURITY: Requires super_admin role + heavy rate limiting
 */
router.post('/vault/drift/:id/resolve', requireSuperAdmin, operationalMutateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vault = getVault();
    await vault.resolveDrift(req.params.id);

    // Audit log this critical action
    await auditOperationalAction(
      'operational_vault_drift_resolved',
      req.params.id,
      'success',
      { driftId: req.params.id, resolvedBy: (req as any).user?.id },
      req
    );

    res.json({
      success: true,
      message: 'Drift marked as resolved',
    });
  } catch (error) {
    logger.error('[Operational] Drift resolve error:', error);
    // Audit failed attempt
    await auditOperationalAction(
      'operational_vault_drift_resolve_failed',
      req.params.id,
      'denied',
      { driftId: req.params.id, error: String(error) },
      req
    );
    next(error);
    next(error);
  }
});

// ============================================================================
// VALIDATION & ARCHITECTURE ROUTES (READ - Authentication Required)
// ============================================================================

/**
 * GET /api/admin/operational/validate
 * Trigger architecture validation
 * SECURITY: Requires super_admin role + rate limiting
 */
router.get('/validate', requireSuperAdmin, operationalReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const framework = getOperationalFramework();
    const report = await framework.validate();

    // Audit log
    await auditOperationalAction(
      'operational_validate',
      'architecture',
      'success',
      { 
        totalGaps: report.gaps.length,
        criticalCount: report.gaps.filter((g: any) => g.severity === 'critical').length
      },
      req
    );

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
    logger.error('[Operational] Validate error:', error);
    next(error);
  }
});

// ============================================================================
// REMEDIATION ROUTES (MUTATIONS - Highest Auth Required)
// ============================================================================

/**
 * GET /api/admin/operational/remediation
 * Get remediation action history
 * SECURITY: Requires super_admin role + rate limiting
 */
router.get('/remediation', requireSuperAdmin, operationalReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const remediation = getRemediation();
    const actions = remediation.getActions();

    // Audit log
    await auditOperationalAction(
      'operational_remediation_list',
      'remediation_actions',
      'success',
      { actionCount: actions.length },
      req
    );

    res.json({
      success: true,
      data: {
        statistics: remediation.getStatistics(),
        recentActions: actions.slice(-20),
      },
    });
  } catch (error) {
    logger.error('[Operational] Remediation list error:', error);
    next(error);
  }
});

/**
 * POST /api/admin/operational/remediation/:id/approve
 * Approve a remediation action (MUTATION - Critical)
 * SECURITY: Requires super_admin role + heavy rate limiting
 */
router.post('/remediation/:id/approve', requireSuperAdmin, operationalMutateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const remediation = getRemediation();
    const actor = (req as any).user?.id || 'unknown';

    const action = await remediation.approveAction(req.params.id, actor);

    // Audit log critical action
    await auditOperationalAction(
      'operational_remediation_approved',
      req.params.id,
      'success',
      { remediationId: req.params.id, approvedBy: actor },
      req
    );

    res.json({
      success: true,
      data: action,
    });
  } catch (error) {
    logger.error('[Operational] Remediation approve error:', error);
    // Audit failed attempt
    await auditOperationalAction(
      'operational_remediation_approve_failed',
      req.params.id,
      'denied',
      { remediationId: req.params.id, error: String(error) },
      req
    );
    next(error);
  }
});

/**
 * POST /api/admin/operational/remediation/:id/execute
 * Execute a remediation action (MUTATION - MOST CRITICAL)
 * SECURITY: Requires super_admin role + extreme rate limiting + audit
 */
router.post('/remediation/:id/execute', requireSuperAdmin, operationalMutateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const remediation = getRemediation();
    const executor = (req as any).user?.id || 'unknown';

    const action = await remediation.executeAction(req.params.id, executor);

    // Audit log CRITICAL execution
    await auditOperationalAction(
      'operational_remediation_executed',
      req.params.id,
      'success',
      { 
        remediationId: req.params.id, 
        executedBy: executor,
        actionType: (action as any)?.type
      },
      req
    );

    res.json({
      success: true,
      data: action,
    });
  } catch (error) {
    logger.error('[Operational] Remediation execute error:', error);
    // Audit failed execution (critical!)
    await auditOperationalAction(
      'operational_remediation_execute_failed',
      req.params.id,
      'denied',
      { remediationId: req.params.id, error: String(error), severity: 'critical' },
      req
    );
    next(error);
  }
});

// ============================================================================
// OPERATIONAL STATE ROUTES (READ - Authentication Required)
// ============================================================================

/**
 * GET /api/admin/operational/state
 * Get complete operational state
 * SECURITY: Requires super_admin role + rate limiting
 */
router.get('/state', requireSuperAdmin, operationalReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const framework = getOperationalFramework();
    const state = await framework.getOperationalState();

    // Audit log
    await auditOperationalAction(
      'operational_state_read',
      'operational_state',
      'success',
      { 
        overallHealth: state.overallHealth,
        criticalAlerts: state.criticalAlerts,
        serviceCount: state.registry.services.size
      },
      req
    );

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
    logger.error('[Operational] State read error:', error);
    next(error);
  }
});

/**
 * GET /api/admin/operational/state/export
 * Export full operational state
 * SECURITY: Requires super_admin role + rate limiting
 */
router.get('/state/export', requireSuperAdmin, operationalReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const framework = getOperationalFramework();
    const exportData = await framework.exportState();

    // Audit log compliance export
    await auditOperationalAction(
      'operational_state_exported',
      'operational_state',
      'success',
      { exportTime: new Date().toISOString() },
      req
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="operational-state.json"');
    res.send(exportData);
  } catch (error) {
    logger.error('[Operational] State export error:', error);
    next(error);
  }
});

// ============================================================================
// INITIALIZATION ROUTES (MUTATIONS - requires setup)
// ============================================================================

/**
 * POST /api/admin/operational/initialize
 * Initialize the operational framework
 * Only callable once; subsequent calls are no-ops
 * SECURITY: Requires super_admin role + rate limiting
 */
router.post('/initialize', requireSuperAdmin, operationalMutateLimiter, async (req: Request, res: Response, next: NextFunction) => {
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

    // Audit log initialization (CRITICAL)
    await auditOperationalAction(
      'operational_framework_initialized',
      'operational_framework',
      'success',
      { 
        discoveryEnabled: config.discovery.enabled,
        auditEnabled: config.audit.enabled,
        vaultEnabled: config.vault.enabled,
        remediationEnabled: config.remediation.enabled,
        severity: 'critical'
      },
      req
    );

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
