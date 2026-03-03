/**
 * Defender Agent Integration
 * Enables the defender agent to dynamically manage endpoint security,
 * privilege checks, and threat response across the platform
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

const logger = new Logger('defender-agent');

/**
 * Endpoint security policy definition
 */
export interface EndpointSecurityPolicy {
  endpoint: string;
  method: string;
  requiredPrivileges: string[];
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  rateLimit: {
    requests: number;
    windowMs: number;
  };
  requiresAudit: boolean;
  requiresMFA?: boolean;
  allowedRoles: string[];
  customValidation?: (req: Request) => Promise<{ allowed: boolean; reason?: string }>;
  blockedUntil?: Date;
  description: string;
}

/**
 * Dynamic endpoint registry that defender agent can manage
 */
export class DefenderAgentEndpointRegistry {
  private endpoints = new Map<string, EndpointSecurityPolicy>();
  private threatAlerts: Array<{
    timestamp: Date;
    endpoint: string;
    userId: string;
    threatType: string;
    severity: string;
    action: string;
  }> = [];

  /**
   * Register endpoint with security policy
   */
  registerEndpoint(policy: EndpointSecurityPolicy) {
    const key = `${policy.method}:${policy.endpoint}`;
    this.endpoints.set(key, policy);
    logger.info(`[DEFENDER] Endpoint registered: ${key}`, {
      threatLevel: policy.threatLevel,
      requiredPrivileges: policy.requiredPrivileges,
    });
  }

  /**
   * Get security policy for endpoint
   */
  getEndpointPolicy(method: string, endpoint: string): EndpointSecurityPolicy | null {
    const key = `${method}:${endpoint}`;
    return this.endpoints.get(key) || null;
  }

  /**
   * Defender agent: Update privilege requirements for endpoint
   */
  async updateEndpointPrivileges(
    method: string,
    endpoint: string,
    requiredPrivileges: string[]
  ): Promise<boolean> {
    const key = `${method}:${endpoint}`;
    const policy = this.endpoints.get(key);

    if (!policy) {
      logger.warn(`[DEFENDER] Cannot update privileges for unknown endpoint: ${key}`);
      return false;
    }

    const oldPrivileges = policy.requiredPrivileges;
    policy.requiredPrivileges = requiredPrivileges;

    logger.info(`[DEFENDER] Endpoint privileges updated`, {
      endpoint: key,
      oldPrivileges,
      newPrivileges: requiredPrivileges,
      updatedBy: 'defender_agent',
    });

    return true;
  }

  /**
   * Defender agent: Temporarily block endpoint (e.g., during attack)
   */
  async blockEndpoint(
    method: string,
    endpoint: string,
    durationMs: number,
    reason: string
  ): Promise<boolean> {
    const key = `${method}:${endpoint}`;
    const policy = this.endpoints.get(key);

    if (!policy) {
      logger.warn(`[DEFENDER] Cannot block unknown endpoint: ${key}`);
      return false;
    }

    policy.blockedUntil = new Date(Date.now() + durationMs);

    logger.warn(`[DEFENDER] Endpoint blocked`, {
      endpoint: key,
      durationMs,
      reason,
      blockedUntil: policy.blockedUntil.toISOString(),
    });

    return true;
  }

  /**
   * Defender agent: Unblock endpoint
   */
  async unblockEndpoint(method: string, endpoint: string): Promise<boolean> {
    const key = `${method}:${endpoint}`;
    const policy = this.endpoints.get(key);

    if (!policy) {
      return false;
    }

    policy.blockedUntil = undefined;
    logger.info(`[DEFENDER] Endpoint unblocked: ${key}`);

    return true;
  }

  /**
   * Defender agent: Check if endpoint is blocked
   */
  isEndpointBlocked(method: string, endpoint: string): boolean {
    const policy = this.getEndpointPolicy(method, endpoint);
    if (!policy || !policy.blockedUntil) {
      return false;
    }

    const isBlocked = policy.blockedUntil > new Date();
    if (!isBlocked) {
      policy.blockedUntil = undefined;
    }

    return isBlocked;
  }

  /**
   * Defender agent: Record threat alert
   */
  recordThreatAlert(
    endpoint: string,
    userId: string,
    threatType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    action: string
  ) {
    this.threatAlerts.push({
      timestamp: new Date(),
      endpoint,
      userId,
      threatType,
      severity,
      action,
    });

    logger.warn(`[DEFENDER] Threat detected`, {
      endpoint,
      userId,
      threatType,
      severity,
      action,
    });

    // Trigger defender agent response if critical
    if (severity === 'critical') {
      this.triggerDefenderResponse(endpoint, userId, threatType);
    }
  }

  /**
   * Defender agent: Get threat alerts
   */
  getThreatAlerts(
    endpoint?: string,
    severity?: string,
    hours: number = 24
  ): typeof this.threatAlerts {
    const sinceTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    return this.threatAlerts.filter(
      alert =>
        alert.timestamp >= sinceTime &&
        (!endpoint || alert.endpoint.includes(endpoint)) &&
        (!severity || alert.severity === severity)
    );
  }

  /**
   * Defender agent: Analyze threat patterns and respond
   */
  async analyzeAndRespond() {
    const recentAlerts = this.getThreatAlerts(undefined, undefined, 1); // Last 1 hour

    // Detect patterns
    const threatsByEndpoint = new Map<string, number>();
    const threatsByUser = new Map<string, number>();

    for (const alert of recentAlerts) {
      threatsByEndpoint.set(
        alert.endpoint,
        (threatsByEndpoint.get(alert.endpoint) || 0) + 1
      );
      threatsByUser.set(alert.userId, (threatsByUser.get(alert.userId) || 0) + 1);
    }

    // Respond to patterns
    for (const [endpoint, count] of threatsByEndpoint.entries()) {
      if (count > 5) {
        // 5+ threats on same endpoint in 1 hour
        logger.warn(`[DEFENDER] Attack pattern detected on endpoint: ${endpoint}`);
        // Block endpoint temporarily
        const policy = this.getEndpointPolicy('POST', endpoint) ||
          this.getEndpointPolicy('GET', endpoint) ||
          this.getEndpointPolicy('PUT', endpoint);

        if (policy) {
          await this.blockEndpoint('POST', endpoint, 5 * 60 * 1000, 'Attack pattern detected');
        }
      }
    }

    for (const [userId, count] of threatsByUser.entries()) {
      if (count > 10) {
        // 10+ threats from same user in 1 hour
        logger.warn(`[DEFENDER] Suspicious user activity: ${userId}`);
        // Could trigger user suspension, additional verification, etc.
      }
    }
  }

  /**
   * Defender agent: Trigger automated response to threat
   */
  private triggerDefenderResponse(endpoint: string, userId: string, threatType: string) {
    logger.error(`[DEFENDER] Critical threat - automatic response triggered`, {
      endpoint,
      userId,
      threatType,
    });

    // Could trigger:
    // - IP blocking
    // - User temporary suspension
    // - Endpoint rate limit increase
    // - Security team alert
    // - Transaction reversal
    // etc.
  }

  /**
   * Get all registered endpoints
   */
  getAllEndpoints(): { key: string; policy: EndpointSecurityPolicy }[] {
    return Array.from(this.endpoints.entries()).map(([key, policy]) => ({
      key,
      policy,
    }));
  }

  /**
   * Clear threat alerts older than specified hours
   */
  clearOldAlerts(olderThanHours: number) {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const before = this.threatAlerts.length;

    this.threatAlerts = this.threatAlerts.filter(alert => alert.timestamp >= cutoffTime);

    logger.debug(`[DEFENDER] Cleared ${before - this.threatAlerts.length} old alerts`);
  }

  /**
   * Defender agent: Update custom validation handler for endpoint
   * Allows dynamic registration of business logic validators
   */
  updateCustomValidator(
    endpoint: string,
    validator: (context: any) => Promise<any>
  ): boolean {
    // Find endpoint by path pattern (handle :params like :daoId)
    for (const [key, policy] of this.endpoints.entries()) {
      // Check if endpoint matches pattern
      if (this.pathMatches(endpoint, policy.endpoint)) {
        policy.customValidation = async (req: Request) => {
          // Build validation context from request
          const context = {
            endpoint: policy.endpoint,
            method: policy.method,
            userId: (req as any).user?.id || 'anonymous',
            daoId: req.params.daoId,
            userRole: (req as any).user?.role || 'member',
            userPrivileges: (req as any).user?.privileges || [],
            threatLevel: (req as any).threatLevel || 'low',
            requestBody: req.body,
            requestParams: req.params,
            requestQuery: req.query,
          };

          const result = await validator(context);
          return {
            allowed: result.allowed !== false,
            reason: result.reason || 'Validation failed',
          };
        };

        logger.info(`[DEFENDER] Custom validator updated for ${endpoint}`, {
          matched: key,
        });
        return true;
      }
    }

    logger.warn(`[DEFENDER] Could not find endpoint matching ${endpoint}`);
    return false;
  }

  /**
   * Helper: Check if endpoint path matches policy endpoint pattern
   * Handles :param patterns like /api/dao/:daoId/treasury
   */
  private pathMatches(endpoint: string, policyEndpoint: string): boolean {
    // Exact match
    if (endpoint === policyEndpoint) return true;

    // Pattern match with params
    const endpointParts = endpoint.split('/').filter(Boolean);
    const policyParts = policyEndpoint.split('/').filter(Boolean);

    if (endpointParts.length !== policyParts.length) return false;

    for (let i = 0; i < endpointParts.length; i++) {
      const policyPart = policyParts[i];
      const endpointPart = endpointParts[i];

      // If policy has :param, it matches anything
      if (policyPart.startsWith(':')) continue;

      // Otherwise must match exactly
      if (policyPart !== endpointPart) return false;
    }

    return true;
  }

  /**
   * Get total number of registered endpoints
   */
  getTotalEndpoints(): number {
    return this.endpoints.size;
  }
}

/**
 * Global registry instance for defender agent
 */
export const defenderRegistry = new DefenderAgentEndpointRegistry();

/**
 * Middleware: Defender agent privilege checker
 * Uses dynamic policies from registry
 */
export function defenderPrivilegeCheck(req: Request, res: Response, next: NextFunction) {
  const method = req.method;
  const path = req.path;
  const userId = (req as any).user?.id || (req as any).user?.claims?.sub;

  // Get endpoint policy
  const policy = defenderRegistry.getEndpointPolicy(method, path);
  if (!policy) {
    // No policy defined - allow by default
    return next();
  }

  // Check if endpoint is blocked
  if (defenderRegistry.isEndpointBlocked(method, path)) {
    logger.warn(`[DEFENDER] Blocked request to endpoint under attack`, {
      userId,
      method,
      path,
    });
    return res.status(503).json({
      success: false,
      message: 'This endpoint is temporarily unavailable due to security measures',
      error: 'ENDPOINT_BLOCKED',
    });
  }

  // Check user role
  const userRole = (req as any).user?.role || 'user';
  if (!policy.allowedRoles.includes(userRole) && userRole !== 'admin') {
    logger.warn(`[DEFENDER] Insufficient role for endpoint access`, {
      userId,
      userRole,
      requiredRoles: policy.allowedRoles,
    });

    defenderRegistry.recordThreatAlert(
      path,
      userId || 'unknown',
      'PRIVILEGE_ESCALATION_ATTEMPT',
      'high',
      'blocked'
    );

    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions for this endpoint',
      error: 'INSUFFICIENT_PRIVILEGES',
      requiredPrivileges: policy.requiredPrivileges,
    });
  }

  // Check required privileges
  const userPrivileges = (req as any).user?.privileges || [];
  const missingPrivileges = policy.requiredPrivileges.filter(
    p => !userPrivileges.includes(p)
  );

  if (missingPrivileges.length > 0) {
    logger.warn(`[DEFENDER] Missing required privileges`, {
      userId,
      endpoint: path,
      missingPrivileges,
    });

    defenderRegistry.recordThreatAlert(
      path,
      userId || 'unknown',
      'INSUFFICIENT_PRIVILEGES',
      'medium',
      'blocked'
    );

    return res.status(403).json({
      success: false,
      message: 'Missing required privileges',
      error: 'MISSING_PRIVILEGES',
      requiredPrivileges: missingPrivileges,
    });
  }

  // Run custom validation if defined
  if (policy.customValidation) {
    policy
      .customValidation(req)
      .then(result => {
        if (!result.allowed) {
          logger.warn(`[DEFENDER] Custom validation failed`, {
            userId,
            path,
            reason: result.reason,
          });

          return res.status(403).json({
            success: false,
            message: result.reason || 'Access denied by custom validation',
            error: 'CUSTOM_VALIDATION_FAILED',
          });
        }

        next();
      })
      .catch(error => {
        logger.error(`[DEFENDER] Custom validation error`, {
          userId,
          path,
          error: error.message,
        });
        next(error);
      });
  } else {
    next();
  }
}

/**
 * Defender agent: Initialize security policies for endpoints
 */
export function initializeDefenderPolicies() {
  // Governance endpoints
  defenderRegistry.registerEndpoint({
    endpoint: '/api/dao/:daoId/governance/quorum',
    method: 'GET',
    requiredPrivileges: ['view:governance'],
    threatLevel: 'low',
    rateLimit: { requests: 30, windowMs: 60000 },
    requiresAudit: false,
    allowedRoles: ['member', 'admin'],
    description: 'Get DAO quorum information',
  });

  defenderRegistry.registerEndpoint({
    endpoint: '/api/dao/:daoId/governance/delegate',
    method: 'POST',
    requiredPrivileges: ['vote:delegate'],
    threatLevel: 'medium',
    rateLimit: { requests: 5, windowMs: 60000 },
    requiresAudit: true,
    allowedRoles: ['member', 'admin'],
    description: 'Delegate voting power',
  });

  // Treasury endpoints
  defenderRegistry.registerEndpoint({
    endpoint: '/api/dao/:daoId/treasury/balance',
    method: 'GET',
    requiredPrivileges: ['view:treasury'],
    threatLevel: 'low',
    rateLimit: { requests: 30, windowMs: 60000 },
    requiresAudit: false,
    allowedRoles: ['member', 'admin', 'treasurer'],
    description: 'View treasury balance',
  });

  defenderRegistry.registerEndpoint({
    endpoint: '/api/dao/:daoId/treasury/transfer/native',
    method: 'POST',
    requiredPrivileges: ['transfer:treasury'],
    threatLevel: 'critical',
    rateLimit: { requests: 1, windowMs: 60000 },
    requiresAudit: true,
    requiresMFA: true,
    allowedRoles: ['treasurer', 'admin'],
    customValidation: async (req: Request) => {
      // Defender agent could validate:
      // - Amount limits
      // - Recipient whitelist
      // - Time-based restrictions
      // - DAO governance requirements
      return { allowed: true };
    },
    description: 'Transfer native tokens from treasury',
  });

  defenderRegistry.registerEndpoint({
    endpoint: '/api/dao/:daoId/treasury/multisig/propose',
    method: 'POST',
    requiredPrivileges: ['propose:multisig', 'multisig:create'],
    threatLevel: 'critical',
    rateLimit: { requests: 3, windowMs: 300000 },
    requiresAudit: true,
    requiresMFA: true,
    allowedRoles: ['treasurer', 'admin'],
    customValidation: async (req: Request) => {
      // Defender agent enforces:
      // - Multisig witness requirements
      // - Transaction limits
      // - DAO treasury rules
      const { amount } = req.body;
      if (amount > 1000000) {
        // Example limit
        return {
          allowed: false,
          reason: 'Amount exceeds maximum single transaction limit',
        };
      }
      return { allowed: true };
    },
    description: 'Propose multisig treasury transaction',
  });

  // Disbursement endpoints
  defenderRegistry.registerEndpoint({
    endpoint: '/api/dao/:daoId/disbursements/history',
    method: 'GET',
    requiredPrivileges: ['view:disbursements'],
    threatLevel: 'low',
    rateLimit: { requests: 20, windowMs: 60000 },
    requiresAudit: false,
    allowedRoles: ['member', 'admin', 'treasurer'],
    description: 'View disbursement history',
  });

  logger.info(`[DEFENDER] Initialized ${defenderRegistry.getAllEndpoints().length} endpoint policies`);
}

/**
 * Defender agent: Monitor and respond to threats
 * Should be called periodically (e.g., every 5 minutes)
 */
export async function runDefenderAgentAnalysis() {
  logger.info('[DEFENDER] Running threat analysis...');
  await defenderRegistry.analyzeAndRespond();
  defenderRegistry.clearOldAlerts(24); // Keep last 24 hours of alerts
}

/**
 * Defender agent: Get security dashboard data
 */
export function getDefenderDashboard() {
  const recentAlerts = defenderRegistry.getThreatAlerts(undefined, undefined, 1);
  const criticalAlerts = recentAlerts.filter(a => a.severity === 'critical');
  const blockedEndpoints = defenderRegistry
    .getAllEndpoints()
    .filter(ep => ep.policy.blockedUntil && ep.policy.blockedUntil > new Date());

  return {
    status: 'active',
    lastRun: new Date(),
    metrics: {
      totalAlerts: recentAlerts.length,
      criticalAlerts: criticalAlerts.length,
      blockedEndpoints: blockedEndpoints.length,
      registeredEndpoints: defenderRegistry.getAllEndpoints().length,
    },
    recentCriticalAlerts: criticalAlerts.slice(0, 10),
    blockedEndpoints: blockedEndpoints.map(ep => ({
      endpoint: ep.key,
      blockedUntil: ep.policy.blockedUntil,
    })),
  };
}

export default {
  defenderRegistry,
  defenderPrivilegeCheck,
  initializeDefenderPolicies,
  runDefenderAgentAnalysis,
  getDefenderDashboard,
};
