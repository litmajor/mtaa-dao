import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';

// Set environment variables FIRST, before any imports
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'test-jwt-secret-this-is-long-enough-for-32-chars-requirement';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-this-is-long-enough-for-32-chars';
process.env.SESSION_SECRET = 'test-session-secret-this-is-long-enough-for-32-chars';

// Mock config AFTER setting env vars
vi.mock('../../shared/config.ts', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-this-is-long-enough-for-32-chars-requirement',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-this-is-long-enough-for-32-chars',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
    NODE_ENV: 'test',
    SESSION_SECRET: 'test-session-secret-this-is-long-enough-for-32-chars',
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

// In-memory test database
const testDb = {
  users: new Map(),
  wallets: new Map(),
  walletPublicKeys: new Map(),
  walletSecuritySettings: new Map(),
};

const getTableName = (table) => {
  if (!table) return '';
  const symbol = Object.getOwnPropertySymbols(table).find((candidate) => candidate.toString() === 'Symbol(drizzle:Name)');
  if (symbol) return String(table[symbol]);
  if (table.name) return String(table.name);
  if (table._?.name) return String(table._.name);
  return '';
};

const getRowsForTable = (table) => {
  const tableName = getTableName(table);
  switch (tableName) {
    case 'users':
      return Array.from(testDb.users.values());
    case 'wallets':
      return Array.from(testDb.wallets.values());
    case 'wallet_public_keys':
      return Array.from(testDb.walletPublicKeys.values());
    case 'wallet_security_settings':
      return Array.from(testDb.walletSecuritySettings.values());
    default:
      return [];
  }
};

const extractConditionPairs = (condition, pairs = []) => {
  if (!condition) return pairs;

  if (Array.isArray(condition)) {
    condition.forEach((entry) => extractConditionPairs(entry, pairs));
    return pairs;
  }

  if (condition.queryChunks) {
    const chunks = Array.isArray(condition.queryChunks) ? condition.queryChunks : [condition.queryChunks];
    let columnName;
    let value;

    for (const chunk of chunks) {
      if (!chunk || typeof chunk !== 'object') continue;

      if (chunk.queryChunks) {
        extractConditionPairs(chunk, pairs);
        continue;
      }

      if (chunk.name && chunk.table && chunk.config) {
        columnName = chunk.name;
      }

      if (chunk.value !== undefined && !chunk.name && !chunk.table) {
        value = chunk.value;
      }
    }

    if (columnName && value !== undefined) {
      pairs.push({ column: columnName, value });
    }
    return pairs;
  }

  if (condition.expressions) {
    condition.expressions.forEach((entry) => extractConditionPairs(entry, pairs));
    return pairs;
  }

  if (condition.column && Object.prototype.hasOwnProperty.call(condition, 'value')) {
    pairs.push({ column: condition.column.name, value: condition.value });
  }

  return pairs;
};

const matchesCondition = (record, whereCondition) => {
  if (!whereCondition) return true;

  const pairs = extractConditionPairs(whereCondition);
  if (pairs.length === 0) return true;

  return pairs.every(({ column, value }) => record[column] === value);
};

// Mock db at the module level
vi.mock('../db', () => {
  const createQueryBuilder = (rows) => {
    const builder = {
      then: (resolve) => Promise.resolve(rows).then(resolve),
      limit: vi.fn((limit) => Promise.resolve(rows.slice(0, limit))),
    };
    return builder;
  };

  const db = {
    select: vi.fn(() => ({
      from: vi.fn((table) => ({
        where: vi.fn((whereCondition) => {
          const rows = getRowsForTable(table).filter((record) => matchesCondition(record, whereCondition));
          return createQueryBuilder(rows);
        }),
        limit: vi.fn((limit) => Promise.resolve(getRowsForTable(table).slice(0, limit))),
      })),
    })),
    insert: vi.fn((table) => ({
      values: vi.fn((values) => {
        const tableName = getTableName(table);
        if (tableName === 'users') testDb.users.set(values.id, values);
        if (tableName === 'wallets') testDb.wallets.set(values.id, values);
        if (tableName === 'wallet_public_keys') testDb.walletPublicKeys.set(values.id, values);
        if (tableName === 'wallet_security_settings') testDb.walletSecuritySettings.set(values.id, values);
        return Promise.resolve({ rowCount: 1 });
      }),
    })),
  };

  return { db };
});

import { db } from '../db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { generateMnemonicWallet, createUserWallet } from '../services/wallet-generation-service';
import { users, wallets } from '../../shared/schema';

describe('Tier 4: Wallet Creation Regression Tests', () => {
  let userId: string;

  beforeEach(async () => {
    userId = uuidv4();
    await db.insert(users).values({
      id: userId,
      name: 'Test User',
      username: `testuser-${userId}`,
      password: 'test-password',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test('Empty-password key derivation fix: server never stores mnemonic, returns exactly once', async () => {
    const result = await createUserWallet(userId, 'USDC', 'personal');

    // Mnemonic must be returned in the response as a 12+ word phrase
    expect(result.mnemonic).toBeDefined();
    expect(result.mnemonic.split(' ').length).toBeGreaterThanOrEqual(12);

    // Verify it was NOT stored in the database
    const [walletRecord] = await db.select().from(wallets).where(eq(wallets.id, result.walletId));

    expect(walletRecord).toBeDefined();
    expect((walletRecord as any).mnemonic).toBeUndefined(); // Schema should not have mnemonic
    expect((walletRecord as any).privateKey).toBeUndefined();
  });

  test('Dev fallback issuing fake wallets fix: throws in production if generation fails', async () => {
    // 1. Reset module cache so Vitest re-evaluates imports for this test
    vi.resetModules();

    // 2. Ensure production secret checks pass by stubbing strong secrets
    vi.stubEnv('SESSION_SECRET', 'a_very_strong_production_session_secret_32bytes_long!');
    vi.stubEnv('JWT_SECRET', 'a_very_strong_production_jwt_secret_32bytes_long!');

    // 3. Force production mode
    vi.stubEnv('NODE_ENV', 'production');

    // 3. Mock ethers import to fail
    vi.doMock('ethers', () => {
      throw new Error('Ethers module missing');
    });

    // 4. Dynamically import the service AFTER setting up the mock
    const { generateMnemonicWallet: dynamicGenerate } = await import(
      '../services/wallet-generation-service'
    );

    // 5. In production, it must throw, NOT fallback to random bytes
    await expect(dynamicGenerate()).rejects.toThrow(/no fallback is permitted in production/i);
  });

  test('Multi-currency creation blocked by existence check fix', async () => {
    // Create first wallet (USDC, personal)
    const wallet1 = await createUserWallet(userId, 'USDC', 'personal');
    expect(wallet1).toBeDefined();
    expect(wallet1.currency).toBe('USDC');

    // Creating ANOTHER USDC personal wallet should fail
    await expect(createUserWallet(userId, 'USDC', 'personal')).rejects.toThrow(
      /already has a USDC personal wallet/i
    );

    // Creating a DIFFERENT currency wallet should SUCCEED
    const wallet2 = await createUserWallet(userId, 'ETH', 'personal');
    expect(wallet2).toBeDefined();
    expect(wallet2.currency).toBe('ETH');

    // Creating a DIFFERENT wallet type should SUCCEED
    const wallet3 = await createUserWallet(userId, 'USDC', 'treasury');
    expect(wallet3).toBeDefined();
    expect(wallet3.currency).toBe('USDC');
  });
});