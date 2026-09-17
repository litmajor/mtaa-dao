/**
 * Admin endpoints for managing Agents and Elders
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { daoMemberships, auditLogs } from '../../../shared/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { logConsolidatedAuditEvent } from '../../services/auditConsolidated';
import { logAuditEvent, AuditEventType } from '../../services/auditLogging';
import * as agentsEldersService from '../../db/services/agentsEldersService';
import { getEventEmitter } from '../../middleware/websocket-event-emitter';
import { authenticateToken } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { rateLimitPerUser } from '../../middleware/rateLimit';

interface BulkUpdateItem {
  id: string;
  type: 'elder' | 'agent';
  configuration: Record<string, unknown>;
}

interface BulkUpdateRequest {
  updates: BulkUpdateItem[];
}

export const bulkUpdateRequestSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().min(1),
      type: z.enum(['elder', 'agent']),
      configuration: z.record(z.any()),
    })
  ),
});

const safeLogAuditEvent = (event: Parameters<typeof logAuditEvent>[0]) => {
  return logAuditEvent(event).catch((err: unknown) => {
    logger.error('Audit log failed:', err);
  });
};


async function ensureAdminAccess(req: Request): Promise<string> {
  const userId = (req.user as any)?.id as string | undefined;
  const roleValues = (req.user as any)?.roles ?? [];
  const roles = Array.isArray(roleValues) ? roleValues : [roleValues];

  if (userId && (roles.includes('super_admin') || roles.includes('admin') || roles.includes('owner'))) {
    await logConsolidatedAuditEvent({
      actorId: userId,
      actionType: AuditEventType.ADMIN_USER_LIST_ACCESSED,
      targetType: 'admin_access',
      targetId: userId,
      actionCategory: 'admin',
      result: 'success',
      severity: 'low',
      metadata: { permissionCheck: 'admin-role' },
    });
    return userId;
  }

  if (!userId) {
    throw new Error('Authentication required for admin configuration access');
  }

  const membership = await db
    .select()
    .from(daoMemberships)
    .where(eq(daoMemberships.userId, userId))
    .limit(1);

  const hasAdminMembership = membership.some((record) => ['admin', 'owner', 'super_admin'].includes(String(record.role || '').toLowerCase()));
  if (!hasAdminMembership) {
    await logConsolidatedAuditEvent({
      actorId: userId,
      actionType: AuditEventType.PERMISSION_DENIED,
      targetType: 'admin_access',
      targetId: userId,
      actionCategory: 'security',
      result: 'failed',
      severity: 'high',
      metadata: { reason: 'missing_admin_role' },
    });
    throw new Error('Administrator access required');
  }

  return userId;
}

const router = Router();

/**
 * ============================================================================
 * MIDDLEWARE DEFINITIONS
 * ============================================================================
 */

// Require admin or super_admin role
const requireAdmin = requireRole('admin', 'super_admin');
const requireSuperAdmin = requireRole('super_admin');

/**
 * Audit logging middleware for admin access
 */
const auditAdminAccess = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as any)?.id || 'unknown';
  const endpoint = req.originalUrl || req.path;
  
  await logConsolidatedAuditEvent({
    actorId: userId,
    actionType: AuditEventType.ADMIN_USER_LIST_ACCESSED,
    actionCategory: 'admin',
    targetType: 'admin_endpoint',
    targetId: endpoint,
    result: 'success',
    severity: 'low',
    metadata: {
      endpoint,
      method: req.method,
      timestamp: new Date().toISOString(),
    },
  }).catch(err => logger.warn('Failed to log admin access:', { error: err }));

  next();
};

/**
 * Rate limiting middleware for admin operations
 * - READ operations: 60 requests per 10 minutes per user
 * - WRITE operations: 20 requests per 10 minutes per user
 * - SENSITIVE operations (system config): 5 requests per hour per user
 */
const adminReadLimiter = rateLimitPerUser('admin-read', 60, '10min');
const adminWriteLimiter = rateLimitPerUser('admin-write', 20, '10min');
const adminSystemLimiter = rateLimitPerUser('admin-system', 5, '1h');

/**
 * ============================================================================
 * AGENTS & ELDERS MANAGEMENT ROUTES (PHASE 5)
 * ============================================================================
 * 
 * SUPER ADMIN:
 * - View all agents and elders across all DAOs
 * - Configure global agent settings
 * - View detailed statistics and analytics
 * 
 * DAO ADMIN:
 * - View agents and elders for their DAO
 * - Configure agent settings for their DAO
 * - View detailed statistics
 */

// ============================================================================
// ELDERS MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/agents-elders/elders/overview
 * Get overview of all three Elders with their stats and roles
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/elders/overview', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const adminId = await ensureAdminAccess(req);

    // Fetch all elders from database
    const elders = await agentsEldersService.getAllElders();

    // Format response
    const formattedElders = elders.map((elder: any) => ({
      ...elder,
      // Ensure proper numeric conversion
      uptime: parseFloat(elder.uptime as any),
      implementationRate: elder.implementationRate ? parseFloat(elder.implementationRate as any) : undefined,
      approvalRate: elder.approvalRate ? parseFloat(elder.approvalRate as any) : undefined,
    }));

    // Log audit event
    await logAuditEvent({
      userId: adminId,
      eventType: AuditEventType.ADMIN_USER_LIST_ACCESSED,
      action: 'view_elders_overview',
      metadata: { resource: 'elders', status: 'success' },
      severity: 'low',
    });

    res.json({
      elders: formattedElders,
      summary: {
        totalElders: formattedElders.length,
        activeElders: formattedElders.filter((e: any) => e.status === 'active').length,
        overallUptime:
          formattedElders.reduce((sum: number, e: any) => sum + (parseFloat(e.uptime as any) || 0), 0) /
          formattedElders.length,
        systemHealth: formattedElders.every((e: any) => e.status === 'active') ? 'excellent' : 'good',
      },
      lastUpdated: new Date(),
    });
  } catch (error) {
    logger.error('Error fetching elders overview:', error);
    res.status(500).json({ error: 'Failed to fetch elders overview' });
  }
});

/**
 * GET /api/admin/agents-elders/elders/:elderId/details
 * Get detailed statistics for a specific Elder
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/elders/:elderId/details', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { elderId } = req.params;

    // Query elder from database instead of hardcoded mock
    const elder = await agentsEldersService.getElderById(elderId);
    if (!elder) {
      return res.status(404).json({ error: 'Elder not found' });
    }

    // Query associated activity/metrics from audit logs
    const recentActivity = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.resourceId, elderId),
          desc(auditLogs.createdAt)
        )
      )
      .limit(10);

    res.json({
      id: elder.id,
      name: elder.name,
      type: elder.type,
      status: elder.status || 'online',
      version: elder.version || '1.0.0',
      lastUpdate: elder.updatedAt,
      configuration: elder.configuration || {},
      stats: elder.stats || {},
      recentActivity: recentActivity.map(log => ({
        id: log.id,
        action: log.action,
        timestamp: log.createdAt,
        result: log.status === 200 ? 'success' : 'failed',
        details: log.details
      })),
      performanceMetrics: elder.performanceMetrics || {}
    });
  } catch (error) {
    logger.error('Error fetching elder details:', error);
    res.status(500).json({ error: 'Failed to fetch elder details' });
  }
});

/**
 * GET /api/admin/agents-elders/elders/:elderId/history
 * Get activity history for a specific Elder
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/elders/:elderId/history', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { elderId } = req.params;
    const { days = '30', limit = '100' } = req.query;

    const periodDays = parseInt(days as string);
    const resultLimit = parseInt(limit as string);
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    // Query audit logs for this elder's activity
    const activities = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.resourceId, elderId),
          desc(auditLogs.createdAt)
        )
      )
      .limit(resultLimit);

    // Calculate statistics
    const successCount = activities.filter(a => a.status >= 200 && a.status < 300).length;
    const errorCount = activities.filter(a => a.status >= 400).length;
    const successRate = activities.length > 0 ? successCount / activities.length : 0;

    res.json({
      elderId,
      period: `${periodDays} days`,
      activities: activities.map(a => ({
        id: a.id,
        timestamp: a.createdAt,
        action: a.action,
        dao: (a.details as any)?.daoId || 'unknown',
        result: a.status >= 200 && a.status < 300 ? 'success' : 'failed',
        details: a.details
      })),
      summary: {
        totalActivities: activities.length,
        successRate: parseFloat((successRate * 100).toFixed(2)),
        errorCount
      }
    });
  } catch (error) {
    logger.error('Error fetching elder history:', error);
    res.status(500).json({ error: 'Failed to fetch elder history' });
  }
});

// ============================================================================
// AGENTS MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/agents-elders/agents/overview
 * Get overview of all agents with their stats
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/agents/overview', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    // Fetch all agents from database
    const agents = await agentsEldersService.getAllAgents();

    // Format response
    const formattedAgents = agents.map((agent: any) => ({
      ...agent,
      uptime: parseFloat(agent.uptime as any),
      errorRate: parseFloat(agent.errorRate as any),
    }));

    // Log audit event
    await logAuditEvent({
      userId: (req.user as any)?.id,
      eventType: AuditEventType.ADMIN_USER_LIST_ACCESSED,
      action: 'view_agents_overview',
      metadata: { resource: 'agents', status: 'success' },
      severity: 'low',
    });

    res.json({
      agents: formattedAgents,
      summary: {
        totalAgents: formattedAgents.length,
        onlineAgents: formattedAgents.filter((a: any) => a.status === 'online').length,
        offlineAgents: formattedAgents.filter((a: any) => a.status === 'offline').length,
        averageUptime:
          formattedAgents.reduce((sum: number, a: any) => sum + (parseFloat(a.uptime as any) || 0), 0) /
          formattedAgents.length,
        totalMessagesProcessed: formattedAgents.reduce((sum: number, a: any) => sum + (a.messagesProcessed || 0), 0),
        averageErrorRate:
          formattedAgents.reduce((sum: number, a: any) => sum + (parseFloat(a.errorRate as any) || 0), 0) /
          formattedAgents.length,
      },
      lastUpdated: new Date(),
    });
  } catch (error) {
    logger.error('Error fetching agents overview:', error);
    res.status(500).json({ error: 'Failed to fetch agents overview' });
  }
});

/**
 * GET /api/admin/agents-elders/agents/:agentId/details
 * Get detailed stats for a specific agent
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/agents/:agentId/details', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;

    // Query agent from database
    const agent = await agentsEldersService.getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Query performance metrics from audit logs
    const recentActivity = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.resourceId, agentId),
          desc(auditLogs.createdAt)
        )
      )
      .limit(10);

    // Calculate metrics from activity
    const successCount = recentActivity.filter(a => a.status >= 200 && a.status < 300).length;
    const errorCount = recentActivity.filter(a => a.status >= 400).length;
    const successRate = recentActivity.length > 0 ? successCount / recentActivity.length : 0;

    res.json({
      id: agent.id,
      name: agent.name,
      type: agent.type,
      status: agent.status || 'online',
      version: agent.version || '1.0.0',
      description: agent.description || '',
      lastUpdate: agent.updatedAt,
      uptime: agent.uptime || 0.99,
      performance: {
        messagesProcessed: (agent.stats as any)?.messagesProcessed || 0,
        averageResponseTime: (agent.stats as any)?.avgResponseTime || 0,
        peakLoad: (agent.stats as any)?.peakLoad || 0,
        errorRate: 1 - successRate,
        successRate,
        queueSize: (agent.stats as any)?.queueSize || 0
      },
      capabilities: agent.capabilities || [],
      recentActivity: recentActivity.map(a => ({
        timestamp: a.createdAt,
        action: a.action,
        result: a.status >= 200 && a.status < 300 ? 'success' : 'failed'
      })),
      configuration: agent.configuration || {}
    });
  } catch (error) {
    logger.error('Error fetching agent details:', error);
    res.status(500).json({ error: 'Failed to fetch agent details' });
  }
});

/**
 * GET /api/admin/agents-elders/agents/:agentId/logs
 * Get logs for a specific agent
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/agents/:agentId/logs', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { limit = '50' } = req.query;
    const resultLimit = parseInt(limit as string);

    // Query real logs from audit table
    const logs = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.resourceId, agentId),
          desc(auditLogs.createdAt)
        )
      )
      .limit(resultLimit);

    const errorCount = logs.filter(l => l.status >= 400).length;
    const warningCount = logs.filter(l => l.status >= 300 && l.status < 400).length;

    res.json({
      agentId,
      logs: logs.map(log => ({
        id: log.id,
        timestamp: log.createdAt,
        level: log.status >= 400 ? 'error' : log.status >= 300 ? 'warning' : 'info',
        message: log.action,
        status: log.status,
        details: log.details
      })),
      summary: {
        totalLogs: logs.length,
        errorCount,
        warningCount
      }
    });
  } catch (error) {
    logger.error('Error fetching agent logs:', error);
    res.status(500).json({ error: 'Failed to fetch agent logs' });
  }
});

// ============================================================================
// CONFIGURATION ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/agents-elders/configuration
 * Get current configuration for all agents and elders
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/configuration', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    // Fetch system configuration from database
    const systemConfig = await agentsEldersService.getSystemConfiguration();

    if (!systemConfig) {
      // If no config exists, ensure one is created
      const newConfig = await agentsEldersService.ensureSystemConfiguration();
      return res.json(newConfig);
    }

    // Log audit event
    await logAuditEvent({
      userId: (req.user as any)?.id,
      eventType: AuditEventType.ADMIN_SETTINGS_CHANGED,
      action: 'view_configuration',
      metadata: { resource: 'configuration', status: 'success' },
      severity: 'low',
    });

    res.json({
      id: systemConfig.id,
      elderSettings: systemConfig.elderSettings,
      agentSettings: systemConfig.agentSettings,
      systemSettings: systemConfig.systemSettings,
      elderFeatureFlags: systemConfig.elderFeatureFlags,
      agentFeatureFlags: systemConfig.agentFeatureFlags,
      version: systemConfig.version,
      lastUpdated: systemConfig.updatedAt,
    });
  } catch (error) {
    logger.error('Error fetching configuration:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

/**
 * PUT /api/admin/agents-elders/configuration
 * Update configuration for agents/elders
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 20 requests per 10 minutes
 */
router.put('/configuration', [
  authenticateToken,
  requireAdmin,
  adminWriteLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { elderSettings, agentSettings, systemSettings } = req.body;
    const adminId = (req.user as any)?.id;

    // Get or create system configuration
    const config = await agentsEldersService.ensureSystemConfiguration();

    // Update configuration in database
    const updated = await agentsEldersService.updateSystemConfiguration(config.id, {
      elderSettings: elderSettings || config.elderSettings,
      agentSettings: agentSettings || config.agentSettings,
      systemSettings: systemSettings || config.systemSettings,
    });

    // Log the configuration change
    await logAuditEvent({
      userId: adminId,
      eventType: AuditEventType.ADMIN_SETTINGS_CHANGED,
      action: 'update_configuration',
      metadata: {
        resource: 'configuration',
        changes: {
          elderSettings: elderSettings ? 'modified' : 'unchanged',
          agentSettings: agentSettings ? 'modified' : 'unchanged',
          systemSettings: systemSettings ? 'modified' : 'unchanged',
        },
        status: 'success',
      },
      severity: 'medium',
    });

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: updated,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Error updating configuration:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// ============================================================================
// CONFIGURATION EDITING ENDPOINTS (Phase 5.2)
// ============================================================================

/**
 * GET /api/admin/agents-elders/config/elders/:elderId
 * Get current configuration for an elder
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/config/elders/:elderId', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { elderId } = req.params;

    const elder = await agentsEldersService.getElderById(elderId);
    if (!elder) {
      return res.status(404).json({ error: 'Elder not found' });
    }

    res.json({
      elderId,
      name: elder.name,
      type: elder.type,
      configuration: elder.configuration || {},
    });
  } catch (error) {
    logger.error('Error fetching elder configuration:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

/**
 * PUT /api/admin/agents-elders/config/elders/:elderId
 * Update configuration for an elder with validation and audit logging
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 20 requests per 10 minutes
 */
router.put('/config/elders/:elderId', [
  authenticateToken,
  requireAdmin,
  adminWriteLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { elderId } = req.params;
    const { configuration } = req.body;
    const adminId = (req.user as any)?.id;

    if (!configuration || typeof configuration !== 'object') {
      return res.status(400).json({ error: 'Invalid configuration format' });
    }

    const elder = await agentsEldersService.getElderById(elderId);
    if (!elder) {
      return res.status(404).json({ error: 'Elder not found' });
    }

    // Validate configuration based on elder type
    const validation = validateElderConfig(configuration, elder.type);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid configuration',
        details: validation.errors,
      });
    }

    // Track changes for audit
    const changes = {
      before: elder.configuration,
      after: configuration,
    };

    // Update elder with new configuration
    const updated = await agentsEldersService.updateElder(elderId, {
      configuration,
    });

    // Log audit event
    await logAuditEvent({
      userId: adminId,
      eventType: AuditEventType.ADMIN_SETTINGS_CHANGED,
      action: 'update_elder_config',
      resourceId: elderId,
      metadata: { resource: 'elders', changes, status: 'success' },
      severity: 'medium',
    });

    // Emit WebSocket event for real-time updates
    try {
      const wsEmitter = getEventEmitter();
      wsEmitter.emitConfigChange('elder', elderId, adminId, {
        versionNumber: 1,
        changedFields: Object.keys(configuration),
        changeReason: 'Elder configuration update',
        configuration
      });
    } catch (wsError) {
      logger.warn('Failed to emit WebSocket event for elder config update:', {
        error: wsError instanceof Error ? wsError.message : String(wsError),
      });
    }

    res.json({
      success: true,
      message: 'Elder configuration updated successfully',
      data: updated,
    });
  } catch (error) {
    logger.error('Error updating elder configuration:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

/**
 * GET /api/admin/agents-elders/config/agents/:agentId
 * Get current configuration for an agent
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/config/agents/:agentId', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;

    const agent = await agentsEldersService.getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({
      agentId,
      name: agent.name,
      type: agent.type,
      configuration: agent.configuration || {},
    });
  } catch (error) {
    logger.error('Error fetching agent configuration:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

/**
 * PUT /api/admin/agents-elders/config/agents/:agentId
 * Update configuration for an agent with validation and audit logging
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 20 requests per 10 minutes
 */
router.put('/config/agents/:agentId', [
  authenticateToken,
  requireAdmin,
  adminWriteLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { configuration } = req.body;
    const adminId = (req.user as any)?.id;

    if (!configuration || typeof configuration !== 'object') {
      return res.status(400).json({ error: 'Invalid configuration format' });
    }

    const agent = await agentsEldersService.getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Validate configuration based on agent type
    const validation = validateAgentConfig(configuration, agent.type);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid configuration',
        details: validation.errors,
      });
    }

    // Track changes for audit
    const changes = {
      before: agent.configuration,
      after: configuration,
    };

    // Update agent with new configuration
    const updated = await agentsEldersService.updateAgent(agentId, {
      configuration,
    });

    // Log audit event
    await logAuditEvent({
      userId: adminId,
      eventType: AuditEventType.ADMIN_SETTINGS_CHANGED,
      action: 'update_agent_config',
      resourceId: agentId,
      metadata: { resource: 'agents', changes, status: 'success' },
      severity: 'medium',
    });

    // Emit WebSocket event for real-time updates
    try {
      const wsEmitter = getEventEmitter();
      wsEmitter.emitConfigChange('agent', agentId, adminId, {
        versionNumber: 1,
        changedFields: Object.keys(configuration),
        changeReason: 'Agent configuration update',
        configuration
      });
    } catch (wsError) {
      logger.warn('Failed to emit WebSocket event for agent config update:', {
        error: wsError instanceof Error ? wsError.message : String(wsError),
      });
    }

    res.json({
      success: true,
      message: 'Agent configuration updated successfully',
      data: updated,
    });
  } catch (error) {
    logger.error('Error updating agent configuration:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

/**
 * GET /api/admin/agents-elders/config/system
 * Get current system configuration
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/config/system', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const config = await agentsEldersService.getSystemConfiguration();
    if (!config) {
      return res.status(404).json({ error: 'System configuration not found' });
    }

    res.json({ configuration: config });
  } catch (error) {
    logger.error('Error fetching system configuration:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

/**
 * PUT /api/admin/agents-elders/config/system
 * Update system configuration (super admin only)
 * REQUIRES: super_admin role
 * RATE LIMITED: 5 requests per hour (CRITICAL SYSTEM OPERATION)
 */
router.put('/config/system', [
  authenticateToken,
  requireSuperAdmin,
  adminSystemLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    const adminId = await ensureAdminAccess(req);
    const userRole = (req.user as any)?.roles;

    // Check super admin permission
    if (!userRole?.includes('super_admin')) {
      return res.status(403).json({ error: 'Only super administrators can modify system configuration' });
    }

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings format' });
    }

    // Validate system configuration
    const validation = validateSystemConfig(settings);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid configuration',
        details: validation.errors,
      });
    }

    // Get old config for comparison
    const oldConfig = await agentsEldersService.getSystemConfiguration();

    // Update system configuration
    const config = await agentsEldersService.getSystemConfiguration() || { id: '', configuration: {} };
    const updated = await agentsEldersService.updateSystemConfiguration(config.id, settings);

    // Log audit event
    await logAuditEvent({
      userId: adminId,
      eventType: AuditEventType.ADMIN_SETTINGS_CHANGED,
      action: 'update_system_config',
      metadata: {
        resource: 'system',
        changes: {
          before: oldConfig,
          after: updated,
        },
        status: 'success',
      },
      severity: 'high',
    });

    // Emit WebSocket event for real-time updates (critical system change)
    try {
      const wsEmitter = getEventEmitter();
      wsEmitter.emitSystemEvent(
        'system_config_updated',
        'System configuration updated by administrator',
        adminId,
        {
          changedFields: Object.keys(settings),
          changeReason: 'System configuration update',
          severity: 'high',
          settings
        }
      );
    } catch (wsError) {
      logger.warn('Failed to emit WebSocket event for system config update:', {
        error: wsError instanceof Error ? wsError.message : String(wsError),
      });
    }

    res.json({
      success: true,
      message: 'System configuration updated successfully',
      configuration: updated,
    });
  } catch (error) {
    logger.error('Error updating system configuration:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

/**
 * GET /api/admin/agents-elders/config/all
 * Get all configurations (elders, agents, system)
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/config/all', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const [elders, agents, systemConfig] = await Promise.all([
      agentsEldersService.getAllElders(),
      agentsEldersService.getAllAgents(),
      agentsEldersService.getSystemConfiguration(),
    ]);

    res.json({
      elders: elders.map((e: any) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        configuration: e.configuration || {},
      })),
      agents: agents.map((a: any) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        configuration: a.configuration || {},
      })),
      system: systemConfig?.settings || {},
    });
  } catch (error) {
    logger.error('Error fetching all configurations:', error);
    res.status(500).json({ error: 'Failed to fetch configurations' });
  }
});

/**
 * PUT /api/admin/agents-elders/config/bulk
 * Update multiple configurations in a single request
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 20 requests per 10 minutes
 */
router.put('/config/bulk', [
  authenticateToken,
  requireAdmin,
  adminWriteLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const parsedBody = bulkUpdateRequestSchema.safeParse(req.body) as {
      success: boolean;
      data?: BulkUpdateRequest;
      error?: { flatten: () => Record<string, unknown> };
    };

    if (!parsedBody.success) {
      return res.status(400).json({
        error: 'Invalid bulk update payload',
        details: parsedBody.error?.flatten?.() ?? parsedBody.error,
      });
    }

    const { updates } = parsedBody.data as BulkUpdateRequest;
    const adminId = (req.user as any)?.id;

    const results = {
      successful: 0,
      failed: 0,
      details: [] as any[],
    };

    const updateResults = await Promise.allSettled(
      updates.map(async (update: BulkUpdateItem) => {
        const { type, id, configuration } = update;

        if (!type || !id || !configuration) {
          throw new Error('Missing required fields');
        }

        if (type === 'elder') {
          const elder = await agentsEldersService.getElderById(id);
          if (!elder) {
            throw new Error('Elder not found');
          }

          const validation = validateElderConfig(configuration, elder.type);
          if (!validation.valid) {
            throw new Error(validation.errors.join('; '));
          }

          await agentsEldersService.updateElder(id, { configuration });
          return { type, id, status: 'updated' };
        }

        if (type === 'agent') {
          const agent = await agentsEldersService.getAgentById(id);
          if (!agent) {
            throw new Error('Agent not found');
          }

          const validation = validateAgentConfig(configuration, agent.type);
          if (!validation.valid) {
            throw new Error(validation.errors.join('; '));
          }

          await agentsEldersService.updateAgent(id, { configuration });
          return { type, id, status: 'updated' };
        }

        throw new Error('Unsupported update type');
      })
    );

    for (const [index, result] of updateResults.entries()) {
      const update = updates[index];
      if (result.status === 'fulfilled') {
        results.successful++;
        results.details.push(result.value);
      } else {
        results.failed++;
        results.details.push({
          type: update?.type,
          id: update?.id,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        });
      }
    }

    void safeLogAuditEvent({
      userId: adminId,
      eventType: AuditEventType.ADMIN_SETTINGS_CHANGED,
      action: 'bulk_update_config',
      metadata: {
        resource: 'configuration',
        changes: {
          totalUpdates: updates.length,
          successful: results.successful,
          failed: results.failed,
        },
        status: 'success',
      },
      severity: 'high',
    });

    res.json({
      success: results.failed === 0,
      message: `Bulk update completed: ${results.successful} successful, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    logger.error('Error performing bulk update:', error);
    res.status(500).json({ error: 'Failed to perform bulk update' });
  }
});

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate elder configuration based on elder type
 */
export function validateElderConfig(config: any, elderType: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const normalizedElderType = elderType.trim().toUpperCase();

  const requireInteger = (fieldName: string, value: unknown, minimum = 0) => {
    if (value !== undefined && (!Number.isInteger(value) || Number(value) < minimum)) {
      errors.push(`${fieldName} must be an integer greater than or equal to ${minimum}`);
    }
  };

  // Base validation for all elders
  if (typeof config.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }
  if (config.updateInterval !== undefined && (!Number.isInteger(config.updateInterval) || config.updateInterval < 100)) {
    errors.push('updateInterval must be an integer greater than or equal to 100');
  }
  if (!['error', 'warn', 'info', 'debug'].includes(config.logLevel)) {
    errors.push('logLevel must be one of: error, warn, info, debug');
  }

  // Type-specific validation
  if (normalizedElderType === 'KAIZEN') {
    if (!['performance', 'safety', 'balance'].includes(config.optimizationTarget)) {
      errors.push('optimizationTarget must be one of: performance, safety, balance');
    }
    requireInteger('maxIterations', config.maxIterations, 1);
    if (config.learningRate && (typeof config.learningRate !== 'number' || config.learningRate < 0 || config.learningRate > 1)) {
      errors.push('learningRate must be a number between 0 and 1');
    }
  } else if (normalizedElderType === 'SCRY') {
    requireInteger('predictionHorizon', config.predictionHorizon, 1);
    if (typeof config.confidence_threshold !== 'number' || config.confidence_threshold < 0 || config.confidence_threshold > 100) {
      errors.push('confidence_threshold must be a number between 0 and 100');
    }
    if (!['onchain', 'offchain', 'hybrid'].includes(config.dataSource)) {
      errors.push('dataSource must be one of: onchain, offchain, hybrid');
    }
  } else if (normalizedElderType === 'LUMEN') {
    if (!['local', 'network', 'full'].includes(config.monitoringScope)) {
      errors.push('monitoringScope must be one of: local, network, full');
    }
    if (typeof config.alertSensitivity !== 'number' || config.alertSensitivity < 0 || config.alertSensitivity > 100) {
      errors.push('alertSensitivity must be a number between 0 and 100');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate agent configuration based on agent type
 */
export function validateAgentConfig(config: any, agentType: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const requireInteger = (fieldName: string, value: unknown, minimum = 0) => {
    if (value !== undefined && (!Number.isInteger(value) || Number(value) < minimum)) {
      errors.push(`${fieldName} must be an integer greater than or equal to ${minimum}`);
    }
  };

  const normalizedAgentType = agentType.trim().toLowerCase();

  // Base validation for all agents
  if (typeof config.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }
  if (config.updateInterval !== undefined && (!Number.isInteger(config.updateInterval) || config.updateInterval < 100)) {
    errors.push('updateInterval must be an integer greater than or equal to 100');
  }
  if (!['error', 'warn', 'info', 'debug'].includes(config.logLevel)) {
    errors.push('logLevel must be one of: error, warn, info, debug');
  }

  // Type-specific validation
  if (normalizedAgentType === 'analyzer') {
    if (!['shallow', 'standard', 'deep'].includes(config.analysisDepth)) {
      errors.push('analysisDepth must be one of: shallow, standard, deep');
    }
    requireInteger('timeWindow', config.timeWindow, 1);
  } else if (normalizedAgentType === 'defender') {
    if (!['low', 'medium', 'high', 'critical'].includes(config.threatLevel)) {
      errors.push('threatLevel must be one of: low, medium, high, critical');
    }
    if (typeof config.autoResponseEnabled !== 'boolean') {
      errors.push('autoResponseEnabled must be a boolean');
    }
    if (typeof config.responseThreshold !== 'number' || config.responseThreshold < 0 || config.responseThreshold > 100) {
      errors.push('responseThreshold must be a number between 0 and 100');
    }
  } else if (normalizedAgentType === 'scout') {
    if (config.updateFrequency !== undefined &&
        (typeof config.updateFrequency !== 'string' || !/^\d+[mhd]$/.test(config.updateFrequency))) {
      errors.push('Update frequency must be in format: 5m, 1h, 1d');
    }
    if (!['local', 'network', 'global'].includes(config.scanRadius)) {
      errors.push('scanRadius must be one of: local, network, global');
    }
    if (!['passive', 'active', 'hybrid'].includes(config.discoveryMode)) {
      errors.push('discoveryMode must be one of: passive, active, hybrid');
    }
    requireInteger('maxTargets', config.maxTargets, 1);
  } else if (normalizedAgentType === 'coordinator') {
    if (!['sequential', 'parallel', 'adaptive'].includes(config.coordinationMode)) {
      errors.push('coordinationMode must be one of: sequential, parallel, adaptive');
    }
    requireInteger('syncInterval', config.syncInterval, 1);
    requireInteger('maxConcurrent', config.maxConcurrent, 1);
  } else if (normalizedAgentType === 'kwetu') {
    if (!['community', 'growth', 'support', 'innovation'].includes(config.focusArea)) {
      errors.push('focusArea must be one of: community, growth, support, innovation');
    }
    if (typeof config.engagementLevel !== 'number' || config.engagementLevel < 0 || config.engagementLevel > 100) {
      errors.push('engagementLevel must be a number between 0 and 100');
    }
    requireInteger('responseTime', config.responseTime, 1);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate system configuration
 */
function validateSystemConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate required fields
  if (!config.systemName || typeof config.systemName !== 'string') {
    errors.push('systemName is required and must be a string');
  }
  if (!['development', 'staging', 'production'].includes(config.environment)) {
    errors.push('environment must be one of: development, staging, production');
  }

  // Validate elder defaults
  if (config.elderDefaults) {
    if (typeof config.elderDefaults.updateInterval !== 'number' || config.elderDefaults.updateInterval < 100) {
      errors.push('elderDefaults.updateInterval must be a number >= 100');
    }
    if (!['error', 'warn', 'info', 'debug'].includes(config.elderDefaults.logLevel)) {
      errors.push('elderDefaults.logLevel must be one of: error, warn, info, debug');
    }
    if (typeof config.elderDefaults.heartbeatTimeout !== 'number' || config.elderDefaults.heartbeatTimeout < 1) {
      errors.push('elderDefaults.heartbeatTimeout must be a number >= 1');
    }
  }

  // Validate agent defaults
  if (config.agentDefaults) {
    if (typeof config.agentDefaults.updateInterval !== 'number' || config.agentDefaults.updateInterval < 100) {
      errors.push('agentDefaults.updateInterval must be a number >= 100');
    }
    if (!['error', 'warn', 'info', 'debug'].includes(config.agentDefaults.logLevel)) {
      errors.push('agentDefaults.logLevel must be one of: error, warn, info, debug');
    }
    if (typeof config.agentDefaults.heartbeatTimeout !== 'number' || config.agentDefaults.heartbeatTimeout < 1) {
      errors.push('agentDefaults.heartbeatTimeout must be a number >= 1');
    }
    if (typeof config.agentDefaults.maxRetries !== 'number' || config.agentDefaults.maxRetries < 0) {
      errors.push('agentDefaults.maxRetries must be a number >= 0');
    }
  }

  // Validate performance settings
  if (config.performance) {
    if (typeof config.performance.enableMetrics !== 'boolean') {
      errors.push('performance.enableMetrics must be a boolean');
    }
    if (typeof config.performance.metricsRetention !== 'number' || config.performance.metricsRetention < 1) {
      errors.push('performance.metricsRetention must be a number >= 1');
    }
    if (typeof config.performance.alertThreshold !== 'number' || config.performance.alertThreshold < 0 || config.performance.alertThreshold > 100) {
      errors.push('performance.alertThreshold must be a number between 0 and 100');
    }
  }

  // Validate security settings
  if (config.security) {
    if (typeof config.security.enableAuditLogging !== 'boolean') {
      errors.push('security.enableAuditLogging must be a boolean');
    }
    if (typeof config.security.auditRetention !== 'number' || config.security.auditRetention < 1) {
      errors.push('security.auditRetention must be a number >= 1');
    }
    if (typeof config.security.requireMFA !== 'boolean') {
      errors.push('security.requireMFA must be a boolean');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// PHASE 5.3: ADVANCED FEATURES ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/agents-elders/history/:entityType/:entityId
 * Get configuration history for an entity
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/history/:entityType/:entityId', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Import service
    const advancedService = await import('../../db/services/agentsEldersAdvancedService');

    const { entries, total } = await advancedService.getConfigurationHistory(
      entityType,
      entityId,
      limit,
      offset
    );

    res.json({
      success: true,
      data: {
        entries,
        pagination: {
          total,
          limit,
          offset,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching configuration history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configuration history',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/agents-elders/history/:entityType/:entityId/:versionNumber
 * Get a specific version of configuration
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/history/:entityType/:entityId/:versionNumber', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { entityType, entityId, versionNumber } = req.params;
    const advancedService = await import('../../db/services/agentsEldersAdvancedService');

    const entry = await advancedService.getConfigurationVersion(
      entityType,
      entityId,
      parseInt(versionNumber)
    );

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Configuration version not found'
      });
    }

    res.json({ success: true, data: entry });
  } catch (error) {
    logger.error('Error fetching configuration version:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configuration version',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/agents-elders/history/:entityType/:entityId/compare
 * Compare two versions of configuration
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/history/:entityType/:entityId/compare', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const versionA = parseInt(req.query.versionA as string);
    const versionB = parseInt(req.query.versionB as string);

    if (!versionA || !versionB) {
      return res.status(400).json({
        success: false,
        message: 'versionA and versionB query parameters are required'
      });
    }

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');
    const comparison = await advancedService.compareConfigurationVersions(
      entityType,
      entityId,
      versionA,
      versionB
    );

    res.json({ success: true, data: comparison });
  } catch (error) {
    logger.error('Error comparing configuration versions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to compare configuration versions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/agents-elders/templates/:entityType
 * Get configuration templates for an entity type
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/templates/:entityType', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { entityType } = req.params;
    const includePrivate = req.query.private === 'true';
    const specificType = req.query.specificType as string;

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');
    const templates = await advancedService.getTemplatesByEntityType(
      entityType,
      includePrivate,
      specificType
    );

    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/agents-elders/templates
 * Create a new configuration template
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 20 requests per 10 minutes
 */
router.post('/templates', [
  authenticateToken,
  requireAdmin,
  adminWriteLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { name, configuration, entityType, description, specificType, category, isPublic, tags } = req.body;
    const userId = (req.user as any)?.id;

    if (!name || !configuration || !entityType) {
      return res.status(400).json({
        success: false,
        message: 'name, configuration, and entityType are required'
      });
    }

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');
    const template = await advancedService.createConfigTemplate(
      name,
      configuration,
      entityType,
      userId,
      { description, specificType, category, isPublic, tags }
    );

    // Log audit event
    await logAuditEvent({
      userId,
      eventType: AuditEventType.ADMIN_SETTINGS_CHANGED,
      action: 'CONFIG_TEMPLATE_CREATED',
      resourceId: template.id,
      metadata: { resource: 'TEMPLATE', template },
      severity: 'medium',
    });

    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create template',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/agents-elders/templates/:templateId/apply
 * Apply a template to an entity
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 20 requests per 10 minutes
 */
router.post('/templates/:templateId/apply', [
  authenticateToken,
  requireAdmin,
  adminWriteLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const { entityId, changeReason } = req.body;
    const userId = (req.user as any)?.id;

    if (!entityId) {
      return res.status(400).json({
        success: false,
        message: 'entityId is required'
      });
    }

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');

    // Increment template usage
    await advancedService.incrementTemplateUsage(templateId);

    // Log audit event
    await logAuditEvent({
      userId,
      eventType: AuditEventType.ADMIN_SETTINGS_CHANGED,
      action: 'CONFIG_TEMPLATE_APPLIED',
      resourceId: templateId,
      metadata: { resource: 'TEMPLATE', entityId, changeReason },
      severity: 'medium',
    });

    res.json({ success: true, message: 'Template applied successfully' });
  } catch (error) {
    logger.error('Error applying template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply template',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/agents-elders/scheduled-changes
 * Get scheduled configuration changes
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/scheduled-changes', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const entityType = req.query.entityType as string;

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');
    const changes = await advancedService.getPendingScheduledChanges(100);

    const filtered = status
      ? changes.filter(c => c.status === status)
      : changes;

    res.json({ success: true, data: filtered });
  } catch (error) {
    logger.error('Error fetching scheduled changes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheduled changes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/agents-elders/scheduled-changes
 * Schedule a configuration change
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 20 requests per 10 minutes
 */
router.post('/scheduled-changes', [
  authenticateToken,
  requireAdmin,
  adminWriteLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { entityType, entityId, configuration, scheduledFor, changeReason, schedule } = req.body;
    const userId = (req.user as any)?.id;

    if (!entityType || !entityId || !configuration || !scheduledFor) {
      return res.status(400).json({
        success: false,
        message: 'entityType, entityId, configuration, and scheduledFor are required'
      });
    }

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');
    const change = await advancedService.scheduleConfigChange(
      entityType,
      entityId,
      configuration,
      new Date(scheduledFor),
      userId,
      changeReason,
      schedule
    );

    // Log audit event
    await logAuditEvent({
      userId,
      eventType: AuditEventType.ADMIN_SETTINGS_CHANGED,
      action: 'CONFIG_CHANGE_SCHEDULED',
      resourceId: change.id,
      metadata: { resource: 'SCHEDULED_CHANGE', change },
      severity: 'medium',
    });

    res.json({ success: true, data: change });
  } catch (error) {
    logger.error('Error scheduling change:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule change',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/admin/agents-elders/scheduled-changes/:changeId/approve
 * Approve a scheduled change
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 20 requests per 10 minutes
 */
router.put('/scheduled-changes/:changeId/approve', [
  authenticateToken,
  requireAdmin,
  adminWriteLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { changeId } = req.params;
    const userId = (req.user as any)?.id;

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');
    const change = await advancedService.approveScheduledChange(changeId, userId);

    if (!change) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled change not found or already approved'
      });
    }

    // Log audit event
    await logAuditEvent({
      userId,
      eventType: AuditEventType.ADMIN_SETTINGS_CHANGED,
      action: 'CONFIG_CHANGE_APPROVED',
      resourceId: change.id,
      metadata: { resource: 'SCHEDULED_CHANGE', change },
      severity: 'high',
    });

    res.json({ success: true, data: change });
  } catch (error) {
    logger.error('Error approving scheduled change:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve scheduled change',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/agents-elders/alerts
 * Get configuration alerts
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/alerts', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const resolved = req.query.resolved as string;
    const severity = req.query.severity as string;
    const entityType = req.query.entityType as string;

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');
    const alerts = await advancedService.getUnresolvedAlerts(entityType);

    const filtered = alerts.filter(a => {
      if (resolved !== undefined && a.isResolved.toString() !== resolved) return false;
      if (severity && a.severity !== severity) return false;
      return true;
    });

    res.json({ success: true, data: filtered });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alerts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/admin/agents-elders/alerts/:alertId/resolve
 * Resolve an alert
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 20 requests per 10 minutes
 */
router.put('/alerts/:alertId/resolve', [
  authenticateToken,
  requireAdmin,
  adminWriteLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const userId = (req.user as any)?.id;

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');
    const alert = await advancedService.resolveAlert(alertId, userId);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Log audit event
    await logAuditEvent({
      userId,
      eventType: AuditEventType.ADMIN_SETTINGS_CHANGED,
      action: 'ALERT_RESOLVED',
      resourceId: alert.id,
      metadata: { resource: 'ALERT', alert },
      severity: 'medium',
    });

    res.json({ success: true, data: alert });
  } catch (error) {
    logger.error('Error resolving alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve alert',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/agents-elders/alert-rules
 * Get alert rules
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/alert-rules', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const enabled = req.query.enabled as string;
    const entityType = req.query.entityType as string;

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');
    const rules = await advancedService.getEnabledAlertRules(entityType);

    const filtered = enabled !== undefined
      ? rules.filter(r => r.isEnabled.toString() === enabled)
      : rules;

    res.json({ success: true, data: filtered });
  } catch (error) {
    logger.error('Error fetching alert rules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alert rules',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/agents-elders/alert-rules
 * Create an alert rule
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 20 requests per 10 minutes
 */
router.post('/alert-rules', [
  authenticateToken,
  requireAdmin,
  adminWriteLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { name, alertType, condition, description, entityType, entityId, threshold, severity, notificationChannels } = req.body;
    const userId = (req.user as any)?.id;

    if (!name || !alertType || !condition) {
      return res.status(400).json({
        success: false,
        message: 'name, alertType, and condition are required'
      });
    }

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');
    const rule = await advancedService.createAlertRule(
      name,
      alertType,
      condition,
      userId,
      { description, entityType, entityId, threshold, severity, notificationChannels }
    );

    // Log audit event
    await logAuditEvent({
      userId,
      eventType: AuditEventType.ADMIN_SETTINGS_CHANGED,
      action: 'ALERT_RULE_CREATED',
      resourceId: rule.id,
      metadata: { resource: 'ALERT_RULE', rule },
      severity: 'medium',
    });

    res.json({ success: true, data: rule });
  } catch (error) {
    logger.error('Error creating alert rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create alert rule',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/agents-elders/search-profiles
 * Get search profiles
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/search-profiles', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');
    const profiles = await advancedService.getSearchProfilesForUser(userId);

    res.json({ success: true, data: profiles });
  } catch (error) {
    logger.error('Error fetching search profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch search profiles',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/agents-elders/search-profiles
 * Create a search profile
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 20 requests per 10 minutes
 */
router.post('/search-profiles', [
  authenticateToken,
  requireAdmin,
  adminWriteLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { name, query, description, filters, isPublic } = req.body;
    const userId = (req.user as any)?.id;

    if (!name || !query) {
      return res.status(400).json({
        success: false,
        message: 'name and query are required'
      });
    }

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');
    const profile = await advancedService.createSearchProfile(
      name,
      query,
      userId,
      { description, filters, isPublic }
    );

    // Log audit event
    await logAuditEvent({
      userId,
      eventType: AuditEventType.ADMIN_SETTINGS_CHANGED,
      action: 'SEARCH_PROFILE_CREATED',
      resourceId: profile.id,
      metadata: { resource: 'SEARCH_PROFILE', profile },
      severity: 'low',
    });

    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error('Error creating search profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create search profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/agents-elders/performance-analytics
 * Get performance analytics data
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/performance-analytics', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const entityType = req.query.entityType as string;
    const entityId = req.query.entityId as string;
    const days = parseInt(req.query.days as string) || 7;

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');

    if (entityType && entityId) {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const snapshots = await advancedService.getPerformanceSnapshots(
        entityType,
        entityId,
        startDate,
        endDate
      );

      res.json({ success: true, data: { snapshots, entityType, entityId, days } });
    } else {
      res.status(400).json({
        success: false,
        message: 'entityType and entityId are required'
      });
    }
  } catch (error) {
    logger.error('Error fetching performance analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance analytics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/agents-elders/history/:entityType/:entityId/rollback
 * Rollback configuration to a specific version
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 20 requests per 10 minutes
 */
router.post('/history/:entityType/:entityId/rollback', [
  authenticateToken,
  requireAdmin,
  adminWriteLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const { targetVersion, rollbackReason } = req.body;
    const userId = (req.user as any)?.id;

    if (!targetVersion || typeof targetVersion !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'targetVersion is required and must be a number'
      });
    }

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');

    // Get the target version configuration
    const targetConfig = await advancedService.getConfigurationVersion(
      entityType,
      entityId,
      targetVersion
    );

    if (!targetConfig) {
      return res.status(404).json({
        success: false,
        message: `Configuration version ${targetVersion} not found`
      });
    }

    // Get current configuration for comparison
    const { entries } = await advancedService.getConfigurationHistory(
      entityType,
      entityId,
      1,
      0
    );

    const currentConfig = entries.length > 0 ? entries[0] : null;

    // Apply the rollback by recording it as a new configuration change
    const rollbackEntry = await advancedService.recordConfigurationChange(
      entityType,
      entityId,
      targetConfig.configuration,
      currentConfig?.configuration || null,
      userId,
      rollbackReason || `Rollback to version ${targetVersion}`
    );

    // Log audit event
    await logAuditEvent({
      userId,
      eventType: AuditEventType.ADMIN_SETTINGS_CHANGED,
      action: 'CONFIG_ROLLBACK',
      resourceId: `${entityType}:${entityId}`,
      metadata: {
        resource: 'CONFIGURATION',
        fromVersion: currentConfig?.versionNumber,
        toVersion: targetVersion,
        rollbackReason
      },
      severity: 'high',
    });

    res.json({
      success: true,
      message: `Successfully rolled back to version ${targetVersion}`,
      data: {
        rollbackEntry,
        fromVersion: currentConfig?.versionNumber,
        toVersion: targetVersion
      }
    });
  } catch (error) {
    logger.error('Error performing rollback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform rollback',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/agents-elders/search
 * Advanced search in configuration history
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.post('/search', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { query, filters, limit, offset } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');
    const { results, total } = await advancedService.searchConfigurationHistory(
      query,
      filters || {},
      limit || 50,
      offset || 0
    );

    res.json({
      success: true,
      data: {
        results,
        pagination: {
          total,
          limit: limit || 50,
          offset: offset || 0,
          pages: Math.ceil(total / (limit || 50))
        }
      }
    });
  } catch (error) {
    logger.error('Error searching configuration history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search configuration history',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/agents-elders/analytics
 * Get configuration change analytics
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/analytics', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const entityType = req.query.entityType as string;

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');
    const metrics = await advancedService.getConfigurationAnalytics(entityType);

    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/agents-elders/analytics/trends/:entityType/:entityId
 * Get performance trend data
 * REQUIRES: admin or super_admin role
 * RATE LIMITED: 60 requests per 10 minutes
 */
router.get('/analytics/trends/:entityType/:entityId', [
  authenticateToken,
  requireAdmin,
  adminReadLimiter,
  auditAdminAccess,
], async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    const advancedService = await import('../../db/services/agentsEldersAdvancedService');
    const trends = await advancedService.getPerformanceTrends(entityType, entityId, days);

    res.json({ success: true, data: { trends, entityType, entityId, days } });
  } catch (error) {
    logger.error('Error fetching trend data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trend data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
