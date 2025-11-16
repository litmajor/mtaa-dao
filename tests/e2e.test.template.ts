/**
 * End-to-End (E2E) Test Template for MtaaDAO API
 * 
 * E2E tests verify complete workflows across multiple API endpoints.
 * Uses supertest for HTTP testing and real or test database.
 * 
 * Best practices:
 * - Test complete user workflows
 * - Use test fixtures and seed data
 * - Clean up test data after each test
 * - Test error scenarios
 * - Use meaningful assertions
 */

import request from 'supertest';

describe('MtaaDAO API E2E Tests', () => {
  const API_URL = process.env.API_URL || 'http://localhost:4000';
  let authToken: string;
  let userId: string;
  let proposalId: string;

  describe('Authentication Flow', () => {
    it('should register a new user', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@mtaadao.org',
          password: 'SecurePassword123!',
          name: 'Test User',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('test@mtaadao.org');
      
      userId = response.body.user.id;
      authToken = response.body.token;
    });

    it('should login with correct credentials', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@mtaadao.org',
          password: 'SecurePassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.token).toBeTruthy();
    });

    it('should reject login with incorrect password', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@mtaadao.org',
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should refresh access token', async () => {
      const loginResponse = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@mtaadao.org',
          password: 'SecurePassword123!',
        });

      const refreshResponse = await request(API_URL)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${loginResponse.body.refreshToken}`);

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body).toHaveProperty('token');
    });
  });

  describe('Proposal Workflow', () => {
    it('should create a new proposal', async () => {
      const response = await request(API_URL)
        .post('/api/v1/proposals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Allocate Funds for Development',
          description: 'This proposal aims to allocate 100,000 tokens for development',
          votingPeriodDays: 7,
          proposedAmount: 100000,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Allocate Funds for Development');
      expect(response.body.status).toBe('draft');
      
      proposalId = response.body.id;
    });

    it('should reject proposal with missing title', async () => {
      const response = await request(API_URL)
        .post('/api/v1/proposals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Description without title',
          votingPeriodDays: 7,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should retrieve proposal by ID', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/proposals/${proposalId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(proposalId);
    });

    it('should list all proposals', async () => {
      const response = await request(API_URL)
        .get('/api/v1/proposals')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.proposals)).toBe(true);
      expect(response.body.proposals.length).toBeGreaterThan(0);
    });

    it('should publish proposal (transition to active)', async () => {
      const response = await request(API_URL)
        .post(`/api/v1/proposals/${proposalId}/publish`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('active');
    });
  });

  describe('Voting Flow', () => {
    it('should cast a vote on active proposal', async () => {
      const response = await request(API_URL)
        .post(`/api/v1/proposals/${proposalId}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          voteType: 'yes',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.voteType).toBe('yes');
    });

    it('should prevent duplicate votes from same user', async () => {
      const response = await request(API_URL)
        .post(`/api/v1/proposals/${proposalId}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          voteType: 'no',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already voted');
    });

    it('should retrieve vote counts', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/proposals/${proposalId}/votes`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('yes');
      expect(response.body).toHaveProperty('no');
      expect(response.body).toHaveProperty('abstain');
    });

    it('should prevent voting with invalid vote type', async () => {
      // Create another proposal first
      const proposalResponse = await request(API_URL)
        .post('/api/v1/proposals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Another Proposal',
          description: 'Test',
          votingPeriodDays: 7,
        });

      const newProposalId = proposalResponse.body.id;

      // Publish it
      await request(API_URL)
        .post(`/api/v1/proposals/${newProposalId}/publish`)
        .set('Authorization', `Bearer ${authToken}`);

      // Try invalid vote
      const response = await request(API_URL)
        .post(`/api/v1/proposals/${newProposalId}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          voteType: 'maybe', // Invalid
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Treasury Operations', () => {
    it('should retrieve treasury balance', async () => {
      const response = await request(API_URL)
        .get('/api/v1/treasury/balance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('balance');
      expect(typeof response.body.balance).toBe('number');
    });

    it('should retrieve treasury transactions', async () => {
      const response = await request(API_URL)
        .get('/api/v1/treasury/transactions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.transactions)).toBe(true);
    });
  });

  describe('User Profile Operations', () => {
    it('should retrieve user profile', async () => {
      const response = await request(API_URL)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('test@mtaadao.org');
    });

    it('should update user profile', async () => {
      const response = await request(API_URL)
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Name',
          bio: 'Updated bio',
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
    });

    it('should prevent access without authentication', async () => {
      const response = await request(API_URL)
        .get('/api/v1/users/profile');

      expect(response.status).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting', async () => {
      const requests = [];
      
      // Send 101 requests (assuming limit is 100 per minute)
      for (let i = 0; i < 101; i++) {
        requests.push(
          request(API_URL)
            .get('/api/v1/proposals')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses[responses.length - 1];

      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.body.error).toContain('rate limit');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent proposal', async () => {
      const response = await request(API_URL)
        .get('/api/v1/proposals/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for malformed request', async () => {
      const response = await request(API_URL)
        .post('/api/v1/proposals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 123, // Should be string
          description: 'Test',
        });

      expect(response.status).toBe(400);
    });

    it('should return 403 for unauthorized action', async () => {
      // Try to delete another user's proposal (if applicable)
      const response = await request(API_URL)
        .delete(`/api/v1/proposals/${proposalId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should be forbidden for non-creator
      expect([403, 400]).toContain(response.status);
    });
  });
});
