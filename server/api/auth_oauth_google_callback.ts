import type { Request, Response } from 'express';
import axios from 'axios';
import { db } from '../storage';
import { users, userIdentities } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { generateTokens } from '../auth';
import { Logger } from '../utils/logger';

const logger = new Logger('auth-oauth-google-callback');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT || 'http://localhost:5000/api/auth/oauth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5000';

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

/**
 * Safe JSON parsing with error handling
 * FIX #5: Prevents unhandled parsing errors
 */
function safeParseJSON<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    logger.warn('Failed to parse JSON', { json, error });
    return fallback;
  }
}

/**
 * Verify CSRF state token
 * FIX #1: Prevents OAuth CSRF attacks by validating state against server-side cookie
 */
function verifyOAuthState(requestState: string | string[] | undefined, cookieState: string | undefined): boolean {
  if (!requestState || !cookieState) {
    logger.warn('Missing state parameter or cookie', { hasRequestState: !!requestState, hasCookieState: !!cookieState });
    return false;
  }

  const stateStr = Array.isArray(requestState) ? requestState[0] : requestState;
  
  // Constant-time comparison to prevent timing attacks
  const matches = crypto.timingSafeEqual(
    Buffer.from(stateStr),
    Buffer.from(cookieState)
  ).valueOf();
  
  if (!matches) {
    logger.warn('OAuth state mismatch - potential CSRF attack', { 
      requestState: stateStr.substring(0, 8) + '...',
      cookieState: cookieState.substring(0, 8) + '...'
    });
  }
  
  return matches;
}

/**
 * Check if identity requires confirmation before linking
 * Determines if existing account needs password confirmation
 */
function requiresConfirmation(existingUser: typeof users.$inferSelect): boolean {
  // If user has no password, they were created via OAuth only
  // If they have a password, require confirmation before linking new OAuth provider
  return existingUser.password !== null && existingUser.password !== '';
}

export async function authOauthGoogleCallbackHandler(req: Request, res: Response) {
  try {
    const { code, state, error } = req.query;

    // FIX #1: Verify CSRF state immediately
    const storedState = req.cookies['oauth_state'];
    let stateParam: string | undefined;
    
    if (typeof state === 'string') {
      stateParam = state;
    } else if (Array.isArray(state) && state.length > 0 && typeof state[0] === 'string') {
      stateParam = state[0];
    }
    
    if (!verifyOAuthState(stateParam, storedState)) {
      logger.warn('OAuth state verification failed - rejecting request');
      return res.redirect(`${FRONTEND_URL}/login?error=invalid_state&message=Session+expired+or+state+mismatch`);
    }

    // Clear the state cookie after verification
    res.clearCookie('oauth_state');

    if (error) {
      logger.warn('OAuth error received', { error });
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_cancelled`);
    }

    if (!code) {
      logger.warn('No authorization code received');
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_error`);
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      logger.error('Google OAuth not properly configured');
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_config_error`);
    }

    // FIX #6: Retrieve PKCE code_verifier from cookie
    const codeVerifier = req.cookies['oauth_code_verifier'];
    if (!codeVerifier) {
      logger.warn('Missing PKCE code_verifier - possible session loss');
      return res.redirect(`${FRONTEND_URL}/login?error=pkce_error&message=Session+expired`);
    }
    res.clearCookie('oauth_code_verifier');

    // Retrieve OAuth mode from cookie
    const oauthMode = req.cookies['oauth_mode'] || 'login';
    res.clearCookie('oauth_mode');

    // Exchange authorization code for access token
    // FIX #6: Include PKCE code_verifier in token exchange
    const tokenResponse = await axios.post<GoogleTokenResponse>('https://oauth2.googleapis.com/token', {
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier, // PKCE parameter
    });

    const { access_token } = tokenResponse.data;

    // Get user info from Google
    const userInfoResponse = await axios.get<GoogleUserInfo>(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${access_token}`
    );

    const googleUser = userInfoResponse.data;

    // Verify email is confirmed by Google
    if (!googleUser.verified_email) {
      logger.warn('Google email not verified', { email: googleUser.email });
      return res.redirect(`${FRONTEND_URL}/login?error=email_not_verified`);
    }

    // FIX #3 & #4: Use database transaction to ensure atomicity
    // This prevents orphaned user/identity records if insertion fails partway through
    const result = await db.transaction(async (tx) => {
      // Step 1: Try to find existing identity by provider user ID
      const existingIdentity = await tx
        .select()
        .from(userIdentities)
        .where(and(eq(userIdentities.provider, 'google'), eq(userIdentities.providerUserId, googleUser.id)))
        .limit(1);

      let user;

      if (existingIdentity.length > 0) {
        // Identity exists -> fetch and update the user
        const identity = existingIdentity[0];
        const userResult = await tx.select().from(users).where(eq(users.id, identity.userId)).limit(1);
        
        if (userResult.length === 0) {
          throw new Error(`Identity exists but user not found: ${identity.id}`);
        }

        user = userResult[0];

        // Update basic profile fields
        await tx
          .update(users)
          .set({
            firstName: googleUser.given_name || user.firstName,
            lastName: googleUser.family_name || user.lastName,
            profileImageUrl: googleUser.picture || user.profileImageUrl,
            isEmailVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));

        logger.info('Existing user logged in via Google OAuth', { userId: user.id });
        return { user, requiresLinkingConfirmation: false };
      } else {
        // Step 2: Try to find user by email
        const existingUser = await tx
          .select()
          .from(users)
          .where(eq(users.email, googleUser.email))
          .limit(1);

        if (existingUser.length > 0) {
          // FIX #4: Require confirmation before auto-linking identity
          // If user has a password, they need to confirm before linking OAuth
          const needsConfirmation = requiresConfirmation(existingUser[0]);

          if (needsConfirmation) {
            // Return a state requiring confirmation
            logger.info('Identity linking requires confirmation', { email: googleUser.email });
            return {
              user: null,
              requiresLinkingConfirmation: true,
              pendingIdentity: {
                email: googleUser.email,
                googleId: googleUser.id,
                profile: {
                  name: googleUser.name,
                  picture: googleUser.picture,
                  raw: googleUser
                }
              }
            };
          }

          // User exists and has no password (OAuth-only account) - safe to link
          user = existingUser[0];
          
          // Link the OAuth identity within the transaction
          await tx.insert(userIdentities).values({
            id: crypto.randomUUID(),
            userId: user.id,
            provider: 'google',
            providerUserId: googleUser.id,
            profile: { name: googleUser.name, picture: googleUser.picture, raw: googleUser },
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          await tx
            .update(users)
            .set({
              firstName: googleUser.given_name || user.firstName,
              lastName: googleUser.family_name || user.lastName,
              profileImageUrl: googleUser.picture || user.profileImageUrl,
              isEmailVerified: true,
              updatedAt: new Date(),
            })
            .where(eq(users.id, user.id));

          logger.info('Linked Google identity to existing user', { userId: user.id });
          return { user, requiresLinkingConfirmation: false };
        } else {
          // Step 3: Create new user (only in register mode)
          if (oauthMode !== 'register') {
            logger.warn('User not found and register mode not enabled', { email: googleUser.email });
            throw new Error('ACCOUNT_NOT_FOUND');
          }

          // Create new user and identity atomically
          const newUserResult = await tx
            .insert(users)
            .values({
              id: crypto.randomUUID(),
              email: googleUser.email,
              firstName: googleUser.given_name,
              lastName: googleUser.family_name,
              profileImageUrl: googleUser.picture,
              roles: 'member',
              isEmailVerified: true,
              password: '', // OAuth users don't have passwords
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          user = newUserResult[0];

          // Insert identity linked to new user - all within same transaction
          await tx.insert(userIdentities).values({
            id: crypto.randomUUID(),
            userId: user.id,
            provider: 'google',
            providerUserId: googleUser.id,
            profile: { name: googleUser.name, picture: googleUser.picture, raw: googleUser },
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          logger.info('New user created via Google OAuth', { userId: user.id });
          return { user, requiresLinkingConfirmation: false };
        }
      }
    });

    // If linking confirmation is required, redirect to confirmation flow
    if (result.requiresLinkingConfirmation) {
      // Store pending identity in a temporary, short-lived cookie
      res.cookie('oauth_pending_identity', JSON.stringify(result.pendingIdentity), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      logger.info('Redirecting to identity confirmation flow');
      return res.redirect(`${FRONTEND_URL}/login?requireConfirmation=true&email=${encodeURIComponent(result.pendingIdentity!.email)}`);
    }

    if (!result.user) {
      throw new Error('Failed to retrieve user after transaction');
    }

    // FIX #2: Generate tokens and store in secure HTTP-only cookies instead of URL parameter
    const tokens = generateTokens({
      sub: result.user.id,
      email: result.user.email ?? '',
      role: result.user.roles ?? 'member',
    });

    // Store access token in secure HTTP-only cookie
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes (matches access token expiry)
    });

    // Store refresh token in secure HTTP-only cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // FIX #2: Redirect to dashboard without exposing tokens in URL
    res.redirect(`${FRONTEND_URL}/dashboard`);

  } catch (error) {
    if (error instanceof Error && error.message === 'ACCOUNT_NOT_FOUND') {
      logger.warn('Account not found');
      return res.redirect(`${FRONTEND_URL}/login?error=account_not_found`);
    }

    logger.error('Google OAuth callback failed', error);
    res.redirect(`${FRONTEND_URL}/login?error=oauth_error&message=Authentication+failed`);
  }
}
