/**
 * Admin Authentication & Authorization Tests
 * 
 * Tests critical admin access control gates:
 * - requireSuperAdminEnhanced: verifies authentication, role, ban status, audit logging
 * - verifyAdminRequestHeaders: enforces Content-Type and User-Agent validation
 * - logAdminAction: captures admin action metadata for compliance
 * 
 * Risk classification: P0 - admin/treasury/multisig auth bypass equivalent
 */

import { vi } from 'vitest';

// Mock environment config BEFORE any imports to prevent env validation failures
vi.mock('../../shared/config.ts', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret',
  },
}));

vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('../utils/logger', () => {
  // Global mock to track all logger calls across instances
  const infoCall = vi.fn();
  const warnCall = vi.fn();
  const errorCall = vi.fn();

  class MockLogger {
    warn = warnCall;
    error = errorCall;
    info = infoCall;
    constructor(_name: string) {}
  }

  // Expose mock calls for testing
  (MockLogger as any).getMockInfo = () => infoCall;
  (MockLogger as any).getMockWarn = () => warnCall;
  (MockLogger as any).getMockError = () => errorCall;

  return { Logger: MockLogger };
});

import { describe, it, expect, beforeEach, afterEach, vi as vitestVi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import {
  requireSuperAdminEnhanced,
  verifyAdminRequestHeaders,
  logAdminAction,
} from '../middleware/adminAuth';
import { db } from '../db';
import { Logger } from '../utils/logger';

describe('Admin Authentication Middleware - requireSuperAdminEnhanced', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      path: '/admin/users',
      method: 'GET',
      ip: '192.168.1.1',
      connection: { remoteAddress: '192.168.1.1' } as any,
      get: vi.fn((header: string) => {
        if (header === 'user-agent') return 'Mozilla/5.0 Test Agent';
        return null;
      }),
    } as any;

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    next = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication checks', () => {
    it('should reject request without authentication (no userId)', async () => {
      // Arrange: no user on request
      (req as any).user = undefined;

      // Act
      await requireSuperAdminEnhanced(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('Authentication'),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request if userId is in wrong claim location but still missing', async () => {
      // Arrange: user object exists but has neither userId nor claims.sub
      (req as any).user = { email: 'test@example.com' };

      // Act
      await requireSuperAdminEnhanced(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('User lookup checks', () => {
    it('should return 404 if user does not exist in database', async () => {
      // Arrange
      (req as any).user = { userId: 'nonexistent-user-id' };

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]); // Empty result

      mockSelect.mockReturnValueOnce({
        from: mockFrom,
      });
      mockFrom.mockReturnValueOnce({
        where: mockWhere,
      });
      mockWhere.mockReturnValueOnce({
        limit: mockLimit,
      });

      (db.select as any).mockReturnValueOnce({
        from: mockFrom,
      });

      // Act
      await requireSuperAdminEnhanced(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('not found'),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Role validation checks', () => {
    it('should reject user with wrong role (not super_admin)', async () => {
      // Arrange
      (req as any).user = { userId: 'user-123' };

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([
        {
          id: 'user-123',
          email: 'regular@example.com',
          roles: 'admin', // NOT super_admin
          isBanned: false,
        },
      ]);

      mockSelect.mockReturnValueOnce({
        from: mockFrom,
      });
      mockFrom.mockReturnValueOnce({
        where: mockWhere,
      });
      mockWhere.mockReturnValueOnce({
        limit: mockLimit,
      });

      (db.select as any).mockReturnValueOnce({
        from: mockFrom,
      });

      // Act
      await requireSuperAdminEnhanced(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('Super admin role required'),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject user with null role (defaults to not super_admin)', async () => {
      // Arrange
      (req as any).user = { userId: 'user-123' };

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([
        {
          id: 'user-123',
          email: 'nullrole@example.com',
          roles: null, // Null role
          isBanned: false,
        },
      ]);

      mockSelect.mockReturnValueOnce({
        from: mockFrom,
      });
      mockFrom.mockReturnValueOnce({
        where: mockWhere,
      });
      mockWhere.mockReturnValueOnce({
        limit: mockLimit,
      });

      (db.select as any).mockReturnValueOnce({
        from: mockFrom,
      });

      // Act
      await requireSuperAdminEnhanced(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Ban status checks', () => {
    it('should reject banned user even if super_admin role is present', async () => {
      // Arrange
      (req as any).user = { userId: 'user-123' };

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([
        {
          id: 'user-123',
          email: 'banned-admin@example.com',
          roles: 'super_admin',
          isBanned: true, // Banned!
        },
      ]);

      mockSelect.mockReturnValueOnce({
        from: mockFrom,
      });
      mockFrom.mockReturnValueOnce({
        where: mockWhere,
      });
      mockWhere.mockReturnValueOnce({
        limit: mockLimit,
      });

      (db.select as any).mockReturnValueOnce({
        from: mockFrom,
      });

      // Act
      await requireSuperAdminEnhanced(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('Account suspended'),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Successful authentication flow', () => {
    it('should allow super_admin with all checks passing', async () => {
      // Arrange
      (req as any).user = { userId: 'superadmin-123' };

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([
        {
          id: 'superadmin-123',
          email: 'admin@mtaadao.com',
          roles: 'super_admin',
          isBanned: false,
        },
      ]);

      mockSelect.mockReturnValueOnce({
        from: mockFrom,
      });
      mockFrom.mockReturnValueOnce({
        where: mockWhere,
      });
      mockWhere.mockReturnValueOnce({
        limit: mockLimit,
      });

      (db.select as any).mockReturnValueOnce({
        from: mockFrom,
      });

      // Act
      await requireSuperAdminEnhanced(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect((req as any).adminUser).toBeDefined();
      expect((req as any).adminUser.roles).toBe('super_admin');
    });

    it('should attach admin user context to request on success', async () => {
      // Arrange
      (req as any).user = { userId: 'superadmin-456' };

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([
        {
          id: 'superadmin-456',
          email: 'lead-admin@mtaadao.com',
          roles: 'super_admin',
          isBanned: false,
        },
      ]);

      mockSelect.mockReturnValueOnce({
        from: mockFrom,
      });
      mockFrom.mockReturnValueOnce({
        where: mockWhere,
      });
      mockWhere.mockReturnValueOnce({
        limit: mockLimit,
      });

      (db.select as any).mockReturnValueOnce({
        from: mockFrom,
      });

      // Act
      await requireSuperAdminEnhanced(req as Request, res as Response, next);

      // Assert
      expect((req as any).adminUser).toEqual({
        id: 'superadmin-456',
        email: 'lead-admin@mtaadao.com',
        roles: 'super_admin',
        isBanned: false,
      });
    });
  });

  describe('Database error handling', () => {
    it('should return 500 on database query error', async () => {
      // Arrange
      (req as any).user = { userId: 'user-123' };

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockRejectedValue(new Error('Database connection failed'));

      mockSelect.mockReturnValueOnce({
        from: mockFrom,
      });
      mockFrom.mockReturnValueOnce({
        where: mockWhere,
      });
      mockWhere.mockReturnValueOnce({
        limit: mockLimit,
      });

      (db.select as any).mockReturnValueOnce({
        from: mockFrom,
      });

      // Act
      await requireSuperAdminEnhanced(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Admin authorization check failed'),
        })
      );
    });
  });
});

describe('Admin Request Headers Validation - verifyAdminRequestHeaders', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      path: '/admin/users',
      method: 'GET',
      ip: '192.168.1.1',
      get: vi.fn((header: string) => null),
    } as any;

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    next = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Content-Type validation', () => {
    it('should require Content-Type for POST requests', () => {
      // Arrange
      (req as any).method = 'POST';
      (req as any).get = vi.fn((header: string) => {
        if (header === 'content-type') return null; // Missing
        return 'Mozilla/5.0 Test';
      });

      // Act
      verifyAdminRequestHeaders(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('Content-Type must be application/json'),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should require Content-Type for PUT requests', () => {
      // Arrange
      (req as any).method = 'PUT';
      (req as any).get = vi.fn((header: string) => {
        if (header === 'content-type') return null;
        return 'Mozilla/5.0 Test';
      });

      // Act
      verifyAdminRequestHeaders(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should require Content-Type for DELETE requests', () => {
      // Arrange
      (req as any).method = 'DELETE';
      (req as any).get = vi.fn((header: string) => {
        if (header === 'content-type') return null;
        return 'Mozilla/5.0 Test';
      });

      // Act
      verifyAdminRequestHeaders(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject POST with wrong Content-Type', () => {
      // Arrange
      (req as any).method = 'POST';
      (req as any).get = vi.fn((header: string) => {
        if (header === 'content-type') return 'text/plain'; // Wrong type
        return 'Mozilla/5.0 Test';
      });

      // Act
      verifyAdminRequestHeaders(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept POST with application/json Content-Type', () => {
      // Arrange
      (req as any).method = 'POST';
      (req as any).get = vi.fn((header: string) => {
        if (header === 'content-type') return 'application/json';
        if (header === 'user-agent') return 'Mozilla/5.0 Test';
        return null;
      });

      // Act
      verifyAdminRequestHeaders(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should accept POST with application/json; charset=utf-8 Content-Type', () => {
      // Arrange
      (req as any).method = 'POST';
      (req as any).get = vi.fn((header: string) => {
        if (header === 'content-type') return 'application/json; charset=utf-8';
        if (header === 'user-agent') return 'Mozilla/5.0 Test';
        return null;
      });

      // Act
      verifyAdminRequestHeaders(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
    });

    it('should not require Content-Type for GET requests', () => {
      // Arrange
      (req as any).method = 'GET';
      (req as any).get = vi.fn((header: string) => {
        if (header === 'user-agent') return 'Mozilla/5.0 Test';
        return null; // No Content-Type
      });

      // Act
      verifyAdminRequestHeaders(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should not require Content-Type for HEAD requests', () => {
      // Arrange
      (req as any).method = 'HEAD';
      (req as any).get = vi.fn((header: string) => {
        if (header === 'user-agent') return 'Mozilla/5.0 Test';
        return null;
      });

      // Act
      verifyAdminRequestHeaders(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  describe('User-Agent validation', () => {
    it('should reject request without User-Agent header', () => {
      // Arrange
      (req as any).method = 'GET';
      (req as any).get = vi.fn((header: string) => null); // No User-Agent

      // Act
      verifyAdminRequestHeaders(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('User-Agent header required'),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept request with valid User-Agent', () => {
      // Arrange
      (req as any).method = 'GET';
      (req as any).get = vi.fn((header: string) => {
        if (header === 'user-agent') return 'Mozilla/5.0 Chrome/120.0 Test';
        return null;
      });

      // Act
      verifyAdminRequestHeaders(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });
});

describe('Admin Action Logging - logAdminAction', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let middleware: any;

  beforeEach(() => {
    req = {
      path: '/admin/users/ban',
      method: 'POST',
      ip: '192.168.1.1',
      params: { userId: 'user-123' },
      query: { sendNotification: 'true' },
    } as any;

    res = {} as any;
    next = vi.fn();

    middleware = logAdminAction('BAN_USER');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call next middleware', () => {
    // Act
    middleware(req as Request, res as Response, next);

    // Assert
    expect(next).toHaveBeenCalled();
  });

  it('should extract userId and email from request context and log them', () => {
    // Arrange
    (req as any).user = { userId: 'admin-456' };
    (req as any).adminUser = { email: 'admin@mtaadao.com' };

    // Get the global info mock from Logger class
    const mockLoggerInfo = (Logger as any).getMockInfo();
    mockLoggerInfo.mockClear(); // Clear any prior calls

    // Act
    middleware(req as Request, res as Response, next);

    // Assert
    expect(next).toHaveBeenCalled();
    // Verify the logger.info call captured userId and adminEmail
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'Admin action initiated',
      expect.objectContaining({
        actionType: 'BAN_USER',
        userId: 'admin-456',
        adminEmail: 'admin@mtaadao.com',
      })
    );
  });

  it('should use fallback values for missing user context', () => {
    // Arrange: no user/adminUser context
    (req as any).user = undefined;
    (req as any).adminUser = undefined;

    // Act
    middleware(req as Request, res as Response, next);

    // Assert
    expect(next).toHaveBeenCalled();
  });
});
