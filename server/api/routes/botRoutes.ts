/**
 * Bot API Routes
 * Wire up handlers to Next.js API endpoints
 */

// Avoid requiring `next` types in server-side code when Next.js isn't used for auth.
type NextApiRequest = any;
type NextApiResponse = any;
import {
  deployBotHandler,
  listBotsHandler,
  getBotHandler,
  pauseBotHandler,
  resumeBotHandler,
  stopBotHandler,
  updateBotConfigHandler,
  deleteBotHandler,
  getBotTradesHandler,
  getBotPerformanceHandler,
  recordBotTradeHandler,
} from '../handlers/botHandlersReal';
import {
  DeployBotRequest,
  UpdateBotConfigRequest,
  BotTradeEvent,
} from '../types/botTypes';

/**
 * GET /api/bots
 * List all bots for current user
 */
export async function GET_BOTS(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const bots = await listBotsHandler(userId);
    return res.status(200).json(bots);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/bots/deploy
 * Deploy a new bot
 */
export async function POST_DEPLOY_BOT(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const request: DeployBotRequest = req.body;
    const response = await deployBotHandler(userId, request);

    return res.status(201).json(response);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/bots/:id
 * Get bot details
 */
export async function GET_BOT(botId: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const bot = await getBotHandler(botId, userId);
    return res.status(200).json(bot);
  } catch (error) {
    if (error instanceof Error && error.message === 'Bot not found') {
      return res.status(404).json({ error: 'Bot not found' });
    }
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/bots/:id/pause
 * Pause a bot
 */
export async function POST_PAUSE_BOT(botId: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pauseBotHandler(botId, userId);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/bots/:id/resume
 * Resume a bot
 */
export async function POST_RESUME_BOT(botId: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await resumeBotHandler(botId, userId);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/bots/:id/stop
 * Stop a bot
 */
export async function POST_STOP_BOT(botId: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await stopBotHandler(botId, userId);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PUT /api/bots/:id/config
 * Update bot configuration
 */
export async function PUT_UPDATE_CONFIG(
  botId: string,
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updates: UpdateBotConfigRequest = req.body;
    const result = await updateBotConfigHandler(botId, userId, updates);

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE /api/bots/:id
 * Delete a bot
 */
export async function DELETE_BOT(botId: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await deleteBotHandler(botId, userId);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/bots/:id/trades
 * Get bot trades
 */
export async function GET_BOT_TRADES(
  botId: string,
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const trades = await getBotTradesHandler(botId, userId, limit, offset);
    return res.status(200).json(trades);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/bots/:id/performance
 * Get bot performance metrics
 */
export async function GET_BOT_PERFORMANCE(
  botId: string,
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const performance = await getBotPerformanceHandler(botId, userId);
    return res.status(200).json(performance);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/bots/:id/trades
 * Record a bot trade (internal use)
 */
export async function POST_RECORD_TRADE(
  botId: string,
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // This endpoint should only be called internally from the bot engine
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer internal_')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const trade: BotTradeEvent = req.body;
    const result = await recordBotTradeHandler(botId, userId, trade);

    return res.status(201).json(result);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Example Next.js pages/api/bots/[...route].ts implementation:
 * 
 * import type { NextApiRequest, NextApiResponse } from 'next';
 * import { unstable_getServerSession } from 'next-auth';
 * import { authOptions } from '../auth/[...nextauth]';
 * import * as api from '@/server/api/routes/botRoutes';
 * 
 * export default async function handler(req: NextApiRequest, res: NextApiResponse) {
 *   const session = await unstable_getServerSession(req, res, authOptions);
 *   
 *   if (!session) {
 *     return res.status(401).json({ error: 'Unauthorized' });
 *   }
 *   
 *   // Attach session to request
 *   req.session = session as any;
 * 
 *   const { route } = req.query;
 *   const [action, botId] = route as string[];
 * 
 *   // Route requests
 *   if (req.method === 'GET') {
 *     if (!action) return api.GET_BOTS(req, res);
 *     if (action === 'deploy' && botId) return api.GET_BOT(botId, req, res);
 *     if (action === botId && botId.startsWith('bot-')) {
 *       if (req.query.trades) return api.GET_BOT_TRADES(botId, req, res);
 *       if (req.query.performance) return api.GET_BOT_PERFORMANCE(botId, req, res);
 *       return api.GET_BOT(botId, req, res);
 *     }
 *   } else if (req.method === 'POST') {
 *     if (action === 'deploy') return api.POST_DEPLOY_BOT(req, res);
 *     if (botId === 'pause') return api.POST_PAUSE_BOT(action, req, res);
 *     if (botId === 'resume') return api.POST_RESUME_BOT(action, req, res);
 *     if (botId === 'stop') return api.POST_STOP_BOT(action, req, res);
 *     if (botId === 'trades') return api.POST_RECORD_TRADE(action, req, res);
 *   } else if (req.method === 'PUT') {
 *     if (botId === 'config') return api.PUT_UPDATE_CONFIG(action, req, res);
 *   } else if (req.method === 'DELETE') {
 *     return api.DELETE_BOT(action, req, res);
 *   }
 * 
 *   return res.status(404).json({ error: 'Not found' });
 * }
 */
