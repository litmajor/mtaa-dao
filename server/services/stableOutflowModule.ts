import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../utils/logger';
import { priceOracle } from './priceOracle';
import { stableOutflowEvents, InsertStableOutflowEvent } from '../../shared/schema';
import { stableAssetRegistryService } from './stableAssetRegistryService';
import { stableRiskMonitorService } from './stableRiskMonitorService';
import type { StableRiskFlags } from '../types/stableInflow';

export interface StableOutflowProcessResult {
  success: boolean;
  stableOutflowEventId?: string;
  duplicate?: boolean;
  normalizedAmountUsd?: string;
  stableUnitsMicroUsd?: string;
  riskFlags?: StableRiskFlags;
  confirmationState?: 'pending' | 'confirmed' | 'low_confirmations';
  error?: string;
}

export interface StableOutflowPayload {
  source?: string;
  chain?: string;
  chainId: number;
  txHash?: string;
  logIndex?: number;
  tokenAddress: string;
  tokenSymbol: string;
  decimals: number;
  rawAmount: string;
  fromAddress: string;
  toAddress?: string;
  blockTimestamp?: number;
  confirmations?: number;
  provider?: string;
  metadata?: Record<string, unknown>;
  internalReference?: string; // CRITICAL: Fallback unique lock id for pre-flight transactions
}

// Memory-isolated math utilities
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

export class StableOutflowModule {
  private overlaySyncStarted = false;

  isEnabled(): boolean {
    return process.env.STABLE_OUTFLOW_ENABLED === 'true';
  }

  private async ensureOverlaySync(): Promise<void> {
    if (this.overlaySyncStarted) return;
    this.overlaySyncStarted = true;
    await stableAssetRegistryService.syncOverlayToDatabase();
  }

  /**
   * Hardened Outflow Processor handling both explicit block-events and internal keyless pre-flight sequences.
   */
  async processStableOutflow(payload: StableOutflowPayload): Promise<StableOutflowProcessResult> {
    try {
      if (!this.isEnabled()) {
        return { success: false, error: 'Stable outflow module is disabled' };
      }

      await this.ensureOverlaySync();

      const chain = payload.chain?.toLowerCase() || 'unknown';
      const tokenAddress = normalizeAddress(payload.tokenAddress);
      const fromAddress = normalizeAddress(payload.fromAddress);
      const toAddress = normalizeAddress(payload.toAddress);
      const logIndex = payload.logIndex ?? 0;
      const confirmations = payload.confirmations ?? 0;
      const txHash = payload.txHash || ''; 

      if (!tokenAddress || !fromAddress) {
        return { success: false, error: 'Missing tokenAddress or fromAddress for stable outflow processing' };
      }

      // 1. Resolve asset invariants from your definitions
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

      // 2. Perform Arbitrary Precision Matrix Pricing calculations
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
        : 'sent';

      // 3. ATOMIC UPSERT WITH DUPLICATE LOG FILTERING
      const insertPayload: InsertStableOutflowEvent = {
        source: payload.source || 'internal',
        chain: asset.chain,
        chainId: payload.chainId,
        txHash,
        logIndex,
        tokenAddress,
        tokenSymbol: asset.symbol,
        tokenDecimals: asset.decimals,
        fromAddress,
        toAddress,
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
        metadata: {
          provider: payload.provider,
          internalReference: payload.internalReference,
          ...(payload.metadata || {}),
        },
      };

      const insertResult = await db
        .insert(stableOutflowEvents)
        .values(insertPayload)
        .onConflictDoUpdate({
          // Target your composite indexing parameters strictly
          target: [
            stableOutflowEvents.chainId,
            stableOutflowEvents.txHash,
            stableOutflowEvents.logIndex,
            stableOutflowEvents.tokenAddress,
            stableOutflowEvents.fromAddress
          ],
          set: {
            confirmations: sql`EXCLUDED.confirmations`,
            confirmationState: sql`EXCLUDED.confirmation_state`,
            // If the transaction hash was updated from pre-flight to mined status, update it
            txHash: sql`CASE WHEN stable_outflow_events.tx_hash = '' THEN EXCLUDED.tx_hash ELSE stable_outflow_events.tx_hash END`,
            updatedAt: new Date()
          }
        })
        .returning({ id: stableOutflowEvents.id, status: stableOutflowEvents.status });

      const activeRecord = insertResult[0];
      if (!activeRecord) {
        return { success: false, error: 'Failed to persist stable outflow event' };
      }

      // Check if row existed previously or was freshly inserted
      const isDuplicate = status === activeRecord.status;

      if (isDuplicate) {
        return {
          success: true,
          duplicate: true,
          stableOutflowEventId: activeRecord.id,
          normalizedAmountUsd,
          stableUnitsMicroUsd: stableUnitsMicroUsd.toString(),
          riskFlags,
          confirmationState,
        };
      }

      // 4. Safe decoupling of Risk Monitor execution out of response pathway
      stableRiskMonitorService
        .evaluateInflow({
          stableInflowEventId: activeRecord.id,
          source: payload.source || 'internal',
          symbol: asset.symbol,
          chain: asset.chain,
          chainId: payload.chainId,
          tokenAddress,
          txHash,
          normalizedAmountUsd,
          stableUnitsMicroUsd: stableUnitsMicroUsd.toString(),
          pegDeviationBps,
          confirmationState,
          delayState,
          riskFlags,
        }, asset)
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn('[StableOutflowModule] Risk monitor async drop', {
            error: msg,
            stableOutflowEventId: activeRecord.id,
          });
        });

      return {
        success: true,
        stableOutflowEventId: activeRecord.id,
        normalizedAmountUsd,
        stableUnitsMicroUsd: stableUnitsMicroUsd.toString(),
        riskFlags,
        confirmationState,
      };

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[StableOutflowModule CRITICAL] Fatal pipeline error', { error: msg });
      return { success: false, error: msg };
    }
  }

  async markConfirmed(stableOutflowEventId: string, confirmations: number, txHash?: string): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        const existing = await tx
          .select({ metadata: stableOutflowEvents.metadata })
          .from(stableOutflowEvents)
          .where(eq(stableOutflowEvents.id, stableOutflowEventId))
          .for('update') // Enforce strict transaction sequence write-lock mapping
          .limit(1);

        const currentMetadata = (existing[0]?.metadata as Record<string, unknown>) || {};
        const updatePayload: Partial<InsertStableOutflowEvent> = {
          status: 'confirmed',
          confirmations,
          updatedAt: new Date(),
          metadata: {
            ...currentMetadata,
            confirmedAt: new Date().toISOString(),
          },
        };

        if (txHash) {
          updatePayload.txHash = txHash;
        }

        await tx.update(stableOutflowEvents).set(updatePayload).where(eq(stableOutflowEvents.id, stableOutflowEventId));
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn('[StableOutflowModule] Failed to mark outflow as confirmed', { stableOutflowEventId, error: msg });
    }
  }

  async markFailed(stableOutflowEventId: string, reason: string): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        const existing = await tx
          .select({ metadata: stableOutflowEvents.metadata })
          .from(stableOutflowEvents)
          .where(eq(stableOutflowEvents.id, stableOutflowEventId))
          .for('update')
          .limit(1);

        const currentMetadata = (existing[0]?.metadata as Record<string, unknown>) || {};
        const updatePayload: Partial<InsertStableOutflowEvent> = {
          status: 'failed',
          metadata: {
            ...currentMetadata,
            failureReason: reason,
            failedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        };

        await tx.update(stableOutflowEvents).set(updatePayload).where(eq(stableOutflowEvents.id, stableOutflowEventId));
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn('[StableOutflowModule] Failed to mark outflow as failed', { stableOutflowEventId, error: msg });
    }
  }
}
export const stableOutflowModule = new StableOutflowModule();