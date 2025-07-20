import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from './storage';
import { vaults } from '../shared/schema';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Optionally filter by userId if available: req.query.userId
    const result = await db.select().from(vaults);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vaults' });
  }
}
