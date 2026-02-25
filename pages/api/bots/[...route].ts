/**
 * Bot API Routes - Dynamic Route Handler
 * Wires all bot endpoints together
 * 
 * Routes:
 * GET    /api/bots                           - List all bots
 * POST   /api/bots/deploy                    - Deploy new bot
 * GET    /api/bots/:id                       - Get bot details
 * POST   /api/bots/:id/pause                 - Pause bot
 * POST   /api/bots/:id/resume                - Resume bot
 * POST   /api/bots/:id/stop                  - Stop bot
 * PUT    /api/bots/:id/config                - Update configuration
 * DELETE /api/bots/:id                       - Delete bot
 * GET    /api/bots/:id/trades                - Get bot trades
 * GET    /api/bots/:id/performance           - Get performance metrics
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import * as botRoutes from '@/server/api/routes/botRoutes';

// Type for request with session
interface SessionRequest extends NextApiRequest {
  session?: any;
}

/**
 * Main handler for all bot API routes
 */
export default async function handler(req: SessionRequest, res: NextApiResponse) {
  try {
    // 1. Get and validate session
    const session = await getServerSession(req, res, authOptions);

    if (!session || !session.user) {
      return res.status(401).json({ error: 'Unauthorized - Please login' });
    }

    // Attach session to request for handlers
    req.session = session;
    req.user = session.user;

    // 2. Parse route parameters
    const { route } = req.query;

    if (!route || !Array.isArray(route)) {
      return res.status(400).json({ error: 'Invalid route' });
    }

    // route[0] could be: botId, 'deploy', or an ID
    // route[1] could be: 'pause', 'resume', 'stop', 'config', 'trades', 'performance'
    const [firstParam, secondParam] = route;

    // 3. Route requests by HTTP method and path
    try {
      // ============================================================
      // GET REQUESTS
      // ============================================================
      if (req.method === 'GET') {
        // GET /api/bots - List all bots
        if (!firstParam && !secondParam) {
          return botRoutes.GET_BOTS(req, res);
        }

        // GET /api/bots/:id - Get bot details
        if (firstParam?.startsWith('bot-') && !secondParam) {
          return botRoutes.GET_BOT(firstParam, req, res);
        }

        // GET /api/bots/:id/trades - Get bot trades
        if (firstParam?.startsWith('bot-') && secondParam === 'trades') {
          return botRoutes.GET_BOT_TRADES(firstParam, req, res);
        }

        // GET /api/bots/:id/performance - Get performance metrics
        if (firstParam?.startsWith('bot-') && secondParam === 'performance') {
          return botRoutes.GET_BOT_PERFORMANCE(firstParam, req, res);
        }

        return res.status(404).json({ error: 'GET route not found' });
      }

      // ============================================================
      // POST REQUESTS
      // ============================================================
      if (req.method === 'POST') {
        // POST /api/bots/deploy - Deploy new bot
        if (firstParam === 'deploy' && !secondParam) {
          return botRoutes.POST_DEPLOY_BOT(req, res);
        }

        // POST /api/bots/:id/pause - Pause bot
        if (firstParam?.startsWith('bot-') && secondParam === 'pause') {
          return botRoutes.POST_PAUSE_BOT(firstParam, req, res);
        }

        // POST /api/bots/:id/resume - Resume bot
        if (firstParam?.startsWith('bot-') && secondParam === 'resume') {
          return botRoutes.POST_RESUME_BOT(firstParam, req, res);
        }

        // POST /api/bots/:id/stop - Stop bot
        if (firstParam?.startsWith('bot-') && secondParam === 'stop') {
          return botRoutes.POST_STOP_BOT(firstParam, req, res);
        }

        return res.status(404).json({ error: 'POST route not found' });
      }

      // ============================================================
      // PUT REQUESTS
      // ============================================================
      if (req.method === 'PUT') {
        // PUT /api/bots/:id/config - Update bot configuration
        if (firstParam?.startsWith('bot-') && secondParam === 'config') {
          return botRoutes.PUT_UPDATE_CONFIG(firstParam, req, res);
        }

        return res.status(404).json({ error: 'PUT route not found' });
      }

      // ============================================================
      // DELETE REQUESTS
      // ============================================================
      if (req.method === 'DELETE') {
        // DELETE /api/bots/:id - Delete bot
        if (firstParam?.startsWith('bot-') && !secondParam) {
          return botRoutes.DELETE_BOT(firstParam, req, res);
        }

        return res.status(404).json({ error: 'DELETE route not found' });
      }

      // ============================================================
      // Unsupported methods
      // ============================================================
      return res.status(405).json({
        error: `Method ${req.method} not allowed`,
      });
    } catch (handlerError) {
      console.error('[Bot API Error]', handlerError);
      return res.status(500).json({
        error:
          handlerError instanceof Error
            ? handlerError.message
            : 'Internal server error',
      });
    }
  } catch (error) {
    console.error('[Bot API Fatal Error]', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

/**
 * Route Mapping Reference:
 *
 * GET /api/bots
 *   → botRoutes.GET_BOTS()
 *
 * POST /api/bots/deploy
 *   → botRoutes.POST_DEPLOY_BOT()
 *
 * GET /api/bots/:id
 *   → botRoutes.GET_BOT(:id)
 *
 * POST /api/bots/:id/pause
 *   → botRoutes.POST_PAUSE_BOT(:id)
 *
 * POST /api/bots/:id/resume
 *   → botRoutes.POST_RESUME_BOT(:id)
 *
 * POST /api/bots/:id/stop
 *   → botRoutes.POST_STOP_BOT(:id)
 *
 * PUT /api/bots/:id/config
 *   → botRoutes.PUT_UPDATE_CONFIG(:id)
 *
 * DELETE /api/bots/:id
 *   → botRoutes.DELETE_BOT(:id)
 *
 * GET /api/bots/:id/trades
 *   → botRoutes.GET_BOT_TRADES(:id)
 *
 * GET /api/bots/:id/performance
 *   → botRoutes.GET_BOT_PERFORMANCE(:id)
 */
