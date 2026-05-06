/**
 * Agent Management API Routes
 * Endpoints for managing and monitoring system agents
 * 
 * SECURITY:
 * ✅ All GET endpoints require authentication
 * ✅ All mutation endpoints rate-limited (10/min for admins)
 * ✅ Sensitive metrics endpoints require auth to prevent enumeration
 */

import { Router, Request, Response } from 'express';
import { agentRegistry } from '../services/AgentRegistry';
import { Logger } from '../utils/logger';
import { requireRole } from '../middleware/rbac';
import { isAuthenticated } from '../nextAuthMiddleware';
import { createRateLimiter } from '../middleware/rateLimiting';

const logger = new Logger('agent-api');
const router = Router();
const requireAdmin = requireRole('admin');

// 🔴 CRITICAL: Rate limiting for agent management operations
const agentMutationLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  keyGenerator: (req) => `agent:mutation:${(req as any).user?.id || req.ip}`,
});

// 🔴 CRITICAL: Rate limiting for metric queries (expensive operations)
const agentMetricsLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
  keyGenerator: (req) => `agent:metrics:${(req as any).user?.id || req.ip}`,
});

/**
 * GET /api/agents
 * Get all agents with status
 * 🔴 CRITICAL: Requires authentication - prevents agent enumeration
 */
router.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const agents = agentRegistry.getAllAgents();
    const summary = agentRegistry.getStatusSummary();

    res.json({
      success: true,
      summary,
      agents: agents.map(a => ({
        id: a.id,
        type: a.type,
        name: a.name,
        status: a.status,
        createdAt: a.createdAt,
        lastActive: a.lastActive
      }))
    });
  } catch (error) {
    logger.error('Failed to fetch agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

/**
 * GET /api/agents/:agentId
 * Get specific agent details
 * 🔴 CRITICAL: Requires authentication - prevents agent profiling
 */
router.get('/:agentId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const agent = agentRegistry.getAgent(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({
      success: true,
      agent: {
        id: agent.id,
        type: agent.type,
        name: agent.name,
        status: agent.status,
        config: agent.instance.getConfig(),
        metrics: agent.instance.getMetrics(),
        createdAt: agent.createdAt,
        lastActive: agent.lastActive
      }
    });
  } catch (error) {
    logger.error('Failed to fetch agent:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

/**
 * POST /api/agents
 * Create a new agent
 * 🔴 CRITICAL: Rate limited - prevents agent creation spam
 */
router.post('/', requireAdmin, agentMutationLimiter, async (req: Request, res: Response) => {
  try {
    const { type, agentId } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Agent type is required' });
    }

    const validTypes = ['trading', 'anomaly_detection', 'compliance', 'governance_analytics'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid agent type. Must be one of: ${validTypes.join(', ')}` });
    }

    const agent = await agentRegistry.createAgent(type, agentId);
    await agentRegistry.initializeAgent(agent.id);

    res.json({
      success: true,
      agent: {
        id: agent.id,
        type: agent.type,
        name: agent.name,
        status: agent.status,
        createdAt: agent.createdAt,
        lastActive: agent.lastActive
      }
    });
  } catch (error) {
    logger.error('Failed to create agent:', error);
    res.status(500).json({ error: 'Failed to create agent', details: (error as Error).message });
  }
});

/**
 * POST /api/agents/:agentId/pause
 * Pause an agent
 * 🔴 CRITICAL: Rate limited - prevents operational disruption
 */
router.post('/:agentId/pause', requireAdmin, agentMutationLimiter, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const agent = agentRegistry.getAgent(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    agentRegistry.pauseAgent(agentId);

    res.json({
      success: true,
      message: `Agent ${agentId} paused`,
      agent: {
        id: agent.id,
        status: 'paused'
      }
    });
  } catch (error) {
    logger.error('Failed to pause agent:', error);
    res.status(500).json({ error: 'Failed to pause agent' });
  }
});

/**
 * POST /api/agents/:agentId/resume
 * Resume a paused agent
 * 🔴 CRITICAL: Rate limited - prevents operational disruption
 */
router.post('/:agentId/resume', requireAdmin, agentMutationLimiter, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const agent = agentRegistry.getAgent(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    agentRegistry.resumeAgent(agentId);

    res.json({
      success: true,
      message: `Agent ${agentId} resumed`,
      agent: {
        id: agent.id,
        status: 'active'
      }
    });
  } catch (error) {
    logger.error('Failed to resume agent:', error);
    res.status(500).json({ error: 'Failed to resume agent' });
  }
});

/**
 * POST /api/agents/:agentId/shutdown
 * Shutdown an agent
 * 🔴 CRITICAL: Rate limited - prevents operational disruption
 */
router.post('/:agentId/shutdown', requireAdmin, agentMutationLimiter, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const agent = agentRegistry.getAgent(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    await agentRegistry.shutdownAgent(agentId);

    res.json({
      success: true,
      message: `Agent ${agentId} shutdown`,
      agent: {
        id: agent.id,
        status: 'shutdown'
      }
    });
  } catch (error) {
    logger.error('Failed to shutdown agent:', error);
    res.status(500).json({ error: 'Failed to shutdown agent' });
  }
});

/**
 * GET /api/agents/status/summary
 * Get agent status summary
 * 🔴 CRITICAL: Requires authentication - prevents system reconnaissance
 */
router.get('/status/summary', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const summary = agentRegistry.getStatusSummary();
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    logger.error('Failed to fetch status summary:', error);
    res.status(500).json({ error: 'Failed to fetch status summary' });
  }
});

/**
 * GET /api/agents/type/:type
 * Get all agents of a specific type
 * 🔴 CRITICAL: Requires authentication - prevents agent enumeration by type
 */
router.get('/type/:type', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const validTypes = ['trading', 'anomaly_detection', 'compliance', 'governance_analytics', 'synchronizer'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid agent type. Must be one of: ${validTypes.join(', ')}` });
    }

    const agents = agentRegistry.getAgentsByType(type as any);

    res.json({
      success: true,
      type,
      count: agents.length,
      agents: agents.map(a => ({
        id: a.id,
        type: a.type,
        name: a.name,
        status: a.status,
        createdAt: a.createdAt,
        lastActive: a.lastActive
      }))
    });
  } catch (error) {
    logger.error('Failed to fetch agents by type:', error);
    res.status(500).json({ error: 'Failed to fetch agents by type' });
  }
});

/**
 * GET /api/agents/metrics/trading
 * Get trading agent metrics
 * 🔴 CRITICAL: Requires authentication + rate limited - prevents sensitive metrics exposure
 */
router.get('/metrics/trading', isAuthenticated, agentMetricsLimiter, async (req: Request, res: Response) => {
  try {
    const agents = agentRegistry.getAgentsByType('trading');

    if (agents.length === 0) {
      return res.json({
        success: true,
        message: 'No trading agents found',
        agents: []
      });
    }

    const tradingAgent = agents[0];
    const instance = tradingAgent.instance as any;

    res.json({
      success: true,
      agentId: tradingAgent.id,
      metrics: instance.getMetrics ? instance.getMetrics() : null
    });
  } catch (error) {
    logger.error('Failed to fetch trading metrics:', error);
    res.status(500).json({ error: 'Failed to fetch trading metrics' });
  }
});

/**
 * GET /api/agents/metrics/anomalies
 * Get anomaly detection alerts
 * 🔴 CRITICAL: Requires authentication + rate limited - prevents alert enumeration
 */
router.get('/metrics/anomalies', isAuthenticated, agentMetricsLimiter, async (req: Request, res: Response) => {
  try {
    const { hours = '24' } = req.query;
    const agents = agentRegistry.getAgentsByType('anomaly_detection');

    if (agents.length === 0) {
      return res.json({
        success: true,
        message: 'No anomaly detection agents found',
        alerts: []
      });
    }

    const anomalyAgent = agents[0];
    const instance = anomalyAgent.instance as any;

    res.json({
      success: true,
      agentId: anomalyAgent.id,
      alerts: instance.getAlertHistory ? instance.getAlertHistory(parseInt(hours as string)) : []
    });
  } catch (error) {
    logger.error('Failed to fetch anomaly alerts:', error);
    res.status(500).json({ error: 'Failed to fetch anomaly alerts' });
  }
});

/**
 * GET /api/agents/metrics/governance
 * Get DAO governance health metrics
 * 🔴 CRITICAL: Requires authentication + rate limited - prevents governance metrics exposure
 */
router.get('/metrics/governance', isAuthenticated, agentMetricsLimiter, async (req: Request, res: Response) => {
  try {
    const agents = agentRegistry.getAgentsByType('governance_analytics');

    if (agents.length === 0) {
      return res.json({
        success: true,
        message: 'No governance agents found',
        metrics: null
      });
    }

    const govAgent = agents[0];
    const instance = govAgent.instance as any;

    res.json({
      success: true,
      agentId: govAgent.id,
      metrics: instance.getHealthHistory ? instance.getHealthHistory(24) : null
    });
  } catch (error) {
    logger.error('Failed to fetch governance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch governance metrics' });
  }
});

export default router;
