
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
