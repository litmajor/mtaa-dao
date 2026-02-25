/**
 * ⚠️ DEPRECATED - CEX Audit Logger Middleware
 * 
 * This middleware has been consolidated into the unified AuditService (Phase 4)
 * 
 * MIGRATION GUIDE:
 * Old pattern (middleware-based):
 *   router.use('/cex', cexAuditLoggerMiddleware)
 *   OR direct service calls:
 *   cexAuditLogger.logCexOperation(...)
 * 
 * New pattern (service-based):
 *   import { auditService } from '../core/consolidation/AuditServiceConsolidation'
 *   auditService.logTrading({
 *     action: 'CEX_API_CALL',
 *     exchange: 'binance',
 *     resource: orderId,
 *     details: { operation, statusCode, duration }
 *   })
 * 
 * Benefits of consolidation:
 *   - Unified CEX + operational audit logs
 *   - Automatic PII/sensitive data redaction
 *   - Better correlation with circuit breaker events
 *   - Compliance-ready audit trails
 * 
 * This middleware will be removed in v2.0. Please migrate to AuditService.
 * For questions: See CONSOLIDATION_INTEGRATION_GUIDE.md
 */

/**
 * CEX Audit Logger Middleware
 * Logs all CEX-related operations for compliance and security auditing
 * 
 * Tracks:
 * - API endpoint access
 * - User IDs and timestamps
 * - Request parameters (sanitized)
 * - Response status codes
 * - Errors and exceptions
 * - Encryption operations
 */

import { Request, Response, NextFunction } from 'express';
import { KeyManagementService } from '../services/keyManagementService';
import { obfuscate } from '../utils/encryption';

export interface AuditLogEntry {
  timestamp: Date;
  userId?: string;
  action: string; // 'store_credentials', 'retrieve_credentials', 'place_order', etc.
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number; // milliseconds
  exchange?: string;
  resourceId?: string; // Order ID, Credential ID, etc.
  details?: Record<string, any>;
  error?: string;
  ipAddress?: string;
}

// In-memory audit log (consider database for production)
const auditLog: AuditLogEntry[] = [];
const MAX_LOG_ENTRIES = 10000;

/**
 * Middleware: Log all CEX operations
 * 
 * Usage:
 * router.use('/cex', cexAuditLoggerMiddleware);
 */
export function cexAuditLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const userId = (req as any).user?.id;
  const ipAddress = req.ip || req.socket.remoteAddress;
  const exchange = req.body?.exchange || req.params?.exchange;

  // Get action name from route
  let action = getActionName(req.method, req.path);

  // Wrap response to capture status code
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Create audit entry
    const auditEntry: AuditLogEntry = {
      timestamp: new Date(),
      userId,
      action,
      endpoint: req.path,
      method: req.method,
      statusCode,
      duration,
      exchange,
      ipAddress,
    };

    // Add request details (sanitized)
    if (req.method !== 'GET') {
      auditEntry.details = sanitizeRequestBody(req.body);
    }

    // Log errors
    if (statusCode >= 400) {
      try {
        const errorData = typeof data === 'string' ? JSON.parse(data) : data;
        auditEntry.error = errorData.error || errorData.message;
      } catch {
        auditEntry.error = String(data);
      }
    }

    // Add to log
    addToAuditLog(auditEntry);

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[CEX-AUDIT] ${action} - ${statusCode} (${duration}ms) - ${userId || 'guest'}`
      );
    }

    // Call original send
    return originalSend.call(this, data);
  };

  next();
}

/**
 * Get action name from HTTP method and path
 */
function getActionName(method: string, path: string): string {
  const pathSegments = path.split('/').filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1];

  if (path.includes('/credentials')) {
    if (method === 'POST') return 'store_credentials';
    if (method === 'GET') return 'retrieve_credentials';
    if (method === 'DELETE') return 'delete_credentials';
  }

  if (path.includes('/test')) {
    return 'test_credentials';
  }

  if (path.includes('/prices')) {
    return 'get_prices';
  }

  if (path.includes('/orders')) {
    if (method === 'POST') return 'place_order';
    if (method === 'GET') return 'get_orders';
  }

  if (path.includes('/smart-route')) {
    return 'calculate_smart_route';
  }

  if (path.includes('/arbitrage')) {
    return 'get_arbitrage_opportunities';
  }

  return `${method}_${lastSegment}`;
}

/**
 * Sanitize request body for logging
 * Removes sensitive fields
 */
function sanitizeRequestBody(body: any): Record<string, any> {
  if (!body || typeof body !== 'object') {
    return {};
  }

  const sanitized = { ...body };
  const sensitiveFields = [
    'apiKey',
    'apiSecret',
    'passphrase',
    'password',
    'token',
    'secret',
    'key',
    'pwd',
  ];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = obfuscate(sanitized[field]);
    }
  }

  return sanitized;
}

/**
 * Add entry to audit log with automatic pruning
 */
function addToAuditLog(entry: AuditLogEntry): void {
  auditLog.push(entry);

  // Keep only recent entries
  if (auditLog.length > MAX_LOG_ENTRIES) {
    auditLog.splice(0, auditLog.length - MAX_LOG_ENTRIES);
  }
}

/**
 * Get audit log entries
 */
export function getAuditLog(options?: {
  userId?: string;
  action?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}): AuditLogEntry[] {
  let filtered = [...auditLog];

  if (options?.userId) {
    filtered = filtered.filter(entry => entry.userId === options.userId);
  }

  if (options?.action) {
    filtered = filtered.filter(entry => entry.action === options.action);
  }

  if (options?.startTime) {
    filtered = filtered.filter(entry => entry.timestamp >= options.startTime!);
  }

  if (options?.endTime) {
    filtered = filtered.filter(entry => entry.timestamp <= options.endTime!);
  }

  // Return most recent first
  filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const limit = options?.limit || 100;
  return filtered.slice(0, limit);
}

/**
 * Get audit statistics
 */
export function getAuditStats(userId?: string): {
  totalOperations: number;
  successRate: number;
  averageResponseTime: number;
  operationsByType: Record<string, number>;
  errorsByType: Record<string, number>;
} {
  let entries = [...auditLog];

  if (userId) {
    entries = entries.filter(e => e.userId === userId);
  }

  const totalOperations = entries.length;
  const successCount = entries.filter(e => e.statusCode < 400).length;
  const successRate = totalOperations > 0 ? (successCount / totalOperations) * 100 : 0;
  const averageResponseTime =
    totalOperations > 0 ? entries.reduce((sum, e) => sum + e.duration, 0) / totalOperations : 0;

  const operationsByType: Record<string, number> = {};
  const errorsByType: Record<string, number> = {};

  for (const entry of entries) {
    operationsByType[entry.action] = (operationsByType[entry.action] || 0) + 1;

    if (entry.error) {
      errorsByType[entry.error] = (errorsByType[entry.error] || 0) + 1;
    }
  }

  return {
    totalOperations,
    successRate: Math.round(successRate * 100) / 100,
    averageResponseTime: Math.round(averageResponseTime),
    operationsByType,
    errorsByType,
  };
}

/**
 * Clear audit log (use with caution - typically for testing only)
 */
export function clearAuditLog(): void {
  auditLog.length = 0;
}

/**
 * Export audit log to CSV format for compliance
 */
export function exportAuditLogCSV(): string {
  const headers = [
    'Timestamp',
    'User ID',
    'Action',
    'Endpoint',
    'Method',
    'Status Code',
    'Duration (ms)',
    'Exchange',
    'IP Address',
    'Error',
  ];

  const rows = auditLog.map(entry => [
    entry.timestamp.toISOString(),
    entry.userId || 'N/A',
    entry.action,
    entry.endpoint,
    entry.method,
    entry.statusCode,
    entry.duration,
    entry.exchange || 'N/A',
    entry.ipAddress || 'N/A',
    entry.error || 'N/A',
  ]);

  const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

  return csv;
}

/**
 * Endpoint to view audit log (admin only)
 */
export async function getAuditLogEndpoint(req: Request, res: Response): Promise<void> {
  try {
    // Check if user is admin (implement based on your auth system)
    const isAdmin = (req as any).user?.role === 'admin';
    if (!isAdmin) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const userId = req.query.userId as string;
    const action = req.query.action as string;
    const limit = parseInt(req.query.limit as string) || 100;
    const format = req.query.format as string; // 'json' or 'csv'

    const logs = getAuditLog({
      userId,
      action,
      limit,
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
      res.send(exportAuditLogCSV());
      return;
    }

    res.json({
      total: logs.length,
      logs,
      stats: getAuditStats(userId),
    });
  } catch (error) {
    console.error('Error retrieving audit log:', error);
    res.status(500).json({
      error: 'Failed to retrieve audit log',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Endpoint to get audit statistics
 */
export async function getAuditStatsEndpoint(req: Request, res: Response): Promise<void> {
  try {
    // Check if user is admin
    const isAdmin = (req as any).user?.role === 'admin';
    if (!isAdmin) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const userId = req.query.userId as string;
    const stats = getAuditStats(userId);

    res.json({
      stats,
      reportedAt: new Date(),
      userId: userId || 'system-wide',
    });
  } catch (error) {
    console.error('Error retrieving audit stats:', error);
    res.status(500).json({
      error: 'Failed to retrieve audit statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
