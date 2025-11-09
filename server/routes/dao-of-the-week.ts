
import { Router } from 'express';
import { db } from '../db';
import { daos } from '../../shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { authenticate } from '../auth';

const router = Router();

// Get current DAO of the Week
router.get('/current', async (req, res) => {
  try {
    const currentWeekStart = new Date();
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);

    // Get DAO with highest engagement this week
    const daoOfWeek = await db.execute(sql`
      SELECT 
        d.*,
        COUNT(DISTINCT dm.user_id) as member_count,
        COUNT(DISTINCT p.id) as proposal_count,
        COUNT(DISTINCT v.id) as vote_count,
        (COUNT(DISTINCT p.id) * 3 + COUNT(DISTINCT v.id) * 2 + COUNT(DISTINCT dm.user_id)) as engagement_score
      FROM daos d
      LEFT JOIN dao_members dm ON d.id = dm.dao_id
      LEFT JOIN proposals p ON d.id = p.dao_id AND p.created_at >= ${currentWeekStart.toISOString()}
      LEFT JOIN votes v ON p.id = v.proposal_id AND v.created_at >= ${currentWeekStart.toISOString()}
      WHERE d.status = 'active'
      GROUP BY d.id
      ORDER BY engagement_score DESC
      LIMIT 1
    `);

    res.json({ 
      success: true, 
      data: daoOfWeek.rows[0],
      weekStart: currentWeekStart
    });
  } catch (error) {
    console.error('Error fetching DAO of the Week:', error);
    res.status(500).json({ error: 'Failed to fetch DAO of the Week' });
  }
});

// Get historical DAOs of the Week
router.get('/history', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // For now, return top engaged DAOs
    const history = await db.execute(sql`
      SELECT 
        d.*,
        COUNT(DISTINCT dm.user_id) as member_count,
        COUNT(DISTINCT p.id) as proposal_count
      FROM daos d
      LEFT JOIN dao_members dm ON d.id = dm.dao_id
      LEFT JOIN proposals p ON d.id = p.dao_id
      WHERE d.status = 'active'
      GROUP BY d.id
      ORDER BY member_count DESC, proposal_count DESC
      LIMIT ${Number(limit)}
    `);

    res.json({ success: true, data: history.rows });
  } catch (error) {
    console.error('Error fetching DAO history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
