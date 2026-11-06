/**
 * OAuth Identity Linking Confirmation Handler
 * 
 * FIX #4: When a user attempts to login with OAuth but has an existing password-protected account,
 * they must confirm via password before linking the OAuth provider to their account.
 * This prevents unauthorized account takeovers.
 */

import type { Request, Response } from 'express';
import { db } from '../storage';
import { users, userIdentities } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { verifyPassword, generateTokens } from '../auth';
import { Logger } from '../utils/logger';
import { setAuthSessionCookies } from '../utils/authSessionCookies';

const logger = new Logger('auth-confirm-identity-linking');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5000';

interface ConfirmLinkingRequest {
  email: string;
  password: string;
}

/**
 * Confirm and complete OAuth identity linking after password verification
 */
export async function authConfirmIdentityLinkingHandler(req: Request, res: Response) {
  try {
    const { email, password } = req.body as ConfirmLinkingRequest;

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.',
      });
    }

    // Retrieve pending identity from cookie as additional verification
    const pendingIdentityCookie = req.cookies?.['oauth_pending_identity'];
    if (!pendingIdentityCookie) {
      logger.warn('No pending identity found in cookie', { email });
      return res.status(400).json({
        success: false,
        error: 'Session expired. Please restart the login process.',
      });
    }

    let pendingIdentity;
    try {
      pendingIdentity = JSON.parse(pendingIdentityCookie);
    } catch (error) {
      logger.warn('Failed to parse pending identity cookie');
      return res.status(400).json({
        success: false,
        error: 'Invalid session data',
      });
    }

    // Verify the email matches
    if (pendingIdentity.email !== email) {
      logger.warn('Email mismatch between cookie and request', { cookieEmail: pendingIdentity.email, requestEmail: email });
      return res.status(400).json({
        success: false,
        error: 'Email mismatch',
      });
    }

    const provider = pendingIdentity.provider === 'telegram' ? 'telegram' : 'google';
    const providerUserId = pendingIdentity.providerUserId || pendingIdentity.googleId;
    if (typeof providerUserId !== 'string' || !providerUserId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid OAuth identity',
      });
    }
    const profile = pendingIdentity.profile || {};
    const profileName = typeof profile.name === 'string' ? profile.name : '';
    const profilePicture = typeof profile.picture === 'string' ? profile.picture : '';

    // Atomically verify password and link identity
    const result = await db.transaction(async (tx) => {
      // Fetch user
      const userResult = await tx
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (userResult.length === 0) {
        throw new Error('USER_NOT_FOUND');
      }

      const user = userResult[0];

      // Verify password
      if (!user.password) {
        throw new Error('USER_HAS_NO_PASSWORD');
      }

      const isPasswordValid = await verifyPassword(password, user.password);
      if (!isPasswordValid) {
        logger.warn('Invalid password provided', { email, userId: user.id });
        throw new Error('INVALID_PASSWORD');
      }

      // Check if this OAuth identity is already linked to a different account
      const existingIdentity = await tx
        .select()
        .from(userIdentities)
        .where(and(
          eq(userIdentities.provider, provider),
          eq(userIdentities.providerUserId, providerUserId)
        ))
        .limit(1);

      if (existingIdentity.length > 0) {
        logger.warn('OAuth identity already linked to different account', { 
          providerUserId,
          existingUserId: existingIdentity[0].userId,
          requestingUserId: user.id 
        });
        throw new Error('IDENTITY_ALREADY_LINKED');
      }

      // Link the OAuth identity to this account
      await tx.insert(userIdentities).values({
        id: crypto.randomUUID(),
        userId: user.id,
        provider,
        providerUserId,
        profile: {
          name: profileName,
          picture: profilePicture,
          raw: pendingIdentity.profile?.raw || {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Update user profile if needed
      await tx
        .update(users)
        .set({
          profileImageUrl: profilePicture || user.profileImageUrl,
          ...(provider === 'google' ? { isEmailVerified: true } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      logger.info('Successfully linked OAuth identity after password confirmation', { userId: user.id });

      return user;
    });

    // Generate tokens
    const tokens = generateTokens({
      sub: result.id,
      email: result.email ?? '',
      role: result.roles ?? 'member',
    });

    // Store tokens in secure HTTP-only cookies
    setAuthSessionCookies(res, tokens);

    // Clear pending identity cookie
    res.clearCookie('oauth_pending_identity', { path: '/' });

    res.json({
      success: true,
      message: 'Identity linked successfully',
      redirectUrl: `${FRONTEND_URL}/dashboard`,
    });

  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'USER_NOT_FOUND':
          logger.warn('User not found during confirmation', { error });
          return res.status(404).json({
            success: false,
            error: 'Account not found',
          });
        case 'USER_HAS_NO_PASSWORD':
          logger.warn('User has no password set', { error });
          return res.status(400).json({
            success: false,
            error: 'Account has no password set',
          });
        case 'INVALID_PASSWORD':
          return res.status(401).json({
            success: false,
            error: 'Invalid password',
          });
        case 'IDENTITY_ALREADY_LINKED':
          return res.status(409).json({
            success: false,
            error: 'This OAuth account is already linked to a different user',
          });
      }
    }

    logger.error('Identity linking confirmation failed', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm identity linking',
    });
  }
}
