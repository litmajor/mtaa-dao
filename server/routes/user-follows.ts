import express, { Request, Response } from 'express';
import { isAuthenticated } from '../nextAuthMiddleware';
import { db } from '../db';
import { userFollows, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

const router = express.Router();

// Follow a user
router.post('/follow/:userId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const followerId = (req.user as any)?.id;

    if (!followerId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (followerId === userId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check if already following
    const existing = await db.query.userFollows.findFirst({
      where: and(
        eq(userFollows.followerId, followerId),
        eq(userFollows.followingId, userId)
      ),
    });

    if (existing) {
      return res.status(400).json({ error: 'Already following this user' });
    }

    await db.insert(userFollows).values({
      followerId,
      followingId: userId,
      followType: 'user',
    });

    res.json({ success: true, message: 'User followed successfully' });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow a user
router.delete('/unfollow/:userId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const followerId = (req.user as any)?.id;

    if (!followerId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await db.delete(userFollows).where(
      and(
        eq(userFollows.followerId, followerId),
        eq(userFollows.followingId, userId)
      )
    );

    res.json({ success: true, message: 'User unfollowed successfully' });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Get user's followers
router.get('/:userId/followers', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const followers = await db.query.userFollows.findMany({
      where: eq(userFollows.followingId, userId),
      with: {
        follower: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.json(followers.map(f => f.follower));
  } catch (error) {
    console.error('Fetch followers error:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// Get user's following
router.get('/:userId/following', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const following = await db.query.userFollows.findMany({
      where: eq(userFollows.followerId, userId),
      with: {
        following: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.json(following.map(f => f.following));
  } catch (error) {
    console.error('Fetch following error:', error);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

// Check if following a user
router.get('/:userId/is-following/:targetUserId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { userId, targetUserId } = req.params;

    const isFollowing = await db.query.userFollows.findFirst({
      where: and(
        eq(userFollows.followerId, userId),
        eq(userFollows.followingId, targetUserId)
      ),
    });

    res.json({ isFollowing: !!isFollowing });
  } catch (error) {
    console.error('Check following error:', error);
    res.status(500).json({ error: 'Failed to check follow status' });
  }
});

export default router;
