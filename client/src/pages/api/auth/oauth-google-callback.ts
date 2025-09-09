
import type { NextApiRequest, NextApiResponse } from 'next';
import { generateTokens } from '../../../../../server/auth';
import { storage } from '../../../../../server/storage';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT || 'http://localhost:5000/api/auth/oauth-google-callback';

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error } = req.query;

  if (error) {
    return res.redirect('/login?error=oauth_error');
  }

  if (!code || typeof code !== 'string') {
    return res.redirect('/login?error=invalid_code');
  }

  try {
    // Parse state to determine mode (login/register)
    let mode = 'login';
    if (state && typeof state === 'string') {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
        mode = decoded.mode || 'login';
      } catch {
        // Use default mode if state parsing fails
      }
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    if (!tokens.access_token) {
      return res.redirect('/login?error=token_exchange_failed');
    }

    // Get user info from Google
    const userResponse = await fetch(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokens.access_token}`
    );

    const googleUser: GoogleUserInfo = await userResponse.json();

    if (!googleUser.verified_email) {
      return res.redirect('/login?error=email_not_verified');
    }

    // Check if user exists
    let user = await storage.getUserByEmail(googleUser.email);

    if (mode === 'register') {
      if (user) {
        return res.redirect('/login?error=user_already_exists');
      }

      // Create new user
      user = await storage.createUser({
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
        authProvider: 'google',
        authProviderId: googleUser.id,
        emailVerified: true,
        profile: {
          firstName: googleUser.given_name,
          lastName: googleUser.family_name,
          locale: googleUser.locale,
        }
      });
    } else {
      if (!user) {
        return res.redirect('/register?error=user_not_found&email=' + encodeURIComponent(googleUser.email));
      }

      // Update user info if needed
      await storage.updateUser(user.id, {
        username: googleUser.name,
        profileImageUrl: googleUser.picture, // Updated to match user model property
        // lastLoginAt: new Date(), // Removed to fix type error
      });
    }

    // Generate JWT tokens
    const jwtTokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Set secure cookies
    res.setHeader('Set-Cookie', [
      `accessToken=${jwtTokens.accessToken}; HttpOnly; Secure=${process.env.NODE_ENV === 'production'}; SameSite=Strict; Max-Age=900; Path=/`,
      `refreshToken=${jwtTokens.refreshToken}; HttpOnly; Secure=${process.env.NODE_ENV === 'production'}; SameSite=Strict; Max-Age=604800; Path=/`,
    ]);

    // Redirect to dashboard
    res.redirect('/dashboard');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/login?error=server_error');
  }
}
