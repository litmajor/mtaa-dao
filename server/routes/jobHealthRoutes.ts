/**
 * Job Health Check Routes
 * Provides endpoints for monitoring scheduled job execution health
 * Last Updated: January 23, 2026
 */

import express from 'express';
import { isAuthenticated } from '../auth';
import { requireRole } from '../middleware/rbac';
import { JobMonitoringService } from '../services/jobMonitoringService';

const router = express.Router();

// All job health endpoints require super_admin authentication
router.use(isAuthenticated, requireRole('super_admin'));

/**
 * GET /admin/jobs/health
 * Get overall job system health
 */
router.get('/jobs/health', (req, res) => {
  try {
    const health = JobMonitoringService.getSystemHealth();
    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /admin/jobs/stats
 * Get detailed statistics for all jobs
 */
router.get('/jobs/stats', (req, res) => {
  try {
    const stats = JobMonitoringService.getAllJobStats();
    res.json({
      success: true,
      data: stats,
      total: stats.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /admin/jobs/stats/:jobName
 * Get statistics for a specific job
 */
router.get('/jobs/stats/:jobName', (req, res) => {
  try {
    const { jobName } = req.params;
    const stats = JobMonitoringService.getJobStats(jobName);
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /admin/jobs/history/:jobName
 * Get execution history for a specific job
 */
router.get('/jobs/history/:jobName', (req, res) => {
  try {
    const { jobName } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const history = JobMonitoringService.getJobHistory(jobName);
    
    res.json({
      success: true,
      data: history.slice(-limit),
      total: history.length,
      displayed: Math.min(limit, history.length),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /admin/jobs/reset/:jobName
 * Reset history for a specific job
 */
router.post('/jobs/reset/:jobName', (req, res) => {
  try {
    const { jobName } = req.params;
    JobMonitoringService.resetJobHistory(jobName);
    res.json({
      success: true,
      message: `History cleared for job: ${jobName}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /admin/jobs/reset-all
 * Reset all job histories
 */
router.post('/jobs/reset-all', (req, res) => {
  try {
    JobMonitoringService.resetAllHistory();
    res.json({
      success: true,
      message: 'All job histories cleared',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
