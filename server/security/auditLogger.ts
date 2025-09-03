
import { Request, Response, NextFunction } from 'express';
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
      
      // Console log for immediate visibility
      console.log(`[AUDIT] ${entry.timestamp.toISOString()} | ${entry.severity.toUpperCase()} | ${entry.category} | ${entry.action} | User: ${entry.userId} | IP: ${entry.ipAddress}`);
      
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
    
    // Log after response is sent
    setImmediate(async () => {
      const user = req.user as any;
      const auditLogger = AuditLogger.getInstance();
      
      const entry: AuditLogEntry = {
        timestamp: new Date(),
        userId: user?.claims?.sub,
        userEmail: user?.claims?.email,
        action: getActionFromRequest(req),
        resource: getResourceFromRequest(req),
        resourceId: req.params.id || req.params.daoId || req.params.proposalId,
        method: req.method,
        endpoint: req.path,
        ipAddress: req.ip || req.connection.remoteAddress || '',
        userAgent: req.get('User-Agent') || '',
        status: res.statusCode,
        details: {
          responseTime,
          bodySize: JSON.stringify(body).length,
          query: req.query,
          params: req.params
        },
        severity: getSeverityFromRequest(req, res.statusCode),
        category: getCategoryFromRequest(req)
      };
      
      await auditLogger.log(entry);
    });
    
    return originalSend.call(this, body);
  };
  
  next();
};

function getActionFromRequest(req: Request): string {
  const method = req.method.toLowerCase();
  const path = req.path;
  
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

function getResourceFromRequest(req: Request): string {
  const path = req.path;
  
  if (path.includes('/vault')) return 'vault';
  if (path.includes('/dao')) return 'dao';
  if (path.includes('/proposal')) return 'proposal';
  if (path.includes('/user')) return 'user';
  if (path.includes('/auth')) return 'authentication';
  if (path.includes('/payment')) return 'payment';
  if (path.includes('/admin')) return 'admin';
  
  return 'unknown';
}

function getSeverityFromRequest(req: Request, statusCode: number): AuditLogEntry['severity'] {
  if (statusCode >= 500) return 'critical';
  if (statusCode >= 400) return 'high';
  if (req.path.includes('/admin')) return 'high';
  if (req.path.includes('/vault') || req.path.includes('/payment')) return 'medium';
  return 'low';
}

function getCategoryFromRequest(req: Request): AuditLogEntry['category'] {
  const path = req.path;
  
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
  
  failedAuth: async (email: string, ipAddress: string, reason: string) => {
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
