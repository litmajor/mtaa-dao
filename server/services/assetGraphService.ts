import { logger } from '../utils/logger';
import type { AssetStateSnapshot } from '../types/assetGraph';

/**
 * Compatibility shim for legacy asset graph callers.
 *
 * Some core modules still depend on `assetGraphService.getSnapshot(symbol)`.
 * The full graph service is not present in this codebase, so this shim keeps
 * server startup stable and provides a deterministic fallback snapshot shape.
 */
class AssetGraphServiceCompat {
  private snapshots = new Map<string, AssetStateSnapshot>();

  async getSnapshot(symbol: string): Promise<AssetStateSnapshot | null> {
    const key = symbol?.toUpperCase?.() || symbol;
    const cached = this.snapshots.get(key);
    if (cached) return cached;

    logger.warn(`[assetGraphService] Snapshot not found for ${symbol}; returning fallback snapshot.`);

    const fallback = {
      symbol: key,
      timestamp: Date.now(),
      coreState: {
        riskOverallScore: 50,
        riskGovernanceScore: 50,
        liquidityDepth5pct: 0,
        priceConfidence: 80,
      },
    } as unknown as AssetStateSnapshot;

    this.snapshots.set(key, fallback);
    return fallback;
  }

  setSnapshot(symbol: string, snapshot: AssetStateSnapshot): void {
    const key = symbol?.toUpperCase?.() || symbol;
    this.snapshots.set(key, snapshot);
  }
}

export const assetGraphService = new AssetGraphServiceCompat();
