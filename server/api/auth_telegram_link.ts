import { Request, Response } from 'express';

export async function authTelegramLinkHandler(req: Request, res: Response) {
  // ...migrate logic from client/src/pages/api/auth/telegram-link.ts...
  res.json({ message: 'Auth telegram link endpoint migrated to Express.' });
}
