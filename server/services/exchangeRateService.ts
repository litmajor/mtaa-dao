/**
 * Exchange Rate Service
 * Primary source: Celo Mento SortedOracles (on-chain, authoritative)
 * Secondary: exchangerate-api.com (off-chain fallback, API key-free)
 * No hardcoded fallback — stale data is surfaced explicitly.
 */

import { ethers } from 'ethers';
import { logger as rootLogger } from '../utils/logger';

const logger = rootLogger;

// ── Mento SortedOracles ─────────────────────────────────────────────────────
// Celo Mainnet: 0xefB84935239dAcdecF7c5bA76d8dE40b077B7b33
// Alfajores:    0x4aB4a9eBc4568FcEf3aDaeA6673fc8f6d3b83a8
// The oracle reports cUSD/CUSD token pair → KES rate via medianRate()
const SORTED_ORACLES_ABI = [
  'function medianRate(address token) view returns (uint256 numerator, uint256 denominator)',
];

// Token used as the denominator — cUSD stable token on Celo
const CUSD_ADDRESS_MAINNET = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
const CUSD_ADDRESS_ALFAJORES = '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1';

// ── Cache ────────────────────────────────────────────────────────────────────
interface CachedRate {
  rate: number;       // KES per 1 USD
  timestamp: number;
  source: 'mento_oracle' | 'exchangerate_api';
}

let cachedRate: CachedRate | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — oracle updates every few minutes

export class ExchangeRateService {
  /**
   * Get current USD → KES exchange rate.
   * Tries Celo Mento oracle first, falls back to exchangerate-api.com.
   * Throws if both sources fail and no cached rate is available.
   */
  static async getUSDtoKESRate(): Promise<number> {
    // Serve from cache if still fresh
    if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_TTL_MS) {
      logger.info(`[ExchangeRate] Cached rate (${cachedRate.source}): ${cachedRate.rate} KES/USD`);
      return cachedRate.rate;
    }

    // 1. Try Celo Mento on-chain oracle
    const onChainRate = await this.fetchMentoOracleRate();
    if (onChainRate !== null) {
      cachedRate = { rate: onChainRate, timestamp: Date.now(), source: 'mento_oracle' };
      logger.info(`[ExchangeRate] Mento oracle rate: ${onChainRate} KES/USD`);
      return onChainRate;
    }

    // 2. Try exchangerate-api.com
    const apiRate = await this.fetchFromExchangeRateAPI();
    if (apiRate !== null) {
      cachedRate = { rate: apiRate, timestamp: Date.now(), source: 'exchangerate_api' };
      logger.info(`[ExchangeRate] exchangerate-api rate: ${apiRate} KES/USD`);
      return apiRate;
    }

    // 3. Serve stale cache with a warning
    if (cachedRate) {
      const staleAgeMin = Math.round((Date.now() - cachedRate.timestamp) / 60000);
      logger.warn(`[ExchangeRate] All live sources failed — serving stale rate (${staleAgeMin}m old): ${cachedRate.rate} KES/USD`);
      return cachedRate.rate;
    }

    // 4. No data at all — throw so callers can surface this to the user
    throw new Error(
      '[ExchangeRate] Cannot determine KES/USD rate: Mento oracle unreachable, exchangerate-api failed, and no cached rate available.'
    );
  }

  /**
   * Fetch KES/USD rate from Celo's Mento SortedOracles contract.
   * The oracle stores rates as (numerator / denominator) in fixed-point (1e24).
   */
  private static async fetchMentoOracleRate(): Promise<number | null> {
    try {
      const rpcUrl = process.env.CELO_RPC_URL || process.env.RPC_URL;
      if (!rpcUrl) {
        logger.warn('[ExchangeRate] CELO_RPC_URL not configured — skipping Mento oracle');
        return null;
      }

      const isMainnet = !rpcUrl.includes('alfajores') && !rpcUrl.includes('testnet');
      const oracleAddr = isMainnet
        ? (process.env.MENTO_SORTED_ORACLES_ADDRESS || '0xefB84935239dAcdecF7c5bA76d8dE40b077B7b33')
        : (process.env.MENTO_SORTED_ORACLES_ADDRESS_TESTNET || '0x4aB4a9eBc4568FcEf3aDaeA6673fc8f6d3b83a8');

      const cusdToken = isMainnet ? CUSD_ADDRESS_MAINNET : CUSD_ADDRESS_ALFAJORES;

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const oracle = new ethers.Contract(oracleAddr, SORTED_ORACLES_ABI, provider);

      // medianRate returns the KES per cUSD rate in fixed-point (numerator/denominator, scaled to 1e24)
      const [numerator, denominator] = await oracle.medianRate(cusdToken);

      if (!denominator || denominator === 0n) {
        logger.warn('[ExchangeRate] Mento oracle returned zero denominator');
        return null;
      }

      // Rate = numerator / denominator (result is KES per 1 cUSD)
      const rate = Number(numerator) / Number(denominator);

      if (rate <= 0 || rate > 10000) {
        logger.warn(`[ExchangeRate] Mento oracle returned implausible rate: ${rate}`);
        return null;
      }

      return Math.round(rate * 100) / 100; // round to 2 dp
    } catch (err: any) {
      logger.warn('[ExchangeRate] Mento oracle fetch failed:', err.message);
      return null;
    }
  }

  /**
   * Fetch from exchangerate-api.com free tier (1500 req/month, no key needed).
   */
  private static async fetchFromExchangeRateAPI(): Promise<number | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        'https://api.exchangerate-api.com/v4/latest/USD',
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(`[ExchangeRate] exchangerate-api returned HTTP ${response.status}`);
        return null;
      }

      const data = await response.json();
      const rate = parseFloat(data?.rates?.KES);
      if (!rate || rate <= 0) {
        logger.warn('[ExchangeRate] exchangerate-api: missing or invalid KES rate');
        return null;
      }

      return Math.round(rate * 100) / 100;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        logger.warn('[ExchangeRate] exchangerate-api timed out');
      } else {
        logger.warn('[ExchangeRate] exchangerate-api error:', err.message);
      }
      return null;
    }
  }

  /** Convert USD amount to KES */
  static async convertUSDtoKES(amountUSD: number): Promise<number> {
    const rate = await this.getUSDtoKESRate();
    return Math.round(amountUSD * rate * 100) / 100;
  }

  /** Convert KES amount to USD (= cUSD in Phase 1) */
  static async convertKEStoUSD(amountKES: number): Promise<number> {
    const rate = await this.getUSDtoKESRate();
    return Math.round((amountKES / rate) * 1e8) / 1e8; // 8 dp, cUSD precision
  }

  /** Return cache info for health checks */
  static getCacheInfo(): { rate: number | null; source: string | null; ageSeconds: number | null } {
    if (!cachedRate) return { rate: null, source: null, ageSeconds: null };
    return {
      rate: cachedRate.rate,
      source: cachedRate.source,
      ageSeconds: Math.round((Date.now() - cachedRate.timestamp) / 1000),
    };
  }
}

export const exchangeRateService = ExchangeRateService;
