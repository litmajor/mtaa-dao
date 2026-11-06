
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { db } from './db';
import { users } from '../shared/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { EmailService } from './services/emailService';
import { redis } from './services/redis';
import { otpService } from './services/otpService';
import { blacklistUserTokens } from './services/tokenBlacklist';

// TTL in seconds for password reset tokens
const TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes
const RESET_OTP_EXPIRY_SECONDS = 5 * 60;

function resetOtpIdentifier(email?: string, phone?: string): string {
  return `password-reset:${email ? `email:${email}` : `phone:${phone}`}`;
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validPhone(value: unknown): value is string {
  return typeof value === 'string' && /^\+[1-9]\d{6,14}$/.test(value.trim());
}

function setCredentialCookiesForClear(res: Response): void {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  };
  res.clearCookie('access_token', options);
  res.clearCookie('refresh_token', options);
  res.clearCookie('csrf_token', { ...options, httpOnly: false });
}

export const requestPasswordResetOtp = async (req: Request, res: Response) => {
  try {
    const rawEmail = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    const rawPhone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const email = rawEmail ? rawEmail.toLowerCase() : '';
    const phone = rawPhone;

    if ((!email && !phone) || (email && phone) || (email && !validEmail(email)) || (phone && !validPhone(phone))) {
      return res.status(400).json({ success: false, error: 'Provide a valid email address or E.164 phone number.' });
    }

    const [user] = await db.select().from(users).where(
      email ? eq(sql`lower(${users.email})`, email) : eq(users.phone, phone)
    ).limit(1);

    const responseMessage = 'If an account matches those details, a reset code has been sent.';
    if (!user) return res.status(200).json({ success: true, message: responseMessage });

    const identifier = resetOtpIdentifier(email || undefined, phone || undefined);
    const otp = await otpService.storeOTP(identifier, '');
    try {
      if (email) await otpService.sendEmailOTP(email, otp);
      else await otpService.sendSMSOTP(phone, otp);
    } catch (error) {
      await otpService.deleteOTP(identifier);
      console.error('[PasswordReset] OTP delivery failed', {
        channel: email ? 'email' : 'sms',
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(503).json({
        success: false,
        error: 'Reset code delivery is temporarily unavailable. Please try again later.',
      });
    }

    return res.status(200).json({ success: true, message: responseMessage });
  } catch (error) {
    console.error('[PasswordReset] Reset-code request failed', error);
    return res.status(500).json({ success: false, error: 'Could not request a reset code.' });
  }
};

export const resetPasswordWithOtp = async (req: Request, res: Response) => {
  try {
    const rawEmail = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    const rawPhone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const email = rawEmail ? rawEmail.toLowerCase() : '';
    const phone = rawPhone;
    const { otp, newPassword } = req.body;

    if ((!email && !phone) || (email && phone) || (email && !validEmail(email)) || (phone && !validPhone(phone))) {
      return res.status(400).json({ success: false, error: 'Provide a valid email address or E.164 phone number.' });
    }
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, error: 'Enter the six-digit reset code.' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }

    const [user] = await db.select().from(users).where(
      email ? eq(sql`lower(${users.email})`, email) : eq(users.phone, phone)
    ).limit(1);
    if (!user) return res.status(400).json({ success: false, error: 'Invalid or expired reset code.' });

    const identifier = resetOtpIdentifier(email || undefined, phone || undefined);
    const claimKey = `otp:password-reset-claim:${identifier}`;
    const verification = await otpService.verifyOTP(identifier, otp);
    if (!verification.valid) {
      return res.status(400).json({ success: false, error: verification.error || 'Invalid or expired reset code.' });
    }

    if (!(await redis.setnx(claimKey, '1', RESET_OTP_EXPIRY_SECONDS))) {
      return res.status(400).json({ success: false, error: 'This reset code has already been used.' });
    }

    try {
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      const [updatedUser] = await db.update(users)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning({ id: users.id });
      if (!updatedUser) throw new Error('User account no longer exists');

      await otpService.deleteOTP(identifier);
      await blacklistUserTokens(user.id);
      setCredentialCookiesForClear(res);
      return res.status(200).json({ success: true, message: 'Password reset successful.' });
    } catch (error) {
      await redis.delete(claimKey);
      throw error;
    }
  } catch (error) {
    console.error('[PasswordReset] Password reset failed', error);
    return res.status(500).json({ success: false, error: 'Could not reset the password.' });
  }
};

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

    const resetUrl = `${process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${encodeURIComponent(resetToken)}`;

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
