/**
 * Morio AI Assistant API Routes
 * 
 * Endpoints for interacting with the Morio conversational assistant
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { rateLimitPerUser } from '../middleware/rateLimit';
import { jobQueueService } from '../services/jobQueueService';
import { morio } from '../agents/morio';
import { nuru } from '../core/nuru';
import { checkFeatureGating } from '../services/gatingService';
import { getUserPersona } from '../services/personaService';
import { db } from '../db';
import { daoMemberships, vaults } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import type { ChatMessage } from '../agents/morio/types';
import type { User } from '../../shared/schema';
// Import Morio sub-routers
import morioDataHubRoutes from './morio-data-hub';
import morioElderInsightsRoutes from './morio-elder-insights';

const router = Router();

/**
 * POST /api/morio/chat
 * Queue chat message for processing (returns immediately with job ID)
 * Rate limit: 5 requests per 1 minute per user to prevent LLM API abuse
 */
router.post('/chat', [authenticateToken, rateLimitPerUser('morio-chat', 5, '1min')], async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { daoId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: message (userId from auth)' 
      });
    }

    // Queue chat job
    const jobId = await jobQueueService.queueJob('morio-chat', {
      userId,
      daoId: daoId || '',
      message,
      timestamp: new Date()
    }, {
      priority: 7,
      timeout: 60000 // 60 second timeout
    });

    res.status(202).json({
      success: true,
      jobId,
      statusUrl: `/api/morio/chat-status/${jobId}`
    });
  } catch (error) {
    console.error('Morio chat queue error:', error);
    res.status(500).json({ 
      error: 'Failed to queue chat message'
    });
  }
});

/**
 * GET /api/morio/session/:userId
 * Get user session status (AUTHENTICATED - only own session)
 */
router.get('/session/:userId', [authenticateToken], async (req: any, res: Response) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.id;

    // Users can only access their own session
    if (requestingUserId !== userId) {
      return res.status(403).json({ error: 'Forbidden: can only access own session' });
    }

    const session = await morio.getSessionStatus(userId);
    res.json(session);
  } catch (error) {
    console.error('Session fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

/**
 * DELETE /api/morio/session/:userId
 * Clear user session (AUTHENTICATED - only own session)
 */
router.delete('/session/:userId', [authenticateToken], async (req: any, res: Response) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.id;

    // Users can only clear their own session
    if (requestingUserId !== userId) {
      return res.status(403).json({ error: 'Forbidden: can only clear own session' });
    }

    await morio.clearSession(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Session clear error:', error);
    res.status(500).json({ error: 'Failed to clear session' });
  }
});

/**
 * POST /api/morio/analyze
 * Queue DAO analysis job (returns immediately with job ID)
 * Rate limit: 2 requests per 1 minute per user to prevent LLM API abuse
 */
router.post('/analyze', [authenticateToken, rateLimitPerUser('morio-analyze', 2, '1min')], async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { type, daoId, timeframe } = req.body;

    if (!type || !daoId) {
      return res.status(400).json({ 
        error: 'Missing required fields: type and daoId' 
      });
    }

    // Verify user has access to this DAO
    const membership = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, userId)
        )
      )
      .limit(1);

    if (!membership || membership.length === 0) {
      return res.status(403).json({ 
        error: 'User does not have access to analyze this DAO',
        daoId
      });
    }

    // Queue analysis job
    const jobId = await jobQueueService.queueJob('morio-analyze', {
      userId,
      daoId,
      analysisType: type,
      timeframe
    }, {
      priority: 6,
      timeout: 120000 // 2 minute timeout
    });

    res.status(202).json({
      success: true,
      jobId,
      statusUrl: `/api/morio/analyze-status/${jobId}`
    });
  } catch (error) {
    console.error('Analysis queue error:', error);
    res.status(500).json({ error: 'Failed to queue analysis' });
  }
});

/**
 * POST /api/morio/assess-risk
 * Queue risk assessment job (returns immediately with job ID)
 * Rate limit: 2 requests per 1 minute per user to prevent LLM API abuse
 */
router.post('/assess-risk', [authenticateToken, rateLimitPerUser('morio-risk', 2, '1min')], async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { proposalId, daoId } = req.body;

    if (!proposalId || !daoId) {
      return res.status(400).json({ 
        error: 'Missing required fields: proposalId and daoId' 
      });
    }

    // Verify user has access to this DAO before assessing risk
    const membership = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, userId)
        )
      )
      .limit(1);

    if (!membership || membership.length === 0) {
      return res.status(403).json({ 
        error: 'User does not have access to assess risk for this DAO',
        daoId
      });
    }

    // Queue risk assessment job
    const jobId = await jobQueueService.queueJob('morio-analyze', {
      userId,
      daoId,
      proposalId,
      analysisType: 'risk-assessment'
    }, {
      priority: 6,
      timeout: 120000 // 2 minute timeout
    });

    res.status(202).json({
      success: true,
      jobId,
      statusUrl: `/api/morio/risk-status/${jobId}`
    });
  } catch (error) {
    console.error('Risk assessment queue error:', error);
    res.status(500).json({ error: 'Failed to queue risk assessment' });
  }
});

/**
 * Morio AI Assistant endpoint (health check consolidated to /api/health/morio)
 * See health.ts for /health endpoint
 */

/**
 * GET /api/morio/user-context
 * Get user's personalized context for Morio
 * Includes: gating, persona, DAO roles, vault positions, activity summary
 */
router.get('/user-context', [authenticateToken], async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user from database
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId)
    }) as User;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's persona
    const persona = await getUserPersona(userId);

    // Get user's DAO memberships and roles
    const userDaoMemberships = await db
      .select({
        daoId: daoMemberships.daoId,
        role: daoMemberships.role,
        joinedAt: daoMemberships.joinedAt,
      })
      .from(daoMemberships)
      .where(eq(daoMemberships.userId, userId));

    // Get all gating statuses
    const gatingStatuses: Record<string, any> = {};
    const features = [
      'trading.dex',
      'vault.yield',
      'proposal.create',
      'governance.vote',
      'investment.pools',
      'ai.assistant',
      'dao.create',
      'dao.join',
      'aave.flash-loans',
      'cross-chain.operations',
      'advanced.analytics'
    ];

    for (const feature of features) {
      const status = await checkFeatureGating(feature, user);
      gatingStatuses[feature] = {
        isAvailable: status.isAvailable,
        reason: status.reason,
        daysUntilAvailable: status.daysUntilAvailable,
        amountNeeded: status.amountNeeded,
        currency: status.currency
      };
    }

    // Find locked and available features
    const lockedFeatures = Object.entries(gatingStatuses)
      .filter(([, status]: any) => !status.isAvailable)
      .map(([feature]) => feature);

    const availableFeatures = Object.entries(gatingStatuses)
      .filter(([, status]: any) => status.isAvailable)
      .map(([feature]) => feature);

    // Prepare user profile with enhanced personalization
    res.json({
      userId,
      profile: {
        name: user.name || user.username,
        persona,
        accountAge: user.joinedAt ? Math.floor((Date.now() - user.joinedAt.getTime()) / (1000 * 60 * 60 * 24)) : 0,
        reputation: user.reputationScore ? Number(user.reputationScore) : 0,
        totalContributions: user.totalContributions ? Number(user.totalContributions) : 0,
      },
      portfolio: {
        balance: user.mtaaTokenBalance ? Number(user.mtaaTokenBalance) : 0,
        votingPower: user.votingPower ? Number(user.votingPower) : 0,
        currentStreak: user.currentStreak || 0,
        currency: 'MTAA'
      },
      governance: {
        daoCount: userDaoMemberships.length,
        roles: userDaoMemberships.map((m: any) => ({
          daoId: m.daoId,
          role: m.role,
          joinedAt: m.joinedAt
        })),
        memberOf: userDaoMemberships.map((m: any) => m.daoId)
      },
      features: {
        available: availableFeatures,
        locked: lockedFeatures,
        gatingStatus: gatingStatuses
      },
      preferences: {
        preferredCurrency: user.preferredCurrency || 'USD',
        darkMode: user.darkMode || false,
        advancedMode: user.isSuperUser || false
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get user context:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user context',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ✅ Mount Morio sub-routers at proper nested paths
router.use('/data-hub', morioDataHubRoutes);
router.use('/elder-insights', morioElderInsightsRoutes);

export default router;

/**
 * POST /api/morio/confirm-action
 * Execute a previously-created pending action (requires ownership/permission)
 */
router.post('/confirm-action', [authenticateToken], async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { token } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!token) return res.status(400).json({ error: 'Missing pending action token' });

    const { kwetuService } = await import('../services/kwetuService');

    try {
      const result = await kwetuService.safeExecuteAction(token, userId);
      res.json({ success: true, result });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  } catch (error) {
    console.error('Confirm action error:', error);
    res.status(500).json({ error: 'Failed to confirm action' });
  }
});

/**
 * GET /api/morio/stream/:jobId
 * Server-Sent Events stream for job updates (partial results + final)
 * Authenticated users only (must own the job)
 */
router.get('/stream/:jobId', [authenticateToken], async (req: any, res: Response) => {
  const { jobId } = req.params;
  const requestingUserId = req.user?.id;

  if (!jobId) return res.status(400).send('Missing jobId');

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  let lastSeen: string | null = null;

  const interval = setInterval(async () => {
    if (closed) return clearInterval(interval);
    try {
      const jobResult = await jobQueueService.getJobResult(jobId);
      if (!jobResult) return;

      const payload = JSON.stringify(jobResult);
      if (payload === lastSeen) return;
      lastSeen = payload;

      res.write(`event: morio_job_update\n`);
      res.write(`data: ${payload}\n\n`);

      // If job is complete, close stream
      if (jobResult && jobResult.status === 'completed') {
        res.write(`event: morio_job_complete\n`);
        res.write(`data: ${JSON.stringify({ jobId, status: 'complete' })}\n\n`);
        clearInterval(interval);
        res.end();
      }
    } catch (e) {
      // send error event
      res.write(`event: morio_job_error\n`);
      res.write(`data: ${JSON.stringify({ error: 'stream_error', details: (e as Error).message })}\n\n`);
      clearInterval(interval);
      res.end();
    }
  }, 500);

});