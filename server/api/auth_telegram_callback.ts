import { type Request, type Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { users, userIdentities } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { generateTokens, TokenPayload } from './auth';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.APP_URL || 'http://localhost:5000';

interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Verify Telegram authentication data
 * Uses HMAC-SHA256 to verify the signature
 * Reference: https://core.telegram.org/widgets/login#checking-authorization
 */
function verifyTelegramAuth(data: TelegramAuthData): boolean {
  if (!TELEGRAM_BOT_TOKEN) return false;

  // Create a data check string (must be in alphabetical order)
  const checkString = Object.keys(data)
    .filter(key => key !== 'hash')
    .sort()
    .map(key => `${key}=${data[key as keyof TelegramAuthData]}`)
    .join('\n');

  // Compute HMAC-SHA256
  const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  return hash === data.hash;
}

/**
 * Check if user requires password confirmation
 * (existing password-protected account)
 */
function requiresConfirmation(existingUser: any): boolean {
  return !!(existingUser && existingUser.passwordHash);
}

/**
 * Safe JSON parsing with fallback
 */
function safeParseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Telegram OAuth callback handler
 * 
 * Flow:
 * 1. Verify Telegram authentication signature
 * 2. Check for existing user by Telegram ID
 * 3. If exists:
 *    a. If password-protected → redirect with confirmation requirement
 *    b. If OAuth-only → login directly
 * 4. If new user:
 *    a. In register mode → create account atomically
 *    b. In login mode → error (no account)
 * 5. Generate tokens and store in secure cookies
 * 6. Redirect to dashboard
 */
export async function authTelegramCallbackHandler(req: Request, res: Response) {
  try {
    // Parse telegram auth data from POST body
    const telegramData = req.body as TelegramAuthData;

    // Verify Telegram signature
    if (!verifyTelegramAuth(telegramData)) {
      console.error('Telegram auth verification failed');
      return res.redirect(`${APP_URL}/login?error=telegram_verification_failed`);
    }

    // Verify auth_date is recent (within 10 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - telegramData.auth_date > 600) {
      console.error('Telegram auth data expired');
      return res.redirect(`${APP_URL}/login?error=telegram_expired`);
    }

    // Retrieve and verify state from cookie
    const stateFromCookie = req.cookies.telegram_auth_state;
    const modeFromCookie = req.cookies.telegram_auth_mode || 'login';

    if (!stateFromCookie) {
      return res.redirect(`${APP_URL}/login?error=invalid_state`);
    }

    // Clear auth cookies
    res.clearCookie('telegram_auth_state');
    res.clearCookie('telegram_auth_mode');

    const telegramId = telegramData.id.toString();
    const telegramUsername = telegramData.username || null;

    // Check for existing Telegram identity
    const existingIdentity = await db.query.userIdentities.findFirst({
      where: and(
        eq(userIdentities.provider, 'telegram'),
        eq(userIdentities.providerUserId, telegramId)
      ),
    });

    // If identity found, link to user and login
    if (existingIdentity) {
      const existingUser = await db.query.users.findFirst({
        where: eq(users.id, existingIdentity.userId),
      });

      if (!existingUser) {
        return res.redirect(`${APP_URL}/login?error=user_not_found`);
      }

      // Generate tokens and login
      const tokens = generateTokens({
        userId: existingUser.id,
        role: existingUser.role || 'user',
      });

      // Store access token in secure cookie
      res.cookie('access_token', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      // Store refresh token in secure cookie
      res.cookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Update telegram username if changed
      if (telegramUsername && telegramUsername !== existingUser.telegramUsername) {
        await db.update(users).set({ telegramUsername }).where(eq(users.id, existingUser.id));
      }

      return res.redirect(`${APP_URL}/dashboard`);
    }

    // Check for existing email-based user
    // (In case we want to require confirmation)
    const existingEmailUser = telegramData.username
      ? await db.query.users.findFirst({
          where: eq(users.telegramUsername, telegramUsername!),
        })
      : null;

    if (existingEmailUser && requiresConfirmation(existingEmailUser)) {
      // User has password-protected account, require confirmation
      const pendingIdentity = {
        provider: 'telegram',
        providerUserId: telegramId,
        providerUsername: telegramUsername,
        firstName: telegramData.first_name,
        lastName: telegramData.last_name,
      };

      res.cookie('pending_identity', JSON.stringify(pendingIdentity), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 10 * 60 * 1000, // 10 minutes
      });

      return res.redirect(
        `${APP_URL}/login?requireConfirmation=true&email=${encodeURIComponent(existingEmailUser.email || '')}`
      );
    }

    // Handle new user registration
    if (modeFromCookie === 'register') {
      try {
        // Create user and identity atomically in transaction
        const result = await db.transaction(async (tx) => {
          // Create new user
          const [newUser] = await tx
            .insert(users)
            .values({
              email: `telegram_${telegramId}@mtaadao.local`, // Use placeholder email
              firstName: telegramData.first_name,
              lastName: telegramData.last_name || null,
              telegramUsername: telegramUsername,
              telegramChatId: null, // Will be set when user links via bot
              role: 'user',
            })
            .returning();

          // Link Telegram identity
          await tx.insert(userIdentities).values({
            userId: newUser.id,
            provider: 'telegram',
            providerUserId: telegramId,
            providerUsername: telegramUsername,
          });

          return newUser;
        });

        // Generate tokens
        const tokens = generateTokens({
          userId: result.id,
          role: result.role || 'user',
        });

        // Store tokens in secure cookies
        res.cookie('access_token', tokens.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000, // 15 minutes
        });

        res.cookie('refresh_token', tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return res.redirect(`${APP_URL}/subprofile-selection`);
      } catch (error) {
        console.error('Telegram user creation failed:', error);
        return res.redirect(`${APP_URL}/register?error=creation_failed`);
      }
    }

    // Login mode without existing account
    return res.redirect(`${APP_URL}/login?error=no_account`);
  } catch (error) {
    console.error('Telegram callback error:', error);
    return res.redirect(`${APP_URL}/login?error=telegram_error`);
  }
}
