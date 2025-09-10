import { Request, Response } from 'express';

export async function authOAuthGoogleHandler(req: Request, res: Response) {
  // ...migrate logic from client/src/pages/api/auth/oauth-google.ts...
  res.json({ message: 'Auth OAuth Google endpoint migrated to Express.' });
}
