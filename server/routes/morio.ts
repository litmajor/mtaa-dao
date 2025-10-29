/**
 * Morio AI Assistant API Routes
 * 
 * Endpoints for interacting with the Morio conversational assistant
 */

import { Router } from 'express';
import { morio } from '../agents/morio';
import { nuru } from '../core/nuru';
import type { ChatMessage } from '../agents/morio/types';

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

export default router;