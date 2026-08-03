/**
 * Chainlink Oracle Adapter
 * Fetch trusted oracle prices from on-chain Chainlink AggregatorV3 feeds.
 * Priority: 1 (Highest - most trustworthy)
 *
 * FIXES vs previous version:
 *  - Real on-chain reads via ethers.js AggregatorV3Interface (was: hardcoded mock prices)
 *  - Feed addresses injected via config/env, validated at startup (was: placeholder 0x0..00/01/02)
 *  - Staleness check against feed-specific heartbeat (was: none — stale price = silent bad data)
 *  - Decimals normalization per-feed (was: none — Chainlink feeds are NOT all 18 decimals)
 *  - Round completeness + answer > 0 sanity check (was: none)
 *  - Batched via Promise.allSettled so one bad symbol doesn't fail the whole request
 *  - Cache only set on a per-symbol success (was: all-or-nothing cache write)
 */

import { ethers } from "ethers";
import { BaseAdapter } from "./base-adapter";
import type { AdapterResponse, NormalizedData, BaseAdapterConfig } from "../types";

// Minimal AggregatorV3Interface ABI — only what we need
const AGGREGATOR_V3_ABI = [
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
];

interface FeedConfig {
  address: string;
  // Chainlink heartbeat for this feed, in seconds. Used for staleness check.
  // If a feed hasn't updated within (heartbeat * staleFactor), treat as stale.
  heartbeatSeconds: number;
}

// Feed addresses are NOT hardcoded here — inject via config.feedMap or CHAINLINK_FEED_MAP env
// (JSON: { "CELO": { "address": "0x...", "heartbeatSeconds": 21600 }, ... })
// Verify every address against https://docs.chain.link/data-feeds/price-feeds/addresses
// (select "Celo Mainnet") before deploying — do not trust any address you didn't verify yourself.
const DEFAULT_STALE_FACTOR = 3; // allow up to 3x heartbeat before flagging stale
const MIN_CONFIDENCE_STALE_PENALTY = 0.5;
 
export class ChainlinkAdapter extends BaseAdapter {
  private rpcUrl: string;
  private provider: ethers.JsonRpcProvider;
  private feedMap: Record<string, FeedConfig>;

  constructor(config: BaseAdapterConfig & { feedMap?: Record<string, FeedConfig> }) {
    super("chainlink", config);

    this.rpcUrl =
      config.rpcUrl || process.env.CHAINLINK_RPC_URL || process.env.CELO_RPC_URL || "https://forno.celo.org";

    if (!this.rpcUrl) {
      throw new Error("Chainlink adapter requires a valid RPC URL");
    }

    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

    this.feedMap = config.feedMap || this.loadFeedMapFromEnv();

    if (Object.keys(this.feedMap).length === 0) {
      throw new Error(
        "ChainlinkAdapter: no feed addresses configured. Set CHAINLINK_FEED_MAP env var or pass config.feedMap — " +
          "refusing to start with an empty feed map to avoid silently returning no data."
      );
    }

    for (const [symbol, feed] of Object.entries(this.feedMap)) {
      if (!ethers.isAddress(feed.address)) {
        throw new Error(`ChainlinkAdapter: invalid feed address for ${symbol}: ${feed.address}`);
      }
    }
  }

  private loadFeedMapFromEnv(): Record<string, FeedConfig> {
    const raw = process.env.CHAINLINK_FEED_MAP;
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("ChainlinkAdapter: CHAINLINK_FEED_MAP env var is not valid JSON");
    }
  }

  async fetch(
    dataType: string,
    params: any
  ): Promise<AdapterResponse<NormalizedData | NormalizedData[]>> {
    const startTime = Date.now();

    try {
      if (dataType === "price") {
        return await this.fetchPrices(params);
      } else if (dataType === "risk") {
        return await this.fetchRiskData(params);
      }

      return {
        success: false,
        error: `Unsupported data type: ${dataType}`,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private async fetchPrices(params: any): Promise<AdapterResponse<NormalizedData[]>> {
    const startTime = Date.now();
    const { symbols } = params;

    const cacheKey = `chainlink:prices:${symbols.join(",")}`;
    const cached = this.getCache(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }

    const settled = await Promise.allSettled(
      symbols.map((symbol: string) => this.readFeed(symbol))
    );

    const results: NormalizedData[] = [];
    const errors: string[] = [];

    settled.forEach((outcome, i) => {
      const symbol = symbols[i];
      if (outcome.status === "fulfilled" && outcome.value) {
        results.push(outcome.value);
      } else {
        const reason = outcome.status === "rejected" ? outcome.reason?.message ?? String(outcome.reason) : "unknown";
        errors.push(`${symbol}: ${reason}`);
      }
    });

    // Only cache if we got at least one good result; never cache an empty/all-failed batch
    if (results.length > 0) {
      this.setCache(cacheKey, results, 60);
    }

    if (results.length === 0) {
      return {
        success: false,
        error: `All feed reads failed: ${errors.join("; ")}`,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      data: results,
      // Surface partial failures without failing the whole call
      ...(errors.length > 0 ? { warning: `Partial failure: ${errors.join("; ")}` } : {}),
      timestamp: new Date(),
      latencyMs: Date.now() - startTime,
    } as AdapterResponse<NormalizedData[]>;
  }

  private async fetchRiskData(params: any): Promise<AdapterResponse<NormalizedData>> {
    const startTime = Date.now();

    // Chainlink doesn't provide protocol risk data directly via price feeds.
    // Would need Chainlink Proof of Reserve or a dedicated risk feed if/when available on Celo.
    return {
      success: false,
      error: "Risk data not available from Chainlink price feeds",
      timestamp: new Date(),
      latencyMs: Date.now() - startTime,
    };
  }

  private async readFeed(symbol: string): Promise<NormalizedData> {
    const feed = this.feedMap[symbol];
    if (!feed) {
      throw new Error(`No Chainlink feed configured for ${symbol}`);
    }

    const contract = new ethers.Contract(feed.address, AGGREGATOR_V3_ABI, this.provider);

    const [decimals, roundData] = await Promise.all([
      contract.decimals() as Promise<number>,
      contract.latestRoundData() as Promise<{
        roundId: bigint;
        answer: bigint;
        startedAt: bigint;
        updatedAt: bigint;
        answeredInRound: bigint;
      }>,
    ]);

    const { roundId, answer, updatedAt, answeredInRound } = roundData;

    // Round completeness check — per Chainlink best practice
    if (answeredInRound < roundId) {
      throw new Error(`Stale round for ${symbol}: answeredInRound (${answeredInRound}) < roundId (${roundId})`);
    }

    if (answer <= 0n) {
      throw new Error(`Non-positive answer for ${symbol}: ${answer.toString()}`);
    }

    const updatedAtMs = Number(updatedAt) * 1000;
    const ageSeconds = (Date.now() - updatedAtMs) / 1000;
    const maxAgeSeconds = feed.heartbeatSeconds * DEFAULT_STALE_FACTOR;
    const isStale = ageSeconds > maxAgeSeconds;

    if (isStale) {
      // Don't silently serve stale data as if it were fresh — fail loudly so callers
      // (treasury valuation, vault pricing, rebalancing) don't act on it unknowingly.
      throw new Error(
        `Stale price for ${symbol}: last updated ${ageSeconds.toFixed(0)}s ago, max allowed ${maxAgeSeconds}s`
      );
    }

    const price = Number(ethers.formatUnits(answer, decimals));

    // Confidence degrades as we approach the staleness threshold rather than
    // jumping straight from "fine" to "rejected"
    const confidence =
      ageSeconds > feed.heartbeatSeconds
        ? Math.max(MIN_CONFIDENCE_STALE_PENALTY, 1 - ageSeconds / maxAgeSeconds)
        : 0.99;

    return {
      id: `chainlink:${symbol}:${roundId.toString()}`,
      source: "chainlink",
      timestamp: new Date().toISOString(),
      dataType: "price",
      asset: {
        symbol,
        chain: "celo",
        address: feed.address,
      },
      value: price,
      metadata: {
        confidence,
        roundId: roundId.toString(),
        updatedAt: new Date(updatedAtMs).toISOString(),
        ageSeconds: Math.round(ageSeconds),
        decimals,
      },
    };
  }
}