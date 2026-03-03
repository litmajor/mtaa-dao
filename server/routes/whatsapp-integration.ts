
import { Router } from 'express';
import crypto from 'crypto';
import express from 'express';
import { db } from '../db';
import { users, daos } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_APP_ID = process.env.WHATSAPP_APP_ID;
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET;

// Raw body parser for webhook verification
const rawBodyParser = express.raw({ type: 'application/json' });

// Send WhatsApp message
async function sendWhatsAppMessage(to: string, message: string) {
  try {
    const response = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message }
      })
    });
    return await response.json();
  } catch (error) {
    console.error('WhatsApp send error:', error);
    throw error;
  }
}

// Send interactive message with buttons
async function sendInteractiveMessage(to: string, body: string, buttons: Array<{id: string; title: string}>) {
  try {
    const response = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: {
            buttons: buttons.map(btn => ({
              type: 'reply',
              reply: { id: btn.id, title: btn.title }
            }))
          }
        }
      })
    });
    return await response.json();
  } catch (error) {
    console.error('WhatsApp interactive message error:', error);
    throw error;
  }
}

/**
 * Verify WhatsApp webhook signature
 * Meta (WhatsApp) sends X-Hub-Signature-256 header with HMAC SHA256 of raw body
 */
function verifyWhatsAppSignature(payload: Buffer | string, signature: string): boolean {
  if (!WHATSAPP_APP_SECRET) {
    console.warn('WHATSAPP_APP_SECRET not configured - skipping signature verification');
    return false;
  }

  if (!signature) {
    console.warn('Missing X-Hub-Signature-256 header');
    return false;
  }

  const hash = crypto
    .createHmac('sha256', WHATSAPP_APP_SECRET)
    .update(payload)
    .digest('hex');
  
  const expectedSignature = `sha256=${hash}`;

  try {
    // Use timing-safe comparison to prevent timing attacks
    crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );
    return true;
  } catch {
    console.warn('WhatsApp signature mismatch - possible tampering or invalid secret');
    return false;
  }
}

// Webhook verification
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// Webhook for incoming messages
router.post('/webhook', rawBodyParser, async (req, res) => {
  try {
    // Verify signature before processing
    const signature = req.headers['x-hub-signature-256'] as string;
    const rawPayload = req.body; // Buffer from raw parser

    if (!verifyWhatsAppSignature(rawPayload, signature)) {
      console.error('WhatsApp webhook signature verification failed');
      return res.status(401).json({ error: 'Unauthorized - Invalid signature' });
    }

    // Parse JSON after signature verification
    const body = JSON.parse(rawPayload.toString());

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            const message = change.value.messages?.[0];
            if (!message) continue;

            const from = message.from;
            const text = message.text?.body || '';

            // Handle different commands
            if (text.toLowerCase().includes('balance')) {
              await handleBalanceRequest(from);
            } else if (text.toLowerCase().includes('proposal')) {
              await handleProposalsRequest(from);
            } else if (text.toLowerCase().includes('help')) {
              await handleHelpRequest(from);
            } else {
              // Forward to Morio AI
              await sendWhatsAppMessage(from, '🤖 Processing with Morio AI...');
            }
          }
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.status(500).send('Error');
  }
});

async function handleBalanceRequest(phoneNumber: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.phoneNumber, phoneNumber)
  });

  if (!user) {
    await sendWhatsAppMessage(phoneNumber, '❌ Account not found. Please register first.');
    return;
  }

  const userDaos = await db.query.daos.findMany({
    where: eq(daos.creatorId, user.id)
  });

  let message = '💰 *Your DAO Balances*\n\n';
  for (const dao of userDaos) {
    message += `${dao.name}: ${dao.treasuryBalance} cUSD\n`;
  }

  await sendWhatsAppMessage(phoneNumber, message);
}

async function handleProposalsRequest(phoneNumber: string) {
  await sendInteractiveMessage(
    phoneNumber,
    '📝 What would you like to do with proposals?',
    [
      { id: 'view_proposals', title: 'View Active' },
      { id: 'create_proposal', title: 'Create New' },
      { id: 'my_votes', title: 'My Votes' }
    ]
  );
}

async function handleHelpRequest(phoneNumber: string) {
  const helpMessage = `
🌍 *MtaaDAO WhatsApp Bot*

Commands:
• "balance" - Check your DAO balances
• "proposals" - Manage proposals
• "vote" - Vote on proposals
• "help" - Show this message

Need more help? Visit mtaadao.com
  `.trim();

  await sendWhatsAppMessage(phoneNumber, helpMessage);
}

// Send notification to user
export async function sendWhatsAppNotification(phoneNumber: string, message: string) {
  return await sendWhatsAppMessage(phoneNumber, message);
}

export default router;
