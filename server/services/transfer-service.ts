/**
 * Internal Transfer Service
 * Manages transfers between user's own accounts
 */

import { db } from '../db';
import { internalTransfers } from '@shared/transactionFlowSchema';
import { accounts } from '@shared/accountSchema';
import { eq, and, desc, or, inArray, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import { postPlatformTransfer } from './platformLedgerService';

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
  if (fromAccountId === toAccountId) {
    throw new Error('Cannot transfer to the same account');
  }

  const transferAmount = new Decimal(amount);
  if (!transferAmount.isFinite() || transferAmount.lte(0) || transferAmount.decimalPlaces() > 8) {
    throw new Error('Transfer amount must be positive and fit account precision');
  }

  const transferId = uuidv4();

  return db.transaction(async (tx) => {
    const lockedAccounts = await tx
      .select()
      .from(accounts)
      .where(inArray(accounts.id, [fromAccountId, toAccountId]))
      .orderBy(asc(accounts.id))
      .for('update');
    const fromAccount = lockedAccounts.find((account) => account.id === fromAccountId);
    const toAccount = lockedAccounts.find((account) => account.id === toAccountId);
    if (!fromAccount || fromAccount.userId !== userId) {
      throw new Error('From account not found or does not belong to user');
    }
    if (!toAccount || toAccount.userId !== userId) {
      throw new Error('To account not found or does not belong to user');
    }
    if (fromAccount.currency !== toAccount.currency) {
      throw new Error('Cannot transfer between accounts with different currencies');
    }

    const validPaths = [
      ['wallet', 'trading'], ['trading', 'wallet'], ['wallet', 'vault'],
      ['vault', 'wallet'], ['trading', 'vault'], ['vault', 'trading'],
      ['wallet', 'escrow'], ['trading', 'escrow'], ['vault', 'escrow'],
      ['escrow', 'wallet'],
    ];
    if (!validPaths.some(([from, to]) => from === fromAccount.accountType && to === toAccount.accountType)) {
      throw new Error(
        `Invalid transfer path from ${fromAccount.accountType} to ${toAccount.accountType}. Allowed transfers: Wallet ↔ Trading, Wallet ↔ Vault, Trading ↔ Vault, Any → Escrow, Escrow → Wallet`
      );
    }

    const fromBalance = new Decimal(fromAccount.balance ?? '0');
    const available = fromBalance.minus(fromAccount.locked ?? '0');
    if (available.lt(transferAmount)) {
      throw new Error(
        `Insufficient available balance in ${fromAccount.accountType} account. Available: ${available.toFixed(8)}, Requested: ${transferAmount.toFixed(8)}`
      );
    }
    const toBalance = new Decimal(toAccount.balance ?? '0');
    const now = new Date();

    await postPlatformTransfer(tx, {
      reference: transferId,
      fromAccountId,
      toAccountId,
      amount: transferAmount.toFixed(8),
      currency: fromAccount.currency,
      description: `Internal ${reason} transfer`,
      metadata: { userId, reason },
    });

    await tx.update(accounts).set({
      balance: fromBalance.minus(transferAmount).toFixed(8),
      totalWithdrawn: new Decimal(fromAccount.totalWithdrawn ?? '0').plus(transferAmount).toFixed(8),
      totalTransactions: (fromAccount.totalTransactions ?? 0) + 1,
      updatedAt: now,
    }).where(eq(accounts.id, fromAccountId));
    await tx.update(accounts).set({
      balance: toBalance.plus(transferAmount).toFixed(8),
      totalDeposited: new Decimal(toAccount.totalDeposited ?? '0').plus(transferAmount).toFixed(8),
      totalTransactions: (toAccount.totalTransactions ?? 0) + 1,
      updatedAt: now,
    }).where(eq(accounts.id, toAccountId));

    await tx.insert(internalTransfers).values({
      id: transferId,
      userId,
      fromAccountId,
      toAccountId,
      amount: transferAmount.toFixed(8),
      currency: fromAccount.currency || 'USDC',
      reason,
      status: 'completed',
      createdAt: now,
    });

    return {
      id: transferId,
      fromAccountId,
      toAccountId,
      amount: transferAmount.toFixed(8),
      reason,
      status: 'completed',
      createdAt: now,
    };
  });
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
        or(
          eq(internalTransfers.fromAccountId, accountId),
          eq(internalTransfers.toAccountId, accountId)
        )
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
