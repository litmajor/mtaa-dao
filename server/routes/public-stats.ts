
import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

router.get('/impact-stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const stats = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM daos WHERE status = 'active') as active_daos,
        (SELECT COUNT(*) FROM dao_members WHERE created_at >= ${today.toISOString()}) as new_members_today,
        (SELECT COALESCE(SUM(CAST(treasury_balance AS DECIMAL)), 0) FROM daos WHERE created_at >= ${monthStart.toISOString()}) as total_raised_this_month,
        (SELECT COUNT(*) FROM vaults WHERE goal_amount IS NOT NULL AND CAST(balance AS DECIMAL) >= CAST(goal_amount AS DECIMAL)) as goals_achieved
    `);

    res.json({
      activeDaos: Number(stats.rows[0]?.active_daos || 0),
      newMembersToday: Number(stats.rows[0]?.new_members_today || 0),
      totalRaisedThisMonth: Number(stats.rows[0]?.total_raised_this_month || 0),
      goalsAchieved: Number(stats.rows[0]?.goals_achieved || 0)
    });
  } catch (error) {
    console.error('Error fetching impact stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
import { Router } from 'express';
import { db } from '../db';
import { users, daos, vaults, walletTransactions } from '../../shared/schema';
import { sql } from 'drizzle-orm';

const router = Router();

// GET /api/public-stats - Platform-wide statistics
router.get('/', async (req, res) => {
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

export default router;
