/**
 * Deposit Service
 * Manages fund deposits from external sources
 * Supports: Off-ramp providers (Stripe, Kotanipay, M-Pesa) and external wallets
 */

import { db } from '../db';
import { deposits, DEPOSIT_SOURCES, DepositSource, DEPOSIT_STATUSES } from '@shared/transactionFlowSchema';
import { accounts } from '@shared/accountSchema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Initiate a deposit via off-ramp provider
 */
export async function initiateOffRampDeposit(
  userId: string,
  toAccountId: string,
  provider: 'stripe' | 'kotanipay' | 'mpesa',
  amount: string,
  currency: string = 'USDC',
  metadata?: Record<string, any>
): Promise<typeof deposits.$inferSelect> {
  const source = `offramp_${provider}` as DepositSource;

  const deposit = await db
    .insert(deposits)
    .values({
      userId,
      toAccountId,
      source,
      amount,
      currency,
      feeAmount: '0', // Fee will be added by provider
      status: 'pending',
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    })
    .returning();

  return deposit[0];
}

/**
 * Initiate a deposit from external wallet
 */
export async function initiateExternalWalletDeposit(
  userId: string,
  toAccountId: string,
  walletAddress: string,
  amount: string,
  currency: string = 'USDC'
): Promise<typeof deposits.$inferSelect> {
  const deposit = await db
    .insert(deposits)
    .values({
      userId,
      toAccountId,
      source: 'external_wallet',
      sourceIdentifier: walletAddress,
      amount,
      currency,
      status: 'pending',
    })
    .returning();

  return deposit[0];
}

/**
 * Complete a deposit and update account balance
 */
export async function completeDeposit(
  depositId: string,
  transactionHash: string,
  actualFeeAmount?: string
): Promise<typeof deposits.$inferSelect> {
  // Get deposit details
  const depositResult = await db
    .select()
    .from(deposits)
    .where(eq(deposits.id, depositId));

  if (!depositResult.length) {
    throw new Error('Deposit not found');
  }

  const deposit = depositResult[0];

  // Update deposit status
  const updated = await db
    .update(deposits)
    .set({
      status: 'completed',
      transactionHash,
      feeAmount: actualFeeAmount || deposit.feeAmount,
      completedAt: new Date(),
    })
    .where(eq(deposits.id, depositId))
    .returning();

  // Update account balance
  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, deposit.toAccountId));

  if (account.length) {
    const newBalance = (parseFloat(account[0].balance) + parseFloat(deposit.amount)).toFixed(8);
    await db
      .update(accounts)
      .set({
        balance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, deposit.toAccountId));
  }

  return updated[0];
}

/**
 * Fail a deposit
 */
export async function failDeposit(
  depositId: string,
  reason: string
): Promise<typeof deposits.$inferSelect> {
  const updated = await db
    .update(deposits)
    .set({
      status: 'failed',
      metadata: JSON.stringify({ failureReason: reason }),
    })
    .where(eq(deposits.id, depositId))
    .returning();

  return updated[0];
}

/**
 * Cancel a pending deposit
 */
export async function cancelDeposit(
  depositId: string,
  reason: string = 'User cancelled'
): Promise<typeof deposits.$inferSelect> {
  const depositResult = await db
    .select()
    .from(deposits)
    .where(eq(deposits.id, depositId));

  if (!depositResult.length) {
    throw new Error('Deposit not found');
  }

  const deposit = depositResult[0];

  if (deposit.status !== 'pending') {
    throw new Error(`Cannot cancel deposit with status: ${deposit.status}`);
  }

  const updated = await db
    .update(deposits)
    .set({
      status: 'cancelled',
      metadata: JSON.stringify({ cancellationReason: reason }),
    })
    .where(eq(deposits.id, depositId))
    .returning();

  return updated[0];
}

/**
 * Get deposit by ID
 */
export async function getDeposit(depositId: string): Promise<typeof deposits.$inferSelect | null> {
  const result = await db
    .select()
    .from(deposits)
    .where(eq(deposits.id, depositId));
  return result[0] || null;
}

/**
 * Get deposit history for user
 */
export async function getUserDepositHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<typeof deposits.$inferSelect[]> {
  return await db
    .select()
    .from(deposits)
    .where(eq(deposits.userId, userId))
    .orderBy(desc(deposits.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get pending deposits for user
 */
export async function getPendingDeposits(userId: string): Promise<typeof deposits.$inferSelect[]> {
  return await db
    .select()
    .from(deposits)
    .where(and(eq(deposits.userId, userId), eq(deposits.status, 'pending')))
    .orderBy(desc(deposits.createdAt));
}

/**
 * Get deposit by external reference (for provider webhooks)
 */
export async function getDepositByExternalReference(externalReference: string): Promise<typeof deposits.$inferSelect | null> {
  const result = await db
    .select()
    .from(deposits)
    .where(eq(deposits.externalReference, externalReference));
  return result[0] || null;
}

/**
 * Update external reference (when provider provides it after initiation)
 */
export async function updateDepositExternalReference(
  depositId: string,
  externalReference: string
): Promise<void> {
  await db
    .update(deposits)
    .set({
      externalReference,
    })
    .where(eq(deposits.id, depositId));
}

/**
 * Get total deposits for user
 */
export async function getUserTotalDeposited(userId: string): Promise<string> {
  const result = await db
    .select()
    .from(deposits)
    .where(and(eq(deposits.userId, userId), eq(deposits.status, 'completed')));

  const total = result.reduce((sum, dep) => sum + parseFloat(dep.amount), 0);
  return total.toFixed(8);
}

/**
 * Get deposit statistics for admin
 */
export async function getDepositStatistics(
  startDate?: Date,
  endDate?: Date
): Promise<{ totalDeposits: number; totalAmount: string; successCount: number; failedCount: number }> {
  const results = await db
    .select()
    .from(deposits)
    .where(
      startDate && endDate
        ? and(
            eq(deposits.status, 'completed'),
          )
        : eq(deposits.status, 'completed')
    );

  return {
    totalDeposits: results.length,
    totalAmount: results.reduce((sum, dep) => sum + parseFloat(dep.amount), 0).toFixed(8),
    successCount: results.filter((d) => d.status === 'completed').length,
    failedCount: results.filter((d) => d.status === 'failed').length,
  };
}
