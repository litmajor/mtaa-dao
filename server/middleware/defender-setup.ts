/**
 * Defender Agent Integration Setup
 * Wire defender agent into Express app with route security management
 * Includes enterprise-grade custom validation handlers for all endpoints
 */

import { Express, Request, Response } from 'express';
import {
  defenderRegistry,
  defenderPrivilegeCheck,
  initializeDefenderPolicies,
  runDefenderAgentAnalysis,
  getDefenderDashboard,
} from './defender-agent-integration';

import {
  dynamicRouteMapper,
  trackRouteAccess,
  registerExpressRoutes,
  getRouteStatistics,
} from './dynamic-route-mapper';

import {
  EndpointSecurityPolicy,
  ValidationRuleType,
  ThreatLevel,
  UserRole,
} from '../agents/defender/types';

import customValidationRules from '../agents/defender/custom-validation-rules';

import { Logger } from '../utils/logger';

const logger = new Logger('defender-setup');

/**
 * Initialize defender agent integration
 * Call this in your main server file after creating Express app
 *
 * @example
 * const app = express();
 * // ... other setup ...
 * setupDefenderAgent(app, isAuthenticated);
 */
export function setupDefenderAgent(app: Express, authMiddleware: any) {
  logger.info('[DEFENDER] Initializing defender agent integration...');

  // 1. Initialize security policies with custom validation handlers
  initializeDefenderPolicies();
  registerCustomValidationHandlers(defenderRegistry);
  logger.info('[DEFENDER] Security policies initialized with custom validation handlers');

  // 2. Register route tracking middleware (apply globally)
  app.use(trackRouteAccess);
  logger.info('[DEFENDER] Route tracking enabled');

  // 3. Apply privilege checking middleware to DAO routes
  app.use('/api/dao/:daoId', authMiddleware, defenderPrivilegeCheck);
  app.use('/api/dao/:daoId/governance', defenderPrivilegeCheck);
  app.use('/api/dao/:daoId/treasury', defenderPrivilegeCheck);
  app.use('/api/dao/:daoId/disbursements', defenderPrivilegeCheck);
  logger.info('[DEFENDER] Privilege checking enabled on DAO routes');

  // 4. Auto-register all Express routes
  registerExpressRoutes(app);
  logger.info('[DEFENDER] Route mapper initialized');

  // 5. Setup defender agent APIs
  setupDefenderAgentAPIs(app, authMiddleware);
  logger.info('[DEFENDER] Defender agent APIs initialized');

  // 6. Start defender agent analysis loop (every 5 minutes)
  startDefenderAgentLoop();
  logger.info('[DEFENDER] Threat analysis loop started');

  logger.info('[DEFENDER] ✓ Defender agent integration complete');
}

/**
 * Register custom validation handlers for all endpoints
 * These handlers implement business logic validation rules
 */
function registerCustomValidationHandlers(registry: any) {
  logger.info('[DEFENDER] Registering custom validation handlers for all endpoints...');

  // ============================================================================
  // GOVERNANCE ROUTES - Custom Validators
  // ============================================================================

  // /api/dao/:daoId/governance/delegate - Privilege escalation check
  registry.updateCustomValidator('/api/dao/:daoId/governance/delegate', async (context: any) => {
    return customValidationRules.validatePrivilegeEscalation(context, {
      blockedActions: ['escalate_role'],
      restrictedRoles: ['banned', 'locked'],
    });
  });

  // /api/dao/:daoId/governance/proposals/:proposalId/cancel - Requires governance
  registry.updateCustomValidator('/api/dao/:daoId/governance/proposals/:proposalId/cancel', async (context: any) => {
    return customValidationRules.validateGovernanceApproval(context, {
      amountThreshold: 0, // All cancellations need approval
      requireProposal: true,
      requireVote: true,
    });
  });

  // ============================================================================
  // TREASURY ROUTES - Critical Custom Validators
  // ============================================================================

  // /api/dao/:daoId/treasury/transfer/native - High-value transfer validation
  registry.updateCustomValidator('/api/dao/:daoId/treasury/transfer/native', async (context: any) => {
    const amount = parseFloat(context.requestBody.amount || '0');

    // Validate recipient
    const recipientResult = await customValidationRules.validateRecipientWhitelist(context, [
      context.requestBody.toAddress,
    ]);
    if (!recipientResult.allowed) return recipientResult;

    // Check amount limits (max 10M per transfer)
    const amountResult = await customValidationRules.validateAmountLimit(context, 10_000_000);
    if (!amountResult.allowed) return amountResult;

    // Large transfers require governance approval
    if (amount > 1_000_000) {
      return customValidationRules.validateGovernanceApproval(context, {
        amountThreshold: 1_000_000,
        requireProposal: true,
        requireVote: true,
      });
    }

    return {
      allowed: true,
      threatDetected: false,
      ruleViolations: [],
      requiresMFA: amount > 500_000,
    };
  });

  // /api/dao/:daoId/treasury/transfer/token - Token transfer with whitelist
  registry.updateCustomValidator('/api/dao/:daoId/treasury/transfer/token', async (context: any) => {
    const amount = parseFloat(context.requestBody.amount || '0');

    // Validate token contract address
    if (!context.requestBody.tokenAddress?.match(/^0x[a-fA-F0-9]{40}$/)) {
      return {
        allowed: false,
        reason: 'Invalid ERC20 token address',
        threatDetected: true,
        threatType: 'INVALID_CONTRACT',
        ruleViolations: [],
      };
    }

    // Token transfers have lower limit
    const amountResult = await customValidationRules.validateAmountLimit(context, 5_000_000);
    if (!amountResult.allowed) return amountResult;

    // Check recipient
    const recipientResult = await customValidationRules.validateRecipientWhitelist(context, [
      context.requestBody.toAddress,
    ]);
    if (!recipientResult.allowed) return recipientResult;

    return {
      allowed: true,
      threatDetected: false,
      ruleViolations: [],
      requiresMFA: amount > 1_000_000,
    };
  });

  // /api/dao/:daoId/treasury/automation/payout - Time-based restrictions
  registry.updateCustomValidator('/api/dao/:daoId/treasury/automation/payout', async (context: any) => {
    return customValidationRules.validateTimeBasedRestriction(context, {
      allowedHours: [9, 17], // 9 AM - 5 PM
      allowedDays: [1, 2, 3, 4, 5], // Mon-Fri only
    });
  });

  // /api/dao/:daoId/treasury/limits - Governance approval required
  registry.updateCustomValidator('/api/dao/:daoId/treasury/limits', async (context: any) => {
    return customValidationRules.validateGovernanceApproval(context, {
      amountThreshold: 0, // All limit changes require governance
      requireProposal: true,
      requireVote: true,
    });
  });

  // /api/dao/:daoId/treasury/multisig/propose - Amount validation for multisig proposal
  registry.updateCustomValidator('/api/dao/:daoId/treasury/multisig/propose', async (context: any) => {
    const { requestBody } = context;

    if (!requestBody.transaction || !requestBody.description) {
      return {
        allowed: false,
        reason: 'Transaction and description are required',
        threatDetected: false,
        ruleViolations: [],
      };
    }

    const amount = parseFloat(requestBody.transaction.amount || '0');
    return customValidationRules.validateAmountLimit(context, 10_000_000);
  });

  // /api/dao/:daoId/treasury/multisig/:txId/execute - Multi-sig requirement check
  registry.updateCustomValidator('/api/dao/:daoId/treasury/multisig/:txId/execute', async (context: any) => {
    return customValidationRules.validateMultiSigRequirement(context, {
      requiredSignatures: 3, // Example: 3 of 5
      signatories: context.requestBody.signatories || [],
    });
  });

  logger.info('[DEFENDER] ✅ Custom validation handlers registered for all endpoints');
}

/**
 * Update specific endpoint custom validator at runtime
 * Usage: updateEndpointValidator('/api/dao/:daoId/treasury/transfer/native', myCustomHandler)
 */
export function updateEndpointValidator(
  endpoint: string,
  validator: (context: any) => Promise<any>
) {
  if (defenderRegistry.updateCustomValidator) {
    defenderRegistry.updateCustomValidator(endpoint, validator);
    logger.info(`[DEFENDER] Custom validator updated for ${endpoint}`);
  } else {
    logger.warn(`[DEFENDER] Registry does not support updateCustomValidator`);
  }
}

/**
 * Setup REST APIs for defender agent to access and manage security
 */
function setupDefenderAgentAPIs(app: Express, authMiddleware: any) {
  const adminAuth = authMiddleware; // Could be stricter admin auth

  /**
   * GET /api/admin/defender/dashboard
   * Defender agent: Get security dashboard
   */
  app.get('/api/admin/defender/dashboard', adminAuth, (req: Request, res: Response) => {
    const dashboard = getDefenderDashboard();
    res.json({
      success: true,
      defender: dashboard,
    });
  });

  /**
   * GET /api/admin/defender/endpoints
   * Defender agent: Get all registered endpoints and their security status
   */
  app.get('/api/admin/defender/endpoints', adminAuth, (req: Request, res: Response) => {
    const endpoints = defenderRegistry.getAllEndpoints();
    res.json({
      success: true,
      total: endpoints.length,
      endpoints,
    });
  });

  /**
   * GET /api/admin/defender/endpoints/high-risk
   * Defender agent: Get high-risk endpoints
   */
  app.get('/api/admin/defender/endpoints/high-risk', adminAuth, (req: Request, res: Response) => {
    const endpoints = defenderRegistry.getAllEndpoints().filter(ep => ep.policy.threatLevel === 'critical');
    res.json({
      success: true,
      count: endpoints.length,
      endpoints,
    });
  });

  /**
   * POST /api/admin/defender/endpoints/:endpoint/privileges
   * Defender agent: Update privilege requirements for endpoint
   *
   * @example
   * POST /api/admin/defender/endpoints/POST:%2Fapi%2Fdao%2F:daoId%2Ftreasury%2Ftransfer%2Fnative/privileges
   * Body: { "requiredPrivileges": ["transfer:treasury", "verified:mfa"] }
   */
  app.post('/api/admin/defender/endpoints/:endpoint/privileges', adminAuth, async (req: Request, res: Response) => {
    try {
      const endpoint = decodeURIComponent(req.params.endpoint);
      const [method, path] = endpoint.split(':');
      const { requiredPrivileges } = req.body;

      if (!Array.isArray(requiredPrivileges)) {
        return res.status(400).json({
          success: false,
          message: 'requiredPrivileges must be an array',
        });
      }

      const updated = await defenderRegistry.updateEndpointPrivileges(method, path, requiredPrivileges);

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Endpoint not found',
        });
      }

      res.json({
        success: true,
        message: `Privileges updated for ${endpoint}`,
        endpoint,
        requiredPrivileges,
      });
    } catch (error) {
      logger.error('[DEFENDER] Error updating privileges', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        message: 'Failed to update privileges',
      });
    }
  });

  /**
   * POST /api/admin/defender/endpoints/:endpoint/block
   * Defender agent: Block endpoint (during attack)
   *
   * @example
   * POST /api/admin/defender/endpoints/POST:%2Fapi%2Fdao%2F:daoId%2Ftreasury%2Ftransfer%2Fnative/block
   * Body: { "durationMs": 300000, "reason": "SQL injection attempt detected" }
   */
  app.post('/api/admin/defender/endpoints/:endpoint/block', adminAuth, async (req: Request, res: Response) => {
    try {
      const endpoint = decodeURIComponent(req.params.endpoint);
      const [method, path] = endpoint.split(':');
      const { durationMs = 300000, reason = 'Security threat detected' } = req.body;

      const blocked = await defenderRegistry.blockEndpoint(method, path, durationMs, reason);

      if (!blocked) {
        return res.status(404).json({
          success: false,
          message: 'Endpoint not found',
        });
      }

      res.json({
        success: true,
        message: `Endpoint blocked for ${durationMs}ms`,
        endpoint,
        reason,
        unblockAt: new Date(Date.now() + durationMs).toISOString(),
      });
    } catch (error) {
      logger.error('[DEFENDER] Error blocking endpoint', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        message: 'Failed to block endpoint',
      });
    }
  });

  /**
   * POST /api/admin/defender/endpoints/:endpoint/unblock
   * Defender agent: Unblock endpoint
   */
  app.post('/api/admin/defender/endpoints/:endpoint/unblock', adminAuth, async (req: Request, res: Response) => {
    try {
      const endpoint = decodeURIComponent(req.params.endpoint);
      const [method, path] = endpoint.split(':');

      const unblocked = await defenderRegistry.unblockEndpoint(method, path);

      if (!unblocked) {
        return res.status(404).json({
          success: false,
          message: 'Endpoint not found or not blocked',
        });
      }

      res.json({
        success: true,
        message: `Endpoint unblocked`,
        endpoint,
      });
    } catch (error) {
      logger.error('[DEFENDER] Error unblocking endpoint', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        message: 'Failed to unblock endpoint',
      });
    }
  });

  /**
   * GET /api/admin/defender/threats
   * Defender agent: Get threat alerts
   *
   * @query
   * ?severity=critical - Filter by severity
   * ?hours=24 - Look back N hours (default 24)
   * ?endpoint=/api/dao/:daoId/treasury - Filter by endpoint
   */
  app.get('/api/admin/defender/threats', adminAuth, (req: Request, res: Response) => {
    const { severity, endpoint, hours = 24 } = req.query;
    const alerts = defenderRegistry.getThreatAlerts(
      endpoint as string,
      severity as string,
      parseInt(hours as string) || 24
    );

    res.json({
      success: true,
      total: alerts.length,
      period: `Last ${hours} hours`,
      alerts,
    });
  });

  /**
   * GET /api/admin/routes
   * Defender agent: Get route map and statistics
   */
  app.get('/api/admin/routes', adminAuth, (req: Request, res: Response) => {
    const stats = getRouteStatistics();
    res.json({
      success: true,
      statistics: stats,
      routeMap: dynamicRouteMapper.exportRouteMap(),
    });
  });

  /**
   * GET /api/admin/routes/audit
   * Defender agent: Get route security audit
   */
  app.get('/api/admin/routes/audit', adminAuth, (req: Request, res: Response) => {
    const audit = dynamicRouteMapper.getSecurityAudit();
    const unprotected = dynamicRouteMapper.getUnprotectedRoutes();
    const highRisk = dynamicRouteMapper.getHighRiskRoutes();

    res.json({
      success: true,
      audit,
      unprotectedHighRiskRoutes: unprotected.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical'),
      allHighRiskRoutes: highRisk,
    });
  });

  /**
   * GET /api/admin/routes/:method/:path/metrics
   * Defender agent: Get specific route metrics
   */
  app.get('/api/admin/routes/:method/:path/metrics', adminAuth, (req: Request, res: Response) => {
    const { method, path } = req.params;
    const metrics = dynamicRouteMapper.getRouteMetrics(method.toUpperCase(), `/${path}`);

    if (!metrics) {
      return res.status(404).json({
        success: false,
        message: 'Route not found',
      });
    }

    res.json({
      success: true,
      metrics,
    });
  });

  logger.info('[DEFENDER] Defender agent APIs registered');
}

/**
 * Start defender agent analysis loop
 * Runs every 5 minutes to detect and respond to threats
 */
function startDefenderAgentLoop() {
  const ANALYSIS_INTERVAL = 5 * 60 * 1000; // 5 minutes

  setInterval(async () => {
    try {
      await runDefenderAgentAnalysis();
    } catch (error) {
      logger.error('[DEFENDER] Error in analysis loop', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, ANALYSIS_INTERVAL);

  logger.info(`[DEFENDER] Analysis loop started (every ${ANALYSIS_INTERVAL / 1000 / 60} minutes)`);
}

export default {
  setupDefenderAgent,
};
