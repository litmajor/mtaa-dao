
import { Request, Response } from 'express';
import { db } from '../storage';
import { users } from '../../shared/schema';
import { eq, or } from 'drizzle-orm';
import { generateTokens, verifyPassword } from '../auth';
import { redis } from '../services/redis';

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const LOCKOUT_DURATION_SECONDS = LOCKOUT_DURATION_MINUTES * 60;

export async function authLoginHandler(req: Request, res: Response) {
  try {
    const { email, phone, password } = req.body;
    const identifier = email || phone;

    console.log('[LOGIN] Login attempt for:', identifier);

    // Validate input - need either email or phone
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: email ? 'Email and password are required' : 'Phone and password are required'
      });
    }

    // Check if account is locked due to failed attempts (with timeout)
    const lockKey = `login_lock:${identifier}`;
    let isLocked = null;
    try {
      isLocked = await Promise.race([
        redis.get(lockKey),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 1000))
      ]);
    } catch (error) {
      console.warn('[LOGIN] Redis check skipped due to timeout/error');
      // Continue without rate limiting if Redis is slow
    }
    
    if (isLocked) {
      return res.status(429).json({
        success: false,
        error: `Too many failed login attempts. Account is locked for ${LOCKOUT_DURATION_MINUTES} minutes. Please try again later or reset your password.`,
        lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_SECONDS * 1000).toISOString()
      });
    }

    // Find user by email or phone
    console.log('[LOGIN] Looking up user...');
    const [user] = await db
      .select()
      .from(users)
      .where(
        email 
          ? eq(users.email, email)
          : eq(users.phone, phone!)
      )
      .limit(1);

    if (!user) {
      console.log('[LOGIN] User not found');
      // Track failed attempt (async, don't wait)
      trackFailedLogin(identifier).catch(err => console.error('Failed to track login:', err));
      
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please check your email/phone and password.'
      });
    }

    // Check if account is banned
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Please contact support for assistance.'
      });
    }

    // Verify password
    console.log('[LOGIN] Verifying password...');
    const isValidPassword = await verifyPassword(password, user.password);
    console.log('[LOGIN] Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      // Track failed attempt (async, don't wait)
      trackFailedLogin(identifier).then(failedAttempts => {
        const remainingAttempts = MAX_FAILED_ATTEMPTS - failedAttempts;
        console.log('[LOGIN] Failed login, remaining attempts:', remainingAttempts);
      }).catch(err => console.error('Failed to track login:', err));
      
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please check your password.',
      });
    }

    console.log('[LOGIN] Login successful, generating tokens...');

    // Successful login - clear failed attempts (async, don't wait)
    redis.delete(`login_attempts:${identifier}`).catch(err => 
      console.error('Failed to clear login attempts:', err)
    );

    // Update last login (async, don't wait - not critical)
    db.update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .catch(err => console.error('Failed to update last login:', err));

    // Generate tokens
    const tokens = generateTokens({
      sub: user.id,
      email: user.email || user.phone || '',
      role: typeof user.roles === 'string' ? user.roles : 'user',
    });

    // Set refresh token cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Log successful login for security monitoring
    console.log(`✅ Successful login: ${user.id} (${email || phone}) from IP: ${req.ip}`);

    console.log('[LOGIN] Sending response...');
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          role: typeof user.roles === 'string' ? user.roles : 'user',
          walletAddress: user.walletAddress,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          profilePicture: user.profileImageUrl,
        },
        accessToken: tokens.accessToken,
      },
    });
  } catch (error) {
    console.error('[LOGIN] Error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred during login. Please try again.'
    });
  }
}

/**
 * Track failed login attempts and implement account lockout
 */
async function trackFailedLogin(identifier: string): Promise<number> {
  const attemptsKey = `login_attempts:${identifier}`;
  const lockKey = `login_lock:${identifier}`;
  
  // Increment failed attempts
  const attempts = await redis.increment(attemptsKey);
  
  // Set expiration on first attempt (15 minutes window)
  if (attempts === 1) {
    await redis.expire(attemptsKey, LOCKOUT_DURATION_SECONDS);
  }
  
  // Lock account if max attempts reached
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    await redis.set(lockKey, 'locked', LOCKOUT_DURATION_SECONDS);
    await redis.delete(attemptsKey); // Clear attempts counter
    
    // Log security event
    console.warn(`🔒 Account locked due to failed login attempts: ${identifier}`);
  }
  
  return attempts;
}
