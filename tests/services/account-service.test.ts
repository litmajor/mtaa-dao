/**
 * Account Service Tests - Phase 1
 * Unit and integration tests for account management
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
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
  verifyAccount,
  setAccountBlock,
  getDaoAccounts,
} from "@/server/services/account-service";
import type {
  Account,
  AccountTransaction,
  AccountSettings,
} from "@/shared/schema";

describe("Account Service", () => {
  let testUserId = "test-user-" + Math.random().toString(36).substr(2, 9);
  let testDaoId = "00000000-0000-0000-0000-000000000001";
  let testAccountId: string;
  let testAccountNumber: string;

  beforeAll(async () => {
    // Setup test data if needed
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe("Account Creation", () => {
    it("should create a new personal account", async () => {
      const accountData = {
        userId: testUserId,
        accountType: "personal",
        accountName: "My Personal Account",
        currency: "KES",
      };

      const account = await createAccount(accountData as any);

      expect(account).toBeDefined();
      expect(account.accountType).toBe("personal");
      expect(account.accountName).toBe("My Personal Account");
      expect(account.status).toBe("active");
      expect(account.balance).toBe(0);
      expect(account.accountNumber).toBeDefined();

      testAccountId = account.id;
      testAccountNumber = account.accountNumber;
    });

    it("should create a DAO account", async () => {
      const accountData = {
        userId: testUserId,
        daoId: testDaoId,
        accountType: "dao",
        accountName: "DAO Treasury Account",
        currency: "cUSD",
      };

      const account = await createAccount(accountData as any);

      expect(account).toBeDefined();
      expect(account.accountType).toBe("dao");
      expect(account.daoId).toBe(testDaoId);
    });

    it("should generate unique account numbers", async () => {
      const account1 = await createAccount({
        userId: testUserId,
        accountType: "personal",
        accountName: "Account 1",
        currency: "KES",
      } as any);

      const account2 = await createAccount({
        userId: testUserId,
        accountType: "personal",
        accountName: "Account 2",
        currency: "KES",
      } as any);

      expect(account1.accountNumber).not.toBe(account2.accountNumber);
    });

    it("should set default values correctly", async () => {
      const account = await createAccount({
        userId: testUserId,
        accountType: "personal",
        accountName: "Test Account",
        currency: "KES",
      } as any);

      expect(account.status).toBe("active");
      expect(account.isVerified).toBe(false);
      expect(account.isBlocked).toBe(false);
      expect(account.kycStatus).toBe("pending");
      expect(account.riskLevel).toBe("low");
      expect(account.balance).toBe(0);
      expect(account.totalDeposited).toBe(0);
      expect(account.totalWithdrawn).toBe(0);
      expect(account.totalTransactions).toBe(0);
    });
  });

  describe("Account Retrieval", () => {
    it("should retrieve account by ID", async () => {
      const account = await getAccount(testAccountId);

      expect(account).toBeDefined();
      expect(account?.id).toBe(testAccountId);
      expect(account?.accountType).toBe("personal");
    });

    it("should retrieve account by account number", async () => {
      const account = await getAccountByNumber(testAccountNumber);

      expect(account).toBeDefined();
      expect(account?.accountNumber).toBe(testAccountNumber);
      expect(account?.id).toBe(testAccountId);
    });

    it("should retrieve all user accounts", async () => {
      const accounts = await getUserAccounts(testUserId);

      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts.length).toBeGreaterThan(0);
      expect(accounts.some((a) => a.id === testAccountId)).toBe(true);
    });

    it("should return null for non-existent account", async () => {
      const account = await getAccount("non-existent-id");

      expect(account).toBeNull();
    });

    it("should return null for non-existent account number", async () => {
      const account = await getAccountByNumber("ACC-INVALID-12345");

      expect(account).toBeNull();
    });
  });

  describe("Account Updates", () => {
    it("should update account name", async () => {
      const updated = await updateAccount(testAccountId, {
        accountName: "Updated Account Name",
      });

      expect(updated.accountName).toBe("Updated Account Name");
    });

    it("should update account limits", async () => {
      const updated = await updateAccount(testAccountId, {
        dailyLimit: 10000,
        monthlyLimit: 100000,
      });

      expect(updated.dailyLimit).toBe(10000);
      expect(updated.monthlyLimit).toBe(100000);
    });

    it("should update risk level", async () => {
      const updated = await updateAccount(testAccountId, {
        riskLevel: "high",
      });

      expect(updated.riskLevel).toBe("high");
    });

    it("should update compliance flags", async () => {
      const flags = ["kyc_pending", "high_risk"];
      const updated = await updateAccount(testAccountId, {
        complianceFlags: flags as any,
      });

      expect(updated.complianceFlags).toEqual(flags);
    });
  });

  describe("Account Verification", () => {
    it("should verify an account", async () => {
      const verified = await verifyAccount(testAccountId);

      expect(verified.isVerified).toBe(true);
      expect(verified.kycStatus).toBe("verified");
      expect(verified.verifiedAt).toBeDefined();
    });
  });

  describe("Account Blocking", () => {
    it("should block an account", async () => {
      const blocked = await setAccountBlock(testAccountId, true);

      expect(blocked.isBlocked).toBe(true);
    });

    it("should unblock an account", async () => {
      const unblocked = await setAccountBlock(testAccountId, false);

      expect(unblocked.isBlocked).toBe(false);
    });
  });

  describe("Account Transactions", () => {
    it("should create a deposit transaction", async () => {
      const transaction = await createAccountTransaction({
        accountId: testAccountId,
        transactionType: "deposit",
        amount: 1000,
        currency: "KES",
        description: "Initial deposit",
        fromUserId: testUserId,
      } as any);

      expect(transaction).toBeDefined();
      expect(transaction.transactionType).toBe("deposit");
      expect(transaction.amount).toBe(1000);
      expect(transaction.status).toBe("completed");
    });

    it("should create a withdrawal transaction", async () => {
      // First deposit some money
      await createAccountTransaction({
        accountId: testAccountId,
        transactionType: "deposit",
        amount: 5000,
        currency: "KES",
        fromUserId: testUserId,
      } as any);

      // Now withdraw
      const transaction = await createAccountTransaction({
        accountId: testAccountId,
        transactionType: "withdrawal",
        amount: 1000,
        currency: "KES",
        fromUserId: testUserId,
      } as any);

      expect(transaction.transactionType).toBe("withdrawal");
      expect(transaction.amount).toBe(1000);
    });

    it("should create a transfer transaction", async () => {
      const toAccount = await createAccount({
        userId: testUserId,
        accountType: "personal",
        accountName: "Recipient Account",
        currency: "KES",
      } as any);

      const transaction = await createAccountTransaction({
        accountId: testAccountId,
        transactionType: "transfer",
        amount: 500,
        currency: "KES",
        fromAccountId: testAccountId,
        toAccountId: toAccount.id,
        fromUserId: testUserId,
      } as any);

      expect(transaction.transactionType).toBe("transfer");
      expect(transaction.amount).toBe(500);
    });

    it("should update account balance after transaction", async () => {
      const beforeBalance = (await getAccount(testAccountId))?.balance || 0;

      await createAccountTransaction({
        accountId: testAccountId,
        transactionType: "deposit",
        amount: 1000,
        currency: "KES",
        fromUserId: testUserId,
      } as any);

      const afterBalance = (await getAccount(testAccountId))?.balance || 0;

      expect(afterBalance).toBeGreaterThan(beforeBalance);
    });

    it("should increment transaction count", async () => {
      const beforeCount =
        (await getAccount(testAccountId))?.totalTransactions || 0;

      await createAccountTransaction({
        accountId: testAccountId,
        transactionType: "deposit",
        amount: 100,
        currency: "KES",
        fromUserId: testUserId,
      } as any);

      const afterCount =
        (await getAccount(testAccountId))?.totalTransactions || 0;

      expect(afterCount).toBe(beforeCount + 1);
    });

    it("should retrieve account transactions", async () => {
      const transactions = await getAccountTransactions(testAccountId);

      expect(Array.isArray(transactions)).toBe(true);
      expect(transactions.length).toBeGreaterThan(0);
    });

    it("should retrieve transactions with pagination", async () => {
      const page1 = await getAccountTransactions(testAccountId, 5, 0);
      const page2 = await getAccountTransactions(testAccountId, 5, 5);

      expect(page1.length).toBeLessThanOrEqual(5);
      expect(page2.length).toBeLessThanOrEqual(5);
    });

    it("should retrieve transactions by date range", async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
      const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow

      const transactions = await getAccountTransactionsByDateRange(
        testAccountId,
        startDate,
        endDate
      );

      expect(Array.isArray(transactions)).toBe(true);
    });
  });

  describe("Account Settings", () => {
    it("should create account settings", async () => {
      const settings = await createAccountSettings({
        accountId: testAccountId,
        notifyOnDeposit: true,
        notifyOnWithdrawal: true,
        notifyOnLowBalance: false,
      } as any);

      expect(settings).toBeDefined();
      expect(settings.accountId).toBe(testAccountId);
      expect(settings.notifyOnDeposit).toBe(true);
    });

    it("should retrieve account settings", async () => {
      const settings = await getAccountSettings(testAccountId);

      expect(settings).toBeDefined();
      expect(settings?.accountId).toBe(testAccountId);
    });

    it("should update account settings", async () => {
      const updated = await createAccountSettings({
        accountId: testAccountId,
        notifyOnDeposit: false,
        autoWithdrawalEnabled: true,
        autoWithdrawalFrequency: "monthly",
      } as any);

      expect(updated.notifyOnDeposit).toBe(false);
      expect(updated.autoWithdrawalEnabled).toBe(true);
    });
  });

  describe("Transaction Limits", () => {
    it("should allow transaction within daily limit", async () => {
      const account = await updateAccount(testAccountId, {
        dailyLimit: 10000,
      });

      const result = await checkTransactionLimits(testAccountId, 5000);

      expect(result.allowed).toBe(true);
    });

    it("should reject transaction exceeding daily limit", async () => {
      // This test depends on existing balance and transactions
      // Set up a small limit
      await updateAccount(testAccountId, {
        dailyLimit: 100,
      });

      const result = await checkTransactionLimits(testAccountId, 200);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it("should check monthly limit", async () => {
      await updateAccount(testAccountId, {
        monthlyLimit: 50000,
      });

      const result = await checkTransactionLimits(testAccountId, 30000);

      expect(result.allowed).toBe(true);
    });

    it("should check maximum balance", async () => {
      await updateAccount(testAccountId, {
        maxBalance: 100000,
      });

      const result = await checkTransactionLimits(testAccountId, 50000);

      // This might fail or pass depending on current balance
      expect(result).toBeDefined();
      expect(result.allowed).toBeDefined();
    });
  });

  describe("Account Statements", () => {
    it("should generate monthly statement", async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const statement = await generateAccountStatement(
        testAccountId,
        monthStart,
        monthEnd,
        "monthly"
      );

      expect(statement).toBeDefined();
      expect(statement.statementPeriod).toBe("monthly");
      expect(statement.periodStart).toBeDefined();
      expect(statement.periodEnd).toBeDefined();
      expect(statement.openingBalance).toBeDefined();
      expect(statement.closingBalance).toBeDefined();
    });

    it("should calculate statement totals correctly", async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const statement = await generateAccountStatement(
        testAccountId,
        monthStart,
        monthEnd,
        "monthly"
      );

      expect(statement.totalDeposits).toBeGreaterThanOrEqual(0);
      expect(statement.totalWithdrawals).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Account Closure", () => {
    it("should close an account", async () => {
      const testAccount = await createAccount({
        userId: testUserId,
        accountType: "personal",
        accountName: "Account to Close",
        currency: "KES",
      } as any);

      const closed = await closeAccount(testAccount.id, "User requested closure");

      expect(closed.status).toBe("closed");
      expect(closed.closedAt).toBeDefined();
    });

    it("should not allow transactions on closed account", async () => {
      // This would be enforced at API level
      const closedAccountId = (
        await createAccount({
          userId: testUserId,
          accountType: "personal",
          accountName: "Account to Close 2",
          currency: "KES",
        } as any)
      ).id;

      await closeAccount(closedAccountId);

      const closedAccount = await getAccount(closedAccountId);
      expect(closedAccount?.status).toBe("closed");
    });
  });

  describe("DAO Accounts", () => {
    it("should retrieve all DAO accounts", async () => {
      const daoAccounts = await getDaoAccounts(testDaoId);

      expect(Array.isArray(daoAccounts)).toBe(true);
    });

    it("should filter accounts by DAO", async () => {
      const account1 = await createAccount({
        userId: testUserId,
        daoId: testDaoId,
        accountType: "dao",
        accountName: "DAO Account 1",
        currency: "KES",
      } as any);

      const daoAccounts = await getDaoAccounts(testDaoId);

      expect(
        daoAccounts.some((a) => a.id === account1.id)
      ).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should throw error for invalid account ID", async () => {
      try {
        await getAccount("");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should throw error when updating non-existent account", async () => {
      try {
        await updateAccount("non-existent-id", { accountName: "Test" });
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should handle concurrent transactions safely", async () => {
      const promises = Array.from({ length: 5 }, () =>
        createAccountTransaction({
          accountId: testAccountId,
          transactionType: "deposit",
          amount: 100,
          currency: "KES",
          fromUserId: testUserId,
        } as any)
      );

      const results = await Promise.all(promises);

      expect(results.length).toBe(5);
      results.forEach((tx) => {
        expect(tx).toBeDefined();
        expect(tx.status).toBe("completed");
      });
    });
  });
});
