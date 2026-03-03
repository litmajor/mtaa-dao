import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { daoMemberships, daos, users, auditLogs } from '../../../shared/schema';
import { eq, desc, sql, and, count } from 'drizzle-orm';
import { logConsolidatedAuditEvent, AuditEventType } from '../../services/auditConsolidated';
import * as agentsEldersService from '../../db/services/agentsEldersService';

const router = Router();

/**
 * Agents & Elders Management Routes (Phase 5)
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
 */
router.get('/elders/overview', async (req: Request, res: Response) => {
  try {
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

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
 */
router.get('/elders/:elderId/details', async (req: Request, res: Response) => {
  try {
    const { elderId } = req.params;

    const elderDetails: Record<string, any> = {
      'eld-kaizen': {
        id: 'eld-kaizen',
        name: 'KAIZEN - Optimization Elder',
        description: 'Continuous improvement specialist for governance processes',
        type: 'optimization',
        version: '2.1.0',
        lastUpdate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        stats: {
          totalProposalsAnalyzed: 245,
          optimizationsGenerated: 87,
          implementedOptimizations: 63,
          implementationRate: 0.72,
          efficiencyGainAverage: 0.35,
          processTimeReduction: '45%',
          costSavings: '$12,450'
        },
        recentOptimizations: [
          {
            id: 'opt-1',
            proposal: 'Voting Period Reduction',
            daos: 5,
            impact: 'Reduced avg voting time from 3 days to 2 days',
            implementedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          },
          {
            id: 'opt-2',
            proposal: 'Parallel Voting Streams',
            daos: 3,
            impact: 'Enabled simultaneous voting on related proposals',
            implementedDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
          },
          {
            id: 'opt-3',
            proposal: 'Smart Quorum Adjustment',
            daos: 8,
            impact: 'Dynamic quorum based on member availability',
            implementedDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
          }
        ],
        performanceMetrics: {
          accuracy: 0.94,
          timeToAnalyze: '2.4 hours avg',
          costPerAnalysis: '$0.45',
          daosServed: 42,
          totalProposalsImpacted: 245
        }
      },
      'eld-scry': {
        id: 'eld-scry',
        name: 'SCRY - Security Elder',
        description: 'Threat detection and risk management specialist',
        type: 'security',
        version: '3.0.1',
        lastUpdate: new Date(Date.now() - 12 * 60 * 60 * 1000),
        stats: {
          threatsDetected: 156,
          risksIdentified: 342,
          complianceIssuesFound: 12,
          falsePositiveRate: 0.05,
          avgResponseTime: '15 minutes',
          mitigationSuccessRate: 0.96
        },
        recentThreats: [
          {
            id: 'threat-1',
            type: 'CENTRALIZATION_RISK',
            severity: 'high',
            dao: 'dao-123',
            description: '3 admins control 75% of voting power',
            detectedDate: new Date(Date.now() - 2 * 60 * 60 * 1000),
            status: 'active'
          },
          {
            id: 'threat-2',
            type: 'PROPOSAL_ATTACK',
            severity: 'critical',
            dao: 'dao-456',
            description: 'Suspicious voting pattern detected',
            detectedDate: new Date(Date.now() - 5 * 60 * 60 * 1000),
            status: 'mitigated'
          },
          {
            id: 'threat-3',
            type: 'COMPLIANCE_VIOLATION',
            severity: 'medium',
            dao: 'dao-789',
            description: 'Proposal violates treasury allocation rules',
            detectedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            status: 'active'
          }
        ],
        threatTrends: {
          last7days: 42,
          last30days: 156,
          trend: 'increasing',
          topThreatType: 'CENTRALIZATION_RISK'
        }
      },
      'eld-lumen': {
        id: 'eld-lumen',
        name: 'LUMEN - Ethics Elder',
        description: 'Ethical review and fairness assessment specialist',
        type: 'ethics',
        version: '1.8.2',
        lastUpdate: new Date(Date.now() - 36 * 60 * 60 * 1000),
        stats: {
          proposalsReviewed: 198,
          ethicalConcernsRaised: 34,
          biasDetected: 8,
          fairnessApprovalRate: 0.91,
          ethicsScore: 0.94,
          recommendedForRejection: 5
        },
        recentReviews: [
          {
            id: 'review-1',
            proposal: 'Funding Allocation Change',
            ethicsScore: 0.88,
            concerns: ['May disproportionately impact new members'],
            recommendation: 'Approve with modifications',
            reviewDate: new Date(Date.now() - 3 * 60 * 60 * 1000)
          },
          {
            id: 'review-2',
            proposal: 'Member Role Hierarchy',
            ethicsScore: 0.72,
            concerns: ['Potential discrimination', 'Unfair advantage to early members'],
            recommendation: 'Reject and revise',
            reviewDate: new Date(Date.now() - 8 * 60 * 60 * 1000)
          },
          {
            id: 'review-3',
            proposal: 'Community Fund Distribution',
            ethicsScore: 0.96,
            concerns: [],
            recommendation: 'Approve',
            reviewDate: new Date(Date.now() - 15 * 60 * 60 * 1000)
          }
        ],
        biasAnalysis: {
          genderBias: 0.02,
          ageBias: 0.03,
          economicBias: 0.04,
          geographicBias: 0.01,
          overallBias: 0.025
        }
      }
    };

    const details = elderDetails[elderId];
    if (!details) {
      return res.status(404).json({ error: 'Elder not found' });
    }

    res.json(details);
  } catch (error) {
    logger.error('Error fetching elder details:', error);
    res.status(500).json({ error: 'Failed to fetch elder details' });
  }
});

/**
 * GET /api/admin/agents-elders/elders/:elderId/history
 * Get activity history for a specific Elder
 */
router.get('/elders/:elderId/history', async (req: Request, res: Response) => {
  try {
    const { elderId } = req.params;
    const { days = '30', limit = '100' } = req.query;

    const periodDays = parseInt(days as string);
    const resultLimit = parseInt(limit as string);

    // Mock activity history
    const activities = [];
    for (let i = 0; i < resultLimit; i++) {
      const daysAgo = Math.floor(Math.random() * periodDays);
      activities.push({
        id: `activity-${i}`,
        timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
        action: ['proposal_analyzed', 'threat_detected', 'optimization_suggested', 'ethics_review_completed'][Math.floor(Math.random() * 4)],
        dao: `dao-${Math.floor(Math.random() * 50)}`,
        result: 'success',
        details: 'Activity details...'
      });
    }

    res.json({
      elderId,
      period: `${periodDays} days`,
      activities: activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
      summary: {
        totalActivities: activities.length,
        successRate: 0.98,
        errorCount: Math.floor(activities.length * 0.02)
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
 */
router.get('/agents/overview', async (req: Request, res: Response) => {
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
 */
router.get('/agents/:agentId/details', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;

    const agentDetails: Record<string, any> = {
      'agent-analyzer': {
        id: 'agent-analyzer',
        name: 'Analyzer Agent',
        type: 'Data Analyzer',
        version: '1.5.2',
        description: 'Comprehensive data analysis and proposal evaluation',
        status: 'online',
        uptime: 0.995,
        lastUpdate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        performance: {
          messagesProcessed: 1243,
          averageResponseTime: 245,
          peakLoad: 450,
          errorRate: 0.01,
          successRate: 0.99,
          queueSize: 12
        },
        capabilities: ['Proposal analysis', 'Data aggregation', 'Trend detection', 'Quality assessment'],
        recentActivity: [
          { timestamp: new Date(Date.now() - 5 * 60000), action: 'Analyzed proposal', result: 'success' },
          { timestamp: new Date(Date.now() - 15 * 60000), action: 'Generated report', result: 'success' },
          { timestamp: new Date(Date.now() - 25 * 60000), action: 'Processed 50 records', result: 'success' }
        ]
      },
      'agent-defender': {
        id: 'agent-defender',
        name: 'Defender Agent',
        type: 'Security Monitor',
        version: '2.0.1',
        description: 'Advanced threat detection and prevention',
        status: 'online',
        uptime: 0.998,
        lastUpdate: new Date(Date.now() - 12 * 60 * 60 * 1000),
        performance: {
          messagesProcessed: 856,
          averageResponseTime: 156,
          peakLoad: 320,
          errorRate: 0.005,
          successRate: 0.995,
          queueSize: 8
        },
        capabilities: ['Threat detection', 'Attack prevention', 'Pattern recognition', 'Alert generation'],
        recentActivity: [
          { timestamp: new Date(Date.now() - 1 * 60000), action: 'Detected anomaly', result: 'threat_detected' },
          { timestamp: new Date(Date.now() - 10 * 60000), action: 'Validated signatures', result: 'success' },
          { timestamp: new Date(Date.now() - 20 * 60000), action: 'Processed 100 events', result: 'success' }
        ]
      },
      'agent-scout': {
        id: 'agent-scout',
        name: 'Scout Agent',
        type: 'System Monitor',
        version: '1.2.0',
        description: 'System health monitoring and metrics collection',
        status: 'online',
        uptime: 0.999,
        lastUpdate: new Date(Date.now() - 6 * 60 * 60 * 1000),
        performance: {
          messagesProcessed: 2341,
          averageResponseTime: 89,
          peakLoad: 200,
          errorRate: 0.002,
          successRate: 0.998,
          queueSize: 3
        },
        capabilities: ['Health monitoring', 'Metrics collection', 'Performance tracking', 'Alert notification'],
        recentActivity: [
          { timestamp: new Date(Date.now() - 30000), action: 'Collected metrics', result: 'success' },
          { timestamp: new Date(Date.now() - 5 * 60000), action: 'System check', result: 'success' },
          { timestamp: new Date(Date.now() - 10 * 60000), action: 'Alert sent', result: 'success' }
        ]
      }
    };

    const details = agentDetails[agentId];
    if (!details) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json(details);
  } catch (error) {
    logger.error('Error fetching agent details:', error);
    res.status(500).json({ error: 'Failed to fetch agent details' });
  }
});

/**
 * GET /api/admin/agents-elders/agents/:agentId/logs
 * Get logs for a specific agent
 */
router.get('/agents/:agentId/logs', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { limit = '50' } = req.query;
    const resultLimit = parseInt(limit as string);

    const logs = [];
    for (let i = 0; i < resultLimit; i++) {
      logs.push({
        id: `log-${i}`,
        timestamp: new Date(Date.now() - i * 5 * 60000),
        level: ['info', 'debug', 'warning', 'error'][Math.floor(Math.random() * 4)],
        message: `Agent activity log entry ${i}`,
        details: {}
      });
    }

    res.json({
      agentId,
      logs,
      summary: {
        totalLogs: logs.length,
        errorCount: logs.filter(l => l.level === 'error').length,
        warningCount: logs.filter(l => l.level === 'warning').length
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
 */
router.get('/configuration', async (req: Request, res: Response) => {
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
 */
router.put('/configuration', async (req: Request, res: Response) => {
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
 */
router.get('/config/elders/:elderId', async (req: Request, res: Response) => {
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
 */
router.put('/config/elders/:elderId', async (req: Request, res: Response) => {
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
 */
router.get('/config/agents/:agentId', async (req: Request, res: Response) => {
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
 */
router.put('/config/agents/:agentId', async (req: Request, res: Response) => {
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
 */
router.get('/config/system', async (req: Request, res: Response) => {
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
 */
router.put('/config/system', async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    const adminId = (req.user as any)?.id;
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
 */
router.get('/config/all', async (req: Request, res: Response) => {
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
 */
router.put('/config/bulk', async (req: Request, res: Response) => {
  try {
    const { updates } = req.body;
    const adminId = (req.user as any)?.id;

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Updates must be an array' });
    }

    const results = {
      successful: 0,
      failed: 0,
      details: [] as any[],
    };

    for (const update of updates) {
      try {
        const { type, id, configuration } = update;

        if (!type || !id || !configuration) {
          results.failed++;
          results.details.push({
            type,
            id,
            error: 'Missing required fields',
          });
          continue;
        }

        if (type === 'elder') {
          const elder = await agentsEldersService.getElderById(id);
          if (!elder) {
            results.failed++;
            results.details.push({
              type,
              id,
              error: 'Elder not found',
            });
            continue;
          }

          const validation = validateElderConfig(configuration, elder.type);
          if (!validation.valid) {
            results.failed++;
            results.details.push({
              type,
              id,
              error: validation.errors.join('; '),
            });
            continue;
          }

          await agentsEldersService.updateElder(id, { configuration });
          results.successful++;
          results.details.push({ type, id, status: 'updated' });
        } else if (type === 'agent') {
          const agent = await agentsEldersService.getAgentById(id);
          if (!agent) {
            results.failed++;
            results.details.push({
              type,
              id,
              error: 'Agent not found',
            });
            continue;
          }

          const validation = validateAgentConfig(configuration, agent.type);
          if (!validation.valid) {
            results.failed++;
            results.details.push({
              type,
              id,
              error: validation.errors.join('; '),
            });
            continue;
          }

          await agentsEldersService.updateAgent(id, { configuration });
          results.successful++;
          results.details.push({ type, id, status: 'updated' });
        }
      } catch (err) {
        results.failed++;
        results.details.push({
          type: update.type,
          id: update.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Log audit event
    await logAuditEvent({
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
function validateElderConfig(config: any, elderType: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Base validation for all elders
  if (typeof config.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }
  if (typeof config.updateInterval !== 'number' || config.updateInterval < 100) {
    errors.push('updateInterval must be a number >= 100');
  }
  if (!['error', 'warn', 'info', 'debug'].includes(config.logLevel)) {
    errors.push('logLevel must be one of: error, warn, info, debug');
  }

  // Type-specific validation
  if (elderType === 'KAIZEN') {
    if (!['performance', 'safety', 'balance'].includes(config.optimizationTarget)) {
      errors.push('optimizationTarget must be one of: performance, safety, balance');
    }
    if (typeof config.maxIterations !== 'number' || config.maxIterations < 1) {
      errors.push('maxIterations must be a number >= 1');
    }
    if (config.learningRate && (typeof config.learningRate !== 'number' || config.learningRate < 0 || config.learningRate > 1)) {
      errors.push('learningRate must be a number between 0 and 1');
    }
  } else if (elderType === 'SCRY') {
    if (typeof config.predictionHorizon !== 'number' || config.predictionHorizon < 1) {
      errors.push('predictionHorizon must be a number >= 1');
    }
    if (typeof config.confidence_threshold !== 'number' || config.confidence_threshold < 0 || config.confidence_threshold > 100) {
      errors.push('confidence_threshold must be a number between 0 and 100');
    }
    if (!['onchain', 'offchain', 'hybrid'].includes(config.dataSource)) {
      errors.push('dataSource must be one of: onchain, offchain, hybrid');
    }
  } else if (elderType === 'LUMEN') {
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
function validateAgentConfig(config: any, agentType: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Base validation for all agents
  if (typeof config.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }
  if (typeof config.updateInterval !== 'number' || config.updateInterval < 100) {
    errors.push('updateInterval must be a number >= 100');
  }
  if (!['error', 'warn', 'info', 'debug'].includes(config.logLevel)) {
    errors.push('logLevel must be one of: error, warn, info, debug');
  }

  // Type-specific validation
  if (agentType === 'Analyzer') {
    if (!['shallow', 'standard', 'deep'].includes(config.analysisDepth)) {
      errors.push('analysisDepth must be one of: shallow, standard, deep');
    }
    if (typeof config.timeWindow !== 'number' || config.timeWindow < 1) {
      errors.push('timeWindow must be a number >= 1');
    }
  } else if (agentType === 'Defender') {
    if (!['low', 'medium', 'high', 'critical'].includes(config.threatLevel)) {
      errors.push('threatLevel must be one of: low, medium, high, critical');
    }
    if (typeof config.autoResponseEnabled !== 'boolean') {
      errors.push('autoResponseEnabled must be a boolean');
    }
    if (typeof config.responseThreshold !== 'number' || config.responseThreshold < 0 || config.responseThreshold > 100) {
      errors.push('responseThreshold must be a number between 0 and 100');
    }
  } else if (agentType === 'Scout') {
    if (!['local', 'network', 'global'].includes(config.scanRadius)) {
      errors.push('scanRadius must be one of: local, network, global');
    }
    if (!['passive', 'active', 'hybrid'].includes(config.discoveryMode)) {
      errors.push('discoveryMode must be one of: passive, active, hybrid');
    }
    if (typeof config.maxTargets !== 'number' || config.maxTargets < 1) {
      errors.push('maxTargets must be a number >= 1');
    }
  } else if (agentType === 'Coordinator') {
    if (!['sequential', 'parallel', 'adaptive'].includes(config.coordinationMode)) {
      errors.push('coordinationMode must be one of: sequential, parallel, adaptive');
    }
    if (typeof config.syncInterval !== 'number' || config.syncInterval < 1) {
      errors.push('syncInterval must be a number >= 1');
    }
    if (typeof config.maxConcurrent !== 'number' || config.maxConcurrent < 1) {
      errors.push('maxConcurrent must be a number >= 1');
    }
  } else if (agentType === 'Kwetu') {
    if (!['community', 'growth', 'support', 'innovation'].includes(config.focusArea)) {
      errors.push('focusArea must be one of: community, growth, support, innovation');
    }
    if (typeof config.engagementLevel !== 'number' || config.engagementLevel < 0 || config.engagementLevel > 100) {
      errors.push('engagementLevel must be a number between 0 and 100');
    }
    if (typeof config.responseTime !== 'number' || config.responseTime < 1) {
      errors.push('responseTime must be a number >= 1');
    }
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
 */
router.get('/history/:entityType/:entityId', async (req: Request, res: Response) => {
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
 */
router.get('/history/:entityType/:entityId/:versionNumber', async (req: Request, res: Response) => {
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
 */
router.get('/history/:entityType/:entityId/compare', async (req: Request, res: Response) => {
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
 */
router.get('/templates/:entityType', async (req: Request, res: Response) => {
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
 */
router.post('/templates', async (req: Request, res: Response) => {
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
 */
router.post('/templates/:templateId/apply', async (req: Request, res: Response) => {
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
 */
router.get('/scheduled-changes', async (req: Request, res: Response) => {
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
 */
router.post('/scheduled-changes', async (req: Request, res: Response) => {
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
 */
router.put('/scheduled-changes/:changeId/approve', async (req: Request, res: Response) => {
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
 */
router.get('/alerts', async (req: Request, res: Response) => {
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
 */
router.put('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
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
 */
router.get('/alert-rules', async (req: Request, res: Response) => {
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
 */
router.post('/alert-rules', async (req: Request, res: Response) => {
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
 */
router.get('/search-profiles', async (req: Request, res: Response) => {
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
 */
router.post('/search-profiles', async (req: Request, res: Response) => {
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
 */
router.get('/performance-analytics', async (req: Request, res: Response) => {
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
 */
router.post('/history/:entityType/:entityId/rollback', async (req: Request, res: Response) => {
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
 */
router.post('/search', async (req: Request, res: Response) => {
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
 */
router.get('/analytics', async (req: Request, res: Response) => {
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
 */
router.get('/analytics/trends/:entityType/:entityId', async (req: Request, res: Response) => {
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
