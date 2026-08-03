
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { db } from './db';
import { users } from '../shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import { EmailService } from './services/emailService';
import { redis } from './services/redis';

// TTL in seconds for password reset tokens
const TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes

export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    const userResult = await db.select().from(users).where(eq(users.email, email));
    const user = userResult[0];

    // Always return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expires = new Date(Date.now() + TOKEN_EXPIRY_SECONDS * 1000);

    // Store token in Redis with TTL
    await redis.set(`pwdreset:${hashedToken}`, { userId: user.id, used: false }, TOKEN_EXPIRY_SECONDS);

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`;

    await EmailService.send({
      to: email,
      subject: 'Password Reset Request - MtaaDAO',
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your MtaaDAO account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
      `
    });

    res.status(200).json({ 
      message: 'If an account with that email exists, a password reset link has been sent.' 
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Hash the token to find it in storage
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const tokenData = await redis.get(`pwdreset:${hashedToken}`) as { userId: string; used?: boolean } | null;

    if (!tokenData || tokenData.used) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password
    await db.update(users)
      .set({ 
        password: hashedPassword, 
        updatedAt: new Date() 
      })
      .where(eq(users.id, tokenData.userId));

    // Clean up the token
    await redis.delete(`pwdreset:${hashedToken}`);

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyResetToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const hashedToken = crypto.createHash('sha256').update(token as string).digest('hex');
    const tokenData = await redis.get(`pwdreset:${hashedToken}`) as { userId: string; used?: boolean } | null;

    if (!tokenData || tokenData.used) {
      return res.status(400).json({ valid: false, error: 'Invalid or expired reset token' });
    }

    res.status(200).json({ valid: true });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Redis manages TTL; no in-process cleanup required
