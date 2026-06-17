import { db } from '../db';
import { paymentTransactions } from '../../shared/schema';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

/**
 * Credit a user's cached balance using a double-entry ledger pattern.
 * Assumes a `wallet_ledger` table exists with columns compatible with the insert below.
 */
export async function creditUserWalletOnDeposit(transactionReference: string): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Fetch transaction record and ensure it's completed
    const [transaction] = await tx.select().from(paymentTransactions).where(sql`reference = ${transactionReference}`).limit(1);
    if (!transaction || transaction.status !== 'completed') {
      throw new Error(`Transaction ref ${transactionReference} must be 'completed' before adjusting asset balances.`);
    }

    // 2. Check for existing ledger entry
    const existingLedger = await tx.execute(sql`SELECT id FROM wallet_ledger WHERE transaction_id = ${transaction.id} LIMIT 1`);
    if (existingLedger.rows && existingLedger.rows.length) {
      logger.warn(`[LEDGER BYPASS] Ledger line item already compiled for transaction ID: ${transaction.id}`);
      return;
    }

    // 3. Lock user row to prevent concurrent updates
    const userRes = await tx.execute(sql`
      SELECT id, balance
      FROM users
      WHERE id = ${transaction.userId}::text
      FOR UPDATE
    `);

    const user = userRes.rows && userRes.rows[0];
    if (!user) {
      throw new Error(`User account record corresponding to ID ${transaction.userId} is missing.`);
    }

    // 4. Calculate new balance deterministically
    const currentBalance = Number(user.balance || 0);
    const depositAmount = Number(transaction.amount || 0);
    const computedNewBalance = (currentBalance + depositAmount).toFixed(4);

    // 5. Insert immutable ledger line
    await tx.execute(sql`
      INSERT INTO wallet_ledger (user_id, transaction_id, type, amount, purpose, balance_snapshot, created_at)
      VALUES (${user.id}::text, ${transaction.id}::text, 'credit', ${transaction.amount}::numeric, 'wallet_deposit', ${computedNewBalance}::numeric, now())
    `);

    // 6. Update cached balance on users
    await tx.execute(sql`
      UPDATE users
      SET balance = ${computedNewBalance}::numeric, updated_at = now()
      WHERE id = ${user.id}::text
    `);

    logger.info(`[LEDGER INTEGRITY COMMIT] User ${user.id} credited. Balance: ${currentBalance} -> ${computedNewBalance}`);
  });
}

export default { creditUserWalletOnDeposit };
