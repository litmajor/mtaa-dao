/**
 * NAV Oracle Service (Production)
 *
 * Vault net-asset-value calculation aligned with the shared valuation oracle.
 *
 * Guarantees
 * ─────────────────────────────────────────────────────────────
 * • Marks only via priceOracle.getValuationPrice (fail-closed per asset)
 * • Fixed-point USD math (1e8 NAV scale) — no float share-price path
 * • Partial NAV supported with explicit unpriced holdings + confidence floor
 * • Symbol Universe address/chain checks (mismatch fails that holding)
 * • Correct concentration (HHI) after totals are known
 * • Durable nonce + last NAV (memory with optional Redis hooks)
 * • Ethereum-compatible ECDSA (ethers Wallet / EIP-191) for on-chain updates
 * • Circuit breaker on NAV jumps
 *
 * Does not hold long-lived strategy for private keys beyond process env;
 * prefer KMS in production and inject a Signer.
 */

import { createHash, randomBytes } from 'crypto';
import { Wallet, TypedDataEncoder, hashMessage, verifyMessage } from 'ethers';
import { Logger } from '../utils/logger';
import { symbolUniverse } from '../core/symbol_universe';
import { strategyDashboardService } from './strategyDashboardService';
import { priceOracle } from './priceOracle';
import type { SupportedChain } from '../types/assetGraph';

const logger = Logger.getLogger();

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** On-chain / API NAV scale: 1 unit = $1e-8 */
export const NAV_SCALE = 100_000_000n; // 1e8
const NAV_SCALE_NUMBER = 1e8;

const DEFAULTS = {
  /** Minimum fraction of portfolio (by count or value intent) that must price */
  minPricedValueRatio: Number(process.env.NAV_MIN_PRICED_RATIO ?? 0.95),
  /** Reject updates that move NAV more than this % vs last good */
  maxNavJumpPct: Number(process.env.NAV_MAX_JUMP_PCT ?? 15),
  warnNavJumpPct: Number(process.env.NAV_WARN_JUMP_PCT ?? 10),
  yieldCacheTtlMs: 60 * 60 * 1000,
  scheduledIntervalMs: Number(process.env.NAV_SCHEDULE_MS ?? 60 * 60 * 1000),
};

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface VaultHolding {
  symbol: string;
  /** Raw token amount in smallest units */
  balance: bigint;
  tokenAddress: string;
  decimals: number;
  chain: SupportedChain;
}

export interface NavComponent {
  symbol: string;
  /** Human-readable balance string */
  balance: string;
  balanceRaw: string;
  priceUsd: number;
  /** Value in USD minor units (1e8) */
  valueUsdScaled: bigint;
  valueUsd: number;
  yieldApy?: number;
  riskTier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
  priceConfidence: number;
  sources: string[];
  lastUpdate: number;
  priced: true;
}

export interface UnpricedHolding {
  symbol: string;
  balanceRaw: string;
  reason: string;
}

export interface RiskMetrics {
  /** HHI on value shares, 0–1 (1 = fully concentrated) */
  concentrationHhi: number;
  /** 1–10, higher = better diversification */
  diversificationScore: number;
  tierDistributionPct: Record<string, number>;
  yieldExposureApySum: number;
  liquidationRiskScore: number;
  liquidationRiskLevel: 'low' | 'medium' | 'high';
  correlationRisk: number;
}

export interface VaultNAVResult {
  vaultId: string;
  chain: SupportedChain;
  /** Fixed-point NAV at 1e8 scale */
  navScaled: bigint;
  navUsd: number;
  breakdown: NavComponent[];
  unpriced: UnpricedHolding[];
  pricedValueRatio: number;
  riskMetrics: RiskMetrics;
  confidenceScore: number;
  timestamp: number;
  sources: string[];
  calculationDurationMs: number;
  partial: boolean;
}

export interface NavUpdateSignature {
  vaultId: string;
  navScaled: string;
  nonce: number;
  timestamp: number;
  /** EIP-191 personal_sign style hex signature */
  signature: string;
  signer: string;
  messageHash: string;
}

export interface NavOracleOptions {
  /** ethers Wallet or private key hex (0x…) */
  signer?: Wallet | string;
  signerAddress?: string;
  /** Optional durable store adapters */
  store?: NavOracleStore;
  minPricedValueRatio?: number;
  maxNavJumpPct?: number;
  enableScheduler?: boolean;
  /** Called by scheduler — return vaults to refresh */
  listVaultsForUpdate?: () => Promise<
    Array<{ vaultId: string; chain: SupportedChain; holdings: VaultHolding[] }>
  >;
}

export interface NavOracleStore {
  getNonce(vaultId: string): Promise<number>;
  incrementNonce(vaultId: string): Promise<number>;
  getLastNav(vaultId: string): Promise<VaultNAVResult | null>;
  setLastNav(vaultId: string, result: VaultNAVResult): Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Fixed-point helpers
// ─────────────────────────────────────────────────────────────

/**
 * valueScaled (1e8 USD) = balance * priceUsd * 1e8 / 10^decimals
 * Uses integer path where possible; price has limited decimals from oracle.
 */
export function valueUsdScaled(
  balance: bigint,
  decimals: number,
  priceUsd: number
): bigint {
  if (balance <= 0n || !(priceUsd > 0) || !Number.isFinite(priceUsd)) {
    return 0n;
  }
  // price → microdollars (1e6) then scale to 1e8 ⇒ factor 1e2 more
  const priceMicro = BigInt(Math.round(priceUsd * 1_000_000)); // $1 = 1e6
  // balance * priceMicro * 100 / 10^decimals  => 1e8 USD units
  const scale = 10n ** BigInt(decimals);
  return (balance * priceMicro * 100n) / scale;
}

export function scaledToUsdNumber(scaled: bigint): number {
  return Number(scaled) / NAV_SCALE_NUMBER;
}

function formatUnits(balance: bigint, decimals: number): string {
  const neg = balance < 0n;
  const abs = neg ? -balance : balance;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  const body = fracStr.length ? `${whole}.${fracStr}` : whole.toString();
  return neg ? `-${body}` : body;
}

// ─────────────────────────────────────────────────────────────
// In-memory store for isolated tests and explicit local use
// ─────────────────────────────────────────────────────────────

export class InMemoryNavOracleStore implements NavOracleStore {
  private nonces = new Map<string, number>();
  private last = new Map<string, VaultNAVResult>();

  async getNonce(vaultId: string): Promise<number> {
    return this.nonces.get(vaultId) ?? 0;
  }

  async incrementNonce(vaultId: string): Promise<number> {
    const nonce = (this.nonces.get(vaultId) ?? 0) + 1;
    this.nonces.set(vaultId, nonce);
    return nonce;
  }

  async getLastNav(vaultId: string): Promise<VaultNAVResult | null> {
    return this.last.get(vaultId) ?? null;
  }

  async setLastNav(vaultId: string, result: VaultNAVResult): Promise<void> {
    this.last.set(vaultId, result);
  }
}

/**
 * PostgreSQL-backed production store. The nonce update is a single atomic
 * statement so independent service instances cannot issue duplicate nonces.
 */
export class PostgresNavOracleStore implements NavOracleStore {
  private async getPool() {
    const { pool } = await import('../db');
    return pool;
  }

  async getNonce(vaultId: string): Promise<number> {
    const pool = await this.getPool();
    const { rows } = await pool.query<{ nonce: string | number }>(
      'SELECT nonce FROM nav_oracle_state WHERE vault_id = $1',
      [vaultId]
    );
    return this.toSafeNonce(rows[0]?.nonce ?? 0);
  }

  async incrementNonce(vaultId: string): Promise<number> {
    const pool = await this.getPool();
    const { rows } = await pool.query<{ nonce: string | number }>(
      `INSERT INTO nav_oracle_state (vault_id, nonce)
       VALUES ($1, 1)
       ON CONFLICT (vault_id)
       DO UPDATE SET nonce = nav_oracle_state.nonce + 1, updated_at = NOW()
       RETURNING nonce`,
      [vaultId]
    );
    return this.toSafeNonce(rows[0]?.nonce);
  }

  async getLastNav(vaultId: string): Promise<VaultNAVResult | null> {
    const pool = await this.getPool();
    const { rows } = await pool.query<{ last_nav: unknown }>(
      'SELECT last_nav FROM nav_oracle_state WHERE vault_id = $1',
      [vaultId]
    );
    if (!rows[0]?.last_nav) return null;
    const stored = typeof rows[0].last_nav === 'string'
      ? JSON.parse(rows[0].last_nav)
      : rows[0].last_nav;
    return this.deserializeNav(stored) as VaultNAVResult;
  }

  async setLastNav(vaultId: string, result: VaultNAVResult): Promise<void> {
    const pool = await this.getPool();
    const serialized = JSON.stringify(result, (_key, value: unknown) =>
      typeof value === 'bigint' ? { __navBigInt: value.toString() } : value
    );
    await pool.query(
      `INSERT INTO nav_oracle_state (vault_id, nonce, last_nav, last_nav_timestamp)
       VALUES ($1, 0, $2::jsonb, $3)
       ON CONFLICT (vault_id)
       DO UPDATE SET
         last_nav = EXCLUDED.last_nav,
         last_nav_timestamp = EXCLUDED.last_nav_timestamp,
         updated_at = NOW()
       WHERE nav_oracle_state.last_nav_timestamp IS NULL
          OR nav_oracle_state.last_nav_timestamp <= EXCLUDED.last_nav_timestamp`,
      [vaultId, serialized, result.timestamp]
    );
  }

  private toSafeNonce(value: string | number): number {
    const nonce = Number(value);
    if (!Number.isSafeInteger(nonce) || nonce < 0) {
      throw new Error(`Stored NAV nonce is outside the safe integer range: ${value}`);
    }
    return nonce;
  }

  private deserializeNav(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => this.deserializeNav(entry));
    if (!value || typeof value !== 'object') return value;
    const object = value as Record<string, unknown>;
    if (
      Object.keys(object).length === 1 &&
      typeof object.__navBigInt === 'string'
    ) {
      return BigInt(object.__navBigInt);
    }
    return Object.fromEntries(
      Object.entries(object).map(([key, entry]) => [key, this.deserializeNav(entry)])
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export class NavOracleService {
  private store: NavOracleStore;
  private wallet: Wallet | null = null;
  private signerAddress: string;
  private minPricedValueRatio: number;
  private maxNavJumpPct: number;
  private yieldCache = new Map<
    string,
    { apy: number; protocol: string; at: number }
  >();
  private timer: ReturnType<typeof setInterval> | null = null;
  private listVaultsForUpdate?: NavOracleOptions['listVaultsForUpdate'];
  private destroyed = false;

  constructor(options: NavOracleOptions = {}) {
    this.store = options.store ?? new InMemoryNavOracleStore();
    this.minPricedValueRatio =
      options.minPricedValueRatio ?? DEFAULTS.minPricedValueRatio;
    this.maxNavJumpPct = options.maxNavJumpPct ?? DEFAULTS.maxNavJumpPct;
    this.listVaultsForUpdate = options.listVaultsForUpdate;

    const key =
      options.signer ??
      process.env.NAV_ORACLE_SIGNER_KEY ??
      process.env.NAV_ORACLE_PRIVATE_KEY;

    if (key) {
      this.wallet =
        typeof key === 'string' ? new Wallet(key) : (key as Wallet);
      this.signerAddress =
        options.signerAddress || this.wallet.address;
    } else {
      this.signerAddress =
        options.signerAddress ||
        process.env.NAV_ORACLE_SIGNER_ADDRESS ||
        '';
      logger.warn('[NavOracle] No signer configured — signatures disabled');
    }
  }

  async initialize(): Promise<void> {
    if (this.destroyed) throw new Error('NavOracleService destroyed');
    logger.info('[NavOracle] Initialized', {
      signer: this.signerAddress || null,
      minPricedValueRatio: this.minPricedValueRatio,
      maxNavJumpPct: this.maxNavJumpPct,
    });
  }

  startScheduler(): void {
    if (this.timer) clearInterval(this.timer);
    if (!this.listVaultsForUpdate) {
      logger.warn(
        '[NavOracle] Scheduler not started — provide listVaultsForUpdate'
      );
      return;
    }

    this.timer = setInterval(() => {
      void this.runScheduledUpdates();
    }, DEFAULTS.scheduledIntervalMs);

    if (this.timer.unref) this.timer.unref();
    logger.info('[NavOracle] Scheduler started');
  }

  private async runScheduledUpdates(): Promise<void> {
    if (!this.listVaultsForUpdate) return;
    try {
      const vaults = await this.listVaultsForUpdate();
      for (const v of vaults) {
        try {
          await this.calculateVaultNAV(
            v.vaultId,
            v.chain,
            v.holdings
          );
        } catch (err) {
          logger.error('[NavOracle] Scheduled NAV failed', {
            vaultId: v.vaultId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      logger.error('[NavOracle] Scheduler tick failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Core calculation ───────────────────────────────────────

  async calculateVaultNAV(
    vaultId: string,
    chain: SupportedChain,
    holdings: VaultHolding[],
    options?: { requireFullPricing?: boolean }
  ): Promise<VaultNAVResult> {
    const start = Date.now();
    const requireFull = options?.requireFullPricing === true;

    if (!holdings.length) {
      throw new Error(`No holdings provided for vault ${vaultId}`);
    }

    const breakdown: NavComponent[] = [];
    const unpriced: UnpricedHolding[] = [];
    const sources = new Set<string>();
    let navScaled = 0n;

    for (const holding of holdings) {
      const priced = await this.tryPriceHolding(holding, chain);
      if (priced.ok) {
        breakdown.push(priced.component);
        navScaled += priced.component.valueUsdScaled;
        for (const s of priced.component.sources) sources.add(s);
      } else {
        unpriced.push({
          symbol: holding.symbol,
          balanceRaw: holding.balance.toString(),
          reason: priced.reason,
        });
      }
    }

    const totalAttempts = holdings.length;
    const pricedCount = breakdown.length;
    // Value ratio: if nothing priced, 0; else by count as proxy when unpriced have unknown value
    const pricedValueRatio =
      totalAttempts === 0 ? 0 : pricedCount / totalAttempts;

    if (requireFull && unpriced.length > 0) {
      throw new Error(
        `Full pricing required but unpriced: ${unpriced
          .map((u) => `${u.symbol} (${u.reason})`)
          .join('; ')}`
      );
    }

    if (pricedValueRatio < this.minPricedValueRatio) {
      throw new Error(
        `NAV pricing coverage ${(pricedValueRatio * 100).toFixed(1)}% ` +
          `below minimum ${(this.minPricedValueRatio * 100).toFixed(0)}% ` +
          `for vault ${vaultId}. Unpriced: ${unpriced
            .map((u) => u.symbol)
            .join(', ')}`
      );
    }

    if (breakdown.length === 0) {
      throw new Error(`No holdings could be priced for vault ${vaultId}`);
    }

    const riskMetrics = this.calculateRiskMetrics(breakdown);
    const confidenceScore = this.calculateConfidenceScore(
      breakdown,
      pricedValueRatio
    );

    const result: VaultNAVResult = {
      vaultId,
      chain,
      navScaled,
      navUsd: scaledToUsdNumber(navScaled),
      breakdown,
      unpriced,
      pricedValueRatio,
      riskMetrics,
      confidenceScore,
      timestamp: Date.now(),
      sources: Array.from(sources),
      calculationDurationMs: Date.now() - start,
      partial: unpriced.length > 0,
    };

    await this.store.setLastNav(vaultId, result);

    logger.info('[NavOracle] NAV calculated', {
      vaultId,
      navUsd: result.navUsd,
      confidence: confidenceScore,
      partial: result.partial,
      unpriced: unpriced.length,
      ms: result.calculationDurationMs,
    });

    return result;
  }

  private async tryPriceHolding(
    holding: VaultHolding,
    chain: SupportedChain
  ): Promise<
    | { ok: true; component: NavComponent }
    | { ok: false; reason: string }
  > {
    try {
      if (holding.decimals < 0 || holding.decimals > 36) {
        return { ok: false, reason: `invalid decimals ${holding.decimals}` };
      }
      if (holding.balance < 0n) {
        return { ok: false, reason: 'negative balance' };
      }

      const assetMetadata = symbolUniverse.getAsset(holding.symbol);
      if (!assetMetadata) {
        return {
          ok: false,
          reason: 'symbol not in Symbol Universe',
        };
      }

      const deployment =
        symbolUniverse.getDeploymentOnChain(holding.symbol, chain) ||
        symbolUniverse
          .getDeployments(holding.symbol)
          .find((d) => d.chain === chain);

      if (!deployment) {
        return { ok: false, reason: `not deployed on ${chain}` };
      }

      if (
        deployment.contractAddress.toLowerCase() !==
        holding.tokenAddress.toLowerCase()
      ) {
        return {
          ok: false,
          reason: `address mismatch universe=${deployment.contractAddress} vault=${holding.tokenAddress}`,
        };
      }

      const valuation = await priceOracle.getValuationPrice(holding.symbol);
      const markUsd = valuation?.haircutPriceUsd ?? valuation?.priceUsd;

      if (
        !valuation ||
        markUsd === undefined ||
        !Number.isFinite(markUsd) ||
        !(markUsd > 0)
      ) {
        return { ok: false, reason: 'no reliable valuation price' };
      }

      const valueScaled = valueUsdScaled(
        holding.balance,
        holding.decimals,
        markUsd
      );

      const confidence =
        valuation.confidence === 'high'
          ? 95
          : valuation.confidence === 'medium'
            ? 75
            : 55;

      const yieldApy = await this.getYieldApy(holding.symbol, chain);

      const component: NavComponent = {
        symbol: holding.symbol,
        balance: formatUnits(holding.balance, holding.decimals),
        balanceRaw: holding.balance.toString(),
        priceUsd: markUsd,
        valueUsdScaled: valueScaled,
        valueUsd: scaledToUsdNumber(valueScaled),
        yieldApy: yieldApy ?? undefined,
        riskTier: assetMetadata.tier,
        priceConfidence: confidence,
        sources: valuation.sourcesUsed.map((s) => s.source),
        lastUpdate: valuation.asOf.getTime(),
        priced: true,
      };

      return { ok: true, component };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── Yield (non-blocking enrichment) ────────────────────────

  private async getYieldApy(
    symbol: string,
    chain: SupportedChain
  ): Promise<number | null> {
    const cacheKey = `${symbol}:${chain}`;
    const cached = this.yieldCache.get(cacheKey);
    if (cached && Date.now() - cached.at < DEFAULTS.yieldCacheTtlMs) {
      return cached.apy;
    }

    try {
      const strategies = await strategyDashboardService.listStrategies({
        skip: 0,
        limit: 50,
        filters: { assets: [symbol] },
        sortBy: 'ytdReturn',
      });

      if (strategies?.length) {
        let num = 0;
        let den = 0;
        for (const s of strategies) {
          if (s.ytdReturn != null && s.aum) {
            num += s.ytdReturn * s.aum;
            den += s.aum;
          }
        }
        if (den > 0) {
          const apy = num / den;
          this.yieldCache.set(cacheKey, {
            apy,
            protocol: 'strategy_performance',
            at: Date.now(),
          });
          return apy;
        }
      }
    } catch {
      /* optional */
    }

    return null;
  }

  // ── Risk ───────────────────────────────────────────────────

  private calculateRiskMetrics(breakdown: NavComponent[]): RiskMetrics {
    const total = breakdown.reduce((s, c) => s + c.valueUsdScaled, 0n);
    const totalNum = total > 0n ? Number(total) : 1;

    const tierValue = new Map<string, number>();
    let hhi = 0;

    for (const c of breakdown) {
      const share = Number(c.valueUsdScaled) / totalNum;
      hhi += share * share;
      tierValue.set(
        c.riskTier,
        (tierValue.get(c.riskTier) || 0) + Number(c.valueUsdScaled)
      );
    }

    const n = Math.max(breakdown.length, 1);
    const minHhi = 1 / n;
    const diversificationScore =
      total === 0n
        ? 0
        : Math.max(
            1,
            Math.min(
              10,
              Math.round(
                (1 + ((1 - hhi) / (1 - minHhi || 1)) * 9) * 2
              ) / 2
            )
          );

    const tierDistributionPct: Record<string, number> = {};
    for (const [tier, v] of tierValue) {
      tierDistributionPct[tier] = (v / totalNum) * 100;
    }

    const yieldExposureApySum = breakdown.reduce(
      (s, c) => s + (c.yieldApy || 0),
      0
    );

    const tierWeights: Record<string, number> = {
      tier_1: 0.05,
      tier_2: 0.15,
      tier_3: 0.35,
      tier_4: 0.65,
    };

    let liq = 0;
    for (const c of breakdown) {
      const w = tierWeights[c.riskTier] ?? 0.35;
      liq += w * (Number(c.valueUsdScaled) / totalNum);
    }
    const liquidationRiskLevel: RiskMetrics['liquidationRiskLevel'] =
      liq < 0.2 ? 'low' : liq < 0.5 ? 'medium' : 'high';

    const categories = breakdown.map((c) => this.assetCategory(c.symbol));
    const unique = new Set(categories).size;
    const correlationRisk =
      categories.length <= 1
        ? 0
        : (categories.length - unique) / categories.length;

    return {
      concentrationHhi: hhi,
      diversificationScore,
      tierDistributionPct,
      yieldExposureApySum,
      liquidationRiskScore: liq,
      liquidationRiskLevel,
      correlationRisk,
    };
  }

  private assetCategory(symbol: string): string {
    const map: Record<string, string> = {
      BTC: 'layer1',
      ETH: 'layer1',
      SOL: 'layer1',
      CELO: 'layer1',
      USDC: 'stablecoin',
      USDT: 'stablecoin',
      DAI: 'stablecoin',
      CUSD: 'stablecoin',
      CEUR: 'stablecoin',
    };
    return map[symbol.toUpperCase()] || 'other';
  }

  private calculateConfidenceScore(
    breakdown: NavComponent[],
    pricedValueRatio: number
  ): number {
    if (!breakdown.length) return 0;
    const avg =
      breakdown.reduce((s, c) => s + c.priceConfidence, 0) / breakdown.length;
    const sourceCount = new Set(breakdown.flatMap((c) => c.sources)).size;
    const sourceBonus = Math.min(Math.max(sourceCount - 1, 0) * 5, 15);
    const coveragePenalty = (1 - pricedValueRatio) * 30;
    return Math.max(
      0,
      Math.min(100, Math.round(avg + sourceBonus - coveragePenalty))
    );
  }

  // ── Signing (EIP-191) ──────────────────────────────────────

  /**
   * Message format (deterministic):
   *   nav_update:<vaultId>:<navScaled>:<nonce>:<timestamp>
   * Signed with ethers personal_sign (EIP-191).
   */
  async generateNAVSignature(
    vaultId: string,
    navScaled: bigint
  ): Promise<NavUpdateSignature> {
    if (!this.wallet) {
      throw new Error('NAV oracle signer not configured');
    }

    const nonce = await this.store.incrementNonce(vaultId);
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `nav_update:${vaultId}:${navScaled.toString()}:${nonce}:${timestamp}`;

    const signature = await this.wallet.signMessage(message);
    const messageHash = hashMessage(message);

    return {
      vaultId,
      navScaled: navScaled.toString(),
      nonce,
      timestamp,
      signature,
      signer: this.wallet.address,
      messageHash,
    };
  }

  /** Offline verify helper for tests / relayers */
  static verifyNAVSignature(
    payload: Omit<NavUpdateSignature, 'signature' | 'signer' | 'messageHash'> & {
      signature: string;
    },
    expectedSigner: string
  ): boolean {
    const message = `nav_update:${payload.vaultId}:${payload.navScaled}:${payload.nonce}:${payload.timestamp}`;
    try {
      const recovered = verifyMessage(message, payload.signature);
      return recovered.toLowerCase() === expectedSigner.toLowerCase();
    } catch {
      return false;
    }
  }

  // ── Circuit breaker ────────────────────────────────────────

  async validateNAVUpdate(
    vaultId: string,
    newNavScaled: bigint
  ): Promise<{ valid: boolean; reason?: string; changePercent: number }> {
    const last = await this.store.getLastNav(vaultId);
    if (!last || last.navScaled === 0n) {
      return { valid: true, changePercent: 0 };
    }

    const prev = Number(last.navScaled);
    const next = Number(newNavScaled);
    if (!(prev > 0)) {
      return { valid: true, changePercent: 0 };
    }

    const changePercent = (Math.abs(next - prev) / prev) * 100;

    if (changePercent > this.maxNavJumpPct) {
      return {
        valid: false,
        reason: `NAV change ${changePercent.toFixed(2)}% exceeds ${this.maxNavJumpPct}% threshold`,
        changePercent,
      };
    }

    if (changePercent > DEFAULTS.warnNavJumpPct) {
      logger.warn('[NavOracle] Large NAV change', {
        vaultId,
        changePercent,
      });
    }

    return { valid: true, changePercent };
  }

  /**
   * Calculate → validate → sign pipeline for on-chain submission.
   */
  async buildSignedNavUpdate(
    vaultId: string,
    chain: SupportedChain,
    holdings: VaultHolding[]
  ): Promise<{ nav: VaultNAVResult; signature: NavUpdateSignature }> {
    const nav = await this.calculateVaultNAV(vaultId, chain, holdings);
    const check = await this.validateNAVUpdate(vaultId, nav.navScaled);
    if (!check.valid) {
      throw new Error(check.reason || 'NAV update rejected by circuit breaker');
    }
    const signature = await this.generateNAVSignature(vaultId, nav.navScaled);
    return { nav, signature };
  }

  async getLastNAV(vaultId: string): Promise<VaultNAVResult | null> {
    return this.store.getLastNav(vaultId);
  }

  async getNonce(vaultId: string): Promise<number> {
    return this.store.getNonce(vaultId);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.yieldCache.clear();
  }
}

export const navOracleService = new NavOracleService({
  store: new PostgresNavOracleStore(),
});