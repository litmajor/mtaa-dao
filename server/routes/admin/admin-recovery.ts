/**
 * Admin Recovery Management Routes
 * Super admin endpoints for recovery workflow management
 * Phase 3c Part 5 - Recovery Workflows
 */

import { Router } from 'express';
import { authenticate, authorize } from '../../auth';
import { circuitBreakerRegistry } from '../../core/consolidation/CircuitBreakerConsolidation';
import { paymentRecoverySAGA } from '../../services/PaymentRecoverySAGAOrchestrator';
import { paymentRecoveryWorkflowService } from '../../services/paymentRecoveryWorkflowService';
import { pool } from '../../db';
import { AppError } from '../../utils/appError';

const router = Router();

// All routes require super admin auth
router.use(authenticate, authorize('super_admin'));

/**
 * GET /admin/recovery/workflows
 * List all recovery workflows (paginated, filterable)
 */
router.get('/recovery/workflows', async (req, res) => {
  try {
    const limit = parsePaginationValue(req.query.limit, 50, 100);
    const offset = parsePaginationValue(req.query.offset, 0, Number.MAX_SAFE_INTEGER);
    const state = req.query.state as string || 'all';
    const strategy = req.query.strategy as string || 'all';

    const filters: string[] = [];
    const values: string[] = [];

    if (state !== 'all') {
      filters.push(`status = $${values.length + 1}`);
      values.push(state);
    }

    if (strategy !== 'all') {
      filters.push(`current_step = $${values.length + 1}`);
      values.push(strategy);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT id, status, user_id, payment_id, amount, currency, steps_completed, current_step,
          compensation_steps, attempt_count, max_attempts, last_error, created_at, updated_at
      FROM payment_sagas ${whereClause}
       ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM payment_sagas ${whereClause}`,
      values
    );

    res.json({
      timestamp: new Date(),
      workflows: result.rows,
      pagination: {
        total: countResult.rows[0].count,
        limit,
        offset,
        returned: result.rows.length
      }
    });
  } catch (error) {
    if (error instanceof InvalidParameterError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error fetching workflows:', error);
    res.status(500).json({
      error: 'Failed to fetch workflows',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /admin/recovery/workflows/:workflowId
 * Get specific recovery workflow (admin view)
 */
router.get('/recovery/workflows/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;

    const saga = await paymentRecoverySAGA.getSAGAState(workflowId);

    if (!saga) {
      return res.status(404).json({
        error: 'Workflow not found'
      });
    }

    res.json({
      timestamp: new Date(),
      workflowId,
      saga,
      adminView: {
        currentStep: saga.currentStep,
        completedSteps: saga.stepsCompleted,
        totalSteps: paymentRecoverySAGA.getTotalExecutionSteps(saga),
        progress: `${saga.stepsCompleted.length}/${paymentRecoverySAGA.getTotalExecutionSteps(saga)}`,
        errors: saga.lastError ? [saga.lastError] : [],
        events: await paymentRecoverySAGA.getSAGAEvents(workflowId),
        createdAt: saga.createdAt,
        updatedAt: saga.updatedAt,
        completedAt: ['succeeded', 'failed', 'abandoned'].includes(saga.status) ? saga.updatedAt : null
      }
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({
      error: 'Failed to fetch workflow',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /admin/recovery/stats
 * Get recovery statistics and metrics
 */
router.get('/recovery/stats', async (req, res) => {
  try {
    const hoursBack = parsePositiveInteger(req.query.hoursBack, 24);
    const fromDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const stats = await paymentRecoverySAGA.getSAGAStats(fromDate);
    const compensated = stats.compensating + stats.abandoned;
    const successRate = stats.total > 0 ? (stats.succeeded / stats.total) * 100 : 0;

    res.json({
      timestamp: new Date(),
      period: { hoursBack, from: fromDate, to: new Date() },
      metrics: {
        total: stats.total,
        recentCount: stats.total,
        succeeded: stats.succeeded,
        failed: stats.failed,
        processing: stats.processing,
        compensated,
        successRate: Math.round(successRate * 100) / 100,
        averageDurationMs: stats.averageDurationMs
      },
      statusBreakdown: {
        pending: 0,
        processing: stats.processing,
        succeeded: stats.succeeded,
        failed: stats.failed,
        compensated
      }
    });
  } catch (error) {
    if (error instanceof InvalidParameterError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error fetching recovery stats:', error);
    res.status(500).json({
      error: 'Failed to fetch recovery stats',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /admin/recovery/circuit-breakers
 * Get circuit breaker status for all providers
 */
router.get('/recovery/circuit-breakers', async (req, res) => {
  try {
    // Get all domain breakers from registry
    const allBreakers = circuitBreakerRegistry.getAll();

    // Group by state
    const byState: Record<string, any[]> = {
      closed: [],
      open: [],
      half_open: []
    };

    allBreakers.forEach(b => {
      const state = b.getState().toLowerCase();
      if (byState[state]) {
        byState[state].push(b);
      }
    });

    res.json({
      timestamp: new Date(),
      breakers: allBreakers.map(b => ({
        ...b.getMetrics(),
      })),
      summary: {
        total: allBreakers.length,
        healthy: byState.closed.length,
        broken: byState.open.length,
        recovering: byState.half_open.length
      },
      byState: {
        closed: byState.closed.map(b => b.domain),
        open: byState.open.map(b => b.domain),
        half_open: byState.half_open.map(b => b.domain)
      }
    });
  } catch (error) {
    console.error('Error fetching circuit breakers:', error);
    res.status(500).json({
      error: 'Failed to fetch circuit breakers',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /admin/recovery/circuit-breakers/:provider
 * Get specific circuit breaker status
 */
router.get('/recovery/circuit-breakers/:provider', async (req, res) => {
  try {
    const { provider } = req.params;

    const breaker = circuitBreakerRegistry.get(provider);

    if (!breaker) {
      return res.status(404).json({
        error: 'Circuit breaker not found for provider/domain'
      });
    }

    const metrics = breaker.getMetrics();
    res.json({
      timestamp: new Date(),
      domain: metrics.domain,
      breaker: {
        ...metrics,
      },
      nextResetAt: metrics.state === 'OPEN' ? metrics.openedAt : null
    });
  } catch (error) {
    console.error('Error fetching circuit breaker:', error);
    res.status(500).json({
      error: 'Failed to fetch circuit breaker',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /admin/recovery/circuit-breakers/:provider
 * Update circuit breaker state
 * Body: { state: 'closed' | 'open' | 'half_open' }
 */
router.put('/recovery/circuit-breakers/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { state } = req.body;

    const validStates = ['closed', 'open', 'half_open'];
    if (!validStates.includes(state)) {
      return res.status(400).json({
        error: `Invalid state. Must be one of: ${validStates.join(', ')}`
      });
    }

    // Update through circuit breaker registry
    const breaker = circuitBreakerRegistry.get(provider);
    if (!breaker) {
      return res.status(404).json({
        error: 'Circuit breaker not found'
      });
    }

    // Reset or set state directly (admin override)
    breaker.setState(state === 'closed' ? 'CLOSED' : state === 'open' ? 'OPEN' : 'HALF_OPEN', 'admin override');

    res.json({
      timestamp: new Date(),
      domain: provider,
      state: breaker.getState().toLowerCase(),
      message: `Circuit breaker for ${provider} updated to ${state}`
    });
  } catch (error) {
    console.error('Error updating circuit breaker:', error);
    res.status(500).json({
      error: 'Failed to update circuit breaker',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /admin/recovery/circuit-breakers/:provider/reset
 * Reset circuit breaker to closed state
 */
router.post('/recovery/circuit-breakers/:provider/reset', async (req, res) => {
  try {
    const { provider } = req.params;

    const breaker = circuitBreakerRegistry.get(provider);
    if (!breaker) {
      return res.status(404).json({
        error: 'Circuit breaker not found'
      });
    }

    breaker.reset();

    res.json({
      timestamp: new Date(),
      domain: provider,
      state: breaker.getState().toLowerCase(),
      message: `Circuit breaker for ${provider} reset to closed`
    });
  } catch (error) {
    console.error('Error resetting circuit breaker:', error);
    res.status(500).json({
      error: 'Failed to reset circuit breaker',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /admin/recovery/provider-fallbacks
 * Get provider fallback configurations
 */
router.get('/recovery/provider-fallbacks', async (req, res) => {
  try {
    // Get SAGA provider configurations
    const sagaConfig = paymentRecoverySAGA.getProviderConfig();

    res.json({
      timestamp: new Date(),
      fallbacks: {
        providers: sagaConfig.providers || [],
        config: {
          maxRetries: sagaConfig.maxRetries,
          timeout: sagaConfig.timeout,
          enableCompensation: sagaConfig.enableCompensation
        }
      }
    });
  } catch (error) {
    console.error('Error fetching provider fallbacks:', error);
    res.status(500).json({
      error: 'Failed to fetch provider fallbacks',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /admin/recovery/provider-fallbacks/:operation/:provider
 * Update provider fallback status
 * Body: { isAvailable, failureRate }
 */
router.put('/recovery/provider-fallbacks/:operation/:provider', async (req, res) => {
  try {
    const { operation, provider } = req.params;
    const { isAvailable, failureRate } = req.body;

    if (isAvailable !== undefined && typeof isAvailable !== 'boolean') {
      return res.status(400).json({ error: 'isAvailable must be a boolean' });
    }

    if (failureRate !== undefined &&
        (typeof failureRate !== 'number' || !Number.isFinite(failureRate) || failureRate < 0 || failureRate > 100)) {
      return res.status(400).json({
        error: 'failureRate must be between 0 and 100'
      });
    }

    // Update SAGA provider configuration
    await paymentRecoverySAGA.updateProviderConfig({
      provider,
      operation,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
      failureRate: failureRate !== undefined ? failureRate : 0
    });

    res.json({
      timestamp: new Date(),
      update: {
        operation,
        provider,
        isAvailable: isAvailable !== undefined ? isAvailable : true,
        failureRate: failureRate !== undefined ? failureRate : 0
      },
      message: `Provider fallback for ${operation}/${provider} updated`
    });
  } catch (error) {
    console.error('Error updating provider fallback:', error);
    res.status(500).json({
      error: 'Failed to update provider fallback',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /admin/recovery/manual-interventions
 * Get pending manual intervention requests
 */
router.get('/recovery/manual-interventions', async (req, res) => {
  try {
    const limit = parsePaginationValue(req.query.limit, 50, 100);
    const offset = parsePaginationValue(req.query.offset, 0, Number.MAX_SAFE_INTEGER);
    const status = req.query.status as string || 'pending';

    let whereClause = '';
    const values = [];

    if (status !== 'all') {
      whereClause = `WHERE status = $1`;
      values.push(status);
    }

    const result = await pool.query(
      `SELECT id, workflow_id, user_id, transaction_id, reason, priority, status,
          approved_by, approval_notes, created_at, updated_at
       FROM manual_intervention_requests ${whereClause}
       ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM manual_intervention_requests ${whereClause}`,
      values
    );

    res.json({
      timestamp: new Date(),
      requests: result.rows,
      pagination: {
        total: countResult.rows[0].count,
        limit,
        offset,
        returned: result.rows.length
      }
    });
  } catch (error) {
    if (error instanceof InvalidParameterError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error fetching manual interventions:', error);
    res.status(500).json({
      error: 'Failed to fetch manual interventions',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /admin/recovery/manual-interventions/:requestId
 * Approve or reject manual intervention request
 * Body: { status: 'approved' | 'rejected', notes }
 */
router.put('/recovery/manual-interventions/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, notes } = req.body;
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: "Status must be 'approved' or 'rejected'"
      });
    }

    const resolution = await paymentRecoveryWorkflowService.resolveManualIntervention(
      requestId,
      adminId,
      { type: status === 'approved' ? 'retry' : 'cancel', notes }
    );

    res.json({
      timestamp: new Date(),
      request: resolution,
      decision: status,
      message: `Manual intervention request ${status}; ${status === 'approved' ? 'recovery retry queued' : 'workflow cancelled'}`
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error updating manual intervention:', error);
    res.status(500).json({
      error: 'Failed to update manual intervention',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /admin/recovery/analysis
 * Get recovery analysis and insights
 */
router.get('/recovery/analysis', async (req, res) => {
  try {
    const hoursBack = parsePositiveInteger(req.query.hoursBack, 24);
    const fromDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Strategies effectiveness
    const strategyResult = await pool.query(
      `SELECT strategy, state, COUNT(*) as count FROM recovery_workflows 
       WHERE created_at > $1 
       GROUP BY strategy, state`,
      [fromDate]
    );

    // Provider performance
    const providerResult = await pool.query(
      `SELECT current_provider, state, COUNT(*) as count FROM recovery_workflows 
       WHERE created_at > $1 
       GROUP BY current_provider, state`,
      [fromDate]
    );

    // Error codes recovery rates
    const errorResult = await pool.query(
      `SELECT original_error, state, COUNT(*) as count FROM recovery_workflows 
       WHERE created_at > $1 
       GROUP BY original_error, state
       ORDER BY count DESC LIMIT 10`,
      [fromDate]
    );

    // Build analysis
    const strategies: Record<string, { total: number; success: number; rate: number }> = {};
    strategyResult.rows.forEach((row: any) => {
      if (!strategies[row.strategy]) {
        strategies[row.strategy] = { total: 0, success: 0, rate: 0 };
      }
      strategies[row.strategy].total += row.count;
      if (row.state === 'succeeded') {
        strategies[row.strategy].success += row.count;
      }
      strategies[row.strategy].rate = Math.round((strategies[row.strategy].success / strategies[row.strategy].total) * 100);
    });

    const providers: Record<string, { total: number; success: number; rate: number }> = {};
    providerResult.rows.forEach((row: any) => {
      if (!providers[row.current_provider]) {
        providers[row.current_provider] = { total: 0, success: 0, rate: 0 };
      }
      providers[row.current_provider].total += row.count;
      if (row.state === 'succeeded') {
        providers[row.current_provider].success += row.count;
      }
      providers[row.current_provider].rate = Math.round(
        (providers[row.current_provider].success / providers[row.current_provider].total) * 100
      );
    });

    res.json({
      timestamp: new Date(),
      period: { hoursBack, from: fromDate, to: new Date() },
      analysis: {
        strategies,
        providers,
        errorCodes: errorResult.rows,
        recommendations: generateRecommendations(strategies, providers)
      }
    });
  } catch (error) {
    if (error instanceof InvalidParameterError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error fetching recovery analysis:', error);
    res.status(500).json({
      error: 'Failed to fetch recovery analysis',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Helper function to generate recommendations
 */
function generateRecommendations(strategies: any, providers: any): string[] {
  const recommendations: string[] = [];

  // Check strategy effectiveness
  Object.entries(strategies).forEach(([strategy, data]: [string, any]) => {
    if (data.rate < 50) {
      recommendations.push(`${strategy} has low success rate (${data.rate}%) - consider optimization`);
    }
  });

  // Check provider performance
  Object.entries(providers).forEach(([provider, data]: [string, any]) => {
    if (data.rate < 80) {
      recommendations.push(`${provider} recovery rate is ${data.rate}% - check provider status`);
    }
  });

  if (recommendations.length === 0) {
    recommendations.push('Recovery performance is healthy - continue monitoring');
  }

  return recommendations;
}

function parsePaginationValue(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw new InvalidParameterError('Invalid pagination parameter');
  }
  return parsed;
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new InvalidParameterError('Invalid hoursBack parameter');
  }
  return parsed;
}

class InvalidParameterError extends Error {}

export default router;
