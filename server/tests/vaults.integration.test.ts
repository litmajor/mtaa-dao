/**
 * Vault System Integration Tests
 * 
 * Tests for user and DAO vault workflows including:
 * - Deposit operations
 * - Withdrawal operations  
 * - Allocations
 * - Rebalancing
 * - Type constraints
 * - Permission enforcement
 * 
 * ✅ PHASE 4B: Comprehensive testing suite
 */

import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock setup
let app: any;
let testUserId: string;
let testDaoId: string;
let testVaultId: string;
let authToken: string;

// Test utilities
const createTestUser = async (email: string) => {
  const res = await request(app)
    .post('/auth/register')
    .send({ email, password: 'test123' });
  return res.body.userId;
};

const createTestDao = async (name: string, adminId: string) => {
  const res = await request(app)
    .post('/daos')
    .set('Authorization', `Bearer ${authToken}`)
    .send({ name, adminId });
  return res.body.daoId;
};

const createTestVault = async (vaultType: string, ownerId?: string, isDao: boolean = false) => {
  const url = isDao ? `/v1/daos/${testDaoId}/treasury/vaults` : '/api/vaults';
  const res = await request(app)
    .post(url)
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      name: `Test ${vaultType} Vault`,
      description: 'Test vault',
      vaultType,
      currency: 'cUSD',
      initialBalance: '1000',
    });
  return res.body.id || res.body.vaultId;
};

// ════════════════════════════════════════════════════════════════════════════════
// USER VAULT TESTS
// ════════════════════════════════════════════════════════════════════════════════

describe('User Vault Workflows', () => {
  beforeEach(async () => {
    testUserId = await createTestUser('user@test.com');
    authToken = await getAuthToken(testUserId);
    testVaultId = await createTestVault('investment', testUserId);
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // DEPOSIT TESTS
  // ────────────────────────────────────────────────────────────────────────────────

  describe('POST /api/vaults/:vaultId/deposit', () => {
    it('should allow user to deposit to own vault', async () => {
      const res = await request(app)
        .post(`/api/vaults/${testVaultId}/deposit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: '100',
          tokenSymbol: 'cUSD',
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('vaultId', testVaultId);
      expect(res.body.data).toHaveProperty('depositAmount', '100');
      expect(res.body.data).toHaveProperty('sharesReceived');
    });

    it('should reject unauthenticated deposit', async () => {
      const res = await request(app)
        .post(`/api/vaults/${testVaultId}/deposit`)
        .send({
          amount: '100',
          tokenSymbol: 'cUSD',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/authentication/i);
    });

    it('should reject invalid amount', async () => {
      const res = await request(app)
        .post(`/api/vaults/${testVaultId}/deposit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: '-100',
          tokenSymbol: 'cUSD',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/valid amount/i);
    });

    it('should reject deposit to non-existent vault', async () => {
      const res = await request(app)
        .post('/api/vaults/nonexistent/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: '100',
          tokenSymbol: 'cUSD',
        });

      expect(res.status).toMatch(/401|403|404/);
    });

    it('should reject deposit to inactive vault', async () => {
      // First pause the vault
      await request(app)
        .put(`/api/vaults/${testVaultId}/pause`)
        .set('Authorization', `Bearer ${authToken}`);

      const res = await request(app)
        .post(`/api/vaults/${testVaultId}/deposit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: '100',
          tokenSymbol: 'cUSD',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not active/i);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // WITHDRAWAL TESTS
  // ────────────────────────────────────────────────────────────────────────────────

  describe('POST /api/vaults/:vaultId/withdraw', () => {
    beforeEach(async () => {
      // Deposit first
      await request(app)
        .post(`/api/vaults/${testVaultId}/deposit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: '100',
          tokenSymbol: 'cUSD',
        });
    });

    it('should allow user to withdraw from own vault', async () => {
      const res = await request(app)
        .post(`/api/vaults/${testVaultId}/withdraw`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shares: 50,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('withdrawalAmount');
    });

    it('should reject withdrawal of more shares than held', async () => {
      const res = await request(app)
        .post(`/api/vaults/${testVaultId}/withdraw`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shares: 99999,
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid shares amount', async () => {
      const res = await request(app)
        .post(`/api/vaults/${testVaultId}/withdraw`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shares: -10,
        });

      expect(res.status).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // ALLOCATION TESTS
  // ────────────────────────────────────────────────────────────────────────────────

  describe('POST /api/vaults/:vaultId/allocate', () => {
    it('should allow allocation to investment vault', async () => {
      const res = await request(app)
        .post(`/api/vaults/${testVaultId}/allocate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: '500',
          currency: 'cUSD',
          assetId: 'asset_eth_mainnet',
        });

      expect(res.status).toBe(200);
      expect(res.body.allocation).toHaveProperty('transactionId');
      expect(res.body.allocation).toHaveProperty('allocatedAt');
    });

    it('should reject allocation to savings vault', async () => {
      const savingsVaultId = await createTestVault('savings', testUserId);

      const res = await request(app)
        .post(`/api/vaults/${savingsVaultId}/allocate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: '500',
          currency: 'cUSD',
          assetId: 'asset_eth',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/savings vault/i);
    });

    it('should require amount and currency', async () => {
      const res = await request(app)
        .post(`/api/vaults/${testVaultId}/allocate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          assetId: 'asset_eth',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/amount|currency/i);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // REBALANCE TESTS
  // ────────────────────────────────────────────────────────────────────────────────

  describe('POST /api/vaults/:vaultId/rebalance', () => {
    it('should allow rebalancing investment vault', async () => {
      const res = await request(app)
        .post(`/api/vaults/${testVaultId}/rebalance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetAllocations: {
            ETH: 50,
            USDC: 30,
            DAI: 20,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.rebalance).toHaveProperty('rebalanceId');
      expect(res.body.rebalance).toHaveProperty('targetAllocations');
    });

    it('should reject rebalancing with invalid total', async () => {
      const res = await request(app)
        .post(`/api/vaults/${testVaultId}/rebalance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetAllocations: {
            ETH: 50,
            USDC: 30,
            // Total = 80, should be 100
          },
        });

      expect(res.status).toBe(400);
    });

    it('should reject rebalancing savings vault', async () => {
      const savingsVaultId = await createTestVault('savings', testUserId);

      const res = await request(app)
        .post(`/api/vaults/${savingsVaultId}/rebalance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetAllocations: {
            ETH: 100,
          },
        });

      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // CONTROL TESTS
  // ────────────────────────────────────────────────────────────────────────────────

  describe('Vault Control Operations', () => {
    it('should allow pause on own vault', async () => {
      const res = await request(app)
        .put(`/api/vaults/${testVaultId}/pause`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('should allow resume on own vault', async () => {
      // First pause
      await request(app)
        .put(`/api/vaults/${testVaultId}/pause`)
        .set('Authorization', `Bearer ${authToken}`);

      // Then resume
      const res = await request(app)
        .put(`/api/vaults/${testVaultId}/resume`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // READ TESTS
  // ────────────────────────────────────────────────────────────────────────────────

  describe('Vault Information Endpoints', () => {
    it('should retrieve vault details', async () => {
      const res = await request(app)
        .get(`/api/vaults/${testVaultId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('vaultId', testVaultId);
      expect(res.body.data).toHaveProperty('totalValue');
    });

    it('should retrieve user position in vault', async () => {
      // Deposit first
      await request(app)
        .post(`/api/vaults/${testVaultId}/deposit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: '100', tokenSymbol: 'cUSD' });

      const res = await request(app)
        .get(`/api/vaults/${testVaultId}/my-position`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('shares');
      expect(res.body.data).toHaveProperty('currentValue');
    });

    it('should retrieve vault positions', async () => {
      const res = await request(app)
        .get(`/api/vaults/${testVaultId}/positions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should retrieve vault performance', async () => {
      const res = await request(app)
        .get(`/api/vaults/${testVaultId}/performance`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ days: '30' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('performance');
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// TYPE CONSTRAINT TESTS
// ════════════════════════════════════════════════════════════════════════════════

describe('Vault Type Constraints', () => {
  beforeEach(async () => {
    testUserId = await createTestUser('typetest@test.com');
    authToken = await getAuthToken(testUserId);
  });

  describe('Vault Type Operations', () => {
    const testCases = [
      {
        type: 'savings',
        allowDeposit: true,
        allowWithdraw: false,
        allowAllocate: false,
        allowRebalance: false,
      },
      {
        type: 'investment',
        allowDeposit: true,
        allowWithdraw: true,
        allowAllocate: true,
        allowRebalance: true,
      },
      {
        type: 'strategy',
        allowDeposit: true,
        allowWithdraw: true,
        allowAllocate: false,
        allowRebalance: false,
      },
      {
        type: 'custom',
        allowDeposit: true,
        allowWithdraw: true,
        allowAllocate: true,
        allowRebalance: true,
      },
    ];

    testCases.forEach(({ type, allowDeposit, allowWithdraw, allowAllocate, allowRebalance }) => {
      describe(`${type} vault`, () => {
        let vaultId: string;

        beforeEach(async () => {
          vaultId = await createTestVault(type, testUserId);
        });

        if (allowDeposit) {
          it('should allow deposit', async () => {
            const res = await request(app)
              .post(`/api/vaults/${vaultId}/deposit`)
              .set('Authorization', `Bearer ${authToken}`)
              .send({ amount: '100', tokenSymbol: 'cUSD' });
            expect(res.status).toBe(200);
          });
        }

        if (!allowAllocate) {
          it('should reject allocation', async () => {
            const res = await request(app)
              .post(`/api/vaults/${vaultId}/allocate`)
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                amount: '100',
                currency: 'cUSD',
                assetId: 'asset_eth',
              });
            expect(res.status).toMatch(/403|400/);
          });
        }

        if (!allowRebalance) {
          it('should reject rebalance', async () => {
            const res = await request(app)
              .post(`/api/vaults/${vaultId}/rebalance`)
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                targetAllocations: { ETH: 100 },
              });
            expect(res.status).toMatch(/403|400/);
          });
        }
      });
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// PERMISSION TESTS
// ════════════════════════════════════════════════════════════════════════════════

describe('Vault Permission Enforcement', () => {
  let user1Id: string;
  let user2Id: string;
  let user1Token: string;
  let user2Token: string;
  let vault1Id: string;

  beforeEach(async () => {
    user1Id = await createTestUser('user1@test.com');
    user2Id = await createTestUser('user2@test.com');
    user1Token = await getAuthToken(user1Id);
    user2Token = await getAuthToken(user2Id);
    vault1Id = await createTestVault('investment', user1Id);
  });

  it('should reject access to vault by different user', async () => {
    const res = await request(app)
      .get(`/api/vaults/${vault1Id}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(403);
  });

  it('should reject deposit to vault by different user', async () => {
    const res = await request(app)
      .post(`/api/vaults/${vault1Id}/deposit`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ amount: '100', tokenSymbol: 'cUSD' });

    expect(res.status).toBe(403);
  });

  it('should allow owner full access', async () => {
    const res = await request(app)
      .get(`/api/vaults/${vault1Id}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// DAO VAULT TESTS
// ════════════════════════════════════════════════════════════════════════════════

describe('DAO Vault Workflows', () => {
  let daoAdminId: string;
  let daoMemberId: string;
  let daoId: string;
  let adminToken: string;
  let memberToken: string;
  let daoVaultId: string;

  beforeEach(async () => {
    daoAdminId = await createTestUser('daoadmin@test.com');
    daoMemberId = await createTestUser('daomember@test.com');
    adminToken = await getAuthToken(daoAdminId);
    memberToken = await getAuthToken(daoMemberId);

    daoId = await createTestDao('Test DAO', daoAdminId);
    // Add member to DAO
    await addDaoMember(daoId, daoMemberId, adminToken);

    daoVaultId = await createTestVault('investment', daoId, true);
  });

  describe('DAO Vault Allocate', () => {
    it('should allow admin to allocate funds', async () => {
      const res = await request(app)
        .post(`/v1/daos/${daoId}/treasury/vaults/${daoVaultId}/allocate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: '5000',
          currency: 'cUSD',
          strategyId: 'yield_strategy_1',
        });

      expect(res.status).toBe(200);
      expect(res.body.allocation).toHaveProperty('transactionId');
    });

    it('should reject member allocate', async () => {
      const res = await request(app)
        .post(`/v1/daos/${daoId}/treasury/vaults/${daoVaultId}/allocate`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          amount: '5000',
          currency: 'cUSD',
        });

      expect(res.status).toMatch(/403|401/);
    });
  });

  describe('DAO Vault Rebalance', () => {
    it('should allow admin to rebalance', async () => {
      const res = await request(app)
        .post(`/v1/daos/${daoId}/treasury/vaults/${daoVaultId}/rebalance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          newAllocation: {
            USDC: 50,
            DAI: 30,
            cEUR: 20,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.rebalance).toHaveProperty('rebalanceId');
    });

    it('should reject member rebalance', async () => {
      const res = await request(app)
        .post(`/v1/daos/${daoId}/treasury/vaults/${daoVaultId}/rebalance`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          newAllocation: { USDC: 100 },
        });

      expect(res.status).toMatch(/403|401/);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// TEST HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════════

async function getAuthToken(userId: string): Promise<string> {
  // This should be implemented with your auth service
  // For now, return a mock token
  return `token_${userId}`;
}

async function addDaoMember(daoId: string, userId: string, adminToken: string): Promise<void> {
  await request(app)
    .post(`/v1/daos/${daoId}/members`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ userId, role: 'member' });
}
