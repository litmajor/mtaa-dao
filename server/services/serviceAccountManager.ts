/**
 * Service Account Manager (Production)
 *
 * Fixes vs prior versions
 * ─────────────────────────────────────────────────────────────
 * 1. Idempotent init: onConflictDoUpdate on (serviceAccountId, chain, tokenSymbol)
 * 2. Liquidity score: correct HHI normalization (not constant-1)
 * 3. balanceUSD written here via valuation oracle + balanceUSDUpdatedAt
 * 4. maxChains / scores derived from *active* accounts (Tron excluded until synced)
 * 5. Rebalance tips respect per-chain native gas floors
 * 6. All transfer queries scoped by serviceAccountId
 * 7. Health scored against expected EVM chain set, not only existing rows
 * 8. No privateKey on config; token param actually used for native path
 */

import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  getMultiChainProvider,
  type MultiChainProvider,
} from './multiChainProvider';
import {
  CHAIN_CONFIG,
  type SupportedChain,
  getAllChains,
  estimateGasCostUSD,
} from '../../shared/chainConfiguration';
import { Logger } from '../utils/logger';
import {
  chainAccounts,
  crossChainTransfers,
} from '../../shared/accountSchema';
import { priceOracle } from './priceOracle';

const logger = new Logger('service-account-manager');

type ProviderChain = Exclude<SupportedChain, 'tron'>;

export interface ServiceAccountConfig {
  id: string;
  ethereumAddress: string;
  tronAddress?: string;
  network: 'mainnet' | 'testnet';
  /** ERC-20 symbols to track (optional) */
  trackedTokens?: string[];
  /**
   * Minimum native balance to keep on each chain for gas, in USD.
   * Default: ~25× native transfer gas estimate.
   */
  gasReserveUsdByChain?: Partial<Record<SupportedChain, number>>;
  gasReserveMultiplier?: number; // default 25
}

export type SyncStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'unpriced'
  | 'init_failed';

export interface ChainLiquidity {
  chain: SupportedChain;
  token: string;
  balance: string;
  balanceUSD: string;
  lastUpdated: Date;
  balanceUSDUpdatedAt: Date | null;
  syncStatus: SyncStatus;
  isNative: boolean;
}

export interface UnifiedLiquidity {
  serviceAccountId: string;
  totalValueUSD: string;
  chains: ChainLiquidity[];
  activeChainCount: number;
  liquidityScore: number;
  riskScore: number;
  recommendations: string[];
  lastUpdate: Date;
  unpriced: string[];
}

export type TransferStatus =
  | 'pending'
  | 'bridging'
  | 'confirmed'
  | 'failed'
  | 'refunded';

function isProviderChain(chain: SupportedChain): chain is ProviderChain {
  return chain !== 'tron';
}

function expectedEvmChains(): ProviderChain[] {
  return getAllChains()
    .map((c) => c.id as SupportedChain)
    .filter(isProviderChain);
}

function rpcUrlFor(
  chain: SupportedChain,
  network: 'mainnet' | 'testnet'
): string {
  const c = CHAIN_CONFIG[chain];
  if (!c?.rpc) return '';
  return network === 'testnet'
    ? c.rpc.testnet || c.rpc.mainnet
    : c.rpc.mainnet;
}

function explorerUrlFor(
  chain: SupportedChain,
  network: 'mainnet' | 'testnet'
): string {
  const c = CHAIN_CONFIG[chain];
  if (!c?.blockExplorer) return '';
  return network === 'testnet'
    ? c.blockExplorer.testnet || c.blockExplorer.mainnet
    : c.blockExplorer.mainnet;
}

/** In-memory record of chains that failed init (no DB row yet). */
type InitFailureMap = Map<SupportedChain, string>;

export class ServiceAccountManager {
  private readonly serviceAccountId: string;
  private readonly ethereumAddress: string;
  private readonly tronAddress?: string;
  private readonly network: 'mainnet' | 'testnet';
  private readonly trackedTokens: string[];
  private readonly multiChainProvider: MultiChainProvider;
  private readonly gasReserveUsdByChain: Partial<Record<SupportedChain, number>>;
  private readonly gasReserveMultiplier: number;
  private readonly initFailures: InitFailureMap = new Map();

  constructor(config: ServiceAccountConfig, provider: MultiChainProvider) {
    if (!config.id?.trim()) throw new Error('service account id is required');
    if (!config.ethereumAddress?.startsWith('0x')) {
      throw new Error('ethereumAddress must be a 0x-prefixed EVM address');
    }

    this.serviceAccountId = config.id;
    this.ethereumAddress = config.ethereumAddress;
    this.tronAddress = config.tronAddress;
    this.network = config.network;
    this.trackedTokens = (config.trackedTokens || []).map((t) =>
      t.toUpperCase()
    );
    this.multiChainProvider = provider;
    this.gasReserveUsdByChain = config.gasReserveUsdByChain || {};
    this.gasReserveMultiplier = config.gasReserveMultiplier ?? 25;

    logger.info('ServiceAccountManager ready', {
      id: this.serviceAccountId,
      address: this.ethereumAddress,
      network: this.network,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Init — idempotent (#1)
  // ═══════════════════════════════════════════════════════════

  async initializeChainAccount(chain: SupportedChain): Promise<void> {
    if (!isProviderChain(chain)) {
      throw new Error(
        'TRON requires a TRON-specific provider; not initialized here'
      );
    }

    const config = CHAIN_CONFIG[chain];
    if (!config) throw new Error(`Unknown chain: ${chain}`);

    const nativeSymbol = config.nativeToken;
    let balanceStr = '0';
    let syncStatus: SyncStatus = 'synced';

    try {
      const balance = await this.multiChainProvider.getBalance(
        chain,
        this.ethereumAddress
      );
      balanceStr = balance.toString();
      this.initFailures.delete(chain);
    } catch (err) {
      syncStatus = 'failed';
      const msg = err instanceof Error ? err.message : String(err);
      this.initFailures.set(chain, msg);
      logger.error('Native balance fetch failed on init', { chain, error: msg });
    }

    const mark = await this.markUsd(nativeSymbol, balanceStr);
    if (syncStatus !== 'failed' && !mark.priced) syncStatus = 'unpriced';

    await this.upsertAccountRow({
      chain,
      tokenSymbol: nativeSymbol,
      tokenAddress: nativeSymbol,
      balance: balanceStr,
      tokenBalance: balanceStr,
      balanceUSD: mark.usd,
      balanceUSDUpdatedAt: mark.priced ? new Date() : null,
      syncStatus,
    });

    for (const token of this.trackedTokens) {
      if (token === nativeSymbol.toUpperCase()) continue;
      await this.upsertAccountRow({
        chain,
        tokenSymbol: token,
        tokenAddress: token,
        balance: '0',
        tokenBalance: '0',
        balanceUSD: '0',
        balanceUSDUpdatedAt: null,
        syncStatus: 'pending',
      });
    }

    logger.info('Chain account upserted', { chain, syncStatus });
  }

  /**
   * Requires unique index on (service_account_id, chain, token_symbol).
   * Uses onConflictDoUpdate so every boot is safe (#1).
   */
  private async upsertAccountRow(input: {
    chain: SupportedChain;
    tokenSymbol: string;
    tokenAddress: string;
    balance: string;
    tokenBalance: string;
    balanceUSD: string;
    balanceUSDUpdatedAt: Date | null;
    syncStatus: SyncStatus;
  }): Promise<void> {
    const now = new Date();

    await db
      .insert(chainAccounts)
      .values({
        serviceAccountId: this.serviceAccountId,
        chain: input.chain,
        walletAddress: this.ethereumAddress,
        balance: input.balance,
        balanceUSD: input.balanceUSD,
        balanceUSDUpdatedAt: input.balanceUSDUpdatedAt,
        tokenSymbol: input.tokenSymbol,
        tokenAddress: input.tokenAddress,
        tokenBalance: input.tokenBalance,
        rpcUrl: rpcUrlFor(input.chain, this.network),
        blockExplorerUrl: explorerUrlFor(input.chain, this.network),
        syncStatus: input.syncStatus,
        lastSync: now,
      })
      .onConflictDoUpdate({
        target: [
          chainAccounts.serviceAccountId,
          chainAccounts.chain,
          chainAccounts.tokenSymbol,
        ],
        set: {
          walletAddress: this.ethereumAddress,
          balance: input.balance,
          tokenBalance: input.tokenBalance,
          balanceUSD: input.balanceUSD,
          balanceUSDUpdatedAt: input.balanceUSDUpdatedAt,
          tokenAddress: input.tokenAddress,
          rpcUrl: rpcUrlFor(input.chain, this.network),
          blockExplorerUrl: explorerUrlFor(input.chain, this.network),
          syncStatus: input.syncStatus,
          lastSync: now,
        },
      });
  }

  // ═══════════════════════════════════════════════════════════
  // Balances + USD marks (#3)
  // ═══════════════════════════════════════════════════════════

  async updateChainBalance(
    chain: SupportedChain,
    token: string = 'NATIVE'
  ): Promise<string> {
    if (!isProviderChain(chain)) {
      throw new Error('TRON balance updates require a TRON-specific provider');
    }

    const config = CHAIN_CONFIG[chain];
    if (!config) throw new Error(`Unknown chain: ${chain}`);

    const tokenSymbol =
      !token || token === 'NATIVE'
        ? config.nativeToken
        : token.toUpperCase();

    const isNative = tokenSymbol === config.nativeToken;

    if (!isNative) {
      // Hook for ERC-20 balanceOf via provider when available
      logger.warn('ERC-20 balance refresh not implemented', {
        chain,
        token: tokenSymbol,
      });
      return '0';
    }

    try {
      const balance = await this.multiChainProvider.getBalance(
        chain,
        this.ethereumAddress
      );
      const balanceStr = balance.toString();
      const mark = await this.markUsd(tokenSymbol, balanceStr);

      await db
        .update(chainAccounts)
        .set({
          balance: balanceStr,
          tokenBalance: balanceStr,
          balanceUSD: mark.usd,
          balanceUSDUpdatedAt: mark.priced ? new Date() : null,
          lastSync: new Date(),
          syncStatus: mark.priced ? 'synced' : 'unpriced',
        })
        .where(
          and(
            eq(chainAccounts.serviceAccountId, this.serviceAccountId),
            eq(chainAccounts.chain, chain),
            eq(chainAccounts.tokenSymbol, tokenSymbol)
          )
        );

      this.initFailures.delete(chain);
      return balanceStr;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db
        .update(chainAccounts)
        .set({ syncStatus: 'failed', lastSync: new Date() })
        .where(
          and(
            eq(chainAccounts.serviceAccountId, this.serviceAccountId),
            eq(chainAccounts.chain, chain),
            eq(chainAccounts.tokenSymbol, tokenSymbol)
          )
        );
      logger.error('updateChainBalance failed', { chain, token: tokenSymbol, error: msg });
      throw err;
    }
  }

  async refreshAllBalances(): Promise<void> {
    const rows = await db
      .select()
      .from(chainAccounts)
      .where(eq(chainAccounts.serviceAccountId, this.serviceAccountId));

    for (const row of rows) {
      const chain = row.chain as SupportedChain;
      if (!isProviderChain(chain)) continue;
      try {
        await this.updateChainBalance(chain, row.tokenSymbol || 'NATIVE');
      } catch {
        /* logged */
      }
    }
  }

  /**
   * Valuation-first USD mark. Human-readable balance assumed
   * (convert wei → ether at provider boundary if needed).
   */
  private async markUsd(
    tokenSymbol: string,
    balanceStr: string
  ): Promise<{ usd: string; priced: boolean }> {
    const bal = Number(balanceStr);
    if (!Number.isFinite(bal) || bal === 0) {
      return { usd: '0', priced: true };
    }

    try {
      if (priceOracle.isValuationAllowlisted?.(tokenSymbol)) {
        const v = await priceOracle.getValuationPrice(tokenSymbol);
        if (!v) return { usd: '0', priced: false };
        const px = v.haircutPriceUsd ?? v.priceUsd;
        return { usd: (bal * px).toFixed(6), priced: true };
      }

      const p = await priceOracle.getPrice(tokenSymbol);
      if (!p?.priceUsd) return { usd: '0', priced: false };
      return { usd: (bal * p.priceUsd).toFixed(6), priced: true };
    } catch {
      return { usd: '0', priced: false };
    }
  }

  private gasFloorUsd(chain: SupportedChain): number {
    if (this.gasReserveUsdByChain[chain] != null) {
      return this.gasReserveUsdByChain[chain]!;
    }
    try {
      const perTx = estimateGasCostUSD(chain, true);
      return perTx * this.gasReserveMultiplier;
    } catch {
      return 5; // conservative fallback USD
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Unified liquidity (#2, #3, #4, #5)
  // ═══════════════════════════════════════════════════════════

  async getUnifiedLiquidity(): Promise<UnifiedLiquidity> {
    const accounts = await db
      .select()
      .from(chainAccounts)
      .where(eq(chainAccounts.serviceAccountId, this.serviceAccountId));

    if (accounts.length === 0 && this.initFailures.size === 0) {
      throw new Error('No chain accounts found for service account');
    }

    const chains: ChainLiquidity[] = [];
    let totalValueUSD = 0;
    const unpriced: string[] = [];

    for (const account of accounts) {
      const usd = Number(account.balanceUSD || '0');
      if (Number.isFinite(usd)) totalValueUSD += usd;

      const status = (account.syncStatus as SyncStatus) || 'pending';
      if (status === 'unpriced' || status === 'failed') {
        unpriced.push(`${account.chain}:${account.tokenSymbol}`);
      }

      const nativeSym =
        CHAIN_CONFIG[account.chain as SupportedChain]?.nativeToken || '';
      const isNative =
        (account.tokenSymbol || '').toUpperCase() ===
        nativeSym.toUpperCase();

      chains.push({
        chain: account.chain as SupportedChain,
        token: account.tokenSymbol || 'UNKNOWN',
        balance: account.balance || '0',
        balanceUSD: account.balanceUSD || '0',
        lastUpdated: account.lastSync || new Date(0),
        balanceUSDUpdatedAt:
          (account as any).balanceUSDUpdatedAt ?? null,
        syncStatus: status,
        isNative,
      });
    }

    // Active chains = distinct chains with at least one row (excludes Tron until synced)
    const activeChainCount = new Set(chains.map((c) => c.chain)).size;

    const liquidityScore = this.calculateLiquidityScore(
      chains,
      totalValueUSD,
      activeChainCount
    );
    const riskScore = this.calculateRiskScore(
      chains,
      totalValueUSD,
      activeChainCount
    );
    const recommendations = this.generateRecommendations(
      chains,
      totalValueUSD,
      riskScore,
      activeChainCount,
      unpriced
    );

    return {
      serviceAccountId: this.serviceAccountId,
      totalValueUSD: totalValueUSD.toFixed(6),
      chains: chains.sort(
        (a, b) => Number(b.balanceUSD) - Number(a.balanceUSD)
      ),
      activeChainCount,
      liquidityScore,
      riskScore,
      recommendations,
      lastUpdate: new Date(),
      unpriced,
    };
  }

  /**
   * Correct HHI → 1–10 score (#2).
   * 10 = equal spread across activeChainCount, 1 = fully concentrated.
   */
  private calculateLiquidityScore(
    chains: ChainLiquidity[],
    totalValueUSD: number,
    activeChainCount: number
  ): number {
    if (totalValueUSD <= 0 || activeChainCount <= 0) return 0;

    // Aggregate USD per chain (multiple tokens on same chain)
    const perChain = new Map<string, number>();
    for (const c of chains) {
      perChain.set(
        c.chain,
        (perChain.get(c.chain) || 0) + Number(c.balanceUSD || 0)
      );
    }

    let concentrationSum = 0;
    for (const v of perChain.values()) {
      const share = v / totalValueUSD;
      concentrationSum += share * share;
    }

    const minConc = 1 / activeChainCount; // perfect spread
    const maxConc = 1; // all on one chain
    if (maxConc <= minConc) return 10;

    const score =
      1 + ((maxConc - concentrationSum) / (maxConc - minConc)) * 9;
    return Math.max(1, Math.min(10, Math.round(score * 2) / 2));
  }

  private calculateRiskScore(
    chains: ChainLiquidity[],
    totalValueUSD: number,
    activeChainCount: number
  ): number {
    if (totalValueUSD <= 0 || activeChainCount <= 0) return 1;

    const perChain = new Map<string, number>();
    for (const c of chains) {
      perChain.set(
        c.chain,
        (perChain.get(c.chain) || 0) + Number(c.balanceUSD || 0)
      );
    }

    let maxShare = 0;
    for (const v of perChain.values()) {
      maxShare = Math.max(maxShare, v / totalValueUSD);
    }

    const even = 1 / activeChainCount;
    const risk = ((maxShare - even) / (1 - even || 1)) * 10;
    return Math.max(1, Math.min(10, Math.round(risk * 2) / 2));
  }

  /**
   * Gas-reserve-aware recommendations (#5).
   * Only suggest moving excess above floor; target = equal share of total.
   */
  private generateRecommendations(
    chains: ChainLiquidity[],
    totalValueUSD: number,
    riskScore: number,
    activeChainCount: number,
    unpriced: string[]
  ): string[] {
    const out: string[] = [];

    if (this.tronAddress) {
      out.push(
        'Tron address configured but not synced in this manager — excluded from unified scores'
      );
    }

    for (const [chain, err] of this.initFailures) {
      out.push(`Init failed on ${chain}: ${err}`);
    }

    if (unpriced.length) {
      out.push(
        `Unpriced/failed marks: ${unpriced.join(', ')} — refresh or allowlist`
      );
    }

    if (riskScore > 7 && totalValueUSD > 0 && activeChainCount > 1) {
      const perChainUsd = new Map<string, number>();
      for (const c of chains) {
        perChainUsd.set(
          c.chain,
          (perChainUsd.get(c.chain) || 0) + Number(c.balanceUSD || 0)
        );
      }

      let largestChain = '';
      let largestUsd = 0;
      let smallestChain = '';
      let smallestUsd = Infinity;
      for (const [ch, usd] of perChainUsd) {
        if (usd > largestUsd) {
          largestUsd = usd;
          largestChain = ch;
        }
        if (usd < smallestUsd) {
          smallestUsd = usd;
          smallestChain = ch;
        }
      }

      const targetUsd = totalValueUSD / activeChainCount;
      const floor = this.gasFloorUsd(largestChain as SupportedChain);

      // Native USD on largest chain (for gas floor)
      const nativeOnLargest = chains
        .filter((c) => c.chain === largestChain && c.isNative)
        .reduce((s, c) => s + Number(c.balanceUSD || 0), 0);

      const excessUsd = Math.max(0, largestUsd - targetUsd);
      const movableUsd = Math.max(
        0,
        Math.min(excessUsd, Math.max(0, nativeOnLargest - floor))
      );

      const pct = (largestUsd / totalValueUSD) * 100;
      out.push(
        `High concentration: ${pct.toFixed(1)}% on ${largestChain} (risk ${riskScore}/10)`
      );

      if (movableUsd > 1) {
        out.push(
          `Consider moving ~$${movableUsd.toFixed(2)} excess from ${largestChain} → ${smallestChain} ` +
            `(keeps ~$${floor.toFixed(2)} native gas floor on source)`
        );
      } else if (excessUsd > 1 && movableUsd <= 1) {
        out.push(
          `Concentration on ${largestChain} but little movable excess above gas floor ($${floor.toFixed(2)}) — ` +
            `rebalance non-native tokens or top up other chains from external funding`
        );
      }
    }

    const failed = chains.filter((c) => c.syncStatus === 'failed');
    if (failed.length) {
      out.push(
        `Sync failed: ${[...new Set(failed.map((c) => c.chain))].join(', ')}`
      );
    }

    const stale = chains.filter(
      (c) => Date.now() - c.lastUpdated.getTime() > 60 * 60 * 1000
    );
    if (stale.length) {
      out.push(
        `Stale balances (>1h): ${[...new Set(stale.map((c) => c.chain))].join(', ')}`
      );
    }

    const staleUsd = chains.filter((c) => {
      if (!c.balanceUSDUpdatedAt) return Number(c.balanceUSD) > 0;
      return Date.now() - c.balanceUSDUpdatedAt.getTime() > 60 * 60 * 1000;
    });
    if (staleUsd.length) {
      out.push(
        `Stale USD marks: ${staleUsd.map((c) => `${c.chain}:${c.token}`).join(', ')}`
      );
    }

    if (!out.length) {
      out.push('Liquidity looks balanced and fresh');
    }
    return out;
  }

  getGasEstimates(): Record<string, { native: number; erc20: number }> {
    const estimates: Record<string, { native: number; erc20: number }> = {};
    for (const chain of expectedEvmChains()) {
      estimates[chain] = {
        native: estimateGasCostUSD(chain, true),
        erc20: estimateGasCostUSD(chain, false),
      };
    }
    return estimates;
  }

  // ═══════════════════════════════════════════════════════════
  // Transfers — always scoped (#6)
  // ═══════════════════════════════════════════════════════════

  async recordCrossChainTransfer(input: {
    withdrawalId: string;
    sourceChain: SupportedChain;
    targetChain: SupportedChain;
    sourceToken: string;
    targetToken: string;
    sourceAmount: string;
    targetAmount: string;
    recipientAddress: string;
    bridgeProtocol?: string;
    gasFeeSource?: string;
    gasFeeTarget?: string;
    bridgeFee?: string;
    estimatedTime?: number;
  }): Promise<void> {
    const gasFeeSource = input.gasFeeSource ?? '0';
    const gasFeeTarget = input.gasFeeTarget ?? '0';
    const bridgeFee = input.bridgeFee ?? '0';
    const totalCost = (
      Number(gasFeeSource) +
      Number(gasFeeTarget) +
      Number(bridgeFee)
    ).toFixed(6);

    await db.insert(crossChainTransfers).values({
      withdrawalId: input.withdrawalId,
      serviceAccountId: this.serviceAccountId,
      sourceChain: input.sourceChain,
      targetChain: input.targetChain,
      sourceToken: input.sourceToken,
      targetToken: input.targetToken,
      sourceAmount: input.sourceAmount,
      targetAmount: input.targetAmount,
      recipientAddress: input.recipientAddress,
      bridgeProtocol: input.bridgeProtocol ?? 'direct',
      gasFeeSource,
      gasFeeTarget,
      bridgeFee,
      totalCostUSD: totalCost,
      estimatedTime: input.estimatedTime ?? 300,
      status: 'pending',
      createdAt: new Date(),
    });
  }

  async updateTransferStatus(
    transferId: string,
    status: TransferStatus,
    reason?: string
  ): Promise<void> {
    await db
      .update(crossChainTransfers)
      .set({
        status,
        statusReason: reason,
        confirmedAt: status === 'confirmed' ? new Date() : undefined,
        completedAt: ['confirmed', 'failed', 'refunded'].includes(status)
          ? new Date()
          : undefined,
      })
      .where(
        and(
          eq(crossChainTransfers.id, transferId),
          eq(crossChainTransfers.serviceAccountId, this.serviceAccountId)
        )
      );
  }

  async getRecentTransfers(limit = 50) {
    const safeLimit = Math.min(Math.max(1, limit), 200);
    return db
      .select()
      .from(crossChainTransfers)
      .where(eq(crossChainTransfers.serviceAccountId, this.serviceAccountId))
      .orderBy(desc(crossChainTransfers.createdAt))
      .limit(safeLimit);
  }

  async getTransferCostsByBridge(since?: Date) {
    const conditions = [
      eq(crossChainTransfers.serviceAccountId, this.serviceAccountId),
    ];
    if (since) conditions.push(gte(crossChainTransfers.createdAt, since));

    const transfers = await db
      .select()
      .from(crossChainTransfers)
      .where(and(...conditions))
      .limit(5_000);

    const costs: Record<string, { count: number; totalCostUSD: string }> = {};
    for (const t of transfers) {
      const protocol = t.bridgeProtocol || 'unknown';
      if (!costs[protocol]) costs[protocol] = { count: 0, totalCostUSD: '0' };
      costs[protocol].count++;
      costs[protocol].totalCostUSD = (
        Number(costs[protocol].totalCostUSD) + Number(t.totalCostUSD || 0)
      ).toFixed(6);
    }
    return costs;
  }

  // ═══════════════════════════════════════════════════════════
  // Status — expected chain set (#7)
  // ═══════════════════════════════════════════════════════════

  async getStatus(): Promise<{
    serviceAccountId: string;
    ethereumAddress: string;
    tronAddress?: string;
    network: 'mainnet' | 'testnet';
    status: 'healthy' | 'degraded' | 'unhealthy';
    expectedChains: string[];
    missingChains: string[];
    chainStatus: Record<
      string,
      { syncStatus: string; lastSync: Date | null }
    >;
    totalTransfers: number;
    successfulTransfers: number;
    failedTransfers: number;
  }> {
    const expected = expectedEvmChains();
    const accounts = await db
      .select()
      .from(chainAccounts)
      .where(eq(chainAccounts.serviceAccountId, this.serviceAccountId));

    const present = new Set(accounts.map((a) => a.chain));
    const missingChains = expected.filter(
      (c) => !present.has(c) || this.initFailures.has(c)
    );

    const [counts] = await db
      .select({
        total: sql<number>`count(*)::int`,
        successful: sql<number>`count(*) filter (where ${crossChainTransfers.status} = 'confirmed')::int`,
        failed: sql<number>`count(*) filter (where ${crossChainTransfers.status} = 'failed')::int`,
      })
      .from(crossChainTransfers)
      .where(eq(crossChainTransfers.serviceAccountId, this.serviceAccountId));

    const chainStatus: Record<
      string,
      { syncStatus: string; lastSync: Date | null }
    > = {};

    for (const chain of expected) {
      if (this.initFailures.has(chain)) {
        chainStatus[chain] = {
          syncStatus: 'init_failed',
          lastSync: null,
        };
      }
    }
    for (const account of accounts) {
      const key = `${account.chain}:${account.tokenSymbol}`;
      chainStatus[key] = {
        syncStatus: account.syncStatus || 'unknown',
        lastSync: account.lastSync,
      };
    }

    const failedRowCount = accounts.filter(
      (a) => a.syncStatus === 'failed'
    ).length;
    const missingCount = missingChains.length;
    const problemCount = failedRowCount + missingCount + this.initFailures.size;

    const status =
      problemCount === 0
        ? 'healthy'
        : problemCount >= expected.length * 0.5
          ? 'unhealthy'
          : 'degraded';

    return {
      serviceAccountId: this.serviceAccountId,
      ethereumAddress: this.ethereumAddress,
      tronAddress: this.tronAddress,
      network: this.network,
      status,
      expectedChains: expected,
      missingChains,
      chainStatus,
      totalTransfers: counts?.total ?? 0,
      successfulTransfers: counts?.successful ?? 0,
      failedTransfers: counts?.failed ?? 0,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════

const managers = new Map<string, ServiceAccountManager>();

export async function initializeServiceAccountManager(
  config: ServiceAccountConfig,
  provider?: MultiChainProvider
): Promise<ServiceAccountManager> {
  const existing = managers.get(config.id);
  if (existing) return existing;

  const multi = provider ?? getMultiChainProvider();
  const mgr = new ServiceAccountManager(config, multi);
  managers.set(config.id, mgr);

  for (const chain of expectedEvmChains()) {
    try {
      await mgr.initializeChainAccount(chain);
    } catch (err) {
      logger.warn('Chain init failed', {
        chain,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return mgr;
}

export function getServiceAccountManager(
  serviceAccountId?: string
): ServiceAccountManager {
  if (serviceAccountId) {
    const m = managers.get(serviceAccountId);
    if (!m) {
      throw new Error(
        `ServiceAccountManager ${serviceAccountId} not initialized`
      );
    }
    return m;
  }
  if (managers.size === 1) return managers.values().next().value!;
  if (managers.size === 0) {
    throw new Error(
      'ServiceAccountManager not initialized. Call initializeServiceAccountManager first.'
    );
  }
  throw new Error(
    'Multiple service accounts loaded; pass serviceAccountId'
  );
}

export function destroyServiceAccountManager(serviceAccountId?: string): void {
  if (serviceAccountId) managers.delete(serviceAccountId);
  else managers.clear();
}