/**
 * ⚠️  DEPRECATED - CONSOLIDATED INTO system.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * THIS FILE IS DEPRECATED (Sunset: 2026-09-01)
 * 
 * SSE notification endpoints have been consolidated into:
 * 👉 server/routes/system.ts
 * 
 * Route Migration:
 * GET /api/sse/notifications → GET /api/system/sse/notifications
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * This file will be DELETED on or after 2026-09-01.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response } from 'express';
import { isAuthenticated } from '../nextAuthMiddleware';
import { notificationService } from '../notificationService';

const router = express.Router();

// Server-Sent Events endpoint for real-time notifications
router.get('/notifications', isAuthenticated, (req: Request, res: Response) => {
  const userId = (req.user as any).claims.sub;
  notificationService.setupSSE(userId, res);
});

export default router;
