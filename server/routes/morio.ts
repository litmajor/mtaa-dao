/**
 * Morio AI Assistant API Routes
 * 
 * Endpoints for interacting with the Morio conversational assistant
 */

import { Router } from 'express';
import { morio } from '../agents/morio';
import { nuru } from '../core/nuru';
import { checkFeatureGating } from '../services/gatingService';
import { getUserPersona } from '../services/personaService';
import { db } from '../db';
import type { ChatMessage } from '../agents/morio/types';
import type { User } from '../../shared/schema';

const router = Router();

/**
 * POST /api/morio/chat
 * Handle chat messages from users
 */
router.post('/chat', async (req, res) => {
  try {
    const { userId, daoId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId and message' 
      });
    }

    const chatMessage: ChatMessage = {
      userId,
      daoId: daoId || '',
      content: message,
      timestamp: new Date()
    };

    const response = await morio.handleMessage(chatMessage);

    res.json(response);
  } catch (error) {
    console.error('Morio chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/morio/session/:userId
 * Get user session status
 */
router.get('/session/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const session = await morio.getSessionStatus(userId);
    res.json(session);
  } catch (error) {
    console.error('Session fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

/**
 * DELETE /api/morio/session/:userId
 * Clear user session
 */
router.delete('/session/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await morio.clearSession(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Session clear error:', error);
    res.status(500).json({ error: 'Failed to clear session' });
  }
});

/**
 * POST /api/morio/analyze
 * Request analytics from Nuru
 */
router.post('/analyze', async (req, res) => {
  try {
    const { type, daoId, timeframe } = req.body;

    if (!type || !daoId) {
      return res.status(400).json({ 
        error: 'Missing required fields: type and daoId' 
      });
    }

    const analysis = await nuru.analyze({ type, daoId, timeframe });
    res.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to perform analysis' });
  }
});

/**
 * POST /api/morio/assess-risk
 * Request risk assessment from Nuru
 */
router.post('/assess-risk', async (req, res) => {
  try {
    const { proposalId, daoId } = req.body;

    if (!proposalId || !daoId) {
      return res.status(400).json({ 
        error: 'Missing required fields: proposalId and daoId' 
      });
    }

    const riskAssessment = await nuru.assessRisk(proposalId, daoId);
    res.json(riskAssessment);
  } catch (error) {
    console.error('Risk assessment error:', error);
    res.status(500).json({ error: 'Failed to assess risk' });
  }
});

/**
 * GET /api/morio/health
 * Health check for Morio system
 */
router.get('/health', async (req, res) => {
  try {
    const nuruHealth = await nuru.healthCheck();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        morio: 'active',
        nuru: nuruHealth.status,
        kwetu: 'active'
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/morio/user-context
 * Get user's gating and persona context for Morio
 * Used by Morio to provide personalized guidance about feature access
 */
router.get('/user-context', async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
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
      'dao.join'
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

    // Find locked features
    const lockedFeatures = Object.entries(gatingStatuses)
      .filter(([, status]: any) => !status.isAvailable)
      .map(([feature]) => feature);

    const availableFeatures = Object.entries(gatingStatuses)
      .filter(([, status]: any) => status.isAvailable)
      .map(([feature]) => feature);

    res.json({
      userId,
      persona,
      accountAge: user.joinedAt ? Math.floor((Date.now() - user.joinedAt.getTime()) / (1000 * 60 * 60 * 24)) : 0,
      balance: user.mtaaTokenBalance ? Number(user.mtaaTokenBalance) : 0,
      balanceCurrency: 'KES',
      preferredCurrency: user.preferredCurrency || 'USD',
      reputation: user.reputationScore ? Number(user.reputationScore) : 0,
      advancedMode: user.isSuperUser || false, // Use isSuperUser for advanced mode
      availableFeatures,
      lockedFeatures,
      gatingStatus: gatingStatuses,
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

export default router;