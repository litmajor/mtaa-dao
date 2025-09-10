import { Request, Response } from 'express';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT || 'http://localhost:5000/api/auth/oauth/google/callback';

export async function authOauthGoogleHandler(req: Request, res: Response) {
  const { mode = 'login' } = req.query;
  
  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }
  
  const state = Buffer.from(JSON.stringify({ mode })).toString('base64');
  
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  res.redirect(authUrl);
}
