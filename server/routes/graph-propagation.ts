/**
 * Graph Propagation Engine - Monitoring & Control Routes
 * 
 * Phase B Integration Layer
 * Exposes metrics, state, and control endpoints for the graph propagation system
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { graphPropagationEngine } from '../services/graphPropagationEngine';
import { propagationMonitoringService } from '../services/propagationMonitoringService';
import { productionHardeningService, circuitBreaker } from '../services/productionHardeningService';
import { logger } from '../utils/logger';
import { authenticate } from '../auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

// ════════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION MIDDLEWARE
// ════════════════════════════════════════════════════════════════════════════════

// All graph propagation operations require authentication
router.use(authenticate);

/**
 * GET /api/propagation/status
 * Get current graph propagation engine status
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const nodes = graphPropagationEngine.getAllNodes();
  const healthStatus = propagationMonitoringService.getHealth();
  const cbStats = circuitBreaker.getStats();
  
  res.json({
    success: true,
    timestamp: Date.now(),
    engine: {
      nodesCount: nodes.length,
      state: 'active',
      lastUpdate: new Date().toISOString(),
    },
    health: healthStatus,
    circuitBreaker: cbStats,
  });
}));

/**
 * GET /api/propagation/metrics
 * Get propagation metrics & telemetry
 */
router.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
  const stats = propagationMonitoringService.getStats();
  const metrics = propagationMonitoringService.exportMetrics();
  
  res.json({
    success: true,
    stats,
    metrics,
  });
}));

/**
 * GET /api/propagation/nodes
 * Get all nodes with their propagation state
 */
router.get('/nodes', asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(Math.max(1, Number(req.query.limit ?? 100)), 500);
  const offset = (page - 1) * limit;

  const nodes = graphPropagationEngine.getAllNodes();
  const paginatedNodes = nodes.slice(offset, offset + limit);

  logger.debug('Graph propagation nodes queried', { page, limit, offset, total: nodes.length });

  res.json({
    success: true,
    count: paginatedNodes.length,
    total: nodes.length,
    page,
    limit,
    nodes: paginatedNodes.map(n => ({
      nodeId: n.nodeId,
      nodeType: n.nodeType,
      propagationState: n.propagationState,
      currentPrice: n.currentPrice,
      priceChange24h: n.priceChange24h,
    })),
  });
}));

/**
 * GET /api/propagation/node/:nodeId
 * Get specific node details
 */
router.get('/node/:nodeId', asyncHandler(async (req: Request, res: Response) => {
  const { nodeId } = req.params;
  const node = graphPropagationEngine.getNode(nodeId);
  
  if (!node) {
    return res.status(404).json({
      success: false,
      error: `Node ${nodeId} not found`,
    });
  }
  
  res.json({
    success: true,
    node,
  });
}));

/**
 * GET /api/propagation/cascades/:nodeId
 * Get cascades from a node to its neighbors
 */
router.get('/cascades/:nodeId', asyncHandler(async (req: Request, res: Response) => {
  const { nodeId } = req.params;
  const cascades = graphPropagationEngine.getCascadesToTarget(nodeId);
  
  res.json({
    success: true,
    nodeId,
    cascadesCount: cascades.length,
    cascades,
  });
}));

/**
 * GET /api/propagation/events
 * Get recent propagation events
 */
router.get('/events', asyncHandler(async (req: Request, res: Response) => {
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 1000) : 100;

  if (rawLimit !== undefined && (!Number.isFinite(rawLimit) || rawLimit <= 0 || rawLimit > 1000)) {
    logger.warn('Invalid propagation event limit requested', { rawLimit, normalizedLimit: limit });
  }

  const events = propagationMonitoringService.getRecentEvents(limit);

  res.json({
    success: true,
    count: events.length,
    events,
  });
}));

/**
 * GET /api/propagation/circuit-breaker
 * Get circuit breaker status
 */
router.get('/circuit-breaker', asyncHandler(async (req: Request, res: Response) => {
  const stats = circuitBreaker.getStats();
  
  res.json({
    success: true,
    stats,
  });
}));

/**
 * POST /api/propagation/circuit-breaker/reset
 * Reset circuit breaker
 * ⚠️ SECURITY: State mutation - super admin only
 */
router.post('/circuit-breaker/reset', requireRole('super_admin'), asyncHandler(async (req: Request, res: Response) => {
  circuitBreaker.reset();
  logger.info('Propagation circuit breaker reset via API', { userId: req.user?.id });

  res.json({
    success: true,
    message: 'Circuit breaker reset',
    stats: circuitBreaker.getStats(),
  });
}));

/**
 * GET /api/propagation/snapshots
 * List available state snapshots
 */
router.get('/snapshots', asyncHandler(async (req: Request, res: Response) => {
  const snapshots = productionHardeningService.getSnapshots();
  
  res.json({
    success: true,
    count: snapshots.length,
    snapshots,
  });
}));

/**
 * POST /api/propagation/snapshots/create
 * Create new state snapshot
 * ⚠️ SECURITY: State mutation - super admin only
 */
router.post('/snapshots/create', requireRole('super_admin'), asyncHandler(async (req: Request, res: Response) => {
  const nodes = graphPropagationEngine.getAllNodes();
  const snapshot = productionHardeningService.snapshot(nodes, 'Manual snapshot from API', 'API');

  logger.info('Propagation snapshot created via API', { userId: req.user?.id, snapshotId: snapshot.timestamp, nodeCount: nodes.length });

  res.json({
    success: true,
    snapshotId: snapshot.timestamp,
    message: 'Snapshot created successfully',
  });
}));

/**
 * POST /api/propagation/snapshots/restore/:snapshotId
 * Restore from state snapshot
 * ⚠️ SECURITY: State mutation - super admin only
 */
router.post('/snapshots/restore/:snapshotId', requireRole('super_admin'), asyncHandler(async (req: Request, res: Response) => {
  const { snapshotId } = req.params;
  const timestamp = Number(snapshotId);

  if (!Number.isInteger(timestamp) || timestamp <= 0 || !Number.isFinite(timestamp)) {
    logger.warn('Invalid snapshot restore request', { snapshotId, userId: req.user?.id });
    return res.status(400).json({
      success: false,
      error: 'Snapshot ID must be a positive integer',
    });
  }

  const restored = productionHardeningService.restoreSnapshot(timestamp);

  if (!restored) {
    logger.warn('Snapshot restore failed: snapshot not found', { snapshotId, userId: req.user?.id, timestamp });
    return res.status(404).json({
      success: false,
      error: `Snapshot ${snapshotId} not found`,
    });
  }

  logger.info('Propagation snapshot restored via API', { userId: req.user?.id, snapshotId, timestamp });

  res.json({
    success: true,
    message: `Restored snapshot ${snapshotId}`,
    snapshotId,
  });
}));

/**
 * GET /api/propagation/anomalies
 * Get detected anomalies
 */
router.get('/anomalies', asyncHandler(async (req: Request, res: Response) => {
  logger.warn('Anomaly endpoint is not yet implemented for propagation graph', { endpoint: '/api/propagation/anomalies' });

  res.status(501).json({
    success: false,
    detected: false,
    anomalies: [],
    error: 'Anomaly detection is not available yet',
  });
}));

/**
 * GET /api/propagation/state
 * Export full graph state
 */
router.get('/state', asyncHandler(async (req: Request, res: Response) => {
  const fullStateRequested = req.query.full === 'true';
  if (fullStateRequested) {
    logger.warn('Full propagation state export requested; this may be large and expensive', { userId: req.user?.id, nodes: graphPropagationEngine.getAllNodes().length });
  }

  const state = graphPropagationEngine.exportState();

  res.json({
    success: true,
    timestamp: state.timestamp,
    nodesCount: state.nodes.length,
    edgesCount: state.edges.length,
    _fullState: fullStateRequested ? state : undefined,
  });
}));

/**
 * Graph Propagation System endpoints (health check consolidated to /api/health/propagation)
 * See health.ts for /health endpoint
 */

export default router;
