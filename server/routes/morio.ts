/**
 * Morio AI Assistant API Routes
 *
 * Endpoints for interacting with the Morio conversational assistant
 *
 * FIXES APPLIED:
 * 1. /chat now checks DAO membership before queuing, matching /analyze and
 *    /assess-risk. Previously /chat accepted an arbitrary daoId with no
 *    membership check at all, while the other two both verify it — this
 *    was a real IDOR gap if the chat agent uses daoId to pull DAO-scoped
 *    context.
 * 2. /stream/:jobId now verifies the requesting user actually owns the job
 *    before streaming its output. The route's own comment claimed "must
 *    own the job" but never checked it — any authenticated user who had a
 *    jobId could stream someone else's job results.
 * 3. export default router moved to the end of the file. Registering
 *    routes after the export statement happened to work because `router`
 *    is a shared object reference evaluated before any importer uses it,
 *    but it's a landmine for future refactors — moved for clarity.
 * 4. /user-context's feature-gating loop now runs in parallel via
 *    Promise.all instead of sequentially awaiting 11 checks one at a time.
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
import morioDataHubRoutes from './morio-data-hub';
import morioElderInsightsRoutes from './morio-elder-insights';

const router = Router();

/**
 * Shared DAO-membership check used by /chat, /analyze, /assess-risk.
 */
async function userHasDaoAccess(userId: string, daoId: string): Promise<boolean> {
  const membership = await db
    .select()
    .from(daoMemberships)
    .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, userId)))
    .limit(1);
  return membership.length > 0;
}

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

    // FIX #1: /analyze and /assess-risk both verify DAO membership before
    // queuing a job that carries daoId context — /chat was the odd one out.
    if (daoId) {
      const hasAccess = await userHasDaoAccess(userId, daoId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'User does not have access to this DAO',
          daoId
        });
      }
    }

    const jobId = await jobQueueService.queueJob('morio-chat', {
      userId,
      daoId: daoId || '',
      message,
      timestamp: new Date()
    }, {
      priority: 7,
      timeout: 60000
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

    const hasAccess = await userHasDaoAccess(userId, daoId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'User does not have access to analyze this DAO',
        daoId
      });
    }

    const jobId = await jobQueueService.queueJob('morio-analyze', {
      userId,
      daoId,
      analysisType: type,
      timeframe
    }, {
      priority: 6,
      timeout: 120000
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

    const hasAccess = await userHasDaoAccess(userId, daoId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'User does not have access to assess risk for this DAO',
        daoId
      });
    }

    const jobId = await jobQueueService.queueJob('morio-analyze', {
      userId,
      daoId,
      proposalId,
      analysisType: 'risk-assessment'
    }, {
      priority: 6,
      timeout: 120000
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
 * GET /api/morio/user-context
 * Get user's personalized context for Morio
 */
router.get('/user-context', [authenticateToken], async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId)
    }) as User;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const persona = await getUserPersona(userId);

    const userDaoMemberships = await db
      .select({
        daoId: daoMemberships.daoId,
        role: daoMemberships.role,
        joinedAt: daoMemberships.joinedAt,
      })
      .from(daoMemberships)
      .where(eq(daoMemberships.userId, userId));

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

    // FIX #4: run gating checks in parallel instead of one at a time.
    const gatingResults = await Promise.all(
      features.map(async (feature) => [feature, await checkFeatureGating(feature, user)] as const)
    );

    const gatingStatuses: Record<string, any> = {};
    for (const [feature, status] of gatingResults) {
      gatingStatuses[feature] = {
        isAvailable: status.isAvailable,
        reason: status.reason,
        daysUntilAvailable: status.daysUntilAvailable,
        amountNeeded: status.amountNeeded,
        currency: status.currency
      };
    }

    const lockedFeatures = Object.entries(gatingStatuses)
      .filter(([, status]: any) => !status.isAvailable)
      .map(([feature]) => feature);

    const availableFeatures = Object.entries(gatingStatuses)
      .filter(([, status]: any) => status.isAvailable)
      .map(([feature]) => feature);

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
        // NOTE: Advanced Mode is a per-user toggle (see advancedModeGuard).
        // Use the user-level flag rather than superuser role.
        advancedMode: user.advancedMode || false
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

  // FIX #2 (updated): the earlier version of this check read
  // initialResult?.userId, which doesn't exist anywhere on JobResult
  // ({status, result, error, progress, startedAt, completedAt}) — that
  // check was silently a no-op. jobQueueService now tracks ownership
  // separately via getJobOwner(); use that instead.
  try {
    const ownerId = await jobQueueService.getJobOwner(jobId);
    if (ownerId && ownerId !== requestingUserId) {
      return res.status(403).json({ error: 'Forbidden: you do not own this job' });
    }
    if (!ownerId) {
      // No ownership record at all — either the job never existed, or it
      // was queued before ownership tracking existed / without a userId.
      // Fail closed rather than silently allowing an unverifiable stream.
      const exists = await jobQueueService.getJobResult(jobId);
      if (!exists) {
        return res.status(404).json({ error: 'Job not found' });
      }
      return res.status(403).json({ error: 'Forbidden: job ownership could not be verified' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Failed to verify job ownership' });
  }

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

      if (jobResult && jobResult.status === 'completed') {
        res.write(`event: morio_job_complete\n`);
        res.write(`data: ${JSON.stringify({ jobId, status: 'complete' })}\n\n`);
        clearInterval(interval);
        res.end();
      }
    } catch (e) {
      res.write(`event: morio_job_error\n`);
      res.write(`data: ${JSON.stringify({ error: 'stream_error', details: (e as Error).message })}\n\n`);
      clearInterval(interval);
      res.end();
    }
  }, 500);
});

// Mount Morio sub-routers at proper nested paths
router.use('/data-hub', morioDataHubRoutes);
router.use('/elder-insights', morioElderInsightsRoutes);

// FIX #3: export moved to the very end, after every route is registered.
export default router;