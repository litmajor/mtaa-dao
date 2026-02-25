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
 * GET /recovery/workflows
 * Get user's SAGA recovery workflows (paginated)
 * Query params: limit, offset
 */
router.get('/recovery/workflows', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const userSAGAs = paymentRecoverySAGA.getSAGAsByUser(userId);
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
 * GET /recovery/workflows/:workflowId
 * Get specific SAGA recovery workflow
 */
router.get('/recovery/workflows/:workflowId', authenticateToken, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const userId = req.user.id;

    const saga = paymentRecoverySAGA.getSAGAState(workflowId);

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
        events: paymentRecoverySAGA.getSAGAEvents(workflowId)
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
 * POST /recovery/workflows
 * Create new SAGA recovery workflow
 * Body: { userId, amount, currency, walletFrom, walletTo, vaultId?, metadata? }
 * Returns immediately with SAGA reference (non-blocking)
 */
router.post('/recovery/workflows', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, currency, walletFrom, walletTo, vaultId, metadata } = req.body;

    if (!amount || !currency || !walletFrom || !walletTo) {
      return res.status(400).json({
        error: 'Missing required fields: amount, currency, walletFrom, walletTo'
      });
    }

    // Execute SAGA (non-blocking, returns immediately)
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
      message: 'Recovery workflow created and execution started (non-blocking)',
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
 * POST /recovery/workflows/:workflowId/cancel
 * Cancel recovery workflow
 * Body: { reason }
 */
router.post('/recovery/workflows/:workflowId/cancel', authenticateToken, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        error: 'Cancellation reason required'
      });
    }

    // Verify ownership and cancel SAGA
    const sagaState = paymentRecoverySAGA.getSAGAState(workflowId);
    if (!sagaState || sagaState.userId !== userId) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const cancelledSaga = await paymentRecoverySAGA.cancelSAGA(workflowId, reason);

    res.json({
      timestamp: new Date(),
      workflowId,
      status: cancelledSaga.status,
      message: 'Recovery workflow cancelled',
      saga: cancelledSaga
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
 * GET /recovery/workflows/:workflowId/history
 * Get recovery attempt history for workflow
 */
router.get('/recovery/workflows/:workflowId/history', authenticateToken, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const userId = req.user.id;

    const saga = paymentRecoverySAGA.getSAGAState(workflowId);

    if (!saga || saga.userId !== userId) {
      return res.status(404).json({
        error: 'Workflow not found'
      });
    }

    res.json({
      timestamp: new Date(),
      workflowId,
      summary: {
        status: saga.status,
        stepsCompleted: saga.stepsCompleted.length,
        totalSteps: saga.steps.length,
        failureCount: (saga.events || []).filter((e: any) => e.type === 'step_failed').length,
      },
      execution: {
        steps: saga.steps,
        stepsCompleted: saga.stepsCompleted,
        currentStep: saga.currentStep,
        errors: saga.errors,
      },
      events: {
        all: saga.events,
        failures: (saga.events || []).filter((e: any) => e.type.includes('failed')),
        compensations: (saga.events || []).filter((e: any) => e.type.includes('compensation')),
      },
      timeline: {
        created: saga.createdAt,
        updated: saga.updatedAt,
        completed: (saga.events || []).reverse()[0]?.timestamp
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

/**
 * GET /recovery/stats
 * Get recovery statistics for user
 */
router.get('/recovery/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all SAGAs for user
    const { sagas, totalCount } = await paymentRecoverySAGA.getSAGAsByUser(userId, { limit: 1000, offset: 0 });

    // Calculate statistics
    const succeeded = sagas.filter(s => s.status === 'succeeded').length;
    const failed = sagas.filter(s => s.status === 'failed').length;
    const processing = sagas.filter(s => s.status === 'processing').length;
    const cancelled = sagas.filter(s => s.status === 'compensated').length;

    const successRate = sagas.length > 0 ? (succeeded / sagas.length) * 100 : 0;
    const avgSteps =
      sagas.length > 0
        ? Math.round((sagas.reduce((sum, s) => sum + s.steps.length, 0) / sagas.length) * 10) / 10
        : 0;

    const avgDuration =
      sagas.length > 0
        ? Math.round(
            sagas
              .filter(s => s.completedAt)
              .reduce((sum, s) => sum + (new Date(s.completedAt!).getTime() - new Date(s.createdAt).getTime()), 0) /
              sagas.filter(s => s.completedAt).length
          )
        : 0;

    res.json({
      timestamp: new Date(),
      stats: {
        total: totalCount,
        succeeded,
        failed,
        processing,
        cancelled,
        successRate: Math.round(successRate * 100) / 100,
        averageStepsPerRecovery: avgSteps,
        averageDurationMs: avgDuration
      },
      statusBreakdown: {
        pending: sagas.filter(s => s.status === 'pending').length,
        processing: sagas.filter(s => s.status === 'processing').length,
        succeeded: succeeded,
        failed: failed,
        compensated: cancelled
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
 * GET /recovery/active
 * Get active recovery workflows (processing or awaiting user action)
 */
router.get('/recovery/active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all active SAGAs for user
    const { sagas } = await paymentRecoverySAGA.getSAGAsByUser(userId, { limit: 100, offset: 0 });

    // Filter to active statuses
    const activeSagas = sagas.filter(
      s => s.status === 'pending' || s.status === 'processing'
    );

    // Find ones awaiting user action (have pending manual steps)
    const awaitingUser = activeSagas.filter(s => 
      s.currentStep && (s.currentStep as any).requiresUserApproval
    );

    res.json({
      timestamp: new Date(),
      activeCount: activeSagas.length,
      awaitingActionCount: awaitingUser.length,
      workflows: activeSagas.map(s => ({
        id: s.id,
        status: s.status,
        currentStep: s.currentStep,
        progress: `${s.stepsCompleted.length}/${s.steps.length}`,
        createdAt: s.createdAt,
        requiresUserAction: awaitingUser.some(a => a.id === s.id)
      })),
      requiresAction: awaitingUser.map(s => ({
        id: s.id,
        currentStep: s.currentStep,
        message: (s.currentStep as any)?.message || 'User approval required'
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

export default router;
