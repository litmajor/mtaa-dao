/**
 * Service Account Manager
 * Manages unified service account across all 7 supported chains
 * Handles account initialization, balance tracking, liquidity rebalancing recommendations
 */

import { db } from '../db';
import { getMultiChainProvider, MultiChainProvider } from './multiChainProvider';
import { CHAIN_CONFIG, SupportedChain, getAllChains, estimateGasCostUSD } from '../../shared/chainConfiguration';
import { Logger } from '../utils/logger';
import { chainAccounts, crossChainTransfers, chainMetrics } from '../../shared/accountSchema';
import { eq, and, desc } from 'drizzle-orm';

const logger = new Logger('service-account-manager');

export interface ServiceAccountConfig {
  id: string;                    // Unique ID for service account
  privateKey: string;            // Encrypted private key
  ethereumAddress: string;       // Same address on all EVM chains (0x...)
  tronAddress?: string;          // Different format for Tron (T...)
  network: 'mainnet' | 'testnet';
}

export interface ChainLiquidity {
  chain: SupportedChain;
  token: string;
  balance: string;
  balanceUSD: string;
  lastUpdated: Date;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
}

export interface UnifiedLiquidity {
  serviceAccountId: string;
  totalValueUSD: string;
  chains: ChainLiquidity[];
  liquidityScore: number;       // 1-10, how evenly distributed
  riskScore: number;            // 1-10, concentration risk
  recommendations: string[];
  lastUpdate: Date;
}

export class ServiceAccountManager {
  private serviceAccountId: string;
  private multiChainProvider: MultiChainProvider;
  private ethereumAddress: string;
  private tronAddress?: string;
  private network: 'mainnet' | 'testnet';

  constructor(config: ServiceAccountConfig, provider: MultiChainProvider) {
    this.serviceAccountId = config.id;
    this.ethereumAddress = config.ethereumAddress;
    this.tronAddress = config.tronAddress;
    this.network = config.network;
    this.multiChainProvider = provider;

    logger.info(`Initialized ServiceAccountManager for ${config.ethereumAddress}`);
  }

  /**
   * Initialize service account on a specific chain
   */
  async initializeChainAccount(chain: SupportedChain): Promise<void> {
    try {
      const config = CHAIN_CONFIG[chain];
      if (!config) throw new Error(`Unknown chain: ${chain}`);

      // Get initial balance
      const address = chain === 'tron' ? this.tronAddress || this.ethereumAddress : this.ethereumAddress;
      const balance = await this.multiChainProvider.getBalance(chain, address);

      // Store in database
      await db.insert(chainAccounts).values({
        serviceAccountId: this.serviceAccountId,
        chain,
        walletAddress: address,
        balance: balance.toString(),
        balanceUSD: '0', // Will be updated by metrics service
        tokenSymbol: config.nativeToken,
        tokenAddress: config.nativeToken,
        tokenBalance: balance.toString(),
        rpcUrl: config.rpc.mainnet,
        blockExplorerUrl: config.blockExplorer.mainnet,
        syncStatus: 'synced',
        lastSync: new Date(),
      });

      logger.info(`✅ Initialized chain account on ${chain}: ${address}`);
    } catch (error) {
      logger.error(`❌ Failed to initialize chain account on ${chain}: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Update balance for service account on a chain
   */
  async updateChainBalance(chain: SupportedChain, token: string = 'NATIVE'): Promise<string> {
    try {
      const config = CHAIN_CONFIG[chain];
      if (!config) throw new Error(`Unknown chain: ${chain}`);

      const address = chain === 'tron' ? this.tronAddress || this.ethereumAddress : this.ethereumAddress;

      // Fetch balance
      const balance = await this.multiChainProvider.getBalance(chain, address);

      // Update database
      await db
        .update(chainAccounts)
        .set({
          balance: balance.toString(),
          tokenBalance: balance.toString(),
          lastSync: new Date(),
          syncStatus: 'synced',
        })
        .where(
          and(
            eq(chainAccounts.serviceAccountId, this.serviceAccountId),
            eq(chainAccounts.chain, chain),
            eq(chainAccounts.tokenSymbol, config.nativeToken)
          )
        );

      logger.debug(`Updated balance on ${chain}: ${balance.toString()}`);
      return balance.toString();
    } catch (error) {
      logger.error(`Failed to update balance on ${chain}: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Get unified liquidity summary across all chains
   */
  async getUnifiedLiquidity(): Promise<UnifiedLiquidity> {
    try {
      // Fetch all chain accounts
      const accounts = await db
        .select()
        .from(chainAccounts)
        .where(eq(chainAccounts.serviceAccountId, this.serviceAccountId));

      if (accounts.length === 0) {
        throw new Error('No chain accounts found for service account');
      }

      const chains: ChainLiquidity[] = [];
      let totalValueUSD = 0;

      // Calculate totals and build chain liquidity
      for (const account of accounts) {
        const balanceNum = parseFloat(account.balanceUSD || '0');
        totalValueUSD += balanceNum;

        chains.push({
          chain: account.chain as SupportedChain,
          token: account.tokenSymbol || 'UNKNOWN',
          balance: account.balance || '0',
          balanceUSD: account.balanceUSD || '0',
          lastUpdated: account.lastSync || new Date(),
          syncStatus: (account.syncStatus as any) || 'pending',
        });
      }

      // Calculate liquidity distribution score (1-10)
      const liquidityScore = this.calculateLiquidityScore(chains, totalValueUSD);

      // Calculate risk score (concentration risk)
      const riskScore = this.calculateRiskScore(chains, totalValueUSD);

      // Generate recommendations
      const recommendations = this.generateRecommendations(chains, totalValueUSD, riskScore);

      return {
        serviceAccountId: this.serviceAccountId,
        totalValueUSD: totalValueUSD.toFixed(6),
        chains: chains.sort((a, b) => parseFloat(b.balanceUSD) - parseFloat(a.balanceUSD)),
        liquidityScore,
        riskScore,
        recommendations,
        lastUpdate: new Date(),
      };
    } catch (error) {
      logger.error(`Failed to get unified liquidity: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Calculate liquidity distribution score (1-10)
   * 10 = perfectly distributed, 1 = all on one chain
   */
  private calculateLiquidityScore(chains: ChainLiquidity[], totalValueUSD: number): number {
    if (totalValueUSD === 0 || chains.length === 0) return 0;

    // Calculate concentration ratio (Herfindahl index)
    let concentrationSum = 0;
    for (const chain of chains) {
      const percentage = parseFloat(chain.balanceUSD) / totalValueUSD;
      concentrationSum += percentage * percentage;
    }

    // Convert to 1-10 scale (lower concentration = higher score)
    // Perfect distribution = chains.length * (1/chains.length)^2
    const maxChains = 7;
    const perfectConcentration = 1 / maxChains;
    const maxScore = maxChains * perfectConcentration * perfectConcentration;

    const score = (1 - concentrationSum / maxScore) * 10;
    return Math.max(1, Math.min(10, Math.round(score * 2) / 2));
  }

  /**
   * Calculate risk score based on concentration (1-10, higher = riskier)
   */
  private calculateRiskScore(chains: ChainLiquidity[], totalValueUSD: number): number {
    if (totalValueUSD === 0) return 1;

    // Find largest concentration
    let maxConcentration = 0;
    for (const chain of chains) {
      const percentage = parseFloat(chain.balanceUSD) / totalValueUSD;
      maxConcentration = Math.max(maxConcentration, percentage);
    }

    // Convert to 1-10 scale (high concentration = high risk)
    const riskScore = (maxConcentration - 1/7) / (1 - 1/7) * 10;
    return Math.max(1, Math.min(10, Math.round(riskScore * 2) / 2));
  }

  /**
   * Generate rebalancing recommendations
   */
  private generateRecommendations(
    chains: ChainLiquidity[],
    totalValueUSD: number,
    riskScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (riskScore > 7 && totalValueUSD > 0) {
      // Find largest holding
      const largest = chains.reduce((max, current) =>
        parseFloat(current.balanceUSD) > parseFloat(max.balanceUSD) ? current : max
      );

      const percentage = (parseFloat(largest.balanceUSD) / totalValueUSD) * 100;
      recommendations.push(
        `High concentration risk: ${percentage.toFixed(1)}% on ${largest.chain} (risk score: ${riskScore}/10)`
      );

      // Find smallest holding
      const smallest = chains.reduce((min, current) =>
        parseFloat(current.balanceUSD) < parseFloat(min.balanceUSD) ? current : min
      );

      recommendations.push(
        `Consider rebalancing: Move ${(percentage / 7).toFixed(1)}% from ${largest.chain} to ${smallest.chain}`
      );
    }

    // Check for inactive chains
    const inactiveChains = chains.filter(c => c.syncStatus === 'failed');
    if (inactiveChains.length > 0) {
      recommendations.push(
        `⚠️ Sync issues on: ${inactiveChains.map(c => c.chain).join(', ')} - check RPC connection`
      );
    }

    // Check for stale data
    const staleChains = chains.filter(
      c => Date.now() - c.lastUpdated.getTime() > 60 * 60 * 1000 // 1 hour
    );
    if (staleChains.length > 0) {
      recommendations.push(
        `Balance data stale for: ${staleChains.map(c => c.chain).join(', ')}`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Liquidity is well-distributed across chains');
    }

    return recommendations;
  }

  /**
   * Get gas cost estimates across all chains
   */
  getGasEstimates(): Record<SupportedChain, { native: number; erc20: number }> {
    const estimates: Record<string, { native: number; erc20: number }> = {};

    for (const chain of getAllChains()) {
      estimates[chain.id] = {
        native: estimateGasCostUSD(chain.id as SupportedChain, true),
        erc20: estimateGasCostUSD(chain.id as SupportedChain, false),
      };
    }

    return estimates as Record<SupportedChain, { native: number; erc20: number }>;
  }

  /**
   * Record cross-chain transfer
   */
  async recordCrossChainTransfer(
    withdrawalId: string,
    sourceChain: SupportedChain,
    targetChain: SupportedChain,
    sourceToken: string,
    targetToken: string,
    sourceAmount: string,
    targetAmount: string,
    recipientAddress: string,
    bridgeProtocol: string = 'direct',
    gasFeeSource: string = '0',
    gasFeeTarget: string = '0',
    bridgeFee: string = '0',
    estimatedTime: number = 300
  ): Promise<void> {
    try {
      const totalCost = (parseFloat(gasFeeSource) + parseFloat(gasFeeTarget) + parseFloat(bridgeFee)).toFixed(6);

      await db.insert(crossChainTransfers).values({
        withdrawalId,
        sourceChain,
        targetChain,
        sourceToken,
        targetToken,
        sourceAmount,
        targetAmount,
        recipientAddress,
        bridgeProtocol,
        gasFeeSource,
        gasFeeTarget,
        bridgeFee,
        totalCostUSD: totalCost,
        estimatedTime,
        status: 'pending',
        createdAt: new Date(),
      });

      logger.info(
        `📝 Recorded cross-chain transfer: ${sourceAmount} ${sourceToken} (${sourceChain}) → ${targetAmount} ${targetToken} (${targetChain})`
      );
    } catch (error) {
      logger.error(`Failed to record cross-chain transfer: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Update cross-chain transfer status
   */
  async updateTransferStatus(
    transferId: string,
    status: 'pending' | 'bridging' | 'confirmed' | 'failed' | 'refunded',
    reason?: string
  ): Promise<void> {
    try {
      await db
        .update(crossChainTransfers)
        .set({
          status,
          statusReason: reason,
          confirmedAt: status === 'confirmed' ? new Date() : undefined,
          completedAt: ['confirmed', 'failed', 'refunded'].includes(status) ? new Date() : undefined,
        })
        .where(eq(crossChainTransfers.id, transferId));

      logger.info(`Updated transfer ${transferId} status to ${status}`);
    } catch (error) {
      logger.error(`Failed to update transfer status: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Get recent transfer history (last N transfers across all chains)
   */
  async getRecentTransfers(limit: number = 50): Promise<typeof crossChainTransfers.$inferSelect[]> {
    try {
      const transfers = await db
        .select()
        .from(crossChainTransfers)
        .orderBy(desc(crossChainTransfers.createdAt))
        .limit(limit);

      return transfers;
    } catch (error) {
      logger.error(`Failed to get recent transfers: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Calculate total transfer costs by bridge protocol
   */
  async getTransferCostsByBridge(): Promise<Record<string, { count: number; totalCostUSD: string }>> {
    try {
      const transfers = await db.select().from(crossChainTransfers);

      const costs: Record<string, { count: number; totalCostUSD: string }> = {};

      for (const transfer of transfers) {
        const protocol = transfer.bridgeProtocol || 'unknown';
        if (!costs[protocol]) {
          costs[protocol] = { count: 0, totalCostUSD: '0' };
        }

        costs[protocol].count++;
        costs[protocol].totalCostUSD = (
          parseFloat(costs[protocol].totalCostUSD) + parseFloat(transfer.totalCostUSD || '0')
        ).toFixed(6);
      }

      return costs;
    } catch (error) {
      logger.error(`Failed to get transfer costs: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Get service account status summary
   */
  async getStatus(): Promise<{
    serviceAccountId: string;
    ethereumAddress: string;
    tronAddress?: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    chainStatus: Record<SupportedChain, { syncStatus: string; lastSync: Date | null }>;
    totalTransfers: number;
    successfulTransfers: number;
    failedTransfers: number;
  }> {
    try {
      const accounts = await db
        .select()
        .from(chainAccounts)
        .where(eq(chainAccounts.serviceAccountId, this.serviceAccountId));

      const transfers = await db.select().from(crossChainTransfers);
      const successfulTransfers = transfers.filter((t: typeof crossChainTransfers.$inferSelect) => t.status === 'confirmed').length;
      const failedTransfers = transfers.filter((t: typeof crossChainTransfers.$inferSelect) => t.status === 'failed').length;

      const chainStatus: Record<string, { syncStatus: string; lastSync: Date | null }> = {};
      for (const account of accounts) {
        chainStatus[account.chain] = {
          syncStatus: account.syncStatus || 'unknown',
          lastSync: account.lastSync,
        };
      }

      // Determine overall status
      const failedChains = Object.values(chainStatus).filter(c => c.syncStatus === 'failed').length;
      const overallStatus =
        failedChains > 0
          ? failedChains >= accounts.length * 0.5
            ? 'unhealthy'
            : 'degraded'
          : 'healthy';

      return {
        serviceAccountId: this.serviceAccountId,
        ethereumAddress: this.ethereumAddress,
        tronAddress: this.tronAddress,
        status: overallStatus,
        chainStatus: chainStatus as Record<SupportedChain, { syncStatus: string; lastSync: Date | null }>,
        totalTransfers: transfers.length,
        successfulTransfers,
        failedTransfers,
      };
    } catch (error) {
      logger.error(`Failed to get status: ${(error as any).message}`);
      throw error;
    }
  }
}

/**
 * Factory function to create or retrieve service account manager
 */
let instance: ServiceAccountManager | null = null;

export async function initializeServiceAccountManager(
  config: ServiceAccountConfig,
  provider: MultiChainProvider
): Promise<ServiceAccountManager> {
  if (!instance) {
    instance = new ServiceAccountManager(config, provider);

    // Initialize all chain accounts
    const chains = getAllChains();
    for (const chain of chains) {
      try {
        await instance.initializeChainAccount(chain.id as SupportedChain);
      } catch (error) {
        logger.warn(`Failed to initialize ${chain.id}: ${(error as any).message}`);
      }
    }
  }

  return instance;
}

export function getServiceAccountManager(): ServiceAccountManager {
  if (!instance) {
    throw new Error('ServiceAccountManager not initialized. Call initializeServiceAccountManager first.');
  }
  return instance;
}

export function destroyServiceAccountManager(): void {
  instance = null;
}
