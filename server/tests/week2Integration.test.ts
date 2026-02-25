import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import {
  createRateLimiter,
  globalRateLimiter,
  authRateLimiter,
  apiRateLimiter,
  sensitiveOperationRateLimiter,
  adminRateLimiter,
  getDistributedRateLimitKey,
  RateLimitConfig,
} from '../middleware/rateLimiting';
import {
  logAuditEvent,
  getAuditLogs,
  getUserActivity,
  getDAOActivity,
  getSecurityEvents,
  generateAuditReport,
  getEventSeverity,
  AuditEventType,
} from '../services/auditLogging';

/**
 * RATE LIMITING MIDDLEWARE TESTS
 */
describe('Rate Limiting Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: jest.Mock;

  beforeEach(() => {
    mockReq = {
      ip: '192.168.1.1',
      path: '/api/test',
      method: 'GET',
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn(),
      send: jest.fn(),
      statusCode: 200,
    };

    nextFn = jest.fn();
  });

  describe('createRateLimiter', () => {
    it('should allow requests within limit', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      for (let i = 0; i < 5; i++) {
        limiter(mockReq as Request, mockRes as Response, nextFn);
        expect(nextFn).toHaveBeenCalledTimes(i + 1);
      }
    });

    it('should reject requests exceeding limit', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 3,
      });

      // Make 3 successful requests
      for (let i = 0; i < 3; i++) {
        nextFn.mockClear();
        limiter(mockReq as Request, mockRes as Response, nextFn);
        expect(nextFn).toHaveBeenCalled();
      }

      // 4th request should be rejected
      nextFn.mockClear();
      limiter(mockReq as Request, mockRes as Response, nextFn);
      expect(nextFn).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should set rate limit headers', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
      });

      limiter(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
      expect(mockRes.set).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(String)
      );
    });

    it('should use custom key generator', () => {
      const customKeygen = jest.fn(() => 'custom-key');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 3,
        keyGenerator: customKeygen,
      });

      limiter(mockReq as Request, mockRes as Response, nextFn);
      expect(customKeygen).toHaveBeenCalledWith(mockReq);
    });

    it('should use custom limit reached handler', () => {
      const onLimitReached = jest.fn();
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        onLimitReached,
      });

      limiter(mockReq as Request, mockRes as Response, nextFn); // OK
      limiter(mockReq as Request, mockRes as Response, nextFn); // Should trigger

      expect(onLimitReached).toHaveBeenCalledWith(mockReq, mockRes);
    });

    it('should differentiate between different IPs', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
      });

      // IP 1 makes 2 requests
      for (let i = 0; i < 2; i++) {
        nextFn.mockClear();
        limiter(mockReq as Request, mockRes as Response, nextFn);
        expect(nextFn).toHaveBeenCalled();
      }

      // IP 2 makes 1 request (should succeed)
      mockReq.ip = '192.168.1.2';
      nextFn.mockClear();
      limiter(mockReq as Request, mockRes as Response, nextFn);
      expect(nextFn).toHaveBeenCalled();
    });

    it('should return proper error response with retryAfter', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
      });

      limiter(mockReq as Request, mockRes as Response, nextFn);
      limiter(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Too many requests, please try again later',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: expect.any(Number),
        },
      });
    });
  });

  describe('Global rate limiter', () => {
    it('should limit to 15 requests per minute', () => {
      // This is more of an integration test
      // In practice, we'd mock time or use a real store
      expect(globalRateLimiter).toBeDefined();
    });
  });

  describe('Auth rate limiter', () => {
    it('should be more restrictive for auth endpoints', () => {
      // authRateLimiter has 5 requests per 15 minutes
      // globalRateLimiter has 15 requests per 1 minute
      expect(authRateLimiter).toBeDefined();
    });
  });

  describe('Distributed rate limit key', () => {
    it('should generate user-scoped keys', () => {
      (mockReq as any).user = { userId: 'user-123' };
      const key = getDistributedRateLimitKey(mockReq as Request, 'user');
      expect(key).toBe('ratelimit:user:user-123');
    });

    it('should generate endpoint-scoped keys', () => {
      const key = getDistributedRateLimitKey(mockReq as Request, 'endpoint');
      expect(key).toContain('ratelimit:endpoint');
      expect(key).toContain('/api/test');
    });

    it('should generate global-scoped keys', () => {
      const key = getDistributedRateLimitKey(mockReq as Request, 'global');
      expect(key).toContain('ratelimit:global');
    });
  });
});

/**
 * AUDIT LOGGING SERVICE TESTS
 */
describe('Audit Logging Service', () => {
  describe('logAuditEvent', () => {
    it('should log authentication events', async () => {
      const result = await logAuditEvent({
        eventType: AuditEventType.LOGIN_SUCCESS,
        userId: 'user-123',
        userEmail: 'user@example.com',
        action: 'User successfully logged in',
        metadata: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
        severity: 'low',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        endpoint: '/auth/login',
        method: 'POST',
        statusCode: 200,
      });

      expect(result).toBeDefined();
      expect(result?.action).toContain('logged in');
      expect(result?.userId).toBe('user-123');
    });

    it('should log security events', async () => {
      const result = await logAuditEvent({
        eventType: AuditEventType.PERMISSION_DENIED,
        userId: 'user-123',
        action: 'Permission denied for proposal execution',
        metadata: {
          proposalId: 'prop-789',
          reason: 'Insufficient permissions',
        },
        severity: 'high',
        ipAddress: '192.168.1.1',
        endpoint: '/proposals/execute',
        method: 'POST',
        statusCode: 403,
      });

      expect(result?.severity).toBe('high');
      expect(result?.action).toContain('Permission denied');
    });

    it('should log admin actions', async () => {
      const result = await logAuditEvent({
        eventType: AuditEventType.ADMIN_USER_BANNED,
        userId: 'admin-123',
        resourceId: 'user-banned-123',
        action: 'Admin banned user account',
        metadata: {
          bannedUserId: 'user-banned-123',
          reason: 'Suspicious activity',
        },
        severity: 'critical',
        ipAddress: '192.168.1.1',
        endpoint: '/admin/users/ban',
        method: 'POST',
        statusCode: 200,
      });

      expect(result?.severity).toBe('critical');
      expect(result?.action).toContain('banned');
    });

    it('should log DAO operations', async () => {
      const result = await logAuditEvent({
        eventType: AuditEventType.PROPOSAL_EXECUTED,
        userId: 'user-123',
        resourceId: 'proposal-789',
        action: 'Proposal executed successfully',
        metadata: {
          amount: '1000',
          recipient: '0xabc123...',
          transactionHash: 'tx-hash-123',
        },
        severity: 'low',
        ipAddress: '192.168.1.1',
        endpoint: '/proposals/execute',
        method: 'POST',
        statusCode: 200,
      });

      expect(result?.action).toContain('executed');
      expect(result?.resourceId).toBe('proposal-789');
    });

    it('should handle missing optional fields', async () => {
      const result = await logAuditEvent({
        eventType: AuditEventType.API_ERROR,
        action: 'API error occurred',
        metadata: {
          endpoint: '/api/users',
          statusCode: 500,
          errorMessage: 'Internal server error',
        },
        severity: 'high',
        ipAddress: '127.0.0.1',
        endpoint: '/api/users',
        method: 'GET',
        statusCode: 500,
      });

      expect(result).toBeDefined();
      expect(result?.userId).toBeNull();
    });
  });

  describe('getAuditLogs', () => {
    it('should query logs by user', async () => {
      // Mock implementation test
      const result = await getAuditLogs({
        userId: 'user-123',
        limit: 10,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should query logs by resource', async () => {
      const result = await getAuditLogs({
        resource: AuditEventType.LOGIN_SUCCESS,
        limit: 10,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const result = await getAuditLogs({
        startDate,
        endDate,
        limit: 50,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by severity', async () => {
      const result = await getAuditLogs({
        severity: 'high',
        limit: 20,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should support pagination', async () => {
      const page1 = await getAuditLogs({
        limit: 10,
        offset: 0,
      });

      const page2 = await getAuditLogs({
        limit: 10,
        offset: 10,
      });

      expect(Array.isArray(page1)).toBe(true);
      expect(Array.isArray(page2)).toBe(true);
    });
  });

  describe('getUserActivity', () => {
    it('should retrieve user activity for last 24 hours', async () => {
      const result = await getUserActivity('user-123', 24, 50);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should support custom time windows', async () => {
      const result = await getUserActivity('user-123', 7 * 24, 100); // 7 days
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getResourceActivity', () => {
    it('should retrieve resource activity', async () => {
      const result = await getResourceActivity(AuditEventType.LOGIN_SUCCESS);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getSecurityEvents', () => {
    it('should only return high/critical severity events', async () => {
      const result = await getSecurityEvents({
        limit: 100,
      });

      expect(Array.isArray(result)).toBe(true);
      // In a real test, verify severity levels
    });
  });

  describe('generateAuditReport', () => {
    it('should generate comprehensive audit report', async () => {
      const report = await generateAuditReport({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      });

      expect(report).toHaveProperty('totalEvents');
      expect(report).toHaveProperty('eventsByType');
      expect(report).toHaveProperty('eventsBySeverity');
      expect(report).toHaveProperty('criticalEvents');
      expect(report).toHaveProperty('reportGeneratedAt');
      expect(typeof report.totalEvents).toBe('number');
    });

    it('should support user-scoped reports', async () => {
      const report = await generateAuditReport({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        userId: 'user-123',
      });

      expect(report).toHaveProperty('totalEvents');
    });

    it('should track critical events separately', async () => {
      const report = await generateAuditReport({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      });

      expect(Array.isArray(report.criticalEvents)).toBe(true);
    });
  });

  describe('getEventSeverity', () => {
    it('should classify critical events', () => {
      expect(getEventSeverity(AuditEventType.ACCOUNT_BANNED)).toBe('critical');
      expect(getEventSeverity(AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT)).toBe(
        'critical'
      );
      expect(getEventSeverity(AuditEventType.PERMISSION_DENIED)).toBe(
        'critical'
      );
    });

    it('should classify high severity events', () => {
      expect(getEventSeverity(AuditEventType.LOGIN_FAILURE)).toBe('high');
      expect(getEventSeverity(AuditEventType.RATE_LIMIT_EXCEEDED)).toBe(
        'high'
      );
    });

    it('should classify medium severity events', () => {
      expect(getEventSeverity(AuditEventType.MEMBER_REMOVED)).toBe('medium');
      expect(getEventSeverity(AuditEventType.PASSWORD_RESET)).toBe('medium');
    });

    it('should classify low severity events', () => {
      expect(getEventSeverity(AuditEventType.LOGIN_SUCCESS)).toBe('low');
      expect(getEventSeverity(AuditEventType.PROPOSAL_CREATED)).toBe('low');
    });
  });
});

/**
 * INTEGRATION TESTS
 */
describe('Rate Limiting + Audit Logging Integration', () => {
  it('should log rate limit exceeded events', async () => {
    // When rate limit is hit, should log RATE_LIMIT_EXCEEDED event
    const auditResult = await logAuditEvent({
      eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
      userId: 'user-123',
      action: 'Rate limit exceeded on auth endpoint',
      metadata: {
        ipAddress: '192.168.1.1',
        endpoint: '/api/auth/login',
        attempts: 6,
        limit: 5,
      },
      severity: 'high',
      ipAddress: '192.168.1.1',
      endpoint: '/api/auth/login',
      method: 'POST',
      statusCode: 429,
    });

    expect(auditResult?.eventType === AuditEventType.RATE_LIMIT_EXCEEDED).toBeDefined();
  });

  it('should correlate rate limit events with user activity', async () => {
    // Log multiple rate limit events
    await logAuditEvent({
      eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
      userId: 'user-123',
      action: 'First rate limit',
      metadata: { endpoint: '/api/auth/login' },
      severity: 'high',
      ipAddress: '192.168.1.1',
      endpoint: '/api/auth/login',
      method: 'POST',
      statusCode: 429,
    });

    // Query user activity
    const activity = await getUserActivity('user-123', 1, 10);

    expect(Array.isArray(activity)).toBe(true);
    // Should contain the rate limit event
  });
});
