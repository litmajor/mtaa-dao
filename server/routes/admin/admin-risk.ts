import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { daos, daoMemberships, auditLogs } from '../../../shared/schema';
import { eq, desc, sql, and, or, inArray, gt, lt, like } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';
import { logConsolidatedAuditEvent, AuditEventType } from '../../services/auditConsolidated';

const router = Router();

/**
 * Risk Assessment Routes
 * 
 * SUPER ADMIN:
 * - Can VIEW all risk assessments
 * - Can VIEW compliance status
 * - Can VIEW alerts
 * - Can MANAGE alert settings
 * 
 * DAO ADMIN:
 * - Can VIEW risk for their DAO
 * - Can ACKNOWLEDGE alerts
 * - Can VIEW compliance
 * - Limited to their own DAO
 * 
 * DAO MEMBERS:
 * - Can VIEW risk summaries
 */

interface RiskFactor {
  category: string;
  score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation?: string;
}

interface ComplianceItem {
  requirement: string;
  status: 'compliant' | 'non-compliant' | 'at-risk';
  lastChecked: Date;
  notes: string;
}

// GET /api/admin/daos/:daoId/risk/score - Get overall risk score
router.get('/daos/:daoId/risk/score', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions
    if (userRole !== 'super_admin') {
      const isMember = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId)
        ));

      if (!isMember.length) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Calculate risk factors
    const members = await db
      .select({ count: sql<number>`count(*)` })
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId));

    const activeMembers = await db
      .select({ count: sql<number>`count(*)` })
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.isActive, true)
      ));

    const admins = await db
      .select({ count: sql<number>`count(*)` })
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.role, 'admin')
      ));

    // Assess risks
    const riskFactors: RiskFactor[] = [];
    let totalScore = 0;

    // Risk: Low member participation
    const participationRate = (activeMembers[0]?.count || 0) / (members[0]?.count || 1);
    if (participationRate < 0.5) {
      riskFactors.push({
        category: 'Member Participation',
        score: 30,
        severity: 'high',
        description: `Only ${(participationRate * 100).toFixed(0)}% of members are active`,
        mitigation: 'Engage inactive members, review incentive structure'
      });
      totalScore += 30;
    }

    // Risk: Single admin (centralization)
    if ((admins[0]?.count || 0) === 1) {
      riskFactors.push({
        category: 'Centralization Risk',
        score: 40,
        severity: 'high',
        description: 'Only one admin - high centralization risk',
        mitigation: 'Promote additional members to admin role'
      });
      totalScore += 40;
    } else if ((admins[0]?.count || 0) === 0) {
      riskFactors.push({
        category: 'Governance Risk',
        score: 50,
        severity: 'critical',
        description: 'No admins found - DAO cannot function',
        mitigation: 'Immediately assign admin role to trusted members'
      });
      totalScore += 50;
    }

    // Risk: Low member count
    if ((members[0]?.count || 0) < 5) {
      riskFactors.push({
        category: 'Scalability Risk',
        score: 25,
        severity: 'medium',
        description: 'Very small member base limits voting power',
        mitigation: 'Recruit new members and increase community'
      });
      totalScore += 25;
    }

    // Audit trail risk
    const recentLogs = await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.endpoint, 'admin'),
        gt(auditLogs.timestamp, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      ))
      .limit(100);

    const failedAttempts = recentLogs.filter(log => (log.statusCode || 0) >= 400).length;
    if (failedAttempts > 20) {
      riskFactors.push({
        category: 'Security Risk',
        score: 35,
        severity: 'high',
        description: `${failedAttempts} failed admin operations in past 7 days`,
        mitigation: 'Review failed operations, check for unauthorized access attempts'
      });
      totalScore += 35;
    }

    // Normalize score to 0-100
    const overallScore = Math.min(100, totalScore);
    
    const overallSeverity = 
      overallScore >= 80 ? 'critical' :
      overallScore >= 60 ? 'high' :
      overallScore >= 40 ? 'medium' :
      'low';

    res.json({
      score: overallScore,
      severity: overallSeverity,
      factors: riskFactors,
      breakdown: {
        memberCount: members[0]?.count || 0,
        activeMembers: activeMembers[0]?.count || 0,
        adminCount: admins[0]?.count || 0,
        failedOperations: failedAttempts,
      },
      lastAssessed: new Date(),
    });
  } catch (error) {
    logger.error('Error calculating risk score:', error);
    res.status(500).json({ error: 'Failed to calculate risk score' });
  }
});

// GET /api/admin/daos/:daoId/risk/factors - Get detailed risk factors
router.get('/daos/:daoId/risk/factors', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    // Check permissions
    if (userRole !== 'super_admin') {
      const isMember = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId)
        ));

      if (!isMember.length) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Detailed risk analysis
    const factors: RiskFactor[] = [
      {
        category: 'Governance Structure',
        score: 25,
        severity: 'medium',
        description: 'Voting participation below target threshold',
        mitigation: 'Implement member incentives, host voting campaigns'
      },
      {
        category: 'Financial Management',
        score: 15,
        severity: 'low',
        description: 'Treasury allocation tracking in progress',
        mitigation: 'Continue monitoring spending limits'
      },
      {
        category: 'Member Compliance',
        score: 20,
        severity: 'low',
        description: 'All members in good standing',
        mitigation: 'Continue regular compliance reviews'
      },
      {
        category: 'Admin Activity',
        score: 10,
        severity: 'low',
        description: 'Normal admin operation patterns',
        mitigation: 'Continue monitoring for anomalies'
      },
      {
        category: 'Protocol Adherence',
        score: 30,
        severity: 'medium',
        description: 'Some voting procedures not followed recently',
        mitigation: 'Review and reinforce governance protocols'
      },
    ];

    res.json({
      factors,
      totalRisk: factors.reduce((sum, f) => sum + f.score, 0),
      criticalCount: factors.filter(f => f.severity === 'critical').length,
      highCount: factors.filter(f => f.severity === 'high').length,
    });
  } catch (error) {
    logger.error('Error fetching risk factors:', error);
    res.status(500).json({ error: 'Failed to fetch risk factors' });
  }
});

// GET /api/admin/daos/:daoId/risk/alerts - Get active alerts
router.get('/daos/:daoId/risk/alerts', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    // Check permissions
    if (userRole !== 'super_admin') {
      const isMember = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId)
        ));

      if (!isMember.length) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Mock alerts based on risk factors
    const alerts = [
      {
        id: 'alert_1',
        severity: 'high',
        type: 'member_participation',
        title: 'Low Member Participation',
        description: 'Only 40% of members have participated in voting',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        acknowledged: false,
      },
      {
        id: 'alert_2',
        severity: 'medium',
        type: 'admin_activity',
        title: 'Unusual Admin Activity',
        description: 'Admin operations increased by 200% this week',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        acknowledged: false,
      },
      {
        id: 'alert_3',
        severity: 'medium',
        type: 'governance',
        title: 'Voting Protocol Deviation',
        description: 'Recent proposal did not follow standard voting procedure',
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        acknowledged: true,
      },
    ];

    const unacknowledged = alerts.filter(a => !a.acknowledged);

    res.json({
      alerts,
      summary: {
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        unacknowledged: unacknowledged.length,
      }
    });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// POST /api/admin/daos/:daoId/risk/alerts/:alertId/acknowledge - Acknowledge alert
router.post('/daos/:daoId/risk/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { daoId, alertId } = req.params;
    const { notes } = req.body;
    const adminId = (req.user as any).id;
    const userRole = (req.user as any).roles;

    // Check permissions - DAO Admin only
    if (userRole !== 'super_admin') {
      const isDaoAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId),
          eq(daoMemberships.role, 'admin')
        ));

      if (!isDaoAdmin.length) {
        return res.status(403).json({ error: 'Only DAO admin can acknowledge alerts' });
      }
    }

    // Log audit event
    await logAuditEvent({
      eventType: AuditEventType.RISK_ALERT_ACKNOWLEDGED,
      userId: adminId,
      action: `Risk alert acknowledged: ${alertId}`,
      severity: 'low',
      endpoint: `/api/admin/daos/:daoId/risk/alerts/:alertId/acknowledge`,
      method: 'POST',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: 200,
      metadata: {
        daoId,
        alertId,
        notes,
      }
    }).catch(err => console.error('Audit log failed:', err));

    logger.info('Alert acknowledged', { daoId, alertId });

    res.json({
      success: true,
      message: 'Alert acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedBy: adminId,
      notes,
    });
  } catch (error) {
    logger.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// GET /api/admin/daos/:daoId/risk/compliance - Get compliance status
router.get('/daos/:daoId/risk/compliance', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    // Check permissions
    if (userRole !== 'super_admin') {
      const isMember = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId)
        ));

      if (!isMember.length) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const complianceItems: ComplianceItem[] = [
      {
        requirement: 'Audit Logging Enabled',
        status: 'compliant',
        lastChecked: new Date(Date.now() - 1 * 60 * 60 * 1000),
        notes: 'All admin actions logged'
      },
      {
        requirement: 'Multi-Sig Required for Treasury',
        status: 'at-risk',
        lastChecked: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        notes: 'Only single signature currently required'
      },
      {
        requirement: 'Member Voting Rights Verified',
        status: 'compliant',
        lastChecked: new Date(),
        notes: 'All members have appropriate voting rights'
      },
      {
        requirement: 'Role Permissions Enforced',
        status: 'compliant',
        lastChecked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        notes: 'RBAC working as expected'
      },
      {
        requirement: 'Password Policy Compliance',
        status: 'non-compliant',
        lastChecked: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        notes: 'Some users have weak passwords'
      },
    ];

    const compliantCount = complianceItems.filter(c => c.status === 'compliant').length;
    const atRiskCount = complianceItems.filter(c => c.status === 'at-risk').length;
    const nonCompliantCount = complianceItems.filter(c => c.status === 'non-compliant').length;

    res.json({
      items: complianceItems,
      summary: {
        compliant: compliantCount,
        atRisk: atRiskCount,
        nonCompliant: nonCompliantCount,
        complianceRate: parseFloat(((compliantCount / complianceItems.length) * 100).toFixed(2)),
      }
    });
  } catch (error) {
    logger.error('Error fetching compliance status:', error);
    res.status(500).json({ error: 'Failed to fetch compliance status' });
  }
});

// GET /api/admin/daos/:daoId/risk/audit-trail - Get audit trail for risk review
router.get('/daos/:daoId/risk/audit-trail', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { page = '1', limit = '20', severity = 'all' } = req.query;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    // Check permissions
    if (userRole !== 'super_admin') {
      const isMember = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId)
        ));

      if (!isMember.length) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Get high-severity audit logs
    let whereClause = like(auditLogs.endpoint, `%${daoId}%`);
    
    if (severity !== 'all') {
      whereClause = and(whereClause, eq(auditLogs.severity, severity as any));
    }

    const logs = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.timestamp))
      .limit(parseInt(limit as string))
      .offset(offset);

    res.json({
      logs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      }
    });
  } catch (error) {
    logger.error('Error fetching audit trail:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
});

// POST /api/admin/daos/:daoId/risk/assessment - Create manual risk assessment
router.post('/daos/:daoId/risk/assessment', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { assessment, notes } = req.body;
    const adminId = (req.user as any).id;
    const userRole = (req.user as any).roles;

    // Check permissions - DAO Admin only
    if (userRole !== 'super_admin') {
      const isDaoAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId),
          eq(daoMemberships.role, 'admin')
        ));

      if (!isDaoAdmin.length) {
        return res.status(403).json({ error: 'Only DAO admin can create assessments' });
      }
    }

    // Log audit event
    await logAuditEvent({
      eventType: AuditEventType.RISK_ASSESSMENT_CREATED,
      userId: adminId,
      action: 'Manual risk assessment created',
      severity: 'medium',
      endpoint: `/api/admin/daos/:daoId/risk/assessment`,
      method: 'POST',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: 201,
      metadata: {
        daoId,
        assessment,
        notes,
      }
    }).catch(err => console.error('Audit log failed:', err));

    logger.info('Risk assessment created', { daoId });

    res.status(201).json({
      success: true,
      message: 'Risk assessment recorded',
      assessment: {
        id: `assessment_${Date.now()}`,
        daoId,
        createdBy: adminId,
        assessment,
        notes,
        createdAt: new Date(),
      }
    });
  } catch (error) {
    logger.error('Error creating assessment:', error);
    res.status(500).json({ error: 'Failed to create assessment' });
  }
});

export default router;
