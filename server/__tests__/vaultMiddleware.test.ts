/**
 * Vault Middleware Unit Tests
 * 
 * Tests for:
 * - vaultAccessGuard middleware
 * - vaultOperationGuard middleware  
 * - multisigEnforcer middleware
 * - Type constraint validators
 * - Permission matrix enforcement
 * 
 * ✅ PHASE 4B: Middleware validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Extend Request type to include custom properties
declare global {
  namespace Express {
    interface Request {
      vaultContext?: any;
      multisigData?: any;
    }
  }
}

// Mock config FIRST (before any imports that load it)
vi.mock('../../shared/config.ts', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret',
  },
}));

// Mock Drizzle ORM db - properly handle the chainable interface
vi.mock('../db', () => {
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    },
    default: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    },
  };
});

vi.mock('../utils/audit', () => ({
  default: {
    log: vi.fn(),
  },
}));

vi.mock('../utils/logger', () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  class MockLoggerClass {
    debug = vi.fn();
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    constructor(_name: string) {}
    static getLogger() {
      return mockLogger;
    }
  }
  return { Logger: MockLoggerClass };
});

// Import mocked modules
import { db } from '../db';
import {
  loadVaultContext,
  vaultAccessGuard,
  vaultOperationGuard,
  multisigEnforcer,
} from '../middleware/vaultOwnershipGuard';

import {
  validateVaultOperation,
  getConstraintRules,
  validateDeposit,
  validateWithdraw,
  validateAllocate,
  validateRebalance,
} from '../utils/vaultTypeValidators';

// ════════════════════════════════════════════════════════════════════════════════
// VAULT CONTEXT LOADING TESTS
// ════════════════════════════════════════════════════════════════════════════════

// Helper to set up mock return values for chained db calls
function setupDbMock(returnValues: any[]) {
  let callIndex = 0;

  const mockLimit = vi.fn().mockImplementation(() => {
    const result = returnValues[callIndex++];
    // Return as array if it's not already (Drizzle ORM returns arrays)
    return Promise.resolve(Array.isArray(result) ? result : (result ? [result] : []));
  });

  const mockWhere = vi.fn().mockReturnValue({
    limit: mockLimit,
  });

  const mockFrom = vi.fn().mockReturnValue({
    where: mockWhere,
    limit: mockLimit,
  });

  const mockSelect = vi.fn().mockReturnValue({
    from: mockFrom,
  });

  // Update the global db mock
  (db as any).select = mockSelect;
}

describe('loadVaultContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load user vault context', async () => {
    const mockVault = {
      id: 'vault_1',
      userId: 'user_1',
      daoId: null,
      vaultType: 'investment',
      isActive: true,
    };

    setupDbMock([mockVault]);

    const context = await loadVaultContext('vault_1', 'user_1');

    expect(context).toEqual({
      vaultId: 'vault_1',
      ownerType: 'user',
      ownerId: 'user_1',
      treasuryId: undefined,
      vaultType: 'investment',
      isActive: true,
    });
  });

  it('should load DAO vault context', async () => {
    const mockVault = {
      id: 'vault_1',
      userId: null,
      daoId: 'dao_1',
      vaultType: 'investment',
      isActive: true,
    };

    setupDbMock([mockVault]);

    const context = await loadVaultContext('vault_1', 'user_1');

    expect(context).toEqual(
      expect.objectContaining({
        vaultId: 'vault_1',
        ownerType: 'dao',
        ownerId: 'dao_1',
        vaultType: 'investment',
        isActive: true,
      })
    );
  });

  it('should return null for non-existent vault', async () => {
    setupDbMock([]);

    const context = await loadVaultContext('nonexistent', 'user_1');

    expect(context).toBeNull();
  });

  it('should load vault with correct structure', async () => {
    const mockVault = {
      id: 'vault_1',
      userId: 'user_1',
      daoId: null,
      vaultType: 'savings',
      isActive: true,
    };

    setupDbMock([mockVault]);

    const context = await loadVaultContext('vault_1', 'user_1');

    expect(context).toHaveProperty('vaultId', 'vault_1');
    expect(context).toHaveProperty('ownerType', 'user');
    expect(context).toHaveProperty('vaultType', 'savings');
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// VAULT ACCESS GUARD TESTS
// ════════════════════════════════════════════════════════════════════════════════

describe('vaultAccessGuard middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: { vaultId: 'vault_1' },
      user: { id: 'user_1' },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn() as NextFunction;
  });

  it('should allow access to own vault', async () => {
    const mockVault = {
      id: 'vault_1',
      userId: 'user_1',
      daoId: null,
      vaultType: 'investment',
      isActive: true,
    };

    setupDbMock([mockVault]);

    await vaultAccessGuard(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).vaultContext).toEqual(
      expect.objectContaining({
        vaultId: 'vault_1',
        ownerType: 'user',
      })
    );
  });

  it('should reject access to vault owned by different user', async () => {
    const mockVault = {
      id: 'vault_1',
      userId: 'user_2',
      daoId: null,
      vaultType: 'investment',
      isActive: true,
    };

    setupDbMock([mockVault]);

    await vaultAccessGuard(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow member access to DAO vault', async () => {
    const mockVault = {
      id: 'vault_1',
      userId: null,
      daoId: 'dao_1',
      vaultType: 'investment',
      isActive: true,
    };

    const mockMembership = {
      userId: 'user_1',
      daoId: 'dao_1',
      role: 'member',
    };

    setupDbMock([mockVault, mockMembership]);

    await vaultAccessGuard(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should reject non-member access to DAO vault', async () => {
    const mockVault = {
      id: 'vault_1',
      userId: null,
      daoId: 'dao_1',
      vaultType: 'investment',
      isActive: true,
    };

    setupDbMock([mockVault, []]); // No membership

    await vaultAccessGuard(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should require authentication', async () => {
    req.user = undefined;

    await vaultAccessGuard(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// VAULT OPERATION GUARD TESTS
// ════════════════════════════════════════════════════════════════════════════════

describe('vaultOperationGuard middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: { vaultId: 'vault_1' },
      user: { id: 'user_1' },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn() as NextFunction;
  });

  it('should allow owner to deposit', async () => {
    const middleware = vaultOperationGuard('deposit');

    const mockVault = {
      id: 'vault_1',
      userId: 'user_1',
      daoId: null,
      vaultType: 'investment',
      isActive: true,
    };

    setupDbMock([mockVault]);

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow elder to withdraw from DAO vault', async () => {
    const middleware = vaultOperationGuard('withdraw');

    const mockVault = {
      id: 'vault_1',
      userId: null,
      daoId: 'dao_1',
      vaultType: 'investment',
      isActive: true,
    };

    const mockMembership = {
      userId: 'user_1',
      daoId: 'dao_1',
      role: 'elder',
    };

    setupDbMock([mockVault, mockMembership]);

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should reject member from withdrawing DAO vault', async () => {
    const middleware = vaultOperationGuard('withdraw');

    const mockVault = {
      id: 'vault_1',
      userId: null,
      daoId: 'dao_1',
      vaultType: 'investment',
      isActive: true,
    };

    const mockMembership = {
      userId: 'user_1',
      daoId: 'dao_1',
      role: 'member',
    };

    setupDbMock([mockVault, mockMembership]);

    await middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow elder to allocate DAO vault', async () => {
    const middleware = vaultOperationGuard('allocate');

    const mockVault = {
      id: 'vault_1',
      userId: null,
      daoId: 'dao_1',
      vaultType: 'investment',
      isActive: true,
    };

    const mockMembership = {
      userId: 'user_1',
      daoId: 'dao_1',
      role: 'elder',
    };

    setupDbMock([mockVault, mockMembership]);

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should reject member from allocating DAO vault', async () => {
    const middleware = vaultOperationGuard('allocate');

    const mockVault = {
      id: 'vault_1',
      userId: null,
      daoId: 'dao_1',
      vaultType: 'investment',
      isActive: true,
    };

    const mockMembership = {
      userId: 'user_1',
      daoId: 'dao_1',
      role: 'member',
    };

    setupDbMock([mockVault, mockMembership]);

    await middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow admin to pause DAO vault', async () => {
    const middleware = vaultOperationGuard('pause');

    const mockVault = {
      id: 'vault_1',
      userId: null,
      daoId: 'dao_1',
      vaultType: 'investment',
      isActive: true,
    };

    const mockMembership = {
      userId: 'user_1',
      daoId: 'dao_1',
      role: 'admin',
    };

    setupDbMock([mockVault, mockMembership]);

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should reject elder from pausing DAO vault', async () => {
    const middleware = vaultOperationGuard('pause');

    const mockVault = {
      id: 'vault_1',
      userId: null,
      daoId: 'dao_1',
      vaultType: 'investment',
      isActive: true,
    };

    const mockMembership = {
      userId: 'user_1',
      daoId: 'dao_1',
      role: 'elder',
    };

    setupDbMock([mockVault, mockMembership]);

    await middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject member from pausing DAO vault', async () => {
    const middleware = vaultOperationGuard('pause');

    const mockVault = {
      id: 'vault_1',
      userId: null,
      daoId: 'dao_1',
      vaultType: 'investment',
      isActive: true,
    };

    const mockMembership = {
      userId: 'user_1',
      daoId: 'dao_1',
      role: 'member',
    };

    setupDbMock([mockVault, mockMembership]);

    await middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow member to deposit to DAO vault', async () => {
    const middleware = vaultOperationGuard('deposit');

    const mockVault = {
      id: 'vault_1',
      userId: null,
      daoId: 'dao_1',
      vaultType: 'investment',
      isActive: true,
    };

    const mockMembership = {
      userId: 'user_1',
      daoId: 'dao_1',
      role: 'member',
    };

    setupDbMock([mockVault, mockMembership]);

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should reject operation on inactive vault', async () => {
    const middleware = vaultOperationGuard('deposit');

    const mockVault = {
      id: 'vault_1',
      userId: 'user_1',
      daoId: null,
      vaultType: 'investment',
      isActive: false,
    };

    setupDbMock([mockVault]);

    await middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// MULTISIG ENFORCER TESTS
// ════════════════════════════════════════════════════════════════════════════════

describe('multisigEnforcer middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: { vaultId: 'vault_1' },
      user: { id: 'user_1' },
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn() as NextFunction;
  });

  it('should allow operation when multisig not required', async () => {
    (req as any).vaultContext = {
      requiresMultisig: false,
    };

    await multisigEnforcer(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should require multisig when context indicates it', async () => {
    (req as any).vaultContext = {
      requiresMultisig: true,
      multisigThreshold: 2,
    };

    (req as any).body = {};

    await multisigEnforcer(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should accept multisig signature and approvers', async () => {
    (req as any).vaultContext = {
      requiresMultisig: true,
      multisigThreshold: 2,
    };

    (req as any).body = {
      multisigSignature: 'sig_xyz',
      multisigApprovers: ['user_1', 'user_2'],
    };

    await multisigEnforcer(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).multisigData).toBeDefined();
    expect((req as any).multisigData.signature).toBe('sig_xyz');
  });

  it('should reject insufficient approvers', async () => {
    (req as any).vaultContext = {
      requiresMultisig: true,
      multisigThreshold: 3,
    };

    (req as any).body = {
      multisigSignature: 'sig_xyz',
      multisigApprovers: ['user_1', 'user_2'],
    };

    await multisigEnforcer(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should handle missing vault context', async () => {
    req.vaultContext = undefined;

    await multisigEnforcer(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// TYPE VALIDATOR TESTS
// ════════════════════════════════════════════════════════════════════════════════

describe('Vault Type Validators', () => {
  describe('validateVaultOperation', () => {
    it('should validate correct operations for vault types', () => {
      // Investment vault allows all operations
      expect(validateVaultOperation('investment', 'deposit')).toEqual({ allowed: true });
      expect(validateVaultOperation('investment', 'withdraw')).toEqual({ allowed: true });
      expect(validateVaultOperation('investment', 'allocate')).toEqual({ allowed: true });

      // Savings vault only allows deposit
      expect(validateVaultOperation('savings', 'deposit')).toEqual({ allowed: true });
      expect(validateVaultOperation('savings', 'withdraw')).toEqual(expect.objectContaining({
        allowed: false,
      }));
      expect(validateVaultOperation('savings', 'allocate')).toEqual(expect.objectContaining({
        allowed: false,
      }));

      // Escrow vault only allows deposit
      expect(validateVaultOperation('escrow', 'deposit')).toEqual({ allowed: true });
      expect(validateVaultOperation('escrow', 'withdraw')).toEqual(expect.objectContaining({
        allowed: false,
      }));
    });

    it('should reject unknown operations', () => {
      const result = validateVaultOperation('investment', 'unknown' as any);
      expect(result.allowed).toBe(false);
    });
  });

  describe('getConstraintRules', () => {
    it('should return rules for investment vault', () => {
      const rules = getConstraintRules('investment');

      expect(rules).toEqual({
        allowDeposit: true,
        allowWithdraw: true,
        allowAllocate: true,
        allowRebalance: true,
        requiresApproval: false,
        requiresMultisig: false,
        minWithdrawalAmount: 0,
      });
    });

    it('should return rules for savings vault', () => {
      const rules = getConstraintRules('savings');

      expect(rules).toEqual(expect.objectContaining({
        allowDeposit: true,
        allowWithdraw: false,
        allowAllocate: false,
        allowRebalance: false,
        minLockDuration: 1 * 24 * 60 * 60 * 1000,
        maxLockDuration: 365 * 24 * 60 * 60 * 1000,
      }));
    });

    it('should return rules for investment-pool', () => {
      const rules = getConstraintRules('investment-pool');

      expect(rules).toEqual(expect.objectContaining({
        allowDeposit: true,
        allowWithdraw: true,
        allowAllocate: false,
        allowRebalance: false,
        maxMembers: 100,
        requiresApproval: true,
        requiresMultisig: true,
      }));
    });
  });

  describe('Individual validators', () => {
    it('validateDeposit should allow deposits for all types', () => {
      // All types allow deposit
      expect(validateDeposit('investment')).toBe(true);
      expect(validateDeposit('savings')).toBe(true);
      expect(validateDeposit('escrow')).toBe(true);
      expect(validateDeposit('strategy')).toBe(true);
      expect(validateDeposit('custom')).toBe(true);
    });

    it('validateWithdraw should only allow for specific types', () => {
      // Allow: investment, strategy, investment-pool, custom
      expect(validateWithdraw('investment')).toBe(true);
      expect(validateWithdraw('strategy')).toBe(true);
      expect(validateWithdraw('investment-pool')).toBe(true);
      expect(validateWithdraw('custom')).toBe(true);
      
      // Disallow: savings, escrow, deployment
      expect(validateWithdraw('savings')).toBe(false);
      expect(validateWithdraw('escrow')).toBe(false);
      expect(validateWithdraw('deployment')).toBe(false);
    });

    it('validateAllocate should only allow for specific types', () => {
      expect(validateAllocate('investment')).toBe(true);
      expect(validateAllocate('custom')).toBe(true);
      
      // Disallow: savings, strategy, investment-pool, escrow, deployment
      expect(validateAllocate('savings')).toBe(false);
      expect(validateAllocate('strategy')).toBe(false);
      expect(validateAllocate('investment-pool')).toBe(false);
      expect(validateAllocate('escrow')).toBe(false);
      expect(validateAllocate('deployment')).toBe(false);
    });

    it('validateRebalance should only allow for specific types', () => {
      expect(validateRebalance('investment')).toBe(true);
      expect(validateRebalance('custom')).toBe(true);
      
      // Disallow: savings, strategy, investment-pool, escrow, deployment
      expect(validateRebalance('savings')).toBe(false);
      expect(validateRebalance('strategy')).toBe(false);
      expect(validateRebalance('investment-pool')).toBe(false);
      expect(validateRebalance('escrow')).toBe(false);
      expect(validateRebalance('deployment')).toBe(false);
    });
  });

  describe('Type constraint enforcement', () => {
    const typeConstraints = [
      {
        type: 'savings',
        description: 'Savings account with lock duration',
        operations: {
          deposit: true,
          withdraw: false,
          allocate: false,
          rebalance: false,
        },
      },
      {
        type: 'investment',
        description: 'Full control investment vault',
        operations: {
          deposit: true,
          withdraw: true,
          allocate: true,
          rebalance: true,
        },
      },
      {
        type: 'strategy',
        description: 'Auto-managed strategy vault',
        operations: {
          deposit: true,
          withdraw: true,
          allocate: false,
          rebalance: false,
        },
      },
      {
        type: 'escrow',
        description: 'Condition-locked escrow',
        operations: {
          deposit: true,
          withdraw: false,
          allocate: false,
          rebalance: false,
        },
      },
      {
        type: 'deployment',
        description: 'Smart contract deployment fund',
        operations: {
          deposit: true,
          withdraw: false,
          allocate: false,
          rebalance: false,
        },
      },
      {
        type: 'investment-pool',
        description: 'Multi-member investment pool',
        operations: {
          deposit: true,
          withdraw: true,
          allocate: false,
          rebalance: false,
        },
      },
      {
        type: 'custom',
        description: 'Fully customizable vault',
        operations: {
          deposit: true,
          withdraw: true,
          allocate: true,
          rebalance: true,
        },
      },
    ];

    typeConstraints.forEach(({ type, operations }) => {
      describe(`${type} vault constraints`, () => {
        Object.entries(operations).forEach(([operation, allowed]) => {
          it(`should ${allowed ? 'allow' : 'reject'} ${operation}`, () => {
            const validator = {
              deposit: () => validateDeposit(type as any),
              withdraw: () => validateWithdraw(type as any),
              allocate: () => validateAllocate(type as any),
              rebalance: () => validateRebalance(type as any),
            }[operation as keyof typeof operations];

            if (validator) {
              expect(validator()).toBe(allowed);
            }
          });
        });
      });
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// PERMISSION MATRIX EXHAUSTIVE TESTS
// ════════════════════════════════════════════════════════════════════════════════

describe('Permission Matrix Enforcement', () => {
  // Verify constraint rules are properly defined
  it('should enforce permission matrix for all vault types', () => {
    const vaultTypes: Array<'savings' | 'investment' | 'strategy' | 'investment-pool' | 'escrow' | 'deployment' | 'custom'> = [
      'savings',
      'investment',
      'strategy',
      'investment-pool',
      'escrow',
      'deployment',
      'custom',
    ];

    const expectedPermissions = {
      'savings': { deposit: true, withdraw: false, allocate: false, rebalance: false },
      'investment': { deposit: true, withdraw: true, allocate: true, rebalance: true },
      'strategy': { deposit: true, withdraw: true, allocate: false, rebalance: false },
      'investment-pool': { deposit: true, withdraw: true, allocate: false, rebalance: false },
      'escrow': { deposit: true, withdraw: false, allocate: false, rebalance: false },
      'deployment': { deposit: true, withdraw: false, allocate: false, rebalance: false },
      'custom': { deposit: true, withdraw: true, allocate: true, rebalance: true },
    };

    vaultTypes.forEach((vaultType) => {
      const expected = expectedPermissions[vaultType];
      expect(validateDeposit(vaultType)).toBe(expected.deposit);
      expect(validateWithdraw(vaultType)).toBe(expected.withdraw);
      expect(validateAllocate(vaultType)).toBe(expected.allocate);
      expect(validateRebalance(vaultType)).toBe(expected.rebalance);
    });
  });
});
