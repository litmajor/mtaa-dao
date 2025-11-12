/**
 * Elder API Routes
 * 
 * Exposes ELD-KAIZEN metrics and recommendations
 * - Superuser endpoints: Full access to all DAOs
 * - DAO member endpoints: Access to their own DAO data
 */

import { Router, Request, Response } from 'express';
import { eldKaizen } from '../core/elders/kaizen';
import { eldLumen } from '../core/elders/lumen';
import { authenticateToken, isSuperUser, isDaoMember } from '../middleware/auth';

const router = Router();

/**
 * SUPERUSER ENDPOINTS - Full system visibility
 */

/**
 * GET /api/elders/kaizen/dashboard
 * Get superuser dashboard with all DAOs
 */
router.get('/kaizen/dashboard', authenticateToken, isSuperUser, (req: Request, res: Response) => {
  try {
    const status = eldKaizen.getStatus();
    
    // Convert Map to array for JSON serialization
    const daoMetrics = Array.from(status.daoMetrics.entries()).map(([daoId, metrics]) => ({
      daoId,
      metrics,
      recommendations: status.recommendations.get(daoId)
    }));

    res.json({
      success: true,
      elderName: 'ELD-KAIZEN',
      status: status.status,
      lastAnalysis: status.lastAnalysis,
      daos: daoMetrics,
      improvements: status.improvements,
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
 * GET /api/elders/kaizen/all-metrics
 * Get all performance metrics across all DAOs
 */
router.get('/kaizen/all-metrics', authenticateToken, isSuperUser, (req: Request, res: Response) => {
  try {
    const status = eldKaizen.getStatus();
    const metrics = Array.from(status.daoMetrics.entries()).map(([daoId, m]) => ({
      daoId,
      scores: m.scores,
      treasury: {
        balance: m.treasury.balance,
        burnRate: m.treasury.burnRate,
        runway: m.treasury.runway,
        growthRate: m.treasury.growthRate
      },
      governance: {
        participationRate: m.governance.participationRate,
        proposalSuccessRate: m.governance.proposalSuccessRate,
        quorumMet: m.governance.quorumMet
      },
      community: {
        activeMembers: m.community.activeMembers,
        engagementScore: m.community.engagementScore,
        retentionRate: m.community.retentionRate
      },
      timestamp: m.timestamp
    }));

    res.json({
      success: true,
      count: metrics.length,
      metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/elders/kaizen/all-recommendations
 * Get all optimization recommendations across all DAOs
 */
router.get('/kaizen/all-recommendations', authenticateToken, isSuperUser, (req: Request, res: Response) => {
  try {
    const status = eldKaizen.getStatus();
    const recommendations = Array.from(status.recommendations.entries()).map(([daoId, rec]) => ({
      daoId,
      timestamp: rec.timestamp,
      topOpportunities: rec.priorityRanking.slice(0, 5),
      estimatedOverallImpact: rec.estimatedOverallImpact,
      confidenceScore: rec.confidenceScore,
      projections: {
        weekly: rec.weeklyProjection,
        monthly: rec.monthlyProjection
      }
    }));

    res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/elders/kaizen/trends/:metric
 * Get metric trends over time (superuser - all DAOs)
 */
router.get('/kaizen/trends/:metric', authenticateToken, isSuperUser, (req: Request, res: Response) => {
  try {
    const { metric } = req.params;
    const { hours = 24 } = req.query;

    const trend = eldKaizen.getMetricTrends(metric, Number(hours));

    res.json({
      success: true,
      metric,
      hours: Number(hours),
      dataPoints: trend.length,
      trend
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/elders/kaizen/anomalies/:metric
 * Get anomalies in a metric (superuser - all DAOs)
 */
router.get('/kaizen/anomalies/:metric', authenticateToken, isSuperUser, (req: Request, res: Response) => {
  try {
    const { metric } = req.params;
    const { threshold = 20 } = req.query;

    const anomalies = eldKaizen.getAnomalies(metric, Number(threshold));

    res.json({
      success: true,
      metric,
      threshold: Number(threshold),
      anomalies: anomalies.map(a => ({
        timestamp: a.timestamp,
        value: a.value
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * DAO MEMBER ENDPOINTS - Scoped access
 */

/**
 * GET /api/elders/kaizen/dao/:daoId/metrics
 * Get performance metrics for a specific DAO (DAO members only)
 */
router.get('/kaizen/dao/:daoId/metrics', authenticateToken, isDaoMember, (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = (req as any).user.id;

    // Check if user is member of this DAO
    if (!(req as any).user.daos.includes(daoId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Not a member of this DAO'
      });
    }

    const metrics = eldKaizen.getDAOMetrics(daoId);

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'No metrics found for this DAO'
      });
    }

    res.json({
      success: true,
      daoId,
      metrics: {
        timestamp: metrics.timestamp,
        scores: metrics.scores,
        treasury: {
          balance: metrics.treasury.balance,
          burnRate: metrics.treasury.burnRate,
          runway: metrics.treasury.runway,
          growthRate: metrics.treasury.growthRate,
          healthScore: metrics.treasury.healthScore
        },
        governance: {
          participationRate: metrics.governance.participationRate,
          proposalSuccessRate: metrics.governance.proposalSuccessRate,
          quorumMet: metrics.governance.quorumMet,
          governanceHealth: metrics.governance.governanceHealth
        },
        community: {
          activeMembers: metrics.community.activeMembers,
          engagementScore: metrics.community.engagementScore,
          retentionRate: metrics.community.retentionRate,
          communityHealth: metrics.community.communityHealth
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/elders/kaizen/dao/:daoId/recommendations
 * Get optimization recommendations for a specific DAO (DAO members only)
 */
router.get('/kaizen/dao/:daoId/recommendations', authenticateToken, isDaoMember, (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;

    // Check if user is member of this DAO
    if (!(req as any).user.daos.includes(daoId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Not a member of this DAO'
      });
    }

    const recommendations = eldKaizen.getDAORecommendations(daoId);

    if (!recommendations) {
      return res.status(404).json({
        success: false,
        error: 'No recommendations found for this DAO'
      });
    }

    res.json({
      success: true,
      daoId,
      timestamp: recommendations.timestamp,
      topOpportunities: recommendations.priorityRanking.slice(0, 5),
      allOpportunities: recommendations.opportunities,
      estimatedOverallImpact: recommendations.estimatedOverallImpact,
      confidenceScore: recommendations.confidenceScore,
      projections: {
        weekly: recommendations.weeklyProjection,
        monthly: recommendations.monthlyProjection
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/elders/kaizen/dao/:daoId/opportunities/:category
 * Get opportunities by category for a specific DAO
 */
router.get(
  '/kaizen/dao/:daoId/opportunities/:category',
  authenticateToken,
  isDaoMember,
  (req: Request, res: Response) => {
    try {
      const { daoId, category } = req.params;

      // Check if user is member of this DAO
      if (!(req as any).user.daos.includes(daoId)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Not a member of this DAO'
        });
      }

      const recommendations = eldKaizen.getDAORecommendations(daoId);

      if (!recommendations) {
        return res.status(404).json({
          success: false,
          error: 'No recommendations found for this DAO'
        });
      }

      const filtered = recommendations.opportunities.filter(
        opp => opp.category === category
      );

      res.json({
        success: true,
        daoId,
        category,
        opportunities: filtered,
        count: filtered.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }
);

/**
 * GET /api/elders/kaizen/dao/:daoId/status
 * Get current status for a specific DAO
 */
router.get('/kaizen/dao/:daoId/status', authenticateToken, isDaoMember, (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;

    // Check if user is member of this DAO
    if (!(req as any).user.daos.includes(daoId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Not a member of this DAO'
      });
    }

    const metrics = eldKaizen.getDAOMetrics(daoId);
    const recommendations = eldKaizen.getDAORecommendations(daoId);

    res.json({
      success: true,
      daoId,
      healthStatus: {
        overall: metrics?.scores.overall || 0,
        treasury: metrics?.scores.treasury || 0,
        governance: metrics?.scores.governance || 0,
        community: metrics?.scores.community || 0,
        system: metrics?.scores.system || 0
      },
      criticalIssues: recommendations?.opportunities.filter(o => o.severity === 'critical').length || 0,
      lastAnalysis: metrics?.timestamp || null,
      topRecommendation: recommendations?.priorityRanking[0] || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * SCRY ENDPOINTS - Watcher Elder for Threat Detection
 */

/**
 * GET /api/elders/scry/health
 * Public health check for ELD-SCRY
 */
router.get('/scry/health', (req: Request, res: Response) => {
  try {
    const { eldScry } = require('../core/elders/scry');
    const status = eldScry.getStatus();

    res.json({
      success: true,
      elderName: 'ELD-SCRY',
      status: status.status,
      active: !!status.analysisInterval,
      monitoredDAOs: status.threatStats.activeMonitoredDAOs,
      threatsDetected: status.threatStats.totalThreatsDetected,
      lastAnalysis: status.lastAnalysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/elders/scry/dashboard
 * Get superuser dashboard - all DAOs threat overview
 */
router.get('/scry/dashboard', authenticateToken, isSuperUser, (req: Request, res: Response) => {
  try {
    const { eldScry } = require('../core/elders/scry');
    const status = eldScry.getStatus();

    // Convert Map to array for JSON serialization
    const daoMetrics = Array.from(status.daoMetrics.entries()).map(([daoId, metrics]) => ({
      daoId,
      threats: metrics.detectedPatterns.length,
      riskLevel: metrics.riskLevel,
      healthTrend: metrics.healthTrend,
      latestPatterns: metrics.detectedPatterns.slice(-5),
      lastUpdated: metrics.lastUpdated
    }));

    res.json({
      success: true,
      elderName: 'ELD-SCRY',
      status: status.status,
      threatStats: status.threatStats,
      daos: daoMetrics,
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
 * GET /api/elders/scry/dao/:daoId/threats
 * Get detected threats for a specific DAO
 */
router.get('/scry/dao/:daoId/threats', authenticateToken, isDaoMember, (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;

    // Check if user is member of this DAO
    if (!(req as any).user.daos.includes(daoId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Not a member of this DAO'
      });
    }

    const { eldScry } = require('../core/elders/scry');
    const threats = eldScry.getDAOThreats(daoId);

    res.json({
      success: true,
      daoId,
      threatCount: threats.length,
      criticalCount: threats.filter((t: any) => t.severity === 'critical').length,
      highCount: threats.filter((t: any) => t.severity === 'high').length,
      threats: threats.map((t: any) => ({
        patternId: t.patternId,
        type: t.type,
        severity: t.severity,
        confidence: t.confidence,
        affectedEntities: t.affectedEntities,
        timestamp: t.timestamp
      })),
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
 * GET /api/elders/scry/dao/:daoId/forecast
 * Get health forecast for a DAO
 */
router.get('/scry/dao/:daoId/forecast', authenticateToken, isDaoMember, (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;

    // Check if user is member of this DAO
    if (!(req as any).user.daos.includes(daoId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Not a member of this DAO'
      });
    }

    const { eldScry } = require('../core/elders/scry');
    const forecast = eldScry.getDAOForecast(daoId);

    if (!forecast) {
      return res.status(404).json({
        success: false,
        error: 'No forecast available for this DAO'
      });
    }

    res.json({
      success: true,
      daoId,
      forecast: {
        timeframeHours: forecast.timeframeHours,
        predictedScore: forecast.predictedScore,
        confidence: forecast.confidence,
        riskFactors: forecast.riskFactors,
        earlyWarnings: forecast.earlyWarnings,
        interventionRecommendations: forecast.interventionRecommendations
      },
      timestamp: forecast.timestamp
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/elders/scry/dao/:daoId/suspicion/:userId
 * Get suspicion score for a user in a DAO
 */
router.get('/scry/dao/:daoId/suspicion/:userId', authenticateToken, isDaoMember, (req: Request, res: Response) => {
  try {
    const { daoId, userId } = req.params;

    // Check if user is member of this DAO
    if (!(req as any).user.daos.includes(daoId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Not a member of this DAO'
      });
    }

    const { eldScry } = require('../core/elders/scry');
    const suspicionScore = eldScry.getSuspicionScore(userId);

    res.json({
      success: true,
      daoId,
      userId,
      suspicionScore: suspicionScore,
      riskLevel: suspicionScore > 0.7 ? 'high' : suspicionScore > 0.4 ? 'medium' : 'low',
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
 * GET /api/elders/scry/threat-signatures
 * Get all learned threat signatures (superuser only)
 */
router.get('/scry/threat-signatures', authenticateToken, isSuperUser, (req: Request, res: Response) => {
  try {
    const { eldScry } = require('../core/elders/scry');
    const signatures = eldScry.getThreatSignatures();

    res.json({
      success: true,
      totalSignatures: signatures.length,
      signatures: signatures.map((sig: any) => ({
        threatLevel: sig.threatLevel,
        firstSeen: sig.firstSeen,
        lastSeen: sig.lastSeen,
        occurrenceCount: sig.occurrenceCount,
        traitCount: sig.learnedTraits.size
      })),
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
 * ================== ELD-LUMEN ENDPOINTS ==================
 * Ethics Elder - Ethical review and governance oversight
 */

/**
 * POST /api/elders/lumen/review
 * Request ethical review of a decision (superuser only)
 */
router.post('/lumen/review', authenticateToken, isSuperUser, async (req: Request, res: Response) => {
  try {
    const { decisionType, proposedAction, affectedParties, potentialHarms, potentialBenefits, justification, urgency, metadata } = req.body;

    const decision = {
      id: `ETH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      decisionType,
      proposedAction,
      affectedParties: affectedParties || [],
      potentialHarms: potentialHarms || [],
      potentialBenefits: potentialBenefits || [],
      justification,
      urgency: urgency || 'medium',
      metadata
    };

    const result = await eldLumen.conductEthicalReview(decision);

    res.json({
      success: true,
      reviewId: decision.id,
      approved: result.approved,
      concernLevel: result.concernLevel,
      principlesAffected: result.principlesAffected,
      concerns: result.concerns,
      recommendations: result.recommendations,
      confidenceScore: result.confidenceScore,
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
 * GET /api/elders/lumen/audit-log
 * Get ethical audit log (superuser only)
 */
router.get('/lumen/audit-log', authenticateToken, isSuperUser, (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const auditLog = eldLumen.getAuditLog(days);

    res.json({
      success: true,
      period: `${days} days`,
      totalRecords: auditLog.length,
      auditLog: auditLog.map(record => ({
        timestamp: record.timestamp,
        decisionId: record.decisionId,
        decisionType: record.decisionType,
        concernLevel: record.result.concernLevel,
        outcome: record.outcome,
        principlesAffected: record.result.principlesAffected,
        confidenceScore: record.result.confidenceScore
      })),
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
 * GET /api/elders/lumen/statistics
 * Get ethical review statistics (superuser only)
 */
router.get('/lumen/statistics', authenticateToken, isSuperUser, (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const stats = eldLumen.getEthicalStatistics(days);

    res.json({
      success: true,
      period: `${days} days`,
      stats: {
        totalReviewed: stats.totalReviewed,
        approved: stats.approved,
        rejected: stats.rejected,
        conditional: stats.conditional,
        approvalRate: stats.totalReviewed > 0 ? (stats.approved / stats.totalReviewed * 100).toFixed(2) + '%' : 'N/A',
        concernDistribution: stats.concernDistribution,
        averageConfidence: (stats.averageConfidence * 100).toFixed(2) + '%'
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
 * GET /api/elders/lumen/dashboard
 * Get ethics dashboard (superuser only)
 */
router.get('/lumen/dashboard', authenticateToken, isSuperUser, (req: Request, res: Response) => {
  try {
    const weekStats = eldLumen.getEthicalStatistics(7);
    const monthStats = eldLumen.getEthicalStatistics(30);

    res.json({
      success: true,
      elderName: 'ELD-LUMEN',
      status: 'active',
      thisWeek: {
        totalReviewed: weekStats.totalReviewed,
        approvalRate: weekStats.totalReviewed > 0 ? (weekStats.approved / weekStats.totalReviewed * 100).toFixed(1) : 0,
        concerns: Object.values(weekStats.concernDistribution).reduce((a, b) => a + b, 0) - weekStats.concernDistribution.green
      },
      thisMonth: {
        totalReviewed: monthStats.totalReviewed,
        approvalRate: monthStats.totalReviewed > 0 ? (monthStats.approved / monthStats.totalReviewed * 100).toFixed(1) : 0,
        concerns: Object.values(monthStats.concernDistribution).reduce((a, b) => a + b, 0) - monthStats.concernDistribution.green
      },
      concernTrend: monthStats.concernDistribution,
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
 * Health check endpoint
 */
router.get('/kaizen/health', (req: Request, res: Response) => {
  try {
    const status = eldKaizen.getStatus();
    res.json({
      success: true,
      elderName: 'ELD-KAIZEN',
      status: status.status,
      active: status.status !== 'idle' ? true : false,
      lastAnalysis: status.lastAnalysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/elders/lumen/health
 * Health check for ELD-LUMEN
 */
router.get('/lumen/health', (req: Request, res: Response) => {
  try {
    const stats = eldLumen.getEthicalStatistics(1);
    
    res.json({
      success: true,
      elderName: 'ELD-LUMEN',
      status: 'active',
      active: true,
      thisDay: {
        reviewsProcessed: stats.totalReviewed,
        approvalRate: stats.totalReviewed > 0 ? (stats.approved / stats.totalReviewed * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

export default router;
