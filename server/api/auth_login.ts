import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../storage';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { generateTokens } from '../auth';
import { Logger } from '../utils/logger';
import { ValidationError, AppError } from '../middleware/errorHandler';

const logger = new Logger('auth-login');

export async function authLoginHandler(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    // Find user by email
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userResult.length === 0) {
      logger.warn('Login attempt with non-existent email', { email });
      throw new ValidationError('Invalid email or password');
    }

    const user = userResult[0];

    // Check if user account is active
    if (!user.isActive) {
      logger.warn('Login attempt with inactive account', { userId: user.id });
      throw new ValidationError('Account is deactivated');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      logger.warn('Login attempt with invalid password', { userId: user.id });
      throw new ValidationError('Invalid email or password');
    }

    // Update last login
    await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Set HTTP-only cookie for refresh token
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    logger.info('User logged in successfully', { userId: user.id, email });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          walletAddress: user.walletAddress,
          lastLoginAt: user.lastLoginAt,
        },
        accessToken: tokens.accessToken,
      },
    });
  } catch (error) {
    logger.error('Login failed', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new AppError('Login failed', 500);
  }
}
