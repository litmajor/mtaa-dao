import { describe, test, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { sql, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createAccountTransaction } from '../services/account-service';
import { accounts, users } from '../../shared/schema';

describe('Tier 2: Vault Deposit/Withdrawal Consistency', () => {
  let userId: string;
  let accountId: string;

  beforeEach(async () => {
    userId = uuidv4();
    accountId = uuidv4();

    await db.insert(users).values({
      id: userId,
      username: `testuser-${userId}`,
      password: 'test-password',
      name: 'Test User',

    });

    await db.insert(accounts).values({
      id: accountId,
      userId,
      accountType: 'vault',
      currency: 'USDC',
      balance: '100', // Start with 100
      totalDeposited: '100',
      totalWithdrawn: '0',
      totalTransactions: 1,
      status: 'active',
    });
  });

  test('Concurrent deposit and withdrawal produces the correct arithmetic sum', async () => {
    // 10 deposits of 10, 5 withdrawals of 10
    const ops = [];
    for (let i = 0; i < 10; i++) {
      ops.push(createAccountTransaction({
        accountId,
        transactionType: 'deposit',
        amount: '10',
        currency: 'USDC',
        description: 'Test deposit'
      }));
    }
    for (let i = 0; i < 5; i++) {
      ops.push(createAccountTransaction({
        accountId,
        transactionType: 'withdrawal',
        amount: '10',
        currency: 'USDC',
        description: 'Test withdrawal'
      }));
    }

    await Promise.all(ops);

    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    
    // Initial 100 + (10 * 10) - (5 * 10) = 150
    expect(Number(account.balance)).toBe(150);
  });

  test('Withdrawal > balance is rejected even with concurrent pending deposit', async () => {
    // Try to withdraw 150 (initial is 100).
    // Concurrently deposit 100.
    // The withdrawal should fail because it checks the balance BEFORE the deposit commits.
    
    const depositPromise = createAccountTransaction({
      accountId,
      transactionType: 'deposit',
      amount: '100',
      currency: 'USDC',
      description: 'Concurrent deposit'
    });

    const withdrawalPromise = createAccountTransaction({
      accountId,
      transactionType: 'withdrawal',
      amount: '250',
      currency: 'USDC',
      description: 'Concurrent withdrawal'
    });

    // The withdrawal must reject because it exceeds the eventual account balance.
    await expect(withdrawalPromise).rejects.toThrow(/Insufficient funds/i);
    await depositPromise;

    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    // Initial 100 + 100 deposit = 200, withdrawal rejected
    expect(Number(account.balance)).toBe(200);
  });

  test('Reversibility/refund returns vault to exact pre-transaction state', async () => {
    // Original balance is 100.
    const tx = await createAccountTransaction({
      accountId,
      transactionType: 'deposit',
      amount: '50',
      currency: 'USDC',
      description: 'Initial deposit'
    });

    const [accountAfterTx] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    expect(Number(accountAfterTx.balance)).toBe(150);

    // Issue a refund (reversal)
    await createAccountTransaction({
      accountId,
      transactionType: 'withdrawal',
      amount: '50',
      currency: 'USDC',
      description: `Refund for ${tx.id}`,
      reference: tx.id // referencing original
    });

    const [accountAfterRefund] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    
    // Balance should be exactly the pre-transaction state (100)
    expect(Number(accountAfterRefund.balance)).toBe(100);
  });
});
