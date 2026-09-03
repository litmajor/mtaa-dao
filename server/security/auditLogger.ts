
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

export interface AuditLogEntry {
  id?: string;
  timestamp: Date;
  userId?: string;
  userEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  method: string;
  endpoint: string;
  ipAddress: string;
  userAgent: string;
  status: number;
  details?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'auth' | 'financial' | 'governance' | 'admin' | 'data' | 'security';
}

export class AuditLogger {
  private static instance: AuditLogger;
  
  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }
  
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Store in database
      await storage.createAuditLog(entry);
      
      // Console log for immediate visibility - show 'guest' instead of 'undefined'
      const userDisplay = entry.userId || 'guest';
      console.log(`[AUDIT] ${entry.timestamp.toISOString()} | ${entry.severity.toUpperCase()} | ${entry.category} | ${entry.action} | User: ${userDisplay} | IP: ${entry.ipAddress}`);
      
      // Alert on critical events
      if (entry.severity === 'critical') {
        await this.sendSecurityAlert(entry);
      }
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }
  
  private async sendSecurityAlert(entry: AuditLogEntry): Promise<void> {
    // Implement alerting mechanism (email, Slack, etc.)
    console.error(`🚨 CRITICAL SECURITY EVENT: ${entry.action} by ${entry.userId} from ${entry.ipAddress}`);
  }
}

// Middleware for automatic audit logging
export const auditMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  res.send = function(body) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const resolvedEndpoint = getRequestEndpoint(req);
    
    // Log after response is sent
    setImmediate(async () => {
      if (isIgnoredAuditRoute(resolvedEndpoint)) {
        return;
      }

      const user = req.user as any;
      const auditLogger = AuditLogger.getInstance();
      
      // Extract userId from various possible locations
      const userId = user?.claims?.sub || user?.id || user?.sub || undefined;
      const userEmail = user?.claims?.email || user?.email || undefined;
      
      const entry: AuditLogEntry = {
        timestamp: new Date(),
        userId: userId,
        userEmail: userEmail,
        action: getActionFromRequest(req, resolvedEndpoint),
        resource: getResourceFromRequest(req, resolvedEndpoint),
        resourceId: req.params.id || req.params.daoId || req.params.proposalId,
        method: req.method,
        endpoint: resolvedEndpoint,
        ipAddress: req.ip || req.connection.remoteAddress || '',
        userAgent: req.get('User-Agent') || '',
        status: res.statusCode,
        details: {
          responseTime,
          bodySize: JSON.stringify(body).length,
          query: req.query,
          params: req.params
        },
        severity: getSeverityFromRequest(req, res.statusCode, resolvedEndpoint),
        category: getCategoryFromRequest(req, resolvedEndpoint)
      };
      
      await auditLogger.log(entry);
    });
    
    return originalSend.call(this, body);
  };
  
  next();
};

function getRequestEndpoint(req: Request): string {
  const routePath = typeof req.route?.path === 'string' ? req.route.path : '';
  const baseUrl = req.baseUrl || '';
  const rawEndpoint = routePath ? `${baseUrl}${routePath}` : req.originalUrl || req.path || '';
  const withoutQuery = rawEndpoint.split('?')[0].split('#')[0];
  const normalized = withoutQuery.replace(/\/+/g, '/').replace(/\/?$/, '');
  return normalized || req.path || '/unknown';
}

function isIgnoredAuditRoute(endpoint: string): boolean {
  const normalized = endpoint.toLowerCase().split('?')[0].split('#')[0];
  return normalized === '/health'
    || normalized === '/api/health'
    || normalized.startsWith('/api/health/')
    || normalized === '/api-health'
    || normalized === '/metrics'
    || normalized === '/metrics/json'
    || normalized === '/favicon.ico';
}

function getActionFromRequest(req: Request, endpoint: string): string {
  const method = req.method.toLowerCase();
  const path = endpoint || req.path;
  
  if (path.includes('/login')) return 'login';
  if (path.includes('/logout')) return 'logout';
  if (path.includes('/register')) return 'register';
  if (path.includes('/deposit')) return 'vault_deposit';
  if (path.includes('/withdraw')) return 'vault_withdrawal';
  if (path.includes('/vote')) return 'vote_cast';
  if (path.includes('/proposal')) return method === 'post' ? 'proposal_create' : 'proposal_view';
  if (path.includes('/dao') && method === 'post') return 'dao_create';
  if (path.includes('/admin')) return 'admin_action';
  
  return `${method}_${path.split('/')[2] || 'unknown'}`;
}

function getResourceFromRequest(req: Request, endpoint: string): string {
  const path = endpoint || req.path;
  
  if (path.includes('/vault')) return 'vault';
  if (path.includes('/dao')) return 'dao';
  if (path.includes('/proposal')) return 'proposal';
  if (path.includes('/user')) return 'user';
  if (path.includes('/auth')) return 'authentication';
  if (path.includes('/payment')) return 'payment';
  if (path.includes('/admin')) return 'admin';
  
  return 'unknown';
}

function getSeverityFromRequest(req: Request, statusCode: number, endpoint: string): AuditLogEntry['severity'] {
  if (statusCode >= 500) return 'critical';
  if (statusCode >= 400) return 'high';
  if ((endpoint || req.path).includes('/admin')) return 'high';
  if ((endpoint || req.path).includes('/vault') || (endpoint || req.path).includes('/payment')) return 'medium';
  return 'low';
}

function getCategoryFromRequest(req: Request, endpoint: string): AuditLogEntry['category'] {
  const path = endpoint || req.path;
  
  if (path.includes('/auth') || path.includes('/login') || path.includes('/register')) return 'auth';
  if (path.includes('/vault') || path.includes('/payment') || path.includes('/deposit') || path.includes('/withdraw')) return 'financial';
  if (path.includes('/proposal') || path.includes('/vote') || path.includes('/dao')) return 'governance';
  if (path.includes('/admin')) return 'admin';
  if (path.includes('/user') || path.includes('/profile')) return 'data';
  
  return 'security';
}

// Security event logging functions
export const logSecurityEvent = {
  suspiciousActivity: async (userId: string, activity: string, details: any) => {
    const auditLogger = AuditLogger.getInstance();
    await auditLogger.log({
      timestamp: new Date(),
      userId,
      action: 'suspicious_activity',
      resource: 'security',
      endpoint: 'system',
      method: 'SYSTEM',
      ipAddress: 'system',
      userAgent: 'system',
      status: 0,
      details: { activity, ...details },
      severity: 'high',
      category: 'security'
    });
  },

  failedAuth: async (email: string | undefined, ipAddress: string, reason: string) => {
    const auditLogger = AuditLogger.getInstance();
    await auditLogger.log({
      timestamp: new Date(),
      userEmail: email,
      action: 'failed_authentication',
      resource: 'authentication',
      endpoint: '/auth/login',
      method: 'POST',
      ipAddress,
      userAgent: 'unknown',
      status: 401,
      details: { reason },
      severity: 'medium',
      category: 'auth'
    });
  },

  privilegeEscalation: async (userId: string, fromRole: string, toRole: string, adminId: string) => {
    const auditLogger = AuditLogger.getInstance();
    await auditLogger.log({
      timestamp: new Date(),
      userId: adminId,
      action: 'privilege_escalation',
      resource: 'user',
      resourceId: userId,
      endpoint: '/admin/users',
      method: 'PUT',
      ipAddress: 'system',
      userAgent: 'system',
      status: 200,
      details: { targetUser: userId, fromRole, toRole },
      severity: 'critical',
      category: 'admin'
    });
  }
};
