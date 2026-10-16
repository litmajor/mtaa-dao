/**
 * Agent Management API Routes
 * Endpoints for managing and monitoring system agents
 * 
 * SECURITY:
 * All GET endpoints require authentication
 * All mutation endpoints rate-limited (10/min for admins)
 * Sensitive metrics endpoints require auth to prevent enumeration
 */

import { Router } from 'express';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { agentRegistry} from '../services/AgentRegistry';
import type {AgentType } from '../services/AgentRegistry';
import { Logger } from '../utils/logger';
import { requireRole } from '../middleware/rbac';
import { isAuthenticated } from '../auth';
import { createRateLimiter } from '../middleware/rateLimiting';
import { ethers } from 'ethers';
import gatewayService from '../services/gatewayService';
import { createWalletIfValid } from '../utils/cryptoWallet';

const logger = new Logger('agent-api');
const router = Router();
const requireAdmin = requireRole('admin');

// Express request extension for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

// Minimal typed interface for the on-chain AgentRegistry contract
interface AgentRegistryContract {
  callStatic: {
    registerAgent(
      agentAddress: string,
      name: string,
      description: string,
      category: number,
      autonomy: number
    ): Promise<string>;
  };
  registerAgent(
    agentAddress: string,
    name: string,
    description: string,
    category: number,
    autonomy: number
  ): Promise<{ hash: string; wait(confirmations?: number): Promise<unknown> }>;
}

// Rate Limiting Middlewares
const agentMutationLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  keyGenerator: (req) => `agent:mutation:${(req as AuthenticatedRequest).user?.id || req.ip}`,
});

const agentMetricsLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
  keyGenerator: (req) => `agent:metrics:${(req as AuthenticatedRequest).user?.id || req.ip}`,
});

/**
 * Async wrapper to handle errors globally and remove try/catch boilerplate
 */
const asyncHandler = (
  fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler => (req, res, next) => {
  Promise.resolve(fn(req as AuthenticatedRequest, res, next)).catch((error) => {
    logger.error(`Error handling ${req.method} ${req.path}:`, error);
    res.status(500).json({
      error: `Failed to execute ${req.path}`,
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  });
};

const VALID_AGENT_TYPES = ['trading', 'anomaly_detection', 'compliance', 'governance_analytics', 'synchronizer'];

// ==========================================
// 1. STATIC & METRIC ROUTES (MUST GO FIRST)
// ==========================================

/**
 * GET /api/agents/status/summary
 * Get agent status summary
 */
router.get(
  '/status/summary',
  isAuthenticated,
  asyncHandler(async (_req, res) => {
    const summary = agentRegistry.getStatusSummary();
    return res.json({
      success: true,
      summary,
    });
  })
);

/**
 * GET /api/agents/type/:type
 * Get all agents of a specific type
 */
router.get(
  '/type/:type',
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const { type } = req.params;

    if (!VALID_AGENT_TYPES.includes(type)) {
      return res.status(400).json({
        error: `Invalid agent type. Must be one of: ${VALID_AGENT_TYPES.join(', ')}`,
      });
    }

    const agents = agentRegistry.getAgentsByType(type as AgentType);

    return res.json({
      success: true,
      type,
      count: agents.length,
      agents: agents.map((a) => ({
        id: a.id,
        type: a.type,
        name: a.name,
        status: a.status,
        createdAt: a.createdAt,
        lastActive: a.lastActive,
      })),
    });
  })
);

/**
 * GET /api/agents/metrics/trading
 * Get trading agent metrics
 */
router.get(
  '/metrics/trading',
  isAuthenticated,
  agentMetricsLimiter,
  asyncHandler(async (_req, res) => {
    const agents = agentRegistry.getAgentsByType('trading' as AgentType);

    if (agents.length === 0) {
      return res.json({
        success: true,
        message: 'No trading agents found',
        agents: [],
      });
    }

    const tradingAgent = agents[0];
    const instance = tradingAgent.instance as { getMetrics?: () => unknown };

    return res.json({
      success: true,
      agentId: tradingAgent.id,
      metrics: typeof instance.getMetrics === 'function' ? instance.getMetrics() : null,
    });
  })
);

/**
 * GET /api/agents/metrics/anomalies
 * Get anomaly detection alerts
 */
router.get(
  '/metrics/anomalies',
  isAuthenticated,
  agentMetricsLimiter,
  asyncHandler(async (req, res) => {
    const rawHours = parseInt(req.query.hours as string, 10);
    const hours = isNaN(rawHours) || rawHours <= 0 ? 24 : rawHours;

    const agents = agentRegistry.getAgentsByType('anomaly_detection' as AgentType);

    if (agents.length === 0) {
      return res.json({
        success: true,
        message: 'No anomaly detection agents found',
        alerts: [],
      });
    }

    const anomalyAgent = agents[0];
    const instance = anomalyAgent.instance as { getAlertHistory?: (h: number) => unknown };

    return res.json({
      success: true,
      agentId: anomalyAgent.id,
      alerts: typeof instance.getAlertHistory === 'function' ? instance.getAlertHistory(hours) : [],
    });
  })
);

/**
 * GET /api/agents/metrics/governance
 * Get DAO governance health metrics
 */
router.get(
  '/metrics/governance',
  isAuthenticated,
  agentMetricsLimiter,
  asyncHandler(async (_req, res) => {
    const agents = agentRegistry.getAgentsByType('governance_analytics' as AgentType);

    if (agents.length === 0) {
      return res.json({
        success: true,
        message: 'No governance agents found',
        metrics: null,
      });
    }

    const govAgent = agents[0];
    const instance = govAgent.instance as { getHealthHistory?: (h: number) => unknown };

    return res.json({
      success: true,
      agentId: govAgent.id,
      metrics: typeof instance.getHealthHistory === 'function' ? instance.getHealthHistory(24) : null,
    });
  })
);

/**
 * GET /api/agents
 * Get all agents with status
 */
router.get(
  '/',
  isAuthenticated,
  asyncHandler(async (_req, res) => {
    const agents = agentRegistry.getAllAgents();
    const summary = agentRegistry.getStatusSummary();

    return res.json({
      success: true,
      summary,
      agents: agents.map((a) => ({
        id: a.id,
        type: a.type,
        name: a.name,
        status: a.status,
        createdAt: a.createdAt,
        lastActive: a.lastActive,
      })),
    });
  })
);

/**
 * POST /api/agents
 * Create a new agent
 */
router.post(
  '/',
  requireAdmin,
  agentMutationLimiter,
  asyncHandler(async (req, res) => {
    const {
      type,
      agentId,
      registerOnChain = false,
      agentAddress: onChainAgentAddress,
      agentName,
      description = '',
      category = 0,
      autonomyLevel = 0,
      paymentConfig = {},
    } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Agent type is required' });
    }

    if (!VALID_AGENT_TYPES.includes(type)) {
      return res.status(400).json({
        error: `Invalid agent type. Must be one of: ${VALID_AGENT_TYPES.join(', ')}`,
      });
    }

    let canonicalAgentId: string | undefined = agentId;

    // Handle optional on-chain registration
    if (registerOnChain) {
      if (!onChainAgentAddress || !agentName) {
        return res.status(400).json({
          error: 'agentAddress and agentName are required for on-chain registration',
        });
      }

      const AGENT_REGISTRY_ADDR = process.env.AGENT_REGISTRY_ADDR || process.env.AGENT_REGISTRY_ADDRESS || '';
      const RPC_URL = process.env.RPC_URL || '';
      const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

      if (!AGENT_REGISTRY_ADDR || !RPC_URL || !PRIVATE_KEY) {
        logger.warn('Missing on-chain config for agent registration; falling back to local-only registration');
      } else {
        try {
          const provider = new ethers.JsonRpcProvider(RPC_URL);

          let pk = String(PRIVATE_KEY || '').trim();
          if (pk && !pk.startsWith('0x')) pk = `0x${pk}`;

          if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
            logger.warn('Invalid PRIVATE_KEY format for on-chain registration; falling back to local-only registration');
          } else {
            const wallet = createWalletIfValid(pk, provider);
            if (!wallet) {
              logger.warn('PRIVATE_KEY invalid for on-chain registration; falling back to local-only registration');
            } else {
              const registryAbi = [
                'function registerAgent(address,string,string,uint8,uint8) returns (bytes32)',
              ];

              const registry = new ethers.Contract(
                AGENT_REGISTRY_ADDR,
                registryAbi,
                wallet
              ) as unknown as AgentRegistryContract;

              let previewId: string | undefined;
              try {
                previewId = await registry.callStatic.registerAgent(
                  onChainAgentAddress,
                  agentName,
                  description,
                  Number(category),
                  Number(autonomyLevel)
                );
              } catch {
                previewId = undefined;
              }

              const tx = await registry.registerAgent(
                onChainAgentAddress,
                agentName,
                description,
                Number(category),
                Number(autonomyLevel)
              );
              await tx.wait();

              canonicalAgentId = previewId ?? canonicalAgentId ?? `${onChainAgentAddress}-${Date.now()}`;
              logger.info('On-chain AgentRegistry.registerAgent succeeded', {
                agentId: canonicalAgentId,
                txHash: tx.hash,
              });

              // Configure payment settings on gateway
              const {
                feeInKES = 0,
                feeInUSD = 0,
                defaultTier = 0,
                defaultSubscriptionDuration = 0,
                payoutPercentage = 100,
                treasuryPercentage = 0,
                communityPercentage = 0,
                acceptsMTAA = true,
                acceptsKES = true,
              } = paymentConfig || {};

              try {
                if (canonicalAgentId) {
                  await gatewayService.configureAgent(
                    canonicalAgentId,
                    onChainAgentAddress,
                    feeInKES,
                    feeInUSD,
                    defaultTier,
                    defaultSubscriptionDuration,
                    payoutPercentage,
                    treasuryPercentage,
                    communityPercentage,
                    acceptsMTAA,
                    acceptsKES
                  );
                  logger.info('Configured on-chain payment settings for agent', { agentId: canonicalAgentId });
                }
              } catch (gwErr) {
                const gwMsg = gwErr instanceof Error ? gwErr.message : String(gwErr);
                logger.warn('Failed to configure payment on gateway; agent remains registered on-chain', {
                  error: gwMsg,
                });
              }
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn('On-chain agent registration failed; falling back to local-only', { error: msg });
        }
      }
    }

    // Create and initialize local agent record
    const agent = await agentRegistry.createAgent(type, canonicalAgentId);
    await agentRegistry.initializeAgent(agent.id);

    return res.json({
      success: true,
      agent: {
        id: agent.id,
        type: agent.type,
        name: agent.name,
        status: agent.status,
        createdAt: agent.createdAt,
        lastActive: agent.lastActive,
      },
    });
  })
);

// ==========================================
// 2. DYNAMIC PARAMETER ROUTES (MUST GO LAST)
// ==========================================

/**
 * GET /api/agents/:agentId
 * Get single agent profile
 */
router.get(
  '/:agentId',
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const agent = agentRegistry.getAgent(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.json({
      success: true,
      agent: {
        id: agent.id,
        type: agent.type,
        name: agent.name,
        status: agent.status,
        config: agent.instance.getConfig(),
        metrics: agent.instance.getMetrics(),
        createdAt: agent.createdAt,
        lastActive: agent.lastActive,
      },
    });
  })
);

/**
 * POST /api/agents/:agentId/pause
 * Pause an agent
 */
router.post(
  '/:agentId/pause',
  requireAdmin,
  agentMutationLimiter,
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const agent = agentRegistry.getAgent(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    agentRegistry.pauseAgent(agentId);

    return res.json({
      success: true,
      message: `Agent ${agentId} paused`,
      agent: {
        id: agent.id,
        status: 'paused',
      },
    });
  })
);

/**
 * POST /api/agents/:agentId/resume
 * Resume a paused agent
 */
router.post(
  '/:agentId/resume',
  requireAdmin,
  agentMutationLimiter,
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const agent = agentRegistry.getAgent(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    agentRegistry.resumeAgent(agentId);

    return res.json({
      success: true,
      message: `Agent ${agentId} resumed`,
      agent: {
        id: agent.id,
        status: 'active',
      },
    });
  })
);

/**
 * POST /api/agents/:agentId/shutdown
 * Shutdown an agent
 */
router.post(
  '/:agentId/shutdown',
  requireAdmin,
  agentMutationLimiter,
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const agent = agentRegistry.getAgent(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    await agentRegistry.shutdownAgent(agentId);

    return res.json({
      success: true,
      message: `Agent ${agentId} shutdown`,
      agent: {
        id: agent.id,
        status: 'shutdown',
      },
    });
  })
);

export default router;