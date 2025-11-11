
/**
 * Defender Agent API Routes
 */

import { Router } from 'express';
import { DefenderAgent } from '../agents/defender';
import { AgentBehavior } from '../agents/defender/types';

const router = Router();
const defender = new DefenderAgent('MTAA-001');

// Initialize defender on import
defender.initialize().catch(console.error);

// Get system status
router.get('/status', async (req, res) => {
  try {
    const status = defender.getSystemStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting defender status:', error);
    res.status(500).json({ error: 'Failed to get defender status' });
  }
});

// Analyze user behavior
router.post('/analyze', async (req, res) => {
  try {
    const behavior: AgentBehavior = {
      agentId: req.body.userId || req.body.agentId,
      timestamp: new Date(),
      actions: req.body.actions || [],
      resourceUsage: req.body.resourceUsage || {},
      communicationPatterns: req.body.communicationPatterns || {},
      anomalyIndicators: req.body.anomalyIndicators || {},
      trustScore: req.body.trustScore || 1.0,
      maliciousScore: req.body.maliciousScore || 0.0
    };

    const action = await defender.process(behavior);

    res.json({
      analyzed: true,
      action: action || null,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error analyzing behavior:', error);
    res.status(500).json({ error: 'Failed to analyze behavior' });
  }
});

// Get quarantine status
router.get('/quarantine', async (req, res) => {
  try {
    const status = defender.getSystemStatus();
    res.json(status.quarantineStatus);
  } catch (error) {
    console.error('Error getting quarantine status:', error);
    res.status(500).json({ error: 'Failed to get quarantine status' });
  }
});

// Report threat signal (from watcher)
router.post('/signal', async (req, res) => {
  try {
    defender.receiveWatcherSignal(req.body);
    res.json({ received: true });
  } catch (error) {
    console.error('Error processing signal:', error);
    res.status(500).json({ error: 'Failed to process signal' });
  }
});

// Submit analyzer report
router.post('/report', async (req, res) => {
  try {
    defender.receiveAnalyzerReport(req.body);
    res.json({ received: true });
  } catch (error) {
    console.error('Error processing report:', error);
    res.status(500).json({ error: 'Failed to process report' });
  }
});

export default router;
