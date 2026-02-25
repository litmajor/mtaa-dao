/**
 * POST /api/simulate - Simulator Execution Endpoint
 * 
 * Exposes all 23 simulators via REST API
 * Validates input parameters and returns standardized SimulationResult
 * Integrates with audit logging for compliance tracking
 */

import { Request, Response } from 'express';
import { getSimulator, listAvailableSimulators } from '../services/simulatorIndex';
import { SimulationResult, SimulationStatus } from '../services/simulationFramework';
import { auditLog } from '../services/auditLogger';

/**
 * Request body schema for simulation
 */
interface SimulateRequest {
  simulatorType: string;              // Key from SimulatorRegistry (e.g., 'SPOT_TRADE')
  params: Record<string, any>;        // Simulator-specific parameters
  userId?: string;                    // Optional user context for audit trail
  metadata?: Record<string, any>;     // Optional additional context
}

/**
 * Response schema for simulation result
 */
interface SimulateResponse {
  success: boolean;
  simulationId: string;
  result?: SimulationResult;
  error?: string;
  timestamp: number;
  executionTimeMs: number;
}

/**
 * POST /api/simulate
 * Execute a simulator and return results
 * 
 * Request Body:
 * {
 *   "simulatorType": "SPOT_TRADE",
 *   "params": {
 *     "userId": "user123",
 *     "side": "BUY",
 *     "symbol": "BTC/USDT",
 *     "quantity": 0.5,
 *     "currentPrice": 45000
 *   },
 *   "userId": "user123"
 * }
 * 
 * Success Response (200):
 * {
 *   "success": true,
 *   "simulationId": "sim-abc123",
 *   "result": {
 *     "status": "SUCCESS",
 *     "depth": "INTERMEDIATE",
 *     "riskLevel": "MEDIUM",
 *     "riskFactors": ["high-volatility"],
 *     ...
 *   },
 *   "timestamp": 1234567890,
 *   "executionTimeMs": 145
 * }
 * 
 * Error Response (400/500):
 * {
 *   "success": false,
 *   "error": "Invalid simulator type: UNKNOWN_TYPE",
 *   "timestamp": 1234567890,
 *   "executionTimeMs": 5
 * }
 */
export async function simulateHandler(
  req: Request,
  res: Response
): Promise<void> {
  const startTime = Date.now();
  const simulationId = `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { simulatorType, params, userId, metadata } = req.body as SimulateRequest;

    // ============================================================================
    // Validation
    // ============================================================================

    // Check required fields
    if (!simulatorType) {
      await auditLog({
        userId: userId || 'anonymous',
        action: 'SIMULATION_FAILED',
        resource: 'simulator',
        status: 'VALIDATION_ERROR',
        details: { error: 'simulatorType is required' },
        timestamp: new Date(),
      });

      res.status(400).json({
        success: false,
        simulationId,
        error: 'simulatorType is required',
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
      });
      return;
    }

    if (!params || typeof params !== 'object') {
      await auditLog({
        userId: userId || 'anonymous',
        action: 'SIMULATION_FAILED',
        resource: 'simulator',
        status: 'VALIDATION_ERROR',
        details: { error: 'params must be an object' },
        timestamp: new Date(),
      });

      res.status(400).json({
        success: false,
        simulationId,
        error: 'params must be an object',
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
      });
      return;
    }

    // ============================================================================
    // Get Simulator
    // ============================================================================

    let simulator;
    try {
      simulator = getSimulator(simulatorType);
    } catch (error) {
      const availableSimulators = listAvailableSimulators();

      await auditLog({
        userId: userId || 'anonymous',
        action: 'SIMULATION_FAILED',
        resource: 'simulator',
        status: 'INVALID_TYPE',
        details: {
          requestedType: simulatorType,
          availableCount: availableSimulators.length,
        },
        timestamp: new Date(),
      });

      res.status(400).json({
        success: false,
        simulationId,
        error: `Unknown simulator type: ${simulatorType}. Available: ${availableSimulators.join(', ')}`,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
      });
      return;
    }

    // ============================================================================
    // Execute Simulation
    // ============================================================================

    let simulationResult: SimulationResult;
    try {
      simulationResult = await simulator.simulate(params);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await auditLog({
        userId: userId || 'anonymous',
        action: 'SIMULATION_ERROR',
        resource: 'simulator',
        status: 'EXECUTION_ERROR',
        details: {
          simulatorType,
          error: errorMessage,
          paramKeys: Object.keys(params),
        },
        timestamp: new Date(),
      });

      res.status(500).json({
        success: false,
        simulationId,
        error: `Simulation execution failed: ${errorMessage}`,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
      });
      return;
    }

    // ============================================================================
    // Audit Success
    // ============================================================================

    const executionTime = Date.now() - startTime;

    await auditLog({
      userId: userId || 'anonymous',
      action: 'SIMULATION_SUCCESS',
      resource: 'simulator',
      status: simulationResult.status,
      details: {
        simulatorType,
        riskLevel: simulationResult.riskLevel,
        depth: simulationResult.depth,
        executionTimeMs: executionTime,
        hasWarnings: simulationResult.warnings.length > 0,
        hasErrors: simulationResult.errors.length > 0,
      },
      timestamp: new Date(),
    });

    // ============================================================================
    // Return Result
    // ============================================================================

    res.status(200).json({
      success: true,
      simulationId,
      result: simulationResult,
      timestamp: Date.now(),
      executionTimeMs: executionTime,
    });
  } catch (error) {
    // Unexpected error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await auditLog({
      userId: req.body?.userId || 'anonymous',
      action: 'SIMULATION_FATAL',
      resource: 'simulator',
      status: 'UNEXPECTED_ERROR',
      details: {
        error: errorMessage,
      },
      timestamp: new Date(),
    });

    res.status(500).json({
      success: false,
      simulationId,
      error: `Unexpected error: ${errorMessage}`,
      timestamp: Date.now(),
      executionTimeMs: Date.now() - startTime,
    });
  }
}

/**
 * GET /api/simulate/available
 * List all available simulators
 */
export async function listSimulatorsHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const available = listAvailableSimulators();

    res.status(200).json({
      success: true,
      count: available.length,
      simulators: available,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to list simulators',
      timestamp: Date.now(),
    });
  }
}

/**
 * Express Route Setup
 * 
 * Usage in main server file:
 * 
 * import { simulateHandler, listSimulatorsHandler } from '@/server/api/simulate';
 * 
 * app.post('/api/simulate', simulateHandler);
 * app.get('/api/simulate/available', listSimulatorsHandler);
 */
export const simulationRoutes = {
  'POST /api/simulate': simulateHandler,
  'GET /api/simulate/available': listSimulatorsHandler,
};
