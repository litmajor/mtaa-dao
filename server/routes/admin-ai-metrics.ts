
import { Router } from 'express';
import { nuru } from '../core/nuru';
import { kwetu } from '../core/kwetu';
import { morio } from '../agents/morio';

const router = Router();

/**
 * GET /api/admin/ai-metrics
 * Get comprehensive AI layer metrics for admin monitoring
 */
router.get('/ai-metrics', async (req, res) => {
  try {
    // Check admin permissions
    const userId = req.user?.claims?.id;
    if (!userId || req.user?.claims?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Gather NURU metrics
    const nuruHealth = await nuru.healthCheck();
    
    // Gather KWETU metrics
    const kwetuHealth = await kwetu.healthCheck();
    
    // Mock metrics (replace with actual data from your analytics system)
    const metrics = {
      nuru: {
        status: nuruHealth.status,
        intentClassificationAccuracy: 92,
        averageConfidence: 87,
        totalIntents: 15420,
        topIntents: [
          { intent: 'check_balance', count: 3200 },
          { intent: 'submit_proposal', count: 2100 },
          { intent: 'vote', count: 1800 },
          { intent: 'analytics', count: 1500 },
          { intent: 'help', count: 1200 }
        ],
        languageDistribution: [
          { language: 'en', percentage: 75 },
          { language: 'sw', percentage: 25 }
        ],
        analyticsRequests: 4200,
        riskAssessments: 890
      },
      kwetu: {
        status: kwetuHealth.status,
        treasuryOperations: 8500,
        governanceActions: 3200,
        communityEvents: 5600,
        responseTime: 145,
        errorRate: 0.02
      },
      morio: {
        status: 'active',
        totalSessions: 12340,
        activeSessions: 67,
        averageResponseTime: 180,
        messagesProcessed: 45600,
        userSatisfaction: 89,
        topQueries: [
          { query: 'What is my DAO balance?', count: 890 },
          { query: 'How do I create a proposal?', count: 650 },
          { query: 'Show me active proposals', count: 580 },
          { query: 'Help me vote', count: 420 },
          { query: 'Treasury analytics', count: 380 }
        ]
      }
    };

    res.json(metrics);
  } catch (error) {
    console.error('AI metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch AI metrics' });
  }
});

export default router;
