/**
 * User Recovery Workflow Routes
 * Recovery endpoints for users
 * Phase 3c Part 5 - Recovery Workflows
 * UPDATED: Uses PaymentRecoverySAGA (event-driven, <5s recovery)
 */

import express, { Router } from 'express';
import { authenticateToken } from '../../middleware/auth';
import { paymentRecoverySAGA } from '../../services/PaymentRecoverySAGAOrchestrator';
import { AppError } from '../../utils/appError';

const router = Router();

/**
 * GET /workflows
 * Get user's SAGA recovery workflows (paginated)
 * Query params: limit, offset
 */
router.get('/workflows', authenticateToken as any, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const requestedLimit = Number.parseInt(String(req.query.limit ?? '20'), 10);
    const requestedOffset = Number.parseInt(String(req.query.offset ?? '0'), 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20;
    const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;

    const userSAGAs = await paymentRecoverySAGA.getSAGAsByUser(userId);
    const paginated = userSAGAs.slice(offset, offset + limit);

    res.json({
      timestamp: new Date(),
      workflows: paginated.map(saga => ({
        id: saga.id,
        paymentId: saga.paymentId,
        status: saga.status,
        amount: saga.amount,
        currency: saga.currency,
        createdAt: saga.createdAt,
        attemptCount: saga.attemptCount,
      })),
      pagination: {
        total: userSAGAs.length,
        limit,
        offset,
        returned: paginated.length
      }
    });
  } catch (error) {
    console.error('Error fetching recovery workflows:', error);
    res.status(500).json({
      error: 'Failed to fetch recovery workflows',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /workflows
 * Create new SAGA recovery workflow
 * Body: { amount, currency, walletFrom, walletTo, vaultId?, metadata? }
 * User ID is taken from the authenticated session.
 * Executes through the SAGA orchestrator and returns its persisted result
 */
router.post('/workflows', authenticateToken as any, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { amount, currency, walletFrom, walletTo, vaultId, metadata } = req.body;

    if (!amount || !currency || !walletFrom || !walletTo) {
      return res.status(400).json({
        error: 'Missing required fields: amount, currency, walletFrom, walletTo'
      });
    }

    // This orchestrator runs the SAGA through completion before resolving.
    const saga = await paymentRecoverySAGA.executePaymentSAGA({
      userId,
      amount,
      currency,
      walletFrom,
      walletTo,
      vaultId,
      metadata,
    });

    res.status(201).json({
      timestamp: new Date(),
      workflowId: saga.id,
      status: saga.status,
      message: 'Recovery workflow executed',
      saga
    });
  } catch (error) {
    console.error('Error creating recovery workflow:', error);
    res.status(500).json({
      error: 'Failed to create recovery workflow',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /stats
 * Get recovery statistics for user
 */
router.get('/stats', authenticateToken as any, async (req: any, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all SAGAs for user
    const sagas = await paymentRecoverySAGA.getSAGAsByUser(userId);
    const totalCount = sagas.length;

    // Calculate statistics
    const succeeded = sagas.filter((s: any) => s.status === 'succeeded').length;
    const failed = sagas.filter((s: any) => s.status === 'failed').length;
    const processing = sagas.filter((s: any) => s.status === 'processing').length;
    const abandoned = sagas.filter((s) => s.status === 'abandoned').length;

    const successRate = sagas.length > 0 ? (succeeded / sagas.length) * 100 : 0;
    const avgSteps =
      sagas.length > 0
        ? Math.round((sagas.reduce((sum: number, s: any) => sum + (s.stepsCompleted?.length || 0), 0) / sagas.length) * 10) / 10
        : 0;

    const terminalSagas = sagas.filter((s) => ['succeeded', 'failed', 'abandoned'].includes(s.status));
    const avgDuration = terminalSagas.length > 0
      ? Math.round(terminalSagas.reduce((sum, saga) => sum + saga.updatedAt.getTime() - saga.createdAt.getTime(), 0) / terminalSagas.length)
      : 0;

    res.json({
      timestamp: new Date(),
      stats: {
        total: totalCount,
        succeeded,
        failed,
        processing,
        abandoned,
        successRate: Math.round(successRate * 100) / 100,
        averageStepsPerRecovery: avgSteps,
        averageDurationMs: avgDuration
      },
      statusBreakdown: {
        pending: sagas.filter((s: any) => s.status === 'pending').length,
        processing: sagas.filter((s: any) => s.status === 'processing').length,
        succeeded: succeeded,
        failed: failed,
        abandoned,
      },
      recentSAGAs: sagas.slice(0, 5)
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
 * GET /active
 * Get active recovery workflows (processing or awaiting user action)
 */
router.get('/active', authenticateToken as any, async (req: any, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all active SAGAs for user
    const sagas = await paymentRecoverySAGA.getSAGAsByUser(userId);

    // Filter to active statuses
    const activeSagas = sagas.filter(
      (s: any) => s.status === 'pending' || s.status === 'processing'
    );

    res.json({
      timestamp: new Date(),
      activeCount: activeSagas.length,
      workflows: activeSagas.map((s: any) => ({
        id: s.id,
        status: s.status,
        currentStep: s.currentStep,
        progress: `${s.stepsCompleted.length}/${paymentRecoverySAGA.getTotalExecutionSteps(s)}`,
        createdAt: s.createdAt,
      }))
    });
  } catch (error) {
    console.error('Error fetching active workflows:', error);
    res.status(500).json({
      error: 'Failed to fetch active workflows',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /workflows/:workflowId
 * Get specific SAGA recovery workflow
 */
router.get('/workflows/:workflowId', authenticateToken as any, async (req: any, res) => {
  try {
    const { workflowId } = req.params;
    const userId = req.user?.id;

    const saga = await paymentRecoverySAGA.getSAGAState(workflowId);

    if (!saga || saga.userId !== userId) {
      return res.status(404).json({
        error: 'Workflow not found'
      });
    }

    res.json({
      timestamp: new Date(),
      workflow: {
        id: saga.id,
        paymentId: saga.paymentId,
        status: saga.status,
        currentStep: saga.currentStep,
        stepsCompleted: saga.stepsCompleted,
        amount: saga.amount,
        currency: saga.currency,
        attemptCount: saga.attemptCount,
        lastError: saga.lastError,
        createdAt: saga.createdAt,
        updatedAt: saga.updatedAt,
        events: await paymentRecoverySAGA.getSAGAEvents(workflowId)
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
 * POST /workflows/:workflowId/cancel
 * Cancel recovery workflow
 * Body: { reason }
 */
router.post('/workflows/:workflowId/cancel', authenticateToken as any, async (req: any, res) => {
  try {
    const { workflowId } = req.params;
    const userId = req.user?.id;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({
        error: 'Cancellation reason required'
      });
    }

    // Verify ownership and cancel SAGA
    const sagaState = await paymentRecoverySAGA.getSAGAState(workflowId);
    if (!sagaState || sagaState.userId !== userId) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    if (!['pending', 'processing', 'compensating'].includes(sagaState.status)) {
      return res.status(409).json({ error: `Cannot abandon a workflow in ${sagaState.status} status` });
    }

    await paymentRecoverySAGA.abandonSAGA(workflowId, reason.trim());
    const abandonedSaga = await paymentRecoverySAGA.getSAGAState(workflowId);
    if (!abandonedSaga) return res.status(404).json({ error: 'Workflow not found' });

    res.json({
      timestamp: new Date(),
      workflowId,
      status: abandonedSaga.status,
      message: 'Recovery workflow abandoned',
      saga: abandonedSaga,
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    console.error('Error cancelling workflow:', error);
    res.status(500).json({
      error: 'Failed to cancel workflow',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /workflows/:workflowId/history
 * Get recovery attempt history for workflow
 */
router.get('/workflows/:workflowId/history', authenticateToken as any, async (req: any, res) => {
  try {
    const { workflowId } = req.params;
    const userId = req.user?.id;

    const saga = await paymentRecoverySAGA.getSAGAState(workflowId);

    if (!saga || saga.userId !== userId) {
      return res.status(404).json({
        error: 'Workflow not found'
      });
    }

    const events = await paymentRecoverySAGA.getSAGAEvents(workflowId);

    res.json({
      timestamp: new Date(),
      workflowId,
      summary: {
        status: saga.status,
        stepsCompleted: saga.stepsCompleted?.length || 0,
        totalSteps: paymentRecoverySAGA.getTotalExecutionSteps(saga),
        failureCount: events.filter((event) => !event.success).length,
      },
      execution: {
        stepsCompleted: saga.stepsCompleted || [],
        currentStep: saga.currentStep,
        errors: events
          .filter((event) => !event.success)
          .map((event) => ({ step: event.step, error: event.error, timestamp: event.timestamp })),
      },
      events: {
        all: events,
        failures: events.filter((event) => !event.success),
        compensations: events.filter((event) =>
          event.step.startsWith('COMPENSATE_') || event.step.startsWith('REVERT_')
        ),
      },
      timeline: {
        created: saga.createdAt,
        updated: saga.updatedAt,
        completed: [...events].reverse().find((event) =>
          event.step === 'SAGA_SUCCEEDED' || event.step === 'SAGA_FAILED' || event.step === 'SAGA_ABANDONED'
        )?.timestamp,
      }
    });
  } catch (error) {
    console.error('Error fetching workflow history:', error);
    res.status(500).json({
      error: 'Failed to fetch workflow history',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
