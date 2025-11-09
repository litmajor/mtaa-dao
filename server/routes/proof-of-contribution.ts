
import express from 'express';
import { db } from '../storage';
import { contributions, userReputation, users, daos } from '../../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { isAuthenticated } from '../auth';

const router = express.Router();

// Generate contribution proof (NFT receipt)
router.post('/generate-proof/:contributionId', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.id;
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

    // Get DAO details
    const [dao] = await db
      .select()
      .from(daos)
      .where(eq(daos.id, contribution.daoId))
      .limit(1);

    // Create proof metadata
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
      proofGenerated: new Date().toISOString()
    };

    // Record in contribution graph
    await db.insert(contributionGraph).values({
      userId,
      contributionType: 'financial_contribution',
      daoId: contribution.daoId,
      value: contribution.amount,
      reputationWeight: Math.floor(parseFloat(contribution.amount) * 10),
      impactScore: 75,
      verified: true,
      proofData: proofData,
      onChainTxHash: contribution.transactionHash,
      relatedEntityId: contribution.id,
      relatedEntityType: 'contribution'
    });

    res.json({
      success: true,
      proof: proofData,
      message: 'Contribution proof generated successfully'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's contribution proofs
router.get('/my-proofs', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.id;

    const proofs = await db
      .select()
      .from(contributionGraph)
      .where(and(
        eq(contributionGraph.userId, userId),
        eq(contributionGraph.contributionType, 'financial_contribution')
      ))
      .orderBy(desc(contributionGraph.createdAt));

    res.json({ proofs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get reputation and trust score
router.get('/reputation/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get contribution stats
    const contributionStats = await db
      .select({
        totalContributions: sql<number>`COUNT(*)`,
        totalAmount: sql<number>`SUM(CAST(${contributions.amount} AS DECIMAL))`,
        avgContribution: sql<number>`AVG(CAST(${contributions.amount} AS DECIMAL))`
      })
      .from(contributions)
      .where(eq(contributions.userId, userId));

    // Get vote participation (from contribution graph)
    const voteCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(contributionGraph)
      .where(and(
        eq(contributionGraph.userId, userId),
        eq(contributionGraph.contributionType, 'vote_cast')
      ));

    // Get verification status
    const verifiedContributions = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(contributionGraph)
      .where(and(
        eq(contributionGraph.userId, userId),
        eq(contributionGraph.verified, true)
      ));

    // Calculate trust score (0-100)
    const totalContributions = contributionStats[0]?.totalContributions || 0;
    const verifiedCount = verifiedContributions[0]?.count || 0;
    const votes = voteCount[0]?.count || 0;

    const trustScore = Math.min(100, 
      (verifiedCount / Math.max(1, totalContributions) * 40) + // 40% weight on verification
      (Math.min(votes, 20) * 2) + // 40% weight on voting (max 20 votes)
      (Math.min(totalContributions, 10) * 2) // 20% weight on contributions
    );

    res.json({
      userId,
      trustScore: Math.round(trustScore),
      stats: {
        totalContributions,
        verifiedContributions: verifiedCount,
        totalAmount: contributionStats[0]?.totalAmount || 0,
        voteParticipation: votes
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get DAO trust score
router.get('/dao-reputation/:daoId', async (req, res) => {
  try {
    const { daoId } = req.params;

    // Get contribution transparency
    const contributionStats = await db
      .select({
        totalContributions: sql<number>`COUNT(*)`,
        verifiedContributions: sql<number>`COUNT(*) FILTER (WHERE ${contributions.transactionHash} IS NOT NULL)`,
        totalAmount: sql<number>`SUM(CAST(${contributions.amount} AS DECIMAL))`
      })
      .from(contributions)
      .where(eq(contributions.daoId, daoId));

    // Get activity level
    const recentActivity = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(contributionGraph)
      .where(and(
        eq(contributionGraph.daoId, daoId),
        sql`${contributionGraph.createdAt} >= NOW() - INTERVAL '30 days'`
      ));

    const totalContribs = contributionStats[0]?.totalContributions || 0;
    const verifiedContribs = contributionStats[0]?.verifiedContributions || 0;
    const recentCount = recentActivity[0]?.count || 0;

    // Calculate DAO trust score
    const transparencyScore = (verifiedContribs / Math.max(1, totalContribs)) * 50;
    const activityScore = Math.min(30, recentCount);
    const fundScore = Math.min(20, (contributionStats[0]?.totalAmount || 0) / 100);

    const daoTrustScore = Math.round(transparencyScore + activityScore + fundScore);

    res.json({
      daoId,
      trustScore: daoTrustScore,
      stats: {
        totalContributions: totalContribs,
        verifiedContributions: verifiedContribs,
        recentActivity: recentCount,
        totalAmount: contributionStats[0]?.totalAmount || 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Transparent ledger view
router.get('/ledger/:daoId', async (req, res) => {
  try {
    const { daoId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const ledger = await db
      .select({
        id: contributions.id,
        userId: contributions.userId,
        amount: contributions.amount,
        currency: contributions.currency,
        purpose: contributions.purpose,
        timestamp: contributions.createdAt,
        transactionHash: contributions.transactionHash,
        isAnonymous: contributions.isAnonymous
      })
      .from(contributions)
      .where(eq(contributions.daoId, daoId))
      .orderBy(desc(contributions.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Add user info for non-anonymous contributions
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
      daoId,
      ledger: enrichedLedger,
      total: ledger.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Export ledger to PDF/CSV
router.get('/ledger/:daoId/export', async (req, res) => {
  try {
    const { daoId } = req.params;
    const { format = 'csv' } = req.query;

    const ledger = await db
      .select()
      .from(contributions)
      .where(eq(contributions.daoId, daoId))
      .orderBy(desc(contributions.createdAt));

    if (format === 'csv') {
      const csv = [
        'Date,Contributor,Amount,Currency,Purpose,Transaction Hash',
        ...ledger.map(entry => 
          `${entry.createdAt},${entry.isAnonymous ? 'Anonymous' : entry.userId},${entry.amount},${entry.currency},${entry.purpose},${entry.transactionHash || 'N/A'}`
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=dao-${daoId}-ledger.csv`);
      res.send(csv);
    } else {
      res.json({ ledger });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
