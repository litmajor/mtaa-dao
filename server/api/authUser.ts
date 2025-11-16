
import { Request, Response } from 'express';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

const logger = new Logger('auth-user');

export async function authUserHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.claims?.sub || (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated' },
      });
    }

    // Get user from database
    const userResult = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        roles: users.roles,
        phone: users.phone,
        walletAddress: users.walletAddress,
        emailVerified: users.emailVerified,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        profilePicture: users.profileImageUrl,
        bio: users.bio,
        location: users.location,
        website: users.website,
        telegramUsername: users.telegramUsername,
        isBanned: users.isBanned,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      logger.warn('User not found', { userId });
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' },
      });
    }

    const user = userResult[0];

    // Format user object with additional flags
    const formattedUser = {
      id: user.id,
      email: user.email || null,
      phone: user.phone || null,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.roles || 'user',
      isSuperUser: user.roles === 'super_admin',
      isAdmin: user.roles === 'admin' || user.roles === 'super_admin',
      walletAddress: user.walletAddress || null,
      isEmailVerified: user.emailVerified || false,
      isPhoneVerified: user.emailVerified || false, // Adjust if there's separate field
      profilePicture: user.profilePicture || null,
      isBanned: user.isBanned || false,
    };

    logger.debug('User info retrieved', { userId: user.id, role: user.roles });

    res.json({
      success: true,
      data: {
        user: formattedUser,
      },
    });
  } catch (error) {
    logger.error('Failed to get user info', error);
    throw new AppError('Failed to retrieve user information', 500);
  }
}
