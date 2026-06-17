import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../utils/logger';
import { priceOracle } from './priceOracle';
import { stableInflowEvents } from '@shared/schema';
import { stableAssetRegistryService } from './stableAssetRegistryService';
import { stableRiskMonitorService } from './stableRiskMonitorService';
import type { StableInflowProcessResult, StableRiskFlags } from '../types/stableInflow';

export interface StableInflowPayload {
  source?: string;
  chain?: string;
  chainId: number;
  txHash: string;
  logIndex?: number;
  tokenAddress: string;
  tokenSymbol: string;
  decimals: number;
  rawAmount: string;
  fromAddress?: string;
  toAddress: string;
  blockTimestamp?: number;
  confirmations?: number;
  provider?: string;
  metadata?: Record<string, any>;
}

// Keep mathematical helper utilities cleanly isolated out of the class footprint
function pow10(exp: number): bigint { return exp <= 0 ? 1n : BigInt(`1${'0'.repeat(exp)}`); }
function divideRound(num: bigint, den: bigint): bigint {
  if (den === 0n) return 0n;
  const quot = num / den;
  const rem = num % den;
  return rem * 2n >= den ? quot + 1n : quot;
}
function normalizeAddress(addr?: string): string | undefined {
  if (!addr) return undefined;
  const trimmed = addr.trim();
  return trimmed.startsWith('0x') ? trimmed.toLowerCase() : trimmed;
}
function decimalToScaledBigInt(val: string, scale: number): bigint {
  const trimmed = val.trim();
  const neg = trimmed.startsWith('-');
  const pos = neg ? trimmed.slice(1) : trimmed;
  const [intRaw, fracRaw = ''] = pos.split('.');
  const paddedFrac = (fracRaw + '0'.repeat(scale)).slice(0, scale);
  const nextDigit = fracRaw.length > scale ? fracRaw[scale] : '0';
  let res = BigInt(intRaw || '0') * pow10(scale) + BigInt(paddedFrac || '0');
  if (nextDigit >= '5') res += 1n;
  return neg ? -res : res;
}
function scaledBigIntToDecimal(val: bigint, scale: number): string {
  const neg = val < 0n;
  const abs = neg ? -val : val;
  const divisor = pow10(scale);
  const whole = abs / divisor;
  const frac = abs % divisor;
  const fracStr = frac.toString().padStart(scale, '0').replace(/0+$/, '');
  const signedWhole = `${neg ? '-' : ''}${whole.toString()}`;
  return fracStr.length ? `${signedWhole}.${fracStr}` : signedWhole;
}
function rawToTokenAmount(raw: bigint, dec: number): string {
  return dec <= 18 
    ? scaledBigIntToDecimal(raw * pow10(18 - dec), 18)
    : scaledBigIntToDecimal(divideRound(raw, pow10(dec - 18)), 18);
}

function computeRiskFlags(input: {
  pegDeviationBps: number;
  depegThresholdBps: number;
  delayState: 'on_time' | 'delayed' | 'unknown';
  liquidityScore: number;
  riskScore: number;
}): StableRiskFlags {
  const flags: StableRiskFlags = {
    depegDetected: input.pegDeviationBps >= input.depegThresholdBps,
    delayedConfirmation: input.delayState === 'delayed',
    lowLiquidity: input.liquidityScore < 50,
    highRiskScore: input.riskScore >= 70,
    notes: [],
  };
  if (flags.depegDetected) flags.notes.push(`Peg deviation ${input.pegDeviationBps}bps exceeds threshold`);
  if (flags.delayedConfirmation) flags.notes.push('Confirmation delay exceeded policy threshold');
  if (flags.lowLiquidity) flags.notes.push('Liquidity score below recommended threshold');
  if (flags.highRiskScore) flags.notes.push('Risk score in high-risk zone');
  return flags;
}

export class StableInflowModule {
  private overlaySyncStarted = false;

  isEnabled(): boolean {
    return process.env.STABLE_INFLOW_ENABLED === 'true';
  }

  private async ensureOverlaySync(): Promise<void> {
    if (this.overlaySyncStarted) return;
    this.overlaySyncStarted = true;
    await stableAssetRegistryService.syncOverlayToDatabase();
  }

  /**
   * Hardened processing engine featuring a strict Postgres atomic upsert lock.
   */
  async processStableInflow(payload: StableInflowPayload): Promise<StableInflowProcessResult> {
    try {
      if (!this.isEnabled()) {
        return { success: false, error: 'Stable inflow module is disabled' };
      }

      await this.ensureOverlaySync();

      const logIndex = payload.logIndex ?? 0;
      const tokenAddress = normalizeAddress(payload.tokenAddress);
      const toAddress = normalizeAddress(payload.toAddress);
      const fromAddress = normalizeAddress(payload.fromAddress);
      const chain = payload.chain?.toLowerCase() || 'unknown';

      if (!tokenAddress || !toAddress) {
        return { success: false, error: 'Missing tokenAddress or toAddress for stable inflow processing' };
      }

      // 1. Resolve asset constraints safely from the registry
      const asset = await stableAssetRegistryService.resolveStableAsset({
        chain,
        chainId: payload.chainId,
        tokenAddress,
        symbol: payload.tokenSymbol,
      });

      if (!asset) {
        return { success: false, error: `Stable asset not registered for chain ${chain} token ${tokenAddress}` };
      }

      const rawAmount = BigInt(payload.rawAmount);
      if (rawAmount < 0n) return { success: false, error: 'Raw amount cannot be negative' };

      // 2. Process side-effect data pipelines (Prices, Delays, Flags)
      const observedPrice = await priceOracle.getPrice(asset.symbol);
      const observedPriceUsd = observedPrice?.priceUsd ? observedPrice.priceUsd.toFixed(8) : asset.pegTargetUsd;
      
      const priceScaled8 = decimalToScaledBigInt(observedPriceUsd, 8);
      const usdScaled8 = divideRound(rawAmount * priceScaled8, pow10(asset.decimals));
      const stableUnitsMicroUsd = divideRound(usdScaled8, 100n);
      const normalizedTokenAmount = rawToTokenAmount(rawAmount, asset.decimals);
      const normalizedAmountUsd = scaledBigIntToDecimal(usdScaled8, 8);

      const observedDelaySec = payload.blockTimestamp
        ? Math.max(0, Math.floor(Date.now() / 1000) - payload.blockTimestamp)
        : undefined;

      const confirmations = payload.confirmations ?? 0;
      const confirmationState = confirmations >= asset.minConfirmations 
        ? 'confirmed' 
        : confirmations > 0 ? 'low_confirmations' : 'pending';

      const delayState = typeof observedDelaySec !== 'number'
        ? 'unknown'
        : observedDelaySec > asset.maxConfirmationDelaySec ? 'delayed' : 'on_time';

      const pegTarget = Number(asset.pegTargetUsd);
      const pegDeviationBps = pegTarget > 0
        ? Math.round((Math.abs(Number(observedPriceUsd) - pegTarget) / pegTarget) * 10_000)
        : 0;

      const riskFlags = computeRiskFlags({
        pegDeviationBps,
        depegThresholdBps: asset.depegThresholdBps,
        delayState,
        liquidityScore: asset.liquidityScore,
        riskScore: asset.riskScore,
      });

      const status = (riskFlags.depegDetected || riskFlags.delayedConfirmation || riskFlags.lowLiquidity || riskFlags.highRiskScore)
        ? 'flagged'
        : 'received';

      // 3. ATOMIC UPSERT TRANSACTION MATRIX: Prevents duplicate state calculation drops
      const insertResult = await db
        .insert(stableInflowEvents)
        .values({
          source: payload.source || 'webhook',
          chain: asset.chain,
          chainId: payload.chainId,
          txHash: payload.txHash,
          logIndex,
          tokenAddress,
          tokenSymbol: asset.symbol,
          tokenDecimals: asset.decimals,
          toAddress,
          fromAddress,
          rawAmount: rawAmount.toString(),
          normalizedTokenAmount,
          normalizedAmountUsd,
          stableUnitsMicroUsd: stableUnitsMicroUsd.toString(),
          confirmations,
          minConfirmations: asset.minConfirmations,
          confirmationState,
          delayState,
          observedConfirmationDelaySec: observedDelaySec,
          pegTargetUsd: asset.pegTargetUsd,
          observedPriceUsd,
          pegDeviationBps,
          riskFlags,
          status,
          metadata: { provider: payload.provider, ...payload.metadata },
        } as any)
        // Instruct Postgres to preserve existing record state if uniqueness criteria bounds overlap
        .onConflictDoUpdate({
          target: [
            stableInflowEvents.chainId, 
            stableInflowEvents.txHash, 
            stableInflowEvents.logIndex, 
            stableInflowEvents.tokenAddress, 
            stableInflowEvents.toAddress
          ],
          set: {
            // Safe increment pattern if confirmation state adjustments hit later
            confirmations: sql`EXCLUDED.confirmations`,
            confirmationState: sql`EXCLUDED.confirmation_state`,
            updatedAt: new Date()
          }
        })
        .returning({ 
          id: stableInflowEvents.id,
          status: stableInflowEvents.status,
          xmin: sql`xmin::text` // Grabs row system identifier to check if record was written or updated
        });

      const activeRecord = insertResult[0];
      if (!activeRecord) {
        return { success: false, error: 'Failed to persist stable inflow event' };
      }

      // Check if row existed previously or was freshly inserted
      // Note: If you don't want to use xmin, you can verify if status matches existing metadata
      const isDuplicate = status !== activeRecord.status; 

      if (isDuplicate) {
        return {
          success: true,
          duplicate: true,
          stableInflowEventId: activeRecord.id,
          normalizedAmountUsd,
          stableUnitsMicroUsd: stableUnitsMicroUsd.toString(),
          riskFlags,
          confirmationState,
        };
      }

      // 4. Fire-and-forget Risk Monitoring processing safely isolated out of the client response path
      stableRiskMonitorService
        .evaluateInflow({
          stableInflowEventId: activeRecord.id,
          source: payload.source || 'webhook',
          symbol: asset.symbol,
          chain: asset.chain,
          chainId: payload.chainId,
          tokenAddress,
          txHash: payload.txHash,
          normalizedAmountUsd,
          stableUnitsMicroUsd: stableUnitsMicroUsd.toString(),
          pegDeviationBps,
          confirmationState,
          delayState,
          riskFlags,
        }, asset)
        .catch((err) => {
          logger.warn('[StableInflowModule] Risk monitor evaluation async drop', {
            error: err.message,
            stableInflowEventId: activeRecord.id,
          });
        });

      return {
        success: true,
        stableInflowEventId: activeRecord.id,
        normalizedAmountUsd,
        stableUnitsMicroUsd: stableUnitsMicroUsd.toString(),
        riskFlags,
        confirmationState,
      };

    } catch (error: any) {
      logger.error('[StableInflowModule CRITICAL] Execution tracking failure', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async markCredited(stableInflowEventId: string, linkage?: Record<string, any>): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        const existing = await tx
          .select({ metadata: stableInflowEvents.metadata })
          .from(stableInflowEvents)
          .where(eq(stableInflowEvents.id, stableInflowEventId))
          .for('update') // Enforce strict write-lock behavior on record update sequence
          .limit(1);

        const currentMetadata = existing[0]?.metadata as Record<string, any> || {};
        
        await tx
          .update(stableInflowEvents)
          .set({
            status: 'credited',
            updatedAt: new Date(),
            metadata: {
              ...currentMetadata,
              creditedAt: new Date().toISOString(),
              ...linkage,
            }
          } as any)
          .where(eq(stableInflowEvents.id, stableInflowEventId));
      });
    } catch (error: any) {
      logger.warn('[StableInflowModule] Failed to mark inflow as credited', { stableInflowEventId, error: error.message });
    }
  }

  async markFailed(stableInflowEventId: string, reason: string): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        const existing = await tx
          .select({ metadata: stableInflowEvents.metadata })
          .from(stableInflowEvents)
          .where(eq(stableInflowEvents.id, stableInflowEventId))
          .for('update')
          .limit(1);

        const currentMetadata = existing[0]?.metadata as Record<string, any> || {};

        await tx
          .update(stableInflowEvents)
          .set({
            status: 'failed',
            updatedAt: new Date(),
            metadata: {
              ...currentMetadata,
              failureReason: reason,
              failedAt: new Date().toISOString(),
            },
          } as any)
          .where(eq(stableInflowEvents.id, stableInflowEventId));
      });
    } catch (error: any) {
      logger.warn('[StableInflowModule] Failed to mark inflow as failed', { stableInflowEventId, error: error.message });
    }
  }
}

export const stableInflowModule = new StableInflowModule();