import { db } from '../db';
import { paymentTransactions } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { updateUserAccountBalance } from './account-service';

/**
 * Credit the user's canonical platform account after the source payment settles.
 */
export async function creditUserWalletOnDeposit(transactionReference: string): Promise<void> {
  const [transaction] = await db.select().from(paymentTransactions)
    .where(eq(paymentTransactions.reference, transactionReference))
    .limit(1);
  if (!transaction || transaction.status !== 'completed') {
    throw new Error(`Transaction ref ${transactionReference} must be 'completed' before adjusting asset balances.`);
  }

  await updateUserAccountBalance(
    transaction.userId,
    transaction.currency,
    transaction.amount,
    'add',
    undefined,
    `payment:${transaction.id}`,
    'Settled payment deposit',
  );
  logger.info(`[LEDGER] Settled payment ${transaction.id} posted to the canonical platform account`);
}

export default { creditUserWalletOnDeposit };
