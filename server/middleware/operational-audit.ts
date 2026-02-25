/**
 * ⚠️ DEPRECATED - Operational Audit Middleware
 * 
 * This middleware has been consolidated into the unified AuditService (Phase 4)
 * 
 * MIGRATION GUIDE:
 * Old pattern (middleware-based):
 *   app.use(auditLoggerCaptureRequest)
 *   app.use(auditLoggerRecordResponse)
 * 
 * New pattern (service-based):
 *   import { auditService } from '../core/consolidation/AuditServiceConsolidation'
 *   auditService.logOperational({
 *     action: 'API_REQUEST',
 *     resource: req.path,
 *     details: { method, statusCode, duration }
 *   })
 * 
 * Benefits of consolidation:
 *   - Unified audit log storage
 *   - Automatic sensitive field redaction
 *   - Better correlation with system events
 *   - Single source of truth for compliance
 * 
 * This middleware will be removed in v2.0. Please migrate to AuditService.
 * For questions: See CONSOLIDATION_INTEGRATION_GUIDE.md
 */

/**
 * Operational Audit Middleware
 * Logs all API requests and responses for operational transparency
 * Mount at the very beginning of Express middleware stack
 */

import { Request, Response, NextFunction } from 'express';
import { getAuditLogger } from '../services/operational/audit/logger';
import { AuditActionType } from '../services/operational/types';

export interface AuditableRequest extends Request {
  auditStartTime?: number;
  auditRequestBody?: any;
  auditResponseBody?: any;
}

/**
 * Middleware to capture request start time and body
 */
export function auditLoggerCaptureRequest(req: AuditableRequest, res: Response, next: NextFunction) {
  req.auditStartTime = Date.now();

  // Capture request body (for POST/PUT/PATCH)
  if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    // Clone sensitive fields for audit (never log full secrets)
    const auditBody = { ...req.body };
    if (auditBody.password) auditBody.password = '[REDACTED]';
    if (auditBody.secret) auditBody.secret = '[REDACTED]';
    if (auditBody.apiKey) auditBody.apiKey = '[REDACTED]';
    if (auditBody.token) auditBody.token = '[REDACTED]';

    req.auditRequestBody = auditBody;
  }

  // Intercept response.json to capture response body
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    req.auditResponseBody = body;
    return originalJson(body);
  };

  next();
}

/**
 * Middleware to log completed request to audit trail
 * Should be mounted after request processing
 */
export async function auditLoggerRecordResponse(req: AuditableRequest, res: Response, next: NextFunction) {
  try {
    const auditLogger = getAuditLogger();

    // Only log admin/operational routes by default
    const shouldLog =
      req.path.includes('/api/admin/') ||
      req.method !== 'GET' || // Log all write operations
      req.query.audit === 'true'; // Explicit audit flag

    if (!shouldLog) {
      return next();
    }

    const duration = req.auditStartTime ? Date.now() - req.auditStartTime : 0;
    const actor = (req as any).user?.id || req.ip || 'unknown';
    const statusCode = res.statusCode;

    // Determine action type from request
    let actionDescription = `${req.method} ${req.path}`;
    if (req.path.includes('/admin/')) {
      if (req.method === 'GET') actionDescription = `ADMIN_GET: ${req.path}`;
      if (req.method === 'POST') actionDescription = `ADMIN_CREATE: ${req.path}`;
      if (req.method === 'PUT') actionDescription = `ADMIN_UPDATE: ${req.path}`;
      if (req.method === 'DELETE') actionDescription = `ADMIN_DELETE: ${req.path}`;
    }

    // Log successful operations
    if (statusCode < 400) {
      await auditLogger.logEvent(
        AuditActionType.CONFIG_CHANGED,
        actor,
        undefined, // targetService
        req.path, // targetResource
        req.auditRequestBody, // previousState (input)
        req.auditResponseBody, // newState (output)
        actionDescription,
        {
          method: req.method,
          path: req.path,
          statusCode,
          duration,
          remoteAddr: req.ip,
        }
      );
    } else {
      // Log errors too
      await auditLogger.logEvent(
        AuditActionType.CONFIG_CHANGED,
        actor,
        undefined,
        req.path,
        req.auditRequestBody,
        { error: req.auditResponseBody?.error || 'Unknown error', statusCode },
        `${actionDescription} - FAILED`,
        {
          method: req.method,
          path: req.path,
          statusCode,
          duration,
          remoteAddr: req.ip,
        }
      );
    }

    next();
  } catch (error) {
    console.error('[AuditLogger] Error recording response:', error);
    next();
  }
}

/**
 * Comprehensive audit middleware setup
 * Use this to set up both capture and recording
 */
export function setupOperationalAuditLogging(app: any) {
  // Setup capture on request entry
  app.use(auditLoggerCaptureRequest);

  // Setup recording on response (after all routes)
  app.use(auditLoggerRecordResponse);
}

export default setupOperationalAuditLogging;
