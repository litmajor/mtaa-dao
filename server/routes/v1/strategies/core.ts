/**
 * V1 Strategies — Core CRUD (Production)
 *
 * GET    /v1/strategies
 * POST   /v1/strategies
 * GET    /v1/strategies/:strategyId
 * PATCH  /v1/strategies/:strategyId
 * PUT    /v1/strategies/:strategyId   (alias of PATCH)
 * DELETE /v1/strategies/:strategyId   (soft deactivate)
 *
 * Auth: real session/JWT only — never req.query.userId.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { strategyDashboardService } from '../../../services/strategyDashboardService';
import { strategyFreqtradeIntegration } from '../../../services/strategyFreqtradeIntegration';
import { Logger } from '../../../utils/logger';
import { rateLimitPerUser } from '../../../middleware/rateLimit';
import { isAuthenticated } from '../../../auth';

const logger = Logger.getLogger();
const router = express.Router();

// ─────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────

const riskLevelSchema = z.enum(['low', 'medium', 'high']);
const sortBySchema = z.enum(['createdAt', 'updatedAt', 'performance']);

const allocationSchema = z.object({
  asset: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .transform((s) => s.toUpperCase()),
  /** Percentage 0–100 (UI-friendly). Sum must equal 100 ± 0.05 */
  percentage: z.number().finite().gt(0).lte(100),
});

const listQuerySchema = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  riskLevel: riskLevelSchema.optional(),
  tags: z.string().optional(),
  sortBy: sortBySchema.default('createdAt'),
});

const createBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  allocations: z.array(allocationSchema).min(1).max(50),
  rebalanceFrequencyDays: z.number().int().min(1).max(365).default(7),
  tags: z.array(z.string().trim().min(1).max(32)).max(20).default([]),
  riskLevel: riskLevelSchema.default('medium'),
  freqtradeStrategyCode: z.string().min(1).max(200_000).optional(),
  freqtradeStrategyName: z.string().trim().max(120).optional(),
  backtestRequest: z
    .object({
      pair: z.string().default('BTC/USDT'),
      timeframe: z.string().default('1h'),
      timerange: z.string().default('20230101-20231231'),
      stakeAmount: z.number().positive().default(100),
      enableOptimization: z.boolean().default(false),
    })
    .optional(),
});

const updateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    allocations: z.array(allocationSchema).min(1).max(50).optional(),
    rebalanceFrequencyDays: z.number().int().min(1).max(365).optional(),
    tags: z.array(z.string().trim().min(1).max(32)).max(20).optional(),
    riskLevel: riskLevelSchema.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, {
    message: 'At least one field is required',
  });

const strategyIdParamSchema = z.object({
  strategyId: z.string().trim().min(1).max(128),
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getUserId(req: Request): string | null {
  const request = req as Request & {
    user?: { id?: string; claims?: { sub?: string; id?: string } };
    session?: { userId?: string; user?: { id?: string } };
  };
  return (
    request.user?.claims?.sub ||
    request.user?.claims?.id ||
    request.user?.id ||
    request.session?.user?.id ||
    request.session?.userId ||
    null
  );
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const id = getUserId(req);
  if (id) {
    (req as any).userId = id;
    return next();
  }

  // Support mounting this router without global authentication middleware.
  return isAuthenticated(req, res, (error?: unknown) => {
    if (error) return next(error);
    const authenticatedUserId = getUserId(req);
    if (!authenticatedUserId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }
    (req as any).userId = authenticatedUserId;
    next();
  });
}

function validateAllocations(
  allocations: Array<{ asset: string; percentage: number }>
): string | null {
  const seen = new Set<string>();
  let sum = 0;
  for (const a of allocations) {
    if (seen.has(a.asset)) return `Duplicate asset: ${a.asset}`;
    seen.add(a.asset);
    sum += a.percentage;
  }
  if (Math.abs(sum - 100) > 0.05) {
    return `Allocations must sum to 100% (got ${sum.toFixed(2)}%)`;
  }
  return null;
}

function creatorIdOf(strategy: any): string | undefined {
  return strategy?.creatorId ?? strategy?.creator ?? strategy?.userId;
}

function sendZodError(res: Response, error: z.ZodError) {
  return res.status(400).json({
    success: false,
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: error.flatten(),
  });
}

// ─────────────────────────────────────────────────────────────
// GET /v1/strategies
// ─────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const q = listQuerySchema.parse(req.query);

    const filters: Record<string, unknown> = {};
    if (q.riskLevel) filters.riskLevel = q.riskLevel;
    if (q.tags) {
      filters.tags = {
        contains: q.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
    }

    const strategies = await strategyDashboardService.listStrategies({
      skip: q.skip,
      limit: q.limit,
      filters,
      sortBy: q.sortBy,
    });

    res.json({
      success: true,
      data: strategies,
      meta: { skip: q.skip, limit: q.limit },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return sendZodError(res, error);
    logger.error('[Strategies:Core] List error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to list strategies',
      code: 'STRATEGY_LIST_FAILED',
    });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /v1/strategies
// ─────────────────────────────────────────────────────────────

router.post(
  '/',
  requireAuth,
  rateLimitPerUser('strategy-create', 10, '10min') as any,
  async (req: Request, res: Response) => {
    try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }
      const body = createBodySchema.parse(req.body);

      const allocErr = validateAllocations(body.allocations);
      if (allocErr) {
        return res.status(400).json({
          success: false,
          error: allocErr,
          code: 'INVALID_ALLOCATIONS',
        });
      }

      logger.info('[Strategies:Core] Creating strategy', {
        name: body.name,
        userId,
        freqtrade: Boolean(body.freqtradeStrategyCode),
      });

      let strategy: any;

      if (body.freqtradeStrategyCode) {
        const strategyId =
          await strategyFreqtradeIntegration.createStrategyWithFreqtrade({
            creatorId: userId,
            name: body.name,
            description: body.description,
            allocations: body.allocations.map(({ asset, percentage }) => ({
              asset,
              weight: percentage / 100,
            })),
            freqtradeStrategyCode: body.freqtradeStrategyCode,
            freqtradeStrategyName:
              body.freqtradeStrategyName || 'CustomStrategy',
            backtestRequest: body.backtestRequest
              ? {
                  pair: body.backtestRequest.pair,
                  timeframe: body.backtestRequest.timeframe,
                  timerange: body.backtestRequest.timerange,
                  stakeAmount: body.backtestRequest.stakeAmount,
                  enableOptimization: body.backtestRequest.enableOptimization,
                }
              : undefined,
          });

        strategy =
          await strategyFreqtradeIntegration.getStrategyDetails(strategyId);
        if (!strategy) {
          throw new Error('Created strategy could not be re-fetched');
        }
      } else {
        strategy = await strategyDashboardService.createStrategy({
          creatorId: userId,
          name: body.name,
          description: body.description ?? '',
          allocations: body.allocations.map(({ asset, percentage }) => ({
            asset,
            weight: percentage / 100,
          })),
          rebalanceFrequencyDays: body.rebalanceFrequencyDays,
          tags: body.tags,
          riskLevel: body.riskLevel,
        });
      }

      res.status(201).json({
        success: true,
        message: 'Strategy created successfully',
        data: strategy,
      });
    } catch (error) {
      if (error instanceof z.ZodError) return sendZodError(res, error);
      logger.error('[Strategies:Core] Create error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to create strategy',
        code: 'STRATEGY_CREATE_FAILED',
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /v1/strategies/:strategyId
// ─────────────────────────────────────────────────────────────

router.get(
  '/:strategyId',
  async (req: Request, res: Response) => {
    try {
      const { strategyId } = strategyIdParamSchema.parse(req.params);
      const userId = getUserId(req) ?? undefined;

      const strategy =
        await strategyDashboardService.getStrategyDetails(strategyId);

      if (!strategy) {
        return res.status(404).json({
          success: false,
          error: 'Strategy not found',
          code: 'STRATEGY_NOT_FOUND',
        });
      }

      const isOwner = Boolean(userId && creatorIdOf(strategy) === userId);

      res.json({
        success: true,
        data: strategy,
        userContext: userId ? { isOwner } : null,
      });
    } catch (error) {
      if (error instanceof z.ZodError) return sendZodError(res, error);
      logger.error('[Strategies:Core] Get details error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get strategy',
        code: 'STRATEGY_GET_FAILED',
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// PATCH / PUT update (allocations applied)
// ─────────────────────────────────────────────────────────────

async function handleUpdate(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }
    const { strategyId } = strategyIdParamSchema.parse(req.params);
    const body = updateBodySchema.parse(req.body);

    if (body.allocations) {
      const allocErr = validateAllocations(body.allocations);
      if (allocErr) {
        return res.status(400).json({
          success: false,
          error: allocErr,
          code: 'INVALID_ALLOCATIONS',
        });
      }
    }

    const existing =
      await strategyDashboardService.getStrategyDetails(strategyId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found',
        code: 'STRATEGY_NOT_FOUND',
      });
    }

    if (creatorIdOf(existing) !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own strategies',
        code: 'STRATEGY_FORBIDDEN',
      });
    }

    const updated = await strategyDashboardService.updateStrategy(strategyId, {
      name: body.name,
      description: body.description,
      tags: body.tags,
      riskLevel: body.riskLevel,
      allocations: body.allocations?.map(({ asset, percentage }) => ({
        asset,
        weight: percentage / 100,
      })),
      rebalanceFrequencyDays: body.rebalanceFrequencyDays,
    });
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found',
        code: 'STRATEGY_NOT_FOUND',
      });
    }

    res.json({
      success: true,
      message: 'Strategy updated successfully',
      data: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return sendZodError(res, error);
    logger.error('[Strategies:Core] Update error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update strategy',
      code: 'STRATEGY_UPDATE_FAILED',
    });
  }
}

router.patch(
  '/:strategyId',
  requireAuth,
  rateLimitPerUser('strategy-update', 30, '10min') as any,
  handleUpdate
);

router.put(
  '/:strategyId',
  requireAuth,
  rateLimitPerUser('strategy-update', 30, '10min') as any,
  handleUpdate
);

// ─────────────────────────────────────────────────────────────
// DELETE (soft)
// ─────────────────────────────────────────────────────────────

router.delete(
  '/:strategyId',
  requireAuth,
  rateLimitPerUser('strategy-delete', 10, '10min') as any,
  async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
        });
      }
      const { strategyId } = strategyIdParamSchema.parse(req.params);

      const existing =
        await strategyDashboardService.getStrategyDetails(strategyId);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Strategy not found',
          code: 'STRATEGY_NOT_FOUND',
        });
      }

      if (creatorIdOf(existing) !== userId) {
        return res.status(403).json({
          success: false,
          error: 'You can only delete your own strategies',
          code: 'STRATEGY_FORBIDDEN',
        });
      }

      await strategyDashboardService.deactivateStrategy(strategyId);

      res.json({
        success: true,
        message: 'Strategy deactivated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return sendZodError(res, error);
      logger.error('[Strategies:Core] Delete error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to delete strategy',
        code: 'STRATEGY_DELETE_FAILED',
      });
    }
  }
);

export default router;