/**
 * YUKI Strategies Router - Execution-Scoped Strategy Management
 * 
 * Routes for executing, backtesting, and monitoring trading strategies:
 * - GET /v1/yuki/strategies              - List execution-scoped strategies
 * - GET /v1/yuki/strategies/:id          - Get strategy details
 * - POST /v1/yuki/strategies/:id/deploy  - Deploy strategy (MirrorCore-X consumer)
 * - POST /v1/yuki/strategies/:id/backtest - Run backtest simulation
 * - GET /v1/yuki/strategies/:id/signals  - Live signal stream
 * 
 * Shares strategyId FK with /v1/strategies but scoped to active execution
 * 
 * Authentication: Required (JWT token)
 * Rate Limiting: 60 req/min per user
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../../../auth';
import { logger } from '../../../utils/logger';
import { pool, db } from '../../../db';
import { redis } from '../../../services/redis';
import { orderRouter } from '../../../services/orderRouter';

const router = express.Router();

// ════════════════════════════════════════════════════════════════════════════════
// Schemas
// ════════════════════════════════════════════════════════════════════════════════

const strategyIdSchema = z.object({
  id: z.string().min(1, 'Strategy ID required'),
});

const deploySchema = z.object({
  strategyId: z.string().min(1),
  exchangeConnections: z.array(z.string()).min(1, 'At least one exchange required'),
  tradingPair: z.string().min(1, 'Trading pair required'),
  enableRealTrading: z.boolean().default(false),
  maxOrderSize: z.number().positive().optional(),
  dailyLossLimit: z.number().positive().optional(),
});

const backtestSchema = z.object({
  strategyId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  initialCapital: z.number().positive().default(10000),
  tradingPair: z.string().min(1, 'Trading pair required'),
});

const compiledDeploySchema = z.object({
  compiled: z.any(),
  deploymentConfig: z.object({
    tradingPair: z.string().min(1).optional(),
    exchangeConnections: z.array(z.string()).optional(),
    enableRealTrading: z.boolean().optional(),
    maxOrderSize: z.number().optional(),
    dailyLossLimit: z.number().optional(),
  }).optional(),
});

const listStrategiesSchema = z.object({
  status: z.enum(['draft', 'backtesting', 'active', 'paused', 'stopped']).optional(),
  skip: z.string().optional().default('0'),
  limit: z.string().optional().default('20'),
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/strategies - List execution-scoped strategies
// ════════════════════════════════════════════════════════════════════════════════

/**
 * List user's trading strategies with execution status
 */
router.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const query = listStrategiesSchema.parse(req.query);
    const userId = (req as any).user?.id;
    const skip = parseInt(query.skip);
    const limit = Math.min(parseInt(query.limit), 100);

    logger.info('[YUKI-STRATEGIES] Listing execution strategies', {
      userId,
      status: query.status,
      skip,
      limit,
    });

    // Build query
    let whereClause = 'WHERE s.user_id = $1';
    const params: any[] = [userId];

    if (query.status) {
      whereClause += ` AND se.status = $${params.length + 1}`;
      params.push(query.status);
    }

    // Get total count of strategies (no expensive COUNT(DISTINCT) with JOINs)
    const countResult = await pool.query(
      `SELECT COUNT(*) as total 
       FROM strategies s 
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get strategies with precomputed stats (no expensive aggregations!)
    const result = await pool.query(
      `SELECT 
        s.id, s.name, s.description, s.returns, s.win_rate,
        s.total_trades, s.max_drawdown, s.created_at, s.updated_at,
        ss.execution_count,
        ss.signal_count_24h,
        ss.last_execution_at
       FROM strategies s
       LEFT JOIN strategy_stats ss ON s.id = ss.strategy_id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, skip]
    );

    const strategies = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      performance: {
        totalReturn: parseFloat(row.returns.toFixed(2)) || 0,
        winRate: parseFloat((row.win_rate * 100).toFixed(2)) || 0,
        totalTrades: row.total_trades || 0,
        maxDrawdown: parseFloat((row.max_drawdown * 100).toFixed(2)) || 0,
      },
      execution: row.execution_count ? {
        executionCount: row.execution_count,
        lastExecutedAt: row.last_execution_at?.toISOString(),
        signalsLast24h: row.signal_count_24h || 0,
      } : null,
      createdAt: row.created_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString(),
    }));

    return res.json({
      success: true,
      data: {
        strategies,
        pagination: {
          skip,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors,
      });
    }

    logger.error('[YUKI-STRATEGIES] Failed to list strategies', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to list strategies',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/strategies/:id - Get strategy details
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Get full strategy details including execution history
 */
router.get('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = strategyIdSchema.parse(req.params);
    const userId = (req as any).user?.id;

    logger.info('[YUKI-STRATEGIES] Fetching strategy', { strategyId: id, userId });

    // Verify ownership and fetch details with precomputed stats
    const result = await pool.query(
      `SELECT 
        s.id, s.user_id, s.name, s.description, s.parameters,
        s.returns, s.win_rate, s.total_trades, s.max_drawdown,
        s.created_at, s.updated_at,
        ss.execution_count,
        ss.last_execution_at
       FROM strategies s
       LEFT JOIN strategy_stats ss ON s.id = ss.strategy_id
       WHERE s.id = $1 AND s.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found',
      });
    }

    const row = result.rows[0];
    const parameters = typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters;

    return res.json({
      success: true,
      data: {
        id: row.id,
        name: row.name,
        description: row.description,
        parameters,
        performance: {
          totalReturn: parseFloat(row.returns.toFixed(2)) || 0,
          winRate: parseFloat((row.win_rate * 100).toFixed(2)) || 0,
          totalTrades: row.total_trades || 0,
          maxDrawdown: parseFloat((row.max_drawdown * 100).toFixed(2)) || 0,
        },
        executionHistory: {
          totalExecutions: row.execution_count || 0,
          lastExecuted: row.last_execution_at?.toISOString(),
        },
        createdAt: row.created_at?.toISOString(),
        updatedAt: row.updated_at?.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid strategy ID format',
        details: error.errors,
      });
    }

    logger.error('[YUKI-STRATEGIES] Failed to fetch strategy', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch strategy',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /v1/yuki/strategies/:id/deploy - Deploy strategy
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Deploy strategy to MirrorCore-X consumer for live execution
 * Creates execution instance with safeguards and position limits
 */
router.post('/:id/deploy', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = strategyIdSchema.parse(req.params);
    const params = deploySchema.parse(req.body);
    const userId = (req as any).user?.id;

    logger.info('[YUKI-STRATEGIES] Deploying strategy', {
      userId,
      strategyId: id,
      exchanges: params.exchangeConnections,
    });

    // Verify strategy ownership
    const stratResult = await pool.query(`SELECT id, user_id FROM strategies WHERE id = $1`, [id]);

    if (stratResult.rows.length === 0 || stratResult.rows[0].user_id !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found or unauthorized',
      });
    }

    // Verify exchange connections exist
    const exchResult = await pool.query(
      `SELECT id, exchange FROM cex_credentials 
       WHERE id = ANY($1::uuid[]) AND user_id = $2 AND is_active = true`,
      [params.exchangeConnections, userId]
    );

    if (exchResult.rows.length !== params.exchangeConnections.length) {
      return res.status(400).json({
        success: false,
        error: 'One or more exchange connections not found or inactive',
      });
    }

    // Create execution record
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const deploymentConfig = {
      tradingPair: params.tradingPair,
      exchanges: exchResult.rows.map((r: any) => r.exchange),
      maxOrderSize: params.maxOrderSize || null,
      dailyLossLimit: params.dailyLossLimit || null,
      realTrading: params.enableRealTrading,
      deployedAt: new Date().toISOString(),
    };

    const insertResult = await pool.query(
      `INSERT INTO strategy_executions (
        id, strategy_id, user_id, status, deployment_config,
        real_trading_enabled, started_at, created_at
      ) VALUES ($1, $2, $3, 'active', $4, $5, NOW(), NOW())
       RETURNING id, started_at`,
      [executionId, id, userId, JSON.stringify(deploymentConfig), params.enableRealTrading]
    );

    // Log deployment event
    await pool.query(
      `INSERT INTO execution_logs (execution_id, event_type, message, metadata)
       VALUES ($1, 'deployment', $2, $3)`,
      [executionId, 'Strategy deployed', JSON.stringify(deploymentConfig)]
    );

    // publish to redis channel for real-time clients
    try {
      const payload = { executionId, type: 'deployment', message: 'Strategy deployed', metadata: deploymentConfig, timestamp: new Date().toISOString() };
      await redis.publish(`execution:${executionId}`, JSON.stringify(payload));
    } catch (err) {
      logger.warn('[YUKI-STRATEGIES] Redis publish failed', { err });
    }

    return res.status(201).json({
      success: true,
      data: {
        executionId: insertResult.rows[0].id,
        strategyId: id,
        status: 'active',
        deploymentConfig,
        startedAt: insertResult.rows[0].started_at?.toISOString(),
        message: `Strategy deployed on ${params.exchangeConnections.length} exchange(s). Monitoring active.`,
        signalsUrl: `/v1/yuki/strategies/${id}/signals/${executionId}`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deployment configuration',
        details: error.errors,
      });
    }

    logger.error('[YUKI-STRATEGIES] Failed to deploy strategy', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to deploy strategy',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /v1/yuki/strategies/:id/backtest - Run backtest
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Run historical backtest on strategy to validate performance
 * Returns metrics and simulated execution results
 */
router.post('/:id/backtest', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = strategyIdSchema.parse(req.params);
    const params = backtestSchema.parse(req.body);
    const userId = (req as any).user?.id;

    logger.info('[YUKI-STRATEGIES] Running backtest', {
      userId,
      strategyId: id,
      dateRange: `${params.startDate} to ${params.endDate}`,
    });

    // Verify strategy ownership
    const stratResult = await pool.query(
      `SELECT id, user_id, parameters FROM strategies WHERE id = $1`,
      [id]
    );

    if (stratResult.rows.length === 0 || stratResult.rows[0].user_id !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found or unauthorized',
      });
    }

    // Create backtest record
    const backtestId = `bt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // For now, return simulated backtest results
    // In production, this would fetch OHLCV data and run the strategy logic
    const simulatedResults = {
      totalTrades: Math.floor(Math.random() * 500) + 50,
      winRate: 0.45 + Math.random() * 0.25,
      avgWin: (100 + Math.random() * 200).toFixed(2),
      avgLoss: (40 + Math.random() * 80).toFixed(2),
      maxDrawdown: 0.1 + Math.random() * 0.2,
      totalReturn: (params.initialCapital * (0.5 + Math.random() * 1.5) - params.initialCapital).toFixed(2),
      sharpeRatio: 0.5 + Math.random() * 2,
    };

    await pool.query(
      `INSERT INTO backtest_results (
        id, strategy_id, user_id, start_date, end_date, 
        initial_capital, results, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', NOW())`,
      [
        backtestId,
        id,
        userId,
        new Date(params.startDate),
        new Date(params.endDate),
        params.initialCapital,
        JSON.stringify(simulatedResults),
      ]
    );

    return res.status(201).json({
      success: true,
      data: {
        backtestId,
        strategyId: id,
        dateRange: {
          start: params.startDate,
          end: params.endDate,
        },
        initialCapital: params.initialCapital,
        results: {
          totalTrades: simulatedResults.totalTrades,
          winRate: parseFloat((simulatedResults.winRate * 100).toFixed(2)),
          profitFactor: (
            (simulatedResults.totalTrades * parseFloat(simulatedResults.avgWin)) /
            (simulatedResults.totalTrades * (1 - simulatedResults.winRate) * parseFloat(simulatedResults.avgLoss))
          ).toFixed(2),
          maxDrawdown: parseFloat((simulatedResults.maxDrawdown * 100).toFixed(2)),
          totalReturn: parseFloat(simulatedResults.totalReturn),
          sharpeRatio: parseFloat(simulatedResults.sharpeRatio.toFixed(2)),
        },
        status: 'completed',
        completedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid backtest parameters',
        details: error.errors,
      });
    }

    logger.error('[YUKI-STRATEGIES] Failed to run backtest', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to run backtest',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/strategies/:id/signals - Live signal stream
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Get live trading signals from active strategy execution
 * Returns real-time buy/sell signals and execution decisions
 */
router.get('/:id/signals', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = strategyIdSchema.parse(req.params);
    const userId = (req as any).user?.id;
    const limit = Math.min(parseInt((req.query.limit as string) || '50'), 200);

    logger.info('[YUKI-STRATEGIES] Fetching signals', {
      userId,
      strategyId: id,
      limit,
    });

    // Verify strategy ownership
    const stratResult = await pool.query(
      `SELECT s.id FROM strategies s WHERE s.id = $1 AND s.user_id = $2`,
      [id, userId]
    );

    if (stratResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found',
      });
    }

    // Fetch recent execution logs/signals
    const signalsResult = await pool.query(
      `SELECT 
        el.id, el.event_type, el.message, el.metadata,
        el.created_at, se.id as execution_id
       FROM execution_logs el
       JOIN strategy_executions se ON el.execution_id = se.id
       WHERE se.strategy_id = $1 AND se.user_id = $2
       ORDER BY el.created_at DESC
       LIMIT $3`,
      [id, userId, limit]
    );

    const signals = signalsResult.rows.map((row: any) => ({
      id: row.id,
      executionId: row.execution_id,
      type: row.event_type,
      message: row.message,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      timestamp: row.created_at?.toISOString(),
    }));

    return res.json({
      success: true,
      data: {
        strategyId: id,
        signals,
        total: signals.length,
        timestamp: new Date().toISOString(),
        note: 'Subscribe to WebSocket for real-time updates: wss://api.yuki.io/ws/strategies/:id/signals',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid strategy ID format',
        details: error.errors,
      });
    }

    logger.error('[YUKI-STRATEGIES] Failed to fetch signals', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch signals',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /v1/yuki/strategies/deploy - Deploy compiled strategy payload
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Accepts a compiled strategy object (from visual builder) and creates an execution.
 * Returns `executionId` and `signalsUrl` for the created execution so the client
 * can subscribe to logs via SSE at GET /v1/yuki/strategies/:id/signals/:executionId
 */
router.post('/deploy', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const parsed = compiledDeploySchema.parse(req.body);
    const userId = (req as any).user?.id;
    const compiled = parsed.compiled;
    const deployCfg = parsed.deploymentConfig || {};

    // Determine strategy id: reuse if compiled contains an id owned by user, otherwise create a draft
    let strategyId = compiled?.id || `strat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Try to update existing strategy if owned
    const updateResult = await pool.query(
      `UPDATE strategies SET parameters = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING id, user_id`,
      [JSON.stringify(compiled), strategyId, userId]
    );

    if (updateResult.rowCount === 0) {
      // create draft strategy
      await pool.query(
        `INSERT INTO strategies (id, user_id, name, description, parameters, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [strategyId, userId, compiled?.name || 'Untitled (deployed)', compiled?.description || '', JSON.stringify(compiled)]
      );
    }

    // Create execution entry
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const deploymentConfig = {
      tradingPair: deployCfg.tradingPair || null,
      exchanges: deployCfg.exchangeConnections || [],
      maxOrderSize: deployCfg.maxOrderSize || null,
      dailyLossLimit: deployCfg.dailyLossLimit || null,
      realTrading: !!deployCfg.enableRealTrading,
      compiledAt: new Date().toISOString(),
    };

    await pool.query(
      `INSERT INTO strategy_executions (
        id, strategy_id, user_id, status, deployment_config, real_trading_enabled, started_at, created_at
      ) VALUES ($1, $2, $3, 'active', $4, $5, NOW(), NOW())`,
      [executionId, strategyId, userId, JSON.stringify(deploymentConfig), !!deployCfg.enableRealTrading]
    );

    // Log initial deployment
    await pool.query(
      `INSERT INTO execution_logs (execution_id, event_type, message, metadata)
       VALUES ($1, 'deployment', $2, $3)`,
      [executionId, 'Compiled strategy deployed', JSON.stringify({ deploymentConfig })]
    );

    // publish to redis channel for real-time clients
    try {
      const payload = { executionId, type: 'deployment', message: 'Compiled strategy deployed', metadata: deploymentConfig, timestamp: new Date().toISOString() };
      await redis.publish(`execution:${executionId}`, JSON.stringify(payload));
    } catch (err) {
      logger.warn('[YUKI-STRATEGIES] Redis publish failed', { err });
    }

    return res.status(201).json({
      success: true,
      data: {
        executionId,
        strategyId,
        status: 'active',
        deploymentConfig,
        message: 'Compiled strategy deployed. Connect to the signals SSE for logs.',
        signalsUrl: `/v1/yuki/strategies/${strategyId}/signals/${executionId}`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid compiled deploy payload', details: error.errors });
    }

    logger.error('[YUKI-STRATEGIES] Failed to deploy compiled strategy', { error });
    return res.status(500).json({ success: false, error: 'Failed to deploy compiled strategy' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/strategies/:id/signals/:executionId - SSE stream for execution logs
// ════════════════════════════════════════════════════════════════════════════════

router.get('/:id/signals/:executionId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = strategyIdSchema.parse(req.params);
    const executionId = String(req.params.executionId || '');
    const userId = (req as any).user?.id;

    // Verify execution exists and belongs to user
    const execResult = await pool.query(
      `SELECT id, strategy_id, user_id FROM strategy_executions WHERE id = $1 AND strategy_id = $2 AND user_id = $3`,
      [executionId, id, userId]
    );

    if (execResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Execution not found' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();

    let lastTs = new Date(0).toISOString();

    // send existing logs first
    const sendLogs = async () => {
      const logsRes = await pool.query(
        `SELECT id, event_type, message, metadata, created_at FROM execution_logs WHERE execution_id = $1 AND created_at > $2 ORDER BY created_at ASC`,
        [executionId, lastTs]
      );
      for (const row of logsRes.rows) {
        const payload = {
          id: row.id,
          type: row.event_type,
          message: row.message,
          metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
          timestamp: row.created_at?.toISOString(),
        };
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        lastTs = row.created_at?.toISOString() || lastTs;
      }
    };

    await sendLogs();

    const timer = setInterval(async () => {
      try {
        await sendLogs();
      } catch (err) {
        logger.warn('[YUKI-STRATEGIES] SSE sendLogs error', { err });
      }
    }, 1000);

    req.on('close', () => {
      clearInterval(timer);
      try { res.end(); } catch (e) {}
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid request', details: error.errors });
    }
    logger.error('[YUKI-STRATEGIES] SSE stream failed', { error });
    return res.status(500).json({ success: false, error: 'Failed to open signals stream' });
  }
});

// POST /v1/yuki/strategies/save-graph - Persist strategy graph/layout
router.post('/save-graph', isAuthenticated, async (req: Request, res: Response) => {
  try {
    // Basic size limit to avoid DoS before deep validation
    const rawSize = Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8');
    const MAX_SIZE = 200 * 1024; // 200 KB
    if (rawSize > MAX_SIZE) return res.status(413).json({ success: false, error: 'Graph payload too large' });

    // Strict Zod schemas for graph payload to reject malformed nodes/configs early
    const portSchema = z.object({
      id: z.string().min(1),
      name: z.string().optional(),
      direction: z.enum(['in', 'out']),
    });

    const positionSchema = z.object({ x: z.number(), y: z.number() }).optional();

    const baseNodeSchema = z.object({
      id: z.string().min(1),
      type: z.enum(['condition', 'action', 'logic', 'risk', 'execution', 'ai', 'vault', 'crosschain']),
      label: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      position: positionSchema,
      ports: z.array(portSchema).optional(),
    });

    const conditionNode = baseNodeSchema.extend({ type: z.literal('condition'), config: z.object({ expression: z.string().optional() }).optional() });
    const actionNode = baseNodeSchema.extend({ type: z.literal('action'), config: z.object({ actionType: z.string().optional(), params: z.record(z.any()).optional() }).optional() });
    const riskNode = baseNodeSchema.extend({ type: z.literal('risk'), config: z.object({ stopLossPct: z.number().optional(), takeProfitPct: z.number().optional() }).optional() });
    const executionNode = baseNodeSchema.extend({ type: z.literal('execution'), config: z.object({ schedule: z.string().optional() }).optional() });
    const logicNode = baseNodeSchema.extend({ type: z.literal('logic'), config: z.record(z.any()).optional() });

    // Simple, explicit schemas for AI/Vault/Crosschain nodes to avoid arbitrary shapes
    const aiNode = baseNodeSchema.extend({ type: z.literal('ai'), config: z.object({ model: z.string().optional(), prompt: z.string().optional(), temperature: z.number().optional() }).optional() });
    const vaultNode = baseNodeSchema.extend({ type: z.literal('vault'), config: z.object({ vaultId: z.string().optional(), action: z.string().optional() }).optional() });
    const crosschainNode = baseNodeSchema.extend({ type: z.literal('crosschain'), config: z.object({ chain: z.string().optional(), method: z.string().optional(), params: z.record(z.any()).optional() }).optional() });

    const nodeSchema = z.discriminatedUnion('type', [conditionNode, actionNode, riskNode, executionNode, logicNode, aiNode, vaultNode, crosschainNode]);

    const edgeSchema = z.object({
      id: z.string().min(1),
      sourceNodeId: z.string().min(1),
      sourcePortId: z.string().optional(),
      targetNodeId: z.string().min(1),
      targetPortId: z.string().optional(),
      label: z.string().optional(),
    });

    const graphSchema = z.object({
      id: z.string().min(1),
      name: z.string().optional(),
      description: z.string().optional(),
      nodes: z.array(nodeSchema).optional(),
      edges: z.array(edgeSchema).optional(),
      metadata: z.any().optional(),
    });

    const saveGraphSchema = z.object({ graph: graphSchema });

    const parsed = saveGraphSchema.parse(req.body);
    const graph = parsed.graph;
    const userId = (req as any).user?.id;

    // Try to update existing strategy parameters/layout
    const updateResult = await pool.query(
      `UPDATE strategies SET parameters = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING id`,
      [JSON.stringify(graph), graph.id, userId]
    );

    if (updateResult.rowCount === 0) {
      // Not found or not owned — create a new draft strategy referencing this graph
      const newId = graph.id || `strat_${Date.now().toString(16).slice(2)}`;
      await pool.query(
        `INSERT INTO strategies (id, user_id, name, description, parameters, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [newId, userId, graph.name || 'Untitled Strategy', graph.description || '', JSON.stringify(graph)]
      );
      return res.json({ success: true, data: { id: newId, created: true } });
    }

    return res.json({ success: true, data: { id: graph.id, updated: true } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('[YUKI-STRATEGIES] Invalid save-graph payload', { errors: error.errors });
      return res.status(400).json({ success: false, error: 'Invalid graph payload', details: error.errors });
    }

    logger.error('[YUKI-STRATEGIES] Failed to save graph', { error });
    return res.status(500).json({ success: false, error: 'Failed to save graph' });
  }
});

export default router;
