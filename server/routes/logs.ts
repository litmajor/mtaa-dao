import { Router, Request, Response } from 'express';
import { getConsoleLogger } from '../utils/console-logger';
import { isAuthenticated } from '../auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

/**
 * Server Logging & Diagnostics API
 * 
 * Security: All routes require authentication + super_admin role
 * 
 * Endpoints:
 * - GET /api/logs/current - Get current server log file path and metadata
 * - GET /api/logs/tail - Get recent log lines (streaming or buffered)
 * - GET /api/logs/list - List all available log files
 * - GET /api/logs/stats - Get boot metadata and server statistics
 * - GET /api/logs/stream - Stream real-time log updates via SSE
 */

/**
 * Get current log file info
 * GET /api/logs/current
 * 
 * Security: Requires authentication + super_admin role
 */
router.get('/current', isAuthenticated, requireRole('super_admin'), (req: Request, res: Response) => {
  try {
    const logger = getConsoleLogger();
    const logPath = logger.getCurrentLogPath();
    const bootMetadata = logger.getBootMetadata();

    res.json({
      success: true,
      currentLogFile: logPath,
      bootMetadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Get tail of current log (most recent lines)
 * GET /api/logs/tail?lines=100
 * 
 * Security: Requires authentication + super_admin role
 */
router.get('/tail', isAuthenticated, requireRole('super_admin'), (req: Request, res: Response) => {
  try {
    const logger = getConsoleLogger();
    const lines = Math.min(parseInt(req.query.lines as string) || 50, 200); // Max 200 lines
    const tail = logger.getTailOfCurrentLog(lines);

    res.json({
      success: true,
      lines: tail.split('\n').length - 1,
      tail,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * List all available log files
 * GET /api/logs/list
 * 
 * Security: Requires authentication + super_admin role
 */
router.get('/list', isAuthenticated, requireRole('super_admin'), (req: Request, res: Response) => {
  try {
    const logger = getConsoleLogger();
    const logFiles = logger.listLogFiles();
    const logsDir = logger.getLogsDir();

    res.json({
      success: true,
      logsDirectory: logsDir,
      fileCount: logFiles.length,
      files: logFiles.map((file, index) => ({
        path: file,
        order: index + 1, // 1 = most recent
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Get server boot metadata and statistics
 * GET /api/logs/stats
 * 
 * Security: Requires authentication + super_admin role
 */
router.get('/stats', isAuthenticated, requireRole('super_admin'), (req: Request, res: Response) => {
  try {
    const logger = getConsoleLogger();
    const bootMetadata = logger.getBootMetadata();

    res.json({
      success: true,
      bootMetadata,
      logsDirectory: logger.getCurrentLogPath().split('\\').slice(0, -1).join('\\'),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Stream tail of log file (real-time updates via SSE)
 * GET /api/logs/stream
 * 
 * Security: Requires authentication + super_admin role
 * Note: SSE connection will close after 5 minutes if not closed by client
 */
router.get('/stream', isAuthenticated, requireRole('super_admin'), (req: Request, res: Response) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const logger = getConsoleLogger();
    const initialLines = 20;
    const tail = logger.getTailOfCurrentLog(initialLines);

    // Send initial data
    res.write(
      `data: ${JSON.stringify({
        type: 'initial',
        lines: tail.split('\n'),
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    // Send heartbeat every 5 seconds
    const interval = setInterval(() => {
      res.write(
        `data: ${JSON.stringify({
          type: 'heartbeat',
          timestamp: new Date().toISOString(),
        })}\n\n`
      );
    }, 5000);

    // Auto-close after 5 minutes
    const timeout = setTimeout(() => {
      res.write(
        `data: ${JSON.stringify({
          type: 'timeout',
          message: 'Stream closed after 5 minutes',
          timestamp: new Date().toISOString(),
        })}\n\n`
      );
      clearInterval(interval);
      res.end();
    }, 5 * 60 * 1000);

    // Cleanup on disconnect
    req.on('close', () => {
      clearInterval(interval);
      clearTimeout(timeout);
      res.end();
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

export default router;
