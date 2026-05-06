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

import express, { Request, Response, Router } from 'express';
import { db } from '../../../../storage';
import { contributions, userReputation, users, daos } from '../../../../../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logger } from '../../../../utils/logger';

const router: Router = express.Router({ mergeParams: true });

// Helper to get daoId from params
function getDaoId(req: Request): string {
  return (req as any).params?.daoId || '';
}

// Helper to get userId from request
function getUserId(req: Request): string | null {
  return (req.user as any)?.id || (req.user as any)?.claims?.sub || null;
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

    const { contributionId } = (req as any).params;

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

    // Create proof metadata
    const proofData = {
      contributionId: contribution.id,
      contributor: userId,
      daoName: dao?.name || 'Unknown DAO',
      daoId: contribution.daoId,
      amount: contribution.amount,
      currency: (contribution as any).currency || 'USD',
      purpose: (contribution as any).purpose || 'DAO Contribution',
      timestamp: contribution.createdAt,
      transactionHash: (contribution as any).transactionHash,
      proofGenerated: new Date().toISOString()
    };

    res.json({
      success: true,
      proof: proofData,
      message: 'Contribution proof generated successfully'
    });
  } catch (error: any) {
    logger.error(`Error generating contribution proof for DAO ${daoId}:`, error);
    res.status(500).json({ success: false, error: error.message });
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

    const proofs = await db
      .select()
      .from(contributions)
      .where(and(
        eq(contributions.userId, userId),
        eq(contributions.daoId, daoId)
      ))
      .orderBy(desc(contributions.createdAt));

    res.json({
      success: true,
      daoId,
      proofs,
      total: proofs.length
    });
  } catch (error: any) {
    logger.error(`Error fetching contribution proofs for DAO ${daoId}:`, error);
    res.status(500).json({ success: false, error: error.message });
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
  try {
    const { userId: targetUserId } = (req as any).params;

    // Get contribution stats
    const contributionStats = await db
      .select({
        totalContributions: sql<number>`COUNT(*)`,
        totalAmount: sql<number>`SUM(CAST(${contributions.amount} AS NUMERIC))`,
        avgContribution: sql<number>`AVG(CAST(${contributions.amount} AS NUMERIC))`
      })
      .from(contributions)
      .where(eq(contributions.userId, targetUserId));

    // Get verification status
    const verifiedContributions = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(contributions)
      .where(and(
        eq(contributions.userId, targetUserId),
        sql`${contributions.transactionHash} IS NOT NULL`
      ));

    const totalContributions = contributionStats[0]?.totalContributions || 0;
    const verifiedCount = verifiedContributions[0]?.count || 0;

    // Calculate trust score (0-100)
    const trustScore = Math.min(100,
      (verifiedCount / Math.max(1, totalContributions) * 40) +
      Math.min(totalContributions * 5, 60)
    );

    res.json({
      success: true,
      userId: targetUserId,
      trustScore: Math.round(trustScore),
      stats: {
        totalContributions,
        verifiedContributions: verifiedCount,
        totalAmount: contributionStats[0]?.totalAmount || 0,
        avgContribution: contributionStats[0]?.avgContribution || 0
      }
    });
  } catch (error: any) {
    logger.error('Error calculating user reputation:', error);
    res.status(500).json({ success: false, error: error.message });
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
      stats: {
        totalContributions: totalContribs,
        verifiedContributions: verifiedContribs,
        totalAmount: contributionStats[0]?.totalAmount || 0
      }
    });
  } catch (error: any) {
    logger.error(`Error calculating DAO reputation for ${daoId}:`, error);
    res.status(500).json({ success: false, error: error.message });
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
    const { limit = 50, offset = 0 } = req.query;

    const ledger = await db
      .select({
        id: contributions.id,
        userId: contributions.userId,
        amount: contributions.amount,
        timestamp: contributions.createdAt,
        transactionHash: (contributions as any).transactionHash,
        isAnonymous: (contributions as any).isAnonymous
      })
      .from(contributions)
      .where(eq(contributions.daoId, daoId))
      .orderBy(desc(contributions.createdAt))
      .limit(parseInt(limit as string) || 50)
      .offset(parseInt(offset as string) || 0);

    // Enrich with user info
    const enrichedLedger = await Promise.all(
      ledger.map(async (entry) => {
        if (entry.isAnonymous) {
          return {
            ...entry,
            contributor: 'Anonymous'
          };
        }

        const [user] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, entry.userId))
          .limit(1);

        return {
          ...entry,
          contributor: user ? `${user.firstName} ${user.lastName}` : 'Unknown'
        };
      })
    );

    res.json({
      success: true,
      daoId,
      ledger: enrichedLedger,
      total: ledger.length
    });
  } catch (error: any) {
    logger.error(`Error fetching contribution ledger for DAO ${daoId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/daos/:daoId/contributions/ledger/export
 * Export contribution ledger as CSV
 */
router.get('/ledger/export', async (req: Request, res: Response) => {
  const daoId = getDaoId(req);
  
  try {
    const { format = 'csv' } = req.query;

    const ledger = await db
      .select()
      .from(contributions)
      .where(eq(contributions.daoId, daoId))
      .orderBy(desc(contributions.createdAt));

    if (format === 'csv') {
      const csv = [
        'Date,Contributor,Amount,Transaction Hash',
        ...ledger.map((entry: any) => 
          `"${entry.createdAt}","${entry.isAnonymous ? 'Anonymous' : entry.userId}","${entry.amount}","${entry.transactionHash || 'N/A'}"`
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=dao-${daoId}-contributions.csv`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        daoId,
        ledger: ledger.map((entry: any) => ({
          date: entry.createdAt,
          contributor: entry.isAnonymous ? 'Anonymous' : entry.userId,
          amount: entry.amount,
          transactionHash: (entry as any).transactionHash || 'N/A'
        }))
      });
    }
  } catch (error: any) {
    logger.error(`Error exporting contribution ledger for DAO ${daoId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
