/**
 * POST /api/simulate - Simulator Execution Endpoint
 *
 * Exposes all supported simulators via REST API.
 * Validates input parameters and returns standardized SimulationResult.
 * Integrates with non-blocking audit logging for compliance tracking.
 */

import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { Request, Response } from 'express';
import { getSimulator, listAvailableSimulators } from '../services/simulatorIndex';
import type { SimulationResult } from '../services/simulationFramework';
import { auditLog } from '../services/auditLogger';

interface SimulateRequest {
  simulatorType: string;
  params: Record<string, any>;
  userId?: string;
  metadata?: Record<string, any>;
}

const SENSITIVE_KEYWORDS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'apikey',
  'privateKey',
  'privatekey',
  'authorization',
  'session',
  'signature',
  'seed',
  'mnemonic',
  'key',
  'passphrase',
  'wallet',
];

function getEffectiveUserId(req: Request): string {
  const authenticatedUserId = (req as any).user?.id;
  if (typeof authenticatedUserId === 'string' && authenticatedUserId.trim() !== '') {
    return authenticatedUserId;
  }
  return 'anonymous';
}

function sanitizeSimulationValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[Circular]';
    seen.add(value as object);

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeSimulationValue(item, seen));
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYWORDS.some((keyword) => key.toLowerCase().includes(keyword))) {
        sanitized[key] = '[REDACTED]';
        continue;
      }
      sanitized[key] = sanitizeSimulationValue(nestedValue, seen);
    }
    return sanitized;
  }

  return String(value);
}

async function safeAuditLog(entry: {
  userId: string;
  action: string;
  resource: string;
  status: string;
  details?: Record<string, any>;
  timestamp: Date;
}): Promise<void> {
  try {
    await auditLog(entry);
  } catch {
    // Intentionally non-blocking; audit failures must not break simulation execution.
  }
}

export async function simulateHandler(
  req: Request,
  res: Response
): Promise<void> {
  const startTime = performance.now();
  const simulationId = `sim-${randomUUID()}`;
  const requestUserId = getEffectiveUserId(req);

  try {
    const { simulatorType, params, metadata } = req.body as Partial<SimulateRequest>;
    const sanitizedParams = sanitizeSimulationValue(params ?? {});
    const sanitizedMetadata = sanitizeSimulationValue(metadata ?? {});

    if (!simulatorType) {
      await safeAuditLog({
        userId: requestUserId,
        action: 'SIMULATION_FAILED',
        resource: 'simulator',
        status: 'VALIDATION_ERROR',
        details: {
          error: 'simulatorType is required',
          metadata: sanitizedMetadata,
        },
        timestamp: new Date(),
      });

      res.status(400).json({
        success: false,
        simulationId,
        error: 'simulatorType is required',
        timestamp: Date.now(),
        executionTimeMs: performance.now() - startTime,
      });
      return;
    }

    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      await safeAuditLog({
        userId: requestUserId,
        action: 'SIMULATION_FAILED',
        resource: 'simulator',
        status: 'VALIDATION_ERROR',
        details: {
          error: 'params must be an object',
          metadata: sanitizedMetadata,
        },
        timestamp: new Date(),
      });

      res.status(400).json({
        success: false,
        simulationId,
        error: 'params must be an object',
        timestamp: Date.now(),
        executionTimeMs: performance.now() - startTime,
      });
      return;
    }

    let simulator: { simulate: (params: Record<string, any>) => Promise<SimulationResult> };
    try {
      simulator = await getSimulator(simulatorType);
    } catch {
      const availableSimulators = listAvailableSimulators();

      await safeAuditLog({
        userId: requestUserId,
        action: 'SIMULATION_FAILED',
        resource: 'simulator',
        status: 'INVALID_TYPE',
        details: {
          requestedType: simulatorType,
          availableCount: availableSimulators.length,
          metadata: sanitizedMetadata,
        },
        timestamp: new Date(),
      });

      res.status(400).json({
        success: false,
        simulationId,
        error: `Unknown simulator type: ${simulatorType}. Available: ${availableSimulators.join(', ')}`,
        timestamp: Date.now(),
        executionTimeMs: performance.now() - startTime,
      });
      return;
    }

    let simulationResult: SimulationResult;
    try {
      simulationResult = await simulator.simulate(sanitizedParams as Record<string, any>);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await safeAuditLog({
        userId: requestUserId,
        action: 'SIMULATION_ERROR',
        resource: 'simulator',
        status: 'EXECUTION_ERROR',
        details: {
          simulatorType,
          error: errorMessage,
          paramKeys: Object.keys(sanitizedParams as Record<string, any>),
          metadata: sanitizedMetadata,
        },
        timestamp: new Date(),
      });

      res.status(500).json({
        success: false,
        simulationId,
        error: `Simulation execution failed: ${errorMessage}`,
        timestamp: Date.now(),
        executionTimeMs: performance.now() - startTime,
      });
      return;
    }

    const executionTimeMs = performance.now() - startTime;

    await safeAuditLog({
      userId: requestUserId,
      action: 'SIMULATION_SUCCESS',
      resource: 'simulator',
      status: simulationResult.status,
      details: {
        simulatorType,
        riskLevel: simulationResult.riskLevel,
        depth: simulationResult.depth,
        executionTimeMs,
        hasWarnings: simulationResult.warnings.length > 0,
        hasErrors: simulationResult.errors.length > 0,
        metadata: sanitizedMetadata,
      },
      timestamp: new Date(),
    });

    res.status(200).json({
      success: true,
      simulationId,
      result: simulationResult,
      timestamp: Date.now(),
      executionTimeMs,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await safeAuditLog({
      userId: requestUserId,
      action: 'SIMULATION_FATAL',
      resource: 'simulator',
      status: 'UNEXPECTED_ERROR',
      details: {
        error: errorMessage,
        metadata: sanitizeSimulationValue(req.body?.metadata ?? {}),
      },
      timestamp: new Date(),
    });

    res.status(500).json({
      success: false,
      simulationId,
      error: `Unexpected error: ${errorMessage}`,
      timestamp: Date.now(),
      executionTimeMs: performance.now() - startTime,
    });
  }
}

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

export const simulationRoutes = {
  'POST /api/simulate': simulateHandler,
  'GET /api/simulate/available': listSimulatorsHandler,
};
