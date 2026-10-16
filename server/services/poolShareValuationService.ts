import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { investmentPools, poolAssets } from '../../shared/schema';
import { priceOracle } from './priceOracle';
import { logger } from '../utils/logger';

export class PoolShareValuationService {
  async revaluePool(poolId: string): Promise<{
    poolId: string;
    totalValueLocked: number;
    sharePrice: number;
    asOf: Date;
  }> {
    const assets = await db
      .select()
      .from(poolAssets)
      .where(and(eq(poolAssets.poolId, poolId), eq(poolAssets.isActive, true)));

    const heldSymbols = Array.from(
      new Set(
        assets
          .filter((asset) => Number(asset.currentBalance ?? 0) > 0)
          .map((asset) => asset.assetSymbol.toUpperCase())
      )
    );

    const marks = new Map<
      string,
      { price: number; asOf: Date }
    >();
    await Promise.all(
      heldSymbols.map(async (symbol) => {
        if (!priceOracle.isValuationAllowlisted(symbol)) {
          throw new Error(`Pool asset ${symbol} is not allowlisted for valuation`);
        }
        const mark = await priceOracle.getValuationPrice(symbol);
        if (!mark) {
          throw new Error(`No reliable valuation price available for ${symbol}`);
        }
        const price = mark.haircutPriceUsd ?? mark.priceUsd;
        if (!Number.isFinite(price) || price <= 0) {
          throw new Error(`Invalid valuation price returned for ${symbol}`);
        }
        marks.set(symbol, { price, asOf: mark.asOf });
      })
    );

    const asOf = new Date();
    return db.transaction(async (tx) => {
      const [pool] = await tx
        .select()
        .from(investmentPools)
        .where(eq(investmentPools.id, poolId))
        .for('update')
        .limit(1);
      if (!pool) throw new Error(`Investment pool ${poolId} not found`);

      const currentAssets = await tx
        .select()
        .from(poolAssets)
        .where(and(eq(poolAssets.poolId, poolId), eq(poolAssets.isActive, true)))
        .for('update');

      let previousMarkedAssetsValue = 0;
      let revaluedAssetsValue = 0;
      const assetValues: Array<{ id: string; value: number }> = [];
      let oldestMarkTime = asOf.getTime();

      for (const asset of currentAssets) {
        const balance = Number(asset.currentBalance ?? 0);
        const previousValue = Number(asset.currentValueUsd ?? 0);
        if (!Number.isFinite(balance) || balance < 0) {
          throw new Error(`Invalid balance recorded for ${asset.assetSymbol}`);
        }
        if (!Number.isFinite(previousValue) || previousValue < 0) {
          throw new Error(`Invalid recorded value for ${asset.assetSymbol}`);
        }
        previousMarkedAssetsValue += previousValue;

        if (balance === 0) {
          assetValues.push({ id: asset.id, value: 0 });
          continue;
        }

        const mark = marks.get(asset.assetSymbol.toUpperCase());
        if (!mark) {
          throw new Error(`Missing reliable valuation price for ${asset.assetSymbol}`);
        }
        const value = balance * mark.price;
        if (!Number.isFinite(value)) {
          throw new Error(`Calculated value is invalid for ${asset.assetSymbol}`);
        }
        revaluedAssetsValue += value;
        oldestMarkTime = Math.min(oldestMarkTime, mark.asOf.getTime());
        assetValues.push({ id: asset.id, value });
      }

      const accountedTvl = Number(pool.totalValueLocked ?? 0);
      const shareSupply = Number(pool.shareTokenSupply ?? 0);
      if (
        !Number.isFinite(accountedTvl) ||
        accountedTvl < 0 ||
        !Number.isFinite(shareSupply) ||
        shareSupply < 0
      ) {
        throw new Error(`Invalid accounting values recorded for pool ${poolId}`);
      }

      // Preserve unallocated cash while replacing the stale marks on held assets.
      const hasHeldAssets = currentAssets.some(
        (asset) => Number(asset.currentBalance ?? 0) > 0
      );
      // Without prior asset marks, treating all TVL as cash would double count holdings.
      const cashValue = hasHeldAssets
        ? previousMarkedAssetsValue > 0
          ? Math.max(0, accountedTvl - previousMarkedAssetsValue)
          : 0
        : accountedTvl;
      const totalValueLocked = Number(
        (cashValue + revaluedAssetsValue).toFixed(2)
      );
      const sharePrice =
        shareSupply > 0
          ? Number((totalValueLocked / shareSupply).toFixed(8))
          : 1;

      for (const asset of assetValues) {
        await tx
          .update(poolAssets)
          .set({ currentValueUsd: asset.value.toFixed(2), updatedAt: asOf })
          .where(eq(poolAssets.id, asset.id));
      }
      await tx
        .update(investmentPools)
        .set({
          totalValueLocked: totalValueLocked.toFixed(2),
          sharePrice: sharePrice.toFixed(8),
          updatedAt: asOf,
        })
        .where(eq(investmentPools.id, poolId));

      logger.info('Investment pool share price revalued', {
        poolId,
        totalValueLocked,
        sharePrice,
        asOf: new Date(oldestMarkTime).toISOString(),
      });

      return { poolId, totalValueLocked, sharePrice, asOf: new Date(oldestMarkTime) };
    });
  }

  async revalueAllActivePools(): Promise<void> {
    const pools = await db
      .select({ id: investmentPools.id })
      .from(investmentPools)
      .where(eq(investmentPools.isActive, true));

    for (const pool of pools) {
      try {
        await this.revaluePool(pool.id);
      } catch (error) {
        logger.error('Failed to revalue investment pool', {
          poolId: pool.id,
          error,
        });
      }
    }
  }
}

export const poolShareValuationService = new PoolShareValuationService();
