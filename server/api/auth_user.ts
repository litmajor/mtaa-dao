import { Request, Response } from 'express';

export async function authUserHandler(req: Request, res: Response) {
  // ...migrate logic from client/src/pages/api/auth/user.ts...
  res.json({ message: 'Auth user endpoint migrated to Express.' });
}
