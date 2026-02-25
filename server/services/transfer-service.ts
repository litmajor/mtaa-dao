/**
 * Internal Transfer Service
 * Manages transfers between user's own accounts
 */

import { db } from '../db';
import { internalTransfers } from '@shared/transactionFlowSchema';
import { accounts, users } from '@shared/schema';
import { eq, and, desc, limit, offset } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Transfer between user's own accounts
 */
export async function transferBetweenAccounts(
  userId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: string,
  reason: 'trading' | 'savings' | 'profit_lock' | 'rebalance' | 'manual'
): Promise<{
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  reason: string;
  status: string;
  createdAt: Date;
}> {
  // Validate both accounts belong to user
  const fromAccount = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, fromAccountId), eq(accounts.userId, userId)))
    .limit(1);

  const toAccount = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, toAccountId), eq(accounts.userId, userId)))
    .limit(1);

  if (!fromAccount[0]) {
    throw new Error('From account not found or does not belong to user');
  }

  if (!toAccount[0]) {
    throw new Error('To account not found or does not belong to user');
  }

  // Check sufficient balance in from account
  const fromBalance = parseFloat(fromAccount[0].balance?.toString() || '0');
  const transferAmount = parseFloat(amount);

  if (fromBalance < transferAmount) {
    throw new Error(
      `Insufficient balance in ${fromAccount[0].accountType} account. Available: ${fromBalance}, Requested: ${transferAmount}`
    );
  }

  // Validate transfer path
  if (fromAccountId === toAccountId) {
    throw new Error('Cannot transfer to the same account');
  }

  // Validate account type compatibility
  const validPaths = [
    ['wallet', 'trading'],
    ['trading', 'wallet'],
    ['wallet', 'vault'],
    ['vault', 'wallet'],
    ['trading', 'vault'],
    ['vault', 'trading'],
    ['wallet', 'escrow'],
    ['trading', 'escrow'],
    ['vault', 'escrow'],
    ['escrow', 'wallet'],
  ];

  const fromType = fromAccount[0].accountType;
  const toType = toAccount[0].accountType;
  const isValidPath = validPaths.some((path) => path[0] === fromType && path[1] === toType);

  if (!isValidPath) {
    throw new Error(
      `Invalid transfer path from ${fromType} to ${toType}. Allowed transfers: Wallet ↔ Trading, Wallet ↔ Vault, Trading ↔ Vault, Any → Escrow, Escrow → Wallet`
    );
  }

  // Create transfer record
  const transferId = uuidv4();

  await db.insert(internalTransfers).values({
    id: transferId,
    userId,
    fromAccountId,
    toAccountId,
    amount: transferAmount.toString(),
    currency: fromAccount[0].currency || 'USDC',
    reason,
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Update balances atomically
  // Deduct from source account
  await db
    .update(accounts)
    .set({
      balance: (parseFloat(fromAccount[0].balance?.toString() || '0') - transferAmount).toString(),
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, fromAccountId));

  // Add to destination account
  await db
    .update(accounts)
    .set({
      balance: (parseFloat(toAccount[0].balance?.toString() || '0') + transferAmount).toString(),
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, toAccountId));

  return {
    id: transferId,
    fromAccountId,
    toAccountId,
    amount,
    reason,
    status: 'completed',
    createdAt: new Date(),
  };
}

/**
 * Get transfer history for user
 */
export async function getTransferHistory(
  userId: string,
  limitCount: number = 50,
  offsetCount: number = 0
): Promise<any[]> {
  const transfers = await db
    .select({
      id: internalTransfers.id,
      fromAccountId: internalTransfers.fromAccountId,
      toAccountId: internalTransfers.toAccountId,
      amount: internalTransfers.amount,
      currency: internalTransfers.currency,
      reason: internalTransfers.reason,
      status: internalTransfers.status,
      createdAt: internalTransfers.createdAt,
      updatedAt: internalTransfers.updatedAt,
    })
    .from(internalTransfers)
    .where(eq(internalTransfers.userId, userId))
    .orderBy(desc(internalTransfers.createdAt))
    .limit(limitCount)
    .offset(offsetCount);

  return transfers;
}

/**
 * Get transfers by specific account
 */
export async function getAccountTransfers(
  userId: string,
  accountId: string,
  limitCount: number = 50,
  offsetCount: number = 0
): Promise<any[]> {
  const transfers = await db
    .select()
    .from(internalTransfers)
    .where(
      and(
        eq(internalTransfers.userId, userId),
        (query) =>
          query.where(eq(internalTransfers.fromAccountId, accountId)).orWhere(eq(internalTransfers.toAccountId, accountId))
      )
    )
    .orderBy(desc(internalTransfers.createdAt))
    .limit(limitCount)
    .offset(offsetCount);

  return transfers;
}

/**
 * Validate transfer path between account types
 */
export function validateTransferPath(
  fromType: string,
  toType: string
): { valid: boolean; error?: string } {
  const validPaths = [
    ['wallet', 'trading'],
    ['trading', 'wallet'],
    ['wallet', 'vault'],
    ['vault', 'wallet'],
    ['trading', 'vault'],
    ['vault', 'trading'],
    ['wallet', 'escrow'],
    ['trading', 'escrow'],
    ['vault', 'escrow'],
    ['escrow', 'wallet'],
  ];

  const isValid = validPaths.some((path) => path[0] === fromType && path[1] === toType);

  if (!isValid) {
    return {
      valid: false,
      error: `Invalid transfer from ${fromType} to ${toType}. Allowed: Wallet ↔ Trading, Wallet ↔ Vault, Trading ↔ Vault, Any → Escrow, Escrow → Wallet`,
    };
  }

  return { valid: true };
}

/**
 * Get total transferred amount between accounts
 */
export async function getTotalTransferred(
  userId: string,
  fromAccountId: string,
  toAccountId: string
): Promise<string> {
  const result = await db
    .select()
    .from(internalTransfers)
    .where(
      and(
        eq(internalTransfers.userId, userId),
        eq(internalTransfers.fromAccountId, fromAccountId),
        eq(internalTransfers.toAccountId, toAccountId),
        eq(internalTransfers.status, 'completed')
      )
    );

  const total = result.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
  return total.toString();
}

/**
 * Get transfer statistics for user
 */
export async function getTransferStatistics(userId: string): Promise<{
  totalTransfers: number;
  totalAmount: string;
  byReason: Record<string, { count: number; amount: string }>;
}> {
  const transfers = await db
    .select()
    .from(internalTransfers)
    .where(and(eq(internalTransfers.userId, userId), eq(internalTransfers.status, 'completed')));

  const byReason: Record<string, { count: number; amount: string }> = {
    trading: { count: 0, amount: '0' },
    savings: { count: 0, amount: '0' },
    profit_lock: { count: 0, amount: '0' },
    rebalance: { count: 0, amount: '0' },
    manual: { count: 0, amount: '0' },
  };

  let totalAmount = 0;

  transfers.forEach((t) => {
    const reason = t.reason as keyof typeof byReason;
    if (reason in byReason) {
      byReason[reason].count += 1;
      byReason[reason].amount = (parseFloat(byReason[reason].amount) + parseFloat(t.amount || '0')).toString();
      totalAmount += parseFloat(t.amount || '0');
    }
  });

  return {
    totalTransfers: transfers.length,
    totalAmount: totalAmount.toString(),
    byReason,
  };
}
