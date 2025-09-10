import { Request, Response } from 'express';

export async function authRegisterHandler(req: Request, res: Response) {
  // ...migrate logic from client/src/pages/api/auth/register.ts...
  res.json({ message: 'Auth register endpoint migrated to Express.' });
}
