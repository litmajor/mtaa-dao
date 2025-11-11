
/**
 * Synchronizer Agent API Routes
 */

import express from 'express';
import { isAuthenticated } from '../nextAuthMiddleware';
import { synchronizerAgent } from '../agents/synchronizer';
import { Logger } from '../utils/logger';

const router = express.Router();
const logger = new Logger('synchronizer-routes');

// Initialize agent
synchronizerAgent.initialize().catch(err => {
  logger.error('Failed to initialize synchronizer agent', err);
});

// Get agent status and metrics
router.get('/status', isAuthenticated, async (req, res) => {
  try {
    const status = synchronizerAgent.getStatus();
    const metrics = synchronizerAgent.getMetrics();
    const config = synchronizerAgent.getConfig();

    res.json({
      success: true,
      data: { status, metrics, config }
    });
  } catch (error: any) {
    logger.error('Error getting synchronizer status', error);
    res.status(500).json({ error: error.message });
  }
});

// Get state snapshots
router.get('/snapshots', isAuthenticated, async (req, res) => {
  try {
    const snapshots = synchronizerAgent.getStateSnapshots();
    res.json({
      success: true,
      data: snapshots
    });
  } catch (error: any) {
    logger.error('Error getting snapshots', error);
    res.status(500).json({ error: error.message });
  }
});

// Get commit history
router.get('/commits', isAuthenticated, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const commits = synchronizerAgent.getCommitHistory(limit);
    
    res.json({
      success: true,
      data: commits
    });
  } catch (error: any) {
    logger.error('Error getting commit history', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate heartbeat
router.post('/heartbeat', isAuthenticated, async (req, res) => {
  try {
    const beat = synchronizerAgent.generateBeat();
    res.json({
      success: true,
      data: beat
    });
  } catch (error: any) {
    logger.error('Error generating heartbeat', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync state
router.post('/sync', isAuthenticated, async (req, res) => {
  try {
    const { nodeId, state, vectorClock, version } = req.body;
    
    const result = await synchronizerAgent.process({
      nodeId,
      state,
      vectorClock,
      version
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error syncing state', error);
    res.status(500).json({ error: error.message });
  }
});

// Detect drift
router.get('/drift', isAuthenticated, async (req, res) => {
  try {
    const hasDrift = synchronizerAgent.detectDrift();
    res.json({
      success: true,
      data: { hasDrift }
    });
  } catch (error: any) {
    logger.error('Error detecting drift', error);
    res.status(500).json({ error: error.message });
  }
});

// Resolve drift
router.post('/resolve-drift', isAuthenticated, async (req, res) => {
  try {
    const resolvedState = await synchronizerAgent.resolveDrift();
    
    if (!resolvedState) {
      return res.json({
        success: true,
        message: 'No drift detected or resolution not needed'
      });
    }

    res.json({
      success: true,
      data: resolvedState
    });
  } catch (error: any) {
    logger.error('Error resolving drift', error);
    res.status(500).json({ error: error.message });
  }
});

// Rollback to checkpoint
router.post('/rollback/:checkpointId', isAuthenticated, async (req, res) => {
  try {
    const { checkpointId } = req.params;
    const success = await synchronizerAgent.rollbackToCheckpoint(checkpointId);
    
    res.json({
      success,
      message: success ? 'Rollback successful' : 'Rollback failed'
    });
  } catch (error: any) {
    logger.error('Error rolling back', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
