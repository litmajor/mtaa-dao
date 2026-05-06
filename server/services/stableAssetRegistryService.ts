import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../utils/logger';
import { stableAssetRegistry as stableAssetRegistryTable } from '@shared/schema';
import { TokenRegistry as SharedTokenRegistry } from '../../shared/tokenRegistry';
import { tokenRegistry } from './tokenRegistry';
import { STABLE_ASSET_OVERLAY } from '../config/stableAssets.registry';
import type { StableAssetDefinition } from '../types/stableInflow';

type StableAssetResolveInput = {
  chain?: string;
  chainId?: number;
  tokenAddress?: string;
  symbol?: string;
};

type StableAssetFilters = {
  chain?: string;
  chainId?: number;
  symbol?: string;
  isActive?: boolean;
};

const EVM_CHAINS = new Set([
  'ethereum',
  'celo',
  'polygon',
  'optimism',
  'arbitrum',
  'base',
  'bsc',
  'avalanche',
  'moonriver',
  'zksync',
  'xdc',
  'klaytn',
  'kava',
  'moonbeam',
  'boba',
  'aurora',
  'fantom',
  'evmos',
  'harmony',
  'gnosis',
  'polygon-zkevm',
]);

const CHAIN_ID_BY_NAME: Record<string, number> = {
  celo: 42220,
  ethereum: 1,
  tron: 728126428,
  solana: 101,
  base: 8453,
  avalanche: 43114,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  moonriver: 1285,
  zksync: 324,
  xdc: 50,
  klaytn: 8217,
  kava: 2222,
  bsc: 56,
  'polygon-zkevm': 1101,
  moonbeam: 1284,
  boba: 288,
  aurora: 1313161554,
  fantom: 250,
  evmos: 9001,
  harmony: 1666600000,
  gnosis: 100,
};

const CHAIN_NAME_BY_ID = Object.fromEntries(
  Object.entries(CHAIN_ID_BY_NAME).map(([k, v]) => [v, k])
) as Record<number, string>;

function normalizeChain(input?: string): string | undefined {
  if (!input) return undefined;
  return input.toLowerCase().trim();
}

function normalizeAddress(
  address?: string,
  chain?: string,
  chainId?: number
): string | undefined {
  if (!address) return undefined;
  const trimmed = address.trim();
  const normalizedChain = normalizeChain(chain) || (chainId ? CHAIN_NAME_BY_ID[chainId] : undefined);
  const isEvm = !!normalizedChain && EVM_CHAINS.has(normalizedChain);
  if (trimmed.startsWith('0x') || isEvm) {
    return trimmed.toLowerCase();
  }
  return trimmed;
}

function toRegistryKey(chainId: number, tokenAddress: string): string {
  return `${chainId}:${tokenAddress}`;
}

function riskLevelToScore(level?: string): number {
  if (!level) return 35;
  if (level === 'low') return 20;
  if (level === 'medium') return 50;
  if (level === 'high') return 75;
  return 35;
}

export class StableAssetRegistryService {
  private loadedOverlay = false;
  private localOverlayByKey = new Map<string, StableAssetDefinition>();

  private ensureOverlay(): void {
    if (this.loadedOverlay) return;

    for (const asset of STABLE_ASSET_OVERLAY) {
      const chain = normalizeChain(asset.chain) || 'unknown';
      const tokenAddress = normalizeAddress(asset.tokenAddress, chain, asset.chainId) || asset.tokenAddress;
      const normalized: StableAssetDefinition = {
        ...asset,
        chain,
        tokenAddress,
      };
      this.localOverlayByKey.set(toRegistryKey(asset.chainId, tokenAddress), normalized);
    }

    this.loadedOverlay = true;
  }

  private async loadDbAssets(): Promise<StableAssetDefinition[]> {
    try {
      const rows = await db.select().from(stableAssetRegistryTable);
      return rows.map((row) => ({
        chain: normalizeChain(row.chain) || row.chain,
        chainId: row.chainId,
        tokenAddress: normalizeAddress(row.tokenAddress, row.chain, row.chainId) || row.tokenAddress,
        symbol: row.symbol,
        decimals: row.decimals,
        riskScore: row.riskScore,
        liquidityScore: row.liquidityScore,
        depegThresholdBps: row.depegThresholdBps,
        minConfirmations: row.minConfirmations,
        maxConfirmationDelaySec: row.maxConfirmationDelaySec,
        pegTargetUsd: String(row.pegTargetUsd),
        isActive: row.isActive ?? true,
        metadata: (row.metadata as Record<string, any>) || {},
      }));
    } catch (error) {
      logger.warn('[StableAssetRegistryService] Failed loading DB stable asset registry', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  private loadServerRegistryAssets(): StableAssetDefinition[] {
    try {
      const rows = tokenRegistry.getTokensByCategory('stablecoin');
      return rows.map((token) => {
        const chain = normalizeChain(token.chain) || token.chain;
        const chainId = Number(token.chainId ?? CHAIN_ID_BY_NAME[chain] ?? 0);
        const tokenAddress = normalizeAddress(token.address, chain, chainId) || token.address;
        return {
          chain,
          chainId,
          tokenAddress,
          symbol: token.symbol,
          decimals: token.decimals,
          riskScore: 30,
          liquidityScore: 70,
          depegThresholdBps: 150,
          minConfirmations: 3,
          maxConfirmationDelaySec: 1200,
          pegTargetUsd: '1.00000000',
          isActive: true,
          metadata: {
            source: 'server_token_registry',
            category: token.category,
            coingeckoId: token.coingeckoId,
          },
        };
      });
    } catch (error) {
      logger.warn('[StableAssetRegistryService] Failed reading server token registry', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  private loadSharedRegistryAssets(): StableAssetDefinition[] {
    try {
      const rows = SharedTokenRegistry.getTokensByCategory('stablecoin');
      return rows.map((token) => {
        const chain = 'celo';
        const chainId = CHAIN_ID_BY_NAME[chain];
        const tokenAddress = normalizeAddress(token.address.mainnet, chain, chainId) || token.address.mainnet;
        return {
          chain,
          chainId,
          tokenAddress,
          symbol: token.symbol,
          decimals: token.decimals,
          riskScore: riskLevelToScore(token.riskLevel),
          liquidityScore: token.metadata?.liquidityScore ?? 60,
          depegThresholdBps: token.symbol === 'cKES' ? 350 : token.symbol === 'cEUR' ? 250 : 150,
          minConfirmations: 3,
          maxConfirmationDelaySec: 1200,
          pegTargetUsd: token.symbol === 'cEUR' ? '1.08000000' : token.symbol === 'cKES' ? '0.00775000' : '1.00000000',
          isActive: token.isActive,
          metadata: {
            source: 'shared_token_registry',
            category: token.category,
          },
        };
      });
    } catch (error) {
      logger.warn('[StableAssetRegistryService] Failed reading shared token registry', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  private mergeAssets(sources: StableAssetDefinition[][]): StableAssetDefinition[] {
    const merged = new Map<string, StableAssetDefinition>();
    for (const source of sources) {
      for (const asset of source) {
        const chain = normalizeChain(asset.chain) || asset.chain;
        const tokenAddress = normalizeAddress(asset.tokenAddress, chain, asset.chainId) || asset.tokenAddress;
        if (!asset.chainId || !tokenAddress) continue;
        const key = toRegistryKey(asset.chainId, tokenAddress);
        merged.set(key, {
          ...asset,
          chain,
          tokenAddress,
        });
      }
    }
    return Array.from(merged.values());
  }

  async listStableAssets(filters: StableAssetFilters = {}): Promise<StableAssetDefinition[]> {
    this.ensureOverlay();

    const dbAssets = await this.loadDbAssets();
    const merged = this.mergeAssets([
      this.loadServerRegistryAssets(),
      this.loadSharedRegistryAssets(),
      dbAssets,
      Array.from(this.localOverlayByKey.values()),
    ]);

    const normalizedChain = normalizeChain(filters.chain);
    return merged.filter((asset) => {
      if (normalizedChain && asset.chain !== normalizedChain) return false;
      if (typeof filters.chainId === 'number' && asset.chainId !== filters.chainId) return false;
      if (filters.symbol && asset.symbol.toUpperCase() !== filters.symbol.toUpperCase()) return false;
      if (typeof filters.isActive === 'boolean' && asset.isActive !== filters.isActive) return false;
      return true;
    });
  }

  async resolveStableAsset(input: StableAssetResolveInput): Promise<StableAssetDefinition | null> {
    const assets = await this.listStableAssets({ isActive: true });
    const chain = normalizeChain(input.chain) || (input.chainId ? CHAIN_NAME_BY_ID[input.chainId] : undefined);
    const chainId = input.chainId || (chain ? CHAIN_ID_BY_NAME[chain] : undefined);
    const tokenAddress = normalizeAddress(input.tokenAddress, chain, chainId);
    const symbol = input.symbol?.toUpperCase();

    if (chainId && tokenAddress) {
      const exact = assets.find((asset) => {
        const assetAddress = normalizeAddress(asset.tokenAddress, asset.chain, asset.chainId);
        return asset.chainId === chainId && assetAddress === tokenAddress;
      });
      if (exact) return exact;
    }

    if (chain && symbol) {
      const fallback = assets.find((asset) => asset.chain === chain && asset.symbol.toUpperCase() === symbol);
      if (fallback) return fallback;
    }

    return null;
  }

  async getRiskProfile(chain: string, tokenAddress: string): Promise<{
    riskScore: number;
    liquidityScore: number;
    depegThresholdBps: number;
    minConfirmations: number;
    maxConfirmationDelaySec: number;
    pegTargetUsd: string;
  } | null> {
    const asset = await this.resolveStableAsset({ chain, tokenAddress });
    if (!asset) return null;
    return {
      riskScore: asset.riskScore,
      liquidityScore: asset.liquidityScore,
      depegThresholdBps: asset.depegThresholdBps,
      minConfirmations: asset.minConfirmations,
      maxConfirmationDelaySec: asset.maxConfirmationDelaySec,
      pegTargetUsd: asset.pegTargetUsd,
    };
  }

  async syncOverlayToDatabase(): Promise<void> {
    this.ensureOverlay();
    try {
      for (const asset of this.localOverlayByKey.values()) {
        const existing = await db
          .select({ id: stableAssetRegistryTable.id })
          .from(stableAssetRegistryTable)
          .where(
            and(
              eq(stableAssetRegistryTable.chainId, asset.chainId),
              eq(stableAssetRegistryTable.tokenAddress, asset.tokenAddress)
            )
          )
          .limit(1);

        const values = {
          chain: asset.chain,
          chainId: asset.chainId,
          tokenAddress: asset.tokenAddress,
          symbol: asset.symbol,
          decimals: asset.decimals,
          riskScore: asset.riskScore,
          liquidityScore: asset.liquidityScore,
          depegThresholdBps: asset.depegThresholdBps,
          minConfirmations: asset.minConfirmations,
          maxConfirmationDelaySec: asset.maxConfirmationDelaySec,
          pegTargetUsd: asset.pegTargetUsd,
          isActive: asset.isActive,
          metadata: asset.metadata ?? {},
        };

        if (existing[0]) {
          await db.update(stableAssetRegistryTable)
            .set(values)
            .where(
              and(
                eq(stableAssetRegistryTable.chainId, asset.chainId),
                eq(stableAssetRegistryTable.tokenAddress, asset.tokenAddress)
              )
            );
        } else {
          await db.insert(stableAssetRegistryTable).values(values);
        }
      }
    } catch (error) {
      logger.warn('[StableAssetRegistryService] Failed syncing overlay registry to DB', {
        error: (error as Error).message,
      });
    }
  }
}

export const stableAssetRegistryService = new StableAssetRegistryService();