import type { NextApiRequest, NextApiResponse } from 'next';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT || 'http://localhost:3000/api/auth/oauth-google-callback';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { mode = 'login' } = req.query;
  const state = Buffer.from(JSON.stringify({ mode })).toString('base64');
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=openid%20email%20profile` +
    `&state=${state}`;
  res.redirect(url);
}
