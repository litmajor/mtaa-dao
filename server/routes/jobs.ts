/**
 * Job Status Routes
 * Endpoints for monitoring and retrieving results of async jobs
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { jobQueueService } from '../services/jobQueueService';
import { engineService } from '../services/engineService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/jobs/:jobId
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
 * GET /api/jobs/:jobId/status
 * Get only job status (minimal response)
 */
router.get('/:jobId/status', async (req: Request, res: Response) => {
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
      status: result.status,
      progress: result.progress || 0,
      error: result.error || null
    });
  } catch (error) {
    logger.error('Error retrieving job status:', error);
    res.status(500).json({ error: 'Failed to retrieve job status' });
  }
});

/**
 * GET /api/jobs/:jobId/result
 * Get job result (only if completed)
 */
router.get('/:jobId/result', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const result = await jobQueueService.getJobResult(jobId);

    if (!result) {
      return res.status(404).json({
        error: 'Job not found',
        jobId
      });
    }

    if (result.status !== 'completed') {
      return res.status(202).json({
        message: 'Job still processing',
        status: result.status,
        progress: result.progress || 0
      });
    }

    if (result.error) {
      return res.status(500).json({
        error: result.error,
        jobId,
        status: 'failed'
      });
    }

    res.json({
      jobId,
      result: result.result,
      completedAt: result.completedAt
    });
  } catch (error) {
    logger.error('Error retrieving job result:', error);
    res.status(500).json({ error: 'Failed to retrieve job result' });
  }
});

/**
 * GET /api/jobs/queue/:queueType/stats
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
 * GET /api/jobs/stats
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

