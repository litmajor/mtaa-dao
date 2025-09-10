import { Request, Response } from 'express';

export async function accountDeleteHandler(req: Request, res: Response) {
  // ...migrate logic from client/src/pages/api/account/delete.ts...
  res.json({ message: 'Account delete endpoint migrated to Express.' });
}
import { Request, Response } from 'express';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export async function deleteAccount(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
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
