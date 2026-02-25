/**
 * Admin Recovery Management Routes
 * Super admin endpoints for recovery workflow management
 * Phase 3c Part 5 - Recovery Workflows
 */

import express, { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { circuitBreakerRegistry } from '../../core/consolidation/CircuitBreakerConsolidation';
import { paymentRecoverySAGA } from '../../services/PaymentRecoverySAGAOrchestrator';
import { db } from '../../db';
import { AppError } from '../utils/appError';

const router = Router();

// All routes require super admin auth
router.use(authenticate, authorize('super_admin'));

/**
 * GET /admin/recovery/workflows
 * List all recovery workflows (paginated, filterable)
 */
router.get('/admin/recovery/workflows', async (req, res) => {
  try {
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const state = req.query.state as string || 'all';
    const strategy = req.query.strategy as string || 'all';

    let whereClause = '';
    const values = [];

    if (state !== 'all') {
      whereClause += `${whereClause ? ' AND ' : 'WHERE '}state = $${values.length + 1}`;
      values.push(state);
    }

    if (strategy !== 'all') {
      whereClause += `${whereClause ? ' AND ' : 'WHERE '}strategy = $${values.length + 1}`;
      values.push(strategy);
    }

    const result = await db.query(
      `SELECT * FROM recovery_workflows ${whereClause} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM recovery_workflows ${whereClause}`,
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
router.get('/admin/recovery/workflows/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;

    const saga = paymentRecoverySAGA.getSAGAState(workflowId);

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
        totalSteps: saga.steps.length,
        progress: `${saga.stepsCompleted.length}/${saga.steps.length}`,
        errors: saga.errors,
        events: saga.events,
        createdAt: saga.createdAt,
        updatedAt: saga.updatedAt,
        completedAt: saga.completedAt
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
router.get('/admin/recovery/stats', async (req, res) => {
  try {
    const hoursBack = req.query.hoursBack ? parseInt(req.query.hoursBack as string) : 24;
    const fromDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Get all SAGAs (no user filter for admin view)
    const allSagas = paymentRecoverySAGA.getAllSAGAs();
    const recentSagasCount = allSagas.filter(s => new Date(s.createdAt) > fromDate).length;

    // Calculate metrics
    const succeeded = allSagas.filter(s => s.status === 'succeeded').length;
    const failed = allSagas.filter(s => s.status === 'failed').length;
    const processing = allSagas.filter(s => s.status === 'processing').length;
    const compensated = allSagas.filter(s => s.status === 'compensated').length;

    const successRate = allSagas.length > 0 ? (succeeded / allSagas.length) * 100 : 0;
    const avgDuration =
      allSagas.filter(s => s.completedAt).length > 0
        ? Math.round(
            allSagas
              .filter(s => s.completedAt)
              .reduce((sum, s) => sum + (new Date(s.completedAt!).getTime() - new Date(s.createdAt).getTime()), 0) /
            allSagas.filter(s => s.completedAt).length
          )
        : 0;

    res.json({
      timestamp: new Date(),
      period: { hoursBack, from: fromDate, to: new Date() },
      metrics: {
        total: allSagas.length,
        recentCount: recentSagasCount,
        succeeded,
        failed,
        processing,
        compensated,
        successRate: Math.round(successRate * 100) / 100,
        averageDurationMs: avgDuration
      },
      statusBreakdown: {
        pending: allSagas.filter(s => s.status === 'pending').length,
        processing,
        succeeded,
        failed,
        compensated
      }
    });
  } catch (error) {
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
router.get('/admin/recovery/circuit-breakers', async (req, res) => {
  try {
    // Get all domain breakers from registry
    const allBreakers = circuitBreakerRegistry.getAllBreakers();

    // Group by state
    const byState: Record<string, any[]> = {
      closed: [],
      open: [],
      half_open: []
    };

    allBreakers.forEach(b => {
      const state = b.state.toLowerCase();
      if (byState[state]) {
        byState[state].push(b);
      }
    });

    res.json({
      timestamp: new Date(),
      breakers: allBreakers.map(b => ({
        domain: b.domain,
        state: b.state,
        failureCount: b.failureCount,
        successCount: b.successCount,
        lastFailureTime: b.lastFailureTime,
        nextResetTime: b.nextResetTime,
        failureThreshold: b.config.failureThreshold,
        resetTimeout: b.config.resetTimeout
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
router.get('/admin/recovery/circuit-breakers/:provider', async (req, res) => {
  try {
    const { provider } = req.params;

    const breaker = circuitBreakerRegistry.getBreaker(provider);

    if (!breaker) {
      return res.status(404).json({
        error: 'Circuit breaker not found for provider/domain'
      });
    }

    res.json({
      timestamp: new Date(),
      domain: provider,
      breaker: {
        state: breaker.state,
        failureCount: breaker.failureCount,
        successCount: breaker.successCount,
        lastFailureTime: breaker.lastFailureTime,
        nextResetTime: breaker.nextResetTime,
        failureThreshold: breaker.config.failureThreshold,
        resetTimeout: breaker.config.resetTimeout
      },
      nextResetAt: breaker.state === 'open' ? breaker.nextResetTime : null
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
router.put('/admin/recovery/circuit-breakers/:provider', async (req, res) => {
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
    const breaker = circuitBreakerRegistry.getBreaker(provider);
    if (!breaker) {
      return res.status(404).json({
        error: 'Circuit breaker not found'
      });
    }

    // Reset or set state directly (admin override)
    if (state === 'closed') {
      breaker.reset();
    } else {
      breaker.state = state as any;
    }

    res.json({
      timestamp: new Date(),
      domain: provider,
      state: breaker.state,
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
router.post('/admin/recovery/circuit-breakers/:provider/reset', async (req, res) => {
  try {
    const { provider } = req.params;

    const breaker = circuitBreakerRegistry.getBreaker(provider);
    if (!breaker) {
      return res.status(404).json({
        error: 'Circuit breaker not found'
      });
    }

    breaker.reset();

    res.json({
      timestamp: new Date(),
      domain: provider,
      state: breaker.state,
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
router.get('/admin/recovery/provider-fallbacks', async (req, res) => {
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
router.put('/admin/recovery/provider-fallbacks/:operation/:provider', async (req, res) => {
  try {
    const { operation, provider } = req.params;
    const { isAvailable, failureRate } = req.body;

    if (failureRate !== undefined && (failureRate < 0 || failureRate > 100)) {
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
router.get('/admin/recovery/manual-interventions', async (req, res) => {
  try {
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const status = req.query.status as string || 'pending';

    let whereClause = '';
    const values = [];

    if (status !== 'all') {
      whereClause = `WHERE status = $1`;
      values.push(status);
    }

    const result = await db.query(
      `SELECT * FROM manual_intervention_requests ${whereClause} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    const countResult = await db.query(
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
router.put('/admin/recovery/manual-interventions/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, notes } = req.body;
    const adminId = req.user.id;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: "Status must be 'approved' or 'rejected'"
      });
    }

    const result = await db.query(
      `UPDATE manual_intervention_requests 
       SET status = $1, approved_by = $2, approval_notes = $3, updated_at = $4
       WHERE id = $5
       RETURNING *`,
      [status, adminId, notes || '', new Date(), requestId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Request not found'
      });
    }

    res.json({
      timestamp: new Date(),
      request: result.rows[0],
      message: `Manual intervention request ${status}`
    });
  } catch (error) {
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
router.get('/admin/recovery/analysis', async (req, res) => {
  try {
    const hoursBack = req.query.hoursBack ? parseInt(req.query.hoursBack as string) : 24;
    const fromDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Strategies effectiveness
    const strategyResult = await db.query(
      `SELECT strategy, state, COUNT(*) as count FROM recovery_workflows 
       WHERE created_at > $1 
       GROUP BY strategy, state`,
      [fromDate]
    );

    // Provider performance
    const providerResult = await db.query(
      `SELECT current_provider, state, COUNT(*) as count FROM recovery_workflows 
       WHERE created_at > $1 
       GROUP BY current_provider, state`,
      [fromDate]
    );

    // Error codes recovery rates
    const errorResult = await db.query(
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

export default router;
