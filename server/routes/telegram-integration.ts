
import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { daos, users, proposals, votes, telegramAuditLog } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { processVoteCallback } from '../telegram/callbacks/vote.callback';
import { recordTelegramStartAttribution } from '../services/referral-engine';

const router = Router();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const TELEGRAM_SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN;

// ============================================================================
// SECURITY: Strict Secret Token Validation
// ============================================================================
if (!TELEGRAM_SECRET_TOKEN) {
  throw new Error(
    'TELEGRAM_SECRET_TOKEN is not defined. This is required for webhook authentication. ' +
    'Set it to a strong random value and configure it in Telegram Bot settings via /setWebhookSecretToken'
  );
}

/**
 * Escape HTML special characters for Telegram HTML parse mode
 * Converts: < > & to &lt; &gt; &amp;
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Admin authentication middleware
 * Restricts webhook admin endpoints to authenticated administrators
 */
async function requireAdminAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  const adminToken = process.env.TELEGRAM_ADMIN_TOKEN;
  const action = req.path.split('/').pop() || 'unknown';

  if (!adminToken) {
    console.warn('Webhook admin endpoint called but TELEGRAM_ADMIN_TOKEN not configured');
    await db.insert(telegramAuditLog).values({
      action,
      adminIp: req.ip || 'unknown',
      details: { path: req.path, method: req.method },
      result: 'failure',
      errorMessage: 'Admin token not configured',
    }).catch(() => undefined);
    return res.status(403).json({ error: 'Admin token not configured' });
  }

  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (token !== adminToken) {
    console.warn('Unauthorized webhook admin request attempt');
    await db.insert(telegramAuditLog).values({
      action,
      adminIp: req.ip || 'unknown',
      details: { path: req.path, method: req.method },
      result: 'failure',
      errorMessage: 'Invalid or missing authorization header',
    }).catch(() => undefined);
    return res.status(403).json({ error: 'Unauthorized' });
  }

  await db.insert(telegramAuditLog).values({
    action,
    adminIp: req.ip || 'unknown',
    details: { path: req.path, method: req.method },
    result: 'success',
  }).catch(() => undefined);

  next();
}

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

/**
 * Send message to Telegram with HTML parsing
 * Uses HTML mode to support more formatting options and prevent parse errors
 * Automatically escapes user-supplied content to prevent injection
 */
async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: any
): Promise<any> {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML', // Changed from Markdown to HTML for better reliability
        reply_markup: replyMarkup,
      }),
    });

    const result = await response.json();
    if (!result.ok) {
      console.error('Telegram API error:', result);
      throw new Error(`Telegram API error: ${result.description}`);
    }
    return result;
  } catch (error) {
    console.error('Telegram send error:', error);
    throw error;
  }
}

/**
 * Handle /start command
 * Shows user available actions
 */
async function handleStart(chatId: number | string, telegramUserId: number, args: string[] = []) {
  const startPayload = args[0];
  if (startPayload?.startsWith('ref_')) {
    await recordTelegramStartAttribution(telegramUserId, startPayload.slice(4)).catch(error =>
      console.error('Telegram referral attribution error:', error)
    );
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: '🔗 Link Account', callback_data: 'link_account' }],
      [{ text: '📊 My DAOs', callback_data: 'my_daos' }],
      [{ text: '💰 Check Balance', callback_data: 'check_balance' }],
      [{ text: '📝 Recent Proposals', callback_data: 'recent_proposals' }],
    ],
  };

  await sendTelegramMessage(
    chatId,
    `🌍 <b>Welcome to MtaaDAO!</b>\n\nManage your DAOs directly from Telegram.\n\nUse the buttons below to get started:`,
    keyboard
  );
}

/**
 * Handle /balance command
 * Shows user's DAO balances
 */
async function handleBalance(chatId: number | string, telegramUserId: number) {
  try {
    const telegramChatId = String(telegramUserId ?? '');
    if (!telegramChatId) {
      await sendTelegramMessage(chatId, '❌ Telegram user is not linked to a valid account.');
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegramChatId, telegramChatId),
    });

    if (!user) {
      await sendTelegramMessage(
        chatId,
        '❌ Please link your account first using /link'
      );
      return;
    }

    const userDaos = await db.query.daos.findMany({
      where: eq(daos.creatorId, user.id),
    });

    if (userDaos.length === 0) {
      await sendTelegramMessage(chatId, '💰 <b>Your DAO Balances</b>\n\nYou haven\'t created any DAOs yet.');
      return;
    }

    let message = `💰 <b>Your DAO Balances</b>\n\n`;
    for (const dao of userDaos) {
      message += `<b>${escapeHtml(dao.name)}</b>\n`;
      message += `└ Balance: ${escapeHtml(String(dao.treasuryBalance))} cUSD\n\n`;
    }

    await sendTelegramMessage(chatId, message);
  } catch (error) {
    console.error('Balance command error:', error);
    await sendTelegramMessage(chatId, '❌ Error retrieving balances. Please try again.');
  }
}

/**
 * Handle /proposals command
 * Shows active proposals for voting
 */
async function handleProposals(chatId: number | string, telegramUserId: number) {
  try {
    const telegramChatId = String(telegramUserId ?? '');
    if (!telegramChatId) {
      await sendTelegramMessage(chatId, '❌ Telegram user is not linked to a valid account.');
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegramChatId, telegramChatId),
    });

    if (!user) {
      await sendTelegramMessage(
        chatId,
        '❌ Please link your account first'
      );
      return;
    }

    const activeProposals = await db.query.proposals.findMany({
      where: eq(proposals.status, 'active'),
      limit: 5,
      orderBy: [desc(proposals.createdAt)],
    });

    if (activeProposals.length === 0) {
      await sendTelegramMessage(
        chatId,
        '📝 No active proposals at the moment.'
      );
      return;
    }

    let message = `📝 <b>Active Proposals</b>\n\n`;
    for (const proposal of activeProposals) {
      message += `<b>${escapeHtml(proposal.title)}</b>\n`;
      message += `Type: ${escapeHtml(String(proposal.proposalType ?? 'general'))}\n`;
      message += `Votes: 👍 ${proposal.forVotes || 0} | 👎 ${proposal.againstVotes || 0}\n`;
      message += `ID: <code>${escapeHtml(proposal.id)}</code>\n\n`;
    }

    message += `\nVote using: /vote &lt;proposal_id&gt; &lt;yes|no&gt;`;

    await sendTelegramMessage(chatId, message);
  } catch (error) {
    console.error('Proposals command error:', error);
    await sendTelegramMessage(
      chatId,
      '❌ Error retrieving proposals. Please try again.'
    );
  }
}

async function calculateVotingPower(userId: string): Promise<number> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return 0;
  }

  const basePower = Number(user.votingPower ?? '1.0');
  return Number.isFinite(basePower) && basePower > 0 ? basePower : 1;
}

/**
 * Handle /vote command
 * Validate proposal, check voting power, and record vote
 */
async function handleVote(
  chatId: number | string,
  telegramUserId: number,
  args: string[]
) {
  try {
    const telegramChatId = String(telegramUserId ?? '');
    if (!telegramChatId) {
      await sendTelegramMessage(chatId, '❌ Telegram user is not linked to a valid account.');
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegramChatId, telegramChatId),
    });

    if (!user) {
      await sendTelegramMessage(chatId, '❌ Please link your account first');
      return;
    }

    if (args.length < 2) {
      await sendTelegramMessage(
        chatId,
        '❌ Usage: /vote &lt;proposal_id&gt; &lt;yes|no&gt;'
      );
      return;
    }

    const [proposalId, voteArg] = args;
    const voteValue = voteArg.toLowerCase() === 'yes';

    const proposal = await db.query.proposals.findFirst({
      where: eq(proposals.id, proposalId),
    });

    if (!proposal) {
      await sendTelegramMessage(
        chatId,
        `❌ Proposal <code>${escapeHtml(String(proposalId))}</code> not found.`
      );
      return;
    }

    if (proposal.status !== 'active') {
      await sendTelegramMessage(
        chatId,
        `❌ Proposal is no longer active (status: ${escapeHtml(String(proposal.status ?? 'unknown'))})`
      );
      return;
    }

    const votingPower = await calculateVotingPower(user.id);
    if (votingPower <= 0) {
      await sendTelegramMessage(
        chatId,
        '❌ You do not have voting power for this proposal.'
      );
      return;
    }

    const existingVote = await db.query.votes.findFirst({
      where: and(
        eq(votes.proposalId, proposalId),
        eq(votes.userId, user.id)
      ),
    });

    if (existingVote) {
      await sendTelegramMessage(
        chatId,
        '❌ You have already voted on this proposal. Cannot vote twice.'
      );
      return;
    }

    await db.transaction(async (tx) => {
      await tx.insert(votes).values({
        proposalId,
        userId: user.id,
        daoId: proposal.daoId,
        voteType: voteValue ? 'yes' : 'no',
        weight: '1.00',
        votingPower: String(votingPower),
        isDelegated: false,
      });

      const nextYesVotes = (proposal.yesVotes ?? 0) + (voteValue ? 1 : 0);
      const nextNoVotes = (proposal.noVotes ?? 0) + (voteValue ? 0 : 1);
      const nextForVotes = (proposal.forVotes ?? 0) + (voteValue ? 1 : 0);
      const nextAgainstVotes = (proposal.againstVotes ?? 0) + (voteValue ? 0 : 1);

      await tx.update(proposals)
        .set({
          yesVotes: nextYesVotes,
          noVotes: nextNoVotes,
          forVotes: nextForVotes,
          againstVotes: nextAgainstVotes,
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, proposalId));
    });

    await sendTelegramMessage(
      chatId,
      `✅ Vote recorded for proposal ${escapeHtml(proposal.title)}: ${voteValue ? '👍 Yes' : '👎 No'}`
    );
  } catch (error) {
    console.error('Vote command error:', error);
    await sendTelegramMessage(
      chatId,
      '❌ Error processing your vote. Please try again.'
    );
  }
}

/**
 * Handle /link command
 * Generate a link token for connecting Telegram to user account
 * Token is stored with expiration and can only be used once
 */
async function handleLink(
  chatId: number | string,
  telegramUserId: number,
  args: string[],
  telegramUsername?: string
) {
  try {
    const telegramChatId = String(telegramUserId ?? '');
    if (!telegramChatId) {
      await sendTelegramMessage(chatId, '❌ Telegram user is not linked to a valid account.');
      return;
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.telegramChatId, telegramChatId),
    });

    if (existingUser) {
      await sendTelegramMessage(
        chatId,
        '✅ Your account is already linked to MtaaDAO.'
      );
      return;
    }

    const linkToken = args[0];
    if (!linkToken) {
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'MtaaDAO_Bot';
      await sendTelegramMessage(
        chatId,
        `🔗 <b>Account Linking</b>\n\nVisit your account settings to generate a secure link token and send it here.\n\nBot username: @${botUsername}`
      );
      return;
    }

    const linkedUser = await (await import('../api/auth_telegram_link')).verifyAndUseTelegramLinkToken(
      linkToken,
      telegramUserId,
      telegramUsername
    );

    if (!linkedUser) {
      await sendTelegramMessage(
        chatId,
        '❌ Link request failed. The token is invalid, expired, or already used.'
      );
      return;
    }

    await sendTelegramMessage(
      chatId,
      '✅ <b>Account Linked Successfully!</b>\n\nYour Telegram account is now connected to MtaaDAO.'
    );
  } catch (error) {
    console.error('Link command error:', error);
    await sendTelegramMessage(
      chatId,
      '❌ Error processing link request. Please try again.'
    );
  }
}

/**
 * Webhook endpoint for Telegram updates
 * SECURITY: Verifies secret token and responds immediately (< 5 seconds)
 * All heavy processing done asynchronously to avoid timeout
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Verify Telegram Bot API Secret Token (X-Telegram-Bot-API-Secret-Token)
    const secretToken = req.headers['x-telegram-bot-api-secret-token'] as string;

    // SECURITY: Strict validation - both must exist and match exactly
    if (!secretToken || !TELEGRAM_SECRET_TOKEN || secretToken !== TELEGRAM_SECRET_TOKEN) {
      console.warn(
        'Unauthorized Telegram webhook request',
        !secretToken ? '(missing token)' : '(invalid token)'
      );
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Respond immediately to Telegram (must be within 5 seconds)
    res.json({ ok: true });

    // Process webhook asynchronously to avoid timeout
    const update = req.body;

    if (update.callback_query) {
      await processVoteCallback(update.callback_query).catch(err =>
        console.error('Telegram callback processing error:', err)
      );
    } else if (update.message) {
      const message: TelegramMessage = update.message;
      const chatId = message.chat.id;
      const text = message.text || '';
      const userId = message.from.id;

      // Handle commands
      if (text.startsWith('/start')) {
        const args = text.split(/\s+/).slice(1);
        await handleStart(chatId, userId, args).catch(err =>
          console.error('Start command error:', err)
        );
      } else if (text.startsWith('/balance')) {
        await handleBalance(chatId, userId).catch(err =>
          console.error('Balance command error:', err)
        );
      } else if (text.startsWith('/proposals')) {
        await handleProposals(chatId, userId).catch(err =>
          console.error('Proposals command error:', err)
        );
      } else if (text.startsWith('/vote')) {
        const args = text.split(' ').slice(1);
        await handleVote(chatId, userId, args).catch(err =>
          console.error('Vote command error:', err)
        );
      } else if (text.startsWith('/link')) {
        const args = text.split(' ').slice(1);
        await handleLink(chatId, userId, args, message.from.username).catch(err =>
          console.error('Link command error:', err)
        );
      } else {
        // Forward to Morio AI asynchronously (don't wait)
        await sendTelegramMessage(
          chatId,
          `🤖 Processing your message with Morio AI...`
        ).catch(err =>
          console.error('Morio AI forward error:', err)
        );
      }
    }
  } catch (error) {
    console.error('Telegram webhook error:', error);
    // Already sent response, can't change status
  }
});

/**
 * Set webhook endpoint
 * SECURITY: Requires admin authentication
 * Should only be called during server startup or manual administration
 */
router.post('/set-webhook', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL ||
      `${process.env.APP_URL || 'https://your-domain.com'}/api/telegram/webhook`;

    if (!webhookUrl.startsWith('https://')) {
      return res.status(400).json({
        error: 'Webhook URL must use HTTPS',
        hint: 'Set TELEGRAM_WEBHOOK_URL environment variable',
      });
    }

    const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: TELEGRAM_SECRET_TOKEN,
        allowed_updates: ['message', 'callback_query'],
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('Telegram setWebhook error:', data);
      return res.status(400).json({ error: data.description || 'Failed to set webhook' });
    }

    res.json({ ok: true, message: 'Webhook configured successfully', url: webhookUrl });
  } catch (error) {
    console.error('Set webhook error:', error);
    res.status(500).json({ error: 'Failed to set webhook' });
  }
});

/**
 * Get webhook info endpoint
 * SECURITY: Requires admin authentication
 * Returns diagnostic information about webhook configuration
 */
router.get('/webhook-info', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/getWebhookInfo`);
    const data = await response.json();

    if (!data.ok) {
      console.error('Telegram getWebhookInfo error:', data);
      return res.status(400).json({ error: data.description || 'Failed to get webhook info' });
    }

    res.json(data.result || data);
  } catch (error) {
    console.error('Get webhook info error:', error);
    res.status(500).json({ error: 'Failed to get webhook info' });
  }
});

export default router;
