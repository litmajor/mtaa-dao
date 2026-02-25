/**
 * Account Service - Phase 1
 * Core account management functionality for users and DAOs
 * 
 * Supports internal transfers between account profiles (e.g., okedi <-> yuki)
 */

import { db } from "../db";
import {
  accounts,
  accountTransactions,
  accountSettings,
  accountStatements,
  accountAccessLogs,
  type Account,
  type NewAccount,
  type InsertAccountTransaction,
  type InsertAccountSettings,
  type InsertAccountStatement,
  type InsertAccountAccessLog,
} from "@shared/accountSchema";
import { users, daos } from "@shared/schema";
import { eq, and, gte, lte, desc, sum } from "drizzle-orm";

/**
 * Generate unique account number
 */
function generateAccountNumber(): string {
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const random = Math.random().toString(36).substring(2, 8).toUpperCase(); // Random alphanumeric
  return `ACC-${timestamp}-${random}`;
}

/**
 * Create a new account
 */
export async function createAccount(data: NewAccount): Promise<Account> {
  const accountNumber = generateAccountNumber();

  const newAccount = await db
    .insert(accounts)
    .values({
      ...data,
      accountNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!newAccount[0]) {
    throw new Error("Failed to create account");
  }

  // Create default settings
  try {
    await createAccountSettings({
      accountId: newAccount[0].id,
    } as Partial<InsertAccountSettings>);
  } catch (error) {
    console.log("Settings creation optional, continuing:", error);
  }

  // Log account creation
  await logAccountAccess({
    accountId: newAccount[0].id,
    userId: data.userId,
    action: "create_account",
    resourceType: "account",
    status: "success",
  } as InsertAccountAccessLog);

  return newAccount[0];
}

/**
 * Get account by ID
 */
export async function getAccount(accountId: string): Promise<Account | null> {
  const result = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  return result[0] || null;
}

/**
 * Get all accounts for a user
 */
export async function getUserAccounts(userId: string): Promise<Account[]> {
  return db.select().from(accounts).where(eq(accounts.userId, userId));
}

/**
 * Get account by number
 */
export async function getAccountByNumber(accountNumber: string): Promise<Account | null> {
  const result = await db
    .select()
    .from(accounts)
    .where(eq(accounts.accountNumber, accountNumber))
    .limit(1);

  return result[0] || null;
}

/**
 * Update account
 */
export async function updateAccount(
  accountId: string,
  data: Partial<NewAccount>
): Promise<Account> {
  const updated = await db
    .update(accounts)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, accountId))
    .returning();

  if (!updated[0]) {
    throw new Error("Account not found");
  }

  return updated[0];
}

/**
 * Close account
 */
export async function closeAccount(
  accountId: string,
  reason?: string
): Promise<Account> {
  return updateAccount(accountId, {
    status: "closed",
    closedAt: new Date(),
  } as Partial<NewAccount>);
}

/**
 * Create account transaction
 * Supports internal transfers between account profiles
 */
export async function createAccountTransaction(
  data: InsertAccountTransaction
): Promise<any> {
  // Get current account balance
  const account = await getAccount(data.accountId);
  if (!account) {
    throw new Error("Account not found");
  }

  // Extract and convert numeric fields to prevent null reference errors
  const balance = account.balance ?? "0";
  const totalDep = account.totalDeposited ?? "0";
  const totalWith = account.totalWithdrawn ?? "0";
  const totalTrans = account.totalTransactions ?? 0;

  const balanceBeforeNum = Number(balance);
  let balanceAfterNum = balanceBeforeNum;

  // Calculate new balance based on transaction type
  const amount = Number(data.amount);
  switch (data.transactionType) {
    case "deposit":
      balanceAfterNum = balanceBeforeNum + amount;
      break;
    case "withdrawal":
      balanceAfterNum = balanceBeforeNum - amount;
      break;
    case "transfer":
      // If it's a transfer from this account
      if (data.fromAccountId === data.accountId) {
        balanceAfterNum = balanceBeforeNum - amount;
      } else {
        balanceAfterNum = balanceBeforeNum + amount;
      }
      break;
    case "fee":
      balanceAfterNum = balanceBeforeNum - amount;
      break;
    case "interest":
      balanceAfterNum = balanceBeforeNum + amount;
      break;
  }

  // Create transaction
  const transaction = await db
    .insert(accountTransactions)
    .values({
      accountId: data.accountId,
      transactionType: data.transactionType,
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      reference: data.reference,
      fromAccountId: data.fromAccountId,
      toAccountId: data.toAccountId,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      status: data.status || "completed",
      balanceBefore: balanceBeforeNum.toString(),
      balanceAfter: balanceAfterNum.toString(),
      transactionHash: data.transactionHash,
      chainId: data.chainId,
      metadata: data.metadata,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      createdAt: new Date(),
    })
    .returning();

  if (!transaction[0]) {
    throw new Error("Failed to create transaction");
  }

  // Update account balance and activity
  await updateAccount(data.accountId, {
    balance: balanceAfterNum.toString(),
    lastActivityAt: new Date(),
  } as Partial<NewAccount>);

  // Update account totals
  if (data.transactionType === "deposit") {
    // account.totalDeposited = Number(account.totalDeposited || 0) + amount;
  } else if (data.transactionType === "withdrawal") {
    // account.totalWithdrawn = Number(account.totalWithdrawn || 0) + amount;
  }

  await db
    .update(accounts)
    .set({
      totalDeposited:
        data.transactionType === "deposit"
          ? (Number(totalDep) + amount).toString()
          : totalDep,
      totalWithdrawn:
        data.transactionType === "withdrawal"
          ? (Number(totalWith) + amount).toString()
          : totalWith,
      totalTransactions: totalTrans + 1,
    })
    .where(eq(accounts.id, data.accountId));

  return transaction[0];
}

/**
 * Get account transactions
 */
export async function getAccountTransactions(
  accountId: string,
  limit: number = 50,
  offset: number = 0
): Promise<any[]> {
  return db
    .select()
    .from(accountTransactions)
    .where(eq(accountTransactions.accountId, accountId))
    .orderBy(desc(accountTransactions.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get transactions by date range
 */
export async function getAccountTransactionsByDateRange(
  accountId: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  return db
    .select()
    .from(accountTransactions)
    .where(
      and(
        eq(accountTransactions.accountId, accountId),
        gte(accountTransactions.createdAt, startDate),
        lte(accountTransactions.createdAt, endDate)
      )
    )
    .orderBy(desc(accountTransactions.createdAt));
}

/**
 * Create or update account settings
 */
export async function createAccountSettings(
  data: Partial<InsertAccountSettings>
): Promise<any> {
  const existing = await db
    .select()
    .from(accountSettings)
    .where(eq(accountSettings.accountId, data.accountId!))
    .limit(1);

  if (existing[0]) {
    const updated = await db
      .update(accountSettings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(accountSettings.accountId, data.accountId!))
      .returning();

    return updated[0] || existing[0];
  }

  const created = await db
    .insert(accountSettings)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as InsertAccountSettings)
    .returning();

  if (!created[0]) {
    throw new Error("Failed to create account settings");
  }

  return created[0];
}

/**
 * Get account settings
 */
export async function getAccountSettings(
  accountId: string
): Promise<any> {
  const result = await db
    .select()
    .from(accountSettings)
    .where(eq(accountSettings.accountId, accountId))
    .limit(1);

  return result[0] || null;
}

/**
 * Generate account statement
 */
export async function generateAccountStatement(
  accountId: string,
  periodStart: Date,
  periodEnd: Date,
  statementPeriod: "monthly" | "quarterly" | "yearly"
): Promise<any> {
  const account = await getAccount(accountId);
  if (!account) {
    throw new Error("Account not found");
  }

  // Get transactions for period
  const transactions = await getAccountTransactionsByDateRange(
    accountId,
    periodStart,
    periodEnd
  );

  // Calculate totals
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let totalTransfers = 0;
  let totalFees = 0;
  let totalInterest = 0;

  transactions.forEach((tx) => {
    const amount = Number(tx.amount);
    switch (tx.transactionType) {
      case "deposit":
        totalDeposits += amount;
        break;
      case "withdrawal":
        totalWithdrawals += amount;
        break;
      case "transfer":
        totalTransfers += amount;
        break;
      case "fee":
        totalFees += amount;
        break;
      case "interest":
        totalInterest += amount;
        break;
    }
  });

  // Create statement record
  const accountBalance = Number(account.balance || 0);
  const statement = await db
    .insert(accountStatements)
    .values({
      accountId,
      statementPeriod,
      periodStart,
      periodEnd,
      openingBalance: (accountBalance - totalDeposits + totalWithdrawals).toString(),
      closingBalance: accountBalance.toString(),
      totalDeposits: totalDeposits.toString(),
      totalWithdrawals: totalWithdrawals.toString(),
      totalTransfers: totalTransfers.toString(),
      totalFees: totalFees.toString(),
      totalInterest: totalInterest.toString(),
      transactionCount: transactions.length,
      generatedAt: new Date(),
      createdAt: new Date(),
    })
    .returning();

  if (!statement[0]) {
    throw new Error("Failed to generate statement");
  }

  return statement[0];
}

/**
 * Check transaction limits
 */
export async function checkTransactionLimits(
  accountId: string,
  amount: number
): Promise<{ allowed: boolean; reason?: string }> {
  const account = await getAccount(accountId);
  if (!account) {
    return { allowed: false, reason: "Account not found" };
  }

  // Check if account is active
  if (account.status !== "active") {
    return { allowed: false, reason: "Account is not active" };
  }

  // Check if account has sufficient balance
  const availableBalance = Number(account.balance || 0) - Number(account.locked || 0);
  if (availableBalance < amount) {
    return {
      allowed: false,
      reason: `Insufficient balance. Available: ${availableBalance}`,
    };
  }

  // Check daily limit
  if (account.dailyLimit) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dailyTotal = await db
      .select({ total: sum(accountTransactions.amount) })
      .from(accountTransactions)
      .where(
        and(
          eq(accountTransactions.accountId, accountId),
          gte(accountTransactions.createdAt, today),
          lte(accountTransactions.createdAt, tomorrow)
        )
      );

    const dailySpent = Number(dailyTotal[0]?.total || 0);
    if (dailySpent + amount > Number(account.dailyLimit)) {
      return {
        allowed: false,
        reason: `Daily limit exceeded. Remaining: ${Number(account.dailyLimit) - dailySpent}`,
      };
    }
  }

  // Check monthly limit
  if (account.monthlyLimit) {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const monthlyTotal = await db
      .select({ total: sum(accountTransactions.amount) })
      .from(accountTransactions)
      .where(
        and(
          eq(accountTransactions.accountId, accountId),
          gte(accountTransactions.createdAt, monthStart),
          lte(accountTransactions.createdAt, monthEnd)
        )
      );

    const monthlySpent = Number(monthlyTotal[0]?.total || 0);
    if (monthlySpent + amount > Number(account.monthlyLimit)) {
      return {
        allowed: false,
        reason: `Monthly limit exceeded. Remaining: ${Number(account.monthlyLimit) - monthlySpent}`,
      };
    }
  }

  // Check max balance
  if (account.maxBalance) {
    const newBalance = Number(account.balance) + amount;
    if (newBalance > Number(account.maxBalance)) {
      return {
        allowed: false,
        reason: `Maximum balance exceeded. Max: ${account.maxBalance}`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Log account access
 */
export async function logAccountAccess(
  data: InsertAccountAccessLog
): Promise<void> {
  await db.insert(accountAccessLogs).values({
    ...data,
    createdAt: new Date(),
  });
}

/**
 * Get account access logs
 */
export async function getAccountAccessLogs(
  accountId: string,
  limit: number = 100
): Promise<any[]> {
  return db
    .select()
    .from(accountAccessLogs)
    .where(eq(accountAccessLogs.accountId, accountId))
    .orderBy(desc(accountAccessLogs.createdAt))
    .limit(limit);
}

/**
 * Verify account
 */
export async function verifyAccount(accountId: string): Promise<Account> {
  return updateAccount(accountId, {
    isVerified: true,
    kycStatus: "verified",
    verifiedAt: new Date(),
  } as Partial<NewAccount>);
}

/**
 * Block/unblock account
 */
export async function setAccountBlock(
  accountId: string,
  blocked: boolean
): Promise<Account> {
  return updateAccount(accountId, {
    isBlocked: blocked,
  } as Partial<NewAccount>);
}

/**
 * Get DAO accounts
 */
export async function getDaoAccounts(daoId: string): Promise<Account[]> {
  return db.select().from(accounts).where(eq(accounts.daoId, daoId));
}

export default {
  createAccount,
  getAccount,
  getUserAccounts,
  getAccountByNumber,
  updateAccount,
  closeAccount,
  createAccountTransaction,
  getAccountTransactions,
  getAccountTransactionsByDateRange,
  createAccountSettings,
  getAccountSettings,
  generateAccountStatement,
  checkTransactionLimits,
  logAccountAccess,
  getAccountAccessLogs,
  verifyAccount,
  setAccountBlock,
  getDaoAccounts,
};
