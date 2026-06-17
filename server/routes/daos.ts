import { Router } from "express";
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { db } from "../db";
import { daos, daoMemberships, users, proposals } from "../../shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { authenticate } from "../auth";
import { OnboardingService } from '../core/kwetu/services/onboarding_service';
import { daoContributions, daoContributionTypes, walletTransactions, paymentReceipts } from "../../shared/schema";
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { analyticsService } from '../analyticsService';

const onboardingService = new OnboardingService();

const router = Router();

// File upload config for payment receipts
const receiptsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'attached_assets', 'payment-receipts');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${unique}-${safe}`);
  }
});

const receiptsFileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(file.mimetype)) return cb(new Error('Invalid file type'), false);
  cb(null, true);
};

const receiptsUpload = multer({ storage: receiptsStorage, fileFilter: receiptsFileFilter, limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

// GET /api/daos - List all DAOs with user membership status
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get all DAOs with member count and treasury balance
    const allDAOs = await db
      .select({
        id: daos.id,
        name: daos.name,
        description: daos.description,
        createdAt: daos.createdAt,
        founderId: daos.founderId,
        treasuryBalance: daos.treasuryBalance,
        causeTags: daos.causeTags,
        primaryCause: daos.primaryCause,
      })
      .from(daos);

    // Get member counts for each DAO
    const memberCounts = await db
      .select({
        daoId: daoMemberships.daoId,
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(daoMemberships)
      .groupBy(daoMemberships.daoId);

    // Get user's DAO memberships
    const userMemberships = await db
      .select({
        daoId: daoMemberships.daoId,
        role: daoMemberships.role,
        joinedAt: daoMemberships.joinedAt,
      })
      .from(daoMemberships)
      .where(eq(daoMemberships.userId, userId));

    // Get recent activity counts for each DAO (proposals)
    const activityCounts = await db.execute(sql`
      SELECT 
        "dao_id" as "daoId",
        COUNT(*) as "activeProposals"
      FROM proposals
      WHERE status = 'active'
      GROUP BY "dao_id"
    `);

    // Map activity counts
    const activityMap = new Map();
    if (Array.isArray(activityCounts.rows)) {
      activityCounts.rows.forEach((row: any) => {
        activityMap.set(row.daoId, row.activeProposals || 0);
      });
    }

    // Map member counts
    const memberCountMap = new Map();
    memberCounts.forEach(({ daoId, count }) => {
      memberCountMap.set(daoId, Number(count));
    });

    // Map user memberships
    const membershipMap = new Map();
    userMemberships.forEach(({ daoId, role, joinedAt }) => {
      membershipMap.set(daoId, { role, joinedAt });
    });

    // Calculate growth rates (simplified - based on recent member joins)
    const growthRates = await db.execute(sql`
      SELECT 
        "dao_id" as "daoId",
        CASE 
          WHEN COUNT(*) = 0 THEN 0
          ELSE COUNT(*) FILTER (WHERE "created_at" >= NOW() - INTERVAL '30 days') * 100.0 / COUNT(*)
        END as "growthRate"
      FROM dao_memberships
      GROUP BY "dao_id"
    `);

    const growthMap = new Map();
    if (Array.isArray(growthRates.rows)) {
      growthRates.rows.forEach((row: any) => {
        growthMap.set(row.daoId, parseFloat(row.growthRate || '0'));
      });
    }

    // Combine data
    const enrichedDAOs = allDAOs.map((dao) => {
      const membership = membershipMap.get(dao.id);
      const memberCount = memberCountMap.get(dao.id) || 0;
      const activeProposals = activityMap.get(dao.id) || 0;
      const growthRate = growthMap.get(dao.id) || 0;
      return {
        id: dao.id,
        name: dao.name,
        description: dao.description,
        memberCount,
        treasuryBalance: parseFloat(dao.treasuryBalance || '0'),
        role: membership?.role || null,
        isJoined: !!membership,
        trending: growthRate > 15,
        growthRate: parseFloat(growthRate.toFixed(1)),
        recentActivity: activeProposals > 0 ? `${activeProposals} proposals active` : 'No recent activity',
        causeTags: dao.causeTags || [], // Include cause tags
        primaryCause: dao.primaryCause || '', // Include primary cause
      };
    });

    res.json(enrichedDAOs);
  } catch (error) {
    console.error('Error fetching DAOs:', error);
    res.status(500).json({ error: 'Failed to fetch DAOs' });
  }
});

// Get DAO dashboard statistics
router.get('/:daoId/dashboard-stats', async (req, res) => {
  try {
    const { daoId } = req.params;

    const dao = await db.query.daos.findFirst({
      where: eq(daos.id, daoId)
    });

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Get member stats
    const members = await db.query.daoMemberships.findMany({
      where: and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.status, 'approved')
      )
    });

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newMembersThisWeek = members.filter(m => 
      m.createdAt && new Date(m.createdAt) >= oneWeekAgo
    ).length;

    // Get active proposals
    const activeProposals = await db.query.proposals.findMany({
      where: and(
        eq(proposals.daoId, daoId),
        eq(proposals.status, 'active')
      )
    });

    // Calculate days left
    let daysLeft = 0;
    let status: 'active' | 'expiring' | 'expired' = 'active';
    
    if (dao.planExpiresAt) {
      const expiryDate = new Date(dao.planExpiresAt);
      const now = new Date();
      daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysLeft < 0) {
        status = 'expired';
        daysLeft = 0;
      } else if (daysLeft <= 14) {
        status = 'expiring';
      }
    }

    // Calculate funding progress
    const treasuryBalance = parseFloat(dao.treasuryBalance || '0');
    const fundingGoal = 5000; // Default goal, can be customized per DAO
    const fundingProgress = Math.min((treasuryBalance / fundingGoal) * 100, 100);

    res.json({
      totalMembers: members.length,
      newMembersThisWeek,
      activeProposals: activeProposals.length,
      treasuryBalance: treasuryBalance.toString(),
      fundingGoal: fundingGoal.toString(),
      fundingProgress: Math.round(fundingProgress),
      planExpiresAt: dao.planExpiresAt,
      daysLeft,
      status
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// POST /api/daos/:id/join - Join a DAO
router.post("/:id/join", authenticate, async (req, res) => {
  try {
  const userId = (req.user as any).id;
  const daoId = req.params.id as string;

    // Check if DAO exists
    const dao = await db.query.daos.findFirst({
      where: eq(daos.id, daoId),
    });

    if (!dao) {
      return res.status(404).json({ error: "DAO not found" });
    }

    // Check if already a member
    const existingMembership = await db.query.daoMemberships.findFirst({
      where: and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ),
    });

    if (existingMembership) {
      return res.status(400).json({ error: "Already a member of this DAO" });
    }

    // Add user as member
    await db.insert(daoMemberships).values({
      daoId,
      userId,
      role: "member",
      joinedAt: new Date(),
    });

    res.json({
      success: true,
      message: "Successfully joined the DAO",
    });
  } catch (error) {
    console.error("Error joining DAO:", error);
    res.status(500).json({ error: "Failed to join DAO" });
  }
});

// POST /api/daos/:id/leave - Leave a DAO
router.post("/:id/leave", authenticate, async (req, res) => {
  try {
  const userId = (req.user as any).id;
  const daoId = req.params.id as string;

    // Check if DAO exists
    const dao = await db.query.daos.findFirst({
      where: eq(daos.id, daoId),
    });

    if (!dao) {
      return res.status(404).json({ error: "DAO not found" });
    }

    // Check if user is founder
    if (dao.founderId === userId) {
      return res.status(400).json({
        error: "Founders cannot leave their own DAO. Transfer ownership first.",
      });
    }

    // Check if member
    const membership = await db.query.daoMemberships.findFirst({
      where: and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ),
    });

    if (!membership) {
      return res.status(400).json({ error: "Not a member of this DAO" });
    }

    // Remove membership
    await db.delete(daoMemberships).where(
      and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      )
    );

    res.json({
      success: true,
      message: "Successfully left the DAO",
    });
  } catch (error) {
    console.error("Error leaving DAO:", error);
    res.status(500).json({ error: "Failed to leave DAO" });
  }
});

// GET /api/daos/:id - Get DAO details
router.get("/:id", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const daoId = req.params.id as string;

    const dao = await db.query.daos.findFirst({
      where: eq(daos.id, daoId),
    });

    if (!dao) {
      return res.status(404).json({ error: "DAO not found" });
    }

    // Get member count
    const memberCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId))
      .then(rows => Number(rows[0]?.count || 0));

    // Get user's membership
    const membership = await db.query.daoMemberships.findFirst({
      where: and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ),
    });

    res.json({
      ...dao,
      memberCount,
      userRole: membership?.role || null,
      isMember: !!membership,
    });
  } catch (error) {
    console.error("Error fetching DAO details:", error);
    res.status(500).json({ error: "Failed to fetch DAO details" });
  }
});

// POST /api/daos/:id/onboarding - Proxy to onboarding service for DAO-scoped steps
router.post('/:id/onboarding', authenticate, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const daoId = req.params.id as string;
    const { step, stepId, action } = req.body || {};

    // Prefer explicit stepId, fall back to step
    const sid = stepId || step;

    if (!sid && action !== 'detect') {
      return res.status(400).json({ error: 'Missing step or stepId in body' });
    }

    let result: any = null;

    if (action === 'detect') {
      await onboardingService.detectCompletedSteps(userId, daoId);
      result = await onboardingService.getProgress(userId);
    } else {
      // complete the step scoped to user and dao
      result = await onboardingService.completeStep(userId, sid);
      // run detection to pick up any DAO-scoped changes
      await onboardingService.detectCompletedSteps(userId, daoId);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('DAO onboarding proxy error:', error);
    res.status(500).json({ error: 'Failed to update onboarding for DAO' });
  }
});

// === Record, confirm and list DAO payments (OKEDI Record Payment MVP)
// POST /api/daos/:id/payments/record
router.post('/:id/payments/record', authenticate, async (req, res) => {
  try {
    const recorderId = (req.user as any).id;
    const daoId = req.params.id as string;
    const bodySchema = z.object({
      memberId: z.string().min(1),
      amountKES: z.number().positive(),
      method: z.enum(['M-Pesa', 'Cash', 'Bank']),
      mpesaCode: z.string().optional(),
      note: z.string().max(100).optional(),
    });

    const parse = bodySchema.safeParse(req.body || {});
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid request', details: parse.error.errors });
    }
    const { memberId, amountKES, method, mpesaCode, note } = parse.data;

    // validate dao
    const dao = await db.query.daos.findFirst({ where: eq(daos.id, daoId) });
    if (!dao) return res.status(404).json({ error: 'DAO not found' });

    // ensure member exists in DAO
    const membership = await db.query.daoMemberships.findFirst({ where: and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, memberId)) });
    if (!membership) return res.status(400).json({ error: 'Member not part of DAO' });

    // pick a contribution type for the DAO (fallback to first available)
    const ct = await db.select().from(daoContributionTypes).where(eq(daoContributionTypes.daoId, daoId)).limit(1);
    const contributionTypeId = ct && ct[0] ? ct[0].id : null;

    const [contrib] = await db.insert(daoContributions).values({
      daoId,
      contributorId: memberId,
      contributionTypeId: contributionTypeId as any,
      amount: String(amountKES),
      currency: 'KES',
      status: 'pending',
      approvalStatus: 'awaiting',
      requiredApprovals: 1,
      description: note || null,
      metadata: { method, mpesaCode, recordedBy: recorderId },
    }).returning();

    // notify the member (if different)
    if (memberId && memberId !== recorderId) {
      await (await import('../notificationService')).notificationService.createNotification({
        userId: memberId,
        type: 'payment_pending',
        title: 'Payment recorded - awaiting confirmation',
        message: `A payment of ${amountKES} KES was recorded for you in ${dao.name || 'your DAO'}. Please confirm.`,
        metadata: { contributionId: contrib.id },
      });
    }

    // Emit analytics event (cast to string to satisfy typing)
    analyticsService.trackUserActivity(String(recorderId || ''), 'payment.recorded', { daoId, amountKES, method, contributionId: contrib.id });

    res.status(201).json({ success: true, paymentId: contrib.id, status: 'pending' });
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// POST /api/daos/:id/payments/:paymentId/confirm
router.post('/:id/payments/:paymentId/confirm', authenticate, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const daoId = req.params.id as string;
    const paymentId = req.params.paymentId as string;

    const existing = await db.select().from(daoContributions).where(and(eq(daoContributions.id, paymentId), eq(daoContributions.daoId, daoId))).limit(1);
    if (!existing || !existing[0]) return res.status(404).json({ error: 'Payment record not found' });
    const payment = existing[0];

    // allow confirmer if they are the contributor or an admin/elder/founder
    const member = await db.query.daoMemberships.findFirst({ where: and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, userId)) });
    const allowedRoles = ['admin', 'elder', 'founder'];
    const memberRole = member?.role ?? '';
    const canConfirm = (payment.contributorId === userId) || (member && allowedRoles.includes(memberRole));
    if (!canConfirm) return res.status(403).json({ error: 'Not authorized to confirm this payment' });

    // update contribution status
    const [updated] = await db.update(daoContributions).set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() }).where(eq(daoContributions.id, paymentId)).returning();

    // create wallet transaction ledger entry
    await db.insert(walletTransactions).values({
      fromUserId: payment.contributorId,
      toUserId: null,
      walletAddress: 'mpesa',
      daoId: daoId as any,
      amount: payment.amount,
      currency: payment.currency || 'KES',
      type: 'contribution',
      status: 'completed',
      transactionHash: ((payment.metadata as any)?.['mpesaCode']) || `mpesa-${Date.now()}`,
      description: payment.description || 'Recorded contribution via MPesa',
      metadata: { confirmedBy: userId, original: payment.metadata || {} },
    });

    // Recompute and persist stored treasury balance via TreasuryService (computed is source-of-truth)
    try {
      const { TreasuryService } = await import('../services/treasuryService');
      const computed = await TreasuryService.getBalance(daoId);
      await TreasuryService.updateStoredTreasuryBalance(daoId, computed.total);
    } catch (err) {
      console.warn('[DAO] Failed to recompute stored treasury balance after payment confirmation:', err);
    }

    // notify founder/admins
    const admins = await db.select().from(daoMemberships).where(and(eq(daoMemberships.daoId, daoId), inArray(daoMemberships.role, ['founder','admin','elder'])));
    for (const a of admins) {
      await (await import('../notificationService')).notificationService.createNotification({
        userId: a.userId,
        type: 'payment_confirmed',
        title: 'Payment confirmed',
        message: `Payment of ${payment.amount} ${payment.currency} confirmed for DAO ${daoId}`,
        metadata: { contributionId: paymentId },
      });
    }

    const createdAtMs = payment.createdAt ? new Date(payment.createdAt as any).getTime() : Date.now();
    const timeToConfirmMs = Date.now() - createdAtMs;
    analyticsService.trackUserActivity(String(userId || ''), 'payment.confirmed', { daoId, paymentId, timeToConfirmMs });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// GET /api/daos/:id/payments - list
router.get('/:id/payments', authenticate, async (req, res) => {
  try {
    const daoId = req.params.id as string;
    const limit = Number(req.query.limit || 20);
    const offset = Number(req.query.offset || 0);

    const rows = await db.select().from(daoContributions).where(eq(daoContributions.daoId, daoId)).orderBy(desc(daoContributions.createdAt)).limit(limit).offset(offset);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('List payments error:', error);
    res.status(500).json({ error: 'Failed to list payments' });
  }
});

// POST /api/daos/:id/payments/:paymentId/receipt - upload a receipt file for a recorded payment
router.post('/:id/payments/:paymentId/receipt', authenticate, receiptsUpload.single('receipt'), async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const daoId = req.params.id as string;
    const paymentId = req.params.paymentId as string;

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // ensure payment exists
    const existing = await db.select().from(daoContributions).where(and(eq(daoContributions.id, paymentId), eq(daoContributions.daoId, daoId))).limit(1);
    if (!existing || !existing[0]) return res.status(404).json({ error: 'Payment record not found' });

    const fileRelPath = path.join('attached_assets', 'payment-receipts', req.file.filename);
    const pdfUrl = `/${fileRelPath.replace(/\\/g, '/')}`;

    // insert a paymentReceipts row
    const [receiptRow] = await db.insert(paymentReceipts).values({
      transactionId: null,
      paymentRequestId: null,
      receiptNumber: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      pdfUrl,
      metadata: { daoId, contributionId: paymentId, uploadedBy: userId }
    }).returning();

    // update daoContributions metadata with receipt link
    // metadata is stored as JSON; cast to `any` to allow dynamic properties
    const meta = (existing[0].metadata || {}) as any;
    meta.receiptUrl = pdfUrl;
    meta.receiptId = receiptRow.id;
    await db.update(daoContributions).set({ metadata: meta }).where(eq(daoContributions.id, paymentId));

    res.status(201).json({ success: true, data: { receiptId: receiptRow.id, pdfUrl } });
  } catch (error) {
    console.error('Upload receipt error:', error);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

export default router;

