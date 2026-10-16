/**
 * Contribution proofs, reputation heuristics, and DAO ledger (Production)
 *
 * - Idempotent proof generation
 * - Correct pagination totals
 * - Batched user enrichment (no N+1)
 * - CSV injection hardening + consistent anonymity
 * - Auth on export; public ledger is read-only with caps
 * - Trust scores clearly marked as heuristics (not governance weight)
 */

import express from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../storage';
import {
  contributions,
  users,
  daos,
} from '../../shared/schema';
import { contributionGraph } from '../../shared/reputationSchema';
import { isAuthenticated } from '../auth';
import { ReputationService } from '../reputationService';
import { logger } from '../utils/logger';

const router = express.Router();

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

function getUserId(req: express.Request): string | null {
  return (req.user as any)?.claims?.id ?? (req.user as any)?.id ?? null;
}

function parsePage(query: express.Request['query']): {
  limit: number;
  offset: number;
} {
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(String(query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );
  const offset = Math.max(0, parseInt(String(query.offset ?? '0'), 10) || 0);
  return { limit, offset };
}

/** RFC4180-ish escape; neutralize formula injection */
function csvCell(value: unknown): string {
  let s = value == null ? '' : String(value);
  if (/^[\s\u0000]*[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ─────────────────────────────────────────────────────────────
// Generate contribution proof (idempotent)
// ─────────────────────────────────────────────────────────────

router.post(
  '/generate-proof/:contributionId',
  isAuthenticated,
  async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { contributionId } = req.params;

      const [contribution] = await db
        .select()
        .from(contributions)
        .where(eq(contributions.id, contributionId))
        .limit(1);

      if (!contribution) {
        return res.status(404).json({ error: 'Contribution not found' });
      }

      if (contribution.userId !== userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const [existing] = await db
        .select()
        .from(contributionGraph)
        .where(
          and(
            eq(contributionGraph.relatedEntityType, 'contribution'),
            eq(contributionGraph.relatedEntityId, contribution.id),
            eq(contributionGraph.contributionType, 'financial_contribution')
          )
        )
        .limit(1);
      if (existing) {
        return res.json({
          success: true,
          proof: existing.proofData,
          graphId: existing.id,
          message: 'Proof already exists',
          idempotent: true,
        });
      }

      const [dao] = await db
        .select({ id: daos.id, name: daos.name })
        .from(daos)
        .where(eq(daos.id, contribution.daoId))
        .limit(1);

      const amountNum = Number(contribution.amount);
      const reputationWeight = Number.isFinite(amountNum)
        ? Math.min(1_000_000, Math.floor(Math.abs(amountNum) * 10))
        : 0;

      const proofData = {
        contributionId: contribution.id,
        contributor: userId,
        daoName: dao?.name || 'Unknown DAO',
        daoId: contribution.daoId,
        amount: contribution.amount,
        currency: contribution.currency,
        purpose: contribution.purpose,
        timestamp: contribution.createdAt,
        transactionHash: contribution.transactionHash,
        proofGenerated: new Date().toISOString(),
        // Off-chain receipt only — not a cryptographic proof unless you sign this payload
        proofType: 'database_receipt_v1',
      };

      const [inserted] = await db
        .insert(contributionGraph)
        .values({
          userId,
          contributionType: 'financial_contribution',
          daoId: contribution.daoId,
          value: contribution.amount,
          reputationWeight,
          impactScore: 50, // neutral default; tune in reputation engine later
          verified: Boolean(contribution.transactionHash),
          proofData,
          onChainTxHash: contribution.transactionHash,
          relatedEntityId: contribution.id,
          relatedEntityType: 'contribution',
        })
        .onConflictDoNothing()
        .returning();

      if (!inserted) {
        const [existing] = await db
          .select()
          .from(contributionGraph)
          .where(
            and(
              eq(contributionGraph.relatedEntityType, 'contribution'),
              eq(contributionGraph.relatedEntityId, contribution.id),
              eq(contributionGraph.contributionType, 'financial_contribution')
            )
          )
          .limit(1);

        if (!existing) {
          throw new Error('Proof insert conflicted but no matching contribution proof exists');
        }
        return res.json({
          success: true,
          proof: existing.proofData,
          graphId: existing.id,
          message: 'Proof already exists',
          idempotent: true,
        });
      }

      return res.status(201).json({
        success: true,
        proof: proofData,
        graphId: inserted?.id,
        message: 'Contribution proof generated successfully',
        idempotent: false,
      });
    } catch (error: unknown) {
      logger.error('[contribution-reputation] generate-proof failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: 'Failed to generate proof' });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// My proofs
// ─────────────────────────────────────────────────────────────

router.get('/my-proofs', isAuthenticated, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { limit, offset } = parsePage(req.query);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contributionGraph)
      .where(
        and(
          eq(contributionGraph.userId, userId),
          eq(contributionGraph.contributionType, 'financial_contribution')
        )
      );

    const proofs = await db
      .select()
      .from(contributionGraph)
      .where(
        and(
          eq(contributionGraph.userId, userId),
          eq(contributionGraph.contributionType, 'financial_contribution')
        )
      )
      .orderBy(desc(contributionGraph.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json({
      proofs,
      total: countRow?.count ?? 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    logger.error('[contribution-reputation] my-proofs failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to load proofs' });
  }
});

// ─────────────────────────────────────────────────────────────
// User reputation — engine totals are authoritative; trust score is UX-only.
// ─────────────────────────────────────────────────────────────

router.get('/reputation/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId?.trim()) {
      return res.status(400).json({ error: 'userId required' });
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [engineReputation, graphStats, contribMoney] = await Promise.all([
      ReputationService.getUserReputation(userId),
      db
        .select({
          totalEntries: sql<number>`count(*)::int`,
          verifiedFinancialEntries: sql<number>`count(*) filter (
            where ${contributionGraph.contributionType} = 'financial_contribution'
              and ${contributionGraph.verified} = true
          )::int`,
          financialCount: sql<number>`count(*) filter (where ${contributionGraph.contributionType} = 'financial_contribution')::int`,
          voteCount: sql<number>`count(*) filter (where ${contributionGraph.contributionType} = 'vote_cast')::int`,
        })
        .from(contributionGraph)
        .where(eq(contributionGraph.userId, userId)),
      db
        .select({
          totalAmount: sql<string>`coalesce(sum(cast(${contributions.amount} as decimal)), 0)`,
          contributionRows: sql<number>`count(*)::int`,
        })
        .from(contributions)
        .where(eq(contributions.userId, userId)),
    ]);

    /* The accompanying activity measures provide user-facing context only.
     * Reputation weights and totals come from ReputationService. */
    const verified = graphStats[0]?.verifiedFinancialEntries ?? 0;
    const financial = graphStats[0]?.financialCount ?? 0;
    const votes = graphStats[0]?.voteCount ?? 0;
    const contributionRows = contribMoney[0]?.contributionRows ?? 0;

    // Heuristic only — document weights in API response
    const verificationPart =
      financial > 0 ? (verified / Math.max(financial, 1)) * 40 : 0;
    const votingPart = Math.min(votes, 20) * 2; // max 40
    const activityPart = Math.min(contributionRows, 10) * 2; // max 20
    const trustScore = Math.round(
      Math.min(100, verificationPart + votingPart + activityPart)
    );

    return res.json({
      userId,
      reputation: {
        totalPoints: engineReputation.totalPoints ?? 0,
        badge: engineReputation.badge,
        level: engineReputation.level,
        nextLevelPoints: engineReputation.nextLevelPoints,
        source: 'ReputationService',
      },
      trustScore,
      scoreType: 'heuristic_v1',
      trustScorePurpose: 'UX only; not governance or financial weighting',
      notGovernanceWeight: true,
      weights: {
        verificationRatio: 40,
        votingParticipation: 40,
        contributionCount: 20,
      },
      stats: {
        financialGraphEntries: financial,
        verifiedGraphEntries: verified,
        contributionRows,
        totalAmount: contribMoney[0]?.totalAmount ?? '0',
        voteParticipation: votes,
      },
    });
  } catch (error: unknown) {
    logger.error('[contribution-reputation] reputation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to load reputation' });
  }
});

// ─────────────────────────────────────────────────────────────
// DAO reputation (heuristic)
// ─────────────────────────────────────────────────────────────

router.get('/dao-reputation/:daoId', async (req, res) => {
  try {
    const { daoId } = req.params;

    const [contributionStats] = await db
      .select({
        totalContributions: sql<number>`count(*)::int`,
        verifiedContributions: sql<number>`count(*) filter (where ${contributions.transactionHash} is not null)::int`,
        totalAmount: sql<string>`coalesce(sum(cast(${contributions.amount} as decimal)), 0)`,
      })
      .from(contributions)
      .where(eq(contributions.daoId, daoId));

    const [recentActivity] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contributionGraph)
      .where(
        and(
          eq(contributionGraph.daoId, daoId),
          sql`${contributionGraph.createdAt} >= now() - interval '30 days'`
        )
      );

    const totalContribs = contributionStats?.totalContributions ?? 0;
    const verifiedContribs = contributionStats?.verifiedContributions ?? 0;
    const recentCount = recentActivity?.count ?? 0;
    const totalAmount = Number(contributionStats?.totalAmount ?? 0);

    const transparencyScore =
      (verifiedContribs / Math.max(1, totalContribs)) * 50;
    const activityScore = Math.min(30, recentCount);
    const fundScore = Math.min(20, totalAmount / 100);
    const daoTrustScore = Math.round(
      Math.min(100, transparencyScore + activityScore + fundScore)
    );

    return res.json({
      daoId,
      trustScore: daoTrustScore,
      scoreType: 'heuristic_v1',
      notGovernanceWeight: true,
      stats: {
        totalContributions: totalContribs,
        verifiedContributions: verifiedContribs,
        recentActivity: recentCount,
        totalAmount: contributionStats?.totalAmount ?? '0',
      },
    });
  } catch (error: unknown) {
    logger.error('[contribution-reputation] dao-reputation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to load DAO reputation' });
  }
});

// ─────────────────────────────────────────────────────────────
// Transparent ledger (public read, capped)
// ─────────────────────────────────────────────────────────────

router.get('/ledger/:daoId', async (req, res) => {
  try {
    const { daoId } = req.params;
    const { limit, offset } = parsePage(req.query);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contributions)
      .where(eq(contributions.daoId, daoId));

    const ledger = await db
      .select({
        id: contributions.id,
        userId: contributions.userId,
        amount: contributions.amount,
        currency: contributions.currency,
        purpose: contributions.purpose,
        timestamp: contributions.createdAt,
        transactionHash: contributions.transactionHash,
        isAnonymous: contributions.isAnonymous,
      })
      .from(contributions)
      .where(eq(contributions.daoId, daoId))
      .orderBy(desc(contributions.createdAt))
      .limit(limit)
      .offset(offset);

    const namedIds = [
      ...new Set(
        ledger
          .filter((e) => !e.isAnonymous && e.userId)
          .map((e) => e.userId as string)
      ),
    ];

    const nameById = new Map<string, string>();
    if (namedIds.length) {
      const rows = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(inArray(users.id, namedIds));

      for (const u of rows) {
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
        nameById.set(u.id, name || 'Unknown');
      }
    }

    const enrichedLedger = ledger.map((entry) => {
      if (entry.isAnonymous) {
        const { userId: _uid, ...rest } = entry;
        return { ...rest, contributor: 'Anonymous' };
      }
      return {
        ...entry,
        contributor: nameById.get(entry.userId) || 'Unknown',
      };
    });

    return res.json({
      daoId,
      ledger: enrichedLedger,
      total: countRow?.count ?? 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    logger.error('[contribution-reputation] ledger failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to load ledger' });
  }
});

// ─────────────────────────────────────────────────────────────
// Export — authenticated (member/admin policy can tighten further)
// ─────────────────────────────────────────────────────────────

router.get(
  '/ledger/:daoId/export',
  isAuthenticated,
  async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { daoId } = req.params;
      const format = String(req.query.format || 'csv').toLowerCase();

      // Cap export size
      const ledger = await db
        .select()
        .from(contributions)
        .where(eq(contributions.daoId, daoId))
        .orderBy(desc(contributions.createdAt))
        .limit(10_000);

      if (format === 'json') {
        const safe = ledger.map((entry) => ({
          date: entry.createdAt,
          contributor: entry.isAnonymous ? 'Anonymous' : entry.userId,
          amount: entry.amount,
          currency: entry.currency,
          purpose: entry.purpose,
          transactionHash: entry.transactionHash || null,
          isAnonymous: entry.isAnonymous,
        }));
        return res.json({ daoId, ledger: safe, total: safe.length });
      }

      // CSV
      const header = [
        'Date',
        'Contributor',
        'Amount',
        'Currency',
        'Purpose',
        'Transaction Hash',
      ];
      const lines = [
        header.join(','),
        ...ledger.map((entry) =>
          [
            csvCell(entry.createdAt),
            csvCell(entry.isAnonymous ? 'Anonymous' : entry.userId),
            csvCell(entry.amount),
            csvCell(entry.currency),
            csvCell(entry.purpose),
            csvCell(entry.transactionHash || 'N/A'),
          ].join(',')
        ),
      ];

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="dao-${daoId}-ledger.csv"`
      );
      return res.send(lines.join('\n'));
    } catch (error: unknown) {
      logger.error('[contribution-reputation] export failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: 'Failed to export ledger' });
    }
  }
);

export default router;