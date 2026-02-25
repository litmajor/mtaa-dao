/**
 * Withdrawal Service
 * Manages fund withdrawals to external destinations
 * Supports: Off-ramp providers, external wallets, micro-withdrawals, internal transfers
 */

import { db } from '../db';
import { withdrawals, WITHDRAWAL_DESTINATIONS, WithdrawalDestination, WITHDRAWAL_STATUSES } from '@shared/transactionFlowSchema';
import { accounts } from '@shared/accountSchema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Initiate an off-ramp withdrawal
 */
export async function initiateOffRampWithdrawal(
  userId: string,
  fromAccountId: string,
  provider: 'stripe' | 'kotanipay' | 'mpesa',
  amount: string,
  currency: string = 'USDC',
  destinationIdentifier: string,
  metadata?: Record<string, any>
): Promise<typeof withdrawals.$inferSelect> {
  // Validate sufficient balance
  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, fromAccountId));

  if (!account.length) throw new Error('Account not found');

  const availableBalance = parseFloat(account[0].balance) - parseFloat(account[0].locked);
  if (availableBalance < parseFloat(amount)) {
    throw new Error(`Insufficient balance. Available: ${availableBalance}`);
  }

  const destination = `offramp_${provider}` as WithdrawalDestination;

  const withdrawal = await db
    .insert(withdrawals)
    .values({
      userId,
      fromAccountId,
      destination,
      destinationAddress: destinationIdentifier,
      amount,
      currency,
      status: 'pending',
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    })
    .returning();

  return withdrawal[0];
}

/**
 * Initiate a withdrawal to external wallet
 */
export async function initiateExternalWithdrawal(
  userId: string,
  fromAccountId: string,
  toAddress: string,
  amount: string,
  currency: string = 'USDC'
): Promise<typeof withdrawals.$inferSelect> {
  // Validate sufficient balance
  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, fromAccountId));

  if (!account.length) throw new Error('Account not found');

  const availableBalance = parseFloat(account[0].balance) - parseFloat(account[0].locked);
  if (availableBalance < parseFloat(amount)) {
    throw new Error(`Insufficient balance. Available: ${availableBalance}`);
  }

  const withdrawal = await db
    .insert(withdrawals)
    .values({
      userId,
      fromAccountId,
      destination: 'external_wallet',
      destinationAddress: toAddress,
      amount,
      currency,
      status: 'pending',
    })
    .returning();

  return withdrawal[0];
}

/**
 * Initiate a micro-withdrawal request
 */
export async function initiateMicroWithdrawal(
  userId: string,
  fromAccountId: string,
  toAddress: string,
  amount: string,
  currency: string = 'USDC'
): Promise<typeof withdrawals.$inferSelect> {
  // Validate amount is < $10
  const amountNum = parseFloat(amount);
  if (amountNum >= 10) {
    throw new Error('Micro-withdrawals must be less than $10');
  }

  if (amountNum < 0.5) {
    throw new Error('Minimum micro-withdrawal amount is $0.50');
  }

  // Validate sufficient balance
  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, fromAccountId));

  if (!account.length) throw new Error('Account not found');

  const availableBalance = parseFloat(account[0].balance) - parseFloat(account[0].locked);
  if (availableBalance < amountNum) {
    throw new Error(`Insufficient balance. Available: ${availableBalance}`);
  }

  const withdrawal = await db
    .insert(withdrawals)
    .values({
      userId,
      fromAccountId,
      destination: 'micro_withdrawal',
      destinationAddress: toAddress,
      amount,
      currency,
      status: 'pending',
    })
    .returning();

  return withdrawal[0];
}

/**
 * Process a withdrawal (update status and balance)
 */
export async function processWithdrawal(
  withdrawalId: string,
  transactionHash: string,
  feeAmount?: string
): Promise<typeof withdrawals.$inferSelect> {
  // Get withdrawal details
  const withdrawalResult = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.id, withdrawalId));

  if (!withdrawalResult.length) {
    throw new Error('Withdrawal not found');
  }

  const withdrawal = withdrawalResult[0];

  // Update withdrawal status
  const updated = await db
    .update(withdrawals)
    .set({
      status: 'completed',
      transactionHash,
      feeAmount: feeAmount || '0',
      completedAt: new Date(),
    })
    .where(eq(withdrawals.id, withdrawalId))
    .returning();

  // Update account balance
  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, withdrawal.fromAccountId));

  if (account.length) {
    const newBalance = (parseFloat(account[0].balance) - parseFloat(withdrawal.amount)).toFixed(8);
    await db
      .update(accounts)
      .set({
        balance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, withdrawal.fromAccountId));
  }

  return updated[0];
}

/**
 * Update withdrawal status to processing
 */
export async function updateWithdrawalStatus(
  withdrawalId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
): Promise<void> {
  await db
    .update(withdrawals)
    .set({
      status,
    })
    .where(eq(withdrawals.id, withdrawalId));
}

/**
 * Fail a withdrawal
 */
export async function failWithdrawal(
  withdrawalId: string,
  reason: string
): Promise<typeof withdrawals.$inferSelect> {
  // Get withdrawal
  const result = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.id, withdrawalId));

  if (!result.length) throw new Error('Withdrawal not found');

  const updated = await db
    .update(withdrawals)
    .set({
      status: 'failed',
      metadata: JSON.stringify({ failureReason: reason }),
    })
    .where(eq(withdrawals.id, withdrawalId))
    .returning();

  // No balance update since withdrawal wasn't deducted yet
  return updated[0];
}

/**
 * Cancel a pending withdrawal
 */
export async function cancelWithdrawal(
  withdrawalId: string,
  reason: string = 'User cancelled'
): Promise<typeof withdrawals.$inferSelect> {
  const result = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.id, withdrawalId));

  if (!result.length) throw new Error('Withdrawal not found');

  const withdrawal = result[0];

  if (withdrawal.status !== 'pending') {
    throw new Error(`Cannot cancel withdrawal with status: ${withdrawal.status}`);
  }

  const updated = await db
    .update(withdrawals)
    .set({
      status: 'cancelled',
      metadata: JSON.stringify({ cancellationReason: reason }),
    })
    .where(eq(withdrawals.id, withdrawalId))
    .returning();

  return updated[0];
}

/**
 * Get withdrawal by ID
 */
export async function getWithdrawal(withdrawalId: string): Promise<typeof withdrawals.$inferSelect | null> {
  const result = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.id, withdrawalId));
  return result[0] || null;
}

/**
 * Get withdrawal history for user
 */
export async function getUserWithdrawalHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<typeof withdrawals.$inferSelect[]> {
  return await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.userId, userId))
    .orderBy(desc(withdrawals.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get pending withdrawals for user
 */
export async function getPendingWithdrawals(userId: string): Promise<typeof withdrawals.$inferSelect[]> {
  return await db
    .select()
    .from(withdrawals)
    .where(and(eq(withdrawals.userId, userId), eq(withdrawals.status, 'pending')))
    .orderBy(desc(withdrawals.createdAt));
}

/**
 * Get pending micro-withdrawals for user
 */
export async function getPendingMicroWithdrawals(userId: string): Promise<typeof withdrawals.$inferSelect[]> {
  return await db
    .select()
    .from(withdrawals)
    .where(
      and(
        eq(withdrawals.userId, userId),
        eq(withdrawals.destination, 'micro_withdrawal'),
        eq(withdrawals.status, 'pending')
      )
    )
    .orderBy(desc(withdrawals.createdAt));
}

/**
 * Get withdrawal by external reference (for provider webhooks)
 */
export async function getWithdrawalByExternalReference(externalReference: string): Promise<typeof withdrawals.$inferSelect | null> {
  const result = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.externalReference, externalReference));
  return result[0] || null;
}

/**
 * Get total withdrawn for user
 */
export async function getUserTotalWithdrawn(userId: string): Promise<string> {
  const result = await db
    .select()
    .from(withdrawals)
    .where(and(eq(withdrawals.userId, userId), eq(withdrawals.status, 'completed')));

  const total = result.reduce((sum, wd) => sum + parseFloat(wd.amount), 0);
  return total.toFixed(8);
}

/**
 * Get withdrawal statistics for admin
 */
export async function getWithdrawalStatistics(): Promise<{
  totalWithdrawals: number;
  totalAmount: string;
  successCount: number;
  failedCount: number;
  pendingCount: number;
}> {
  const results = await db.select().from(withdrawals);

  return {
    totalWithdrawals: results.length,
    totalAmount: results
      .filter((w) => w.status === 'completed')
      .reduce((sum, w) => sum + parseFloat(w.amount), 0)
      .toFixed(8),
    successCount: results.filter((w) => w.status === 'completed').length,
    failedCount: results.filter((w) => w.status === 'failed').length,
    pendingCount: results.filter((w) => w.status === 'pending').length,
  };
}

/**
 * Estimate withdrawal fee based on destination
 */
export function estimateWithdrawalFee(
  destination: WithdrawalDestination,
  amount: string
): { estimatedFee: string; feePercent: number; netAmount: string } {
  const amountNum = parseFloat(amount);

  let feePercent = 0;

  if (destination.startsWith('offramp_')) {
    feePercent = 2.5; // 2.5% for off-ramp providers
  } else if (destination === 'external_wallet') {
    feePercent = 1; // 1% gas fee estimate (actual will vary)
  } else if (destination === 'micro_withdrawal') {
    feePercent = 0.5; // 0.5% batched fee (much cheaper)
  } else if (destination === 'internal_transfer') {
    feePercent = 0; // No fee for internal transfers
  }

  const estimatedFee = (amountNum * (feePercent / 100)).toFixed(8);
  const netAmount = (amountNum - parseFloat(estimatedFee)).toFixed(8);

  return { estimatedFee, feePercent, netAmount };
}
