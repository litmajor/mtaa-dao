import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from './storage'; // Adjust the import path as necessary

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.cookies.userId;
  if (!userId) return res.status(401).json(null);
  try {
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json(null);
    res.status(200).json(user);
  } catch {
    res.status(401).json(null);
  }
}
