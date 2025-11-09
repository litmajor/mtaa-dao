
import { Router } from 'express';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Send notification via Telegram
export async function sendTelegramNotification(userId: string, message: string) {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user?.telegramChatId) {
      return { success: false, error: 'User has no Telegram linked' };
    }

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegramChatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    return { success: response.ok };
  } catch (error) {
    console.error('Telegram notification error:', error);
    return { success: false, error };
  }
}

// Webhook for Telegram bot commands
router.post('/webhook', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message?.text) {
      return res.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text;

    if (text.startsWith('/link')) {
      const userId = text.split(' ')[1];
      
      if (userId) {
        await db.update(users)
          .set({ telegramChatId: chatId.toString() })
          .where(eq(users.id, userId));

        await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '✅ Your MtaaDAO account has been linked! You will now receive notifications here.'
          })
        });
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.status(500).json({ error: 'Webhook error' });
  }
});

export default router;
