import type { Request, Response } from 'express';
import crypto from 'node:crypto';

const APP_URL = process.env.APP_URL || 'http://localhost:5000';
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

export async function authTelegramInitHandler(req: Request, res: Response) {
  if (!TELEGRAM_BOT_USERNAME || !/^[A-Za-z0-9_]{5,32}$/.test(TELEGRAM_BOT_USERNAME)) {
    return res.status(503).json({ error: 'Telegram Login is not configured' });
  }

  const state = crypto.randomBytes(32).toString('hex');
  const mode = req.query.mode === 'register' ? 'register' : 'login';
  const callbackUrl = new URL('/api/auth/telegram/callback', APP_URL);
  callbackUrl.searchParams.set('state', state);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 10 * 60 * 1000,
    path: '/',
  };
  res.cookie('telegram_auth_state', state, cookieOptions);
  res.cookie('telegram_auth_mode', mode, cookieOptions);
  res.setHeader('Cache-Control', 'no-store');
  res.type('html');
  return res.send(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sign in with Telegram</title></head>
  <body>
    <main>
      <h1>Continue with Telegram</h1>
      <script async src="https://telegram.org/js/telegram-widget.js?22"
        data-telegram-login="${escapeHtml(TELEGRAM_BOT_USERNAME)}"
        data-size="large"
        data-auth-url="${escapeHtml(callbackUrl.toString())}"
        data-request-access="write"></script>
    </main>
  </body>
</html>`);
}
