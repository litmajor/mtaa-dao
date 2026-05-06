import express from 'express';
import { db } from '../../../storage';
import { escrowAccounts, escrowMilestones, escrowDisputes } from '../../../../shared/escrowSchema';
import { users } from '../../../../shared/schema';
import { eq, or, sql, and } from 'drizzle-orm';
import { escrowService } from '../../../services/escrowService';
import { isAuthenticated } from '../../../auth';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  notifyEscrowCreated,
  notifyEscrowAccepted,
  notifyMilestonePending,
  notifyMilestoneApproved,
  notifyEscrowDisputed,
  logNotification
} from '../../../services/escrow-notifications';

// ════════════════════════════════════════════════════════════════════════════════
// CURRENCY & TOKEN CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Supported currencies/tokens for escrow
 * 
 * PRIMARY (Stablecoins - Default):
 * - cUSD: Celo Dollar - Fast, stable, Celo-native (RECOMMENDED)
 * - USDC: USD Coin - Multi-chain, highly liquid
 * - USDT: Tether - Alternative stablecoin
 * 
 * SECONDARY (Other Assets - Optional):
 * - CELO: Celo native token (volatile but on-chain native)
 * - cEUR, cKES: Celo regional stablecoins (Euro/Kenyan Shilling)
 * - ETH: Ethereum (for cross-chain payments)
 * - Custom ERC20s: Any valid token address (future expansion)
 */
export const SUPPORTED_CURRENCIES = {
  // Primary: Stablecoins (recommended)
  'cUSD': { name: 'Celo Dollar', isStablecoin: true, chain: 'celo', decimals: 18, category: 'primary' },
  'USDC': { name: 'USD Coin', isStablecoin: true, chain: 'multi', decimals: 6, category: 'primary' },
  'USDT': { name: 'Tether USD', isStablecoin: true, chain: 'multi', decimals: 6, category: 'primary' },
  
  // Secondary: Regional stablecoins
  'cEUR': { name: 'Celo Euro', isStablecoin: true, chain: 'celo', decimals: 18, category: 'secondary' },
  'cKES': { name: 'Celo Kenyan Shilling', isStablecoin: true, chain: 'celo', decimals: 18, category: 'secondary' },
  
  // Tertiary: Non-stablecoins (volatile)
  'CELO': { name: 'Celo Native', isStablecoin: false, chain: 'celo', decimals: 18, category: 'tertiary' },
  'ETH': { name: 'Ethereum', isStablecoin: false, chain: 'ethereum', decimals: 18, category: 'tertiary' },
} as const;

export type SupportedCurrency = keyof typeof SUPPORTED_CURRENCIES;

// Zod validation schemas
const currencySchema = z.enum(['cUSD', 'USDC', 'USDT', 'cEUR', 'cKES', 'CELO', 'ETH']).default('cUSD');
// Numeric string schema - validates format but returns string (avoids precision loss)
const numericStringSchema = z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount format').refine(
  s => parseFloat(s) >= 1, 
  { message: 'Amount must be at least 1' }
);
// Legacy schema for backwards compatibility - transforms to number
const amountSchema = z.string().transform(Number).refine(n => n >= 1, { message: 'Amount must be at least 1' });

const createEscrowInitiateSchema = z.object({
  recipient: z.string().email().or(z.string().min(3, 'Username/email required')),
  amount: amountSchema,
  currency: currencySchema,
  description: z.string().max(500).optional(),
  milestones: z.array(z.object({
    description: z.string().max(1000),
    amount: numericStringSchema
  })).optional()
});

const createEscrowSchema = z.object({
  taskId: z.string().uuid().optional(),
  payeeId: z.string(),
  amount: amountSchema,
  currency: currencySchema,
  milestones: z.array(z.object({
    description: z.string().max(1000),
    amount: numericStringSchema
  })).optional()
});

const updateEscrowSchema = z.object({
  transactionHash: z.string().optional(),
  mediatorId: z.string().optional(),
  disputeReason: z.string().min(10).max(2000).optional()
});

const disputeSchema = z.object({
  reason: z.string().min(10, 'Dispute reason must be at least 10 characters').max(2000),
  evidence: z.array(z.string().url()).optional()
});

const milestoneApprovalSchema = z.object({
  proofUrl: z.string().url().optional()
});

const resolveDisputeSchema = z.object({
  winner: z.enum(['payer', 'payee', 'split']),
  payerPercentage: z.number().min(0).max(100).optional()
});

const router = express.Router();

/**
 * GET /api/v1/wallets/escrow/currencies
 * List all supported currencies/tokens for escrow operations
 * Useful for client-side dropdown selection
 */
router.get('/currencies', async (req, res) => {
  try {
    const currencies = Object.entries(SUPPORTED_CURRENCIES).map(([symbol, info]) => ({
      symbol,
      ...info,
      default: symbol === 'cUSD' // cUSD is the default
    }));

    // Group by category
    const grouped = {
      primary: currencies.filter(c => c.category === 'primary'),
      secondary: currencies.filter(c => c.category === 'secondary'),
      tertiary: currencies.filter(c => c.category === 'tertiary')
    };

    res.json({
      success: true,
      currencies,
      grouped,
      default: 'cUSD',
      recommended: grouped.primary,
      description: 'Primary: Stablecoins (recommended) | Secondary: Regional stablecoins | Tertiary: Other assets'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper: Verify user is party to escrow
async function verifyEscrowParty(escrowId: string, userId: string) {
  const escrow = await db.select()
    .from(escrowAccounts)
    .where(eq(escrowAccounts.id, escrowId))
    .limit(1);

  if (!escrow.length) {
    throw new Error('Escrow not found');
  }

  if (escrow[0].payerId !== userId && escrow[0].payeeId !== userId) {
    throw new Error('Unauthorized: You are not a party to this escrow');
  }

  return escrow[0];
}

// Initiate escrow with invite link (wallet-based, peer-to-peer)
router.post('/initiate', isAuthenticated, async (req, res) => {
  try {
    // Validate request body
    const validation = createEscrowInitiateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.flatten() });
    }

    const { recipient, amount, currency, description, milestones } = validation.data;
    const payerId = req.user!.id;

    // Security: Prevent self-escrow
    const recipientEmail = recipient.toLowerCase();
    const recipientUser = await db.select().from(users)
      .where(or(
        eq(users.email, recipientEmail),
        eq(users.username, recipient.replace('@', '').toLowerCase())
      ))
      .limit(1);

    if (recipientUser.length > 0 && recipientUser[0].id === payerId) {
      return res.status(400).json({ error: 'Cannot create escrow with yourself' });
    }

    // Validate currency is supported
    if (!Object.keys(SUPPORTED_CURRENCIES).includes(currency)) {
      return res.status(400).json({ error: `Currency ${currency} not supported` });
    }

    const payeeId = recipientUser.length > 0 ? recipientUser[0].id : 'pending';

    // Create escrow using service
    const escrow = await escrowService.createEscrow({
      payerId,
      payeeId,
      amount: amount.toString(),
      currency,
      milestones: milestones || []
    });

    // Generate invite code for shareable link
    const inviteCode = nanoid(12);

    // Update metadata with invite code
    const [updatedEscrow] = await db.update(escrowAccounts)
      .set({
        metadata: {
          inviteCode,
          recipientEmail,
          description: description || '',
          createdFromWallet: true,
          currencyInfo: SUPPORTED_CURRENCIES[currency as SupportedCurrency]
        },
        updatedAt: new Date()
      })
      .where(eq(escrowAccounts.id, escrow.id))
      .returning();

    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const inviteLink = `${baseUrl}/escrow/accept/${inviteCode}?referrer=${payerId}`;

    // Send notification to recipient if user exists
    if (recipientUser.length > 0) {
      try {
        const payer = await db.select().from(users)
          .where(eq(users.id, payerId))
          .limit(1);

        if (payer.length > 0) {
          await notifyEscrowCreated(
            payer[0],
            recipientEmail,
            { ...escrow, inviteCode, milestones: milestones || [] }
          );
          await logNotification(payerId, 'escrow_created', 'email', recipientEmail, escrow.id);
        }
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError);
        // Continue even if notification fails
      }
    }

    res.json({
      success: true,
      escrow: updatedEscrow,
      inviteLink,
      currency: currency,
      currencyInfo: SUPPORTED_CURRENCIES[currency as SupportedCurrency]
    });
  } catch (error: any) {
    console.error('Error creating escrow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get escrow by invite code (public - no auth required)
router.get('/invite/:inviteCode', async (req, res) => {
  try {
    const { inviteCode } = req.params;

    // Query using JSON metadata field
    const escrow = await db.select()
      .from(escrowAccounts)
      .where(sql`${escrowAccounts.metadata}->>'inviteCode' = ${inviteCode}`)
      .limit(1);

    if (!escrow.length) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    const escrowData = escrow[0];
    const payer = await db.select().from(users)
      .where(eq(users.id, escrowData.payerId))
      .limit(1);

    const milestones = await db.select()
      .from(escrowMilestones)
      .where(eq(escrowMilestones.escrowId, escrowData.id));

    res.json({ ...escrowData, payer: payer[0] || null, milestones });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Accept escrow invite (creates/links payee)
router.post('/accept/:inviteCode', isAuthenticated, async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const { referrer } = req.query;
    const userId = req.user!.id;

    const escrow = await db.select()
      .from(escrowAccounts)
      .where(sql`${escrowAccounts.metadata}->>'inviteCode' = ${inviteCode}`)
      .limit(1);

    if (!escrow.length) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    // Prevent accepting your own escrow
    if (escrow[0].payerId === userId) {
      return res.status(400).json({ error: 'Cannot accept your own escrow' });
    }

    // Update escrow with actual payee ID
    const [updated] = await db.update(escrowAccounts)
      .set({
        payeeId: userId,
        status: 'accepted',
        updatedAt: new Date()
      })
      .where(eq(escrowAccounts.id, escrow[0].id))
      .returning();

    // Register referral if referrer ID provided
    if (referrer && typeof referrer === 'string') {
      try {
        const { registerEscrowReferral, trackEscrowReferral } = await import('../../../services/referral-integration');
        await registerEscrowReferral(referrer, userId, escrow[0].id);
        await trackEscrowReferral(referrer, userId, escrow[0].id);
        console.log(`✅ Referral tracked: ${referrer} -> ${userId} from escrow ${escrow[0].id}`);
      } catch (referralError) {
        console.error('Error processing referral:', referralError);
      }
    }

    // Send notifications to both payer and payee
    try {
      const [payer, payee] = await Promise.all([
        db.select().from(users).where(eq(users.id, escrow[0].payerId)).limit(1),
        db.select().from(users).where(eq(users.id, userId)).limit(1)
      ]);

      if (payer.length > 0 && payee.length > 0) {
        await notifyEscrowAccepted(payer[0], payee[0], updated);
        await Promise.all([
          payer[0].email ? logNotification(escrow[0].payerId, 'escrow_accepted', 'email', payer[0].email, escrow[0].id) : Promise.resolve(),
          payee[0].email ? logNotification(userId, 'escrow_accepted', 'email', payee[0].email, escrow[0].id) : Promise.resolve()
        ]);
      }
    } catch (notifyError) {
      console.error('Failed to send acceptance notification:', notifyError);
    }

    res.json({ success: true, escrow: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// NEW RESTful ENDPOINT (RECOMMENDED)
// ════════════════════════════════════════════════════════════════════════════════

// POST /api/v1/wallets/escrow - Create escrow
router.post('/', isAuthenticated, async (req, res) => {
  try {
    // Validate request body
    const validation = createEscrowSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.flatten() });
    }

    const { taskId, payeeId, amount, currency, milestones } = validation.data;
    const payerId = req.user!.id;

    // Security: Prevent self-escrow
    if (payeeId === payerId) {
      return res.status(400).json({ error: 'Cannot create escrow with yourself' });
    }

    // Verify payee exists
    const payee = await db.select().from(users)
      .where(eq(users.id, payeeId))
      .limit(1);

    if (payee.length === 0) {
      return res.status(404).json({ error: 'Payee not found' });
    }

    // Validate currency is supported
    if (!Object.keys(SUPPORTED_CURRENCIES).includes(currency)) {
      return res.status(400).json({ 
        error: `Currency ${currency} not supported`,
        supportedCurrencies: Object.keys(SUPPORTED_CURRENCIES)
      });
    }

    // Create escrow using service
    const escrow = await escrowService.createEscrow({
      taskId,
      payerId,
      payeeId,
      amount: amount.toString(),
      currency,
      milestones: milestones || []
    });

    // Update with currency metadata
    const [updatedEscrow] = await db.update(escrowAccounts)
      .set({
        metadata: Object.assign(
          (typeof escrow.metadata === 'object' && escrow.metadata !== null ? escrow.metadata : {}) as Record<string, any>,
          {
            currencyInfo: SUPPORTED_CURRENCIES[currency as SupportedCurrency],
            isStablecoin: SUPPORTED_CURRENCIES[currency as SupportedCurrency].isStablecoin
          }
        ),
        updatedAt: new Date()
      })
      .where(eq(escrowAccounts.id, escrow.id))
      .returning();

    res.status(201).json({
      success: true,
      escrow: updatedEscrow,
      currency: currency,
      currencyInfo: SUPPORTED_CURRENCIES[currency as SupportedCurrency]
    });
  } catch (error: any) {
    console.error('Error creating escrow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// DEPRECATED ENDPOINT (Keep for 6 months, then remove)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use POST /api/v1/wallets/escrow instead
 * Sunset: 2026-09-01
 */
// Create escrow (original - kept for backward compatibility)
router.post('/create', isAuthenticated, async (req, res) => {
  // Issue deprecation warning
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 01 Sep 2026 00:00:00 GMT');
  res.setHeader('Link', '</api/v1/wallets/escrow>; rel="successor-version"');
  res.setHeader('Warning', '299 - "POST /api/v1/wallets/escrow/create is deprecated. Use POST /api/v1/wallets/escrow instead"');

  try {
    const { taskId, payeeId, amount, currency, milestones } = req.body;
    const payerId = req.user!.id;

    // Validation
    if (!payeeId || !amount || !currency) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const numAmount = parseFloat(amount);
    if (numAmount < 1) {
      return res.status(400).json({ error: 'Amount must be at least $1' });
    }

    // Create escrow
    const escrow = await escrowService.createEscrow({
      payerId,
      payeeId,
      taskId,
      amount: numAmount.toString(),
      currency: currency || 'cUSD',
      milestones: milestones || []
    });

    res.json({ success: true, escrow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fund escrow
router.post('/:escrowId/fund', isAuthenticated, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { transactionHash } = req.body;
    const payerId = req.user!.id;

    // Validate inputs
    if (!transactionHash) {
      return res.status(400).json({ error: 'Transaction hash required' });
    }

    const escrow = await verifyEscrowParty(escrowId, payerId);

    // Only payer can fund
    if (escrow.payerId !== payerId) {
      return res.status(403).json({ error: 'Only the payer can fund this escrow' });
    }

    // Cannot fund if already funded or released
    if (!['pending', 'accepted'].includes(escrow.status || 'pending')) {
      return res.status(400).json({ error: `Cannot fund escrow in ${escrow.status} status` });
    }

    // Call service to handle funding
    const updatedEscrow = await escrowService.fundEscrow(escrowId, payerId, transactionHash);

    res.json({
      success: true,
      escrow: updatedEscrow,
      message: `Escrow funded with ${escrow.amount} ${escrow.currency}`,
      transactionHash
    });
  } catch (error: any) {
    res.status(error.message.includes('Unauthorized') ? 403 : 500)
      .json({ success: false, error: error.message });
  }
});

// Approve milestone (payee marks as complete)
router.post('/:escrowId/milestones/:milestoneNumber/approve', isAuthenticated, async (req, res) => {
  try {
    const { escrowId, milestoneNumber } = req.params;
    const validation = milestoneApprovalSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.flatten() });
    }

    const { proofUrl } = validation.data;
    const approverId = req.user!.id;

    const escrow = await verifyEscrowParty(escrowId, approverId);

    // Verify this is the payee
    if (escrow.payeeId !== approverId) {
      return res.status(403).json({ error: 'Only the payee can submit milestone completion' });
    }

    // Verify escrow is funded
    if (escrow.status !== 'funded') {
      return res.status(400).json({ error: `Cannot approve milestone in ${escrow.status} status. Escrow must be funded first.` });
    }

    // Approve the milestone
    const milestone = await escrowService.approveMilestone(escrowId, milestoneNumber, approverId, proofUrl);

    // Send notification to payer
    try {
      const [payer, payee] = await Promise.all([
        db.select().from(users).where(eq(users.id, escrow.payerId)).limit(1),
        db.select().from(users).where(eq(users.id, escrow.payeeId)).limit(1)
      ]);

      if (payer.length > 0 && payee.length > 0) {
        await notifyMilestonePending(payer[0], payee[0], escrow, milestone);
        if (payer[0].email) await logNotification(escrow.payerId, 'milestone_pending', 'email', payer[0].email, escrowId);
      }
    } catch (notifyError) {
      console.error('Failed to send milestone notification:', notifyError);
    }

    res.json({
      success: true,
      milestone,
      message: `Milestone ${milestoneNumber} submitted for approval by payer`,
      proofUrl: proofUrl || null
    });
  } catch (error: any) {
    res.status(error.message.includes('Unauthorized') ? 403 : 500)
      .json({ success: false, error: error.message });
  }
});

// Release milestone (payer approves and releases payment)
router.post('/:escrowId/milestones/:milestoneNumber/release', isAuthenticated, async (req, res) => {
  try {
    const { escrowId, milestoneNumber } = req.params;
    const { transactionHash } = req.body;
    const userId = req.user!.id;

    const escrow = await verifyEscrowParty(escrowId, userId);

    if (escrow.payerId !== userId) {
      return res.status(403).json({ error: 'Only the payer can release milestone payments' });
    }

    const milestone = await escrowService.releaseMilestone(escrowId, milestoneNumber, transactionHash);

    // Send notification to payee that payment was approved and released
    try {
      const [payer, payee] = await Promise.all([
        db.select().from(users).where(eq(users.id, escrow.payerId)).limit(1),
        db.select().from(users).where(eq(users.id, escrow.payeeId)).limit(1)
      ]);

      if (payer.length > 0 && payee.length > 0) {
        await notifyMilestoneApproved(payer[0], payee[0], escrow, milestone);
        if (payee[0].email) await logNotification(escrow.payeeId, 'milestone_approved', 'email', payee[0].email, escrowId);
      }
    } catch (notifyError) {
      console.error('Failed to send milestone approval notification:', notifyError);
    }

    res.json({ success: true, milestone });
  } catch (error: any) {
    res.status(error.message.includes('Unauthorized') ? 403 : 500)
      .json({ success: false, error: error.message });
  }
});

// Release full escrow
router.post('/:escrowId/release', isAuthenticated, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { transactionHash } = req.body;
    const userId = req.user!.id;

    const escrow = await verifyEscrowParty(escrowId, userId);

    if (escrow.payerId !== userId) {
      return res.status(403).json({ error: 'Only the payer can release the escrow' });
    }

    const updatedEscrow = await escrowService.releaseFullEscrow(escrowId, transactionHash);
    res.json({ success: true, escrow: updatedEscrow });
  } catch (error: any) {
    res.status(error.message.includes('Unauthorized') ? 403 : 500)
      .json({ success: false, error: error.message });
  }
});

// Raise dispute
router.post('/:escrowId/dispute', isAuthenticated, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const validation = disputeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.flatten() });
    }

    const { reason, evidence } = validation.data;
    const userId = req.user!.id;

    const escrow = await verifyEscrowParty(escrowId, userId);

    if (escrow.status === 'released' || escrow.status === 'refunded') {
      return res.status(400).json({ error: `Cannot dispute escrow in ${escrow.status} status` });
    }

    const dispute = await escrowService.raiseDispute(escrowId, userId, reason, evidence || []);

    // Send notifications to both parties
    try {
      const [payer, payee] = await Promise.all([
        db.select().from(users).where(eq(users.id, escrow.payerId)).limit(1),
        db.select().from(users).where(eq(users.id, escrow.payeeId)).limit(1)
      ]);

      if (payer.length > 0 && payee.length > 0) {
        await notifyEscrowDisputed(payer[0], payee[0], escrow, reason);
        await Promise.all([
          payer[0].email ? logNotification(escrow.payerId, 'escrow_disputed', 'email', payer[0].email, escrowId) : Promise.resolve(),
          payee[0].email ? logNotification(escrow.payeeId, 'escrow_disputed', 'email', payee[0].email, escrowId) : Promise.resolve()
        ]);
      }
    } catch (notifyError) {
      console.error('Failed to send dispute notification:', notifyError);
    }

    res.json({
      success: true,
      dispute,
      message: 'Dispute raised. Moderators have been notified.'
    });
  } catch (error: any) {
    res.status(error.message.includes('Unauthorized') ? 403 : 500)
      .json({ success: false, error: error.message });
  }
});

// Refund escrow
router.post('/:escrowId/refund', isAuthenticated, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { transactionHash } = req.body;
    const userId = req.user!.id;

    const escrow = await verifyEscrowParty(escrowId, userId);

    if (escrow.payerId !== userId) {
      return res.status(403).json({ error: 'Only the payer can request a refund' });
    }

    const updatedEscrow = await escrowService.refundEscrow(escrowId, transactionHash);
    res.json({ success: true, escrow: updatedEscrow });
  } catch (error: any) {
    res.status(error.message.includes('Unauthorized') ? 403 : 500)
      .json({ success: false, error: error.message });
  }
});

// Get user's escrows
router.get('/my-escrows', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { status, role = 'all', limit = 50, offset = 0 } = req.query;

    // Build where conditions
    let whereConditions: any[] = [];

    // Filter by user's involvement
    if (role === 'payer') {
      whereConditions.push(eq(escrowAccounts.payerId, userId));
    } else if (role === 'payee') {
      whereConditions.push(eq(escrowAccounts.payeeId, userId));
    } else if (role === 'mediator') {
      whereConditions.push(eq(escrowAccounts.mediatorId, userId));
    } else {
      // Default: all roles
      whereConditions.push(or(
        eq(escrowAccounts.payerId, userId),
        eq(escrowAccounts.payeeId, userId),
        eq(escrowAccounts.mediatorId, userId)
      )!);
    }

    // Filter by status if provided
    if (status) {
      whereConditions.push(eq(escrowAccounts.status, String(status)));
    }

    // Build query
    let query = db.select().from(escrowAccounts);
    for (const condition of whereConditions) {
      query = (query as any).where(condition);
    }

    // Get results with pagination
    const escrows = await (query as any)
      .orderBy(escrowAccounts.createdAt, 'desc')
      .limit(Number(limit))
      .offset(Number(offset));

    res.json({
      success: true,
      escrows,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        count: escrows.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get escrow details
router.get('/:escrowId', isAuthenticated, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const userId = req.user!.id;

    const escrow = await verifyEscrowParty(escrowId, userId);

    const milestones = await db.select()
      .from(escrowMilestones)
      .where(eq(escrowMilestones.escrowId, escrowId));

    const disputes = await db.select()
      .from(escrowDisputes)
      .where(eq(escrowDisputes.escrowId, escrowId));

    res.json({ success: true, escrow, milestones, disputes });
  } catch (error: any) {
    res.status(error.message.includes('Unauthorized') ? 403 : 404)
      .json({ success: false, error: error.message });
  }
});

// OKEDI: Get suggested mediators for DAO
router.get('/mediators/suggest/:daoId', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const excludeUserIds = req.query.exclude ? (req.query.exclude as string).split(',') : [];

    const mediators = await escrowService.suggestMediators(daoId, excludeUserIds);

    res.json({
      success: true,
      mediators,
      count: mediators.length
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// OKEDI: Set mediator for escrow
router.post('/:escrowId/set-mediator', isAuthenticated, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { mediatorId } = req.body;
    const payerId = req.user!.id;

    if (!mediatorId) {
      return res.status(400).json({ error: 'Mediator ID required' });
    }

    const escrow = await escrowService.setMediator(escrowId, mediatorId, payerId);

    res.json({ success: true, escrow });
  } catch (error: any) {
    res.status(error.message.includes('Only payer') ? 403 : 500)
      .json({ success: false, error: error.message });
  }
});

// OKEDI: Mediator approves escrow
router.post('/:escrowId/approve-as-mediator', isAuthenticated, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const mediatorId = req.user!.id;

    const escrow = await escrowService.approveAsMediator(escrowId, mediatorId);

    res.json({ success: true, escrow });
  } catch (error: any) {
    res.status(error.message.includes('Not assigned') ? 403 : 500)
      .json({ success: false, error: error.message });
  }
});

// OKEDI: Complete escrow with reputation boost
router.post('/:escrowId/complete-with-trust', isAuthenticated, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const userId = req.user!.id;

    // Verify caller is one of the parties
    const escrow = await verifyEscrowParty(escrowId, userId);

    const updated = await escrowService.completeWithReputationBoost(escrowId);

    // Send notification to the other party
    const otherPartyId = escrow.payerId === userId ? escrow.payeeId : escrow.payerId;
    try {
      await logNotification(
        otherPartyId,
        'escrowCompleted',
        'email',
        escrowId
      );
    } catch (notificationError) {
      console.error('Failed to log completion notification:', notificationError);
      // Don't fail the request if notification fails
    }

    res.json({ success: true, escrow: updated });
  } catch (error: any) {
    res.status(error.message.includes('Unauthorized') ? 403 : 500)
      .json({ success: false, error: error.message });
  }
});

// OKEDI: Resolve dispute with mediator decision
router.post('/:escrowId/resolve-dispute', isAuthenticated, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const validation = resolveDisputeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.flatten() });
    }

    const { winner, payerPercentage } = validation.data;
    const mediatorId = req.user!.id;

    // Verify mediator is assigned
    const escrow = await db.select().from(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId))
      .limit(1);

    if (!escrow.length) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    if (escrow[0].mediatorId !== mediatorId) {
      return res.status(403).json({ error: 'Only assigned mediator can resolve dispute' });
    }

    const resolvedEscrow = await escrowService.resolveDisputeAsMediator(
      escrowId,
      mediatorId,
      winner,
      payerPercentage || 0
    );

    // Send notifications to both parties about the resolution
    try {
      const payer = await db.select()
        .from(users)
        .where(eq(users.id, escrow[0].payerId))
        .limit(1);
      
      const payee = await db.select()
        .from(users)
        .where(eq(users.id, escrow[0].payeeId))
        .limit(1);
      
      if (payer.length > 0 && payee.length > 0) {
        await notifyEscrowDisputed(payer[0], payee[0], escrow[0], 
          `Dispute resolved. ${winner === 'payer' ? 'Payer' : 'Payee'} awarded ${winner === 'payer' ? payerPercentage : (100 - (payerPercentage || 0))}%`);
      }
    } catch (notificationError) {
      console.error('Failed to send dispute resolution notification:', notificationError);
      // Don't fail the request if notification fails
    }

    // Update escrow with resolution
    const [updatedEscrow] = await db.update(escrowAccounts)
      .set({
        status: 'resolved',
        disputeWinner: winner,
        disputePercentages: {
          payer: winner === 'payer' ? 100 : (winner === 'split' ? payerPercentage || 50 : 0),
          payee: winner === 'payee' ? 100 : (winner === 'split' ? 100 - (payerPercentage || 50) : 0)
        },
        resolvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(escrowAccounts.id, escrowId))
      .returning();

    res.json({
      success: true,
      escrow: updatedEscrow,
      resolution: {
        winner,
        payerPercentage: payerPercentage || 0,
        payeePercentage: 100 - (payerPercentage || 0)
      },
      message: `Dispute resolved in favor of ${winner}`
    });
  } catch (error: any) {
    res.status(error.message.includes('Not assigned') || error.message.includes('not in disputed') ? 403 : 500)
      .json({ success: false, error: error.message });
  }
});

// GUARDIANS: Add guardians to an escrow
router.post('/:escrowId/guardians/add', isAuthenticated, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { guardians } = req.body; // array of user IDs/emails
    const userId = req.user!.id;
    if (!Array.isArray(guardians) || guardians.length === 0) {
      return res.status(400).json({ error: 'Guardians array required' });
    }
    const updated = await escrowService.addGuardians(escrowId, userId, guardians);
    res.json({ success: true, escrow: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GUARDIANS: Remove a guardian from an escrow
router.post('/:escrowId/guardians/remove', isAuthenticated, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { guardian } = req.body; // user ID/email
    const userId = req.user!.id;
    if (!guardian) {
      return res.status(400).json({ error: 'Guardian required' });
    }
    const updated = await escrowService.removeGuardian(escrowId, userId, guardian);
    res.json({ success: true, escrow: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GUARDIANS: List guardians for an escrow
router.get('/:escrowId/guardians', isAuthenticated, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const userId = req.user!.id;
    const guardians = await escrowService.listGuardians(escrowId, userId);
    res.json({ success: true, guardians });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GUARDIANS: Guardian approves recovery
router.post('/:escrowId/guardians/approve-recovery', isAuthenticated, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const guardianId = req.user!.id;
    const result = await escrowService.approveRecovery(escrowId, guardianId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// LIST all escrows (with comprehensive filtering)
router.get('/list/all', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { status, role = 'all', daoId, limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build where conditions
    let whereConditions: any[] = [];

    // Filter by user's involvement (as payer, payee, or mediator)
    if (role === 'all') {
      whereConditions.push(or(
        eq(escrowAccounts.payerId, userId),
        eq(escrowAccounts.payeeId, userId),
        eq(escrowAccounts.mediatorId, userId)
      )!);
    } else if (role === 'payer') {
      whereConditions.push(eq(escrowAccounts.payerId, userId));
    } else if (role === 'payee') {
      whereConditions.push(eq(escrowAccounts.payeeId, userId));
    } else if (role === 'mediator') {
      whereConditions.push(eq(escrowAccounts.mediatorId, userId));
    }

    // Apply additional filters
    if (status) {
      whereConditions.push(eq(escrowAccounts.status, String(status)));
    }
    if (daoId) {
      whereConditions.push(eq(escrowAccounts.daoId, String(daoId)));
    }

    // Build the base query
    let baseQuery = db.select().from(escrowAccounts);
    
    // Apply all where conditions
    for (const condition of whereConditions) {
      baseQuery = baseQuery.where(condition) as any;
    }

    // Get total count
    const allResults = await baseQuery;
    const totalCount = allResults.length;

    // Apply sorting and pagination
    let finalQuery = db.select().from(escrowAccounts);
    
    // Reapply where conditions
    for (const condition of whereConditions) {
      finalQuery = finalQuery.where(condition) as any;
    }

    const results = await (finalQuery as any)
      .orderBy(escrowAccounts.createdAt, sortOrder === 'asc' ? 'asc' : 'desc')
      .limit(Number(limit))
      .offset(Number(offset));

    res.json({
      success: true,
      data: results,
      pagination: {
        total: totalCount,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < totalCount
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE an escrow (only for draft/pending status)
router.delete('/:escrowId', isAuthenticated, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const userId = req.user!.id;

    // Fetch escrow
    const escrow = await db.select()
      .from(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId))
      .limit(1);

    if (!escrow.length) {
      return res.status(404).json({ success: false, error: 'Escrow not found' });
    }

    const escrowData = escrow[0];

    // Only payer can delete
    if (escrowData.payerId !== userId) {
      return res.status(403).json({ success: false, error: 'Only the payer can delete an escrow' });
    }

    // Can only delete if in draft or pending status
    const allowedStatuses = ['pending', 'draft', 'accepted'];
    if (escrowData.status && !allowedStatuses.includes(escrowData.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete escrow in ${escrowData.status} status. Only ${allowedStatuses.join('/')} escrows can be deleted.`,
        currentStatus: escrowData.status,
        allowedStatuses
      });
    }

    // Delete associated milestones
    await db.delete(escrowMilestones)
      .where(eq(escrowMilestones.escrowId, escrowId));

    // Delete associated disputes
    await db.delete(escrowDisputes)
      .where(eq(escrowDisputes.escrowId, escrowId));

    // Delete the escrow
    await db.delete(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId));

    res.json({
      success: true,
      message: 'Escrow deleted successfully',
      escrowId,
      deletedAt: new Date()
    });
  } catch (error: any) {
    console.error('Error deleting escrow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
