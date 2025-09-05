import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getUserByEmail } from '../client/src/server/storage';
import { generateTokens } from './auth';
import { createSession } from './sessionService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { emailOrPhone, password, rememberMe = false } = req.body;
  
  try {
    const user = await getUserByEmail(emailOrPhone);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password with bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password || '');
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email || undefined,
      role: user.role || 'user'
    });

    // Create session
    const sessionId = uuidv4();
    createSession(
      sessionId,
      user.id,
      {
        email: user.email || undefined,
        role: user.role || 'user'
      },
      {
        ip: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || '',
        userAgent: req.headers['user-agent'] || ''
      }
    );

    // Set cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 7 days or 1 day
    };

    res.setHeader('Set-Cookie', [
      `refreshToken=${tokens.refreshToken}; ${Object.entries(cookieOptions).map(([k, v]) => `${k}=${v}`).join('; ')}; Path=/`,
      `sessionId=${sessionId}; ${Object.entries(cookieOptions).map(([k, v]) => `${k}=${v}`).join('; ')}; Path=/`
    ]);

    res.status(200).json({ 
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role || 'user'
      }
    });
  } catch (e: any) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Login failed' });
  }
}
