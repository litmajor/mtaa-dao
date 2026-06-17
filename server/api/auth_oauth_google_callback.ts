import { Request, Response } from 'express';
import axios from 'axios';
import { db } from '../storage';
import { users, userIdentities } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { generateTokens } from '../auth';
import { Logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

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

export async function authOauthGoogleCallbackHandler(req: Request, res: Response) {
  try {
    const { code, state, error } = req.query;

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

    // Parse state to determine mode (login/register)
    const stateData = state ? JSON.parse(Buffer.from(state as string, 'base64').toString()) : { mode: 'login' };

    // Exchange code for access token
    const tokenResponse = await axios.post<GoogleTokenResponse>('https://oauth2.googleapis.com/token', {
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    });

    const { access_token } = tokenResponse.data;

    // Get user info from Google
    const userInfoResponse = await axios.get<GoogleUserInfo>(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${access_token}`
    );

    const googleUser = userInfoResponse.data;

    if (!googleUser.verified_email) {
      logger.warn('Google email not verified', { email: googleUser.email });
      return res.redirect(`${FRONTEND_URL}/login?error=email_not_verified`);
    }

    // First try to find a linked identity by provider user id
    const existingIdentity = await db
      .select()
      .from(userIdentities)
      .where(and(eq(userIdentities.provider, 'google'), eq(userIdentities.providerUserId, googleUser.id)))
      .limit(1);

    let user;

    if (existingIdentity.length > 0) {
      // Identity exists -> fetch the user
      const identity = existingIdentity[0];
      const userResult = await db.select().from(users).where(eq(users.id, identity.userId)).limit(1);
      if (userResult.length === 0) {
        logger.error('Identity exists but user not found', { identityId: identity.id });
        return res.redirect(`${FRONTEND_URL}/login?error=oauth_error`);
      }
      user = userResult[0];
      // Update basic profile fields
      await db
        .update(users)
        .set({
          firstName: googleUser.given_name || user.firstName,
          lastName: googleUser.family_name || user.lastName,
          profileImageUrl: googleUser.picture || user.profileImageUrl,
          isEmailVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      logger.info('Existing user logged in via Google OAuth (via identity)', { userId: user.id });
    } else {
      // No identity found - try to find user by email
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, googleUser.email))
        .limit(1);

      if (existingUser.length > 0) {
        user = existingUser[0];
        // Link the identity
        await db.insert(userIdentities).values({
          id: crypto.randomUUID(),
          userId: user.id,
          provider: 'google',
          providerUserId: googleUser.id,
          profile: { name: googleUser.name, picture: googleUser.picture, raw: googleUser },
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db
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
      } else {
        // Create new user if registration allowed
        if (stateData.mode !== 'register') {
          return res.redirect(`${FRONTEND_URL}/login?error=account_not_found`);
        }

        const newUserResult = await db
          .insert(users)
          .values({
            id: crypto.randomUUID(), // Generate a unique ID for the user
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

        // Insert identity linked to new user
        await db.insert(userIdentities).values({
          id: crypto.randomUUID(),
          userId: user.id,
          provider: 'google',
          providerUserId: googleUser.id,
          profile: { name: googleUser.name, picture: googleUser.picture, raw: googleUser },
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        logger.info('New user created via Google OAuth', { userId: user.id });
      }
    }

    // Generate tokens
    const tokens = generateTokens({
      sub: user.id,
      email: user.email ?? '',
      role: user.roles ?? 'member',
    });

    // Set HTTP-only cookie for refresh token
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend with access token
    const redirectUrl = `${FRONTEND_URL}/dashboard?token=${tokens.accessToken}`;
    res.redirect(redirectUrl);

  } catch (error) {
    logger.error('Google OAuth callback failed', error);
    res.redirect(`${FRONTEND_URL}/login?error=oauth_error`);
  }
}
