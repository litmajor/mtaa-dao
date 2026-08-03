/**
 * Job Status Routes
 * Endpoints for monitoring and retrieving results of async jobs
 * 
 * SECURITY: 
 * - Admin endpoints: /api/jobs/* (requires super_admin)
 * - User endpoints: /api/jobs/:jobId/status, /api/jobs/:jobId/result (requires ownership)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { isAuthenticated } from '../auth';
import { requireRole } from '../middleware/rbac';
import { jobQueueService } from '../services/jobQueueService';
import { engineService } from '../services/engineService';
import { logger } from '../utils/logger';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// USER-SCOPED ENDPOINTS (ownership-based access, no admin required)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/jobs/:jobId/status (public - ownership-verified)
 * Get job status by ownership
 * Users can poll their own jobs without super_admin role
 */
router.get('/:jobId/status', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req.user as any)?.id;

    const result = await jobQueueService.getJobResult(jobId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        jobId
      });
    }

    // Verify ownership if user is authenticated (non-authenticated users can view if no userId was recorded)
    if (userId) {
      const owner = await jobQueueService.getJobOwner(jobId);
      if (owner && owner !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Job does not belong to this user',
          jobId
        });
      }
    }

    res.json({
      success: true,
      jobId,
      status: result.status,
      progress: result.progress || 0,
      error: result.error || null
    });
  } catch (error) {
    logger.error('Error retrieving job status:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve job status' });
  }
});

/**
 * GET /api/jobs/:jobId/result (public - ownership-verified)
 * Get job result by ownership
 * Users can retrieve their job results without super_admin role
 */
router.get('/:jobId/result', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req.user as any)?.id;

    const result = await jobQueueService.getJobResult(jobId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        jobId
      });
    }

    // Verify ownership if user is authenticated
    if (userId) {
      const owner = await jobQueueService.getJobOwner(jobId);
      if (owner && owner !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Job does not belong to this user',
          jobId
        });
      }
    }

    if (result.status !== 'completed') {
      return res.status(202).json({
        success: true,
        message: 'Job still processing',
        status: result.status,
        progress: result.progress || 0
      });
    }

    if (result.error) {
      return res.status(500).json({
        success: false,
        error: result.error,
        jobId,
        status: 'failed'
      });
    }

    res.json({
      success: true,
      jobId,
      result: result.result,
      completedAt: result.completedAt
    });
  } catch (error) {
    logger.error('Error retrieving job result:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve job result' });
  }
});

/**
 * GET /api/jobs/:jobId/stream (public - ownership-verified, SSE)
 * Stream real-time job progress via Server-Sent Events
 * Users can monitor their jobs without super_admin role
 */
router.get('/:jobId/stream', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req.user as any)?.id;

    // Verify ownership if user is authenticated
    if (userId) {
      const owner = await jobQueueService.getJobOwner(jobId);
      if (owner && owner !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Job does not belong to this user',
          jobId
        });
      }
    }

    // Set up SSE response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', jobId })}\n\n`);

    // Poll job status and send updates
    let lastProgress: number | undefined = undefined;
    const pollInterval = setInterval(async () => {
      try {
        const result = await jobQueueService.getJobResult(jobId);

        if (!result) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: 'Job not found' })}\n\n`);
          clearInterval(pollInterval);
          res.end();
          return;
        }

        // Send update if progress changed
        if (result.progress !== lastProgress) {
          lastProgress = result.progress;
          res.write(`data: ${JSON.stringify({ 
            type: 'progress',
            jobId,
            status: result.status,
            progress: result.progress ?? 0,
            message: result.status
          })}\n\n`);
        }

        // If job completed or failed, send final update and close
        if (result.status === 'completed' || result.status === 'failed') {
          res.write(`data: ${JSON.stringify({
            type: result.status === 'completed' ? 'completed' : 'failed',
            jobId,
            result: result.result,
            error: result.error
          })}\n\n`);
          clearInterval(pollInterval);
          res.end();
        }
      } catch (error) {
        logger.error(`Error streaming job ${jobId}:`, error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Streaming error' })}\n\n`);
        clearInterval(pollInterval);
        res.end();
      }
    }, 1000); // Poll every 1 second

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(pollInterval);
      logger.debug(`Job stream ${jobId} closed by client`);
    });
  } catch (error) {
    logger.error('Error setting up job stream:', error);
    res.status(500).json({ success: false, error: 'Failed to set up job stream' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN-ONLY ENDPOINTS (require super_admin role)
// ═══════════════════════════════════════════════════════════════════════════════

// All admin endpoints require super_admin authentication
router.use(isAuthenticated, requireRole('super_admin'));

/**
 * GET /api/jobs/:jobId (admin only)
 * Get job status and result (if completed)
 */
router.get('/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const result = await jobQueueService.getJobResult(jobId);

    if (!result) {
      return res.status(404).json({
        error: 'Job not found',
        jobId
      });
    }

    res.json({
      jobId,
      ...result
    });
  } catch (error) {
    logger.error('Error retrieving job status:', error);
    res.status(500).json({ error: 'Failed to retrieve job status' });
  }
});

/**
 * GET /api/jobs/queue/:queueType/stats (admin only)
 * Get queue statistics
 */
router.get('/queue/:queueType/stats', async (req: Request, res: Response) => {
  try {
    const { queueType } = req.params;

    const stats = await jobQueueService.getQueueStats(queueType as any);

    if (!stats) {
      return res.status(404).json({
        error: 'Queue not found',
        queueType
      });
    }

    res.json({
      queueType,
      ...stats
    });
  } catch (error) {
    logger.error('Error retrieving queue stats:', error);
    res.status(500).json({ error: 'Failed to retrieve queue stats' });
  }
});

/**
 * GET /api/jobs/stats (admin only)
 * Get comprehensive job statistics (active jobs summary from Engine Service)
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await engineService.getActiveJobsStats();

    res.json({
      engine: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error retrieving engine job stats:', error);
    res.status(500).json({ error: 'Failed to retrieve job statistics' });
  }
});

export default router;

