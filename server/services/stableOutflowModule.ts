import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../utils/logger';
import { priceOracle } from './priceOracle';
import { stableOutflowEvents } from '@shared/schema';
import { stableAssetRegistryService } from './stableAssetRegistryService';
import { stableRiskMonitorService } from './stableRiskMonitorService';
import type {
  StableOutflowProcessResult,
  StableRiskFlags,
} from '../types/stableOutflow';

export interface StableOutflowPayload {
  source?: string;
  chain?: string;
  chainId: number;
  txHash?: string; // Optional for initiated outflows
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
  metadata?: Record<string, any>;
}

function pow10(exp: number): bigint {
  if (exp <= 0) return 1n;
  return BigInt(`1${'0'.repeat(exp)}`);
}

function divideRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) return 0n;
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder * 2n >= denominator) {
    return quotient + 1n;
  }
  return quotient;
}

function normalizeAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const trimmed = address.trim();
  if (trimmed.startsWith('0x')) return trimmed.toLowerCase();
  return trimmed;
}

function decimalToScaledBigInt(value: string, scale: number): bigint {
  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const positiveValue = negative ? trimmed.slice(1) : trimmed;
  const [integerPartRaw, fractionalRaw = ''] = positiveValue.split('.');
  const integerPart = integerPartRaw || '0';
  const paddedFraction = (fractionalRaw + '0'.repeat(scale)).slice(0, scale);
  const nextDigit = fractionalRaw.length > scale ? fractionalRaw[scale] : '0';

  let result = BigInt(integerPart) * pow10(scale) + BigInt(paddedFraction || '0');
  if (nextDigit >= '5') {
    result += 1n;
  }
  return negative ? -result : result;
}

function scaledBigIntToDecimal(value: bigint, scale: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const divisor = pow10(scale);
  const whole = abs / divisor;
  const fraction = abs % divisor;
  const fractionStr = fraction.toString().padStart(scale, '0').replace(/0+$/, '');
  const signedWhole = `${negative ? '-' : ''}${whole.toString()}`;
  return fractionStr.length ? `${signedWhole}.${fractionStr}` : signedWhole;
}

function rawToTokenAmount(rawAmount: bigint, decimals: number): string {
  const effectiveScale = Math.min(Math.max(decimals, 0), 18);
  if (decimals <= 18) {
    return scaledBigIntToDecimal(rawAmount * pow10(18 - decimals), 18);
  }
  return scaledBigIntToDecimal(divideRound(rawAmount, pow10(decimals - 18)), 18);
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

  if (flags.depegDetected) {
    flags.notes.push(`Peg deviation ${input.pegDeviationBps}bps exceeds threshold`);
  }
  if (flags.delayedConfirmation) {
    flags.notes.push('Confirmation delay exceeded policy threshold');
  }
  if (flags.lowLiquidity) {
    flags.notes.push('Liquidity score below recommended threshold');
  }
  if (flags.highRiskScore) {
    flags.notes.push('Risk score in high-risk zone');
  }

  return flags;
}

function resolveChainFromId(chainId: number): string {
  switch (chainId) {
    case 42220: return 'celo';
    case 1: return 'ethereum';
    case 728126428: return 'tron';
    case 101: return 'solana';
    case 8453: return 'base';
    case 43114: return 'avalanche';
    case 137: return 'polygon';
    case 42161: return 'arbitrum';
    case 10: return 'optimism';
    case 1285: return 'moonriver';
    case 324: return 'zksync';
    case 50: return 'xdc';
    case 8217: return 'klaytn';
    case 2222: return 'kava';
    case 56: return 'bsc';
    case 1101: return 'polygon-zkevm';
    case 1284: return 'moonbeam';
    case 288: return 'boba';
    case 1313161554: return 'aurora';
    case 250: return 'fantom';
    case 9001: return 'evmos';
    case 1666600000: return 'harmony';
    case 100: return 'gnosis';
    default: return 'unknown';
  }
}

class StableOutflowModule {
  private overlaySyncStarted = false;

  isEnabled(): boolean {
    return process.env.STABLE_OUTFLOW_ENABLED === 'true';
  }

  private async ensureOverlaySync(): Promise<void> {
    if (this.overlaySyncStarted) return;
    this.overlaySyncStarted = true;
    await stableAssetRegistryService.syncOverlayToDatabase();
  }

  async processStableOutflow(payload: StableOutflowPayload): Promise<StableOutflowProcessResult> {
    try {
      if (!this.isEnabled()) {
        return {
          success: false,
          error: 'Stable outflow module is disabled',
        };
      }

      await this.ensureOverlaySync();

      const chain = payload.chain?.toLowerCase() || resolveChainFromId(payload.chainId);
      const tokenAddress = normalizeAddress(payload.tokenAddress);
      const fromAddress = normalizeAddress(payload.fromAddress);
      const toAddress = normalizeAddress(payload.toAddress);
      const logIndex = payload.logIndex ?? 0;
      const confirmations = payload.confirmations ?? 0;

      if (!tokenAddress || !fromAddress) {
        return {
          success: false,
          error: 'Missing tokenAddress or fromAddress for stable outflow processing',
        };
      }

      const txHash = payload.txHash || ''; // Allow outflows without txHash if initiated internally

      const existing = await db
        .select()
        .from(stableOutflowEvents)
        .where(
          and(
            eq(stableOutflowEvents.chainId, payload.chainId),
            eq(stableOutflowEvents.txHash, txHash),
            eq(stableOutflowEvents.logIndex, logIndex),
            eq(stableOutflowEvents.tokenAddress, tokenAddress),
            eq(stableOutflowEvents.fromAddress, fromAddress)
          )
        )
        .limit(1);

      if (existing[0]) {
        return {
          success: true,
          duplicate: true,
          stableOutflowEventId: existing[0].id,
          normalizedAmountUsd: String(existing[0].normalizedAmountUsd),
          stableUnitsMicroUsd: String(existing[0].stableUnitsMicroUsd),
          riskFlags: (existing[0].riskFlags as StableRiskFlags) || undefined,
          confirmationState: existing[0].confirmationState as any,
        };
      }

      const asset = await stableAssetRegistryService.resolveStableAsset({
        chain,
        chainId: payload.chainId,
        tokenAddress,
        symbol: payload.tokenSymbol,
      });

      if (!asset) {
        return {
          success: false,
          error: `Stable asset not registered for chain ${chain} token ${tokenAddress}`,
        };
      }

      const rawAmount = BigInt(payload.rawAmount);
      if (rawAmount < 0n) {
        return {
          success: false,
          error: 'Raw amount cannot be negative',
        };
      }

      const observedPrice = await priceOracle.getPrice(asset.symbol);
      const observedPriceUsd = observedPrice?.priceUsd
        ? observedPrice.priceUsd.toFixed(8)
        : asset.pegTargetUsd;

      const priceScaled8 = decimalToScaledBigInt(observedPriceUsd, 8);
      const usdScaled8 = divideRound(rawAmount * priceScaled8, pow10(asset.decimals));
      const stableUnitsMicroUsd = divideRound(usdScaled8, 100n);
      const normalizedTokenAmount = rawToTokenAmount(rawAmount, asset.decimals);
      const normalizedAmountUsd = scaledBigIntToDecimal(usdScaled8, 8);

      const observedDelaySec = payload.blockTimestamp
        ? Math.max(0, Math.floor(Date.now() / 1000) - payload.blockTimestamp)
        : undefined;

      const confirmationState =
        confirmations >= asset.minConfirmations
          ? 'confirmed'
          : confirmations > 0
            ? 'low_confirmations'
            : 'pending';

      const delayState: 'on_time' | 'delayed' | 'unknown' =
        typeof observedDelaySec !== 'number'
          ? 'unknown'
          : observedDelaySec > asset.maxConfirmationDelaySec
            ? 'delayed'
            : 'on_time';

      const pegTarget = Number(asset.pegTargetUsd);
      const observedPriceNum = Number(observedPriceUsd);
      const pegDeviationBps =
        pegTarget > 0
          ? Math.round((Math.abs(observedPriceNum - pegTarget) / pegTarget) * 10_000)
          : 0;

      const riskFlags = computeRiskFlags({
        pegDeviationBps,
        depegThresholdBps: asset.depegThresholdBps,
        delayState,
        liquidityScore: asset.liquidityScore,
        riskScore: asset.riskScore,
      });

      const status = riskFlags.depegDetected ||
        riskFlags.delayedConfirmation ||
        riskFlags.lowLiquidity ||
        riskFlags.highRiskScore
        ? 'flagged'
        : 'sent';

      const insertResult = await db
        .insert(stableOutflowEvents)
        .values({
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
            ...payload.metadata,
          },
        } as any)
        .returning({ id: stableOutflowEvents.id });

      const stableOutflowEventId = insertResult[0]?.id;
      if (!stableOutflowEventId) {
        return {
          success: false,
          error: 'Failed to persist stable outflow event',
        };
      }

      stableRiskMonitorService
        .evaluateOutflow(
          {
            stableOutflowEventId,
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
          },
          asset
        )
        .catch((error) => {
          logger.warn('[StableOutflowModule] Risk monitor evaluation failed', {
            error: (error as Error).message,
            stableOutflowEventId,
          });
        });

      return {
        success: true,
        stableOutflowEventId,
        normalizedAmountUsd,
        stableUnitsMicroUsd: stableUnitsMicroUsd.toString(),
        riskFlags,
        confirmationState,
      };
    } catch (error) {
      logger.warn('[StableOutflowModule] Failed to process stable outflow', {
        error: (error as Error).message,
      });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async markConfirmed(
    stableOutflowEventId: string,
    confirmations: number,
    txHash?: string
  ): Promise<void> {
    try {
      const existing = await db
        .select({ metadata: stableOutflowEvents.metadata })
        .from(stableOutflowEvents)
        .where(eq(stableOutflowEvents.id, stableOutflowEventId))
        .limit(1);

      const currentMetadata = existing[0]?.metadata as Record<string, any> || {};

      const updatePayload: Record<string, any> = {
        status: 'confirmed',
        confirmations,
        updatedAt: new Date(),
      };

      if (txHash) {
        updatePayload.txHash = txHash;
      }

      updatePayload.metadata = {
        ...currentMetadata,
        confirmedAt: new Date().toISOString(),
      };

      await db
        .update(stableOutflowEvents)
        .set(updatePayload as any)
        .where(eq(stableOutflowEvents.id, stableOutflowEventId));
    } catch (error) {
      logger.warn('[StableOutflowModule] Failed to mark outflow as confirmed', {
        stableOutflowEventId,
        error: (error as Error).message,
      });
    }
  }

  async markFailed(stableOutflowEventId: string, reason: string): Promise<void> {
    try {
      const existing = await db
        .select({ metadata: stableOutflowEvents.metadata })
        .from(stableOutflowEvents)
        .where(eq(stableOutflowEvents.id, stableOutflowEventId))
        .limit(1);

      const currentMetadata = existing[0]?.metadata as Record<string, any> || {};

      await db
        .update(stableOutflowEvents)
        .set({
          status: 'failed',
          metadata: {
            ...currentMetadata,
            failureReason: reason,
            failedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        } as any)
        .where(eq(stableOutflowEvents.id, stableOutflowEventId));
    } catch (error) {
      logger.warn('[StableOutflowModule] Failed to mark outflow as failed', {
        stableOutflowEventId,
        error: (error as Error).message,
      });
    }
  }
}

export const stableOutflowModule = new StableOutflowModule();