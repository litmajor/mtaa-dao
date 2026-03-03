/**
 * 🔧 SYSTEM CONSOLIDATED ROUTES
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Consolidated routing for ultra-small, system-level endpoints
 * 
 * Consolidates from:
 * - server/routes/sse.ts (1 route)
 * - server/routes/account-initialization.ts (2 routes)
 * - server/routes/blog.ts (2 routes)
 * 
 * Mount Point: /api/system
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response, NextFunction } from 'express';
import { isAuthenticated } from '../nextAuthMiddleware';
import { notificationService } from '../notificationService';
import { authenticateToken } from '../middleware/auth';
import initializeUserAccounts, { getAccountInitializationSummary } from '../migrations/initialize-user-accounts';

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 1: SERVER-SENT EVENTS (from sse.ts)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/system/sse/notifications
 * Real-time SSE notifications stream
 */
router.get('/sse/notifications', isAuthenticated, (req: Request, res: Response) => {
  const userId = (req.user as any).claims.sub;
  notificationService.setupSSE(userId, res);
});

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 2: ACCOUNT INITIALIZATION (from account-initialization.ts)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/system/admin/initialize-accounts
 * Initialize accounts for all users (superuser only)
 */
router.post(
  '/admin/initialize-accounts',
  authenticateToken as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is superuser
      if (!req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: 'Only superusers can initialize accounts',
        });
      }

      console.log('🔧 Admin initializing user accounts...');

      // Run initialization
      await initializeUserAccounts();

      // Get summary
      const summary = await getAccountInitializationSummary();

      res.json({
        success: true,
        message: 'User accounts initialized successfully',
        summary,
      });
    } catch (error) {
      console.error('Account initialization error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/system/admin/accounts-summary
 * Get account initialization summary
 */
router.get(
  '/admin/accounts-summary',
  authenticateToken as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is superuser or admin
      if (!req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: 'Only superusers can access this endpoint',
        });
      }

      const summary = await getAccountInitializationSummary();

      res.json({
        success: true,
        summary,
      });
    } catch (error) {
      console.error('Error getting account summary:', error);
      next(error);
    }
  }
);

// ──────────────────────────────────────────────────────────────────────────────
// SECTION 3: BLOG & CONTENT (from blog.ts)
// ──────────────────────────────────────────────────────────────────────────────

const blogPosts = [
  {
    id: 'welcome-to-mtaadao',
    title: 'Welcome to MtaaDAO: Building Economic Power in Your Community',
    excerpt: 'Learn how MtaaDAO is transforming community finance across Africa through transparent, blockchain-powered DAOs.',
    content: `
      <h2>The Future of Community Finance is Here</h2>
      <p>MtaaDAO represents a fundamental shift in how communities organize and manage money. No more lost contributions, unclear decisions, or treasurer disputes. Everything is transparent, democratic, and secure.</p>
      
      <h2>What Makes MtaaDAO Different?</h2>
      <ul>
        <li><strong>Transparent Treasury:</strong> Every shilling accounted for on the blockchain</li>
        <li><strong>Democratic Decisions:</strong> One member, one vote (or weighted by contribution)</li>
        <li><strong>Secure by Design:</strong> Multi-signature wallets prevent theft</li>
        <li><strong>Mobile-First:</strong> Pay with M-Pesa, manage via smartphone</li>
      </ul>
      
      <h2>Who is MtaaDAO For?</h2>
      <p>Whether you're a funeral fund, investment chama, farmers cooperative, or creative collective - if you're pooling money with others, MtaaDAO is for you.</p>
      
      <h2>Getting Started is Easy</h2>
      <ol>
        <li>Create an account (30 seconds)</li>
        <li>Start or join a DAO</li>
        <li>Invite members</li>
        <li>Start contributing and voting</li>
      </ol>
      
      <p>Ready to revolutionize your community finance? <a href="/register">Get started today</a>.</p>
    `,
    author: 'MtaaDAO Team',
    category: 'Getting Started',
    publishedAt: new Date().toISOString(),
    readTime: 5,
    featured: true
  },
  {
    id: 'treasury-management-guide',
    title: 'The Complete Guide to DAO Treasury Management',
    excerpt: 'Master the art of managing shared funds transparently and efficiently with our comprehensive treasury guide.',
    content: `
      <h2>Introduction to Treasury Management</h2>
      <p>Your DAO's treasury is its lifeblood. This guide will help you manage it like a pro.</p>
      
      <h2>Treasury Basics</h2>
      <p>Every DAO has a treasury - a shared wallet controlled by members through multi-signature security. No single person can move funds without approval.</p>
      
      <h2>Best Practices</h2>
      <ul>
        <li>Set clear contribution schedules</li>
        <li>Require proposals for withdrawals</li>
        <li>Maintain emergency reserves (10-20% of total)</li>
        <li>Diversify holdings (don't keep everything in one currency)</li>
        <li>Regular financial reporting to members</li>
      </ul>
      
      <h2>Using Vaults for Growth</h2>
      <p>Vaults allow your treasury to earn yield while maintaining liquidity. Learn more in our <a href="/blog/vaults-explained">Vaults Explained</a> article.</p>
    `,
    author: 'Finance Team',
    category: 'Treasury Management',
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    readTime: 12,
    featured: false
  }
];

/**
 * GET /api/system/blog
 * Get all blog posts
 */
router.get('/blog', async (req: Request, res: Response) => {
  try {
    res.json({ posts: blogPosts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
});

/**
 * GET /api/system/blog/:postId
 * Get specific blog post by ID
 */
router.get('/blog/:postId', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const post = blogPosts.find(p => p.id === postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Blog post not found' });
    }
    
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch blog post' });
  }
});

export default router;
