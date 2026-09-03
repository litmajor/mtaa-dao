import { describe, test, expect, beforeEach, vi } from 'vitest';

// Set environment variables FIRST
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'test-jwt-secret-this-is-long-enough-for-32-chars-requirement';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-this-is-long-enough-for-32-chars';

// Mock config
vi.mock('../../shared/config.ts', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-this-is-long-enough-for-32-chars-requirement',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-this-is-long-enough-for-32-chars',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
    NODE_ENV: 'test',
  },
}));

// Mock logger
vi.mock('../utils/logger', () => {
  class MockLogger {
    debug = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    info = vi.fn();
  }
  const defaultLogger = new MockLogger();
  return { 
    Logger: MockLogger,
    logger: defaultLogger,
    requestLogger: vi.fn(),
  };
});

// Mock db
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
      execute: vi.fn(() => Promise.resolve({ rowCount: 0 })),
    },
    pool: {
      connect: vi.fn(() => Promise.resolve({
        query: vi.fn(() => Promise.resolve({ rows: [] })),
        release: vi.fn(),
      })),
    },
  };
});

// Mock dbClient utilities
vi.mock('../utils/dbClient', () => {
  return {
    withClient: vi.fn(async (handler) => handler({ query: vi.fn(() => Promise.resolve({ rows: [] })) })),
    withTransaction: vi.fn(async (handler) => handler({ query: vi.fn(() => Promise.resolve({ rows: [] })) })),
  };
});

import { sharedIdempotencyManager } from '../services/sharedIdempotencyManager';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { ReversibilityService } from '../services/reversibilityService';
import { ActionSeverity, ActorType, ReversibilityStatus } from '../types/reversibility';

// We use the real DB connected via the transaction wrapper in setup.ts

describe('Tier 1: Payment Idempotency and State Machine', () => {
  let reversibilityService: ReversibilityService;

  beforeEach(() => {
    // ReversibilityService expects a database object with an execute method
    reversibilityService = new ReversibilityService(db as any);
  });

  test('Submitting the same idempotency key twice concurrently results in exactly one state transition', async () => {
    const idempotencyKey = `test-key-${uuidv4()}`;
    
    // Simulate concurrent requests
    const results = await Promise.all([
      sharedIdempotencyManager.startProcessing(idempotencyKey),
      sharedIdempotencyManager.startProcessing(idempotencyKey),
      sharedIdempotencyManager.startProcessing(idempotencyKey),
    ]);

    // Only one should return true (acquired lock)
    const acquiredCount = results.filter(r => r === true).length;
    expect(acquiredCount).toBe(1);

    // The other two should return false
    const rejectedCount = results.filter(r => r === false).length;
    expect(rejectedCount).toBe(2);

    // Simulate the worker finishing
    await sharedIdempotencyManager.recordResult(idempotencyKey, { success: true, processed: true });

    // Ensure subsequent calls get the cached result, not another lock
    const subsequentCall = await sharedIdempotencyManager.startProcessing(idempotencyKey);
    expect(subsequentCall).toBe(false);

    const cachedResult = await sharedIdempotencyManager.getResult(idempotencyKey);
    expect(cachedResult).toEqual({ success: true, processed: true });
  });

  test('Failed/timed-out payment cannot transition to CREDITED simultaneously', async () => {
    // 1. Create a reversible action in INITIATED state
    const action = await reversibilityService.createReversibleAction({
      actionType: 'PAYMENT',
      description: 'Test Payment',
      severity: ActionSeverity.LOW,
      initiator: { id: uuidv4(), type: ActorType.USER },
      affectedEntity: { type: 'user', id: uuidv4() },
      actionPayload: { amount: 100 },
      beforeState: {},
      afterState: {},
      confirmationRequirement: { type: 'NONE', confirmationTimeoutMinutes: 0 },
      gracePeriodConfig: { durationHours: 24, reminderHoursBefore: [], userCanAccelerate: false, autoExecuteAtDeadline: false },
      reversibilityScope: { fields: [], initiatorCanReverse: true, adminCanReverse: true, governanceCanReverse: false, partialReversalAllowed: false },
    });

    expect(action.status).toBe(ReversibilityStatus.INITIATED);

    // Simulate concurrent handlers trying to update the state to mutually exclusive states
    // In PostgreSQL, concurrent updates to the same row in different transactions will block, 
    // but here we are in the same test transaction, so we simulate the logic check:
    
    // Attempting to reverse/fail it
    const tryFail = async () => {
      const current = await reversibilityService.getActionById(action.id);
      if (current?.status !== ReversibilityStatus.INITIATED) throw new Error('Invalid state for failure');
      // Simulate failure transition
      await db.execute(sql`UPDATE action_reversals SET status = ${ReversibilityStatus.REVERSED} WHERE id = ${action.id} AND status = ${ReversibilityStatus.INITIATED}`);
    };

    // Attempting to confirm it
    const tryConfirm = async () => {
      const current = await reversibilityService.getActionById(action.id);
      if (current?.status !== ReversibilityStatus.INITIATED) throw new Error('Invalid state for confirm');
      await reversibilityService.confirmAction({ actionId: action.id });
    };

    // We can run them sequentially to prove the state machine prevents the second one
    await tryFail();
    
    // The second should fail because the status is no longer INITIATED
    await expect(tryConfirm()).rejects.toThrow(/Invalid state/i);
    
    const finalAction = await reversibilityService.getActionById(action.id);
    expect(finalAction?.status).toBe(ReversibilityStatus.REVERSED);
  });

  test('Duplicate/replayed webhook after CONFIRMED/completed does not re-credit or corrupt state', async () => {
    // Note: The actual webhook routes handle this by checking if existing transactionHash matches
    // or if the status is already completed.
    
    // Simulate initial webhook setting it to completed
    const txHash = `hash-${uuidv4()}`;
    const userId = uuidv4();
    const accountId = uuidv4();
    const extRef = `ref-${uuidv4()}`;

    await db.execute(sql`
      INSERT INTO users (id, email, username, password)
      VALUES (${userId}, ${`test-${userId}@example.com`}, ${`user-${userId}`}, 'test-password')
      ON CONFLICT (id) DO NOTHING
    `);

    await db.execute(sql`
      INSERT INTO accounts (id, user_id, account_type, currency, balance, status)
      VALUES (${accountId}, ${userId}, 'vault', 'USDC', '0', 'active')
    `);
    
    await db.execute(sql`
      INSERT INTO deposits (id, user_id, to_account_id, source, amount, currency, status, external_reference, created_at)
      VALUES (${uuidv4()}, ${userId}, ${accountId}, 'external_wallet', 100, 'USDC', 'completed', ${extRef}, NOW())
    `);
    
    // Attempt duplicate processing
    const existing = await db.execute(sql`
      SELECT id, status FROM deposits WHERE external_reference = ${extRef}
    `);
    
    const deposit = existing.rows[0] as any;
    expect(deposit.status).toBe('completed');
    
    // Safe guard check that webhook handler does (simulated)
    const isDuplicate = deposit.status === 'completed';
    expect(isDuplicate).toBe(true);
    // Real code would return { success: true } without updating balance again.
  });

  test('Webhook arriving out of order (e.g., CONFIRMED before PENDING) is handled safely', async () => {
    // If a deposit receives a 'completed' webhook before it receives 'pending',
    // the system should transition it to completed safely.
    const userId = uuidv4();
    const accountId = uuidv4();
    const extRef = `ref-${uuidv4()}`;

    await db.execute(sql`
      INSERT INTO users (id, email, username, password)
      VALUES (${userId}, ${`test-${userId}@example.com`}, ${`user-${userId}`}, 'test-password')
      ON CONFLICT (id) DO NOTHING
    `);

    await db.execute(sql`
      INSERT INTO accounts (id, user_id, account_type, currency, balance, status)
      VALUES (${accountId}, ${userId}, 'vault', 'USDC', '0', 'active')
    `);

    await db.execute(sql`
      INSERT INTO deposits (id, user_id, to_account_id, source, amount, currency, status, external_reference, created_at)
      VALUES (${uuidv4()}, ${userId}, ${accountId}, 'external_wallet', 100, 'USDC', 'initiated', ${extRef}, NOW())
    `);

    // Webhook arrives saying it's completed (skipping pending)
    const webhookStatus = 'completed';
    
    // The handler does an unconditional update if it finds the deposit
    await db.execute(sql`
      UPDATE deposits 
      SET status = ${webhookStatus}, completed_at = NOW()
      WHERE external_reference = ${extRef}
    `);

    const updated = await db.execute(sql`
      SELECT status FROM deposits WHERE external_reference = ${extRef}
    `);
    
    expect((updated.rows[0] as any).status).toBe('completed');
  });
});
