/**
 * Wallet Integration Service - Phase 2
 * Multi-chain wallet connectivity and blockchain transaction management
 */

import { db } from "../db";
import {
  blockchainNetworks,
  blockchainTokens,
  walletConnections,
  walletTokenBalances,
  blockchainTransactions,
  transactionQueue,
  walletConnectionHistory,
  networkHealth,
  InsertWalletConnection,
  InsertBlockchainTransaction,
  InsertTransactionQueue,
  WalletConnection,
  BlockchainTransaction,
  BlockchainToken,
} from "@shared/walletIntegrationSchema";
import { accounts } from "@shared/schema";
import { eq, and, gte, lte, desc, sql, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/**
 * Connect wallet to account
 */
export async function connectWallet(
  accountId: string,
  userId: string,
  chainId: number,
  walletAddress: string,
  walletLabel?: string
): Promise<WalletConnection> {
  // Verify account exists
  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!account[0]) {
    throw new Error("Account not found");
  }

  // Check if network is supported
  const network = await db
    .select()
    .from(blockchainNetworks)
    .where(eq(blockchainNetworks.chainId, chainId))
    .limit(1);

  if (!network[0] || !network[0].isActive) {
    throw new Error("Network not supported or inactive");
  }

  // Create wallet connection
  const connection = await db
    .insert(walletConnections)
    .values({
      id: uuidv4(),
      accountId,
      userId,
      chainId,
      walletAddress: walletAddress.toLowerCase(),
      walletLabel,
      isConnected: true,
      isPrimary: false,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!connection[0]) {
    throw new Error("Failed to create wallet connection");
  }

  // Log connection
  await logWalletHistory(connection[0].id, "connected", { walletLabel });

  return connection[0];
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet(walletConnectionId: string): Promise<void> {
  await db
    .update(walletConnections)
    .set({
      isConnected: false,
      updatedAt: new Date(),
    })
    .where(eq(walletConnections.id, walletConnectionId));

  await logWalletHistory(walletConnectionId, "disconnected", {});
}

/**
 * Get wallet connections for account
 */
export async function getWalletConnections(
  accountId: string
): Promise<WalletConnection[]> {
  return db
    .select()
    .from(walletConnections)
    .where(eq(walletConnections.accountId, accountId));
}

/**
 * Get wallet connection by address
 */
export async function getWalletByAddress(
  walletAddress: string,
  chainId: number
): Promise<WalletConnection | null> {
  const result = await db
    .select()
    .from(walletConnections)
    .where(
      and(
        eq(walletConnections.walletAddress, walletAddress.toLowerCase()),
        eq(walletConnections.chainId, chainId)
      )
    )
    .limit(1);

  return result[0] || null;
}

/**
 * Sync wallet balances from blockchain
 */
export async function syncWalletBalances(
  walletConnectionId: string,
  balances: { tokenId: string; balance: string; balanceUsd: string }[]
): Promise<void> {
  const wallet = await db
    .select()
    .from(walletConnections)
    .where(eq(walletConnections.id, walletConnectionId))
    .limit(1);

  if (!wallet[0]) {
    throw new Error("Wallet not found");
  }

  // Update native balance if included
  const nativeBalance = balances.find((b) => b.tokenId === "native");
  if (nativeBalance) {
    await db
      .update(walletConnections)
      .set({
        nativeBalance: nativeBalance.balance,
        lastSyncedAt: new Date(),
      })
      .where(eq(walletConnections.id, walletConnectionId));
  }

  // Update token balances
  for (const balance of balances) {
    if (balance.tokenId === "native") continue;

    const existing = await db
      .select()
      .from(walletTokenBalances)
      .where(
        and(
          eq(walletTokenBalances.walletConnectionId, walletConnectionId),
          eq(walletTokenBalances.tokenId, balance.tokenId)
        )
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(walletTokenBalances)
        .set({
          previousBalance: existing[0].balance,
          balance: balance.balance,
          balanceUsd: balance.balanceUsd,
          balanceChangedAt: new Date(),
          lastUpdatedAt: new Date(),
        })
        .where(
          and(
            eq(walletTokenBalances.walletConnectionId, walletConnectionId),
            eq(walletTokenBalances.tokenId, balance.tokenId)
          )
        );
    } else {
      await db.insert(walletTokenBalances).values({
        id: uuidv4(),
        walletConnectionId,
        tokenId: balance.tokenId as any,
        chainId: wallet[0].chainId,
        balance: balance.balance,
        balanceUsd: balance.balanceUsd,
        lastUpdatedAt: new Date(),
        createdAt: new Date(),
      });
    }
  }

  await logWalletHistory(walletConnectionId, "synced", {
    tokenCount: balances.length,
  });
}

/**
 * Queue transaction
 */
export async function queueTransaction(
  walletConnectionId: string,
  toAddress: string,
  amount: string,
  tokenSymbol?: string,
  description?: string
): Promise<string> {
  const wallet = await db
    .select()
    .from(walletConnections)
    .where(eq(walletConnections.id, walletConnectionId))
    .limit(1);

  if (!wallet[0]) {
    throw new Error("Wallet not found");
  }

  // Check daily limit
  if (wallet[0].dailyLimit) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dailyTotal = await db
      .select({ total: sql`SUM(amount)` })
      .from(transactionQueue)
      .where(
        and(
          eq(transactionQueue.walletConnectionId, walletConnectionId),
          eq(transactionQueue.queueStatus, "completed"),
          gte(transactionQueue.createdAt, today),
          lte(transactionQueue.createdAt, tomorrow)
        )
      );

    const spent = parseFloat(dailyTotal[0]?.total as string || "0");
    if (spent + parseFloat(amount) > parseFloat(wallet[0].dailyLimit as string)) {
      throw new Error("Daily limit exceeded");
    }
  }

  const queuedTx = await db
    .insert(transactionQueue)
    .values({
      id: uuidv4(),
      walletConnectionId,
      chainId: wallet[0].chainId,
      toAddress: toAddress.toLowerCase(),
      tokenSymbol,
      amount,
      queueStatus: "pending",
      priority: 0,
      maxRetries: 3,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!queuedTx[0]) {
    throw new Error("Failed to queue transaction");
  }

  return queuedTx[0].id;
}

/**
 * Get transaction queue
 */
export async function getTransactionQueue(
  status?: string,
  limit: number = 50
): Promise<any[]> {
  const query = db.select().from(transactionQueue);

  const result = status
    ? query.where(eq(transactionQueue.queueStatus, status))
    : query;

  return result
    .orderBy(asc(transactionQueue.priority), asc(transactionQueue.createdAt))
    .limit(limit);
}

/**
 * Update transaction queue status
 */
export async function updateQueueStatus(
  queueId: string,
  status: string,
  txHash?: string,
  fee?: string,
  error?: string
): Promise<void> {
  await db
    .update(transactionQueue)
    .set({
      queueStatus: status,
      txHash,
      actualFee: fee,
      lastRetryError: error,
      updatedAt: new Date(),
    })
    .where(eq(transactionQueue.id, queueId));
}

/**
 * Record blockchain transaction
 */
export async function recordTransaction(
  walletConnectionId: string,
  txHash: string,
  fromAddress: string,
  toAddress: string,
  amount: string,
  amountUsd?: string,
  tokenSymbol?: string,
  gasUsed?: string,
  gasFee?: string,
  transactionType: string = "transfer"
): Promise<BlockchainTransaction> {
  const wallet = await db
    .select()
    .from(walletConnections)
    .where(eq(walletConnections.id, walletConnectionId))
    .limit(1);

  if (!wallet[0]) {
    throw new Error("Wallet not found");
  }

  const transaction = await db
    .insert(blockchainTransactions)
    .values({
      id: uuidv4(),
      txHash: txHash.toLowerCase(),
      chainId: wallet[0].chainId,
      walletConnectionId,
      accountId: wallet[0].accountId,
      userId: wallet[0].userId,
      fromAddress: fromAddress.toLowerCase(),
      toAddress: toAddress.toLowerCase(),
      tokenSymbol,
      amount,
      amountUsd,
      gasUsed,
      txFee: gasFee,
      status: "pending",
      transactionType,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!transaction[0]) {
    throw new Error("Failed to record transaction");
  }

  return transaction[0];
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  txHash: string,
  status: string,
  blockNumber?: number,
  confirmations?: number,
  blockTimestamp?: Date
): Promise<void> {
  await db
    .update(blockchainTransactions)
    .set({
      status,
      blockNumber,
      confirmations,
      blockTimestamp,
      updatedAt: new Date(),
    })
    .where(eq(blockchainTransactions.txHash, txHash.toLowerCase()));
}

/**
 * Get transactions for wallet
 */
export async function getWalletTransactions(
  walletConnectionId: string,
  limit: number = 50,
  offset: number = 0
): Promise<BlockchainTransaction[]> {
  return db
    .select()
    .from(blockchainTransactions)
    .where(eq(blockchainTransactions.walletConnectionId, walletConnectionId))
    .orderBy(desc(blockchainTransactions.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get transaction by hash
 */
export async function getTransactionByHash(
  txHash: string
): Promise<BlockchainTransaction | null> {
  const result = await db
    .select()
    .from(blockchainTransactions)
    .where(eq(blockchainTransactions.txHash, txHash.toLowerCase()))
    .limit(1);

  return result[0] || null;
}

/**
 * Get supported networks
 */
export async function getSupportedNetworks(): Promise<any[]> {
  return db
    .select()
    .from(blockchainNetworks)
    .where(eq(blockchainNetworks.isActive, true));
}

/**
 * Get tokens for network
 */
export async function getNetworkTokens(chainId: number): Promise<BlockchainToken[]> {
  return db
    .select()
    .from(blockchainTokens)
    .where(and(eq(blockchainTokens.chainId, chainId), eq(blockchainTokens.isActive, true)));
}

/**
 * Update token price
 */
export async function updateTokenPrice(
  tokenId: string,
  price: string,
  marketCap?: string,
  volume24h?: string,
  percentChange24h?: string
): Promise<void> {
  await db
    .update(blockchainTokens)
    .set({
      currentPrice: price,
      marketCap,
      volume24h,
      percentChange24h,
      priceUpdatedAt: new Date(),
    })
    .where(eq(blockchainTokens.id, tokenId));
}

/**
 * Log wallet connection event
 */
export async function logWalletHistory(
  walletConnectionId: string,
  eventType: string,
  eventData: any,
  status: string = "success",
  error?: string
): Promise<void> {
  await db.insert(walletConnectionHistory).values({
    id: uuidv4(),
    walletConnectionId,
    eventType,
    eventData,
    status,
    errorMessage: error,
    createdAt: new Date(),
  });
}

/**
 * Record network health
 */
export async function recordNetworkHealth(
  chainId: number,
  isHealthy: boolean,
  rpcLatency?: string,
  blockTime?: string,
  gasPrice?: string,
  blockNumber?: number,
  failedRequests: number = 0,
  successRate: string = "100"
): Promise<void> {
  const existing = await db
    .select()
    .from(networkHealth)
    .where(eq(networkHealth.chainId, chainId))
    .orderBy(desc(networkHealth.createdAt))
    .limit(1);

  if (existing[0]) {
    await db
      .update(networkHealth)
      .set({
        isHealthy,
        rpcLatency,
        blockTime,
        gasPrice,
        blockNumber,
        failedRequests,
        successRate,
        lastCheckedAt: new Date(),
      })
      .where(eq(networkHealth.id, existing[0].id));
  } else {
    await db.insert(networkHealth).values({
      id: uuidv4(),
      chainId,
      isHealthy,
      rpcLatency,
      blockTime,
      gasPrice,
      blockNumber,
      failedRequests,
      successRate,
      lastCheckedAt: new Date(),
      createdAt: new Date(),
    });
  }
}

/**
 * Get network health
 */
export async function getNetworkHealth(chainId: number): Promise<any | null> {
  const result = await db
    .select()
    .from(networkHealth)
    .where(eq(networkHealth.chainId, chainId))
    .orderBy(desc(networkHealth.lastCheckedAt))
    .limit(1);

  return result[0] || null;
}

/**
 * Verify wallet ownership
 */
export async function verifyWalletOwnership(
  walletConnectionId: string,
  signature: string
): Promise<boolean> {
  const wallet = await db
    .select()
    .from(walletConnections)
    .where(eq(walletConnections.id, walletConnectionId))
    .limit(1);

  if (!wallet[0]) {
    throw new Error("Wallet not found");
  }

  // Verification would happen here via blockchain call
  // For now, we'll just mark as verified
  await db
    .update(walletConnections)
    .set({
      isVerified: true,
      verificationSignature: signature,
      updatedAt: new Date(),
    })
    .where(eq(walletConnections.id, walletConnectionId));

  await logWalletHistory(walletConnectionId, "verified", {});

  return true;
}

/**
 * Get wallet portfolio (all balances across tokens)
 */
export async function getWalletPortfolio(
  walletConnectionId: string
): Promise<any> {
  const wallet = await db
    .select()
    .from(walletConnections)
    .where(eq(walletConnections.id, walletConnectionId))
    .limit(1);

  if (!wallet[0]) {
    throw new Error("Wallet not found");
  }

  const balances = await db
    .select()
    .from(walletTokenBalances)
    .where(eq(walletTokenBalances.walletConnectionId, walletConnectionId));

  const totalUsd = balances.reduce(
    (sum: number, b: any) => sum + parseFloat(b.balanceUsd as string || "0"),
    parseFloat(wallet[0].nativeBalance as string || "0") * 
      (await getNetworkPrice(wallet[0].chainId))
  );

  return {
    wallet: wallet[0],
    balances,
    totalUsd,
  };
}

/**
 * Get network native token price (helper)
 */
async function getNetworkPrice(chainId: number): Promise<number> {
  const network = await db
    .select()
    .from(blockchainNetworks)
    .where(eq(blockchainNetworks.chainId, chainId))
    .limit(1);

  if (!network[0]) return 0;

  const token = await db
    .select()
    .from(blockchainTokens)
    .where(
      and(
        eq(blockchainTokens.chainId, chainId),
        eq(blockchainTokens.isNativeToken, true)
      )
    )
    .limit(1);

  return parseFloat(token[0]?.currentPrice as string || "0");
}

export default {
  connectWallet,
  disconnectWallet,
  getWalletConnections,
  getWalletByAddress,
  syncWalletBalances,
  queueTransaction,
  getTransactionQueue,
  updateQueueStatus,
  recordTransaction,
  updateTransactionStatus,
  getWalletTransactions,
  getTransactionByHash,
  getSupportedNetworks,
  getNetworkTokens,
  updateTokenPrice,
  logWalletHistory,
  recordNetworkHealth,
  getNetworkHealth,
  verifyWalletOwnership,
  getWalletPortfolio,
};
