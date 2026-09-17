import { type Request, type Response } from 'express';
import crypto from 'crypto';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.APP_URL || 'http://localhost:5000';

/**
 * Generate Telegram login URL for authentication via Telegram bot
 * 
 * Telegram Login Widget uses a simple approach:
 * - User clicks login button on frontend
 * - Frontend generates auth request with bot token and callback URL
 * - Telegram bot verifies user identity
 * - Returns to our callback with user data
 */
export async function authTelegramInitHandler(req: Request, res: Response) {
  try {
    const { mode = 'login' } = req.query;
    
    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({ error: 'Telegram bot not configured' });
    }

    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    const mode_str = mode === 'register' ? 'register' : 'login';

    // Store state in HTTP-only cookie (10 minute expiry)
    res.cookie('telegram_auth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    // Store mode in HTTP-only cookie
    res.cookie('telegram_auth_mode', mode_str, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    /**
     * Telegram login widget URL
     * The bot must have /start command enabled with deeplink support
     * User will be redirected to our callback endpoint after authentication
     */
    const callbackUrl = `${APP_URL}/api/auth/telegram/callback`;
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'YourBotUsername';
    
    // Telegram login via bot deeplink
    // User will authenticate and be redirected to callback with auth data
    const telegramLoginUrl = `https://t.me/${botUsername}?start=auth_${state}`;

    // Redirect to Telegram bot for authentication
    return res.redirect(telegramLoginUrl);
  } catch (error) {
    console.error('Telegram auth init error:', error);
    return res.status(500).json({ error: 'Telegram authentication failed' });
  }
}
