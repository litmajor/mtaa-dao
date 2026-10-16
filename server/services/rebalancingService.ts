import { db } from '../db';
import { logger } from '../utils/logger';
import {
  investmentPools,
  poolAssets,
  rebalancingSettings,
  poolRebalances,
  poolSwapTransactions,
  assetPriceHistory,
  vaults,
  vaultTokenHoldings,
  vaultStrategyAllocations,
  vaultRiskAssessments,
  vaultTransactions,
} from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { priceOracle } from './priceOracle';
import { dexService } from './dexRoutingService';
import { assessSwapRisk } from './swapRiskGate';
import { redis } from './redis';

/**
 * Automated Rebalancing Service
 * Monitors pools (and, pending vault schema confirmation, vaults) and
 * triggers rebalancing when allocations drift beyond threshold.
 *
 * Risk-gated: before executing a swap, checks live microstructure signals
 * (order-book toxicity, price impact) from the YUKI intelligence layer.
 * A rebalance that's mathematically due but lands in a toxic/illiquid
 * window is skipped and logged rather than executed blind.
 *
 * Event-driven: rebalance outcomes (executed, skipped, risk-blocked) are
 * published to Redis so subscribed strategies/vaults get them live,
 * matching the push pattern already used in strategies.ts.
 */

const REBALANCE_EVENTS_CHANNEL = 'rebalancing:events';
const DEFAULT_VAULT_REBALANCE_THRESHOLD = 500;

interface AssetAllocation {
  assetSymbol: string;
  targetAllocation: number; // basis points
  currentBalance: number;
  currentValueUsd: number;
  currentAllocation: number; // actual basis points
  deviation: number; // basis points
}

interface RebalanceEvent {
  type: 'rebalance.executed' | 'rebalance.skipped_risk' | 'rebalance.no_action';
  scope: 'pool' | 'vault';
  targetId: string;
  timestamp: string;
  swapsExecuted?: number;
  swapsBlocked?: number;
  maxDeviationBp?: number;
  details?: Record<string, unknown>;
}

class RebalancingService {
  private isRunning = false;

  /**
   * Check all pools and rebalance if needed
   */
  async checkAndRebalanceAll(): Promise<void> {
    if (this.isRunning) {
      logger.info('Rebalancing check already running, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      logger.info('🔄 Starting automated rebalancing check...');

      const poolsToCheck = await db
        .select({
          poolId: investmentPools.id,
          poolName: investmentPools.name,
          tvl: investmentPools.totalValueLocked,
          autoRebalanceEnabled: rebalancingSettings.autoRebalanceEnabled,
        })
        .from(investmentPools)
        .innerJoin(
          rebalancingSettings,
          eq(rebalancingSettings.poolId, investmentPools.id)
        )
        .where(
          and(
            eq(investmentPools.isActive, true),
            eq(rebalancingSettings.autoRebalanceEnabled, true)
          )
        );

      logger.info(`Found ${poolsToCheck.length} pools with auto-rebalance enabled`);

      for (const pool of poolsToCheck) {
        try {
          await this.checkAndRebalancePool(pool.poolId);
        } catch (error) {
          logger.error(`Error rebalancing pool ${pool.poolId}:`, error);
        }
      }

      const vaultsToCheck = await db
        .select({ vaultId: vaults.id })
        .from(vaults)
        .innerJoin(
          vaultStrategyAllocations,
          eq(vaultStrategyAllocations.vaultId, vaults.id)
        )
        .where(
          and(
            eq(vaults.isActive, true),
            eq(vaultStrategyAllocations.isActive, true)
          )
        )
        .groupBy(vaults.id);

      logger.info(`Found ${vaultsToCheck.length} vaults with active strategy allocations`);

      for (const record of vaultsToCheck) {
        try {
          await this.checkAndRebalanceVault(record.vaultId);
        } catch (error) {
          logger.error(`Error rebalancing vault ${record.vaultId}:`, error);
        }
      }

      logger.info('✅ Rebalancing check completed');
    } catch (error) {
      logger.error('Error in rebalancing service:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check and rebalance a specific pool
   */
  async checkAndRebalancePool(poolId: string): Promise<boolean> {
    try {
      const [settings] = await db
        .select()
        .from(rebalancingSettings)
        .where(eq(rebalancingSettings.poolId, poolId));

      if (!settings || !settings.autoRebalanceEnabled) {
        return false;
      }

      const assets = await db
        .select()
        .from(poolAssets)
        .where(eq(poolAssets.poolId, poolId));

      if (assets.length === 0) {
        return false;
      }

      const assetSymbols = assets.map(a => a.assetSymbol);
      const prices = await priceOracle.getValuationPrices(assetSymbols);

      let totalValue = 0;
      const allocations: AssetAllocation[] = [];

      for (const asset of assets) {
        const priceData = prices.get(asset.assetSymbol.toUpperCase());
        const priceUsd = priceData?.haircutPriceUsd ?? priceData?.priceUsd;
        if (!priceData || priceUsd === undefined || !Number.isFinite(priceUsd) || priceUsd <= 0) {
          logger.warn(`Cannot rebalance pool ${poolId}: valuation unavailable for ${asset.assetSymbol}`);
          return false;
        }

        const currentBalance = Number(asset.currentBalance) || 0;
        const currentValueUsd = currentBalance * priceUsd;
        totalValue += currentValueUsd;

        allocations.push({
          assetSymbol: asset.assetSymbol,
          targetAllocation: asset.targetAllocation,
          currentBalance,
          currentValueUsd,
          currentAllocation: 0,
          deviation: 0,
        });
      }

      let maxDeviation = 0;
      for (const allocation of allocations) {
        allocation.currentAllocation = totalValue > 0
          ? Math.round((allocation.currentValueUsd / totalValue) * 10000)
          : 0;
        allocation.deviation = Math.abs(allocation.currentAllocation - allocation.targetAllocation);
        maxDeviation = Math.max(maxDeviation, allocation.deviation);
      }

      const rebalanceThreshold = Number(settings.rebalanceThreshold ?? 0);
      logger.info(`Pool ${poolId}: Max deviation = ${maxDeviation} basis points (threshold: ${rebalanceThreshold})`);

      if (maxDeviation < rebalanceThreshold) {
        logger.info(`Pool ${poolId}: No rebalancing needed`);

        await db
          .update(rebalancingSettings)
          .set({ lastRebalanceCheck: new Date() })
          .where(eq(rebalancingSettings.poolId, poolId));

        await this.publishRebalanceEvent({
          type: 'rebalance.no_action',
          scope: 'pool',
          targetId: poolId,
          timestamp: new Date().toISOString(),
          maxDeviationBp: maxDeviation,
        });

        return false;
      }

      logger.info(`Pool ${poolId}: Rebalancing needed! Max deviation: ${maxDeviation} bp`);
      await this.performRebalance(poolId, allocations, totalValue);

      return true;
    } catch (error) {
      logger.error(`Error checking pool ${poolId} for rebalancing:`, error);
      return false;
    }
  }

  /**
   * Publish a rebalance outcome to Redis so subscribed strategies/vaults
   * receive it live (SSE/WebSocket on the consuming side), instead of only
   * being discoverable by polling getRebalancingStatus.
   */
  private async publishRebalanceEvent(event: RebalanceEvent): Promise<void> {
    try {
      await redis.publish(REBALANCE_EVENTS_CHANNEL, JSON.stringify(event));
    } catch (error) {
      // Publishing is best-effort — never let a broken event bus block rebalancing.
      logger.warn('Failed to publish rebalance event', { error, event });
    }
  }

  /**
   * Perform the actual rebalancing
   */
  private async performRebalance(
    poolId: string,
    allocations: AssetAllocation[],
    totalValue: number
  ): Promise<void> {
    try {
      const swaps: Array<{
        fromAsset: string;
        toAsset: string;
        amountUsd: number;
      }> = [];

      const assetsToSell = allocations.filter(a => a.currentAllocation > a.targetAllocation);
      const assetsToBuy = allocations.filter(a => a.currentAllocation < a.targetAllocation);

      for (const sellAsset of assetsToSell) {
        const excessValue = (sellAsset.currentAllocation - sellAsset.targetAllocation) / 10000 * totalValue;

        for (const buyAsset of assetsToBuy) {
          const deficitValue = (buyAsset.targetAllocation - buyAsset.currentAllocation) / 10000 * totalValue;
          const swapAmount = Math.min(excessValue, deficitValue);

          if (swapAmount > 0) {
            swaps.push({
              fromAsset: sellAsset.assetSymbol,
              toAsset: buyAsset.assetSymbol,
              amountUsd: swapAmount,
            });
          }
        }
      }

      const [rebalance] = await db
        .insert(poolRebalances)
        .values({
          poolId,
          initiatedBy: 'system',
          tvlBefore: totalValue.toString(),
          tvlAfter: totalValue.toString(),
          assetsChanged: JSON.stringify(allocations.map(a => ({
            symbol: a.assetSymbol,
            from_allocation: a.currentAllocation,
            to_allocation: a.targetAllocation,
            deviation: a.deviation,
          }))),
          reason: `Automated rebalancing - Max deviation: ${Math.max(...allocations.map(a => a.deviation))} bp`,
          status: 'simulated',
        })
        .returning();

      let swapsExecuted = 0;
      let swapsBlocked = 0;
      const blockedSwaps: Array<{ fromAsset: string; toAsset: string; amountUsd: number; reason?: string }> = [];
      const fromAssetPrices = await priceOracle.getValuationPrices(
        Array.from(new Set(swaps.map(s => s.fromAsset)))
      );

      for (const swap of swaps) {
        const fromPriceData = fromAssetPrices.get(swap.fromAsset.toUpperCase());
        const fromPrice = fromPriceData?.haircutPriceUsd ?? fromPriceData?.priceUsd;
        if (!fromPrice || fromPrice <= 0) {
          swapsBlocked++;
          blockedSwaps.push({
            fromAsset: swap.fromAsset,
            toAsset: swap.toAsset,
            amountUsd: swap.amountUsd,
            reason: `Missing USD price for ${swap.fromAsset}`,
          });
          logger.warn(
            `  ⛔ Swap skipped: ${swap.fromAsset} → ${swap.toAsset} ($${swap.amountUsd.toFixed(2)}) — missing price for ${swap.fromAsset}`
          );
          continue;
        }

        const tokenAmount = swap.amountUsd / fromPrice;
        if (tokenAmount <= 0) {
          swapsBlocked++;
          blockedSwaps.push({
            fromAsset: swap.fromAsset,
            toAsset: swap.toAsset,
            amountUsd: swap.amountUsd,
            reason: `Invalid calculated token amount for ${swap.fromAsset}`,
          });
          logger.warn(
            `  ⛔ Swap skipped: ${swap.fromAsset} → ${swap.toAsset} ($${swap.amountUsd.toFixed(2)}) — invalid token amount computed`
          );
          continue;
        }

        const risk = await assessSwapRisk(swap.fromAsset, swap.toAsset);

        if (!risk.safe) {
          swapsBlocked++;
          blockedSwaps.push({ fromAsset: swap.fromAsset, toAsset: swap.toAsset, amountUsd: swap.amountUsd, reason: risk.reason });
          logger.warn(
            `  ⛔ Swap blocked: ${swap.fromAsset} → ${swap.toAsset} (${tokenAmount.toFixed(6)} ${swap.fromAsset}, $${swap.amountUsd.toFixed(2)}) — ${risk.reason}`
          );
          continue;
        }

        const quote = await dexService.getSwapQuote(
          swap.fromAsset,
          swap.toAsset,
          tokenAmount
        );

        const swapResult = await dexService.executeSwap(
          swap.fromAsset,
          swap.toAsset,
          tokenAmount
        );

        await db.insert(poolSwapTransactions).values({
          poolId,
          rebalanceId: rebalance.id,
          fromAsset: swap.fromAsset,
          toAsset: swap.toAsset,
          amountFrom: tokenAmount.toString(),
          amountTo: swapResult.amountOut?.toString() || '0',
          exchangeRate: swapResult.actualRate?.toString(),
          dexUsed: quote?.dex || 'ubeswap',
          transactionHash: swapResult.transactionHash,
          gasFee: swapResult.gasUsed?.toString(),
          status: swapResult.success ? 'completed' : 'failed',
        });

        if (swapResult.success) swapsExecuted++;

        logger.info(`  📊 Swap: ${swap.fromAsset} → ${swap.toAsset} (${tokenAmount.toFixed(6)} ${swap.fromAsset}, $${swap.amountUsd.toFixed(2)})`);
        if (swapResult.success) {
          logger.info(`     ✅ Output: ${swapResult.amountOut?.toFixed(6)} ${swap.toAsset}`);
          logger.info(`     TX: ${swapResult.transactionHash}`);
        } else {
          logger.error(`     ❌ Swap failed: ${swapResult.error}`);
        }
      }

      await db
        .update(rebalancingSettings)
        .set({
          lastRebalanceCheck: new Date(),
          nextRebalanceScheduled: this.getNextRebalanceTime(allocations[0]?.deviation || 0),
        })
        .where(eq(rebalancingSettings.poolId, poolId));

      await this.publishRebalanceEvent({
        type: swapsBlocked > 0 && swapsExecuted === 0 ? 'rebalance.skipped_risk' : 'rebalance.executed',
        scope: 'pool',
        targetId: poolId,
        timestamp: new Date().toISOString(),
        swapsExecuted,
        swapsBlocked,
        maxDeviationBp: Math.max(...allocations.map(a => a.deviation)),
        details: swapsBlocked > 0 ? { blockedSwaps } : undefined,
      });

      logger.info(
        `✅ Pool ${poolId}: Rebalancing completed (${swapsExecuted} swaps executed, ${swapsBlocked} blocked by risk gate)`
      );
    } catch (error) {
      logger.error('Error performing rebalance:', error);
      throw error;
    }
  }

  /**
   * Calculate next rebalance time based on frequency
   */
  private getNextRebalanceTime(deviation: number): Date {
    const now = new Date();

    if (deviation > 1000) {
      now.setHours(now.getHours() + 6);
    } else if (deviation > 500) {
      now.setDate(now.getDate() + 1);
    } else {
      now.setDate(now.getDate() + 7);
    }

    return now;
  }

  /**
   * Record asset prices for historical tracking
   */
  async recordAssetPrices(): Promise<void> {
    try {
      const symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'LTC'];
      const prices = await priceOracle.getPrices(symbols);

      for (const [symbol, priceData] of prices.entries()) {
        await db.insert(assetPriceHistory).values({
          assetSymbol: symbol,
          priceUsd: priceData.priceUsd.toString(),
          marketCap: priceData.marketCap.toString(),
          volume24h: priceData.volume24h.toString(),
          priceChange24h: priceData.priceChange24h.toString(),
        });
      }

      logger.info(`📈 Recorded prices for ${prices.size} assets`);
    } catch (error) {
      logger.error('Error recording asset prices:', error);
    }
  }

  async checkAndRebalanceVault(vaultId: string): Promise<boolean> {
    try {
      const [vault] = await db
        .select()
        .from(vaults)
        .where(eq(vaults.id, vaultId));

      if (!vault || vault.isActive === false) {
        logger.info(`Vault ${vaultId} is missing or inactive, skipping rebalance`);
        return false;
      }

      const allocations = await db
        .select()
        .from(vaultStrategyAllocations)
        .where(
          and(
            eq(vaultStrategyAllocations.vaultId, vaultId),
            eq(vaultStrategyAllocations.isActive, true)
          )
        );

      if (allocations.length === 0) {
        logger.info(`Vault ${vaultId}: no active strategy allocations found, skipping rebalance`);
        return false;
      }

      const targetByToken = new Map<string, number>();
      let totalTargetPct = 0;
      for (const allocation of allocations) {
        const allocationPct = Number(allocation.allocationPercentage) || 0;
        totalTargetPct += allocationPct;
        targetByToken.set(
          allocation.tokenSymbol,
          (targetByToken.get(allocation.tokenSymbol) || 0) + allocationPct
        );
      }

      const normalizedTargets = new Map<string, number>();
      const targetDenominator = totalTargetPct > 0 ? totalTargetPct : 100;
      for (const [tokenSymbol, totalPct] of targetByToken.entries()) {
        normalizedTargets.set(
          tokenSymbol,
          Math.round((totalPct / targetDenominator) * 10000)
        );
      }

      const holdings = await db
        .select()
        .from(vaultTokenHoldings)
        .where(eq(vaultTokenHoldings.vaultId, vaultId));

      if (holdings.length === 0) {
        logger.info(`Vault ${vaultId}: no holdings found, skipping rebalance`);
        return false;
      }

      const holdingsByToken = new Map<string, { currentBalance: number; currentValueUsd: number }>();
      for (const holding of holdings) {
        const balance = Number(holding.balance) || 0;
        const valueUsd = Number(holding.valueUSD) || 0;
        const existing = holdingsByToken.get(holding.tokenSymbol);
        if (existing) {
          existing.currentBalance += balance;
          existing.currentValueUsd += valueUsd;
        } else {
          holdingsByToken.set(holding.tokenSymbol, {
            currentBalance: balance,
            currentValueUsd: valueUsd,
          });
        }
      }

      const assetSymbols = Array.from(
        new Set([...holdingsByToken.keys(), ...normalizedTargets.keys()])
      );
      const prices = await priceOracle.getValuationPrices(assetSymbols);

      let totalValue = 0;
      const allocationsForRebalance: AssetAllocation[] = [];

      for (const assetSymbol of assetSymbols) {
        const holding = holdingsByToken.get(assetSymbol);
        const currentBalance = holding?.currentBalance || 0;
        const priceData = prices.get(assetSymbol.toUpperCase());
        const priceUsd = priceData?.haircutPriceUsd ?? priceData?.priceUsd;
        if (!priceData || priceUsd === undefined || !Number.isFinite(priceUsd) || priceUsd <= 0) {
          logger.warn(`Cannot rebalance vault ${vaultId}: valuation unavailable for ${assetSymbol}`);
          return false;
        }
        const currentValueUsd = currentBalance * priceUsd;

        totalValue += currentValueUsd;

        allocationsForRebalance.push({
          assetSymbol,
          targetAllocation: normalizedTargets.get(assetSymbol) ?? 0,
          currentBalance,
          currentValueUsd,
          currentAllocation: 0,
          deviation: 0,
        });
      }

      let maxDeviation = 0;
      for (const allocation of allocationsForRebalance) {
        allocation.currentAllocation = totalValue > 0
          ? Math.round((allocation.currentValueUsd / totalValue) * 10000)
          : 0;
        allocation.deviation = Math.abs(allocation.currentAllocation - allocation.targetAllocation);
        maxDeviation = Math.max(maxDeviation, allocation.deviation);
      }

      logger.info(`Vault ${vaultId}: max allocation deviation = ${maxDeviation} bp`);

      if (maxDeviation < DEFAULT_VAULT_REBALANCE_THRESHOLD) {
        await this.publishRebalanceEvent({
          type: 'rebalance.no_action',
          scope: 'vault',
          targetId: vaultId,
          timestamp: new Date().toISOString(),
          maxDeviationBp: maxDeviation,
        });
        return false;
      }

      logger.info(`Vault ${vaultId}: rebalancing triggered, max deviation ${maxDeviation} bp`);
      await this.performVaultRebalance(vaultId, allocationsForRebalance, totalValue, vault);
      return true;
    } catch (error) {
      logger.error(`Error checking vault ${vaultId} for rebalancing:`, error);
      return false;
    }
  }

  private async performVaultRebalance(
    vaultId: string,
    allocations: AssetAllocation[],
    totalValue: number,
    vault: any
  ): Promise<void> {
    const swaps: Array<{ fromAsset: string; toAsset: string; amountUsd: number }> = [];
    const assetsToSell = allocations.filter(a => a.currentAllocation > a.targetAllocation);
    const assetsToBuy = allocations.filter(a => a.currentAllocation < a.targetAllocation);

    for (const sellAsset of assetsToSell) {
      const excessValue = (sellAsset.currentAllocation - sellAsset.targetAllocation) / 10000 * totalValue;

      for (const buyAsset of assetsToBuy) {
        const deficitValue = (buyAsset.targetAllocation - buyAsset.currentAllocation) / 10000 * totalValue;
        const swapAmount = Math.min(excessValue, deficitValue);

        if (swapAmount > 0) {
          swaps.push({
            fromAsset: sellAsset.assetSymbol,
            toAsset: buyAsset.assetSymbol,
            amountUsd: swapAmount,
          });
        }
      }
    }

    let swapsExecuted = 0;
    let swapsBlocked = 0;
    const blockedSwaps: Array<{ fromAsset: string; toAsset: string; amountUsd: number; reason?: string }> = [];
    const riskSummaries: Array<{ asset: string; toxicity?: number; priceImpact?: number; resilience?: number; liquidityDepth?: number }> = [];
    const fromAssetPrices = await priceOracle.getValuationPrices(
      Array.from(new Set(swaps.map(s => s.fromAsset)))
    );

    for (const swap of swaps) {
      const fromPriceData = fromAssetPrices.get(swap.fromAsset.toUpperCase());
      const fromPrice = fromPriceData?.haircutPriceUsd ?? fromPriceData?.priceUsd;
      if (!fromPrice || fromPrice <= 0) {
        swapsBlocked++;
        blockedSwaps.push({
          fromAsset: swap.fromAsset,
          toAsset: swap.toAsset,
          amountUsd: swap.amountUsd,
          reason: `Missing USD price for ${swap.fromAsset}`,
        });
        logger.warn(`⛔ Vault ${vaultId} swap skipped: ${swap.fromAsset}→${swap.toAsset} ($${swap.amountUsd.toFixed(2)}) — missing price for ${swap.fromAsset}`);
        continue;
      }

      const tokenAmount = swap.amountUsd / fromPrice;
      if (tokenAmount <= 0) {
        swapsBlocked++;
        blockedSwaps.push({
          fromAsset: swap.fromAsset,
          toAsset: swap.toAsset,
          amountUsd: swap.amountUsd,
          reason: `Invalid calculated token amount for ${swap.fromAsset}`,
        });
        logger.warn(`⛔ Vault ${vaultId} swap skipped: ${swap.fromAsset}→${swap.toAsset} ($${swap.amountUsd.toFixed(2)}) — invalid token amount computed`);
        continue;
      }

      const risk = await assessSwapRisk(swap.fromAsset, swap.toAsset);

      if (!risk.safe) {
        swapsBlocked++;
        blockedSwaps.push({ fromAsset: swap.fromAsset, toAsset: swap.toAsset, amountUsd: swap.amountUsd, reason: risk.reason });
        riskSummaries.push({
          asset: `${swap.fromAsset}->${swap.toAsset}`,
          toxicity: risk.toxicity,
          priceImpact: risk.priceImpact?.shortTermImpact,
          resilience: risk.priceImpact?.resilience,
          liquidityDepth: risk.priceImpact?.liquidityDepthUSD,
        });
        logger.warn(`⛔ Vault ${vaultId} swap blocked: ${swap.fromAsset}→${swap.toAsset} ${tokenAmount.toFixed(6)} ${swap.fromAsset} ($${swap.amountUsd.toFixed(2)}) — ${risk.reason}`);
        continue;
      }

      const quote = await dexService.getSwapQuote(swap.fromAsset, swap.toAsset, tokenAmount);
      const swapResult = await dexService.executeSwap(swap.fromAsset, swap.toAsset, tokenAmount);

      await db.insert(vaultTransactions).values({
        vaultId,
        userId: vault.userId || String(vault.daoId) || 'system',
        transactionType: 'rebalance',
        tokenSymbol: swap.fromAsset,
        amount: tokenAmount.toString(),
        valueUSD: swap.amountUsd.toString(),
        transactionHash: swapResult.transactionHash,
        status: swapResult.success ? 'completed' : 'failed',
        metadata: {
          toAsset: swap.toAsset,
          amountTo: swapResult.amountOut?.toString(),
          dexUsed: quote?.dex,
          risk: {
            toxicity: risk.toxicity,
            toxicityAssessment: risk.toxicityAssessment,
            shortTermImpact: risk.priceImpact?.shortTermImpact,
            mediumTermImpact: risk.priceImpact?.mediumTermImpact,
            longTermImpact: risk.priceImpact?.longTermImpact,
            resilience: risk.priceImpact?.resilience,
            liquidityDepth: risk.priceImpact?.liquidityDepthUSD,
          },
        },
      });

      if (swapResult.success) {
        swapsExecuted++;
        logger.info(`✅ Vault ${vaultId} swap executed: ${swap.fromAsset}→${swap.toAsset} $${swap.amountUsd.toFixed(2)}`);
      } else {
        logger.warn(`❌ Vault ${vaultId} swap failed: ${swap.fromAsset}→${swap.toAsset} $${swap.amountUsd.toFixed(2)}`);
      }
    }

    if (blockedSwaps.length > 0) {
      const maxRisk = riskSummaries.reduce(
        (acc, summary) => ({
          toxicity: Math.max(acc.toxicity ?? 0, summary.toxicity ?? 0),
          priceImpact: Math.max(acc.priceImpact ?? 0, summary.priceImpact ?? 0),
          resilience: Math.min(acc.resilience ?? Infinity, summary.resilience ?? Infinity),
          liquidityDepth: Math.min(acc.liquidityDepth ?? Infinity, summary.liquidityDepth ?? Infinity),
        }),
        { toxicity: 0, priceImpact: 0, resilience: Infinity, liquidityDepth: Infinity }
      );

      const liquidityRisk = Math.min(100, Math.round(100 - (maxRisk.resilience ?? 0)));
      const marketRisk = Math.min(100, Math.round((maxRisk.toxicity ?? 0) * 0.6 + (maxRisk.priceImpact ?? 0) * 0.4));
      const concentrationRisk = Math.min(100, Math.round(allocations.length <= 2 ? 70 : allocations.length <= 4 ? 40 : 20));
      const protocolRisk = 15;
      const overallRiskScore = Math.min(100, Math.round((liquidityRisk + marketRisk + concentrationRisk + protocolRisk) / 4));

      await db.insert(vaultRiskAssessments).values({
        vaultId,
        overallRiskScore,
        liquidityRisk,
        smartContractRisk: 10,
        marketRisk,
        concentrationRisk,
        protocolRisk,
        riskFactors: {
          blockedSwaps,
          riskSummaries,
          vaultDeviationBp: Math.max(...allocations.map(a => a.deviation)),
        },
        recommendations: [
          'Delay rebalancing until order book toxicity and price impact decline.',
          'Review target allocation sizes for illiquid tokens.',
          'Consider splitting rebalancing across smaller trades.',
        ],
        nextAssessmentDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        assessedBy: vault.userId || String(vault.daoId) || 'system',
      });
    }

    await this.publishRebalanceEvent({
      type: swapsBlocked > 0 && swapsExecuted === 0 ? 'rebalance.skipped_risk' : 'rebalance.executed',
      scope: 'vault',
      targetId: vaultId,
      timestamp: new Date().toISOString(),
      swapsExecuted,
      swapsBlocked,
      maxDeviationBp: Math.max(...allocations.map(a => a.deviation)),
      details: blockedSwaps.length > 0 ? { blockedSwaps, riskSummaries } : undefined,
    });
  }

  /**
   * Get rebalancing status for a pool
   */
  async getRebalancingStatus(poolId: string): Promise<any> {
    try {
      const [settings] = await db
        .select()
        .from(rebalancingSettings)
        .where(eq(rebalancingSettings.poolId, poolId));

      const recentRebalances = await db
        .select()
        .from(poolRebalances)
        .where(eq(poolRebalances.poolId, poolId))
        .orderBy(sql`${poolRebalances.rebalancedAt} DESC`)
        .limit(10);

      return {
        settings,
        recentRebalances,
        nextCheck: settings?.nextRebalanceScheduled,
      };
    } catch (error) {
      logger.error('Error getting rebalancing status:', error);
      return null;
    }
  }
}

export const rebalancingService = new RebalancingService();