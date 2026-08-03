import { dexscreenerClient, type DexPair } from './dexscreenerClient';
import { priceOracle } from './priceOracle';
import { logger } from '../utils/logger';

/**
 * ═══════════════════════════════════════════════════════════════════════
 * AMM / DEX Market Microstructure Indicators
 * ═══════════════════════════════════════════════════════════════════════
 * Companion to advancedMicrostructureIndicators.ts (CEX/order-book), but
 * genuinely different math throughout — AMM pools have no order book, no
 * bid/ask, no trade-by-trade tape in the same sense. The relevant
 * questions here are: how does price move as a function of trade SIZE
 * against a pool's reserves (constant-product curve), how concentrated
 * or fragmented is a pair's liquidity across the DEX ecosystem, how far
 * has a pool's implied price drifted from the broader market reference,
 * and how exposed is a given trade size to sandwich extraction.
 *
 * Data sources:
 *   - dexscreenerClient (verified real earlier in this project): gives
 *     per-pool liquidity.base/liquidity.quote (i.e. reserves), volume,
 *     price change, across every DEX/chain it indexes. This is the
 *     "broader market universe" view — cross-DEX, cross-chain.
 *   - priceOracle: external reference price, used to measure how far a
 *     given pool's implied price has drifted from the market consensus.
 *
 * DexScreener's reserve figures are refreshed on their own indexing
 * cadence (not a live per-request RPC call), so treat pool-level numbers
 * here as "recent snapshot," not "this exact block." For execution-time
 * precision on a specific pool, pair this with a live on-chain quote
 * (dexIntegrationService.getOnChainQuote / productionDexRouting's
 * queryUbeswap/queryMento already do real RPC reads) — this service is
 * for market-structure analysis and monitoring, not final trade sizing.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────

/** Trade sizes tested for the price-impact curve, as a fraction of pool reserveIn. */
const IMPACT_CURVE_TRADE_FRACTIONS = [0.001, 0.005, 0.01, 0.02, 0.05, 0.10];

/** Common AMM fee tiers by known DEX id — used when a pool's own fee isn't reported. */
const DEFAULT_FEE_BY_DEX: Record<string, number> = {
  ubeswap: 0.003,
  mento: 0.0, // Mento's spread is built into its exchange rate, not a separate fee
  uniswapv3: 0.003, // default 0.3% tier; real V3 pools vary by tier (0.01/0.05/0.3/1%)
  sushiswap: 0.003,
  pancakeswap: 0.0025,
};
const DEFAULT_FEE_FALLBACK = 0.003;

/** HHI (Herfindahl-Hirschman Index) thresholds, scaled 0-10000 (standard convention). */
const HHI_FRAGMENTED_THRESHOLD = 1500; // below this: well distributed across pools
const HHI_CONCENTRATED_THRESHOLD = 2500; // above this: single-pool dependency risk

/** Pool implied price vs external reference — deviation beyond this flags staleness/arb pressure. */
const PRICE_DEVIATION_WARNING_PCT = 1.0;
const PRICE_DEVIATION_CRITICAL_PCT = 3.0;

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────

export interface PriceImpactPoint {
  tradeSizeFraction: number;   // as fraction of pool reserveIn
  tradeSizeToken: number;      // absolute token amount
  tradeSizeUSD: number | null; // if a reference price is available
  amountOut: number;
  executionPrice: number;
  priceImpactPct: number;      // vs. pre-trade spot price
}

export interface PoolImpactCurve {
  pairAddress: string;
  dexId: string;
  chainId: string;
  baseSymbol: string;
  quoteSymbol: string;
  reserveBase: number;
  reserveQuote: number;
  feeUsed: number;
  spotPrice: number; // reserveQuote / reserveBase
  curve: PriceImpactPoint[];
}

export interface CrossDexLiquidityProfile {
  symbol: string;
  timestamp: number;
  poolsFound: number;
  totalLiquidityUSD: number;
  totalVolume24hUSD: number;
  turnoverRatio: number; // volume24h / liquidity — activity relative to depth
  concentrationHHI: number; // 0-10000
  concentrationAssessment: 'fragmented' | 'distributed' | 'concentrated';
  topPool: { dexId: string; chainId: string; liquidityUSD: number; shareOfTotal: number } | null;
  pools: Array<{ dexId: string; chainId: string; liquidityUSD: number; volume24hUSD: number; shareOfTotal: number }>;
}

export interface PoolPriceDeviation {
  pairAddress: string;
  dexId: string;
  chainId: string;
  poolImpliedPrice: number;
  referencePrice: number | null;
  deviationPct: number | null;
  assessment: 'aligned' | 'minor_deviation' | 'significant_deviation' | 'no_reference';
}

export interface SandwichExposureEstimate {
  pairAddress: string;
  dexId: string;
  victimTradeSizeToken: number;
  victimPriceImpactPct: number;
  roundTripFeeCostPct: number; // 2x the pool fee, the cost an attacker must clear
  theoreticallyProfitable: boolean; // approximate heuristic, not an exact MEV profit model
  note: string;
}

export interface AmmMicrostructureSnapshot {
  symbol: string;
  timestamp: number;
  liquidityProfile: CrossDexLiquidityProfile | null;
  topPoolImpactCurve: PoolImpactCurve | null;
  topPoolPriceDeviation: PoolPriceDeviation | null;
  topPoolSandwichExposure: SandwichExposureEstimate | null;
  componentErrors: Partial<Record<'liquidity' | 'impactCurve' | 'deviation' | 'sandwich', string>>;
  overallAssessment: 'healthy' | 'fragile' | 'insufficient_data';
  notes: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────

class AmmMicrostructureIndicators {
  private static instance: AmmMicrostructureIndicators;
  private constructor() {}

  static getInstance(): AmmMicrostructureIndicators {
    if (!AmmMicrostructureIndicators.instance) {
      AmmMicrostructureIndicators.instance = new AmmMicrostructureIndicators();
    }
    return AmmMicrostructureIndicators.instance;
  }

  // ── Cross-DEX liquidity concentration ───────────────────────────────

  /**
   * Aggregates every pool DexScreener knows about for a symbol across all
   * DEXes/chains it indexes, and computes:
   *   - total liquidity and volume across the whole ecosystem for this pair
   *   - turnover ratio (activity relative to depth)
   *   - HHI concentration: how much of total liquidity sits in one pool
   *     vs spread across many. A pair with 95% of its liquidity in a
   *     single Ubeswap pool is fragile — that pool going down or being
   *     drained materially breaks the market for this asset. A pair with
   *     liquidity spread across 10 pools with no single one dominant is
   *     structurally more resilient.
   */
  async getCrossDexLiquidityProfile(symbol: string, minLiquidityUSD = 1000): Promise<CrossDexLiquidityProfile> {
    const pairs = await dexscreenerClient.searchPairs(symbol);
    const relevant = pairs.filter(p => (p.liquidity?.usd ?? 0) >= minLiquidityUSD);

    if (relevant.length === 0) {
      throw new Error(`No DEX pools found for ${symbol} with liquidity >= $${minLiquidityUSD}`);
    }

    const totalLiquidityUSD = relevant.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0);
    const totalVolume24hUSD = relevant.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0);

    const pools = relevant
      .map(p => ({
        dexId: p.dexId,
        chainId: p.chainId,
        liquidityUSD: p.liquidity?.usd ?? 0,
        volume24hUSD: p.volume?.h24 ?? 0,
        shareOfTotal: totalLiquidityUSD > 0 ? (p.liquidity?.usd ?? 0) / totalLiquidityUSD : 0,
      }))
      .sort((a, b) => b.liquidityUSD - a.liquidityUSD);

    // HHI: sum of squared market shares, scaled 0-10000 (standard convention:
    // shares expressed 0-100 before squaring, e.g. 50% share -> 50^2 = 2500).
    const concentrationHHI = Math.round(
      pools.reduce((sum, p) => sum + (p.shareOfTotal * 100) ** 2, 0),
    );

    const concentrationAssessment: CrossDexLiquidityProfile['concentrationAssessment'] =
      concentrationHHI < HHI_FRAGMENTED_THRESHOLD ? 'fragmented'
      : concentrationHHI < HHI_CONCENTRATED_THRESHOLD ? 'distributed'
      : 'concentrated';

    const topPool = pools.length > 0
      ? { dexId: pools[0].dexId, chainId: pools[0].chainId, liquidityUSD: pools[0].liquidityUSD, shareOfTotal: pools[0].shareOfTotal }
      : null;

    return {
      symbol,
      timestamp: Date.now(),
      poolsFound: pools.length,
      totalLiquidityUSD,
      totalVolume24hUSD,
      turnoverRatio: totalLiquidityUSD > 0 ? totalVolume24hUSD / totalLiquidityUSD : 0,
      concentrationHHI,
      concentrationAssessment,
      topPool,
      pools,
    };
  }

  // ── Constant-product price impact curve ─────────────────────────────

  /**
   * Real constant-product (x*y=k) math applied to a specific pool's
   * reported reserves. This is deterministic, closed-form, and requires
   * no external assumptions beyond "this pool behaves like a standard
   * constant-product AMM" (true for Ubeswap/Uniswap-V2-style pools;
   * Uniswap V3 concentrated-liquidity pools and Mento's rate-based
   * design need different models — see note below).
   *
   * NOTE ON MODEL SCOPE: this curve is exact for constant-product (V2-style)
   * pools where reserveBase/reserveQuote fully describe the pool. It is an
   * APPROXIMATION for Uniswap V3-style concentrated liquidity (where
   * effective depth varies by price range, not just total reserves) and
   * does not apply at all to Mento (which prices via an exchange-rate
   * broker, not a reserve ratio) — flagged via the `dexId` on the pool
   * rather than silently misapplying the formula.
   */
  buildImpactCurve(pool: DexPair, feeOverride?: number): PoolImpactCurve {
    const reserveBase = pool.liquidity?.base ?? 0;
    const reserveQuote = pool.liquidity?.quote ?? 0;

    if (reserveBase <= 0 || reserveQuote <= 0) {
      throw new Error(`Pool ${pool.pairAddress} on ${pool.dexId} has no usable reserve data for impact curve`);
    }

    if (pool.dexId?.toLowerCase().includes('mento')) {
      throw new Error(`${pool.dexId} is a rate-based broker, not a constant-product pool — constant-product impact curve does not apply. Use Mento's own getAmountOut for accurate quotes.`);
    }

    const fee = feeOverride ?? DEFAULT_FEE_BY_DEX[pool.dexId?.toLowerCase() ?? ''] ?? DEFAULT_FEE_FALLBACK;
    const spotPrice = reserveQuote / reserveBase;
    const refPriceUsd = pool.priceUsd ? parseFloat(pool.priceUsd) : null;

    const curve: PriceImpactPoint[] = IMPACT_CURVE_TRADE_FRACTIONS.map(fraction => {
      const tradeSizeToken = reserveBase * fraction;
      const amountInWithFee = tradeSizeToken * (1 - fee);
      const amountOut = (amountInWithFee * reserveQuote) / (reserveBase + amountInWithFee);
      const executionPrice = amountOut / tradeSizeToken;
      const priceImpactPct = ((spotPrice - executionPrice) / spotPrice) * 100;

      return {
        tradeSizeFraction: fraction,
        tradeSizeToken,
        tradeSizeUSD: refPriceUsd !== null ? tradeSizeToken * refPriceUsd : null,
        amountOut,
        executionPrice,
        priceImpactPct,
      };
    });

    return {
      pairAddress: pool.pairAddress,
      dexId: pool.dexId,
      chainId: pool.chainId,
      baseSymbol: pool.baseToken.symbol,
      quoteSymbol: pool.quoteToken.symbol,
      reserveBase,
      reserveQuote,
      feeUsed: fee,
      spotPrice,
      curve,
    };
  }

  // ── Pool price deviation from external reference ────────────────────

  /**
   * Compares a pool's implied price (from its own reserve ratio) against
   * an external reference price from priceOracle. Large deviation signals
   * either the pool is stale (arbitrageurs haven't caught up yet — an
   * opportunity) or the pool is thin enough that its own price discovery
   * is unreliable (a risk for anyone trading against it).
   */
  async getPoolPriceDeviation(pool: DexPair): Promise<PoolPriceDeviation> {
    const reserveBase = pool.liquidity?.base ?? 0;
    const reserveQuote = pool.liquidity?.quote ?? 0;
    const poolImpliedPrice = reserveBase > 0 ? reserveQuote / reserveBase : 0;

    let referencePrice: number | null = null;
    try {
      const prices = await priceOracle.getPrices([pool.baseToken.symbol]);
      const pd = prices.get(pool.baseToken.symbol.toUpperCase());
      if (pd?.priceUsd && pd.priceUsd > 0) referencePrice = pd.priceUsd;
    } catch (err) {
      logger.debug(`[AMM-Microstructure] Reference price lookup failed for ${pool.baseToken.symbol}: ${(err as Error).message}`);
    }

    if (referencePrice === null || poolImpliedPrice === 0) {
      return {
        pairAddress: pool.pairAddress, dexId: pool.dexId, chainId: pool.chainId,
        poolImpliedPrice, referencePrice: null, deviationPct: null, assessment: 'no_reference',
      };
    }

    const deviationPct = ((poolImpliedPrice - referencePrice) / referencePrice) * 100;
    const absDeviation = Math.abs(deviationPct);

    const assessment: PoolPriceDeviation['assessment'] =
      absDeviation < PRICE_DEVIATION_WARNING_PCT ? 'aligned'
      : absDeviation < PRICE_DEVIATION_CRITICAL_PCT ? 'minor_deviation'
      : 'significant_deviation';

    return {
      pairAddress: pool.pairAddress, dexId: pool.dexId, chainId: pool.chainId,
      poolImpliedPrice, referencePrice, deviationPct, assessment,
    };
  }

  // ── Sandwich exposure estimate ───────────────────────────────────────

  /**
   * Approximate heuristic, not an exact closed-form MEV profit model:
   * a sandwich attack (front-run + back-run) only becomes profitable once
   * the value extractable from the victim's price impact exceeds the
   * round-trip fee cost the attacker pays entering and exiting the pool
   * (2x the pool fee, since the attacker trades twice). This is the
   * standard simplified profitability threshold used in MEV-analysis
   * writeups — it ignores gas cost and exact optimal front-run sizing
   * (which has its own closed form but depends on details this service
   * doesn't have visibility into, like the attacker's capital and gas
   * market conditions at execution time). Treat `theoreticallyProfitable`
   * as a directional signal, not a precise profit calculation.
   */
  estimateSandwichExposure(pool: DexPair, victimTradeSizeToken: number, feeOverride?: number): SandwichExposureEstimate {
    const impactCurve = this.buildImpactCurve(pool, feeOverride);
    const reserveBase = pool.liquidity?.base ?? 0;
    const fee = feeOverride ?? DEFAULT_FEE_BY_DEX[pool.dexId?.toLowerCase() ?? ''] ?? DEFAULT_FEE_FALLBACK;

    // Compute victim's own price impact directly (not interpolated from the curve)
    const amountInWithFee = victimTradeSizeToken * (1 - fee);
    const amountOut = (amountInWithFee * (pool.liquidity?.quote ?? 0)) / (reserveBase + amountInWithFee);
    const spotPrice = impactCurve.spotPrice;
    const executionPrice = amountOut / victimTradeSizeToken;
    const victimPriceImpactPct = ((spotPrice - executionPrice) / spotPrice) * 100;

    const roundTripFeeCostPct = fee * 2 * 100; // attacker pays fee entering AND exiting

    return {
      pairAddress: pool.pairAddress,
      dexId: pool.dexId,
      victimTradeSizeToken,
      victimPriceImpactPct: Math.abs(victimPriceImpactPct),
      roundTripFeeCostPct,
      theoreticallyProfitable: Math.abs(victimPriceImpactPct) > roundTripFeeCostPct,
      note: 'Approximate profitability threshold (impact vs round-trip fee cost). Ignores gas cost and optimal attacker sizing — directional signal, not an exact MEV profit calculation.',
    };
  }

  // ── Comprehensive snapshot ───────────────────────────────────────────

  async getComprehensiveSnapshot(symbol: string): Promise<AmmMicrostructureSnapshot> {
    const componentErrors: AmmMicrostructureSnapshot['componentErrors'] = {};
    const notes: string[] = [];

    let liquidityProfile: CrossDexLiquidityProfile | null = null;
    try {
      liquidityProfile = await this.getCrossDexLiquidityProfile(symbol);
    } catch (err) {
      componentErrors.liquidity = (err as Error).message;
    }

    if (!liquidityProfile || !liquidityProfile.topPool) {
      return {
        symbol, timestamp: Date.now(),
        liquidityProfile, topPoolImpactCurve: null, topPoolPriceDeviation: null, topPoolSandwichExposure: null,
        componentErrors, overallAssessment: 'insufficient_data',
        notes: ['No DEX pools with sufficient liquidity found for this symbol.'],
      };
    }

    // Re-fetch the full pair object for the top pool (searchPairs gave us
    // the ranking; we need the full DexPair with reserves for the pool math).
    const allPairs = await dexscreenerClient.searchPairs(symbol);
    const topPoolPair = allPairs.find(
      p => p.dexId === liquidityProfile!.topPool!.dexId && p.chainId === liquidityProfile!.topPool!.chainId,
    );

    let topPoolImpactCurve: PoolImpactCurve | null = null;
    let topPoolPriceDeviation: PoolPriceDeviation | null = null;
    let topPoolSandwichExposure: SandwichExposureEstimate | null = null;

    if (topPoolPair) {
      try {
        topPoolImpactCurve = this.buildImpactCurve(topPoolPair);
      } catch (err) {
        componentErrors.impactCurve = (err as Error).message;
      }

      try {
        topPoolPriceDeviation = await this.getPoolPriceDeviation(topPoolPair);
      } catch (err) {
        componentErrors.deviation = (err as Error).message;
      }

      if (topPoolImpactCurve) {
        try {
          // Sandwich exposure estimated at the 1% pool-reserve trade size point —
          // a reasonably realistic "someone places a meaningful order" scenario.
          const midCurvePoint = topPoolImpactCurve.curve.find(c => c.tradeSizeFraction === 0.01);
          if (midCurvePoint) {
            topPoolSandwichExposure = this.estimateSandwichExposure(topPoolPair, midCurvePoint.tradeSizeToken);
          }
        } catch (err) {
          componentErrors.sandwich = (err as Error).message;
        }
      }
    } else {
      componentErrors.impactCurve = 'Top pool could not be re-matched for detailed pool math (DexScreener result set changed between calls)';
    }

    if (liquidityProfile.concentrationAssessment === 'concentrated') {
      notes.push(`Liquidity is concentrated: ${(liquidityProfile.topPool.shareOfTotal * 100).toFixed(0)}% sits in a single pool (${liquidityProfile.topPool.dexId}). This pair depends heavily on that pool's health.`);
    }
    if (topPoolPriceDeviation?.assessment === 'significant_deviation') {
      notes.push(`Top pool's implied price deviates ${topPoolPriceDeviation.deviationPct?.toFixed(2)}% from external reference — likely stale or thin.`);
    }
    if (topPoolSandwichExposure?.theoreticallyProfitable) {
      notes.push(`Trades near 1% of pool reserves may be economically attractive to sandwich on ${topPoolSandwichExposure.dexId} (impact ${topPoolSandwichExposure.victimPriceImpactPct.toFixed(3)}% vs round-trip fee ${topPoolSandwichExposure.roundTripFeeCostPct.toFixed(3)}%).`);
    }

    const overallAssessment: AmmMicrostructureSnapshot['overallAssessment'] =
      liquidityProfile.concentrationAssessment === 'concentrated'
      || topPoolPriceDeviation?.assessment === 'significant_deviation'
      || topPoolSandwichExposure?.theoreticallyProfitable
        ? 'fragile'
        : 'healthy';

    return {
      symbol, timestamp: Date.now(),
      liquidityProfile, topPoolImpactCurve, topPoolPriceDeviation, topPoolSandwichExposure,
      componentErrors, overallAssessment, notes,
    };
  }
}

export const ammMicrostructureIndicators = AmmMicrostructureIndicators.getInstance();