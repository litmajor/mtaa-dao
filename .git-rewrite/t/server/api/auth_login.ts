import { Request, Response } from 'express';

export async function authLoginHandler(req: Request, res: Response) {
  // ...migrate logic from client/src/pages/api/auth/login.ts...
  res.json({ message: 'Auth login endpoint migrated to Express.' });
}
