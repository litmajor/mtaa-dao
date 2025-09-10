import { Request, Response } from 'express';
import { getUserByEmail, createUser, loginUser } from '../storage';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT || 'http://localhost:5000/api/auth/oauth/google/callback';

async function getGoogleTokens(code: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error('Failed to get Google tokens');
  return res.json();
}

async function getGoogleProfile(access_token: string) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!res.ok) throw new Error('Failed to get Google profile');
  return res.json();
}

export async function authOauthGoogleCallbackHandler(req: Request, res: Response) {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).send('Missing code');
  }
  
  let mode = 'login';
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state as string, 'base64').toString());
      mode = decoded.mode || 'login';
    } catch {
      // Invalid state, default to login
    }
  }
  
  try {
    const tokens = await getGoogleTokens(code as string);
    const profile = await getGoogleProfile(tokens.access_token);
    
    let user = await getUserByEmail(profile.email);
    
    if (!user && mode === 'register') {
      user = await createUser({
        email: profile.email,
        name: profile.name,
        avatar: profile.picture,
        provider: 'google',
      });
    }
    
    if (!user) {
      return res.status(401).send('No account found. Please register first.');
    }
    
    // Log in user (set cookie/session)
    await loginUser(res, user);
    res.redirect('/dashboard');
  } catch (e: any) {
    console.error('OAuth error:', e);
    res.status(500).send(e.message || 'OAuth error');
  }
}
