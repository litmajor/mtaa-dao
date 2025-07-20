import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertTelegramUser } from '../../../../../server/telegram';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { telegramId, phone, firstName, lastName, username, photoUrl } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'Missing telegramId' });
  try {
    const user = await upsertTelegramUser({ telegramId, phone, firstName, lastName, username, photoUrl });
    res.status(200).json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: 'Failed to upsert Telegram user' });
  }
}
