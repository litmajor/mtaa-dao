/**
 * Exchange Fee Service (Production)
 *
 * Maker/taker schedules per CEX, volume tiers, stablecoin discounts.
 * Used by SmartRouter for all-in route cost. Global fallback schedules are
 * supplemented by effective-dated per-user rates from authenticated APIs.
 *
 * Changes from previous version
 * ─────────────────────────────────────────────────────────────
 * • Pair parsing: handles both "BTC/USDT" and concatenated "BTCUSDT"
 *   formats via stable-quote suffix matching (longest symbol first).
 * • Stablecoin discount now requires BOTH legs to be stable (was either
 *   leg — that misapplied Binance's 0.01% stable-stable rate to every
 *   USDT pair in the book). Flagged as a behavioral change for the router.
 * • Side-aware costing: buy legs add fee, sell legs subtract fee.
 * • Unknown exchanges return null — no silent 0.2% default; routers must
 *   decide how to treat unrated exchanges.
 * • Schedule staleness tracked; getStaleSchedules() for health checks.
 * • Withdrawal fees modeled as fixed asset amounts per exchange.
 * • userVolumes is replace-all hydrated state (boot/interval), not
 *   incremental per-process drift.
 * • Optional native-token discounts (BNB, KCS, OKB) per schedule.
 */

// ─────────────────────────── Types ───────────────────────────

export type TradeSide = 'buy' | 'sell';

export interface FeeStructure {
  /** Fraction, e.g. 0.001 = 0.1% */
  maker: number;
  taker: number;
}

export interface WithdrawalFee {
  /** Asset the fee is charged in, e.g. 'BTC' */
  asset: string;
  /** Fixed amount, not a fraction */
  amount: number;
}

export interface VolumeTier {
  /** USD 30-day volume threshold (inclusive) */
  volumeThreshold: number;
  maker: number;
  taker: number;
}

export interface ExchangeFeeInfo {
  exchange: string;
  baseStructure: FeeStructure;
  /** Need not be pre-sorted; service sorts by threshold ascending */
  volumeTiers: VolumeTier[];
  /** Applied only when BOTH legs of the pair are stablecoins */
  stablecoinPairs: FeeStructure;
  /** Fixed withdrawal fee; quote cost = amount × valuation price(asset) */
  withdrawal?: WithdrawalFee;
  /** Users paying fees in this token get maker/taker × multiplier */
  nativeTokenDiscount?: { token: string; multiplier: number };
  /** ISO date of schedule snapshot. Required — used for staleness. */
  asOf: string;
  source?: string;
  pairFees?: Record<string, FeeStructure>;
}

export type FeeScheduleSource = 'manual' | 'api-sync' | 'bootstrap';

export interface FeeScheduleVersion {
  exchange: string;
  userId?: string | null;
  lastCheckedAt?: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  source: FeeScheduleSource;
  reason: string | null;
  changedBy: string | null;
  schedule: ExchangeFeeInfo;
}

export interface FeeScheduleChange {
  exchange: string;
  effectiveFrom: string;
  source: FeeScheduleSource;
  reason: string | null;
  changes: Record<string, { previous: unknown; next: unknown }>;
}

export interface EffectiveFees {
  exchange: string;
  /** Tier-adjusted rates before any native-token discount */
  maker: number;
  taker: number;
  /** The actually applied rate: maker or taker, incl. discount if requested */
  feeRate: number;
  isMaker: boolean;
  isStablecoinPair: boolean;
  tierVolumeThreshold: number;
  scheduleAsOf: string;
  /** true when asOf exceeds the staleness window — routes should log/penalize */
  scheduleStale: boolean;
}

export interface FeeComparisonRow {
  exchange: string;
  maker: number;
  taker: number;
  applied: number;
  scheduleStale: boolean;
}

// ─────────────────────────── Data ───────────────────────────

/**
 * Longest-first ordering matters for suffix matching:
 * 'USDT' must be tried before 'USD' so 'XAUT' isn't mis-split at 'USD'.
 */
const STABLE_QUOTES = [
  'FDUSD', 'BUSD', 'USDT', 'USDC', 'TUSD', 'USDP', 'CUSD', 'CEUR',
  'USD', 'EUR',
].sort((a, b) => b.length - a.length);

const STABLECOIN_SET = new Set(STABLE_QUOTES);

const STALENESS_WARNING_DAYS = 90;

/**
 * Snapshot schedules (spot-style public tiers). Verify before relying on VIP edges.
 * Withdrawal fees are floor estimates in the fee asset — refresh periodically.
 */
const BUILTIN_EXCHANGE_FEES: Record<string, ExchangeFeeInfo> = {
  binance: {
    exchange: 'binance',
    asOf: '2026-01-01',
    source: 'public-spot-approx',
    baseStructure: { maker: 0.001, taker: 0.001 },
    volumeTiers: [
      { volumeThreshold: 0, maker: 0.001, taker: 0.001 },
      { volumeThreshold: 50_000, maker: 0.0009, taker: 0.001 },
      { volumeThreshold: 500_000, maker: 0.0008, taker: 0.001 },
      { volumeThreshold: 5_000_000, maker: 0.0007, taker: 0.00098 },
      { volumeThreshold: 50_000_000, maker: 0.0006, taker: 0.00095 },
    ],
    stablecoinPairs: { maker: 0.0001, taker: 0.0001 },
    withdrawal: { asset: 'BTC', amount: 0.0002 },
    nativeTokenDiscount: { token: 'BNB', multiplier: 0.75 },
  },
  kraken: {
    exchange: 'kraken',
    asOf: '2026-01-01',
    source: 'public-spot-approx',
    baseStructure: { maker: 0.0016, taker: 0.0026 },
    volumeTiers: [
      { volumeThreshold: 0, maker: 0.0016, taker: 0.0026 },
      { volumeThreshold: 50_000, maker: 0.0014, taker: 0.0024 },
      { volumeThreshold: 250_000, maker: 0.0012, taker: 0.0022 },
      { volumeThreshold: 1_000_000, maker: 0.001, taker: 0.002 },
      { volumeThreshold: 5_000_000, maker: 0.0008, taker: 0.0018 },
    ],
    stablecoinPairs: { maker: 0.0002, taker: 0.0004 },
    withdrawal: { asset: 'BTC', amount: 0.0001 },
  },
  coinbase: {
    exchange: 'coinbase',
    asOf: '2026-01-01',
    source: 'public-spot-approx',
    baseStructure: { maker: 0.004, taker: 0.006 },
    volumeTiers: [
      { volumeThreshold: 0, maker: 0.004, taker: 0.006 },
      { volumeThreshold: 100_000, maker: 0.003, taker: 0.005 },
      { volumeThreshold: 1_000_000, maker: 0.0025, taker: 0.0045 },
      { volumeThreshold: 10_000_000, maker: 0.002, taker: 0.003 },
    ],
    stablecoinPairs: { maker: 0.0005, taker: 0.001 },
    withdrawal: { asset: 'USD', amount: 0 },
  },
  bybit: {
    exchange: 'bybit',
    asOf: '2026-01-01',
    source: 'public-spot-approx',
    baseStructure: { maker: 0.0001, taker: 0.0006 },
    volumeTiers: [
      { volumeThreshold: 0, maker: 0.0001, taker: 0.0006 },
      { volumeThreshold: 1_000_000, maker: 0.00008, taker: 0.00055 },
      { volumeThreshold: 10_000_000, maker: 0.00006, taker: 0.0005 },
    ],
    stablecoinPairs: { maker: 0.0001, taker: 0.0001 },
    withdrawal: { asset: 'BTC', amount: 0.0002 },
  },
  kucoin: {
    exchange: 'kucoin',
    asOf: '2026-01-01',
    source: 'public-spot-approx',
    baseStructure: { maker: 0.001, taker: 0.001 },
    volumeTiers: [
      { volumeThreshold: 0, maker: 0.001, taker: 0.001 },
      { volumeThreshold: 100_000, maker: 0.0008, taker: 0.001 },
      { volumeThreshold: 1_000_000, maker: 0.0006, taker: 0.0009 },
      { volumeThreshold: 10_000_000, maker: 0.0004, taker: 0.0008 },
    ],
    stablecoinPairs: { maker: 0.0001, taker: 0.0002 },
    withdrawal: { asset: 'BTC', amount: 0.0005 },
    nativeTokenDiscount: { token: 'KCS', multiplier: 0.8 },
  },
  okx: {
    exchange: 'okx',
    asOf: '2026-01-01',
    source: 'public-spot-approx',
    baseStructure: { maker: 0.0008, taker: 0.001 },
    volumeTiers: [
      { volumeThreshold: 0, maker: 0.0008, taker: 0.001 },
      { volumeThreshold: 500_000, maker: 0.0006, taker: 0.0008 },
      { volumeThreshold: 5_000_000, maker: 0.0004, taker: 0.0006 },
      { volumeThreshold: 50_000_000, maker: 0.0002, taker: 0.0005 },
    ],
    stablecoinPairs: { maker: 0.0001, taker: 0.0002 },
    withdrawal: { asset: 'BTC', amount: 0.0004 },
    nativeTokenDiscount: { token: 'OKB', multiplier: 0.8 },
  },
  gateio: {
    exchange: 'gateio',
    asOf: '2026-01-01',
    source: 'public-spot-approx',
    baseStructure: { maker: 0.0015, taker: 0.0015 },
    volumeTiers: [
      { volumeThreshold: 0, maker: 0.0015, taker: 0.0015 },
      { volumeThreshold: 100_000, maker: 0.0012, taker: 0.0013 },
      { volumeThreshold: 1_000_000, maker: 0.001, taker: 0.0011 },
    ],
    stablecoinPairs: { maker: 0.0002, taker: 0.0002 },
    withdrawal: { asset: 'BTC', amount: 0.0004 },
  },
};

// ─────────────────────────── Validation ───────────────────────────

function assertFeeFraction(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 0.05) {
    // >5% is almost certainly a data error for spot maker/taker
    throw new Error(`Invalid fee fraction for ${name}: ${value}`);
  }
}

function normalizeFeeInfo(info: ExchangeFeeInfo): ExchangeFeeInfo {
  if (!info.asOf || Number.isNaN(Date.parse(info.asOf))) {
    throw new Error(`Exchange ${info.exchange}: schedule requires a valid ISO 'asOf' date`);
  }
  assertFeeFraction(`${info.exchange}.base.maker`, info.baseStructure.maker);
  assertFeeFraction(`${info.exchange}.base.taker`, info.baseStructure.taker);
  assertFeeFraction(`${info.exchange}.stable.maker`, info.stablecoinPairs.maker);
  assertFeeFraction(`${info.exchange}.stable.taker`, info.stablecoinPairs.taker);

  if (info.nativeTokenDiscount) {
    const m = info.nativeTokenDiscount.multiplier;
    if (!Number.isFinite(m) || m <= 0 || m > 1) {
      throw new Error(
        `Exchange ${info.exchange}: nativeTokenDiscount multiplier must be in (0, 1], got ${m}`
      );
    }
  }
  if (info.withdrawal && (!Number.isFinite(info.withdrawal.amount) || info.withdrawal.amount < 0)) {
    throw new Error(`Exchange ${info.exchange}: invalid withdrawal fee amount`);
  }

  const volumeTiers = [...info.volumeTiers].sort(
    (a, b) => a.volumeThreshold - b.volumeThreshold
  );
  for (const t of volumeTiers) {
    assertFeeFraction(`${info.exchange}.tier.maker`, t.maker);
    assertFeeFraction(`${info.exchange}.tier.taker`, t.taker);
  }

  const pairFees = info.pairFees
    ? Object.fromEntries(Object.entries(info.pairFees).map(([symbol, fee]) => {
        const pair = parseTradingPair(symbol);
        if (!pair) throw new Error(`Exchange ${info.exchange}: invalid pair fee symbol ${symbol}`);
        assertFeeFraction(`${info.exchange}.${symbol}.maker`, fee.maker);
        assertFeeFraction(`${info.exchange}.${symbol}.taker`, fee.taker);
        return [`${pair.base}/${pair.quote}`, { maker: fee.maker, taker: fee.taker }];
      }))
    : undefined;

  return { ...info, exchange: info.exchange.toLowerCase(), volumeTiers, pairFees };
}

// ─────────────────────────── Pair parsing ───────────────────────────

export interface ParsedPair {
  base: string;
  quote: string;
}

const QUOTE_SUFFIX = /([A-Z0-9]{2,8})(BTC|ETH|BNB|SOL|XRP|DOGE|FDUSD|BUSD|USDT|USDC|TUSD|USDP|CUSD|CEUR|USD|EUR)$/;

/**
 * Parses "BTC/USDT", "BTC_USDT", "BTC-USDT", and concatenated "BTCUSDT".
 * Stable quotes are matched longest-first so 'XAUT' never splits at 'USD'.
 * Returns null when the pair cannot be resolved into two distinct symbols —
 * callers must handle null (don't guess).
 */
export function parseTradingPair(tradingPair: string): ParsedPair | null {
  if (!tradingPair || typeof tradingPair !== 'string') return null;
  const raw = tradingPair.trim().toUpperCase();
  if (!raw) return null;

  const separated = raw.split(/[/_:.\s-]/).filter(Boolean);
  if (separated.length === 2 && separated.every((p) => /^[A-Z0-9]+$/.test(p))) {
    return { base: separated[0], quote: separated[1] };
  }
  if (separated.length !== 1) return null; // ambiguous — don't guess

  const m = raw.match(QUOTE_SUFFIX);
  if (m && m[1].length >= 2) {
    return { base: m[1], quote: m[2] };
  }
  return null;
}

function isStableSymbol(symbol: string): boolean {
  return STABLECOIN_SET.has(symbol.toUpperCase());
}

// ─────────────────────────── Service ───────────────────────────

export class ExchangeFeeService {
  private static instance: ExchangeFeeService;

  private schedules = new Map<string, ExchangeFeeInfo>();
  private scheduleVersions = new Map<string, FeeScheduleVersion[]>();
  private userScheduleVersions = new Map<string, FeeScheduleVersion[]>();
  /**
   * 30-day USD volumes keyed by userId. REPLACE-ALL state: hydrate at boot
   * and on a ledger-sync interval. Never mutate incrementally — incremental
   * drift across restarts/replicas silently misprices tiers.
   */
  private userVolumes = new Map<string, number>();
  private maxScheduleAgeMs = STALENESS_WARNING_DAYS * 24 * 60 * 60 * 1000;

  private constructor() {
    for (const info of Object.values(BUILTIN_EXCHANGE_FEES)) {
      this.setFeeSchedule(info, {
        source: 'bootstrap',
        effectiveFrom: info.asOf,
        reason: 'Built-in fallback schedule',
      });
    }
  }

  static getInstance(): ExchangeFeeService {
    if (!ExchangeFeeService.instance) {
      ExchangeFeeService.instance = new ExchangeFeeService();
    }
    return ExchangeFeeService.instance;
  }

  // ── Schedule management ──

  setFeeSchedule(
    info: ExchangeFeeInfo,
    metadata: {
      source?: FeeScheduleSource;
      effectiveFrom?: string;
      reason?: string | null;
      changedBy?: string | null;
      userId?: string | null;
    } = {}
  ): FeeScheduleVersion {
    const normalized = normalizeFeeInfo(info);
    const userId = metadata.userId ?? null;
    const effectiveFrom = metadata.effectiveFrom ?? new Date().toISOString();
    if (Number.isNaN(Date.parse(effectiveFrom))) {
      throw new Error(`Exchange ${normalized.exchange}: invalid effectiveFrom date`);
    }

    const versionMap = userId ? this.userScheduleVersions : this.scheduleVersions;
    const versionKey = userId
      ? this.getUserScheduleKey(userId, normalized.exchange)
      : normalized.exchange;
    const versions = versionMap.get(versionKey) ?? [];
    const current = versions.find((version) => version.effectiveTo === null);
    if (current) {
      if (Date.parse(effectiveFrom) <= Date.parse(current.effectiveFrom)) {
        throw new Error(`Exchange ${normalized.exchange}: new schedule must start after the current version`);
      }
      current.effectiveTo = effectiveFrom;
    }

    const version: FeeScheduleVersion = {
      exchange: normalized.exchange,
      userId,
      effectiveFrom,
      effectiveTo: null,
      source: metadata.source ?? 'manual',
      reason: metadata.reason ?? null,
      changedBy: metadata.changedBy ?? null,
      schedule: normalized,
    };
    versions.push(version);
    versions.sort((a, b) => Date.parse(a.effectiveFrom) - Date.parse(b.effectiveFrom));
    versionMap.set(versionKey, versions);
    if (!userId) this.schedules.set(normalized.exchange, normalized);
    return version;
  }

  /** Bulk load from config JSON. Replaces matching schedules outright. */
  loadSchedules(infos: ExchangeFeeInfo[]): void {
    for (const info of infos) {
      this.setFeeSchedule(info, {
        source: 'bootstrap',
        effectiveFrom: info.asOf,
        reason: 'Built-in fallback schedule',
      });
    }
  }

  /** Replace in-memory schedule state with persisted effective-dated history. */
  loadScheduleVersions(versions: FeeScheduleVersion[]): void {
    const history = new Map<string, FeeScheduleVersion[]>();
    const userHistory = new Map<string, FeeScheduleVersion[]>();
    for (const item of versions) {
      const schedule = normalizeFeeInfo(item.schedule);
      if (schedule.exchange !== item.exchange.toLowerCase()) {
        throw new Error(`Fee schedule exchange mismatch: ${item.exchange} != ${schedule.exchange}`);
      }
      if (Number.isNaN(Date.parse(item.effectiveFrom)) ||
          (item.effectiveTo !== null && Number.isNaN(Date.parse(item.effectiveTo)))) {
        throw new Error(`Exchange ${item.exchange}: invalid effective schedule dates`);
      }
      const targetHistory = item.userId ? userHistory : history;
      const historyKey = item.userId
        ? this.getUserScheduleKey(item.userId, schedule.exchange)
        : schedule.exchange;
      const exchangeVersions = targetHistory.get(historyKey) ?? [];
      exchangeVersions.push({ ...item, exchange: schedule.exchange, schedule });
      targetHistory.set(historyKey, exchangeVersions);
    }

    const schedules = new Map<string, ExchangeFeeInfo>();
    for (const [exchange, exchangeVersions] of history) {
      exchangeVersions.sort((a, b) => Date.parse(a.effectiveFrom) - Date.parse(b.effectiveFrom));
      const currentVersions = exchangeVersions.filter((version) => version.effectiveTo === null);
      if (currentVersions.length !== 1) {
        throw new Error(`Exchange ${exchange}: expected one current fee schedule, found ${currentVersions.length}`);
      }
      schedules.set(exchange, currentVersions[0].schedule);
    }
    this.scheduleVersions = history;
    this.userScheduleVersions = userHistory;
    this.schedules = schedules;
  }

  getScheduleHistory(exchange?: string): FeeScheduleVersion[] {
    const allVersions = [
      ...this.scheduleVersions.values(),
      ...this.userScheduleVersions.values(),
    ].flat();
    return exchange
      ? allVersions.filter((version) => version.exchange === exchange.toLowerCase())
      : allVersions;
  }

  getRecentScheduleChanges(limit = 20, includeUserScoped = false): FeeScheduleChange[] {
    return this.getScheduleHistory()
      .filter((version) =>
        version.source !== 'bootstrap' && (includeUserScoped || !version.userId)
      )
      .map((version) => {
        const versions = this.getVersionsForScope(version.exchange, version.userId);
        const index = versions.indexOf(version);
        const previous = versions[index - 1]?.schedule;
        const changes: FeeScheduleChange['changes'] = {};
        if (previous) {
          for (const field of ['baseStructure', 'volumeTiers', 'stablecoinPairs', 'withdrawal', 'nativeTokenDiscount', 'pairFees'] as const) {
            if (JSON.stringify(previous[field] ?? null) !== JSON.stringify(version.schedule[field] ?? null)) {
              changes[field] = {
                previous: previous[field] ?? null,
                next: version.schedule[field] ?? null,
              };
            }
          }
        } else {
          changes.baseStructure = { previous: null, next: version.schedule.baseStructure };
          changes.volumeTiers = { previous: null, next: version.schedule.volumeTiers };
          changes.stablecoinPairs = { previous: null, next: version.schedule.stablecoinPairs };
          if (version.schedule.pairFees) {
            changes.pairFees = { previous: null, next: version.schedule.pairFees };
          }
        }
        return {
          exchange: version.exchange,
          effectiveFrom: version.effectiveFrom,
          source: version.source,
          reason: version.reason,
          changes,
        };
      })
      .sort((a, b) => Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom))
      .slice(0, Math.max(0, limit));
  }

  setStalenessWarningDays(days: number): void {
    if (!Number.isFinite(days) || days <= 0) {
      throw new Error(`Invalid staleness window: ${days}`);
    }
    this.maxScheduleAgeMs = days * 24 * 60 * 60 * 1000;
  }

  isScheduleStale(exchange: string, now: Date = new Date(), userId?: string): boolean {
    const version = this.getCurrentScheduleVersion(exchange, userId);
    if (!version) return true; // unknown schedule is maximally stale
    return now.getTime() - Date.parse(version.effectiveFrom) > this.maxScheduleAgeMs;
  }

  getCurrentScheduleVersion(exchange: string, userId?: string): FeeScheduleVersion | null {
    if (userId) {
      const scoped = this.userScheduleVersions.get(this.getUserScheduleKey(userId, exchange)) ?? [];
      const current = scoped.find((version) => version.effectiveTo === null);
      if (current) return current;
    }
    return (this.scheduleVersions.get(exchange.toLowerCase()) ?? [])
      .find((version) => version.effectiveTo === null) ?? null;
  }

  /** Wire into a health check / metrics exporter. */
  getStaleSchedules(now: Date = new Date()): string[] {
    return this.getSupportedExchanges().filter((ex) => this.isScheduleStale(ex, now));
  }

  // ── Core resolution ──

  /**
   * Resolves effective fees for a trade. Returns null for unknown exchanges —
   * the router must decide whether to exclude, penalize, or reject; there is
   * intentionally no silent default rate anymore.
   */
  resolveFees(
    exchange: string,
    tradingPair: string,
    side: TradeSide,
    options: {
      isMaker?: boolean;
      userVolume30Day?: number;
      /** Set when the user pays fees in the exchange's native token */
      useNativeTokenDiscount?: boolean;
      effectiveAt?: Date;
      userId?: string;
    } = {}
  ): EffectiveFees | null {
    const globalVersions = this.scheduleVersions.get(exchange.toLowerCase()) ?? [];
    const userVersions = options.userId
      ? this.userScheduleVersions.get(this.getUserScheduleKey(options.userId, exchange)) ?? []
      : [];
    const selectedVersion = options.effectiveAt
      ? userVersions.find((version) => this.versionCovers(version, options.effectiveAt!)) ??
        globalVersions.find((version) => this.versionCovers(version, options.effectiveAt!))
      : userVersions.find((version) => version.effectiveTo === null) ??
        globalVersions.find((version) => version.effectiveTo === null);
    if (!selectedVersion) return null;
    const info = selectedVersion.schedule;

    const pair = parseTradingPair(tradingPair);
    // Discount requires BOTH legs stable — a stable quote alone (BTC/USDT)
    // does not qualify. This is the behavioral change vs. the old version.
    const stablePair =
      pair !== null && isStableSymbol(pair.base) && isStableSymbol(pair.quote);

    const volume = Number.isFinite(options.userVolume30Day)
      ? Math.max(0, (options.userVolume30Day as number))
      : 0;

    let maker: number;
    let taker: number;
    let appliedThreshold = 0;

    const pairFees = pair
      ? info.pairFees?.[`${pair.base}/${pair.quote}`]
      : undefined;
    if (pairFees) {
      maker = pairFees.maker;
      taker = pairFees.taker;
    } else if (stablePair) {
      maker = info.stablecoinPairs.maker;
      taker = info.stablecoinPairs.taker;
    } else {
      // Highest tier whose threshold <= volume; base structure as floor
      let applied = info.baseStructure;
      for (const tier of info.volumeTiers) {
        if (volume >= tier.volumeThreshold) {
          applied = { maker: tier.maker, taker: tier.taker };
          appliedThreshold = tier.volumeThreshold;
        } else {
          break; // tiers sorted ascending
        }
      }
      maker = applied.maker;
      taker = applied.taker;
    }

    const isMaker = options.isMaker ?? false;
    let feeRate = isMaker ? maker : taker;

    if (
      options.useNativeTokenDiscount &&
      info.nativeTokenDiscount &&
      !stablePair // discounts don't stack on stable-stable pairs
    ) {
      feeRate *= info.nativeTokenDiscount.multiplier;
    }

    return {
      exchange: info.exchange,
      maker,
      taker,
      feeRate,
      isMaker,
      isStablecoinPair: stablePair,
      tierVolumeThreshold: appliedThreshold,
      scheduleAsOf: selectedVersion.effectiveFrom,
      scheduleStale: Date.now() - Date.parse(selectedVersion.effectiveFrom) > this.maxScheduleAgeMs,
    };
  }

  // ── Costing ──

  /**
   * Side-aware trade cost.
   * Buy:  total = amount + fee   (fee is extra quote spent)
   * Sell: total = amount − fee   (fee is deducted from proceeds)
   *
   * @param amount Notional in the asset the fee is charged in — keep this
   *   consistent across legs in the router (quote-asset notional recommended).
   */
  calculateTotalCost(
    amount: number,
    exchange: string,
    tradingPair: string,
    side: TradeSide,
    options: {
      isMaker?: boolean;
      userVolume30Day?: number;
      useNativeTokenDiscount?: boolean;
      effectiveAt?: Date;
      userId?: string;
    } = {}
  ): { amount: number; fee: number; total: number; feeRate: number; scheduleStale: boolean } | null {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Invalid amount: ${amount}`);
    }

    const fees = this.resolveFees(exchange, tradingPair, side, options);
    if (!fees) return null;

    const fee = amount * fees.feeRate;
    const total = side === 'buy' ? amount + fee : amount - fee;

    return { amount, fee, total, feeRate: fees.feeRate, scheduleStale: fees.scheduleStale };
  }

  /**
   * Converts a fixed withdrawal fee to USD cost. Caller supplies the
   * VALUATION price of the fee asset (getValuationPrice, not display).
   */
  estimateWithdrawalCost(
    exchange: string,
    feeAssetPriceUsd: number
  ): { asset: string; amount: number; costUsd: number } | null {
    const info = this.schedules.get(exchange.toLowerCase());
    if (!info?.withdrawal) return null;
    if (!Number.isFinite(feeAssetPriceUsd) || feeAssetPriceUsd < 0) {
      throw new Error(`Invalid fee asset price: ${feeAssetPriceUsd}`);
    }
    return {
      asset: info.withdrawal.asset,
      amount: info.withdrawal.amount,
      costUsd: info.withdrawal.amount * feeAssetPriceUsd,
    };
  }

  // ── Volumes ──

  /** Replace-all hydration. Boot + ledger-sync interval only. */
  hydrateUserVolumes(volumes: Map<string, number> | Record<string, number>): void {
    const next = new Map<string, number>();
    const entries = volumes instanceof Map ? volumes.entries() : Object.entries(volumes);
    for (const [userId, volume] of entries) {
      if (Number.isFinite(volume) && volume >= 0) next.set(userId, volume);
    }
    this.userVolumes = next;
  }

  getUserVolume(userId: string): number {
    return this.userVolumes.get(userId) ?? 0;
  }

  // ── Introspection ──

  getFeeComparison(
    tradingPair: string,
    side: TradeSide,
    userVolume30Day = 0,
    now: Date = new Date(),
    isMaker = false,
    userId?: string
  ): FeeComparisonRow[] {
    const comparison: FeeComparisonRow[] = [];

    for (const exchange of this.schedules.keys()) {
      const fees = this.resolveFees(exchange, tradingPair, side, { userVolume30Day, isMaker, userId });
      if (!fees) continue;
      comparison.push({
        exchange,
        maker: fees.maker,
        taker: fees.taker,
        applied: fees.feeRate,
        scheduleStale: this.isScheduleStale(exchange, now, userId),
      });
    }

    return comparison.sort((a, b) => a.applied - b.applied);
  }

  getSupportedExchanges(): string[] {
    return Array.from(this.schedules.keys());
  }

  getSchedule(exchange: string): ExchangeFeeInfo | null {
    return this.schedules.get(exchange.toLowerCase()) ?? null;
  }

  validateSchedule(info: ExchangeFeeInfo): ExchangeFeeInfo {
    return normalizeFeeInfo(info);
  }

  getSchedules(): ExchangeFeeInfo[] {
    return [...this.schedules.values()];
  }

  private getUserScheduleKey(userId: string, exchange: string): string {
    return `${userId}\u0000${exchange.toLowerCase()}`;
  }

  private getVersionsForScope(exchange: string, userId?: string | null): FeeScheduleVersion[] {
    return userId
      ? this.userScheduleVersions.get(this.getUserScheduleKey(userId, exchange)) ?? []
      : this.scheduleVersions.get(exchange) ?? [];
  }

  private versionCovers(version: FeeScheduleVersion, instant: Date): boolean {
    const time = instant.getTime();
    return Date.parse(version.effectiveFrom) <= time &&
      (version.effectiveTo === null || Date.parse(version.effectiveTo) > time);
  }
}

export const exchangeFeeService = ExchangeFeeService.getInstance();