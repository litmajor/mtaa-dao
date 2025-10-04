
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../storage';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { ValidationError, AppError } from '../middleware/errorHandler';

const logger = new Logger('user-profile');

// Get user profile
export async function getUserProfileHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required' },
      });
    }

    const userResult = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profilePicture: users.profilePicture,
        bio: users.bio,
        location: users.location,
        website: users.website,
        telegramUsername: users.telegramUsername,
        walletAddress: users.walletAddress,
        roles: users.roles,
        isEmailVerified: users.isEmailVerified,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' },
      });
    }

    res.json({
      success: true,
      data: { user: userResult[0] },
    });
  } catch (error) {
    logger.error('Failed to get user profile', error);
    throw new AppError('Failed to retrieve user profile', 500);
  }
}

// Update user profile
export async function updateUserProfileHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.claims?.sub;
    const { 
      firstName, 
      lastName, 
      bio, 
      location, 
      website, 
      telegramUsername,
      profilePicture 
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required' },
      });
    }

    // Validate website URL if provided
    if (website && website.trim()) {
      try {
        new URL(website);
      } catch {
        throw new ValidationError('Invalid website URL');
      }
    }

    // Update user profile
    const updatedUser = await db
      .update(users)
      .set({
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
        bio: bio?.trim(),
        location: location?.trim(),
        website: website?.trim(),
        telegramUsername: telegramUsername?.trim(),
        profilePicture: profilePicture?.trim(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profilePicture: users.profilePicture,
        bio: users.bio,
        location: users.location,
        website: users.website,
        telegramUsername: users.telegramUsername,
        updatedAt: users.updatedAt,
      });

    if (updatedUser.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' },
      });
    }

    logger.info('User profile updated', { userId });

    res.json({
      success: true,
      data: { user: updatedUser[0] },
    });
  } catch (error) {
    logger.error('Failed to update user profile', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new AppError('Failed to update user profile', 500);
  }
}

// Change password
export async function changePasswordHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.claims?.sub;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required' },
      });
    }

    if (!currentPassword || !newPassword) {
      throw new ValidationError('Current password and new password are required');
    }

    if (newPassword.length < 8) {
      throw new ValidationError('New password must be at least 8 characters long');
    }

    // Get current user
    const userResult = await db
      .select({ password: users.password })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' },
      });
    }

    const user = userResult[0];

    // Verify current password
    if (user.password) {
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        throw new ValidationError('Current password is incorrect');
      }
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db
      .update(users)
      .set({
        password: hashedNewPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    logger.info('User password changed', { userId });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Failed to change password', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new AppError('Failed to change password', 500);
  }
}

// Update wallet address
export async function updateWalletAddressHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.claims?.sub;
    const { walletAddress } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required' },
      });
    }

    if (!walletAddress || !walletAddress.trim()) {
      throw new ValidationError('Wallet address is required');
    }

    // Basic validation for Ethereum-like addresses
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress.trim())) {
      throw new ValidationError('Invalid wallet address format');
    }

    // Check if wallet address is already in use
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.walletAddress, walletAddress.trim()))
      .limit(1);

    if (existingUser.length > 0 && existingUser[0].id !== userId) {
      throw new ValidationError('Wallet address is already in use');
    }

    // Update wallet address
    const updatedUser = await db
      .update(users)
      .set({
        walletAddress: walletAddress.trim(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        walletAddress: users.walletAddress,
      });

    if (updatedUser.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' },
      });
    }

    logger.info('User wallet address updated', { userId, walletAddress });

    res.json({
      success: true,
      data: { user: updatedUser[0] },
    });
  } catch (error) {
    logger.error('Failed to update wallet address', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new AppError('Failed to update wallet address', 500);
  }
}
