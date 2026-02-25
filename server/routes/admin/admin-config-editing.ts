/**
 * Configuration Editing Routes - Phase 5.2
 * Handles CRUD operations for Elder, Agent, and System configurations
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import {
  getElderById,
  updateElder,
  getAgentById,
  updateAgent,
  getSystemConfiguration,
  updateSystemConfiguration,
  ensureSystemConfiguration,
  createElderActivity,
  createAgentLog,
} from '../../db/services/agentsEldersService';
import { logAuditEvent } from '../../services/auditLogging';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================================================
// CONFIGURATION VALIDATION SCHEMAS
// ============================================================================

/**
 * Validate elder configuration
 */
function validateElderConfig(config: any, elderType: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof config !== 'object' || config === null) {
    errors.push('Configuration must be a JSON object');
    return { valid: false, errors };
  }

  // Common validations
  if (config.threshold !== undefined) {
    if (typeof config.threshold !== 'number' || config.threshold < 0 || config.threshold > 1) {
      errors.push('Threshold must be a number between 0 and 1');
    }
  }

  if (config.reviewPeriod !== undefined) {
    if (typeof config.reviewPeriod !== 'number' || config.reviewPeriod < 1 || config.reviewPeriod > 90) {
      errors.push('Review period must be a number between 1 and 90 days');
    }
  }

  if (config.maxRecommendations !== undefined) {
    if (typeof config.maxRecommendations !== 'number' || config.maxRecommendations < 1) {
      errors.push('Max recommendations must be a positive number');
    }
  }

  // Elder-specific validations
  switch (elderType) {
    case 'KAIZEN':
      if (config.efficiencyThreshold !== undefined) {
        if (typeof config.efficiencyThreshold !== 'number' || config.efficiencyThreshold < 0) {
          errors.push('Efficiency threshold must be a non-negative number');
        }
      }
      break;

    case 'SCRY':
      if (config.alertThreshold !== undefined) {
        if (typeof config.alertThreshold !== 'number' || config.alertThreshold < 0 || config.alertThreshold > 1) {
          errors.push('Alert threshold must be between 0 and 1');
        }
      }
      if (config.scanFrequency !== undefined) {
        const validFrequencies = ['hourly', 'daily', 'weekly'];
        if (!validFrequencies.includes(config.scanFrequency)) {
          errors.push(`Scan frequency must be one of: ${validFrequencies.join(', ')}`);
        }
      }
      break;

    case 'LUMEN':
      if (config.ethicsScore !== undefined) {
        if (typeof config.ethicsScore !== 'number' || config.ethicsScore < 0 || config.ethicsScore > 1) {
          errors.push('Ethics score must be between 0 and 1');
        }
      }
      if (config.recommendationWeight !== undefined) {
        if (typeof config.recommendationWeight !== 'number' || config.recommendationWeight < 0 || config.recommendationWeight > 1) {
          errors.push('Recommendation weight must be between 0 and 1');
        }
      }
      break;
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate agent configuration
 */
function validateAgentConfig(config: any, agentType: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof config !== 'object' || config === null) {
    errors.push('Configuration must be a JSON object');
    return { valid: false, errors };
  }

  if (config.timeout !== undefined) {
    if (typeof config.timeout !== 'number' || config.timeout < 1000 || config.timeout > 300000) {
      errors.push('Timeout must be a number between 1000ms and 300000ms');
    }
  }

  if (config.maxConcurrent !== undefined) {
    if (typeof config.maxConcurrent !== 'number' || config.maxConcurrent < 1 || config.maxConcurrent > 100) {
      errors.push('Max concurrent must be between 1 and 100');
    }
  }

  if (config.retries !== undefined) {
    if (typeof config.retries !== 'number' || config.retries < 0 || config.retries > 10) {
      errors.push('Retries must be between 0 and 10');
    }
  }

  // Agent-specific validations
  switch (agentType) {
    case 'analyzer':
      if (config.analysisDepth !== undefined) {
        const validDepths = ['quick', 'standard', 'comprehensive'];
        if (!validDepths.includes(config.analysisDepth)) {
          errors.push(`Analysis depth must be one of: ${validDepths.join(', ')}`);
        }
      }
      break;

    case 'defender':
      if (config.alertLevel !== undefined) {
        const validLevels = ['low', 'medium', 'high', 'critical'];
        if (!validLevels.includes(config.alertLevel)) {
          errors.push(`Alert level must be one of: ${validLevels.join(', ')}`);
        }
      }
      if (config.scanMode !== undefined) {
        const validModes = ['passive', 'active', 'continuous'];
        if (!validModes.includes(config.scanMode)) {
          errors.push(`Scan mode must be one of: ${validModes.join(', ')}`);
        }
      }
      break;

    case 'scout':
      if (config.updateFrequency !== undefined) {
        if (!config.updateFrequency.match(/^\d+[mhd]$/)) {
          errors.push('Update frequency must be in format: 5m, 1h, 1d');
        }
      }
      if (config.metricDepth !== undefined) {
        const validDepths = ['basic', 'standard', 'full'];
        if (!validDepths.includes(config.metricDepth)) {
          errors.push(`Metric depth must be one of: ${validDepths.join(', ')}`);
        }
      }
      break;
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate system configuration
 */
function validateSystemConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof config !== 'object' || config === null) {
    errors.push('Configuration must be a JSON object');
    return { valid: false, errors };
  }

  const validBooleanFields = ['maintenanceMode', 'debugMode', 'alertsEnabled', 'metricsCollection', 'activityLogging'];
  for (const field of validBooleanFields) {
    if (config[field] !== undefined && typeof config[field] !== 'boolean') {
      errors.push(`${field} must be a boolean`);
    }
  }

  if (config.maxAgents !== undefined) {
    if (typeof config.maxAgents !== 'number' || config.maxAgents < 1) {
      errors.push('Max agents must be a positive number');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// ELDER CONFIGURATION ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/agents-elders/config/elders/:elderId
 * Get configuration for a specific elder
 */
router.get('/elders/:elderId', async (req: Request, res: Response) => {
  try {
    const { elderId } = req.params;
    const adminId = (req.user as any)?.id;

    const elder = await getElderById(elderId);
    if (!elder) {
      return res.status(404).json({ error: 'Elder not found' });
    }

    // Log audit event
    await logAuditEvent({
      userId: adminId,
      action: 'VIEW_ELDER_CONFIG',
      resourceType: 'elder',
      resourceId: elderId,
      details: `Viewed configuration for ${elder.name}`,
      severity: 'low',
    });

    res.json({
      id: elder.id,
      name: elder.name,
      type: elder.name.toLowerCase(),
      configuration: elder.configuration || {},
      currentStats: {
        status: elder.status,
        uptime: elder.uptime,
      },
    });
  } catch (error) {
    logger.error('Error fetching elder configuration:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

/**
 * PUT /api/admin/agents-elders/config/elders/:elderId
 * Update configuration for a specific elder
 */
router.put('/elders/:elderId', async (req: Request, res: Response) => {
  try {
    const { elderId } = req.params;
    const { configuration } = req.body;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    if (!configuration) {
      return res.status(400).json({ error: 'Configuration is required' });
    }

    // Get elder to validate type
    const elder = await getElderById(elderId);
    if (!elder) {
      return res.status(404).json({ error: 'Elder not found' });
    }

    // Validate configuration
    const validation = validateElderConfig(configuration, elder.name);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid configuration',
        details: validation.errors,
      });
    }

    // Store old config for change tracking
    const oldConfig = elder.configuration || {};

    // Update configuration
    const updated = await updateElder(elderId, {
      configuration,
    });

    // Log activity
    await createElderActivity({
      id: uuidv4(),
      elderId,
      activityType: 'configuration_update',
      title: 'Configuration Updated',
      description: `Configuration updated by admin ${adminId}`,
      impact: 'Settings changed',
      severity: 'info',
      status: 'completed',
      data: {
        oldConfig,
        newConfig: configuration,
        changedBy: adminId,
      },
    });

    // Log audit event
    await logAuditEvent({
      userId: adminId,
      action: 'UPDATE_ELDER_CONFIG',
      resourceType: 'elder',
      resourceId: elderId,
      details: `Updated configuration for ${elder.name}`,
      severity: 'medium',
      changes: {
        oldConfig,
        newConfig: configuration,
      },
    });

    res.json({
      success: true,
      message: `Configuration updated for ${elder.name}`,
      data: updated,
    });
  } catch (error) {
    logger.error('Error updating elder configuration:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// ============================================================================
// AGENT CONFIGURATION ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/agents-elders/config/agents/:agentId
 * Get configuration for a specific agent
 */
router.get('/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const adminId = (req.user as any)?.id;

    const agent = await getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Log audit event
    await logAuditEvent({
      userId: adminId,
      action: 'VIEW_AGENT_CONFIG',
      resourceType: 'agent',
      resourceId: agentId,
      details: `Viewed configuration for ${agent.name}`,
      severity: 'low',
    });

    res.json({
      id: agent.id,
      name: agent.name,
      type: agent.type,
      configuration: agent.configuration || {},
      currentStats: {
        status: agent.status,
        uptime: agent.uptime,
        messagesProcessed: agent.messagesProcessed,
        averageResponseTime: agent.averageResponseTime,
        errorRate: agent.errorRate,
      },
    });
  } catch (error) {
    logger.error('Error fetching agent configuration:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

/**
 * PUT /api/admin/agents-elders/config/agents/:agentId
 * Update configuration for a specific agent
 */
router.put('/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { configuration } = req.body;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    if (!configuration) {
      return res.status(400).json({ error: 'Configuration is required' });
    }

    // Get agent to validate type
    const agent = await getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Validate configuration
    const validation = validateAgentConfig(configuration, agent.type);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid configuration',
        details: validation.errors,
      });
    }

    // Store old config for change tracking
    const oldConfig = agent.configuration || {};

    // Update configuration
    const updated = await updateAgent(agentId, {
      configuration,
    });

    // Log activity
    await createAgentLog({
      id: uuidv4(),
      agentId,
      action: 'configuration_update',
      operationType: 'configuration',
      description: `Configuration updated by admin ${adminId}`,
      result: 'success',
      resultDetails: {
        oldConfig,
        newConfig: configuration,
        changedBy: adminId,
      },
    });

    // Log audit event
    await logAuditEvent({
      userId: adminId,
      action: 'UPDATE_AGENT_CONFIG',
      resourceType: 'agent',
      resourceId: agentId,
      details: `Updated configuration for ${agent.name}`,
      severity: 'medium',
      changes: {
        oldConfig,
        newConfig: configuration,
      },
    });

    res.json({
      success: true,
      message: `Configuration updated for ${agent.name}`,
      data: updated,
    });
  } catch (error) {
    logger.error('Error updating agent configuration:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// ============================================================================
// SYSTEM CONFIGURATION ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/agents-elders/config/system
 * Get system-wide configuration
 */
router.get('/system', async (req: Request, res: Response) => {
  try {
    const adminId = (req.user as any)?.id;

    let config = await getSystemConfiguration();
    if (!config) {
      config = await ensureSystemConfiguration();
    }

    // Log audit event
    await logAuditEvent({
      userId: adminId,
      action: 'VIEW_SYSTEM_CONFIG',
      resourceType: 'system',
      resourceId: 'system',
      details: 'Viewed system configuration',
      severity: 'low',
    });

    res.json({
      id: config.id,
      elderSettings: config.elderSettings || {},
      agentSettings: config.agentSettings || {},
      systemSettings: config.systemSettings || {},
      elderFeatureFlags: config.elderFeatureFlags || {},
      agentFeatureFlags: config.agentFeatureFlags || {},
      version: config.version,
    });
  } catch (error) {
    logger.error('Error fetching system configuration:', error);
    res.status(500).json({ error: 'Failed to fetch system configuration' });
  }
});

/**
 * PUT /api/admin/agents-elders/config/system
 * Update system-wide configuration
 */
router.put('/system', async (req: Request, res: Response) => {
  try {
    const { systemSettings, elderSettings, agentSettings, featureFlags } = req.body;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    // Check if super admin
    if (userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admins can modify system configuration' });
    }

    let config = await getSystemConfiguration();
    if (!config) {
      config = await ensureSystemConfiguration();
    }

    // Validate system settings if provided
    if (systemSettings) {
      const validation = validateSystemConfig(systemSettings);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid system configuration',
          details: validation.errors,
        });
      }
    }

    // Store old config
    const oldConfig = {
      systemSettings: config.systemSettings,
      elderSettings: config.elderSettings,
      agentSettings: config.agentSettings,
    };

    // Build update object
    const updates: any = {
      updatedAt: new Date(),
    };

    if (systemSettings) updates.systemSettings = systemSettings;
    if (elderSettings) updates.elderSettings = elderSettings;
    if (agentSettings) updates.agentSettings = agentSettings;
    if (featureFlags?.elder) updates.elderFeatureFlags = featureFlags.elder;
    if (featureFlags?.agent) updates.agentFeatureFlags = featureFlags.agent;

    // Update configuration
    const updated = await updateSystemConfiguration(config.id, updates);

    // Log audit event
    await logAuditEvent({
      userId: adminId,
      action: 'UPDATE_SYSTEM_CONFIG',
      resourceType: 'system',
      resourceId: 'system',
      details: 'Updated system configuration',
      severity: 'high',
      changes: {
        oldConfig,
        newConfig: {
          systemSettings,
          elderSettings,
          agentSettings,
        },
      },
    });

    res.json({
      success: true,
      message: 'System configuration updated successfully',
      data: updated,
    });
  } catch (error) {
    logger.error('Error updating system configuration:', error);
    res.status(500).json({ error: 'Failed to update system configuration' });
  }
});

// ============================================================================
// BULK CONFIGURATION ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/agents-elders/config/all
 * Get all configurations (elders + agents + system)
 */
router.get('/all', async (req: Request, res: Response) => {
  try {
    const adminId = (req.user as any)?.id;

    const allElders = await (require('../../db/services/agentsEldersService')).getAllElders();
    const allAgents = await (require('../../db/services/agentsEldersService')).getAllAgents();
    let systemConfig = await getSystemConfiguration();
    if (!systemConfig) {
      systemConfig = await ensureSystemConfiguration();
    }

    const eldersConfigs = allElders.map((e: any) => ({
      id: e.id,
      name: e.name,
      configuration: e.configuration || {},
    }));

    const agentsConfigs = allAgents.map((a: any) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      configuration: a.configuration || {},
    }));

    // Log audit event
    await logAuditEvent({
      userId: adminId,
      action: 'VIEW_ALL_CONFIGS',
      resourceType: 'system',
      resourceId: 'system',
      details: 'Viewed all configurations',
      severity: 'low',
    });

    res.json({
      elders: eldersConfigs,
      agents: agentsConfigs,
      system: {
        id: systemConfig.id,
        elderSettings: systemConfig.elderSettings,
        agentSettings: systemConfig.agentSettings,
        systemSettings: systemConfig.systemSettings,
      },
    });
  } catch (error) {
    logger.error('Error fetching all configurations:', error);
    res.status(500).json({ error: 'Failed to fetch configurations' });
  }
});

/**
 * PUT /api/admin/agents-elders/config/bulk
 * Update multiple configurations at once
 */
router.put('/bulk', async (req: Request, res: Response) => {
  try {
    const { updates } = req.body;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Updates array is required' });
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const update of updates) {
      try {
        const { type, id, configuration } = update;

        if (type === 'elder') {
          const elder = await getElderById(id);
          if (!elder) {
            results.failed.push({ id, type, error: 'Elder not found' });
            continue;
          }

          const validation = validateElderConfig(configuration, elder.name);
          if (!validation.valid) {
            results.failed.push({ id, type, error: validation.errors.join('; ') });
            continue;
          }

          await updateElder(id, { configuration });
          results.successful.push({ id, type });
        } else if (type === 'agent') {
          const agent = await getAgentById(id);
          if (!agent) {
            results.failed.push({ id, type, error: 'Agent not found' });
            continue;
          }

          const validation = validateAgentConfig(configuration, agent.type);
          if (!validation.valid) {
            results.failed.push({ id, type, error: validation.errors.join('; ') });
            continue;
          }

          await updateAgent(id, { configuration });
          results.successful.push({ id, type });
        }
      } catch (err) {
        results.failed.push({ id: update.id, type: update.type, error: 'Update failed' });
      }
    }

    // Log audit event
    await logAuditEvent({
      userId: adminId,
      action: 'BULK_UPDATE_CONFIG',
      resourceType: 'system',
      resourceId: 'system',
      details: `Bulk updated ${results.successful.length} configurations`,
      severity: 'high',
    });

    res.json({
      success: results.failed.length === 0,
      message: `Updated ${results.successful.length} configuration(s), ${results.failed.length} failed`,
      results,
    });
  } catch (error) {
    logger.error('Error bulk updating configurations:', error);
    res.status(500).json({ error: 'Failed to bulk update configurations' });
  }
});

export default router;
