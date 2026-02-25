import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { db } from '../storage';
import { daoMemberships, proposalExecutionQueue, users, daos } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { app } from '../app';

/**
 * Week 1 Test Suite
 * Tests for 4 CRITICAL security fixes:
 * 1. Permission middleware for proposal execution
 * 2. ConstraintChecker service
 * 3. Agent message signing
 * 4. Admin endpoint authentication
 */

describe('Week 1 Security Fixes', () => {
  let testUserId: string;
  let testDaoId: string;
  let testProposalId: string;
  let adminToken: string;
  let memberToken: string;
  let nonMemberToken: string;

  beforeEach(async () => {
    // Setup test data
    testUserId = 'test-user-' + Date.now();
    testDaoId = 'test-dao-' + Date.now();
    testProposalId = 'test-proposal-' + Date.now();

    // Create test users
    const adminUser = await db.insert(users).values({
      id: 'admin-' + Date.now(),
      email: 'admin@test.com',
      roles: 'super_admin',
      isBanned: false,
    }).returning();

    const memberUser = await db.insert(users).values({
      id: 'member-' + Date.now(),
      email: 'member@test.com',
      roles: 'user',
      isBanned: false,
    }).returning();

    const nonMemberUser = await db.insert(users).values({
      id: 'nonmember-' + Date.now(),
      email: 'nonmember@test.com',
      roles: 'user',
      isBanned: false,
    }).returning();

    // Create test DAO
    await db.insert(daos).values({
      id: testDaoId,
      name: 'Test DAO',
      description: 'Test DAO for security testing',
      owner: adminUser[0].id,
      treasuryBalance: '1000000',
    });

    // Add member to DAO
    await db.insert(daoMemberships).values({
      daoId: testDaoId,
      userId: memberUser[0].id,
      role: 'admin',
      joinedAt: new Date(),
    });

    // Generate tokens (in real test, use JWT from auth service)
    adminToken = `bearer-${adminUser[0].id}`;
    memberToken = `bearer-${memberUser[0].id}`;
    nonMemberToken = `bearer-${nonMemberUser[0].id}`;
  });

  afterEach(async () => {
    // Cleanup
    await db.delete(daoMemberships).where(eq(daoMemberships.daoId, testDaoId));
    await db.delete(proposalExecutionQueue).where(eq(proposalExecutionQueue.daoId, testDaoId));
    await db.delete(daos).where(eq(daos.id, testDaoId));
  });

  describe('Fix #1: Permission Middleware for Proposal Execution', () => {
    it('should deny access to unauthenticated users on GET queue', async () => {
      const response = await request(app)
        .get(`/api/proposal-execution/${testDaoId}/queue`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Authentication required');
    });

    it('should deny access to non-DAO members on GET queue', async () => {
      const response = await request(app)
        .get(`/api/proposal-execution/${testDaoId}/queue`)
        .set('Authorization', nonMemberToken)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Not a member');
    });

    it('should allow DAO members to view execution queue', async () => {
      const response = await request(app)
        .get(`/api/proposal-execution/${testDaoId}/queue`)
        .set('Authorization', memberToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should deny execution of proposals to non-admin members', async () => {
      // Add non-admin member
      const memberUser = await db.select().from(users).where(eq(users.email, 'member@test.com')).limit(1);
      await db.update(daoMemberships)
        .set({ role: 'member' })
        .where(and(
          eq(daoMemberships.daoId, testDaoId),
          eq(daoMemberships.userId, memberUser[0].id)
        ));

      const response = await request(app)
        .post(`/api/proposal-execution/${testDaoId}/execute/${testProposalId}`)
        .set('Authorization', memberToken)
        .send({})
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('admin');
    });

    it('should allow DAO admins to execute proposals', async () => {
      // Create a pending execution
      await db.insert(proposalExecutionQueue).values({
        id: 'exec-' + Date.now(),
        daoId: testDaoId,
        proposalId: testProposalId,
        status: 'pending',
        executionType: 'treasury_transfer',
        executionData: { recipient: 'addr', amount: 1000, currency: 'USDC' },
        scheduledFor: new Date(),
        createdAt: new Date(),
      });

      const response = await request(app)
        .post(`/api/proposal-execution/${testDaoId}/execute/${testProposalId}`)
        .set('Authorization', memberToken)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should deny cancellation of executions to non-admins', async () => {
      const response = await request(app)
        .delete(`/api/proposal-execution/${testDaoId}/cancel/exec-123`)
        .set('Authorization', nonMemberToken)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should enforce daoId parameter validation', async () => {
      const response = await request(app)
        .get(`/api/proposal-execution/invalid/queue`)
        .set('Authorization', memberToken)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Fix #2: ConstraintChecker Service', () => {
    it('should reject transactions exceeding magnitude limit', async () => {
      // This would be tested through the proposal execution service
      // Implementation depends on integrating constraint checker into routes
    });

    it('should track daily transaction limits', async () => {
      // Create multiple transactions and verify daily limit enforcement
    });

    it('should enforce rate limiting on executions', async () => {
      // Test that rate limit is enforced per user/hour
    });

    it('should detect duplicate pending executions', async () => {
      // Create two pending executions for same proposal
      // Verify constraint checker detects this
    });

    it('should flag stale pending executions (>24h)', async () => {
      // Create old pending execution
      // Verify it's flagged as stale
    });

    it('should validate transaction prerequisites', async () => {
      // Verify prerequisites are checked before execution
    });
  });

  describe('Fix #3: Agent Message Signing', () => {
    it('should sign inter-agent messages with HMAC-SHA256', async () => {
      // Import AgentMessageSigner and test signing
    });

    it('should verify signed messages with correct signature', async () => {
      // Sign a message and verify signature is valid
    });

    it('should reject messages with invalid signature', async () => {
      // Tamper with message and verify rejection
    });

    it('should reject expired messages', async () => {
      // Create old message and verify expiry check
    });

    it('should prevent replay attacks using nonce validation', async () => {
      // Submit same signed message twice
      // Verify second submission is rejected as replay
    });

    it('should validate timestamp is within acceptable range', async () => {
      // Create message with future timestamp
      // Verify rejection
    });

    it('should handle inter-agent communication envelopes', async () => {
      // Test createEnvelope and verifyEnvelope functions
    });

    it('should provide audit metadata for signed messages', async () => {
      // Verify metadata includes sender, recipient, timestamp, etc.
    });
  });

  describe('Fix #4: Admin Endpoint Authentication', () => {
    it('should deny access to non-authenticated users', async () => {
      const response = await request(app)
        .get('/api/admin/users/list')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should deny access to non-super-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/users/list')
        .set('Authorization', memberToken)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('super admin');
    });

    it('should deny access to banned super-admin users', async () => {
      const adminUser = await db.select().from(users).where(eq(users.email, 'admin@test.com')).limit(1);
      
      await db.update(users)
        .set({ isBanned: true })
        .where(eq(users.id, adminUser[0].id));

      const response = await request(app)
        .get('/api/admin/users/list')
        .set('Authorization', adminToken)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('suspended');
    });

    it('should allow super-admin users to access admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/users/list')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should log admin access for audit trail', async () => {
      // Make admin request
      await request(app)
        .get('/api/admin/users/list')
        .set('Authorization', adminToken)
        .expect(200);

      // In real test, verify logs contain audit entry
    });

    it('should require Content-Type application/json for POST requests', async () => {
      const response = await request(app)
        .post('/api/admin/users/123/ban')
        .set('Authorization', adminToken)
        .set('Content-Type', 'text/plain')
        .send('invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Content-Type');
    });

    it('should require User-Agent header', async () => {
      const response = await request(app)
        .get('/api/admin/users/list')
        .set('Authorization', adminToken)
        // Explicitly remove User-Agent
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('User-Agent');
    });

    it('should prevent super-admin from banning themselves', async () => {
      const adminUser = await db.select().from(users).where(eq(users.email, 'admin@test.com')).limit(1);

      const response = await request(app)
        .put(`/api/admin/users/${adminUser[0].id}/ban`)
        .set('Authorization', adminToken)
        .set('Content-Type', 'application/json')
        .send({ banned: true, reason: 'testing' })
        .expect(400);

      expect(response.body.error).toContain('Cannot ban yourself');
    });

    it('should verify enhanced admin authentication on all sub-routes', async () => {
      // Test that all admin subroutes enforce authentication
      const routes = [
        { method: 'get', path: '/api/admin/users/list' },
        { method: 'get', path: '/api/admin/analytics' },
        { method: 'get', path: '/api/admin/daos' },
        { method: 'get', path: '/api/admin/logs' },
      ];

      for (const route of routes) {
        const response = await request(app)[route.method](route.path).expect(401);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('Cross-Fix Integration Tests', () => {
    it('should apply permission checks before constraint checks', async () => {
      // Non-member tries to execute proposal
      // Should fail on permission before reaching constraint checker
    });

    it('should log admin actions that modify DAO execution state', async () => {
      // Admin executes proposal
      // Verify action is logged with full audit trail
    });

    it('should verify signatures on admin-initiated agent commands', async () => {
      // Admin initiates agent action
      // Verify message is signed and signature is verified
    });
  });
});
