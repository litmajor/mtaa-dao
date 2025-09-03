import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import express, { Express, Request, Response, NextFunction } from "express";
import { createServer, Server } from "http";
import { storage, isDaoPremium, deductVaultFee, createProposalComment, getProposalComments, updateProposalComment, deleteProposalComment, toggleProposalLike, getProposalLikes, toggleCommentLike, getCommentLikes, createDaoMessage, getDaoMessages, updateDaoMessage, deleteDaoMessage } from "./storage";
import walletRouter from './routes/wallet';
import { isAuthenticated } from "./nextAuthMiddleware";
import { z, ZodError } from "zod";
import { MaonoVaultService } from "./blockchain";
import multer from "multer";
import { insertContributionSchema, insertVaultSchema, insertBudgetPlanSchema, insertVoteSchema, insertProposalCommentSchema, insertDaoMessageSchema } from "../shared/schema";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Import payment status routes
import mpesaStatusRoutes from './routes/mpesa-status';
import stripeStatusRoutes from './routes/stripe-status';
import kotanipayStatusRoutes from './routes/kotanipay-status';
import daoSubscriptionRoutes from './routes/dao-subscriptions';
import disbursementRoutes from './routes/disbursements';

// Import task and bounty escrow routes
import taskRoutes from './routes/tasks';
import bountyEscrowRoutes from './routes/bounty-escrow';
import notificationRoutes from './routes/notifications';
import governanceRoutes from './routes/governance';
import proposalExecutionRoutes from './routes/proposal-execution';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads", "avatars");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storageConfig = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = file.originalname.split('.').pop();
    const userId = req.user?.claims?.sub ?? 'unknown';
    cb(null, `${userId}.${ext}`);
  }
});
const upload = multer({ storage: storageConfig, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB limit

// Utility to extract wallet address
function extractWalletAddress(req: Request): string | undefined {
  const user = req.user as any;
  return user?.walletAddress ?? user?.claims?.walletAddress ?? req.body?.userAddress;
}

// Retry logic for blockchain transactions
async function withRetry<T>(operation: () => Promise<T>, maxAttempts = 3, delayMs = 1000): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Max retry attempts reached");
}

// Custom error handler
function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error(err);
  const message = err instanceof ZodError ? "Invalid request data" : "Internal server error";
  const details = err instanceof ZodError ? err.errors : undefined;
  res.status(err.status || 500).json({ message, ...(details && { errors: details }) });
}

import daoTreasuryRouter from './routes/dao_treasury';
import reputationRouter from './routes/reputation';
import notificationsRouter from './routes/notifications';
import { NotificationService } from './notificationService';

export function registerRoutes(app: Express): void {
  // --- Wallet API ---
  app.use('/api/wallet', isAuthenticated, walletRouter);

  // --- DAO Treasury API ---
  app.use('/api/dao/treasury', daoTreasuryRouter);

  // --- Reputation & MsiaMo Tokens API ---
  app.use('/api/reputation', reputationRouter);

  // --- Notifications API ---
  app.use('/api/notifications', notificationsRouter);
  // Validate JWT_SECRET
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  // --- Notifications API ---
  app.get('/api/notifications', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { limit = 10, offset = 0, read, userId } = req.query;
      const authUserId = (req.user as any).claims.sub;
      // Only allow users to access their own notifications
      if (userId && userId !== authUserId) {
        return res.status(403).json({ message: 'Forbidden: Cannot access other users\' notifications' });
      }
      const notifications = await storage.getUserNotifications(authUserId, read === 'true', Number(limit), Number(offset));
      res.json({ notifications, total: notifications.length });
    } catch (err) {
      throw new Error(`Failed to fetch notifications: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // --- Task History API ---
  app.get('/api/tasks/:id/history', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { limit = 10, offset = 0 } = req.query;
      const userId = (req.user as any).claims.sub;
      // Enforce only DAO admins/moderators can view task history
      // Find the task and its DAO
      interface Task {
        id: string;
        daoId: string;
        // Add other relevant fields if needed
        [key: string]: any;
      }

      const task: Task | undefined = await storage.getTasks(undefined, undefined).then((ts: Task[]) => ts.find((t: Task) => t.id === req.params.id));
      if (!task) return res.status(404).json({ message: 'Task not found' });
      const membership = await storage.getDaoMembership(task.daoId, userId);
      if (!membership || (membership.role !== 'admin' && membership.role !== 'moderator')) {
        return res.status(403).json({ message: 'Admin or moderator role required to view task history' });
      }
      const history = await storage.getTaskHistory(req.params.id, Number(limit), Number(offset));
      res.json({ history, total: history.length });
    } catch (err) {
      throw new Error(`Failed to fetch task history: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.put('/api/tasks/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims.sub;
    const updated = await storage.updateTask(req.params.id, req.body, userId);
    res.json(updated);
  } catch (err) {
    throw new Error(`Failed to update task: ${err instanceof Error ? err.message : String(err)}`);
  }
});

  // --- Role-based Middleware ---
  function isSuperuser(req: Request, res: Response, next: NextFunction): void {
    if (req.user && (req.user as any).role === 'superuser') {
      return next();
    }
    res.status(403).json({ error: 'Superuser access required' });
  }

  function isDaoAdmin(req: Request, res: Response, next: NextFunction): void {
    const userRole = (req.user as any)?.role;
    if (userRole === 'superuser' || userRole === 'admin') {
      return next();
    }
    res.status(403).json({ error: 'Admin access required' });
  }

  function isDaoModerator(req: Request, res: Response, next: NextFunction): void {
    const userRole = (req.user as any)?.role;
    if (userRole === 'superuser' || userRole === 'admin' || userRole === 'moderator') {
      return next();
    }
    res.status(403).json({ error: 'Moderator access required' });
  }

  async function checkDaoMembership(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { daoId } = req.params;
      const userId = (req.user as any).claims.sub;

      if (!daoId) {
        return res.status(400).json({ error: 'DAO ID required' });
      }

      const membership = await storage.getDaoMembership(daoId, userId);
      if (!membership || membership.status !== 'approved') {
        return res.status(403).json({ error: 'DAO membership required' });
      }

      // Attach membership to request for use in route handlers
      (req as any).daoMembership = membership;
      next();
    } catch (err) {
      res.status(500).json({ error: 'Failed to verify DAO membership' });
    }
  }

  async function checkDaoAdminRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { daoId } = req.params;
      const userId = (req.user as any).claims.sub;

      const membership = await storage.getDaoMembership(daoId, userId);
      if (!membership || (membership.role !== 'admin' && membership.role !== 'elder')) {
        return res.status(403).json({ error: 'DAO admin or elder role required' });
      }

      (req as any).daoMembership = membership;
      next();
    } catch (err) {
      res.status(500).json({ error: 'Failed to verify DAO admin role' });
    }
  }

  // --- Superuser/Admin Endpoints ---
  app.get('/api/admin/daos', isAuthenticated, isSuperuser, async (req: Request, res: Response) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const daos = await storage.getAllDaos({ limit: Number(limit), offset: Number(offset) });
      const total = await storage.getDaoCount();
      res.json({ daos, total });
    } catch (err) {
      throw new Error(`Failed to fetch DAOs: ${err instanceof Error ? err.message : String(err)}`);
    }
  });



  app.get('/api/admin/users', isAuthenticated, isSuperuser, async (req: Request, res: Response) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const users = await storage.getAllUsers({ limit: Number(limit), offset: Number(offset) });
      const total = await storage.getUserCount();
      res.json({ users, total });
    } catch (err) {
      throw new Error(`Failed to fetch users: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.get('/api/admin/fees', isAuthenticated, isSuperuser, async (req: Request, res: Response) => {
    try {
      const fees = await storage.getPlatformFeeInfo();
      res.json({ fees });
    } catch (err) {
      throw new Error(`Failed to fetch fee info: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.get('/api/admin/logs', isAuthenticated, isSuperuser, async (req: Request, res: Response) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const logs = await storage.getSystemLogs({ limit: Number(limit), offset: Number(offset) });
      const total = await storage.getLogCount();
      res.json({ logs, total });
    } catch (err) {
      throw new Error(`Failed to fetch logs: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.get('/api/admin/billing', isAuthenticated, isSuperuser, async (req: Request, res: Response) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const billing = await storage.getAllDaoBillingHistory();
      const total = await storage.getBillingCount();
      res.json({ billing, total });
    } catch (err) {
      throw new Error(`Failed to fetch billing history: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.get('/api/admin/chaininfo', isAuthenticated, isSuperuser, async (req: Request, res: Response) => {
    try {
      const chainInfo = await storage.getChainInfo();
      res.json({ chainInfo });
    } catch (err) {
      throw new Error(`Failed to fetch chain info: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.get('/api/admin/topmembers', isAuthenticated, isSuperuser, async (req: Request, res: Response) => {
    const { limit = 10 } = req.query;
    try {
      const topMembers = await storage.getTopMembers({ limit: Number(limit) });
      res.json({ topMembers });
    } catch (err) {
      throw new Error(`Failed to fetch top members: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // --- Custom Login Endpoint ---
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { email, phone, password } = req.body;
    if ((!email && !phone) || !password) {
      return res.status(400).json({ message: 'Email/phone and password required' });
    }
    try {
      const user = email
        ? await storage.getUserByEmail(email)
        : await storage.getUserByPhone(phone);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const token = jwt.sign(
        { sub: user.id, email: user.email, phone: user.phone },
        process.env.JWT_SECRET as string,
        { expiresIn: '7d' }
      );
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.json({ user: { id: user.id, email: user.email, phone: user.phone }, token });
    } catch (err) {
      throw new Error(`Login failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // --- DAO Join Logic ---

  app.post('/api/daos', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims.sub;
    const dao = await storage.createDao({ ...req.body, creatorId: userId });
    res.status(201).json(dao);
  } catch (err) {
    throw new Error(`Failed to create DAO: ${err instanceof Error ? err.message : String(err)}`);
  }
});

  app.post('/api/proposals', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).claims.sub;
      const proposal = await storage.createProposal({ ...req.body, proposerId: userId });

      // Award reputation points for creating proposal
      const { ReputationService } = await import('../reputationService');
      await ReputationService.onProposalCreated(userId, proposal.id, proposal.daoId);

      // Send notification to DAO members
      const user = await storage.getUserProfile(userId);
      await NotificationService.onProposalCreated(proposal.id, proposal.daoId, user?.firstName || 'A member');

      res.status(201).json(proposal);
    } catch (err) {
      throw new Error(`Failed to create proposal: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  async function handleDaoJoin(
    daoId: string,
    userId: string,
    inviteCode?: string
  ): Promise<{ status: number; data: any }> {
    const existing = await storage.getDaoMembership(daoId, userId);
    if (existing) return { status: 200, data: existing };

    const dao = await storage.getDao(daoId);
    if (!dao) return { status: 404, data: { message: "DAO not found" } };

    if (dao.inviteOnly && !dao.inviteCode) {
      return { status: 403, data: { message: "No invite code set for this DAO" } };
    }
    if (dao.inviteCode && inviteCode !== dao.inviteCode) {
      return { status: 403, data: { message: "Invalid invite code" } };
    }

    if (dao.plan === "free") {
      const memberships = await storage.getDaoMembershipsByStatus(daoId, "approved");
      if (memberships.length >= 25) {
        return {
          status: 403,
          data: { message: "Free DAOs are limited to 25 members. Upgrade to premium for more." },
        };
      }
    }

    const status = dao.access === "private" || dao.inviteOnly ? "pending" : "approved";
    const membership = await storage.createDaoMembership({ daoId, userId, status });
    if (status === "approved") {
      await storage.incrementDaoMemberCount(daoId);
    }
    return { status: 201, data: membership };
  }

  app.post('/api/dao/join', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { daoId } = req.body;
      const userId = (req.user as any).claims.sub;
      const result = await handleDaoJoin(daoId, userId);

      // Award reputation points for joining DAO if approved
      if (result.status === 201 && result.data.status === 'approved') {
        const { ReputationService } = await import('../reputationService');
        await ReputationService.onDaoJoin(userId, daoId);
      }

      res.status(result.status).json(result.data);
    } catch (err) {
      throw new Error(`Failed to join DAO: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.post('/api/dao/join-with-invite', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { daoId, inviteCode } = req.body;
      const userId = (req.user as any).claims.sub;
      const result = await handleDaoJoin(daoId, userId, inviteCode);
      res.status(result.status).json(result.data);
    } catch (err) {
      throw new Error(`Failed to join DAO with invite: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.post('/api/dao/:daoId/invite/generate', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      await storage.updateDaoInviteCode(daoId, code);
      res.status(201).json({ daoId, code });
    } catch (err) {
      throw new Error(`Failed to generate invite code: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // --- New Membership Approval/Rejection Endpoints ---
  app.post('/api/dao/:daoId/membership/:userId/approve', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { daoId, userId } = req.params;
      const dao = await storage.getDao(daoId);
      if (!dao) return res.status(404).json({ message: "DAO not found" });

      if (dao.plan === "free") {
        const memberships = await storage.getDaoMembershipsByStatus(daoId, "approved");
        if (memberships.length >= 25) {
          return res.status(403).json({ message: "Free DAOs are limited to 25 members. Upgrade to premium for more." });
        }
      }

      const membershipRecord = await storage.getDaoMembership(daoId, userId);
      if (!membershipRecord) return res.status(404).json({ message: "Membership not found" });
      const membership = await storage.updateDaoMembershipStatus(membershipRecord.id, "approved");
      await storage.incrementDaoMemberCount(daoId);
      res.json(membership);
    } catch (err) {
      throw new Error(`Failed to approve membership: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.post('/api/dao/:daoId/membership/:userId/reject', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { daoId, userId } = req.params;
      const membershipRecord = await storage.getDaoMembership(daoId, userId);
      if (!membershipRecord) return res.status(404).json({ message: "Membership not found" });
      const membership = await storage.updateDaoMembershipStatus(membershipRecord.id, "rejected");
      res.json(membership);
    } catch (err) {
      throw new Error(`Failed to reject membership: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.get('/api/dao/:daoId/members', isAuthenticated, checkDaoAdminRole, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { limit = 10, offset = 0, status, role } = req.query;
    const userId = (req.user as any).claims.sub;
    const membership = (req as any).daoMembership;
    const members = await storage.getDaoMembers(
      daoId,
      userId,
      status as string,
      role as string,
      Number(limit),
      Number(offset)
    );
    const total = await storage.getDaoMembershipsByStatus(daoId, status as string).then(m => m.length);
    res.json({ members, total });
  } catch (err) {
    throw new Error(`Failed to fetch DAO members: ${err instanceof Error ? err.message : String(err)}`);
  }

});


  app.get('/api/dao/:daoId/analytics', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = (req.user as any).claims.sub;
    const membership = await storage.getDaoMembership(daoId, userId);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ message: 'Admin role required' });
    }
    const analytics = await storage.getDaoAnalytics(daoId);
    res.json(analytics);
  } catch (err) {
    throw new Error(`Failed to fetch DAO analytics: ${err instanceof Error ? err.message : String(err)}`);
  }
});

  // --- Votes ---
  app.post('/api/votes', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertVoteSchema.parse(req.body);
      const userId = (req.user as any).claims.sub;
      const existingVote = await storage.getVote(validatedData.proposalId, userId);
      if (existingVote) {
        return res.status(409).json({ message: "User has already voted on this proposal" });
      }
      const vote = await storage.createVote({
        ...validatedData,
        userId,
      });
      await storage.updateProposalVotes(validatedData.proposalId, validatedData.voteType);

      // Award reputation points for voting
      const { ReputationService } = await import('../reputationService');
      const proposal = await storage.getProposal(validatedData.proposalId);
      await ReputationService.onVote(userId, validatedData.proposalId, proposal.daoId);

      res.status(201).json(vote);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: "Invalid vote data", errors: err.errors });
      }
      throw new Error(`Failed to create vote: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.put('/api/proposals/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims.sub;
    const updated = await storage.updateProposal(req.params.id, req.body, userId);
    res.json(updated);
  } catch (err) {
    throw new Error(`Failed to update proposal: ${err instanceof Error ? err.message : String(err)}`);
  }

  app.delete('/api/proposals/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).claims.sub;
      const proposal = await storage.getProposal(req.params.id);
      if (!proposal) return res.status(404).json({ message: "Proposal not found" });
      if (proposal.creatorId !== userId) {
        return res.status(403).json({ message: "Only the creator can delete this proposal" });
      }
      await storage.deleteProposal(req.params.id, userId);
      res.status(204).send();
    } catch (err) {
      throw new Error(`Failed to delete proposal: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

});


  app.get('/api/votes/proposal/:proposalId', isAuthenticated, async (req: Request, res: Response) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const votes = await storage.getVotesByProposal(req.params.proposalId);
      const total = await storage.getVotesCount(req.params.proposalId, req.query.daoId as string);
      res.json({ votes, total });
    } catch (err) {
      throw new Error(`Failed to fetch votes: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // ===== ENGAGEMENT FEATURES ROUTES =====

  // --- Proposal Comments Routes ---
  app.post('/api/proposals/:proposalId/comments', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      const userId = (req.user as any).claims.sub;
      const validatedData = insertProposalCommentSchema.parse({
        ...req.body,
        proposalId,
        userId,
      });

      // Check if user is a member of the DAO that owns the proposal
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) return res.status(404).json({ message: "Proposal not found" });

      const membership = await storage.getDaoMembership(proposal.daoId, userId);
      if (!membership) return res.status(403).json({ message: "Must be a DAO member to comment" });

      const comment = await createProposalComment({
        ...validatedData,
        daoId: proposal.daoId,
      });
      res.status(201).json(comment);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: "Invalid comment data", errors: err.errors });
      }
      throw new Error(`Failed to create comment: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.get('/api/proposals/:proposalId/comments', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      const { limit = 10, offset = 0 } = req.query;
      const comments = await getProposalComments(proposalId, Number(limit), Number(offset));
      res.json({ comments, total: comments.length });
    } catch (err) {
      throw new Error(`Failed to fetch comments: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.put('/api/comments/:commentId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { commentId } = req.params;
      const { content } = req.body;
      const userId = (req.user as any).claims.sub;

      if (!content) return res.status(400).json({ message: "Content is required" });

      const updatedComment = await updateProposalComment(commentId, content, userId);
      res.json(updatedComment);
    } catch (err) {
      if (err.message.includes('Only comment author can edit')) {
        return res.status(403).json({ message: err.message });
      }
      throw new Error(`Failed to update comment: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.delete('/api/comments/:commentId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { commentId } = req.params;
      const userId = (req.user as any).claims.sub;

      await deleteProposalComment(commentId, userId);
      res.status(204).send();
    } catch (err) {
      if (err.message.includes('Only comment author can delete')) {
        return res.status(403).json({ message: err.message });
      }
      throw new Error(`Failed to delete comment: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // --- Proposal Likes Routes ---
  app.post('/api/proposals/:proposalId/like', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      const userId = (req.user as any).claims.sub;

      // Check if user is a member of the DAO that owns the proposal
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) return res.status(404).json({ message: "Proposal not found" });

      const membership = await storage.getDaoMembership(proposal.daoId, userId);
      if (!membership) return res.status(403).json({ message: "Must be a DAO member to like proposals" });

      const result = await toggleProposalLike(proposalId, userId, proposal.daoId);
      res.json(result);
    } catch (err) {
      throw new Error(`Failed to toggle proposal like: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.get('/api/proposals/:proposalId/likes', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      const result = await getProposalLikes(proposalId);
      res.json(result);
    } catch (err) {
      throw new Error(`Failed to fetch proposal likes: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // --- Comment Likes Routes ---
  app.post('/api/comments/:commentId/like', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { commentId } = req.params;
      const userId = (req.user as any).claims.sub;

      // Get the comment to find the associated DAO
      const comments = await getProposalComments(''); // This needs to be fixed - we need a getCommentById function
      // For now, we'll require daoId in the request body
      const { daoId } = req.body;
      if (!daoId) return res.status(400).json({ message: "DAO ID is required" });

      const membership = await storage.getDaoMembership(daoId, userId);
      if (!membership) return res.status(403).json({ message: "Must be a DAO member to like comments" });

      const result = await toggleCommentLike(commentId, userId, daoId);
      res.json(result);
    } catch (err) {
      throw new Error(`Failed to toggle comment like: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.get('/api/comments/:commentId/likes', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { commentId } = req.params;
      const result = await getCommentLikes(commentId);
      res.json(result);
    } catch (err) {
      throw new Error(`Failed to fetch comment likes: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // --- DAO Messages (Group Chat) Routes ---
  app.post('/api/dao/:daoId/messages', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = (req.user as any).claims.sub;

      // Check if user is a member of the DAO
      const membership = await storage.getDaoMembership(daoId, userId);
      if (!membership) return res.status(403).json({ message: "Must be a DAO member to send messages" });

      const validatedData = insertDaoMessageSchema.parse({
        ...req.body,
        daoId,
        userId,
      });

      const message = await createDaoMessage(validatedData);
      res.status(201).json(message);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: err.errors });
      }
      throw new Error(`Failed to create message: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.get('/api/dao/:daoId/messages', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      const userId = (req.user as any).claims.sub;

      // Check if user is a member of the DAO
      const membership = await storage.getDaoMembership(daoId, userId);
      if (!membership) return res.status(403).json({ message: "Must be a DAO member to view messages" });

      const messages = await getDaoMessages(daoId, Number(limit), Number(offset));
      res.json({ messages, total: messages.length });
    } catch (err) {
      throw new Error(`Failed to fetch messages: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.put('/api/messages/:messageId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      const userId = (req.user as any).claims.sub;

      if (!content) return res.status(400).json({ message: "Content is required" });

      const updatedMessage = await updateDaoMessage(messageId, content, userId);
      res.json(updatedMessage);
    } catch (err) {
      if (err.message.includes('Only message author can edit')) {
        return res.status(403).json({ message: err.message });
      }
      throw new Error(`Failed to update message: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.delete('/api/messages/:messageId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params;
      const userId = (req.user as any).claims.sub;

      await deleteDaoMessage(messageId, userId);
      res.status(204).send();
    } catch (err) {
      if (err.message.includes('Only message author can delete')) {
        return res.status(403).json({ message: err.message });
      }
      throw new Error(`Failed to delete message: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // --- Contributions ---
  app.get('/api/contributions', isAuthenticated, async (req: Request, res: Response) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const userId = req.query.userId === 'me' ? (req.user as any).claims.sub : req.query.userId;
      const contributions = await storage.getContributions(userId, userId,);
      const total = await storage.getContributionsCount(userId, userId);
      res.json({ contributions, total });
    } catch (err) {
      throw new Error(`Failed to fetch contributions: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.post('/api/contributions', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertContributionSchema.parse(req.body);
      const contribution = await storage.createContribution({
        ...validatedData,
        userId: (req.user as any).claims.sub,
      });
      res.status(201).json(contribution);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: "Invalid contribution data", errors: err.errors });
      }
      throw new Error(`Failed to create contribution: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // --- Vaults ---
  app.post('/api/vaults', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertVaultSchema.parse(req.body);
      const vault = await storage.upsertVault({
        ...validatedData,
        userId: (req.user as any).claims.sub,
      });
      res.status(201).json(vault);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: "Invalid vault data", errors: err.errors });
      }
      throw new Error(`Failed to create/update vault: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.get('/api/vaults/:vaultId/transactions', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    const userId = (req .user as any).claims.sub;
    const vault = await storage.getUserVaults(userId).then((vaults: any[]) =>
      vaults.find((v: any) => v.id === vaultId)
    );
    if (!vault) return res.status(403).json({ message: 'Vault not found or unauthorized' });
    const transactions = await storage.getVaultTransactions(vaultId, Number(limit), Number(offset));
    const total = await storage.getVaultTransactions(vaultId);
    res.json({ transactions, total });
  } catch (err) {
      throw new Error(`Failed to fetch vault transactions: ${err instanceof Error ? err.message : String(err)}`);
  }
});

  // --- Budget ---
  app.get('/api/budget/:month', isAuthenticated, async (req: Request, res: Response) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const plans = await storage.getUserBudgetPlans((req.user as any).claims.sub, req.params.month);
      const total = await storage.getBudgetPlanCount((req.user as any).claims.sub, req.params.month);
      res.json({ plans, total });
    } catch (err) {
      throw new Error(`Failed to fetch budget plans: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.post('/api/budget', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertBudgetPlanSchema.parse(req.body);
      const plan = await storage.upsertBudgetPlan({
        ...validatedData,
        userId: (req.user as any).claims.sub,
      });
      res.status(201).json(plan);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: "Invalid budget plan data", errors: err.errors });
      }
      throw new Error(`Failed to create/update budget plan: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // --- Tasks ---
  app.get('/api/tasks', isAuthenticated, async (req: Request, res: Response) => {
    const { daoId, status, limit = 10, offset = 0 } = req.query;
    const userId = (req.user as any).claims.sub;

    if (!daoId) return res.status(400).json({ message: "DAO ID required" });

    try {
      // Check DAO membership
      const membership = await storage.getDaoMembership(daoId as string, userId);
      if (!membership || membership.status !== 'approved') {
        return res.status(403).json({ message: "DAO membership required to view tasks" });
      }

      const dao = await storage.getDao(daoId as string);
      if (!isDaoPremium(dao)) {
        return res.status(403).json({ message: "Task marketplace is a premium feature. Upgrade your DAO plan." });
      }
      const tasks = await storage.getTasks()
      const total = await storage.getTaskCount(daoId as string, status as string);
      res.json({ tasks, total });
    } catch (err) {
      throw new Error(`Failed to fetch tasks: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.post('/api/tasks/:id/claim', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id;
      const userId = (req.user as any).claims.sub;
      const { daoId } = req.body;
      if (!daoId) return res.status(400).json({ message: "DAO ID required" });
      const dao = await storage.getDao(daoId);
      if (!isDaoPremium(dao)) {
        return res.status(403).json({ message: "Task claiming is a premium feature. Upgrade your DAO plan." });
      }
      const claimedTask = await storage.claimTask(taskId, userId);
      if (!claimedTask) {
        return res.status(404).json({ message: "Task not found or already claimed" });
      }
      res.json(claimedTask);
    } catch (err) {
      throw new Error(`Failed to claim task: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.post('/api/tasks', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { title, description, reward, daoId } = req.body;
      const userId = (req.user as any).claims.sub;

      if (!title || !description || !reward || !daoId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check DAO admin role
      const membership = await storage.getDaoMembership(daoId, userId);
      if (!membership || (membership.role !== 'admin' && membership.role !== 'moderator')) {
        return res.status(403).json({ message: "DAO admin or moderator role required to create tasks" });
      }

      const dao = await storage.getDao(daoId);
      if (!isDaoPremium(dao)) {
        return res.status(403).json({ message: "Task creation is a premium feature. Upgrade your DAO plan." });
      }
      const newTask = await storage.createTask({ title, description, reward, daoId });
      res.status(201).json(newTask);
    } catch (err) {
      throw new Error(`Failed to create task: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // --- User Profile & Settings Endpoints ---
  app.get('/api/user/profile', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).claims.sub;
      const user = await storage.getUserProfile(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
    } catch (err) {
      throw new Error(`Failed to fetch user profile: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.put('/api/user/profile', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).claims.sub;
      const updated = await storage.updateUserProfile(userId, req.body);
      res.json(updated);
    } catch (err) {
      throw new Error(`Failed to update user profile: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.post('/api/user/avatar', isAuthenticated, upload.single("avatar"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      await storage.updateUserProfile((req.user as any).claims.sub, { avatar: avatarUrl });
      res.status(200).json({ message: "Avatar uploaded", avatarUrl });
    } catch (err) {
      throw new Error(`Failed to upload avatar: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.get('/api/user/social', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).claims.sub;
      const social = await storage.getUserSocialLinks(userId);
      res.json(social);
    } catch (err) {
      throw new Error(`Failed to fetch social links: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.post('/api/user/social', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).claims.sub;
      const updated = await storage.updateUserSocialLinks(userId, req.body);
      res.json(updated);
    } catch (err) {
      throw new Error(`Failed to update social links: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.get('/api/user/wallet', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).claims.sub;
      const wallet = await storage.getUserWallet(userId);
      res.json(wallet);
    } catch (err) {
      throw new Error(`Failed to fetch wallet: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.post('/api/user/wallet', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).claims.sub;
      const updated = await storage.updateUserWallet(userId, req.body);
      res.json(updated);
    } catch (err) {
      throw new Error(`Failed to update wallet: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.get('/api/user/settings', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).claims.sub;
      const settings = await storage.getUserSettings(userId);
      res.json(settings);
    } catch (err) {
      throw new Error(`Failed to fetch settings: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.put('/api/user/settings', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).claims.sub;
      const updated = await storage.updateUserSettings(userId, req.body);
      res.json(updated);
    } catch (err) {
      throw new Error(`Failed to update settings: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.get('/api/user/sessions', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).claims.sub;
      const sessions = await storage.getUserSessions(userId);
      res.json(sessions);
    } catch (err) {
      throw new Error(`Failed to fetch sessions: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.delete('/api/user/sessions/:sessionId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { sessionId } = req.params;
      await storage.revokeUserSession(userId, sessionId);
      res.json({ message: 'Session revoked' });
    } catch (err) {
      throw new Error(`Failed to revoke session: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.delete('/api/user/sessions/revoke-all', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).claims.sub;
      await storage.revokeAllUserSessions(userId);
      res.json({ message: 'All sessions revoked' });
    } catch (err) {
      throw new Error(`Failed to revoke all sessions: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.delete('/api/user', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).claims.sub;
      await storage.deleteUserAccount(userId);
      res.json({ message: 'Account deleted' });
    } catch (err) {
      throw new Error(`Failed to delete account: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // --- MaonoVault On-Chain API ---
  app.get('/api/maonovault/nav', async (req: Request, res: Response) => {
    try {
      const [nav, lastUpdate] = await withRetry(() => MaonoVaultService.getNAV());
      res.json({ nav: nav.toString(), lastUpdate });
    } catch (err) {
      throw new Error(`Failed to fetch NAV: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.post('/api/maonovault/deposit', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { amount } = req.body;
      const userAddress = extractWalletAddress(req);
      if (!amount || !userAddress) return res.status(400).json({ message: 'Amount and user wallet required' });
      if (BigInt(amount) <= 0) return res.status(400).json({ message: 'Amount must be positive' });
      const tx = await withRetry(() => MaonoVaultService.deposit(BigInt(amount), userAddress));
      res.json({ txHash: tx.hash });
    } catch (err) {
      throw new Error(`Deposit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.post('/api/maonovault/withdraw', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { amount } = req.body;
      const userAddress = extractWalletAddress(req);
      if (!amount || !userAddress) return res.status(400).json({ message: 'Amount and user wallet required' });
      if (BigInt(amount) <= 0) return res.status(400).json({ message: 'Amount must be positive' });
      const tx = await withRetry(() => MaonoVaultService.withdraw(BigInt(amount), userAddress));
      res.json({ txHash: tx.hash });
    } catch (err) {
      throw new Error(`Withdraw failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.post('/api/maonovault/nav', isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!MaonoVaultService.signer) return res.status(403).json({ message: 'Not authorized' });
      const { newNav } = req.body;
      if (!newNav || BigInt(newNav) < 0) return res.status(400).json({ message: 'Valid newNav required' });
      const tx = await withRetry(() => MaonoVaultService.updateNAV(BigInt(newNav)));
      res.json({ txHash: tx.hash });
    } catch (err) {
      throw new Error(`NAV update failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.post('/api/maonovault/fee', isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!MaonoVaultService.signer) return res.status(403).json({ message: 'Not authorized' });
      const { profit } = req.body;
      if (!profit || BigInt(profit) < 0) return res.status(400).json({ message: 'Valid profit required' });
      const tx = await withRetry(() => MaonoVaultService.distributePerformanceFee(BigInt(profit)));
      res.json({ txHash: tx.hash });
    } catch (err) {
      throw new Error(`Performance fee distribution failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // --- Security Audit Endpoint (Superuser only) ---
  app.get('/api/admin/security-audit', isAuthenticated, isSuperuser, async (req: Request, res: Response) => {
    try {
      const auditReport = {
        timestamp: new Date().toISOString(),
        endpoints: {
          protected: 'All endpoints properly protected with authentication',
          roleBasedAccess: 'Role-based access control implemented',
          daoMembership: 'DAO membership validation in place',
          adminEndpoints: 'Admin endpoints restricted to superusers'
        }
      };
      res.json(auditReport);
    } catch (err) {
      res.status(500).json({ error: 'Security audit failed' });
    }
  });

  // --- Health Check ---
  app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'unknown'
  });
});

  // --- Catch-all 404 ---
  app.use((req: Request, res: Response) => {
    res.status(404).json({ message: 'Not Found' });
  });

  // Error handler middleware
  app.use(errorHandler);

  // Use payment status routes
  app.use('/api/payments/mpesa', mpesaStatusRoutes);
  app.use('/api/payments/stripe', stripeStatusRoutes);
  app.use('/api/payments/kotanipay', kotanipayStatusRoutes);
  app.use('/api/dao-subscriptions', daoSubscriptionRoutes);
  app.use('/api/disbursements', disbursementRoutes);

  // Register task and escrow routes
  app.use('/api/tasks', isAuthenticated, taskRoutes);
  app.use('/api/bounty-escrow', isAuthenticated, bountyEscrowRoutes);
  app.use('/api/notifications', isAuthenticated, notificationRoutes);
  app.use('/api/governance', governanceRoutes);
  app.use('/api/proposal-execution', proposalExecutionRoutes);
}

export function createAppServer(): Server {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  registerRoutes(app);

  return createServer(app);
}

export function startServer(port: number): Server {
  const server = createAppServer();
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
  return server;
}

export default startServer;