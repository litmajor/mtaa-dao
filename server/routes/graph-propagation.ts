/**
 * Graph Propagation Engine - Monitoring & Control Routes
 * 
 * Phase B Integration Layer
 * Exposes metrics, state, and control endpoints for the graph propagation system
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { graphPropagationEngine } from '../services/graphPropagationEngine';
import { propagationMonitoringService } from '../services/propagationMonitoringService';
import { productionHardeningService, circuitBreaker } from '../services/productionHardeningService';
import { logger } from '../utils/logger';
import { authenticate } from '../auth';

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
  const nodes = graphPropagationEngine.getAllNodes();
  
  res.json({
    success: true,
    count: nodes.length,
    nodes: nodes.map(n => ({
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
  const limit = parseInt(req.query.limit as string, 10) || 100;
  
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
 */
router.post('/circuit-breaker/reset', asyncHandler(async (req: Request, res: Response) => {
  try {
    circuitBreaker.reset();
    
    res.json({
      success: true,
      message: 'Circuit breaker reset',
      stats: circuitBreaker.getStats(),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset circuit breaker',
    });
  }
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
 */
router.post('/snapshots/create', asyncHandler(async (req: Request, res: Response) => {
  try {
    const nodes = graphPropagationEngine.getAllNodes();
    const snapshot = productionHardeningService.snapshot(nodes, 'Manual snapshot from API', 'API');
    
    res.json({
      success: true,
      snapshotId: snapshot.timestamp,
      message: 'Snapshot created successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create snapshot',
    });
  }
}));

/**
 * POST /api/propagation/snapshots/restore/:snapshotId
 * Restore from state snapshot
 */
router.post('/snapshots/restore/:snapshotId', asyncHandler(async (req: Request, res: Response) => {
  const { snapshotId } = req.params;
  const timestamp = parseInt(snapshotId, 10);
  
  try {
    const restored = productionHardeningService.restoreSnapshot(timestamp);
    
    if (!restored) {
      return res.status(404).json({
        success: false,
        error: `Snapshot ${snapshotId} not found`,
      });
    }
    
    res.json({
      success: true,
      message: `Restored snapshot ${snapshotId}`,
      snapshotId,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore snapshot',
    });
  }
}));

/**
 * GET /api/propagation/anomalies
 * Get detected anomalies
 */
router.get('/anomalies', asyncHandler(async (req: Request, res: Response) => {
  // Note: detectAnomalies is not available on ProductionHardeningService
  // Return empty anomalies for now
  const anomalies: any[] = [];
  
  res.json({
    success: true,
    detected: anomalies.length > 0,
    anomalies,
  });
}));

/**
 * GET /api/propagation/state
 * Export full graph state
 */
router.get('/state', asyncHandler(async (req: Request, res: Response) => {
  const state = graphPropagationEngine.exportState();
  
  res.json({
    success: true,
    timestamp: state.timestamp,
    nodesCount: state.nodes.length,
    edgesCount: state.edges.length,
    // Note: Full state can be large, include flag to get full data
    _fullState: req.query.full === 'true' ? state : undefined,
  });
}));

/**
 * Graph Propagation System endpoints (health check consolidated to /api/health/propagation)
 * See health.ts for /health endpoint
 */

export default router;
