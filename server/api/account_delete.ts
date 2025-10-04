import type { AuthRequest } from '../auth';
import { Response } from 'express';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export async function accountDeleteHandler(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.claims?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await db.delete(users).where(eq(users.id, userId));

    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
}