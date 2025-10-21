/**
 * Morio AI Assistant API Routes
 * 
 * Endpoints for interacting with the Morio conversational assistant
 */

import { Router } from 'express';
import { morio } from '../agents/morio';
import { nuru } from '../core/nuru';

const router = Router();

/**
 * POST /api/morio/chat
 * Send message to Morio assistant
 */
router.post('/chat', async (req, res) => {
  try {
    const { userId, daoId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({
        error: 'userId and message are required'
      });
    }

    const response = await morio.handleMessage({
      userId,
      daoId,
      content: message,
      timestamp: new Date()
    });

    return res.json(response);
  } catch (error) {
    console.error('Morio chat error:', error);
    return res.status(500).json({
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

    return res.json(session);
  } catch (error) {
    console.error('Session fetch error:', error);
    return res.status(500).json({
      error: 'Failed to fetch session'
    });
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

    return res.json({ success: true });
  } catch (error) {
    console.error('Session clear error:', error);
    return res.status(500).json({
      error: 'Failed to clear session'
    });
  }
});

/**
 * POST /api/morio/analyze
 * Get analytical insights from Nuru
 */
router.post('/analyze', async (req, res) => {
  try {
    const { type, daoId, timeframe } = req.body;

    if (!type || !daoId) {
      return res.status(400).json({
        error: 'type and daoId are required'
      });
    }

    const analysis = await nuru.analyze({
      type,
      daoId,
      timeframe
    });

    return res.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      error: 'Failed to perform analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/morio/assess-risk
 * Assess risk for a proposal
 */
router.post('/assess-risk', async (req, res) => {
  try {
    const { proposalId, daoId } = req.body;

    if (!proposalId || !daoId) {
      return res.status(400).json({
        error: 'proposalId and daoId are required'
      });
    }

    const assessment = await nuru.assessRisk(proposalId, daoId);

    return res.json(assessment);
  } catch (error) {
    console.error('Risk assessment error:', error);
    return res.status(500).json({
      error: 'Failed to assess risk',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/morio/health
 * Health check for Morio system
 */
router.get('/health', async (req, res) => {
  try {
    const health = await nuru.healthCheck();

    return res.json({
      ...health,
      morio: {
        status: 'healthy',
        activeSessions: 'N/A' // Can be tracked if needed
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
