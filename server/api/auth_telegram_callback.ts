import { type Request, type Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { users, userIdentities } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { generateTokens } from '../auth';
import { setAuthSessionCookies } from '../utils/authSessionCookies';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5000';

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
  if (!TELEGRAM_BOT_TOKEN || !/^[a-f\d]{64}$/i.test(data.hash)) return false;

  // Create a data check string (must be in alphabetical order)
  const checkString = Object.keys(data)
    .filter(key => key !== 'hash')
    .filter(key => data[key as keyof TelegramAuthData] !== undefined)
    .sort()
    .map(key => `${key}=${data[key as keyof TelegramAuthData]}`)
    .join('\n');

  // Compute HMAC-SHA256
  const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest();

  const receivedHash = Buffer.from(data.hash, 'hex');
  return receivedHash.length === hash.length && crypto.timingSafeEqual(hash, receivedHash);
}

/**
 * Check if user requires password confirmation
 * (existing password-protected account)
 */
function requiresConfirmation(existingUser: any): boolean {
  return !!existingUser?.password;
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
    const input = req.method === 'GET' ? req.query : { ...req.query, ...req.body };
    const value = (key: string): string | undefined => {
      const candidate = input?.[key];
      return typeof candidate === 'string' ? candidate : undefined;
    };
    const id = value('id');
    const authDate = value('auth_date');
    const hash = value('hash');
    if (!id || !/^\d+$/.test(id) || !authDate || !/^\d+$/.test(authDate) || !hash) {
      return res.redirect(`${APP_URL}/login?error=telegram_verification_failed`);
    }

    const telegramData: TelegramAuthData = {
      id: Number(id),
      first_name: value('first_name') || '',
      last_name: value('last_name'),
      username: value('username'),
      photo_url: value('photo_url'),
      auth_date: Number(authDate),
      hash,
    };
    if (!Number.isSafeInteger(telegramData.id) || !Number.isSafeInteger(telegramData.auth_date)) {
      return res.redirect(`${APP_URL}/login?error=telegram_verification_failed`);
    }

    // Verify Telegram signature
    if (!verifyTelegramAuth(telegramData)) {
      console.error('Telegram auth verification failed');
      return res.redirect(`${APP_URL}/login?error=telegram_verification_failed`);
    }

    // Verify auth_date is recent (within 10 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    if (telegramData.auth_date > currentTime + 30 || currentTime - telegramData.auth_date > 600) {
      console.error('Telegram auth data expired');
      return res.redirect(`${APP_URL}/login?error=telegram_expired`);
    }

    // Retrieve and verify state from cookie
    const stateFromCookie = req.cookies?.telegram_auth_state;
    const stateFromRequest = value('state');
    const modeFromCookie = req.cookies?.telegram_auth_mode === 'register' ? 'register' : 'login';

    if (!stateFromCookie || !stateFromRequest) {
      return res.redirect(`${APP_URL}/login?error=invalid_state`);
    }
    const cookieStateBytes = Buffer.from(stateFromCookie);
    const requestStateBytes = Buffer.from(stateFromRequest);
    if (
      cookieStateBytes.length !== requestStateBytes.length ||
      !crypto.timingSafeEqual(cookieStateBytes, requestStateBytes)
    ) {
      return res.redirect(`${APP_URL}/login?error=invalid_state`);
    }

    // Clear auth cookies
    res.clearCookie('telegram_auth_state', { path: '/' });
    res.clearCookie('telegram_auth_mode', { path: '/' });

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
        sub: existingUser.id,
        role: existingUser.roles || 'user',
      });

      setAuthSessionCookies(res, tokens);

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
        email: existingEmailUser.email,
        username: telegramUsername,
        firstName: telegramData.first_name,
        lastName: telegramData.last_name,
      };

      res.cookie('oauth_pending_identity', JSON.stringify(pendingIdentity), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000, // 10 minutes
        path: '/',
      });

      return res.redirect(
        `${APP_URL}/login?requireConfirmation=true&email=${encodeURIComponent(existingEmailUser.email || '')}&provider=telegram`
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
              id: crypto.randomUUID(),
              name: telegramUsername || `${telegramData.first_name} ${telegramData.last_name || ''}`.trim(),
              email: `telegram_${telegramId}@mtaadao.local`,
              firstName: telegramData.first_name,
              lastName: telegramData.last_name || null,
              username: telegramUsername,
              telegramUsername: telegramUsername,
              telegramChatId: null,
              roles: 'user',
              password: '',
            })
            .returning();

          await tx.insert(userIdentities).values({
            userId: newUser.id,
            provider: 'telegram',
            providerUserId: telegramId,
            profile: {
              username: telegramUsername,
              firstName: telegramData.first_name,
              lastName: telegramData.last_name,
            },
          });

          return newUser;
        });

        // Generate tokens
        const tokens = generateTokens({
          sub: result.id,
          role: result.roles || 'user',
        });

        setAuthSessionCookies(res, tokens);

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
