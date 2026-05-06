import { MessageType, messageBus } from '../core/agent-framework/message-bus';
import { logger } from '../utils/logger';
import { priceOracle } from './priceOracle';
import { stableAssetRegistryService } from './stableAssetRegistryService';
import { treasuryPriceUpdateService } from './treasuryPriceUpdateService';
import { wsConnectionManager } from './WebSocketConnectionManager';
import type { StableAssetDefinition, StableRiskFlags } from '../types/stableInflow';

interface StableRiskEvaluationInput {
  stableInflowEventId: string;
  source: string;
  symbol: string;
  chain: string;
  chainId: number;
  tokenAddress: string;
  txHash: string;
  normalizedAmountUsd: string;
  stableUnitsMicroUsd: string;
  pegDeviationBps: number;
  confirmationState: string;
  delayState: string;
  riskFlags: StableRiskFlags;
}

class StableRiskMonitorService {
  private pollIntervalHandle: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs: number;
  private readonly alertsEnabled: boolean;

  constructor() {
    this.pollIntervalMs = Number(process.env.STABLE_RISK_POLL_INTERVAL_MS || 5 * 60 * 1000);
    this.alertsEnabled = process.env.STABLE_RISK_ALERTS_ENABLED === 'true';
    if (this.alertsEnabled) {
      this.start();
    }
  }

  start(): void {
    if (!this.alertsEnabled || this.pollIntervalHandle) return;

    this.pollIntervalHandle = setInterval(() => {
      this.pollActiveStableAssets().catch((error) => {
        logger.warn('[StableRiskMonitorService] Poll cycle failed', {
          error: (error as Error).message,
        });
      });
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (!this.pollIntervalHandle) return;
    clearInterval(this.pollIntervalHandle);
    this.pollIntervalHandle = null;
  }

  async evaluateInflow(
    input: StableRiskEvaluationInput,
    asset: StableAssetDefinition
  ): Promise<void> {
    const subtype = input.riskFlags.depegDetected ? 'depeg_alert' : 'stable_inflow';
    const priority = input.riskFlags.depegDetected ? 'high' : input.riskFlags.delayedConfirmation ? 'medium' : 'low';

    const payload = {
      subtype,
      stableInflowEventId: input.stableInflowEventId,
      source: input.source,
      symbol: input.symbol,
      chain: input.chain,
      chainId: input.chainId,
      tokenAddress: input.tokenAddress,
      txHash: input.txHash,
      normalizedAmountUsd: input.normalizedAmountUsd,
      stableUnitsMicroUsd: input.stableUnitsMicroUsd,
      pegDeviationBps: input.pegDeviationBps,
      confirmationState: input.confirmationState,
      delayState: input.delayState,
      riskFlags: input.riskFlags,
      riskProfile: {
        riskScore: asset.riskScore,
        liquidityScore: asset.liquidityScore,
        depegThresholdBps: asset.depegThresholdBps,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      await messageBus.broadcast(MessageType.TREASURY_HEALTH, payload, 'stable-risk-monitor', priority);
    } catch (error) {
      logger.warn('[StableRiskMonitorService] Failed to broadcast treasury health message', {
        error: (error as Error).message,
      });
    }

    wsConnectionManager.broadcastToSubscription('treasury', {
      type: 'stable_inflow_alert',
      payload,
    });
    wsConnectionManager.broadcastToSubscription('stable_inflows', {
      type: 'stable_inflow_alert',
      payload,
    });

    if (input.riskFlags.depegDetected || input.riskFlags.delayedConfirmation) {
      treasuryPriceUpdateService.triggerPriceUpdate(asset.symbol).catch((error) => {
        logger.warn('[StableRiskMonitorService] Treasury repricing trigger failed', {
          symbol: asset.symbol,
          error: (error as Error).message,
        });
      });
    }
  }

  private async pollActiveStableAssets(): Promise<void> {
    if (!this.alertsEnabled) return;

    const assets = await stableAssetRegistryService.listStableAssets({ isActive: true });
    for (const asset of assets) {
      const price = await priceOracle.getPrice(asset.symbol);
      if (!price?.priceUsd || !Number(asset.pegTargetUsd)) continue;

      const peg = Number(asset.pegTargetUsd);
      if (!peg) continue;
      const deviationBps = Math.round((Math.abs(price.priceUsd - peg) / peg) * 10_000);

      if (deviationBps < asset.depegThresholdBps) continue;

      const payload = {
        subtype: 'depeg_alert',
        symbol: asset.symbol,
        chain: asset.chain,
        chainId: asset.chainId,
        tokenAddress: asset.tokenAddress,
        observedPriceUsd: price.priceUsd,
        pegTargetUsd: peg,
        depegThresholdBps: asset.depegThresholdBps,
        pegDeviationBps: deviationBps,
        timestamp: new Date().toISOString(),
      };

      try {
        await messageBus.broadcast(MessageType.TREASURY_HEALTH, payload, 'stable-risk-monitor', 'high');
      } catch (error) {
        logger.warn('[StableRiskMonitorService] Failed to publish depeg poll alert', {
          symbol: asset.symbol,
          error: (error as Error).message,
        });
      }

      wsConnectionManager.broadcastToSubscription('treasury', {
        type: 'depeg_alert',
        payload,
      });
      wsConnectionManager.broadcastToSubscription('stable_inflows', {
        type: 'depeg_alert',
        payload,
      });

      treasuryPriceUpdateService.triggerPriceUpdate(asset.symbol).catch(() => {
        // non-blocking alert path
      });
    }
  }
}

export const stableRiskMonitorService = new StableRiskMonitorService();

