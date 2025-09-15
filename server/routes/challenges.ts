
import express from 'express';
import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { dailyChallenges, userChallenges } from '../../shared/schema';
import { isAuthenticated } from '../auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

// Get daily challenge for user
router.get('/daily/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  try {
    // Get today's challenge
    const today = new Date().toISOString().split('T')[0];
    
    // Mock daily challenge data - replace with actual database queries
    const challenge = {
      id: 'daily-' + today,
      title: 'Daily Vault Check',
      description: 'Check your vault performance and claim your daily reward!',
      reward: 50,
      streak: Math.floor(Math.random() * 10) + 1,
      claimed: false,
      progress: 1,
      target: 1
    };
    
    res.json(challenge);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch daily challenge' });
  }
}));

// Claim daily reward
router.post('/claim', asyncHandler(async (req, res) => {
  const { userId, challengeId } = req.body;
  
  if (!userId || !challengeId) {
    return res.status(400).json({ error: 'User ID and Challenge ID required' });
  }
  
  try {
    // Check if already claimed today
    const today = new Date().toISOString().split('T')[0];
    
    // Mock claim logic - replace with actual implementation
    const claimResult = {
      success: true,
      pointsAwarded: 50,
      newStreak: Math.floor(Math.random() * 10) + 2
    };
    
    res.json(claimResult);
  } catch (error) {
    res.status(500).json({ error: 'Failed to claim daily reward' });
  }
}));

// Get challenge history
router.get('/history/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { limit = 10 } = req.query;
  
  try {
    // Mock challenge history - replace with actual database queries
    const history = Array.from({ length: parseInt(limit as string) }, (_, i) => ({
      id: `challenge-${i}`,
      title: `Challenge ${i + 1}`,
      completedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      pointsEarned: 50,
      type: 'daily'
    }));
    
    res.json({
      success: true,
      history,
      total: history.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch challenge history' });
  }
}));

export default router;
