import type { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { users, telegramLinkTokens } from '../../shared/schema';
import { and, eq, gt } from 'drizzle-orm';
import { consumeTelegramStartAttribution } from '../services/referral-engine';

function generateTelegramLinkToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function authTelegramLinkHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.telegramChatId) {
      return res.status(400).json({
        error: 'Account already linked',
        message: 'Your Telegram account is already linked. Unlink it first to link a different account.',
      });
    }

    const linkToken = generateTelegramLinkToken();
    const expiresIn = 10 * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiresIn);

    await db.insert(telegramLinkTokens).values({
      userId,
      token: linkToken,
      expiresAt,
      used: false,
      createdAt: new Date(),
    });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'MtaaDAO_Bot';
    const deeplink = `https://t.me/${botUsername}?start=link_${linkToken}`;

    return res.json({
      ok: true,
      linkToken,
      expiresIn,
      expiresAt: expiresAt.toISOString(),
      botUsername,
      deeplink,
      instructions: {
        step1: `Open Telegram and search for @${botUsername}`,
        step2: 'Click "Start" or send /start command',
        step3: `Send the link token: ${linkToken}`,
        alternative: `Or click this link: ${deeplink}`,
      },
      qrCodeData: {
        type: 'telegram_deeplink',
        url: deeplink,
        info: 'Scan with Telegram to open the bot and link your account',
      },
    });
  } catch (error) {
    console.error('Telegram link handler error:', error);
    return res.status(500).json({
      error: 'Failed to generate link token',
      message: 'Please try again later',
    });
  }
}

export async function verifyAndUseTelegramLinkToken(
  token: string,
  telegramUserId: number,
  telegramUsername?: string
): Promise<any | null> {
  try {
    const linkRecord = await db.query.telegramLinkTokens.findFirst({
      where: and(
        eq(telegramLinkTokens.token, token),
        eq(telegramLinkTokens.used, false),
        gt(telegramLinkTokens.expiresAt, new Date())
      ),
    });

    if (!linkRecord) {
      return null;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, linkRecord.userId),
    });

    if (!user) {
      return null;
    }

    await db.transaction(async (tx) => {
      await tx.update(telegramLinkTokens)
        .set({
          used: true,
          usedAt: new Date(),
          linkedTelegramId: telegramUserId.toString(),
        })
        .where(eq(telegramLinkTokens.id, linkRecord.id));

      await consumeTelegramStartAttribution(telegramUserId, user.id);

      await tx.update(users)
        .set({
          telegramChatId: telegramUserId.toString(),
          telegramUsername: telegramUsername || user.telegramUsername || null,
        })
        .where(eq(users.id, user.id));
    });

    return user;
  } catch (error) {
    console.error('Telegram link token verification error:', error);
    return null;
  }
}
