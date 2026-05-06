/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 STRATEGIES ROUTER - CONSOLIDATED ENTRY POINT
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Main router that composes 3 sub-routers:
 * 
 * 1. CORE Sub-Router (CRUD Operations)
 *    └─ GET    /v1/strategies              → List all
 *    └─ POST   /v1/strategies              → Create new
 *    └─ GET    /v1/strategies/:strategyId  → Get details
 *    └─ PUT    /v1/strategies/:strategyId  → Update
 *    └─ DELETE /v1/strategies/:strategyId  → Delete
 * 
 * 2. EXECUTION Sub-Router (Async Operations)
 *    └─ POST   /v1/strategies/:strategyId/backtest          → Queue backtest
 *    └─ GET    /v1/strategies/:strategyId/backtest          → Get results
 *    └─ GET    /v1/strategies/:strategyId/backtest-status/:id → Poll status
 *    └─ POST   /v1/strategies/:strategyId/deploy            → Deploy to Freqtrade
 *    └─ POST   /v1/strategies/:strategyId/optimize          → Queue optimization
 *    └─ POST   /v1/strategies/:strategyId/rebalance         → Trigger rebalance
 *    └─ GET    /v1/strategies/:strategyId/performance       → Get metrics
 * 
 * 3. SOCIAL Sub-Router (Discovery & Social Features)
 *    └─ GET    /v1/strategies/mine                          → User's strategies
 *    └─ GET    /v1/strategies/search                        → Full-text search
 *    └─ GET    /v1/strategies/rankings/:metric              → Leaderboards
 *    └─ POST   /v1/strategies/:strategyId/follow            → Copy strategy
 *    └─ DELETE /v1/strategies/:strategyId/follow            → Unfollow
 *    └─ GET    /v1/strategies/:strategyId/followers         → Follower list
 * 
 * Route Ordering (Important for Express):
 * 1️⃣  Collection-level routes first (no :strategyId param)
 *     - /mine, /search, /rankings/:metric
 * 2️⃣  Creation endpoint (POST /)
 * 3️⃣  Then :strategyId parameter routes (core CRUD + execution + social)
 * 
 * This ordering prevents :strategyId from incorrectly matching collection routes.
 * 
 * @swagger
 * tags:
 *   - name: Strategies
 *     description: |
 *       Trading strategy management with backtesting, deployment, and social features
 * 
 * /v1/strategies:
 *   get:
 *     tags: [Strategies]
 *     summary: List all strategies
 *     description: Retrieve all available strategies with filtering and pagination
 *     parameters:
 *       - in: query
 *         name: skip
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: riskLevel
 *         schema: { type: string, enum: [low, medium, high] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, updatedAt, performance] }
 *     responses:
 *       200:
 *         description: Strategies retrieved
 *   post:
 *     tags: [Strategies]
 *     summary: Create new strategy
 *     description: Create a new trading strategy with allocations
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, allocations]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               allocations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     asset: { type: string }
 *                     percentage: { type: number }
 *               riskLevel: { type: string, enum: [low, medium, high] }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Strategy created
 *       400:
 *         description: Validation error
 *     security: [{ bearerAuth: [] }]
 * 
 * /v1/strategies/{strategyId}:
 *   get:
 *     tags: [Strategies]
 *     summary: Get strategy details
 *     description: Retrieve detailed information about a specific strategy
 *     parameters:
 *       - in: path
 *         name: strategyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Strategy details
 *       404:
 *         description: Strategy not found
 *   put:
 *     tags: [Strategies]
 *     summary: Update strategy
 *     description: Update strategy metadata (creator only)
 *     parameters:
 *       - in: path
 *         name: strategyId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               riskLevel: { type: string }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Strategy updated
 *       403:
 *         description: Unauthorized
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Strategies]
 *     summary: Delete strategy
 *     description: Deactivate a strategy (creator only)
 *     parameters:
 *       - in: path
 *         name: strategyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Strategy deleted
 *       403:
 *         description: Unauthorized
 *     security: [{ bearerAuth: [] }]
 * 
 * /v1/strategies/mine:
 *   get:
 *     tags: [Strategies]
 *     summary: Get user's strategies
 *     description: Retrieve strategies created or followed by the current user
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema: { type: string, enum: [created, followed, all] }
 *     responses:
 *       200:
 *         description: User's strategies
 *     security: [{ bearerAuth: [] }]
 * 
 * /v1/strategies/search:
 *   get:
 *     tags: [Strategies]
 *     summary: Search strategies
 *     description: Full-text search for strategies by name, tags, etc.
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search query
 *       - in: query
 *         name: riskLevel
 *         schema: { type: string, enum: [low, medium, high] }
 *     responses:
 *       200:
 *         description: Search results
 * 
 * /v1/strategies/{strategyId}/backtest:
 *   post:
 *     tags: [Strategies]
 *     summary: Queue backtest job
 *     description: Initiate backtesting (returns 202 Accepted with job ID)
 *     parameters:
 *       - in: path
 *         name: strategyId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pair: { type: string }
 *               timeframe: { type: string }
 *               timerange: { type: string }
 *     responses:
 *       202:
 *         description: Backtest queued (use statusUrl to poll)
 *     security: [{ bearerAuth: [] }]
 *   get:
 *     tags: [Strategies]
 *     summary: Get backtest results
 *     description: Retrieve completed backtest results
 *     parameters:
 *       - in: path
 *         name: strategyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Backtest results
 * 
 * /v1/strategies/{strategyId}/backtest-status/{jobId}:
 *   get:
 *     tags: [Strategies]
 *     summary: Poll backtest status
 *     description: Check status of running backtest job (202 = pending, 200 = done)
 *     parameters:
 *       - in: path
 *         name: strategyId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       202:
 *         description: Still processing
 *       200:
 *         description: Complete with results
 *       404:
 *         description: Job expired
 * 
 * /v1/strategies/{strategyId}/follow:
 *   post:
 *     tags: [Strategies]
 *     summary: Follow strategy
 *     description: Copy strategy to your portfolio
 *     parameters:
 *       - in: path
 *         name: strategyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Strategy followed
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Strategies]
 *     summary: Unfollow strategy
 *     description: Remove strategy from your portfolio
 *     parameters:
 *       - in: path
 *         name: strategyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Strategy unfollowed
 *     security: [{ bearerAuth: [] }]
 * 
 * /v1/strategies/{strategyId}/followers:
 *   get:
 *     tags: [Strategies]
 *     summary: Get strategy followers
 *     description: List users who have followed this strategy
 *     parameters:
 *       - in: path
 *         name: strategyId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: skip
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated follower list
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Router } from 'express';
import coreRouter from './core';
import executionRouter from './execution';
import socialRouter from './social';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE COMPOSITION (Order Matters!)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * STEP 1: Collection-level routes (no :strategyId)
 * Mount BEFORE :strategyId to avoid param matching
 */
router.use('/mine', socialRouter);           // GET /v1/strategies/mine
router.use('/search', socialRouter);         // GET /v1/strategies/search
router.use('/rankings', socialRouter);       // GET /v1/strategies/rankings/:metric

/**
 * STEP 2: Core CRUD routes
 * - Handles: GET|POST / (list and create)
 * - Handles: GET|PUT|DELETE /:strategyId (read, update, delete)
 */
router.use('/', coreRouter);

/**
 * STEP 3: Execution sub-router (nested on :strategyId)
 * - Mounted after core so /:strategyId is available
 * - Uses mergeParams: true to access :strategyId
 * - Paths: /:strategyId/backtest, /:strategyId/deploy, etc.
 */
router.use('/:strategyId/backtest', executionRouter);
router.use('/:strategyId/backtest-status', executionRouter);
router.use('/:strategyId/performance', executionRouter);
router.use('/:strategyId/deploy', executionRouter);
router.use('/:strategyId/optimize', executionRouter);
router.use('/:strategyId/rebalance', executionRouter);

/**
 * STEP 4: Social sub-router (nested on :strategyId)
 * - Mounted after core so /:strategyId is available
 * - Uses mergeParams: true to access :strategyId
 * - Paths: /:strategyId/follow, /:strategyId/followers
 */
router.use('/:strategyId/follow', socialRouter);
router.use('/:strategyId/followers', socialRouter);

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Strategy endpoint not found',
    path: req.path
  });
});

export default router;
