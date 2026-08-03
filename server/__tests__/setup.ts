import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { pool } from '../db';

let testClient: any;

beforeAll(async () => {
  // Try to connect to ensure DB is up
  testClient = await pool.connect();
});

afterAll(async () => {
  if (testClient) {
    testClient.release();
  }
  await pool.end();
});

beforeEach(async () => {
  // Start a transaction for each test
  await testClient.query('BEGIN');
  
  // Monkey-patch the pool to always return the transactional client
  // so that both Drizzle (which uses pool.query) and raw pg queries share the same transaction.
  vi.spyOn(pool, 'connect').mockResolvedValue(testClient);
  vi.spyOn(pool, 'query').mockImplementation(((text: any, params: any) => {
    return testClient.query(text, params);
  }) as any);
});

afterEach(async () => {
  // Rollback the transaction after each test to isolate state
  await testClient.query('ROLLBACK');
  vi.restoreAllMocks();
});
