import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getUserByEmail, loginUser } from '../../../server/storage';

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

    // Set JWT cookie and respond
    await loginUser(res, user);
    res.status(200).json({
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
