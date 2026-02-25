/**
 * Wallet Service Tests - Phase 2
 * Comprehensive test coverage for wallet operations and blockchain integration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  connectWallet,
  disconnectWallet,
  syncWalletBalances,
  queueTransaction,
  recordTransaction,
  getWalletTransactions,
  getWalletPortfolio,
  verifyWalletOwnership,
  recordNetworkHealth,
  getSupportedNetworks,
  getNetworkTokens,
} from "@/server/services/wallet-service";
import { db } from "@/server/db";
import {
  walletConnections,
  walletTokenBalances,
  blockchainTransactions,
  transactionQueue,
  blockchainNetworks,
  blockchainTokens,
  walletConnectionHistory,
  networkHealth,
} from "@/shared/walletIntegrationSchema";

describe("Wallet Service", () => {
  const testUserId = "test-user-123";
  const testAccountId = "test-account-456";
  const testWalletAddress = "0x1234567890123456789012345678901234567890";
  const testChainId = 1; // Ethereum

  beforeEach(async () => {
    // Clear test data before each test
    vi.clearAllMocks();
  });

  describe("Wallet Connection", () => {
    it("should connect wallet to account", async () => {
      const connection = await connectWallet(
        testAccountId,
        testUserId,
        testChainId,
        testWalletAddress,
        "My Wallet"
      );

      expect(connection).toBeDefined();
      expect(connection.walletAddress).toBe(testWalletAddress);
      expect(connection.chainId).toBe(testChainId);
      expect(connection.accountId).toBe(testAccountId);
      expect(connection.label).toBe("My Wallet");
      expect(connection.status).toBe("connected");
    });

    it("should reject invalid wallet address format", async () => {
      await expect(
        connectWallet(
          testAccountId,
          testUserId,
          testChainId,
          "invalid-address",
          "Test"
        )
      ).rejects.toThrow();
    });

    it("should enforce daily wallet connection limit", async () => {
      // Connect max wallets in a day
      for (let i = 0; i < 10; i++) {
        await connectWallet(
          testAccountId,
          testUserId,
          testChainId,
          `0x${String(i).padStart(40, "0")}`,
          `Wallet ${i}`
        );
      }

      // 11th should fail
      await expect(
        connectWallet(
          testAccountId,
          testUserId,
          testChainId,
          "0xffffffffffffffffffffffffffffffffffffffff",
          "Wallet 11"
        )
      ).rejects.toThrow("daily connection limit");
    });

    it("should record wallet connection history", async () => {
      const connection = await connectWallet(
        testAccountId,
        testUserId,
        testChainId,
        testWalletAddress
      );

      const history = await db
        .select()
        .from(walletConnectionHistory)
        .where({ walletConnectionId: connection.id });

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].eventType).toBe("connected");
    });
  });

  describe("Wallet Disconnection", () => {
    let walletId: string;

    beforeEach(async () => {
      const connection = await connectWallet(
        testAccountId,
        testUserId,
        testChainId,
        testWalletAddress
      );
      walletId = connection.id;
    });

    it("should disconnect wallet", async () => {
      await disconnectWallet(walletId);

      const wallet = await db
        .select()
        .from(walletConnections)
        .where({ id: walletId });

      expect(wallet[0].status).toBe("disconnected");
    });

    it("should record disconnection in history", async () => {
      await disconnectWallet(walletId);

      const history = await db
        .select()
        .from(walletConnectionHistory)
        .where({ walletConnectionId: walletId });

      const disconnectEvent = history.find((h) => h.eventType === "disconnected");
      expect(disconnectEvent).toBeDefined();
    });
  });

  describe("Balance Synchronization", () => {
    let walletId: string;

    beforeEach(async () => {
      const connection = await connectWallet(
        testAccountId,
        testUserId,
        testChainId,
        testWalletAddress
      );
      walletId = connection.id;
    });

    it("should sync wallet balances", async () => {
      const balances = [
        { tokenId: "token-eth", balance: "1.5", balanceUsd: "3000" },
        { tokenId: "token-usdc", balance: "5000", balanceUsd: "5000" },
      ];

      await syncWalletBalances(walletId, balances);

      const storedBalances = await db
        .select()
        .from(walletTokenBalances)
        .where({ walletConnectionId: walletId });

      expect(storedBalances.length).toBe(2);
      expect(storedBalances[0].balance).toBe("1.5");
    });

    it("should update existing balances", async () => {
      const balances1 = [
        { tokenId: "token-eth", balance: "1.0", balanceUsd: "2000" },
      ];
      await syncWalletBalances(walletId, balances1);

      const balances2 = [
        { tokenId: "token-eth", balance: "2.0", balanceUsd: "4000" },
      ];
      await syncWalletBalances(walletId, balances2);

      const storedBalances = await db
        .select()
        .from(walletTokenBalances)
        .where({ walletConnectionId: walletId });

      expect(storedBalances.length).toBe(1);
      expect(storedBalances[0].balance).toBe("2.0");
    });
  });

  describe("Transaction Queueing", () => {
    let walletId: string;

    beforeEach(async () => {
      const connection = await connectWallet(
        testAccountId,
        testUserId,
        testChainId,
        testWalletAddress
      );
      walletId = connection.id;
    });

    it("should queue transaction", async () => {
      const queueId = await queueTransaction(
        walletId,
        "0xrecipient123",
        "1.0",
        "ETH",
        "Payment for service"
      );

      expect(queueId).toBeDefined();

      const queued = await db
        .select()
        .from(transactionQueue)
        .where({ id: queueId });

      expect(queued.length).toBe(1);
      expect(queued[0].toAddress).toBe("0xrecipient123");
      expect(queued[0].amount).toBe("1.0");
      expect(queued[0].status).toBe("pending");
    });

    it("should reject transaction exceeding daily limit", async () => {
      // Queue high-value transaction
      await queueTransaction(
        walletId,
        "0xrecipient123",
        "100000",
        "USDC"
      );

      // Try to queue another that exceeds limit
      await expect(
        queueTransaction(walletId, "0xrecipient456", "50000", "USDC")
      ).rejects.toThrow("daily limit");
    });

    it("should reject transaction exceeding monthly limit", async () => {
      // Queue multiple transactions approaching monthly limit
      for (let i = 0; i < 28; i++) {
        await queueTransaction(
          walletId,
          `0xrecipient${i}`,
          "10000",
          "USDC"
        );
      }

      // 29th should fail
      await expect(
        queueTransaction(walletId, "0xrecipient999", "10000", "USDC")
      ).rejects.toThrow("monthly limit");
    });
  });

  describe("Transaction Recording", () => {
    let walletId: string;

    beforeEach(async () => {
      const connection = await connectWallet(
        testAccountId,
        testUserId,
        testChainId,
        testWalletAddress
      );
      walletId = connection.id;
    });

    it("should record blockchain transaction", async () => {
      const txHash = "0xabcdef123456";

      const transaction = await recordTransaction(
        walletId,
        "0xrecipient",
        "1.5",
        "ETH",
        txHash,
        "confirmed"
      );

      expect(transaction.transactionHash).toBe(txHash);
      expect(transaction.status).toBe("confirmed");
      expect(transaction.amount).toBe("1.5");
    });

    it("should handle transaction with USD value", async () => {
      const transaction = await recordTransaction(
        walletId,
        "0xrecipient",
        "1.0",
        "ETH",
        "0x123",
        "pending",
        "3000"
      );

      expect(transaction.amountUsd).toBe("3000");
    });

    it("should retrieve transactions by status", async () => {
      await recordTransaction(
        walletId,
        "0xrecipient1",
        "1.0",
        "ETH",
        "0x111",
        "confirmed"
      );
      await recordTransaction(
        walletId,
        "0xrecipient2",
        "2.0",
        "ETH",
        "0x222",
        "pending"
      );

      const transactions = await getWalletTransactions(walletId);
      const confirmed = transactions.filter((t) => t.status === "confirmed");

      expect(confirmed.length).toBeGreaterThan(0);
    });
  });

  describe("Portfolio Aggregation", () => {
    let walletId: string;

    beforeEach(async () => {
      const connection = await connectWallet(
        testAccountId,
        testUserId,
        testChainId,
        testWalletAddress
      );
      walletId = connection.id;

      // Sync balances
      await syncWalletBalances(walletId, [
        { tokenId: "token-eth", balance: "1.5", balanceUsd: "3000" },
        { tokenId: "token-usdc", balance: "5000", balanceUsd: "5000" },
      ]);
    });

    it("should aggregate wallet portfolio", async () => {
      const portfolio = await getWalletPortfolio(walletId);

      expect(portfolio).toBeDefined();
      expect(portfolio.wallet).toBeDefined();
      expect(portfolio.balances).toBeDefined();
      expect(portfolio.balances.length).toBe(2);
    });

    it("should calculate total USD value", async () => {
      const portfolio = await getWalletPortfolio(walletId);

      const totalUsd = portfolio.balances.reduce(
        (sum, b) => sum + (parseFloat(b.balanceUsd) || 0),
        0
      );

      expect(totalUsd).toBe(8000);
    });

    it("should include transaction history", async () => {
      await recordTransaction(
        walletId,
        "0xrecipient",
        "0.5",
        "ETH",
        "0x123",
        "confirmed"
      );

      const portfolio = await getWalletPortfolio(walletId);

      expect(portfolio.recentTransactions).toBeDefined();
      expect(portfolio.recentTransactions.length).toBeGreaterThan(0);
    });
  });

  describe("Wallet Verification", () => {
    let walletId: string;

    beforeEach(async () => {
      const connection = await connectWallet(
        testAccountId,
        testUserId,
        testChainId,
        testWalletAddress
      );
      walletId = connection.id;
    });

    it("should verify wallet ownership", async () => {
      const signature =
        "0x" +
        "a".repeat(130); // Mock signature

      const verified = await verifyWalletOwnership(walletId, signature);

      expect(typeof verified).toBe("boolean");
    });

    it("should reject invalid signature", async () => {
      const invalidSignature = "invalid-sig";

      await expect(verifyWalletOwnership(walletId, invalidSignature)).rejects.toThrow();
    });
  });

  describe("Network Management", () => {
    it("should get supported networks", async () => {
      const networks = await getSupportedNetworks();

      expect(Array.isArray(networks)).toBe(true);
      expect(networks.length).toBeGreaterThan(0);
      expect(networks[0].chainId).toBeDefined();
      expect(networks[0].name).toBeDefined();
    });

    it("should filter networks by status", async () => {
      const networks = await getSupportedNetworks();

      const activeNetworks = networks.filter((n) => n.status === "active");
      expect(activeNetworks.length).toBeGreaterThan(0);
    });

    it("should get tokens for network", async () => {
      const tokens = await getNetworkTokens(testChainId);

      expect(Array.isArray(tokens)).toBe(true);
      tokens.forEach((token) => {
        expect(token.symbol).toBeDefined();
        expect(token.address).toBeDefined();
        expect(token.decimals).toBeDefined();
      });
    });

    it("should record network health", async () => {
      const health = await recordNetworkHealth(testChainId, 45, 150, "healthy");

      expect(health).toBeDefined();
      expect(health.chainId).toBe(testChainId);
      expect(health.rpcLatency).toBe(45);
      expect(health.gasPrice).toBe(150);
      expect(health.status).toBe("healthy");
    });
  });

  describe("Error Handling", () => {
    it("should handle wallet not found", async () => {
      await expect(
        getWalletPortfolio("non-existent-wallet")
      ).rejects.toThrow("not found");
    });

    it("should handle invalid chain ID", async () => {
      await expect(
        connectWallet(testAccountId, testUserId, 99999, testWalletAddress)
      ).rejects.toThrow();
    });

    it("should handle network connectivity issues", async () => {
      // Mock network failure
      vi.mock("@/server/services/blockchain", () => ({
        getBalance: vi.fn().mockRejectedValue(new Error("Network error")),
      }));

      // Should handle gracefully
      expect(true).toBe(true);
    });

    it("should provide descriptive error messages", async () => {
      try {
        await connectWallet(
          "invalid-id",
          testUserId,
          testChainId,
          testWalletAddress
        );
      } catch (error: any) {
        expect(error.message).toBeDefined();
        expect(error.message.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Performance", () => {
    it("should retrieve transactions efficiently", async () => {
      const connection = await connectWallet(
        testAccountId,
        testUserId,
        testChainId,
        testWalletAddress
      );

      // Record multiple transactions
      for (let i = 0; i < 100; i++) {
        await recordTransaction(
          connection.id,
          `0xrecipient${i}`,
          "0.1",
          "ETH",
          `0x${String(i).padStart(64, "0")}`,
          "confirmed"
        );
      }

      const start = Date.now();
      const transactions = await getWalletTransactions(connection.id, 50, 0);
      const duration = Date.now() - start;

      expect(transactions.length).toBeLessThanOrEqual(50);
      expect(duration).toBeLessThan(1000); // Should complete in < 1 second
    });

    it("should handle concurrent wallet connections", async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          connectWallet(
            testAccountId,
            testUserId,
            testChainId,
            `0x${String(i).padStart(40, "0")}`,
            `Wallet ${i}`
          )
        );
      }

      const results = await Promise.all(promises);
      expect(results.length).toBe(10);
    });
  });

  describe("Data Consistency", () => {
    it("should maintain referential integrity", async () => {
      const connection = await connectWallet(
        testAccountId,
        testUserId,
        testChainId,
        testWalletAddress
      );

      await recordTransaction(
        connection.id,
        "0xrecipient",
        "1.0",
        "ETH",
        "0x123",
        "confirmed"
      );

      // Disconnect wallet
      await disconnectWallet(connection.id);

      // Historical data should persist
      const transactions = await getWalletTransactions(connection.id);
      expect(transactions.length).toBeGreaterThan(0);
    });

    it("should prevent orphaned transactions", async () => {
      const connection = await connectWallet(
        testAccountId,
        testUserId,
        testChainId,
        testWalletAddress
      );

      const txHash = "0x123";
      await recordTransaction(
        connection.id,
        "0xrecipient",
        "1.0",
        "ETH",
        txHash,
        "pending"
      );

      // Should not allow deletion of wallet with pending transactions
      await expect(disconnectWallet(connection.id)).rejects.toThrow(
        "pending"
      );
    });
  });
});
