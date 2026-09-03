import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../auth';
import { requireRole } from '../middleware/rbac';
import { JobExecutionRegistry } from './jobExecutionGuard';
import { SystemHealthMonitor } from './systemHealthMonitor';

// Require authenticated super-admin access for all diagnostics endpoints.
const requireAdmin = [authenticate, requireRole('super_admin')];

export const createDiagnosticsRouter = () => {
  const router = Router();

  // Enforce auth across all diagnostics routes
  router.use(requireAdmin);

  /**
   * GET /diagnostics/jobs
   */
  router.get('/diagnostics/jobs', (_req: Request, res: Response) => {
    try {
      const stats = JobExecutionRegistry.getAllStats();
      const diagnostics = JobExecutionRegistry.getDiagnostics();

      res.json({
        timestamp: Date.now(),
        jobs: stats,
        diagnostics,
        interpretation: interpretJobDiagnostics(diagnostics, stats),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  /**
   * GET /diagnostics/system
   */
  router.get('/diagnostics/system', (_req: Request, res: Response) => {
    try {
      const metrics = SystemHealthMonitor.getMetrics();
      const history = SystemHealthMonitor.getHistory();
      const healthScore = SystemHealthMonitor.getHealthScore();
      const saturated = SystemHealthMonitor.isSaturated();

      res.json({
        current: metrics,
        healthScore,
        saturated,
        history: {
          count: history.length,
          last5min: history.slice(-10),
        },
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  /**
   * GET /diagnostics/full
   */
  router.get('/diagnostics/full', (_req: Request, res: Response) => {
    try {
      const jobStats = JobExecutionRegistry.getAllStats();
      const jobDiagnostics = JobExecutionRegistry.getDiagnostics();
      const systemMetrics = SystemHealthMonitor.getMetrics();
      const healthScore = SystemHealthMonitor.getHealthScore();

      const diagnosis = {
        timestamp: Date.now(),
        healthScore,
        systemStatus: diagnoseSystemStatus(systemMetrics, jobStats),
        jobs: {
          stats: jobStats,
          diagnostics: jobDiagnostics,
          interpretation: interpretJobDiagnostics(jobDiagnostics, jobStats),
        },
        system: {
          metrics: systemMetrics,
          trend: analyzeTrend(SystemHealthMonitor.getHistory()),
        },
        recommendations: generateRecommendations(systemMetrics, jobDiagnostics, jobStats),
      };

      res.json(diagnosis);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  /**
   * GET /diagnostics/job/:name
   */
  router.get('/diagnostics/job/:name', (req: Request, res: Response) => {
    try {
      const jobName = req.params.name;
      const stats = JobExecutionRegistry.getStats(jobName);
      const metrics = JobExecutionRegistry.getMetrics(jobName);

      if (!stats) {
        return res.status(404).json({ error: `Job not found: ${jobName}` });
      }

      const pattern = analyzeExecutionPattern(metrics);

      res.json({
        jobName,
        stats,
        metrics: {
          recent: metrics.slice(-20),
          total: metrics.length,
        },
        pattern,
        analysis: {
          isHealthy: stats.errorCount === 0 && stats.skipCount === 0,
          shouldSlowDown:
            stats.avgDuration > 5000 ||
            (stats.executionCount > 0 && stats.skipCount > stats.executionCount * 0.1),
          avgTimeOverInterval: stats.avgDuration,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  return router;
};

/**
 * Helper: Interpret job diagnostics
 */
function interpretJobDiagnostics(
  diagnostics: ReturnType<typeof JobExecutionRegistry.getDiagnostics>,
  _stats: Record<string, any>
): string {
  if (diagnostics.saturated.length > 0) {
    return `🔴 CRITICAL: Event loop stuck - ${diagnostics.saturated.join(', ')}. Likely deadlock or infinite loop.`;
  }
  if (diagnostics.frequentSkips.length > 0) {
    return `🟠 OVERLOAD: System too busy - ${diagnostics.frequentSkips.join(', ')}. Reduce job frequency or increase resources.`;
  }
  if (diagnostics.slowJobs.length > 0) {
    return `🟡 SLOW JOBS: Execution time exceeding safe thresholds - ${diagnostics.slowJobs.join(', ')}. Check DB/API latency.`;
  }
  if (diagnostics.highErrorRate.length > 0) {
    return `🟡 ERRORS: High failure rate - ${diagnostics.highErrorRate.join(', ')}. Check logs for root cause.`;
  }
  return '🟢 HEALTHY: All jobs executing normally.';
}

/**
 * Diagnose overall system status
 */
function diagnoseSystemStatus(
  metrics: ReturnType<typeof SystemHealthMonitor.getMetrics>,
  _jobStats: Record<string, any>
): string {
  const cpu = metrics.cpu.user + metrics.cpu.system;
  const heap = metrics.heap.usagePercent;

  if (heap > 85 || cpu > 80 || metrics.jobs.runningJobs > 5) {
    return 'CRITICAL - Immediate action needed';
  }
  if (heap > 70 || cpu > 60 || metrics.jobs.runningJobs > 3) {
    return 'WARNING - System approaching limits';
  }
  if (metrics.jobs.skippedRecently > 5) {
    return 'DEGRADED - Overload detected, jobs being skipped';
  }
  return 'HEALTHY - Normal operation';
}

/**
 * Safely analyze execution pattern from metrics history
 */
function analyzeExecutionPattern(metrics: any[]): string {
  if (!Array.isArray(metrics) || metrics.length < 2) return 'INSUFFICIENT_DATA';

  const recentCount = metrics.filter((m) => !m.skipped).length;
  const skippedCount = metrics.filter((m) => m.skipped).length;
  const errorCount = metrics.filter((m) => m.error).length;

  if (skippedCount > recentCount) return 'FREQUENTLY_SKIPPED';
  if (recentCount > 0 && errorCount > recentCount * 0.1) return 'HIGH_ERROR_RATE';

  const validDurations = metrics.map((m) => m.duration).filter((d) => typeof d === 'number' && !isNaN(d));
  if (validDurations.length === 0) return 'INSUFFICIENT_DATA';

  const avgDuration = validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length;
  const maxDuration = Math.max(...validDurations);

  if (maxDuration > avgDuration * 3) {
    return 'ERRATIC_EXECUTION';
  }

  return 'HEALTHY';
}

/**
 * Safely analyze trend in system health
 */
function analyzeTrend(history: any[]): string {
  if (!Array.isArray(history) || history.length < 10) return 'INSUFFICIENT_DATA';

  const recent = history.slice(-5);
  const older = history.slice(-10, -5);

  const calcAvg = (arr: any[], fn: (m: any) => number) => arr.reduce((sum, item) => sum + fn(item), 0) / arr.length;

  const recentHeap = calcAvg(recent, (m) => m.heap.usagePercent);
  const olderHeap = calcAvg(older, (m) => m.heap.usagePercent);

  const recentCpu = calcAvg(recent, (m) => m.cpu.user + m.cpu.system);
  const olderCpu = calcAvg(older, (m) => m.cpu.user + m.cpu.system);

  if (recentHeap > olderHeap + 10 || recentCpu > olderCpu + 15) {
    return 'DEGRADING - Resource usage increasing';
  }
  if (recentHeap < olderHeap - 10 || recentCpu < olderCpu - 15) {
    return 'IMPROVING - Resource usage decreasing';
  }

  return 'STABLE - Resources steady';
}

/**
 * Generate recommendations based on diagnostics
 */
function generateRecommendations(
  metrics: ReturnType<typeof SystemHealthMonitor.getMetrics>,
  jobDiagnostics: ReturnType<typeof JobExecutionRegistry.getDiagnostics>,
  _jobStats: Record<string, any>
): string[] {
  const recommendations: string[] = [];

  if (metrics.heap.usagePercent > 75) {
    recommendations.push('💧 IMMEDIATE: Increase Node heap or add garbage collection tuning');
    recommendations.push('🔍 DEBUG: Check for memory leaks in long-running jobs');
  }

  if (metrics.cpu.user + metrics.cpu.system > 70) {
    recommendations.push('⚙️ OPTIMIZE: Database queries or API calls taking too long');
    recommendations.push('🔍 PROFILE: Use node --prof to identify bottlenecks');
  }

  if (metrics.jobs.runningJobs > 3) {
    recommendations.push('🎚️ THROTTLE: Increase intervals between jobs to reduce concurrency');
    recommendations.push('⏱️ STAGGER: Offset job start times to prevent thundering herd');
  }

  if (jobDiagnostics.frequentSkips.length > 0) {
    recommendations.push('📉 REDUCE: Cut job frequency temporarily to confirm saturation');
    recommendations.push(`   Affected: ${jobDiagnostics.frequentSkips.join(', ')}`);
  }

  if (jobDiagnostics.slowJobs.length > 0) {
    recommendations.push('🗄️ DEBUG DB: Check database pool size and slow query logs');
    recommendations.push('🔗 API: Verify external API latencies');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ HEALTHY: No immediate actions needed. Monitor trends.');
  }

  return recommendations;
}

export default createDiagnosticsRouter;