import type { Request, Response } from 'express';
import crypto from 'crypto';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT || 'http://localhost:5000/api/auth/oauth/google/callback';

/**
 * Generate PKCE code challenge and verifier
 * PKCE (RFC 7636) prevents authorization code interception attacks
 */
function generatePKCE() {
  const codeVerifier = crypto
    .randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return { codeVerifier, codeChallenge };
}

/**
 * Generate cryptographically secure OAuth state parameter
 * FIX: Prevents CSRF attacks by generating unguessable state
 */
function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function authOauthGoogleHandler(req: Request, res: Response) {
  try {
    const { mode = 'login' } = req.query;
    
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    // FIX #1 & #6: Generate cryptographically secure state and PKCE parameters
    const oauthState = generateOAuthState();
    const { codeVerifier, codeChallenge } = generatePKCE();

    // Store state in secure HTTP-only cookie (expires in 10 minutes)
    res.cookie('oauth_state', oauthState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    // Store PKCE code_verifier in secure HTTP-only cookie
    res.cookie('oauth_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    // Store mode preference in secure cookie for callback to use
    res.cookie('oauth_mode', mode as string, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      state: oauthState,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256', // SHA256 method for PKCE
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    res.redirect(authUrl);
  } catch (error) {
    console.error('OAuth initialization failed:', error);
    res.status(500).json({ error: 'OAuth initialization failed' });
  }
}
