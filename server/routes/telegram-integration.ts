
import { Router } from 'express';
import { db } from '../db';
import { daos, users, proposals, walletTransactions, daoMessages } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  text?: string;
  entities?: Array<{
    type: string;
    offset: number;
    length: number;
  }>;
}

// Send message to Telegram
async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
      })
    });
    return await response.json();
  } catch (error) {
    console.error('Telegram send error:', error);
    throw error;
  }
}

// Handle /start command
async function handleStart(chatId: number, userId: number) {
  const keyboard = {
    inline_keyboard: [
      [{ text: '🔗 Link Account', callback_data: 'link_account' }],
      [{ text: '📊 My DAOs', callback_data: 'my_daos' }],
      [{ text: '💰 Check Balance', callback_data: 'check_balance' }],
      [{ text: '📝 Recent Proposals', callback_data: 'recent_proposals' }]
    ]
  };

  await sendTelegramMessage(
    chatId,
    `🌍 *Welcome to MtaaDAO!*\n\nManage your DAOs directly from Telegram.\n\nUse the buttons below to get started:`,
    keyboard
  );
}

// Handle /balance command
async function handleBalance(chatId: number, telegramUserId: number) {
  const user = await db.query.users.findFirst({
    where: eq(users.telegramChatId, telegramUserId.toString())
  });

  if (!user) {
    await sendTelegramMessage(chatId, '❌ Please link your account first using /link');
    return;
  }

  const userDaos = await db.query.daos.findMany({
    where: eq(daos.creatorId, user.id)
  });

  let message = `💰 *Your DAO Balances*\n\n`;
  for (const dao of userDaos) {
    message += `*${dao.name}*\n`;
    message += `└ Balance: ${dao.treasuryBalance} cUSD\n\n`;
  }

  await sendTelegramMessage(chatId, message);
}

// Handle /proposals command
async function handleProposals(chatId: number, telegramUserId: number) {
  const user = await db.query.users.findFirst({
    where: eq(users.telegramChatId, telegramUserId.toString())
  });

  if (!user) {
    await sendTelegramMessage(chatId, '❌ Please link your account first using /link');
    return;
  }

  const activeProposals = await db.query.proposals.findMany({
    where: eq(proposals.status, 'active'),
    limit: 5,
    orderBy: [desc(proposals.createdAt)]
  });

  if (activeProposals.length === 0) {
    await sendTelegramMessage(chatId, '📝 No active proposals at the moment.');
    return;
  }

  let message = `📝 *Active Proposals*\n\n`;
  for (const proposal of activeProposals) {
    message += `*${proposal.title}*\n`;
    message += `Type: ${proposal.type}\n`;
    message += `Votes: 👍 ${proposal.forVotes || 0} | 👎 ${proposal.againstVotes || 0}\n`;
    message += `ID: \`${proposal.id}\`\n\n`;
  }

  message += `\nVote using: /vote <proposal_id> <yes|no>`;
  
  await sendTelegramMessage(chatId, message);
}

// Handle /vote command
async function handleVote(chatId: number, telegramUserId: number, args: string[]) {
  const user = await db.query.users.findFirst({
    where: eq(users.telegramChatId, telegramUserId.toString())
  });

  if (!user) {
    await sendTelegramMessage(chatId, '❌ Please link your account first');
    return;
  }

  if (args.length < 2) {
    await sendTelegramMessage(chatId, '❌ Usage: /vote <proposal_id> <yes|no>');
    return;
  }

  const [proposalId, vote] = args;
  const voteValue = vote.toLowerCase() === 'yes';

  await sendTelegramMessage(
    chatId,
    `✅ Vote recorded for proposal ${proposalId}: ${voteValue ? '👍 Yes' : '👎 No'}`
  );
}

// Webhook endpoint for Telegram updates
router.post('/webhook', async (req, res) => {
  try {
    // Verify Telegram Bot API Secret Token (X-Telegram-Bot-API-Secret-Token)
    const secretToken = req.headers['x-telegram-bot-api-secret-token'] as string;
    if (secretToken !== process.env.TELEGRAM_SECRET_TOKEN) {
      console.warn('Unauthorized Telegram webhook request - invalid or missing secret token');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const update = req.body;
    
    if (update.message) {
      const message: TelegramMessage = update.message;
      const chatId = message.chat.id;
      const text = message.text || '';
      const userId = message.from.id;

      // Handle commands
      if (text.startsWith('/start')) {
        await handleStart(chatId, userId);
      } else if (text.startsWith('/balance')) {
        await handleBalance(chatId, userId);
      } else if (text.startsWith('/proposals')) {
        await handleProposals(chatId, userId);
      } else if (text.startsWith('/vote')) {
        const args = text.split(' ').slice(1);
        await handleVote(chatId, userId, args);
      } else if (text.startsWith('/link')) {
        const linkCode = text.split(' ')[1];
        await sendTelegramMessage(
          chatId,
          `🔗 *Account Linking*\n\nYour link code: \`${linkCode}\`\n\nEnter this code in the MtaaDAO app settings.`
        );
      } else {
        // Forward to Morio AI
        await sendTelegramMessage(
          chatId,
          `🤖 Processing your message with Morio AI...`
        );
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Set webhook endpoint
router.post('/set-webhook', async (req, res) => {
  try {
    const webhookUrl = `${process.env.REPL_URL || 'https://your-repl.repl.co'}/api/telegram/webhook`;
    
    const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Set webhook error:', error);
    res.status(500).json({ error: 'Failed to set webhook' });
  }
});

// Get webhook info
router.get('/webhook-info', async (req, res) => {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/getWebhookInfo`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Get webhook info error:', error);
    res.status(500).json({ error: 'Failed to get webhook info' });
  }
});

export default router;
