import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
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