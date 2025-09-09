import { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromToken } from '../../../../../server/auth';
import { storage } from '../../../../../server/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user from accessToken cookie
    const user = getUserFromToken(req);
    if (!user || !user.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Delete user account
    if (typeof storage.deleteUserAccount === 'function') {
      await storage.deleteUserAccount(user.userId);
    } else {
      return res.status(500).json({ error: 'Delete method not available on storage' });
    }

    // Optionally clear cookies/session here
    res.setHeader('Set-Cookie', [
      'accessToken=; Max-Age=0; Path=/;',
      'refreshToken=; Max-Age=0; Path=/;'
    ]);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
}
