/**
 * Coordinator API Routes
 * 
 * Endpoints for coordinator communication and consensus decisions
 */

import { Router, Request, Response, NextFunction } from 'express';
import { elderCoordinator } from '../core/elders/coordinator';
import { coordinatorMessageBus } from '../core/elders/coordinator/message-bus';
import { authenticateToken, isDaoMember, isSuperUser, AuthRequest } from '../middleware/auth';

const router = Router();

// Wrapper functions to handle type casting for middlewares
const auth = (req: Request, res: Response, next: NextFunction) => 
  authenticateToken(req as AuthRequest, res, next);
const daoMember = (req: Request, res: Response, next: NextFunction) => 
  isDaoMember(req as AuthRequest, res, next);
const superUser = (req: Request, res: Response, next: NextFunction) => 
  isSuperUser(req as AuthRequest, res, next);

/**
 * GET /api/coordinator/status
 * Get current coordinator status
 */
router.get('/status', auth, (req: Request, res: Response) => {
  try {
    const status = elderCoordinator.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/coordinator/consensus
 * Get elder consensus on a proposal
 * 
 * Query params:
 *   - daoId: The DAO to get consensus for
 *   - proposalId: The proposal to evaluate
 */
router.get('/consensus', auth, daoMember, async (req: Request, res: Response) => {
  try {
    const { daoId, proposalId } = req.query;

    if (!daoId || !proposalId) {
      return res.status(400).json({
        success: false,
        error: 'Missing daoId or proposalId'
      });
    }

    // Verify user has access to this DAO
    const userDaos = (req.user as any)?.daos || [];
    if (!userDaos.includes(String(daoId))) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Request consensus from all elders
    const consensus = await elderCoordinator.getElderConsensus(
      String(daoId),
      { proposalId: String(proposalId) }
    );

    res.json({
      success: true,
      data: consensus,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/coordinator/message-bus/stats
 * Get message bus statistics
 */
router.get('/message-bus/stats', auth, superUser, (req: Request, res: Response) => {
  try {
    const stats = coordinatorMessageBus.getStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/coordinator/message-bus/history
 * Get message history
 * 
 * Query params:
 *   - topic: Optional topic filter
 *   - daoId: Optional DAO filter
 *   - limit: Max number of messages (default 100)
 */
router.get('/message-bus/history', auth, superUser, (req: Request, res: Response) => {
  try {
    const { topic, daoId, limit = 100 } = req.query;

    let history;
    if (daoId) {
      history = coordinatorMessageBus.getDaoHistory(String(daoId), Number(limit));
    } else {
      history = coordinatorMessageBus.getHistory(topic as any, Number(limit));
    }

    res.json({
      success: true,
      count: history.length,
      data: history,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/coordinator/message-bus/subscriptions
 * Get active subscriptions
 */
router.get('/message-bus/subscriptions', auth, superUser, (req: Request, res: Response) => {
  try {
    const stats = coordinatorMessageBus.getStats();

    res.json({
      success: true,
      data: {
        totalSubscriptions: stats.totalSubscriptions,
        byTopic: stats.subscriptionsByTopic
      },
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/coordinator/message
 * Publish a message to the bus (superuser only)
 * 
 * Body:
 * {
 *   topic: string,
 *   from: 'SCRY' | 'KAIZEN' | 'LUMEN' | 'COORDINATOR',
 *   data: object,
 *   daoId?: string,
 *   priority?: 'low' | 'normal' | 'high' | 'critical'
 * }
 */
router.post('/message', auth, superUser, async (req: Request, res: Response) => {
  try {
    const { topic, from, data, daoId, priority = 'normal' } = req.body;

    if (!topic || !from || !data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: topic, from, data'
      });
    }

    await coordinatorMessageBus.broadcast(
      topic,
      data,
      from,
      daoId,
      priority
    );

    res.json({
      success: true,
      message: 'Message published successfully',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/coordinator/critical-alert
 * Send a critical alert (superuser only)
 * 
 * Body:
 * {
 *   from: 'SCRY' | 'KAIZEN' | 'LUMEN' | 'COORDINATOR',
 *   data: object,
 *   daoId?: string
 * }
 */
router.post('/critical-alert', auth, superUser, async (req: Request, res: Response) => {
  try {
    const { from, data, daoId } = req.body;

    if (!from || !data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: from, data'
      });
    }

    await coordinatorMessageBus.sendCriticalAlert(
      'coordinator:alert-escalated',
      from,
      data,
      daoId
    );

    res.json({
      success: true,
      message: 'Critical alert sent',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/coordinator/health
 * Simple health check
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const status = elderCoordinator.getStatus();

    res.json({
      success: true,
      coordinatorStatus: status.status,
      eldersOnline: status.coordinatorHealth.eldersConnected,
      uptime: status.coordinatorHealth.uptime,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/coordinator/heartbeat
 * Update coordinator heartbeat (for health monitoring)
 */
router.post('/heartbeat', auth, (req: Request, res: Response) => {
  try {
    elderCoordinator.heartbeat();

    res.json({
      success: true,
      message: 'Heartbeat recorded',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

export default router;
