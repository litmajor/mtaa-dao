import { ethers } from 'ethers';
import { ResilientRpcProvider } from './resilientRpcProvider';

const AGGREGATOR_V3_ABI = [
  'function decimals() view returns (uint8)',
  'function description() view returns (string)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
];

const DEFAULT_HEARTBEAT_FACTOR = 1.25;
const DEFAULT_MAX_RPC_BLOCK_AGE_SECONDS = 60;
const RPC_TIMEOUT_MS = 10_000;

export type ChainlinkMode = 'off' | 'shadow' | 'quorum' | 'anchor';
export type ChainlinkFeedKind = 'direct';
export type ChainlinkMissingPolicy = 'fail' | 'degrade';

export interface ChainlinkFeedConfig {
  symbol: string;
  chainId: number;
  address: string;
  heartbeatSeconds: number;
  expectedDescription: string;
  mode: ChainlinkMode;
  kind: ChainlinkFeedKind;
  onMissing: ChainlinkMissingPolicy;
  anchorMaxDeviationPct?: number;
}

export interface ChainlinkObservation {
  symbol: string;
  chainId: number;
  address: string;
  priceUsd: number;
  roundId: string;
  updatedAtMs: number;
  observedAtMs: number;
  ageSeconds: number;
  heartbeatSeconds: number;
  decimals: number;
}

export interface ChainlinkProvider {
  call<T>(fn: (provider: ethers.JsonRpcProvider) => Promise<T>): Promise<T>;
}

interface ParsedChainlinkFeedConfig {
  feeds: Map<string, ChainlinkFeedConfig>;
  errors: string[];
  invalidSymbols: Set<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseChainlinkFeedConfig(raw?: string): ParsedChainlinkFeedConfig {
  const feeds = new Map<string, ChainlinkFeedConfig>();
  const errors: string[] = [];
  const invalidSymbols = new Set<string>();

  if (!raw?.trim()) return { feeds, errors, invalidSymbols };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      feeds,
      errors: [`CHAINLINK_VALUATION_FEEDS is not valid JSON: ${error instanceof Error ? error.message : String(error)}`],
      invalidSymbols,
    };
  }
  if (!isRecord(parsed)) {
    return {
      feeds,
      errors: ['CHAINLINK_VALUATION_FEEDS must be a JSON object keyed by asset symbol'],
      invalidSymbols,
    };
  }

  for (const [rawSymbol, rawFeed] of Object.entries(parsed)) {
    const symbol = rawSymbol.trim().toUpperCase();
    const fail = (reason: string): void => {
      if (symbol) invalidSymbols.add(symbol);
      errors.push(`${rawSymbol}: ${reason}`);
    };
    if (!symbol) {
      fail('symbol must not be empty');
      continue;
    }
    if (!isRecord(rawFeed)) {
      fail('feed entry must be an object');
      continue;
    }
    if (feeds.has(symbol)) {
      feeds.delete(symbol);
      fail('duplicate symbol after case normalization');
      continue;
    }

    const chainId = rawFeed.chainId;
    const address = rawFeed.address;
    const heartbeatSeconds = rawFeed.heartbeatSeconds;
    const expectedDescription = rawFeed.expectedDescription;
    const mode = rawFeed.mode;
    const kind = rawFeed.kind ?? 'direct';
    const onMissing = rawFeed.onMissing ?? (mode === 'anchor' ? 'fail' : 'degrade');
    const anchorMaxDeviationPct = rawFeed.anchorMaxDeviationPct;

    if (!Number.isSafeInteger(chainId) || Number(chainId) <= 0) {
      fail('chainId must be a positive safe integer');
      continue;
    }
    if (typeof address !== 'string' || !ethers.isAddress(address)) {
      fail('address must be a valid EVM address');
      continue;
    }
    if (typeof heartbeatSeconds !== 'number' || !Number.isFinite(heartbeatSeconds) || heartbeatSeconds <= 0) {
      fail('heartbeatSeconds must be a positive finite number');
      continue;
    }
    if (typeof expectedDescription !== 'string' || !expectedDescription.trim()) {
      fail('expectedDescription must be a non-empty string');
      continue;
    }
    if (mode !== 'off' && mode !== 'shadow' && mode !== 'quorum' && mode !== 'anchor') {
      fail('mode must be off, shadow, quorum, or anchor');
      continue;
    }
    if (kind !== 'direct') {
      fail('only direct USD feeds are supported');
      continue;
    }
    if (onMissing !== 'fail' && onMissing !== 'degrade') {
      fail('onMissing must be fail or degrade');
      continue;
    }
    if (
      mode === 'anchor' &&
      (typeof anchorMaxDeviationPct !== 'number' ||
        !Number.isFinite(anchorMaxDeviationPct) ||
        anchorMaxDeviationPct <= 0 ||
        anchorMaxDeviationPct > 100)
    ) {
      fail('anchor mode requires anchorMaxDeviationPct in the range (0, 100]');
      continue;
    }

    feeds.set(symbol, {
      symbol,
      chainId: Number(chainId),
      address,
      heartbeatSeconds,
      expectedDescription: expectedDescription.trim(),
      mode,
      kind,
      onMissing,
      ...(typeof anchorMaxDeviationPct === 'number' ? { anchorMaxDeviationPct } : {}),
    });
  }

  return { feeds, errors, invalidSymbols };
}

const CHAIN_RPC_CONFIG: Record<
  number,
  { primary: string; fallback?: string; defaultUrl: string; name: string }
> = {
  1: {
    primary: 'ETHEREUM_RPC_URL',
    fallback: 'ETHEREUM_RPC_FALLBACK_URL',
    defaultUrl: 'https://ethereum-rpc.publicnode.com',
    name: 'Ethereum',
  },
  10: {
    primary: 'OPTIMISM_RPC_URL',
    fallback: 'OPTIMISM_RPC_FALLBACK_URL',
    defaultUrl: 'https://mainnet.optimism.io',
    name: 'Optimism',
  },
  56: {
    primary: 'BSC_RPC_URL',
    fallback: 'BSC_RPC_FALLBACK_URL',
    defaultUrl: 'https://bsc-dataseed.binance.org',
    name: 'BNB Smart Chain',
  },
  137: {
    primary: 'POLYGON_RPC_URL',
    fallback: 'POLYGON_RPC_FALLBACK_URL',
    defaultUrl: 'https://polygon-bor-rpc.publicnode.com',
    name: 'Polygon',
  },
  8453: {
    primary: 'BASE_RPC_URL',
    fallback: 'BASE_RPC_FALLBACK_URL',
    defaultUrl: 'https://mainnet.base.org',
    name: 'Base',
  },
  42161: {
    primary: 'ARBITRUM_RPC_URL',
    fallback: 'ARBITRUM_RPC_FALLBACK_URL',
    defaultUrl: 'https://arb1.arbitrum.io/rpc',
    name: 'Arbitrum',
  },
  42220: {
    primary: 'CELO_RPC_URL',
    fallback: 'CELO_RPC_FALLBACK_URL',
    defaultUrl: 'https://forno.celo.org',
    name: 'Celo',
  },
  43114: {
    primary: 'AVALANCHE_RPC_URL',
    fallback: 'AVALANCHE_RPC_FALLBACK_URL',
    defaultUrl: 'https://api.avax.network/ext/bc/C/rpc',
    name: 'Avalanche',
  },
};

const providers = new Map<number, ChainlinkProvider>();

function makeJsonRpcProvider(url: string, chainId: number): ethers.JsonRpcProvider {
  const request = new ethers.FetchRequest(url);
  request.timeout = RPC_TIMEOUT_MS;
  return new ethers.JsonRpcProvider(request, chainId, { staticNetwork: true, batchMaxCount: 1 });
}

export function defaultChainlinkProvider(chainId: number): ChainlinkProvider {
  const cached = providers.get(chainId);
  if (cached) return cached;

  const chain = CHAIN_RPC_CONFIG[chainId];
  if (!chain) throw new Error(`No Chainlink RPC configuration for chainId ${chainId}`);
  const primaryUrl =
    (chainId === 42220 ? process.env.CHAINLINK_VALUATION_RPC_URL : undefined) ||
    process.env[chain.primary] ||
    (chainId === 42220 ? process.env.CHAINLINK_RPC_URL : undefined) ||
    chain.defaultUrl;
  const fallbackUrl = chain.fallback ? process.env[chain.fallback] : undefined;
  const provider = new ResilientRpcProvider({
    primary: { name: `${chain.name} primary`, httpUrl: primaryUrl },
    ...(fallbackUrl
      ? { fallback: { name: `${chain.name} fallback`, httpUrl: fallbackUrl } }
      : {}),
    createProvider: (url) => makeJsonRpcProvider(url, chainId),
  });
  providers.set(chainId, provider);
  return provider;
}

export class ChainlinkFeedReader {
  constructor(
    private readonly options: {
      getProvider: (chainId: number) => ChainlinkProvider;
      heartbeatFactor?: number;
      maxRpcBlockAgeSeconds?: number;
    }
  ) {}

  async validate(
    feed: ChainlinkFeedConfig
  ): Promise<{ description: string; decimals: number }> {
    const provider = this.options.getProvider(feed.chainId);
    return provider.call(async (rpc) => {
      await this.assertRpcChain(rpc, feed);

      const contract = new ethers.Contract(feed.address, AGGREGATOR_V3_ABI, rpc);
      const [description, decimals] = await Promise.all([
        contract.description() as Promise<string>,
        contract.decimals() as Promise<number>,
      ]);
      if (description.trim() !== feed.expectedDescription) {
        throw new Error(
          `Feed description mismatch for ${feed.symbol}: expected "${feed.expectedDescription}", got "${description}"`
        );
      }
      if (!Number.isInteger(Number(decimals)) || Number(decimals) < 0 || Number(decimals) > 36) {
        throw new Error(`Invalid feed decimals for ${feed.symbol}: ${decimals}`);
      }
      return { description, decimals: Number(decimals) };
    });
  }

  async read(feed: ChainlinkFeedConfig): Promise<ChainlinkObservation> {
    const provider = this.options.getProvider(feed.chainId);
    return provider.call(async (rpc) => {
      const [block] = await Promise.all([
        rpc.getBlock('latest'),
        this.assertRpcChain(rpc, feed),
      ]);
      if (!block) throw new Error(`Latest block unavailable for ${feed.symbol}`);

      const rpcBlockAgeSeconds = Date.now() / 1000 - block.timestamp;
      const maxRpcBlockAgeSeconds =
        this.options.maxRpcBlockAgeSeconds ?? DEFAULT_MAX_RPC_BLOCK_AGE_SECONDS;
      if (
        rpcBlockAgeSeconds < -1 ||
        rpcBlockAgeSeconds > maxRpcBlockAgeSeconds
      ) {
        throw new Error(
          `RPC block is stale or future-dated for ${feed.symbol}: age ${rpcBlockAgeSeconds.toFixed(0)}s`
        );
      }

      const contract = new ethers.Contract(feed.address, AGGREGATOR_V3_ABI, rpc);
      const [decimals, roundData] = await Promise.all([
        contract.decimals({ blockTag: block.number }) as Promise<number>,
        contract.latestRoundData({ blockTag: block.number }) as Promise<{
          roundId: bigint;
          answer: bigint;
          startedAt: bigint;
          updatedAt: bigint;
          answeredInRound: bigint;
        }>,
      ]);
      const { roundId, answer, updatedAt, answeredInRound } = roundData;

      if (answeredInRound < roundId) {
        throw new Error(`Incomplete Chainlink round for ${feed.symbol}`);
      }
      if (answer <= 0n) throw new Error(`Non-positive Chainlink answer for ${feed.symbol}`);
      if (updatedAt <= 0n || updatedAt > BigInt(block.timestamp)) {
        throw new Error(`Invalid or future-dated Chainlink update for ${feed.symbol}`);
      }

      const ageSeconds = block.timestamp - Number(updatedAt);
      const heartbeatFactor = this.options.heartbeatFactor ?? DEFAULT_HEARTBEAT_FACTOR;
      if (!Number.isFinite(heartbeatFactor) || heartbeatFactor < 1) {
        throw new Error('Chainlink heartbeatFactor must be finite and at least 1');
      }
      const maxAgeSeconds = feed.heartbeatSeconds * heartbeatFactor;
      if (ageSeconds > maxAgeSeconds) {
        throw new Error(
          `Stale Chainlink price for ${feed.symbol}: ${ageSeconds}s old, maximum ${maxAgeSeconds}s`
        );
      }

      const priceUsd = Number(ethers.formatUnits(answer, Number(decimals)));
      if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
        throw new Error(`Invalid normalized Chainlink price for ${feed.symbol}`);
      }

      return {
        symbol: feed.symbol,
        chainId: feed.chainId,
        address: feed.address,
        priceUsd,
        roundId: roundId.toString(),
        updatedAtMs: Number(updatedAt) * 1000,
        observedAtMs: block.timestamp * 1000,
        ageSeconds,
        heartbeatSeconds: feed.heartbeatSeconds,
        decimals: Number(decimals),
      };
    });
  }

  private async assertRpcChain(
    rpc: ethers.JsonRpcProvider,
    feed: ChainlinkFeedConfig
  ): Promise<void> {
    const chainIdHex = await rpc.send('eth_chainId', []);
    const actualChainId = Number(BigInt(chainIdHex));
    if (actualChainId !== feed.chainId) {
      throw new Error(
        `RPC network mismatch for ${feed.symbol}: expected ${feed.chainId}, got ${actualChainId}`
      );
    }
  }
}
