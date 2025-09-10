import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../storage';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { generateTokens } from '../auth';
import { Logger } from '../utils/logger';
import { ValidationError, AppError } from '../middleware/errorHandler';

const logger = new Logger('auth-register');

export async function authRegisterHandler(req: Request, res: Response) {
  try {
    const { email, password, name, walletAddress } = req.body;

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      logger.warn('Registration attempt with existing email', { email });
      throw new ValidationError('User with this email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUser = await db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        firstName: name.split(' ')[0] || name,
        lastName: name.split(' ').slice(1).join(' ') || '',
        walletAddress,
        role: 'user',
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const user = newUser[0];

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

    logger.info('User registered successfully', { userId: user.id, email });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          walletAddress: user.walletAddress,
        },
        accessToken: tokens.accessToken,
      },
    });
  } catch (error) {
    logger.error('Registration failed', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new AppError('Registration failed', 500);
  }
}
