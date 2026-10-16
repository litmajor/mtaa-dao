/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 DAO Proof of Contribution Router
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * DAO-scoped contribution tracking and reputation:
 * - Generate contribution proofs (NFT receipts)
 * - Track user's contribution history
 * - Calculate reputation and trust scores
 * - Transparent ledger views
 * - Export ledger data
 *
 * Base Path: /api/v1/daos/:daoId/contributions
 * Parent ensures: isAuthenticated, validateDaoId
 *
 * Migration Source: /server/routes/proof-of-contribution.ts
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express from 'express';
import type { Request, Response, Router } from 'express';
import { db } from '../../../../storage';
import { contributions, users, daos } from '../../../../../shared/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { logger } from '../../../../utils/logger';
import { contributionGraph } from '../../../../../shared/reputationSchema';
import { ReputationService } from '../../../../reputationService';

const router: Router = express.Router({ mergeParams: true });

interface UserRequest {
  user?: { id?: string; claims?: { sub?: string } };
}

// Helper to get daoId from params
function getDaoId(req: Request & UserRequest): string {
  return (req.params as Record<string, string>)?.daoId || '';
}

// Helper to get userId from request
function getUserId(req: Request & UserRequest): string | null {
  return req.user?.id || req.user?.claims?.sub || null;
}

const MAX_LIMIT = 100;
const MAX_EXPORT_ROWS = 10_000;

function parsePage(query: Request['query']): { limit: number; offset: number } {
  const parsedLimit = Number.parseInt(String(query.limit ?? '50'), 10);
  const parsedOffset = Number.parseInt(String(query.offset ?? '0'), 10);
  return {
    limit: Number.isFinite(parsedLimit)
      ? Math.min(MAX_LIMIT, Math.max(1, parsedLimit))
      : 50,
    offset: Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0,
  };
}

function csvCell(value: unknown): string {
  let cell = value == null ? '' : String(value);
  if (/^[\s\u0000]*[=+\-@]/.test(cell)) cell = `'${cell}`;
  if (/[",\n\r]/.test(cell)) cell = `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

// ════════════════════════════════════════════════════════════════════════════════
// PROOF GENERATION & HISTORY
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/daos/:daoId/contributions/generate-proof/:contributionId
 * Generate contribution proof (NFT receipt)
 */
router.post('/generate-proof/:contributionId', async (req: Request, res: Response) => {
  const daoId = getDaoId(req);
  const userId = getUserId(req);
  
  try {
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { contributionId } = req.params;

    const [contribution] = await db
      .select()
      .from(contributions)
      .where(and(
        eq(contributions.id, contributionId),
        eq(contributions.daoId, daoId)
      ))
      .limit(1);

    if (!contribution) {
      return res.status(404).json({ error: 'Contribution not found' });
    }

    if (contribution.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to generate proof for this contribution' });
    }

    // Get DAO details
    const [dao] = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    const [existing] = await db
      .select()
      .from(contributionGraph)
      .where(and(
        eq(contributionGraph.relatedEntityType, 'contribution'),
        eq(contributionGraph.relatedEntityId, contribution.id),
        eq(contributionGraph.contributionType, 'financial_contribution')
      ))
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

    const proofData = {
      contributionId: contribution.id,
      contributor: userId,
      daoName: dao?.name || 'Unknown DAO',
      daoId: contribution.daoId,
      amount: contribution.amount,
      currency: contribution.currency || 'USD',
      purpose: contribution.purpose || 'DAO Contribution',
      timestamp: contribution.createdAt,
      transactionHash: contribution.transactionHash,
      proofGenerated: new Date().toISOString()
    };

    const [inserted] = await db
      .insert(contributionGraph)
      .values({
        userId,
        contributionType: 'financial_contribution',
        daoId,
        value: contribution.amount,
        reputationWeight: 10,
        impactScore: 50,
        verified: Boolean(contribution.transactionHash),
        proofData,
        onChainTxHash: contribution.transactionHash,
        relatedEntityId: contribution.id,
        relatedEntityType: 'contribution',
      })
      .onConflictDoNothing()
      .returning();

    if (!inserted) {
      const [concurrentProof] = await db
        .select()
        .from(contributionGraph)
        .where(and(
          eq(contributionGraph.relatedEntityType, 'contribution'),
          eq(contributionGraph.relatedEntityId, contribution.id),
          eq(contributionGraph.contributionType, 'financial_contribution')
        ))
        .limit(1);
      if (!concurrentProof) {
        throw new Error('Proof insert conflicted but no matching contribution proof exists');
      }
      return res.json({
        success: true,
        proof: concurrentProof.proofData,
        graphId: concurrentProof.id,
        message: 'Proof already exists',
        idempotent: true,
      });
    }

    return res.status(201).json({
      success: true,
      proof: proofData,
      graphId: inserted.id,
      message: 'Contribution proof generated successfully'
    });
  } catch (error: unknown) {
    logger.error(`Error generating contribution proof for DAO ${daoId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, error: 'Failed to generate proof' });
  }
});

/**
 * GET /api/v1/daos/:daoId/contributions/my-proofs
 * Get user's contribution proofs for this DAO
 */
router.get('/my-proofs', async (req: Request, res: Response) => {
  const daoId = getDaoId(req);
  
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { limit, offset } = parsePage(req.query);
    const where = and(
      eq(contributionGraph.userId, userId),
      eq(contributionGraph.daoId, daoId),
      eq(contributionGraph.contributionType, 'financial_contribution')
    );
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contributionGraph)
      .where(where);
    const proofs = await db
      .select()
      .from(contributionGraph)
      .where(where)
      .orderBy(desc(contributionGraph.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json({
      success: true,
      daoId,
      proofs,
      total: countRow?.count ?? 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching contribution proofs for DAO ${daoId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, error: 'Failed to load proofs' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// REPUTATION & TRUST SCORING
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/daos/:daoId/contributions/reputation/:userId
 * Get user's reputation and trust score
 */
router.get('/reputation/:userId', async (req: Request, res: Response) => {
  const daoId = getDaoId(req);
  try {
    const { userId: targetUserId } = req.params;
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [engineReputation, contributionStats, graphStats] = await Promise.all([
      ReputationService.getUserReputation(targetUserId),
      db
        .select({
          totalContributions: sql<number>`count(*)::int`,
          verifiedContributions: sql<number>`count(*) filter (where ${contributions.transactionHash} is not null)::int`,
          totalAmount: sql<string>`coalesce(sum(cast(${contributions.amount} as decimal)), 0)`,
        })
        .from(contributions)
        .where(and(
          eq(contributions.userId, targetUserId),
          eq(contributions.daoId, daoId)
        )),
      db
        .select({
          financialCount: sql<number>`count(*) filter (where ${contributionGraph.contributionType} = 'financial_contribution')::int`,
          verifiedFinancialCount: sql<number>`count(*) filter (
            where ${contributionGraph.contributionType} = 'financial_contribution'
              and ${contributionGraph.verified} = true
          )::int`,
          voteCount: sql<number>`count(*) filter (where ${contributionGraph.contributionType} = 'vote_cast')::int`,
        })
        .from(contributionGraph)
        .where(and(
          eq(contributionGraph.userId, targetUserId),
          eq(contributionGraph.daoId, daoId)
        )),
    ]);

    const totalContributions = contributionStats[0]?.totalContributions ?? 0;
    const verifiedCount = graphStats[0]?.verifiedFinancialCount ?? 0;
    const financialCount = graphStats[0]?.financialCount ?? 0;
    const voteCount = graphStats[0]?.voteCount ?? 0;
    const verificationScore = financialCount > 0
      ? (verifiedCount / financialCount) * 40
      : 0;
    const trustScore = Math.round(Math.min(
      100,
      verificationScore + Math.min(voteCount, 20) * 2 + Math.min(totalContributions, 10) * 2
    ));

    return res.json({
      success: true,
      userId: targetUserId,
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
      stats: {
        totalContributions,
        verifiedContributions: verifiedCount,
        totalAmount: contributionStats[0]?.totalAmount ?? '0',
        voteParticipation: voteCount,
      }
    });
  } catch (error: unknown) {
    logger.error('Error calculating user reputation', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, error: 'Failed to load reputation' });
  }
});

/**
 * GET /api/v1/daos/:daoId/contributions/dao-reputation
 * Get DAO's trust score
 */
router.get('/dao-reputation', async (req: Request, res: Response) => {
  const daoId = getDaoId(req);
  
  try {
    // Get contribution transparency
    const contributionStats = await db
      .select({
        totalContributions: sql<number>`COUNT(*)`,
        verifiedContributions: sql<number>`COUNT(*) FILTER (WHERE ${contributions.transactionHash} IS NOT NULL)`,
        totalAmount: sql<number>`SUM(CAST(${contributions.amount} AS NUMERIC))`
      })
      .from(contributions)
      .where(eq(contributions.daoId, daoId));

    const totalContribs = contributionStats[0]?.totalContributions || 0;
    const verifiedContribs = contributionStats[0]?.verifiedContributions || 0;

    // Calculate DAO trust score
    const transparencyScore = (verifiedContribs / Math.max(1, totalContribs)) * 50;
    const fundScore = Math.min(50, (contributionStats[0]?.totalAmount || 0) / 10);

    const daoTrustScore = Math.round(transparencyScore + fundScore);

    res.json({
      success: true,
      daoId,
      trustScore: daoTrustScore,
      scoreType: 'heuristic_v1',
      trustScorePurpose: 'UX only; not governance or financial weighting',
      notGovernanceWeight: true,
      stats: {
        totalContributions: totalContribs,
        verifiedContributions: verifiedContribs,
        totalAmount: contributionStats[0]?.totalAmount || 0
      }
    });
  } catch (error: unknown) {
    logger.error(`Error calculating DAO reputation for ${daoId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, error: 'Failed to load DAO reputation' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// TRANSPARENT LEDGER
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/daos/:daoId/contributions/ledger
 * Get transparent contribution ledger
 */
router.get('/ledger', async (req: Request, res: Response) => {
  const daoId = getDaoId(req);
  
  try {
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
        timestamp: contributions.createdAt,
        transactionHash: contributions.transactionHash,
        isAnonymous: contributions.isAnonymous
      })
      .from(contributions)
      .where(eq(contributions.daoId, daoId))
      .orderBy(desc(contributions.createdAt))
      .limit(limit)
      .offset(offset);

    const userIds = [...new Set(ledger
      .filter((entry) => !entry.isAnonymous)
      .map((entry) => entry.userId))];
    const nameById = new Map<string, string>();
    if (userIds.length) {
      const namedUsers = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(inArray(users.id, userIds));
      for (const user of namedUsers) {
        nameById.set(user.id, [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'Unknown');
      }
    }

    const enrichedLedger = ledger.map((entry) => {
      if (entry.isAnonymous) {
        const { userId: _userId, ...anonymousEntry } = entry;
        return { ...anonymousEntry, contributor: 'Anonymous' };
      }
      return {
        ...entry,
        contributor: nameById.get(entry.userId) || 'Unknown',
      };
    });

    return res.json({
      success: true,
      daoId,
      ledger: enrichedLedger,
      total: countRow?.count ?? 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching contribution ledger for DAO ${daoId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, error: 'Failed to load ledger' });
  }
});

/**
 * GET /api/v1/daos/:daoId/contributions/ledger/export
 * Export contribution ledger as CSV
 */
router.get('/ledger/export', async (req: Request, res: Response) => {
  const daoId = getDaoId(req);
  
  try {
    const format = String(req.query.format || 'csv').toLowerCase();

    const ledger = await db
      .select()
      .from(contributions)
      .where(eq(contributions.daoId, daoId))
      .orderBy(desc(contributions.createdAt))
      .limit(MAX_EXPORT_ROWS);

    if (format === 'csv') {
      const csv = [
        'Date,Contributor,Amount,Transaction Hash',
        ...ledger.map((entry) =>
          [
            csvCell(entry.createdAt),
            csvCell(entry.isAnonymous ? 'Anonymous' : entry.userId),
            csvCell(entry.amount),
            csvCell(entry.transactionHash || 'N/A'),
          ].join(',')
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=dao-${daoId}-contributions.csv`);
      return res.send(csv);
    } else {
      return res.json({
        success: true,
        daoId,
        ledger: ledger.map((entry) => ({
          date: entry.createdAt,
          contributor: entry.isAnonymous ? 'Anonymous' : entry.userId,
          amount: entry.amount,
          transactionHash: entry.transactionHash || 'N/A',
          isAnonymous: entry.isAnonymous,
        })),
        total: ledger.length,
        limit: MAX_EXPORT_ROWS,
      });
    }
  } catch (error: unknown) {
    logger.error(`Error exporting contribution ledger for DAO ${daoId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, error: 'Failed to export ledger' });
  }
});

export default router;
