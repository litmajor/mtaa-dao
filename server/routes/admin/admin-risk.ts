import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { daos, daoMemberships, auditLogs } from '../../../shared/schema';
import { eq, desc, sql, and, or, gt, like, ilike } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';
import { logConsolidatedAuditEvent, AuditEventType } from '../../services/auditConsolidated';
import crypto from 'crypto';

const router = Router();
const requireRiskAdmin = requireRole('admin', 'super_admin');
router.use(requireRiskAdmin);

function getActorId(req: Request): string | null {
  return req.user?.userId || req.user?.claims?.sub || req.user?.id || null;
}

async function requireDaoAdminScope(req: Request, res: Response, next: () => void) {
  const actorId = getActorId(req);
  const { daoId } = req.params;
  if (!actorId) return res.status(401).json({ error: 'Authentication required' });
  const dao = await db.select({ id: daos.id }).from(daos).where(eq(daos.id, daoId)).limit(1);
  if (!dao.length) return res.status(404).json({ error: 'DAO not found' });
  if (req.userRole === 'super_admin') return next();
  const membership = await db.select({ id: daoMemberships.id }).from(daoMemberships).where(and(
    eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, actorId), eq(daoMemberships.role, 'admin'),
    eq(daoMemberships.status, 'approved'), eq(daoMemberships.isBanned, false),
  )).limit(1);
  if (!membership.length) return res.status(403).json({ error: 'DAO administrator access required' });
  next();
}

router.use('/daos/:daoId/risk', requireDaoAdminScope);

function parsePagination(query: Request['query']): { page: number; limit: number; offset: number } | null {
  const pageValue = String(query.page ?? '1');
  const limitValue = String(query.limit ?? '20');
  if (!/^\d+$/.test(pageValue) || !/^\d+$/.test(limitValue)) return null;
  const page = Number(pageValue);
  const limit = Number(limitValue);
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset)) return null;
  return { page, limit, offset };
}

async function auditRiskAccess(req: Request, actionType: AuditEventType, daoId: string): Promise<void> {
  const actorId = getActorId(req);
  if (!actorId) return;
  try {
    await logConsolidatedAuditEvent({ actorId, actorType: 'admin', actorRole: req.userRole || 'admin', actionType,
      actionCategory: 'security', targetType: 'dao_risk', targetId: daoId, endpoint: req.originalUrl,
      ipAddress: req.ip, userAgent: req.get('user-agent'), result: 'success', severity: 'low' });
  } catch (error) {
    logger.error('Risk access audit failed:', error);
  }
}

function activeMembershipPredicate(daoId: string) {
  return and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.status, 'approved'), eq(daoMemberships.isBanned, false));
}

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
    const adminId = getActorId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    const members = await db
      .select({ count: sql<number>`count(*)` })
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId));

    const activeMembers = await db
      .select({ count: sql<number>`count(*)` })
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId), eq(daoMemberships.status, 'approved'), eq(daoMemberships.isBanned, false)
      ));

    const admins = await db
      .select({ count: sql<number>`count(*)` })
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId), eq(daoMemberships.role, 'admin'), eq(daoMemberships.status, 'approved'), eq(daoMemberships.isBanned, false)
      ));

    // Assess risks
    const riskFactors: RiskFactor[] = [];
    let totalScore = 0;

    // Risk: Low member participation
    const memberCount = Number(members[0]?.count || 0);
    const activeMemberCount = Number(activeMembers[0]?.count || 0);
    const participationRate = memberCount > 0 ? activeMemberCount / memberCount : 0;
    if (memberCount > 0 && participationRate < 0.5) {
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
    const [failedResult] = await db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(and(
      or(eq(auditLogs.resourceId, daoId), ilike(auditLogs.endpoint, `%${daoId}%`)),
      gt(auditLogs.timestamp, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      sql`${auditLogs.status} >= 400`,
    ));

    const failedAttempts = Number(failedResult?.count || 0);
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

    const response = {
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
    };
    await auditRiskAccess(req, AuditEventType.ADMIN_RISK_SCORE_ACCESSED, daoId);
    res.json(response);
  } catch (error) {
    logger.error('Error calculating risk score:', error);
    res.status(500).json({ error: 'Failed to calculate risk score' });
  }
});

// GET /api/admin/daos/:daoId/risk/factors - Get detailed risk factors
router.get('/daos/:daoId/risk/factors', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const adminId = getActorId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });

    const [memberResult, adminResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(activeMembershipPredicate(daoId)),
      db.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(and(
        activeMembershipPredicate(daoId), eq(daoMemberships.role, 'admin'),
      )),
    ]);
    const memberCount = Number(memberResult[0]?.count || 0);
    const adminCount = Number(adminResult[0]?.count || 0);
    const factors: RiskFactor[] = [
      {
        category: 'Governance Structure',
        score: memberCount < 5 ? 25 : 0,
        severity: memberCount < 5 ? 'medium' : 'low',
        description: `${memberCount} approved, non-banned members currently govern this DAO`,
        mitigation: memberCount < 5 ? 'Recruit new members and increase community participation' : 'Continue monitoring participation',
      },
      {
        category: 'Financial Management',
        score: 0,
        severity: 'low',
        description: 'Financial risk requires current treasury and withdrawal telemetry',
        mitigation: 'Review treasury activity and spending limits',
      },
      {
        category: 'Member Compliance',
        score: 0,
        severity: 'low',
        description: 'Membership status is evaluated from approved and non-banned records',
        mitigation: 'Continue regular compliance reviews',
      },
      {
        category: 'Admin Activity',
        score: adminCount < 2 ? 40 : 0,
        severity: adminCount < 2 ? 'high' : 'low',
        description: `${adminCount} approved, non-banned DAO administrators are configured`,
        mitigation: adminCount < 2 ? 'Promote an additional trusted administrator' : 'Continue monitoring for anomalies',
      },
      {
        category: 'Protocol Adherence',
        score: 0,
        severity: 'low',
        description: 'Protocol adherence requires persisted governance assessment data',
        mitigation: 'Review and reinforce governance protocols',
      },
    ];

    await auditRiskAccess(req, AuditEventType.ADMIN_RISK_FACTORS_ACCESSED, daoId);
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
    const adminId = getActorId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });

    await auditRiskAccess(req, AuditEventType.ADMIN_RISK_ALERTS_ACCESSED, daoId);
    res.json({ alerts: [], summary: { critical: 0, high: 0, medium: 0, unacknowledged: 0 }, available: false,
      message: 'Risk alerts are unavailable until a persistent alert source is configured' });
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
    const adminId = getActorId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });
    return res.status(501).json({ error: 'Risk alerts are not backed by a persistent source' });
  } catch (error) {
    logger.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// GET /api/admin/daos/:daoId/risk/compliance - Get compliance status
router.get('/daos/:daoId/risk/compliance', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const adminId = getActorId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });

    const complianceItems: ComplianceItem[] = [];

    const compliantCount = complianceItems.filter(c => c.status === 'compliant').length;
    const atRiskCount = complianceItems.filter(c => c.status === 'at-risk').length;
    const nonCompliantCount = complianceItems.filter(c => c.status === 'non-compliant').length;

    await auditRiskAccess(req, AuditEventType.ADMIN_RISK_COMPLIANCE_ACCESSED, daoId);
    res.json({
      items: complianceItems,
      summary: {
        compliant: compliantCount,
        atRisk: atRiskCount,
        nonCompliant: nonCompliantCount,
        complianceRate: 0,
        available: false,
        message: 'Compliance checks are unavailable until a persistent compliance source is configured',
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
    const { severity = 'all' } = req.query;
    const pagination = parsePagination(req.query);
    const adminId = getActorId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });
    if (!pagination) return res.status(400).json({ error: 'page must be >= 1 and limit must be between 1 and 100' });

    const { page, limit, offset } = pagination;

    // Get high-severity audit logs
    let whereClause = or(eq(auditLogs.resourceId, daoId), like(auditLogs.endpoint, `%${daoId}%`));
    if (!whereClause) return res.status(500).json({ error: 'Failed to build audit filter' });
    
    if (severity !== 'all') {
      if (!['low', 'medium', 'high', 'critical'].includes(String(severity))) {
        return res.status(400).json({ error: 'Invalid severity' });
      }
      const severityClause = and(whereClause, eq(auditLogs.severity, String(severity)));
      if (severityClause) whereClause = severityClause;
    }

    const logs = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset(offset);

    const [{ count: total }] = await db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(whereClause);

    await auditRiskAccess(req, AuditEventType.ADMIN_RISK_AUDIT_TRAIL_ACCESSED, daoId);
    res.json({
      logs,
      pagination: {
        page,
        limit,
        total: Number(total || 0),
        hasMore: offset + logs.length < Number(total || 0),
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
    const adminId = getActorId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });
    const actorId = adminId;
    if ((typeof assessment !== 'string' && (typeof assessment !== 'object' || assessment === null)) || typeof notes !== 'undefined' && (typeof notes !== 'string' || notes.length > 5000)) {
      return res.status(400).json({ error: 'Assessment must be an object or string and notes must be at most 5000 characters' });
    }
    const assessmentId = crypto.randomUUID();

    // Check permissions - DAO Admin only
    // Log audit event
    await logConsolidatedAuditEvent({ actorId, actorType: 'admin', actorRole: req.userRole || 'admin',
      actionType: AuditEventType.RISK_ASSESSMENT_CREATED, actionCategory: 'security', targetType: 'risk_assessment', targetId: daoId,
      endpoint: req.originalUrl, ipAddress: req.ip, userAgent: req.get('user-agent'), result: 'success', severity: 'medium',
      metadata: { assessment, notes, assessmentId, persistedAs: 'audit_event' } });

    logger.info('Risk assessment created', { daoId });

    res.status(201).json({
      success: true,
      message: 'Risk assessment recorded',
      assessment: {
        id: assessmentId,
        daoId,
        createdBy: adminId,
        assessment,
        notes,
        createdAt: new Date(),
        persistedAs: 'audit_event',
      }
    });
  } catch (error) {
    logger.error('Error creating assessment:', error);
    res.status(500).json({ error: 'Failed to create assessment' });
  }
});

export default router;
