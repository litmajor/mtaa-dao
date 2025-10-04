
import { Request, Response } from 'express';
import { db } from '../storage';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { generateTokens, hashPassword } from '../auth';

export async function authRegisterHandler(req: Request, res: Response) {
  try {
    const { email, password, name, walletAddress } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email, password, and name are required' }
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: { message: 'Password must be at least 8 characters' }
      });
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'User with this email already exists' }
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Split name into first and last
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: email,
        password: hashedPassword,
        firstName,
        lastName,
        walletAddress: walletAddress || null,
        roles: 'user',
        isEmailVerified: false,
        isBanned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Generate tokens
    const tokens = generateTokens({
  sub: newUser.id,
  email: newUser.email || '',
  role: typeof newUser.roles === 'string' ? newUser.roles : 'user',
    });

    // Set refresh token cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          email: newUser.email || '',
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: typeof newUser.roles === 'string' ? newUser.roles : 'user',
          walletAddress: newUser.walletAddress,
          isEmailVerified: newUser.isEmailVerified,
        },
        accessToken: tokens.accessToken,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Registration failed' }
    });
  }
}
