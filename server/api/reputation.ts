
import { Request, Response } from 'express';
import { ReputationService } from '../reputationService';

// Get user reputation
export async function getUserReputationHandler(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const requesterId = req.user?.id;

    if (!requesterId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Users can only view their own reputation or public summaries
    if (userId !== requesterId) {
      // Return limited public reputation info
      const publicReputation = await ReputationService.getUserReputation(userId);
      return res.json({
        totalReputation: publicReputation.totalReputation,
        globalReputation: publicReputation.globalReputation,
        isPublic: true
      });
    }

    const reputation = await ReputationService.getUserReputation(userId);
    res.json({ reputation });
  } catch (error: any) {
    console.error('Error fetching user reputation:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch user reputation' });
  }
}

// Get global reputation leaderboard
export async function getReputationLeaderboardHandler(req: Request, res: Response) {
  try {
    const { limit = '20' } = req.query;
    
    const leaderboard = await ReputationService.getReputationLeaderboard(
      undefined, 
      parseInt(limit as string)
    );
    
    res.json({ leaderboard });
  } catch (error: any) {
    console.error('Error fetching reputation leaderboard:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch reputation leaderboard' });
  }
}

// Get DAO-specific reputation leaderboard
export async function getDaoReputationLeaderboardHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const { limit = '20' } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const leaderboard = await ReputationService.getReputationLeaderboard(
      daoId, 
      parseInt(limit as string)
    );
    
    res.json({ leaderboard });
  } catch (error: any) {
    console.error('Error fetching DAO reputation leaderboard:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch DAO reputation leaderboard' });
  }
}
