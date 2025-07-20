import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserByEmail } from '../client/src/server/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { emailOrPhone, password } = req.body;
  try {
    const user = await getUserByEmail(emailOrPhone);
    if (!user) return res.status(401).json({ error: 'User not found' });
    // Real password check (assuming user.password exists and is plain text for demo)
    if (!user.password || user.password !== password) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    res.status(200).json({ userId: user.id });
  } catch (e: any) {
    res.status(401).json({ error: e.message || 'Login failed' });
  }
}
