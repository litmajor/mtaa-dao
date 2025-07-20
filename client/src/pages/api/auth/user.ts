//user ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '@/server/storage';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        const user = await storage.getUserFromToken(req);
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }   
        return res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

export const users = {
  getUserByEmail: storage.getUserByEmail,
  createUser: storage.createUser,
  loginUser: storage.loginUser,
  getUserById: storage.getUserById,
  getUserByPhone: storage.getUserByPhone,
  updateUser: storage.updateUser,
  deleteUser: storage.deleteUser,
  logout: storage.logout,
  getUserFromToken: storage.getUserFromToken,
};
