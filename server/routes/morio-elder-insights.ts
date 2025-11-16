
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { eldKaizen } from '../core/elders/kaizen';
import { eldScry } from '../core/elders/scry';
import { eldLumen } from '../core/elders/lumen';

const router = Router();

router.get('/elder-insights', authenticateToken, async (req, res) => {
  try {
    const { userId, daoId } = req.query;
    const insights = [];

    // Get KAIZEN optimization insights
    if (daoId) {
      const kaizenMetrics = eldKaizen.getDAOMetrics(daoId as string);
      if (kaizenMetrics) {
        const opportunities = eldKaizen.getDAORecommendations(daoId as string);
        opportunities.opportunities.slice(0, 2).forEach(opp => {
          insights.push({
            elder: 'KAIZEN',
            type: 'optimization',
            severity: opp.impact === 'high' ? 'warning' : 'info',
            message: opp.description,
            actionable: true,
            timestamp: new Date().toISOString()
          });
        });
      }
    }

    // Get SCRY threat insights
    if (daoId) {
      const threats = eldScry.getDAOThreats(daoId as string);
      threats.slice(0, 2).forEach(threat => {
        insights.push({
          elder: 'SCRY',
          type: 'threat',
          severity: threat.severity === 'critical' ? 'critical' : 'warning',
          message: threat.type,
          actionable: true,
          timestamp: threat.timestamp.toISOString()
        });
      });
    }

    // Get LUMEN ethics insights
    const lumenStats = eldLumen.getEthicalStatistics(7);
    if (lumenStats.rejected > 0) {
      insights.push({
        elder: 'LUMEN',
        type: 'ethics',
        severity: 'info',
        message: `${lumenStats.rejected} proposals flagged for ethical review this week`,
        actionable: false,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      insights: insights.sort((a, b) => {
        const severityOrder = { critical: 3, warning: 2, info: 1 };
        return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      })
    });
  } catch (error) {
    console.error('Failed to fetch elder insights:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch insights' });
  }
});

export default router;
