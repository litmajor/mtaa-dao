import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { randomBytes, randomUUID } from 'crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../../../../storage';
import {
  daoContributionApprovals,
  daoContributions,
  daoContributionTypes,
  daoMemberships,
  daos,
  paymentReceipts,
  users,
  walletTransactions,
} from '@shared/schema';
import { authenticate } from '../../../../../auth';
import { rateLimitPerUser } from '../../../../../middleware/rateLimit';
import { paymentReceiptUpload } from '../../../../../middleware/paymentReceiptUpload';
import { logConsolidatedAuditEvent } from '../../../../../services/auditConsolidated';
import { paymentGatewayService } from '../../../../../services/paymentGatewayService';

const router = express.Router({ mergeParams: true });
const adminRoles = new Set(['admin', 'elder', 'owner', 'founder']);

async function requireDaoAdmin(req: Request, res: Response, next: NextFunction) {
  const daoId = req.params.daoId;
  const userId = (req as any).user?.id as string | undefined;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  try {
    const [membership] = await db
      .select({
        role: daoMemberships.role,
        status: daoMemberships.status,
        isBanned: daoMemberships.isBanned,
      })
      .from(daoMemberships)
      .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, userId)))
      .limit(1);

    if (!membership || membership.status !== 'approved' || membership.isBanned ||
        !adminRoles.has((membership.role || '').toLowerCase())) {
      return res.status(403).json({ error: 'Only DAO admins, elders, or founders can perform this action' });
    }
    return next();
  } catch (error) {
    console.error('[Treasury contributions] Admin membership lookup failed:', error);
    return res.status(500).json({ error: 'Failed to verify DAO permissions' });
  }
}

async function requireDaoMember(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).user?.id as string | undefined;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  try {
    const [membership] = await db
      .select({
        id: daoMemberships.id,
        status: daoMemberships.status,
        isBanned: daoMemberships.isBanned,
      })
      .from(daoMemberships)
      .where(and(eq(daoMemberships.daoId, req.params.daoId), eq(daoMemberships.userId, userId)))
      .limit(1);
    if (!membership || membership.status !== 'approved' || membership.isBanned) {
      return res.status(403).json({ error: 'Approved, active DAO membership required' });
    }
    return next();
  } catch (error) {
    console.error('[Treasury contributions] Membership lookup failed:', error);
    return res.status(500).json({ error: 'Failed to verify DAO membership' });
  }
}

router.use(authenticate, requireDaoMember);

function validAmount(value: unknown): value is string | number {
  return (
    (typeof value === 'string' || typeof value === 'number') &&
    /^\d{1,8}(?:\.\d{1,2})?$/.test(String(value)) &&
    Number(value) > 0
  );
}

function contributionResponse(row: any) {
  const metadata = (row.metadata || {}) as Record<string, unknown>;
  return {
    id: row.id,
    daoId: row.daoId,
    typeId: row.contributionTypeId,
    amount: String(row.amount),
    currency: row.currency || 'KES',
    status: row.status,
    approvalStatus: row.approvalStatus,
    contributorId: row.contributorId,
    contributorName: [row.firstName, row.lastName].filter(Boolean).join(' ') || metadata.contributorName || undefined,
    contributorPhone: metadata.contributorPhone,
    description: row.description,
    method: metadata.method,
    mpesaRef: metadata.mpesaCode,
    purpose: metadata.purpose,
    cycle: metadata.cycle,
    createdAt: row.createdAt,
    approvedAt: row.approvedAt,
  };
}

router.post(
  '/mpesa',
  rateLimitPerUser('treasury-contrib-mpesa', 5, '10min'),
  async (req: Request, res: Response) => {
    let contributionId: string | undefined;
    let paymentInitiated = false;
    try {
      const { daoId } = req.params;
      const userId = (req as any).user?.id as string | undefined;
      const { amount, memberId, description, purpose, cycle } = req.body || {};
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      if (!validAmount(amount) || !Number.isInteger(Number(amount))) {
        return res.status(400).json({ error: 'M-Pesa contributions must be a positive whole KES amount' });
      }

      const [dao] = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
      if (!dao) return res.status(404).json({ error: 'DAO not found' });
      const contributorId = typeof memberId === 'string' && memberId ? memberId : userId;
      if (contributorId !== userId) {
        const [actorMembership] = await db
          .select({
            role: daoMemberships.role,
            status: daoMemberships.status,
            isBanned: daoMemberships.isBanned,
          })
          .from(daoMemberships)
          .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, userId)))
          .limit(1);
        if (!actorMembership || actorMembership.status !== 'approved' || actorMembership.isBanned ||
            !adminRoles.has((actorMembership.role || '').toLowerCase())) {
          return res.status(403).json({ error: 'Only DAO admins can request payment for another member' });
        }
      }

      const [membership] = await db
        .select({
          userId: daoMemberships.userId,
          status: daoMemberships.status,
          isBanned: daoMemberships.isBanned,
        })
        .from(daoMemberships)
        .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, contributorId)))
        .limit(1);
      if (!membership || membership.status !== 'approved' || membership.isBanned) {
        return res.status(400).json({ error: 'Contributor must have approved, active membership in this DAO' });
      }

      const [contributor] = await db
        .select({ id: users.id, phone: users.phone })
        .from(users)
        .where(eq(users.id, contributorId))
        .limit(1);
      if (!contributor?.phone) {
        return res.status(400).json({ error: 'Contributor must have a verified phone number for M-Pesa' });
      }

      let [type] = await db
        .select()
        .from(daoContributionTypes)
        .where(and(eq(daoContributionTypes.daoId, daoId), eq(daoContributionTypes.isActive, true)))
        .limit(1);
      if (!type) {
        [type] = await db.insert(daoContributionTypes).values({
          daoId,
          name: 'Member Contribution',
          description: 'Member contribution to the DAO rotation fund',
          minimumAmount: '0',
          requiresApproval: true,
          approvalsNeeded: 1,
          isActive: true,
        }).returning();
      }

      const amountNumber = Number(amount);
      if (amountNumber < Number(type.minimumAmount || 0) ||
          (type.maximumAmount !== null && type.maximumAmount !== undefined && amountNumber > Number(type.maximumAmount))) {
        return res.status(400).json({ error: 'Amount is outside the contribution type limits' });
      }

      const [contribution] = await db.insert(daoContributions).values({
        daoId,
        contributorId,
        contributionTypeId: type.id,
        amount: String(amount),
        currency: 'KES',
        status: 'pending',
        approvalStatus: 'awaiting',
        requiredApprovals: Math.max(1, type.approvalsNeeded || 1),
        description: typeof description === 'string' ? description.trim().slice(0, 500) : 'M-Pesa contribution',
        metadata: {
          method: 'M-Pesa',
          paymentStatus: 'initiating',
          ...(typeof purpose === 'string' ? { purpose } : {}),
          ...(typeof cycle === 'string' ? { cycle } : {}),
          recordedBy: userId,
        },
      }).returning();
      contributionId = contribution.id;

      const callbackBaseUrl = process.env.APP_BASE_URL || process.env.BACKEND_URL || 'http://localhost:5000';
      const callbackToken = randomBytes(32).toString('hex');
      const callbackUrl = new URL(
        process.env.MPESA_CALLBACK_URL ||
        `${callbackBaseUrl.replace(/\/+$/, '')}/api/webhooks/mpesa`
      );
      callbackUrl.searchParams.set('token', callbackToken);
      const payment = await paymentGatewayService.initiateDeposit('mpesa', {
        userId: contributorId,
        amount: String(amount),
        currency: 'KES',
        method: 'mobile_money',
        callbackUrl: callbackUrl.toString(),
        idempotencyKey: `dao-contribution:${contribution.id}`,
        metadata: {
          phone: contributor.phone,
          purpose: 'dao_contribution',
          daoId,
          contributionId: contribution.id,
          callbackToken,
          description: `Contribution to DAO ${dao.name}`,
        },
      });

      if (!('success' in payment) || !payment.success || payment.status !== 'pending') {
        const message = 'message' in payment && payment.message
          ? String(payment.message)
          : 'M-Pesa payment could not be initiated';
        await db.update(daoContributions).set({
          status: 'rejected',
          rejectionReason: message.slice(0, 500),
          metadata: { ...(contribution.metadata as Record<string, unknown>), paymentStatus: 'failed', paymentError: message },
          updatedAt: new Date(),
        }).where(eq(daoContributions.id, contribution.id));
        return res.status(502).json({ error: message, contributionId: contribution.id });
      }

      paymentInitiated = true;
      await db.transaction(async (tx) => {
        const [currentContribution] = await tx.select().from(daoContributions)
          .where(eq(daoContributions.id, contribution.id))
          .for('update')
          .limit(1);
        if (!currentContribution) throw new Error(`Contribution ${contribution.id} disappeared after payment initiation`);
        const currentMetadata = (currentContribution.metadata || {}) as Record<string, unknown>;
        await tx.update(daoContributions).set({
          metadata: {
            ...currentMetadata,
            ...(currentMetadata.paymentStatus === 'confirmed' ? {} : { paymentStatus: 'awaiting_callback' }),
            paymentReference: payment.reference,
            checkoutRequestId: payment.transactionId,
          },
          updatedAt: new Date(),
        }).where(eq(daoContributions.id, contribution.id));
      });

      await logConsolidatedAuditEvent({
        actorId: userId,
        actionType: 'contribution_submitted',
        targetType: 'contribution',
        targetId: contribution.id,
        severity: 'medium',
        metadata: { daoId, contributorId, amount: String(amount), currency: 'KES', method: 'M-Pesa' },
      });

      return res.status(202).json({
        success: true,
        daoId,
        contributionId: contribution.id,
        reference: payment.reference,
        checkoutRequestId: payment.transactionId,
        status: 'awaiting_payment',
        message: 'M-Pesa payment request sent. The contribution will appear for treasurer approval after Safaricom confirms payment.',
      });
    } catch (error) {
      console.error('[Treasury contributions] Failed to initiate M-Pesa contribution:', error);
      if (contributionId && !paymentInitiated) {
        await db.update(daoContributions).set({
          status: 'rejected',
          rejectionReason: 'M-Pesa payment initiation failed',
          metadata: { method: 'M-Pesa', paymentStatus: 'failed' },
          updatedAt: new Date(),
        }).where(eq(daoContributions.id, contributionId));
      }
      if (paymentInitiated && contributionId) {
        return res.status(202).json({
          success: true,
          daoId: req.params.daoId,
          contributionId,
          status: 'awaiting_payment_confirmation',
          message: 'M-Pesa accepted the payment request. Contribution status will be reconciled by the Safaricom callback.',
        });
      }
      return res.status(500).json({ error: 'Failed to initiate M-Pesa contribution' });
    }
  }
);

router.get(
  '/types',
  rateLimitPerUser('treasury-contrib-types', 30, '1min'),
  async (req: Request, res: Response) => {
    try {
      const types = await db
        .select()
        .from(daoContributionTypes)
        .where(and(eq(daoContributionTypes.daoId, req.params.daoId), eq(daoContributionTypes.isActive, true)));
      return res.json({ success: true, daoId: req.params.daoId, types });
    } catch (error) {
      console.error('[Treasury contributions] Failed to list types:', error);
      return res.status(500).json({ error: 'Failed to get contribution types' });
    }
  }
);

router.post(
  '/types',
  requireDaoAdmin,
  rateLimitPerUser('treasury-contrib-types-create', 10, '10min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).user.id as string;
      const { name, description, minimumAmount, maximumAmount, requiresApproval } = req.body || {};
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Type name required' });
      }
      if (minimumAmount !== undefined && !/^\d{1,16}(?:\.\d{1,2})?$/.test(String(minimumAmount))) {
        return res.status(400).json({ error: 'Minimum amount must be a non-negative amount with up to two decimals' });
      }
      if (maximumAmount !== undefined && maximumAmount !== null && !validAmount(maximumAmount)) {
        return res.status(400).json({ error: 'Maximum amount must be a positive amount with up to two decimals' });
      }

      const [type] = await db
        .insert(daoContributionTypes)
        .values({
          daoId,
          name: name.trim(),
          description: typeof description === 'string' ? description.trim() : null,
          minimumAmount: minimumAmount === undefined ? '0' : String(minimumAmount),
          maximumAmount: maximumAmount == null ? null : String(maximumAmount),
          requiresApproval: requiresApproval !== false,
          approvalsNeeded: 1,
          isActive: true,
        })
        .returning();

      await logConsolidatedAuditEvent({
        actorId: userId,
        actionType: 'contribution_type_created',
        targetType: 'dao',
        targetId: daoId,
        severity: 'medium',
        metadata: { name: type.name },
      });
      return res.status(201).json({ success: true, daoId, type });
    } catch (error) {
      console.error('[Treasury contributions] Failed to create type:', error);
      return res.status(500).json({ error: 'Failed to create contribution type' });
    }
  }
);

router.get(
  '/',
  rateLimitPerUser('treasury-contrib-list', 30, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 100);
      const offset = Math.max(Number.parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);
      const status = req.query.status ? String(req.query.status) : undefined;
      const conditions = [eq(daoContributions.daoId, daoId)];
      if (status) conditions.push(eq(daoContributions.status, status));
      const rows = await db
        .select({
          id: daoContributions.id,
          daoId: daoContributions.daoId,
          contributionTypeId: daoContributions.contributionTypeId,
          amount: daoContributions.amount,
          currency: daoContributions.currency,
          status: daoContributions.status,
          approvalStatus: daoContributions.approvalStatus,
          contributorId: daoContributions.contributorId,
          description: daoContributions.description,
          metadata: daoContributions.metadata,
          createdAt: daoContributions.createdAt,
          firstName: users.firstName,
          lastName: users.lastName,
          approvedAt: sql<Date | null>`(
            SELECT MAX(${daoContributionApprovals.approvedAt})
            FROM ${daoContributionApprovals}
            WHERE ${daoContributionApprovals.contributionId} = ${daoContributions.id}
              AND ${daoContributionApprovals.approved} = true
          )`,
        })
        .from(daoContributions)
        .leftJoin(users, eq(users.id, daoContributions.contributorId))
        .where(and(...conditions))
        .orderBy(desc(daoContributions.createdAt))
        .limit(limit)
        .offset(offset);

      const [count] = await db
        .select({ total: sql<number>`cast(count(*) as integer)` })
        .from(daoContributions)
        .where(and(...conditions));

      return res.json({
        success: true,
        daoId,
        contributions: rows.map(contributionResponse),
        pagination: { limit, offset, total: count?.total ?? 0 },
      });
    } catch (error) {
      console.error('[Treasury contributions] Failed to list contributions:', error);
      return res.status(500).json({ error: 'Failed to list contributions' });
    }
  }
);

router.get(
  '/export',
  rateLimitPerUser('treasury-contrib-export', 10, '10min'),
  async (req: Request, res: Response) => {
    try {
      const rows = await db
        .select({
          id: daoContributions.id,
          amount: daoContributions.amount,
          currency: daoContributions.currency,
          status: daoContributions.status,
          description: daoContributions.description,
          metadata: daoContributions.metadata,
          createdAt: daoContributions.createdAt,
          contributorId: daoContributions.contributorId,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(daoContributions)
        .leftJoin(users, eq(users.id, daoContributions.contributorId))
        .where(eq(daoContributions.daoId, req.params.daoId))
        .orderBy(desc(daoContributions.createdAt));

      const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const csv = [
        'Date,Contributor,Amount,Currency,Status,Method,Reference,Description',
        ...rows.map((row) => {
          const metadata = (row.metadata || {}) as Record<string, unknown>;
          return [
            row.createdAt?.toISOString(),
            [row.firstName, row.lastName].filter(Boolean).join(' ') || row.contributorId,
            row.amount,
            row.currency,
            row.status,
            metadata.method,
            metadata.mpesaCode,
            row.description,
          ].map(escape).join(',');
        }),
      ].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="dao-${req.params.daoId}-contributions.csv"`);
      return res.send(csv);
    } catch (error) {
      console.error('[Treasury contributions] Failed to export contributions:', error);
      return res.status(500).json({ error: 'Failed to export contributions' });
    }
  }
);

router.post(
  '/',
  rateLimitPerUser('treasury-contrib-submit', 20, '10min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).user?.id as string | undefined;
      const {
        amount,
        typeId,
        currency = 'KES',
        description,
        memberId,
        method,
        mpesaCode,
        purpose,
        cycle,
        contributorName,
        contributorPhone,
      } = req.body || {};
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      if (!validAmount(amount)) return res.status(400).json({ error: 'Amount must be positive and have at most two decimals' });
      if (typeof currency !== 'string' || !/^[A-Z]{3,8}$/.test(currency)) {
        return res.status(400).json({ error: 'Currency must be a valid uppercase currency code' });
      }
      if (description !== undefined && (typeof description !== 'string' || description.length > 500)) {
        return res.status(400).json({ error: 'Description must be 500 characters or fewer' });
      }
      if (contributorName !== undefined && (typeof contributorName !== 'string' || contributorName.length > 100)) {
        return res.status(400).json({ error: 'Contributor name must be 100 characters or fewer' });
      }
      if (contributorPhone !== undefined && (typeof contributorPhone !== 'string' || contributorPhone.length > 32)) {
        return res.status(400).json({ error: 'Contributor phone must be 32 characters or fewer' });
      }

      const [dao] = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
      if (!dao) return res.status(404).json({ error: 'DAO not found' });
      if (dao.durationModel === 'rotation' && currency !== 'KES') {
        return res.status(400).json({ error: 'Rotation contributions must be recorded in KES' });
      }

      const contributorId = typeof memberId === 'string' && memberId ? memberId : userId;
      if (contributorId !== userId) {
        const [actorMembership] = await db
          .select({ role: daoMemberships.role })
          .from(daoMemberships)
          .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, userId)))
          .limit(1);
        if (!actorMembership || actorMembership.status !== 'approved' || actorMembership.isBanned ||
            !adminRoles.has((actorMembership.role || '').toLowerCase())) {
          return res.status(403).json({ error: 'Only DAO admins can record a contribution for another member' });
        }
      }

      const [contributorMembership] = await db
        .select({
          userId: daoMemberships.userId,
          status: daoMemberships.status,
          isBanned: daoMemberships.isBanned,
        })
        .from(daoMemberships)
        .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, contributorId)))
        .limit(1);
      if (!contributorMembership || contributorMembership.status !== 'approved' || contributorMembership.isBanned) {
        return res.status(400).json({ error: 'Contributor must have approved, active membership in this DAO' });
      }

      let [type] = typeId
        ? await db.select().from(daoContributionTypes).where(and(
            eq(daoContributionTypes.id, String(typeId)),
            eq(daoContributionTypes.daoId, daoId),
            eq(daoContributionTypes.isActive, true)
          )).limit(1)
        : await db.select().from(daoContributionTypes).where(and(
            eq(daoContributionTypes.daoId, daoId),
            eq(daoContributionTypes.isActive, true)
          )).limit(1);

      if (typeId && !type) return res.status(400).json({ error: 'Contribution type not found for this DAO' });
      if (!type) {
        [type] = await db.insert(daoContributionTypes).values({
          daoId,
          name: 'Member Contribution',
          description: 'Member contribution to the DAO rotation fund',
          minimumAmount: '0',
          requiresApproval: true,
          approvalsNeeded: 1,
          isActive: true,
        }).returning();
      }

      const amountNumber = Number(amount);
      if (amountNumber < Number(type.minimumAmount || 0) ||
          (type.maximumAmount !== null && type.maximumAmount !== undefined && amountNumber > Number(type.maximumAmount))) {
        return res.status(400).json({ error: 'Amount is outside the contribution type limits' });
      }

      const [contribution] = await db.insert(daoContributions).values({
        daoId,
        contributorId,
        contributionTypeId: type.id,
        amount: String(amount),
        currency,
        status: 'pending',
        approvalStatus: 'awaiting',
        requiredApprovals: Math.max(1, type.approvalsNeeded || 1),
        description: description?.trim() || null,
        metadata: {
          ...(typeof method === 'string' ? { method } : {}),
          ...(typeof mpesaCode === 'string' ? { mpesaCode: mpesaCode.trim().toUpperCase() } : {}),
          ...(typeof purpose === 'string' ? { purpose } : {}),
          ...(typeof cycle === 'string' ? { cycle } : {}),
          ...(typeof contributorName === 'string' ? { contributorName: contributorName.trim() } : {}),
          ...(typeof contributorPhone === 'string' ? { contributorPhone: contributorPhone.trim() } : {}),
          recordedBy: userId,
        },
      }).returning();

      await logConsolidatedAuditEvent({
        actorId: userId,
        actionType: 'contribution_submitted',
        targetType: 'contribution',
        targetId: contribution.id,
        severity: 'medium',
        metadata: { daoId, contributorId, amount: String(amount), currency },
      });
      return res.status(201).json({ success: true, daoId, contribution: contributionResponse(contribution) });
    } catch (error) {
      console.error('[Treasury contributions] Failed to submit contribution:', error);
      const databaseError = error as { code?: string; constraint?: string } | null;
      if (databaseError?.code === '23505' &&
          databaseError.constraint === 'dao_contributions_mpesa_reference_unique') {
        return res.status(409).json({ error: 'This M-Pesa reference has already been recorded for this DAO' });
      }
      return res.status(500).json({ error: 'Failed to submit contribution' });
    }
  }
);

router.get(
  '/:contributionId',
  rateLimitPerUser('treasury-contrib-get', 30, '1min'),
  async (req: Request, res: Response) => {
    try {
      const [row] = await db
        .select({
          id: daoContributions.id,
          daoId: daoContributions.daoId,
          contributionTypeId: daoContributions.contributionTypeId,
          amount: daoContributions.amount,
          currency: daoContributions.currency,
          status: daoContributions.status,
          approvalStatus: daoContributions.approvalStatus,
          contributorId: daoContributions.contributorId,
          description: daoContributions.description,
          metadata: daoContributions.metadata,
          createdAt: daoContributions.createdAt,
          firstName: users.firstName,
          lastName: users.lastName,
          approvedAt: sql<Date | null>`(
            SELECT MAX(${daoContributionApprovals.approvedAt})
            FROM ${daoContributionApprovals}
            WHERE ${daoContributionApprovals.contributionId} = ${daoContributions.id}
              AND ${daoContributionApprovals.approved} = true
          )`,
        })
        .from(daoContributions)
        .leftJoin(users, eq(users.id, daoContributions.contributorId))
        .where(and(eq(daoContributions.daoId, req.params.daoId), eq(daoContributions.id, req.params.contributionId)))
        .limit(1);
      if (!row) return res.status(404).json({ error: 'Contribution not found' });
      return res.json({ success: true, daoId: req.params.daoId, contribution: contributionResponse(row) });
    } catch (error) {
      console.error('[Treasury contributions] Failed to get contribution:', error);
      return res.status(500).json({ error: 'Failed to get contribution' });
    }
  }
);

router.post(
  '/:contributionId/receipt',
  paymentReceiptUpload.single('receipt'),
  async (req: Request, res: Response) => {
    try {
      const { daoId, contributionId } = req.params;
      const userId = (req as any).user?.id as string | undefined;
      if (!req.file) return res.status(400).json({ error: 'Receipt file is required' });

      const [contribution] = await db
        .select()
        .from(daoContributions)
        .where(and(eq(daoContributions.id, contributionId), eq(daoContributions.daoId, daoId)))
        .limit(1);
      if (!contribution) return res.status(404).json({ error: 'Contribution not found' });
      if (contribution.contributorId !== userId) {
        const [membership] = await db
          .select({ role: daoMemberships.role })
          .from(daoMemberships)
          .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, userId || '')))
          .limit(1);
        if (!membership || !adminRoles.has((membership.role || '').toLowerCase())) {
          return res.status(403).json({ error: 'Only the contributor or a DAO admin can attach a receipt' });
        }
      }

      const filePath = path.join('attached_assets', 'payment-receipts', req.file.filename);
      const pdfUrl = `/${filePath.replace(/\\/g, '/')}`;
      const [receipt] = await db.insert(paymentReceipts).values({
        receiptNumber: randomUUID(),
        pdfUrl,
        metadata: { daoId, contributionId, uploadedBy: userId },
      }).returning({ id: paymentReceipts.id });
      await db.update(daoContributions).set({
        metadata: {
          ...((contribution.metadata || {}) as Record<string, unknown>),
          receiptUrl: pdfUrl,
          receiptId: receipt.id,
        },
        updatedAt: new Date(),
      }).where(eq(daoContributions.id, contributionId));

      return res.status(201).json({ success: true, receiptId: receipt.id, pdfUrl });
    } catch (error) {
      console.error('[Treasury contributions] Failed to attach receipt:', error);
      return res.status(500).json({ error: 'Failed to attach receipt' });
    }
  }
);

router.post(
  '/:contributionId/approve',
  requireDaoAdmin,
  rateLimitPerUser('treasury-contrib-approve', 20, '10min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId, contributionId } = req.params;
      const userId = (req as any).user.id as string;
      const { approved, comment } = req.body || {};
      if (typeof approved !== 'boolean') return res.status(400).json({ error: '`approved` must be a boolean' });
      if (comment !== undefined && (typeof comment !== 'string' || comment.length > 500)) {
        return res.status(400).json({ error: 'Comment must be 500 characters or fewer' });
      }

      const result = await db.transaction(async (tx) => {
        const [contribution] = await tx.select().from(daoContributions)
          .where(and(eq(daoContributions.id, contributionId), eq(daoContributions.daoId, daoId)))
          .for('update')
          .limit(1);
        if (!contribution) return { error: 'not_found' as const };
        if (contribution.status !== 'pending') return { error: 'not_pending' as const };
        const metadata = (contribution.metadata || {}) as Record<string, unknown>;
        if (contribution.contributorId === userId) return { error: 'self_approval' as const };
        if (contribution.currency?.toUpperCase() === 'KES' && metadata.recordedBy === userId) {
          return { error: 'recorder_approval' as const };
        }

        const [priorApproval] = await tx.select().from(daoContributionApprovals)
          .where(and(
            eq(daoContributionApprovals.contributionId, contributionId),
            eq(daoContributionApprovals.approverId, userId)
          ))
          .limit(1);
        if (priorApproval) return { error: 'already_reviewed' as const };

        await tx.insert(daoContributionApprovals).values({
          daoId,
          contributionId,
          approverId: userId,
          approved,
          comment: comment?.trim() || null,
          approvedAt: new Date(),
        });

        const [type] = await tx.select({ approvalsNeeded: daoContributionTypes.approvalsNeeded })
          .from(daoContributionTypes)
          .where(eq(daoContributionTypes.id, contribution.contributionTypeId))
          .limit(1);
        const verifiedMpesaPayment = contribution.currency?.toUpperCase() === 'KES' &&
          metadata.paymentStatus === 'confirmed' &&
          typeof metadata.mpesaReceipt === 'string' &&
          metadata.mpesaReceipt.trim().length > 0;
        const configuredApprovals = Math.max(1, type?.approvalsNeeded || contribution.requiredApprovals || 1);
        const needed = contribution.currency?.toUpperCase() === 'KES' && !verifiedMpesaPayment
          ? Math.max(2, configuredApprovals)
          : configuredApprovals;
        const approvals = await tx.select({ approved: daoContributionApprovals.approved })
          .from(daoContributionApprovals)
          .where(eq(daoContributionApprovals.contributionId, contributionId));
        const approvedCount = approvals.filter((approval) => approval.approved).length;
        const newStatus = !approved ? 'rejected' : approvedCount >= needed ? 'approved' : 'pending';

        const [updatedContribution] = await tx.update(daoContributions).set({
          status: newStatus,
          approvalStatus: newStatus === 'rejected' ? 'rejected' : newStatus === 'approved' ? 'unanimousApproval' : 'awaiting',
          approvalsCount: approvedCount,
          requiredApprovals: needed,
          rejectionReason: newStatus === 'rejected' ? comment?.trim() || null : null,
          completedAt: newStatus === 'approved' ? new Date() : null,
          updatedAt: new Date(),
        }).where(and(
          eq(daoContributions.id, contributionId),
          eq(daoContributions.status, 'pending')
        )).returning({ id: daoContributions.id });
        if (!updatedContribution) return { error: 'not_pending' as const };

        if (newStatus === 'approved' && contribution.currency?.toLowerCase() === 'cusd') {
          await tx.insert(walletTransactions).values({
            daoId,
            fromUserId: contribution.contributorId,
            toUserId: null,
            walletAddress: 'treasury',
            amount: contribution.amount.toString(),
            currency: contribution.currency || 'KES',
            type: 'contribution',
            status: 'completed',
            description: `Contribution approved: ${contribution.description || 'DAO contribution'}`,
            metadata: { contributionId, approvedBy: userId },
          });
        }

        return { status: newStatus, approvalsCount: approvedCount, requiredApprovals: needed };
      });

      if ('error' in result) {
        if (result.error === 'not_found') return res.status(404).json({ error: 'Contribution not found' });
        if (result.error === 'already_reviewed') return res.status(409).json({ error: 'You have already reviewed this contribution' });
        if (result.error === 'self_approval') return res.status(403).json({ error: 'Contributors cannot approve their own contributions' });
        if (result.error === 'recorder_approval') return res.status(403).json({ error: 'The member who recorded a KES contribution cannot approve it' });
        return res.status(409).json({ error: 'Contribution is no longer pending' });
      }

      await logConsolidatedAuditEvent({
        actorId: userId,
        actionType: 'contribution_approved',
        targetType: 'contribution',
        targetId: contributionId,
        severity: 'critical',
        metadata: { daoId, approved, comment, ...result },
      });
      return res.json({ success: true, daoId, contributionId, approval: { ...result, approvedAt: new Date().toISOString(), approvedBy: userId, comment } });
    } catch (error) {
      console.error('[Treasury contributions] Failed to approve contribution:', error);
      const databaseError = error as { code?: string; constraint?: string } | null;
      if (databaseError?.code === '23505' &&
          databaseError.constraint === 'dao_contribution_approvals_one_per_approver') {
        return res.status(409).json({ error: 'You have already reviewed this contribution' });
      }
      return res.status(500).json({ error: 'Failed to approve contribution' });
    }
  }
);

export default router;
