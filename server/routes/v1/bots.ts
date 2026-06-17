import express from 'express';
import { z } from 'zod';
import { authenticate } from '../../auth';
import { rateLimitPerUser } from '../../middleware/rateLimit';
import { db } from '../../db';
import { users, userKyc } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { getUserDeployCountSince } from '../../db/services/botService';
import advancedModeGuard from '../../middleware/advancedModeGuard';
import internalAuth from '../../middleware/internalAuth';
import * as handlers from '../../api/handlers/botHandlersReal';
import * as botService from '../../db/services/botService';
import { auditConsolidated, AuditEventType } from '../../services/auditConsolidated';

const router = express.Router({ mergeParams: true });

// Validation schemas
const deploySchema = z.object({
  strategyId: z.string().min(1),
  botName: z.string().min(1),
  inputs: z.record(z.any()),
  riskControl: z.record(z.any()),
  exchanges: z.array(z.string()).min(1),
  initialCapital: z.number().min(0),
  dry_run: z.boolean().optional().default(true),
});

const updateConfigSchema = z.object({
  inputs: z.record(z.any()).optional(),
  riskControl: z.record(z.any()).optional(),
  exchanges: z.array(z.string()).optional(),
  initialCapital: z.number().optional(),
});

// Middleware: conditionally require advanced mode when deploy.dry_run === false
function requireAdvancedIfLive(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const dryRun = req.body?.dry_run;
    if (dryRun === false) return advancedModeGuard(req, res, next);
    return next();
  } catch (e) {
    return next();
  }
}

// List bots
router.get('/', authenticate, rateLimitPerUser('bots-list', 30, '1min'), async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const result = await handlers.listBotsHandler(userId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// Deploy bot
router.post(
  '/deploy',
  authenticate,
  rateLimitPerUser('bot-deploy', 5, '1min'),
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Validate payload
    const parsed = deploySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.errors });
    // attach parsed body
    req.body = parsed.data;
    next();
  },
  requireAdvancedIfLive,
  // Additional checks for live deploys: 2FA, KYC, daily quota
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const payload = req.body || {};

      if (payload.dry_run === false) {
        // 1) 2FA check: must be enabled and verified recently (15m)
        const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!userRow || !userRow[0]) return res.status(404).json({ success: false, error: 'User not found' });
        const user = userRow[0];
        if (!user.twoFactorEnabled) return res.status(403).json({ success: false, error: '2FA is required to start live trading' });
        const verifiedAt = user.twoFactorVerifiedAt ? new Date(user.twoFactorVerifiedAt) : null;
        if (!verifiedAt || (Date.now() - verifiedAt.getTime()) > 15 * 60 * 1000) {
          return res.status(403).json({ success: false, error: '2FA verification required. Please verify your 2FA and retry.' });
        }

        // 2) KYC check: require verified KYC for live trading
        const kycRow = await db.select().from(userKyc).where(eq(userKyc.userId, userId)).limit(1);
        const kycStatus = kycRow && kycRow[0] ? (kycRow[0] as any).verificationStatus : 'not-started';
        if (kycStatus !== 'verified') {
          return res.status(403).json({ success: false, error: 'KYC verification required for live trading', kycStatus });
        }

        // 3) Daily deploy quota — default to 5 per day
        const now = new Date();
        const startOfDay = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const deploysToday = await getUserDeployCountSince(userId, startOfDay);
        const MAX_DEPLOYS_PER_DAY = parseInt(process.env.MAX_DEPLOYS_PER_DAY || '5', 10);
        if (deploysToday >= MAX_DEPLOYS_PER_DAY) {
          return res.status(429).json({ success: false, error: 'Daily deploy quota exceeded' });
        }
      }

      next();
    } catch (err) {
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  },
  auditConsolidated(AuditEventType.STRATEGY_DEPLOYED, 'high'),
  async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const response = await handlers.deployBotHandler(userId, req.body);
      res.status(201).json({ success: true, data: response });
    } catch (e) {
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  }
);

// Get bot details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const bot = await handlers.getBotHandler(req.params.id, userId);
    res.json({ success: true, data: bot });
  } catch (e) {
    res.status(404).json({ success: false, error: (e as Error).message });
  }
});

// Pause
router.post('/:id/pause', authenticate, rateLimitPerUser('bot-pause', 10, '1min'), auditConsolidated('BOT_PAUSED', 'medium'), async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const result = await handlers.pauseBotHandler(req.params.id, userId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// Resume
router.post('/:id/resume', authenticate, rateLimitPerUser('bot-resume', 10, '1min'), auditConsolidated('BOT_RESUMED', 'medium'), async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const result = await handlers.resumeBotHandler(req.params.id, userId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// Stop
router.post('/:id/stop', authenticate, rateLimitPerUser('bot-stop', 10, '1min'), auditConsolidated('BOT_STOPPED', 'medium'), async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const result = await handlers.stopBotHandler(req.params.id, userId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// Update config
router.put('/:id/config', authenticate, async (req, res, next) => {
  const parsed = updateConfigSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.errors });
  req.body = parsed.data;
  next();
}, auditConsolidated('BOT_CONFIG_UPDATED', 'medium'), async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const result = await handlers.updateBotConfigHandler(req.params.id, userId, req.body);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// Delete
router.delete('/:id', authenticate, auditConsolidated('BOT_DELETED', 'medium'), async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const result = await handlers.deleteBotHandler(req.params.id, userId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// Get trades
router.get('/:id/trades', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await handlers.getBotTradesHandler(req.params.id, userId, limit, offset);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// Get performance
router.get('/:id/performance', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const result = await handlers.getBotPerformanceHandler(req.params.id, userId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// Internal: record trade (engine → API). Requires internal auth.
router.post('/:id/trades', internalAuth, async (req, res) => {
  try {
    const trade = req.body;
    // Resolve bot owner and pass userId to handler (internal calls act on behalf of system)
    const bot = await botService.getBotById(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });
    const ownerId = bot.userId;
    const result = await handlers.recordBotTradeHandler(req.params.id, ownerId, trade);
    res.status(201).json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

export default router;