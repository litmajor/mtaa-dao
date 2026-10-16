/**
 * MultiChainProvider (Production)
 *
 * Resilient multi-chain EVM RPC manager.
 *
 * Features
 * ─────────────────────────────────────────────────────────────
 * • Lazy ethers load + deferred providers (Proxy forwards every method)
 * • Per-chain concurrency limit (p-limit)
 * • Timeout, retry with exponential backoff + jitter
 * • Primary → secondary HTTP failover
 * • Circuit breaker with half-open recovery
 * • Background health checks
 * • Stats (calls, errors, latency EMA)
 * • Clean destroy that nulls the singleton
 *
 * Env (all optional – sensible defaults)
 * ─────────────────────────────────────────────────────────────
 *   RPC_URL_ETHEREUM=https://...
 *   RPC_URL_ETHEREUM_BACKUP=https://...
 *   RPC_URL_POLYGON=...
 *   ... (same pattern for arbitrum, optimism, base, avalanche, bsc)
 *   MCP_CONCURRENCY=5
 *   MCP_TIMEOUT_MS=10000
 *   MCP_MAX_RETRIES=3
 *   MCP_HEALTH_INTERVAL_MS=30000
 *   MCP_CIRCUIT_FAILURE_THRESHOLD=5
 *   MCP_CIRCUIT_HALF_OPEN_MS=60000
 */

import pLimit from 'p-limit';
import type {
  Block,
  BlockTag,
  FeeData,
  Provider,
  TransactionReceipt,
  Networkish,
} from 'ethers';
import type * as EthersType from 'ethers';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────────────────────
// Types & config
// ─────────────────────────────────────────────────────────────

export type SupportedChain =
  | 'ethereum'
  | 'polygon'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'avalanche'
  | 'bsc';

export const CHAIN_CONFIG: Record<
  SupportedChain,
  { name: string; chainId: { mainnet: number; testnet: number } }
> = {
  ethereum: { name: 'Ethereum', chainId: { mainnet: 1, testnet: 11155111 } },
  polygon: { name: 'Polygon', chainId: { mainnet: 137, testnet: 80002 } },
  arbitrum: { name: 'Arbitrum One', chainId: { mainnet: 42161, testnet: 421614 } },
  optimism: { name: 'OP Mainnet', chainId: { mainnet: 10, testnet: 11155420 } },
  base: { name: 'Base', chainId: { mainnet: 8453, testnet: 84532 } },
  avalanche: { name: 'Avalanche C-Chain', chainId: { mainnet: 43114, testnet: 43113 } },
  bsc: { name: 'BNB Smart Chain', chainId: { mainnet: 56, testnet: 97 } },
};

type NetworkMode = 'mainnet' | 'testnet';

interface ProviderStats {
  calls: number;
  errors: number;
  avgResponseTimeMs: number;
  lastUpdated: Date;
  circuitState: CircuitState;
}

type CircuitState = 'closed' | 'open' | 'half-open';

interface EndpointState {
  url: string;
  provider: Provider; // fully resolved Proxy-wrapped DeferredProvider
  healthy: boolean;
  consecutiveFailures: number;
  circuit: CircuitState;
  lastFailureAt: number;
  stats: ProviderStats;
}

interface ChainConnection {
  primary: EndpointState;
  secondary?: EndpointState;
  lastHealthCheck: Date;
}

export class RpcError extends Error {
  constructor(
    message: string,
    public readonly chain: SupportedChain,
    public readonly operation: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

// ─────────────────────────────────────────────────────────────
// Env helpers
// ─────────────────────────────────────────────────────────────

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Resolve primary + optional backup HTTP URLs for a chain.
 * Convention: RPC_URL_<CHAIN> and RPC_URL_<CHAIN>_BACKUP
 */
function resolveRpcUrls(
  chain: SupportedChain,
  network: NetworkMode
): { primary: string; secondary?: string } {
  const key = chain.toUpperCase();
  const primary =
    process.env[`RPC_URL_${key}`] ||
    process.env[`RPC_URL_${key}_${network.toUpperCase()}`];

  if (!primary) {
    throw new Error(
      `Missing RPC URL for ${chain}. Set RPC_URL_${key} (or RPC_URL_${key}_${network.toUpperCase()})`
    );
  }

  const secondary =
    process.env[`RPC_URL_${key}_BACKUP`] ||
    process.env[`RPC_URL_${key}_${network.toUpperCase()}_BACKUP`];

  return { primary, secondary: secondary || undefined };
}

// ─────────────────────────────────────────────────────────────
// Deferred Provider (full Proxy)
// ─────────────────────────────────────────────────────────────

/**
 * Lazily constructs the real ethers Provider on first method access.
 * Single-flight: concurrent callers share the same construction promise.
 * The returned object is a Proxy that forwards every property/method.
 */
function createDeferredProvider(
  factory: () => Promise<Provider>
): Provider {
  let real: Provider | undefined;
  let pending: Promise<Provider> | null = null;

  const ensure = (): Promise<Provider> => {
    if (real) return Promise.resolve(real);
    if (pending) return pending;
    pending = factory()
      .then((p) => {
        real = p;
        pending = null;
        return p;
      })
      .catch((err) => {
        pending = null;
        throw err;
      });
    return pending;
  };

  // Proxy so *all* Provider methods work, not just a hard-coded subset
  return new Proxy({} as Provider, {
    get(_target, prop, _receiver) {
      if (prop === 'then') return undefined; // not a thenable

      // Special lifecycle helpers used by MultiChainProvider
      if (prop === 'destroy') {
        return async () => {
          if (real && typeof (real as any).destroy === 'function') {
            await (real as any).destroy();
          }
          real = undefined;
        };
      }
      if (prop === 'removeAllListeners') {
        return () => {
          if (real && typeof (real as any).removeAllListeners === 'function') {
            (real as any).removeAllListeners();
          }
        };
      }

      return (...args: unknown[]) =>
        ensure().then((provider) => {
          const value = (provider as any)[prop];
          if (typeof value === 'function') {
            return value.apply(provider, args);
          }
          return value;
        });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// MultiChainProvider
// ─────────────────────────────────────────────────────────────

export class MultiChainProvider {
  private connections = new Map<SupportedChain, ChainConnection>();
  private rateLimiters = new Map<SupportedChain, ReturnType<typeof pLimit>>();
  private healthTimer: NodeJS.Timeout | null = null;
  private ethersModule: typeof EthersType | null = null;
  private destroyed = false;

  private readonly concurrency: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly healthIntervalMs: number;
  private readonly failureThreshold: number;
  private readonly halfOpenMs: number;

  constructor(private readonly network: NetworkMode = 'mainnet') {
    this.concurrency = envInt('MCP_CONCURRENCY', 5);
    this.timeoutMs = envInt('MCP_TIMEOUT_MS', 10_000);
    this.maxRetries = envInt('MCP_MAX_RETRIES', 3);
    this.healthIntervalMs = envInt('MCP_HEALTH_INTERVAL_MS', 30_000);
    this.failureThreshold = envInt('MCP_CIRCUIT_FAILURE_THRESHOLD', 5);
    this.halfOpenMs = envInt('MCP_CIRCUIT_HALF_OPEN_MS', 60_000);

    this.initialize();
  }

  // ── bootstrap ──────────────────────────────────────────────

  private initialize(): void {
    const chains = Object.keys(CHAIN_CONFIG) as SupportedChain[];

    for (const chain of chains) {
      try {
        const urls = resolveRpcUrls(chain, this.network);
        const chainId =
          CHAIN_CONFIG[chain].chainId[this.network];

        const primary = this.buildEndpoint(urls.primary, chainId);
        const secondary = urls.secondary
          ? this.buildEndpoint(urls.secondary, chainId)
          : undefined;

        this.connections.set(chain, {
          primary,
          secondary,
          lastHealthCheck: new Date(0),
        });
        this.rateLimiters.set(chain, pLimit(this.concurrency));

        logger.info('Chain provider configured', {
          chain,
          primary: this.redactUrl(urls.primary),
          secondary: urls.secondary ? this.redactUrl(urls.secondary) : null,
        });
      } catch (err) {
        logger.warn('Skipping chain – missing RPC config', {
          chain,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.startHealthChecks();
    // Fire-and-forget pre-warm
    this.prewarm().catch(() => {});
  }

  private buildEndpoint(url: string, chainId: number): EndpointState {
    const provider = createDeferredProvider(async () => {
      const ethers = await this.loadEthers();
      return new ethers.JsonRpcProvider(url, chainId as Networkish, {
        staticNetwork: true,
      });
    });

    return {
      url,
      provider,
      healthy: true,
      consecutiveFailures: 0,
      circuit: 'closed',
      lastFailureAt: 0,
      stats: {
        calls: 0,
        errors: 0,
        avgResponseTimeMs: 0,
        lastUpdated: new Date(),
        circuitState: 'closed',
      },
    };
  }

  private async loadEthers(): Promise<typeof EthersType> {
    if (!this.ethersModule) {
      this.ethersModule = await import('ethers');
    }
    return this.ethersModule;
  }

  private async prewarm(): Promise<void> {
    const tasks: Promise<unknown>[] = [];
    for (const conn of this.connections.values()) {
      tasks.push(
        (conn.primary.provider as any).getBlockNumber?.().catch(() => {})
      );
      if (conn.secondary) {
        tasks.push(
          (conn.secondary.provider as any).getBlockNumber?.().catch(() => {})
        );
      }
    }
    await Promise.allSettled(tasks);
  }

  // ── circuit breaker ────────────────────────────────────────

  private allowRequest(ep: EndpointState): boolean {
    if (ep.circuit === 'closed') return true;
    if (ep.circuit === 'open') {
      if (Date.now() - ep.lastFailureAt >= this.halfOpenMs) {
        ep.circuit = 'half-open';
        ep.stats.circuitState = 'half-open';
        return true; // single probe
      }
      return false;
    }
    // half-open: allow the probe
    return true;
  }

  private recordSuccess(ep: EndpointState, responseTimeMs: number): void {
    ep.consecutiveFailures = 0;
    ep.healthy = true;
    if (ep.circuit !== 'closed') {
      ep.circuit = 'closed';
      ep.stats.circuitState = 'closed';
      logger.info('Circuit closed (recovered)', { url: this.redactUrl(ep.url) });
    }
    ep.stats.calls += 1;
    ep.stats.avgResponseTimeMs =
      ep.stats.avgResponseTimeMs === 0
        ? responseTimeMs
        : ep.stats.avgResponseTimeMs * 0.9 + responseTimeMs * 0.1;
    ep.stats.lastUpdated = new Date();
  }

  private recordFailure(ep: EndpointState): void {
    ep.consecutiveFailures += 1;
    ep.stats.errors += 1;
    ep.stats.lastUpdated = new Date();
    ep.lastFailureAt = Date.now();

    if (ep.consecutiveFailures >= this.failureThreshold) {
      ep.circuit = 'open';
      ep.healthy = false;
      ep.stats.circuitState = 'open';
      logger.error('Circuit opened', {
        url: this.redactUrl(ep.url),
        failures: ep.consecutiveFailures,
      });
    }
  }

  // ── core call ──────────────────────────────────────────────

  /**
   * Execute an RPC operation with rate-limit, timeout, retry, and failover.
   */
  async call<T>(
    chain: SupportedChain,
    fn: (provider: Provider) => Promise<T>,
    operationName = 'RPC Call'
  ): Promise<T> {
    if (this.destroyed) {
      throw new RpcError('Provider has been destroyed', chain, operationName);
    }

    const conn = this.connections.get(chain);
    const limiter = this.rateLimiters.get(chain);
    if (!conn || !limiter) {
      throw new RpcError(`No provider configured for chain`, chain, operationName);
    }

    const endpoints = [conn.primary, conn.secondary].filter(
      (e): e is EndpointState => !!e
    );

    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      // Prefer healthy endpoint; fall back to any that allows a request
      const ep =
        endpoints.find((e) => e.healthy && this.allowRequest(e)) ||
        endpoints.find((e) => this.allowRequest(e));

      if (!ep) {
        lastError = new Error('All endpoints circuit-open');
        break;
      }

      const start = Date.now();
      try {
        const result = await limiter(() =>
          Promise.race([
            fn(ep.provider),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`Timeout after ${this.timeoutMs}ms`)),
                this.timeoutMs
              )
            ),
          ])
        );

        this.recordSuccess(ep, Date.now() - start);
        return result;
      } catch (err) {
        lastError = err;
        this.recordFailure(ep);
        logger.warn('RPC attempt failed', {
          chain,
          operation: operationName,
          attempt,
          maxRetries: this.maxRetries,
          endpoint: this.redactUrl(ep.url),
          error: err instanceof Error ? err.message : String(err),
        });

        if (attempt < this.maxRetries) {
          const delay =
            250 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw new RpcError(
      `${operationName} failed after ${this.maxRetries} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
      chain,
      operationName,
      lastError
    );
  }

  // ── convenience wrappers ───────────────────────────────────

  getBlockNumber(chain: SupportedChain): Promise<number> {
    return this.call(chain, (p) => p.getBlockNumber(), 'getBlockNumber');
  }

  getBalance(chain: SupportedChain, address: string): Promise<bigint> {
    return this.call(
      chain,
      (p) => p.getBalance(address),
      `getBalance[${address}]`
    );
  }

  getFeeData(chain: SupportedChain): Promise<FeeData> {
    return this.call(chain, (p) => p.getFeeData(), 'getFeeData');
  }

  getBlock(chain: SupportedChain, blockTag: BlockTag): Promise<Block | null> {
    return this.call(chain, (p) => p.getBlock(blockTag), `getBlock[${blockTag}]`);
  }

  getTransactionReceipt(
    chain: SupportedChain,
    txHash: string
  ): Promise<TransactionReceipt | null> {
    return this.call(
      chain,
      (p) => p.getTransactionReceipt(txHash),
      `getTransactionReceipt[${txHash}]`
    );
  }

  /**
   * Return the currently preferred provider for advanced callers.
   * Prefer using `call()` so retries/failover still apply.
   */
  getProvider(chain: SupportedChain): Provider {
    const conn = this.connections.get(chain);
    if (!conn) throw new RpcError('No provider configured', chain, 'getProvider');
    if (conn.primary.healthy && this.allowRequest(conn.primary)) {
      return conn.primary.provider;
    }
    if (conn.secondary && this.allowRequest(conn.secondary)) {
      return conn.secondary.provider;
    }
    return conn.primary.provider; // last resort
  }

  // ── health ─────────────────────────────────────────────────

  private startHealthChecks(): void {
    this.healthTimer = setInterval(() => {
      this.performHealthChecks().catch((err) =>
        logger.error('Health check loop error', {
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }, this.healthIntervalMs);
    // allow process to exit even if timer is pending
    if (this.healthTimer.unref) this.healthTimer.unref();
  }

  private async performHealthChecks(): Promise<void> {
    for (const [chain, conn] of this.connections) {
      conn.lastHealthCheck = new Date();
      await this.probeEndpoint(chain, conn.primary);
      if (conn.secondary) {
        await this.probeEndpoint(chain, conn.secondary);
      }
    }
  }

  private async probeEndpoint(
    chain: SupportedChain,
    ep: EndpointState
  ): Promise<void> {
    // Don't probe an open circuit until half-open window
    if (ep.circuit === 'open' && !this.allowRequest(ep)) return;

    try {
      await Promise.race([
        (ep.provider as any).getBlockNumber(),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('health timeout')), 4_000)
        ),
      ]);
      this.recordSuccess(ep, 0);
    } catch {
      this.recordFailure(ep);
      logger.warn('Health probe failed', {
        chain,
        endpoint: this.redactUrl(ep.url),
      });
    }
  }

  // ── reconnect / destroy ────────────────────────────────────

  async reconnect(chain: SupportedChain): Promise<boolean> {
    const conn = this.connections.get(chain);
    if (!conn) return false;

    logger.info('Forcing reconnect', { chain });

    try {
      await (conn.primary.provider as any).destroy?.();
      if (conn.secondary) {
        await (conn.secondary.provider as any).destroy?.();
      }
    } catch {
      /* ignore teardown errors */
    }

    try {
      const urls = resolveRpcUrls(chain, this.network);
      const chainId = CHAIN_CONFIG[chain].chainId[this.network];
      conn.primary = this.buildEndpoint(urls.primary, chainId);
      conn.secondary = urls.secondary
        ? this.buildEndpoint(urls.secondary, chainId)
        : undefined;

      await (conn.primary.provider as any).getBlockNumber();
      conn.primary.healthy = true;
      conn.primary.circuit = 'closed';
      logger.info('Reconnect succeeded', { chain });
      return true;
    } catch (err) {
      logger.error('Reconnect failed', {
        chain,
        error: err instanceof Error ? err.message : String(err),
      });
      conn.primary.healthy = false;
      return false;
    }
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }

    for (const [chain, conn] of this.connections) {
      try {
        (conn.primary.provider as any).removeAllListeners?.();
        await (conn.primary.provider as any).destroy?.();
        if (conn.secondary) {
          (conn.secondary.provider as any).removeAllListeners?.();
          await (conn.secondary.provider as any).destroy?.();
        }
      } catch (err) {
        logger.error('Cleanup error', {
          chain,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.connections.clear();
    this.rateLimiters.clear();
    instance = null;
    logger.info('MultiChainProvider destroyed');
  }

  // ── observability ──────────────────────────────────────────

  getStats(chain?: SupportedChain): Record<string, ProviderStats | { primary: ProviderStats; secondary?: ProviderStats }> {
    if (chain) {
      const conn = this.connections.get(chain);
      if (!conn) return {};
      return {
        [chain]: {
          primary: { ...conn.primary.stats },
          secondary: conn.secondary ? { ...conn.secondary.stats } : undefined,
        },
      };
    }

    const out: Record<string, { primary: ProviderStats; secondary?: ProviderStats }> = {};
    for (const [c, conn] of this.connections) {
      out[c] = {
        primary: { ...conn.primary.stats },
        secondary: conn.secondary ? { ...conn.secondary.stats } : undefined,
      };
    }
    return out;
  }

  listConfiguredChains(): SupportedChain[] {
    return Array.from(this.connections.keys());
  }

  private redactUrl(url: string): string {
    try {
      const u = new URL(url);
      if (u.username) u.username = '***';
      if (u.password) u.password = '***';
      // strip API keys in path/query commonly used by providers
      return u.toString().replace(/\/[a-f0-9]{20,}/gi, '/***');
    } catch {
      return '***';
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton helpers
// ─────────────────────────────────────────────────────────────

let instance: MultiChainProvider | null = null;

export function initializeMultiChainProvider(
  network: NetworkMode = 'mainnet'
): MultiChainProvider {
  if (!instance) {
    instance = new MultiChainProvider(network);
  }
  return instance;
}

export function getMultiChainProvider(): MultiChainProvider {
  if (!instance) {
    throw new Error(
      'MultiChainProvider not initialized. Call initializeMultiChainProvider() first.'
    );
  }
  return instance;
}