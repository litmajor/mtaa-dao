
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
