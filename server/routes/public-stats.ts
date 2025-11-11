import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../db';
import { daos, users, vaults, walletTransactions } from '../../shared/schema';
import { sql } from 'drizzle-orm';

const publicStatsRouter = Router();

// GET /api/public-stats - Platform-wide statistics
publicStatsRouter.get('/', async (req, res) => {
  try {
    const [
      userCount,
      daoCount,
      vaultData,
      recentActivity
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(daos),
      db.select({ total: sql<number>`sum(cast(balance as decimal))` }).from(vaults),
      db.select({ count: sql<number>`count(*)` }).from(walletTransactions).where(sql`created_at > NOW() - INTERVAL '30 days'`)
    ]);

    res.json({
      totalUsers: Number(userCount[0]?.count || 0),
      totalDaos: Number(daoCount[0]?.count || 0),
      totalTVL: Number(vaultData[0]?.total || 0),
      satisfactionRate: 85, // This would come from user feedback data
      monthlyTransactions: Number(recentActivity[0]?.count || 0)
    });
  } catch (error) {
    console.error('Error fetching public stats:', error);
    res.status(500).json({ error: 'Failed to fetch platform statistics' });
  }
});

export default publicStatsRouter;