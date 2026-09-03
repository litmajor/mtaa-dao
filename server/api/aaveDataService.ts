/**
 * Aave Data Service
 *
 * Source of truth: on-chain reads via AaveProtocolDataProvider, per chain.
 * Pattern: background polling (stale-while-revalidate). A timer refreshes
 * the Redis cache every POLL_INTERVAL_MS; HTTP handlers only ever read
 * the cache, never block on RPC.
 *
 * Multi-Instance Production:
 *FIXED: This service now uses Redis (single shared cache across all
 *   instances) instead of in-memory Map. Each instance still polls independently
 *   on its own schedule, but they all write to and read from the same Redis
 *   backend — no divergence.
 *
 * USD-Denominated TVL:
 * ⚠️  NOT computed here. Aave's data provider returns raw token amounts
 *   (e.g. "4.46B USDC units"), not USD. Getting USD TVL requires the Aave
 *   Oracle contract (getAssetPrice) or an external price feed. Deliberately
 *   left as a TODO rather than faked with a hardcoded price, which is the
 *   exact mistake the previous version of this file made.
 *
 * Contract Addresses:
 * 📋 Pulled from bgd-labs/aave-address-book (the canonical, audited source)
 *   on the date this file was written. Re-verify against that repo if this
 *   sits unmodified for a long time — don't trust addresses copied from
 *   memory or from random blog posts.
 */

import { ethers } from 'ethers';
import { getRedisInstance } from '../config/redisConnectionManager';
import { logger } from '../utils/logger';

// ---------- Config ----------

const POLL_INTERVAL_MS = Number(process.env.AAVE_POLL_INTERVAL_MS || 15_000);
// Data older than this is still served (SWR) but flagged `stale: true`.
const STALE_AFTER_MS = POLL_INTERVAL_MS * 4;

interface ChainConfig {
  chain: string;
  chainId: number;
  rpcUrl: string;
  poolDataProvider: string;
  pool: string;
}

const CHAINS: ChainConfig[] = [
  {
    chain: 'ethereum',
    chainId: 1,
    rpcUrl: process.env.ETHEREUM_RPC_URL || '',
    poolDataProvider: '0x0a16f2FCC0D44FaE41cc54e079281D84A363bECD',
    pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  },
  {
    chain: 'polygon',
    chainId: 137,
    rpcUrl: process.env.POLYGON_RPC_URL || '',
    poolDataProvider: '0x243Aa95cAC2a25651eda86e80bEe66114413c43b',
    pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  },
  {
    chain: 'arbitrum',
    chainId: 42161,
    rpcUrl: process.env.ARBITRUM_RPC_URL || '',
    poolDataProvider: '0x243Aa95cAC2a25651eda86e80bEe66114413c43b',
    pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  },
];

// Minimal ABI fragments — only what we call.
const DATA_PROVIDER_ABI = [
  'function getAllReservesTokens() view returns (tuple(string symbol, address tokenAddress)[])',
  'function getReserveData(address asset) view returns (uint256 unbacked, uint256 accruedToTreasuryScaled, uint256 totalAToken, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)',
  'function getReserveConfigurationData(address asset) view returns (uint256 decimals, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen)',
  'function getFlashLoanEnabled(address asset) view returns (bool)',
];

const POOL_ABI = [
  // Returned in bps of PERCENTAGE_FACTOR (1e4) — e.g. 9 == 0.09%.
  'function FLASHLOAN_PREMIUM_TOTAL() view returns (uint128)',
];

// ---------- Types ----------

export interface MarketSnapshot {
  asset: string;
  tokenAddress: string;
  decimals: number;
  supplyRateApr: number; // percent, simple APR from ray — see note below
  borrowRateApr: number;
  totalSupply: string; // raw token units, as string (avoid float precision loss)
  totalBorrow: string;
  availableLiquidity: string;
  utilizationRate: number; // percent
  isActive: boolean;
  isFrozen: boolean;
  flashLoanEnabled: boolean;
}

interface ChainCache {
  markets: MarketSnapshot[];
  flashLoanPremiumBps: number;
  lastUpdateTime: number; // epoch ms of last SUCCESSFUL poll
  lastError: string | null;
}

// Redis key prefix for cache entries
const CACHE_KEY_PREFIX = 'aave:cache:';
const CACHE_TTL_SECONDS = Math.ceil(POLL_INTERVAL_MS / 1000) * 5; // 5x poll interval

// LS: Local Storage for when Redis is unavailable
const localFallback = new Map<string, ChainCache>();
const providers = new Map<string, ethers.JsonRpcProvider>();

function getCacheKey(chain: string): string {
  return `${CACHE_KEY_PREFIX}${chain}`;
}

async function getCacheEntry(chain: string): Promise<ChainCache | null> {
  try {
    const redis = getRedisInstance();
    const key = getCacheKey(chain);
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as ChainCache;
    }
  } catch (err) {
    logger.warn(`[aaveDataService] Failed to read from Redis for ${chain}:`, { error: String(err) });
    // Fall through to local fallback
  }
  
  // Try local fallback
  return localFallback.get(chain) || null;
}

async function setCacheEntry(chain: string, entry: ChainCache): Promise<void> {
  // Always update local fallback
  localFallback.set(chain, entry);
  
  try {
    const redis = getRedisInstance();
    const key = getCacheKey(chain);
    await redis.set(key, JSON.stringify(entry), { EX: CACHE_TTL_SECONDS });
  } catch (err) {
    logger.warn(`[aaveDataService] Failed to write to Redis for ${chain}:`, { error: String(err) });
    // Local fallback still has the data
  }
}

// ---------- Polling ----------

function rayToPercent(ray: bigint): number {
  // Aave rates are stored in "ray" units (27 decimals) and represent a
  // linear APR, not a compounded APY. Converting to true APY would require
  // compounding by seconds-per-year — deliberately not done here; label
  // the field `*Apr`, not `*Apy`, so consumers aren't misled.
  return Number(ray) / 1e27 * 100;
}

async function pollChain(cfg: ChainConfig): Promise<void> {
  if (!cfg.rpcUrl) {
    const prev = await getCacheEntry(cfg.chain);
    await setCacheEntry(cfg.chain, {
      markets: prev?.markets ?? [],
      flashLoanPremiumBps: prev?.flashLoanPremiumBps ?? 0,
      lastUpdateTime: prev?.lastUpdateTime ?? 0,
      lastError: `No RPC URL configured for ${cfg.chain}`,
    });
    return;
  }

  try {
    let provider = providers.get(cfg.chain);
    if (!provider) {
      provider = new ethers.JsonRpcProvider(cfg.rpcUrl, cfg.chainId);
      providers.set(cfg.chain, provider);
    }

    const dataProvider = new ethers.Contract(cfg.poolDataProvider, DATA_PROVIDER_ABI, provider);
    const pool = new ethers.Contract(cfg.pool, POOL_ABI, provider);

    const [reserves, premium] = await Promise.all([
      dataProvider.getAllReservesTokens(),
      pool.FLASHLOAN_PREMIUM_TOTAL(),
    ]);

    const markets: MarketSnapshot[] = await Promise.all(
      reserves.map(async (r: { symbol: string; tokenAddress: string }) => {
        const [reserveData, configData, flashLoanEnabled] = await Promise.all([
          dataProvider.getReserveData(r.tokenAddress),
          dataProvider.getReserveConfigurationData(r.tokenAddress),
          dataProvider.getFlashLoanEnabled(r.tokenAddress).catch(() => false),
        ]);

        const totalSupply = reserveData.totalAToken as bigint;
        const totalBorrow = (reserveData.totalStableDebt as bigint) + (reserveData.totalVariableDebt as bigint);
        const availableLiquidity = totalSupply - totalBorrow;
        const utilizationRate = totalSupply > 0n
          ? Number((totalBorrow * 10000n) / totalSupply) / 100
          : 0;

        return {
          asset: r.symbol,
          tokenAddress: r.tokenAddress,
          decimals: Number(configData.decimals),
          supplyRateApr: rayToPercent(reserveData.liquidityRate),
          borrowRateApr: rayToPercent(reserveData.variableBorrowRate),
          totalSupply: totalSupply.toString(),
          totalBorrow: totalBorrow.toString(),
          availableLiquidity: availableLiquidity.toString(),
          utilizationRate,
          isActive: configData.isActive,
          isFrozen: configData.isFrozen,
          flashLoanEnabled,
        };
      })
    );

    await setCacheEntry(cfg.chain, {
      markets,
      flashLoanPremiumBps: Number(premium),
      lastUpdateTime: Date.now(),
      lastError: null,
    });
  } catch (err) {
    // SWR: keep serving the last good snapshot, just record the error.
    // Do NOT wipe `markets` — that would turn a transient RPC hiccup into
    // a false "no data" response for every consumer.
    const prev = await getCacheEntry(cfg.chain);
    await setCacheEntry(cfg.chain, {
      markets: prev?.markets ?? [],
      flashLoanPremiumBps: prev?.flashLoanPremiumBps ?? 0,
      lastUpdateTime: prev?.lastUpdateTime ?? 0,
      lastError: err instanceof Error ? err.message : String(err),
    });
    logger.error(`[aaveDataService] poll failed for ${cfg.chain}:`, err);
  }
}

let started = false;

export function startAavePolling(): void {
  if (started) return;
  started = true;
  CHAINS.forEach((cfg, i) => {
    // Stagger initial polls slightly so all three chains don't hit RPC at
    // the exact same instant.
    setTimeout(() => {
      pollChain(cfg);
      setInterval(() => pollChain(cfg), POLL_INTERVAL_MS);
    }, i * 500);
  });
}

// ---------- Read API (used by routes) ----------

export interface CacheHealth {
  ok: boolean;
  stale: boolean;
  ageMs: number | null;
  lastError: string | null;
}

async function health(chain: string): Promise<CacheHealth> {
  const entry = await getCacheEntry(chain);
  if (!entry || entry.lastUpdateTime === 0) {
    return { ok: false, stale: true, ageMs: null, lastError: entry?.lastError ?? 'not yet polled' };
  }
  const ageMs = Date.now() - entry.lastUpdateTime;
  return { ok: true, stale: ageMs > STALE_AFTER_MS, ageMs, lastError: entry.lastError };
}

export function getSupportedChains(): string[] {
  return CHAINS.map((c) => c.chain);
}

export async function getMarkets(chain: string): Promise<{ markets: MarketSnapshot[]; health: CacheHealth }> {
  const entry = await getCacheEntry(chain);
  const cacheHealth = await health(chain);
  return { markets: entry?.markets ?? [], health: cacheHealth };
}

export async function getMarket(chain: string, symbol: string): Promise<{ market: MarketSnapshot | null; health: CacheHealth }> {
  const entry = await getCacheEntry(chain);
  const markets = entry?.markets ?? [];
  const market = markets.find((m) => m.asset.toUpperCase() === symbol.toUpperCase()) ?? null;
  const cacheHealth = await health(chain);
  return { market, health: cacheHealth };
}

export async function getFlashLoanAssets(chain: string): Promise<{ assets: (MarketSnapshot & { feePercentage: number })[]; health: CacheHealth }> {
  const entry = await getCacheEntry(chain);
  const feePercentage = (entry?.flashLoanPremiumBps ?? 0) / 100; // bps -> percent
  const assets = (entry?.markets ?? [])
    .filter((m) => m.flashLoanEnabled)
    .map((m) => ({ ...m, feePercentage }));
  const cacheHealth = await health(chain);
  return { assets, health: cacheHealth };
}

/**
 * Get flash loan premium in basis points for a chain.
 * Used by flashLoanOpportunityService to calculate fees.
 * Returns null if cache not yet warmed.
 */
export async function getFlashLoanPremiumBps(chain: string): Promise<number | null> {
  const entry = await getCacheEntry(chain);
  if (!entry || entry.lastUpdateTime === 0) {
    return null;
  }
  return entry.flashLoanPremiumBps;
}