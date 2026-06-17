import pLimit from 'p-limit';
import type { Provider } from 'ethers';

// Mocked structural interfaces based on provided boilerplate patterns
export type SupportedChain = 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base' | 'avalanche' | 'bsc';

export const CHAIN_CONFIG: Record<SupportedChain, { name: string }> = {
  ethereum: { name: 'Ethereum Mainnet' },
  polygon: { name: 'Polygon PoS' },
  arbitrum: { name: 'Arbitrum One' },
  optimism: { name: 'OP Mainnet' },
  base: { name: 'Base' },
  avalanche: { name: 'Avalanche C-Chain' },
  bsc: { name: 'BNB Smart Chain' }
};

export function getRpcUrl(chain: SupportedChain, network: string): string {
  return `https://mock-rpc.gateway.io/${network}/${chain}`;
}
export function getWsRpcUrl(chain: SupportedChain, network: string): string | null {
  return `wss://mock-rpc.gateway.io/${network}/${chain}/ws`;
}

// Internal standard logging layout stub
const logger = {
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
  warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta || ''),
  error: (msg: string, meta?: any) => console.error(`[ERROR] ${msg}`, meta || ''),
  debug: (msg: string, meta?: any) => console.debug(`[DEBUG] ${msg}`, meta || '')
};

interface ProviderStats {
  calls: number;
  errors: number;
  avgResponseTime: number;
  lastUpdated: Date;
}

interface RpcConnection {
  // providers are lazily instantiated; use the minimal runtime `Provider` shape
  provider: Provider | DeferredProvider<Provider>;
  backup?: Provider | DeferredProvider<Provider>;
  stats: ProviderStats;
  isPrimaryHealthy: boolean;
  isBackupHealthy: boolean;
  lastHealthCheck: Date;
}

/**
 * Lightweight deferred provider that lazily instantiates the real provider
 * when a method is first invoked. This lets the module avoid loading heavy
 * crypto/WASM dependencies at startup while preserving a synchronous API.
 */
class DeferredProvider<T extends Provider> {
  private real?: T;
  constructor(private getter: () => Promise<T>) {}

  private async ensure(): Promise<T> {
    if (!this.real) this.real = await this.getter();
    return this.real;
  }

  async getBlockNumber(): Promise<number> {
    return (await this.ensure()).getBlockNumber();
  }

  async getBalance(address: string): Promise<bigint> {
    // some Provider implementations use BigNumber — but in our codebase
    // callers expect bigint; keep the underlying return as-is and let
    // callers coerce if necessary.
    // @ts-ignore
    return (await this.ensure()).getBalance(address);
  }

  removeAllListeners(): void {
    if (this.real && typeof (this.real as any).removeAllListeners === 'function') {
      (this.real as any).removeAllListeners();
    }
  }

  async destroy(): Promise<void> {
    if (this.real && typeof (this.real as any).destroy === 'function') {
      await (this.real as any).destroy();
    }
  }
}

export class MultiChainProvider {
  private connections: Map<SupportedChain, RpcConnection> = new Map();
  private rateLimiters: Map<SupportedChain, ReturnType<typeof pLimit>> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private ethersModule?: typeof import('ethers');
  private prewarmPromise: Promise<void> | null = null;

  private readonly HEALTH_CHECK_INTERVAL = 30 * 1000;
  private readonly REQUEST_TIMEOUT = 10 * 1000;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;

  constructor(private readonly network: 'mainnet' | 'testnet' = 'mainnet') {
    this.initialize();
  }

  private initialize(): void {
    const chains = Object.keys(CHAIN_CONFIG) as SupportedChain[];

    for (const chain of chains) {
      const rpcUrl = getRpcUrl(chain, this.network);
      const wsUrl = getWsRpcUrl(chain, this.network);

      try {
        // Create deferred providers that will instantiate `ethers` on first use.
        const providerDeferred = new DeferredProvider(async () => {
          if (!this.ethersModule) {
            this.ethersModule = await import('ethers');
          }
          // @ts-ignore - use runtime constructor
          return new this.ethersModule.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true }) as Provider;
        });

        let backupDeferred: DeferredProvider<Provider> | undefined;
        if (wsUrl) {
          backupDeferred = new DeferredProvider(async () => {
            if (!this.ethersModule) this.ethersModule = await import('ethers');
            // @ts-ignore
            return new this.ethersModule.WebSocketProvider(wsUrl) as Provider;
          });
        }

        this.connections.set(chain, {
          provider: providerDeferred,
          backup: backupDeferred,
          stats: { calls: 0, errors: 0, avgResponseTime: 0, lastUpdated: new Date() },
          isPrimaryHealthy: true,
          isBackupHealthy: !!backupDeferred,
          lastHealthCheck: new Date()
        });

        this.rateLimiters.set(chain, pLimit(5));
        logger.info(`✅ Initialized ${chain} provider tier layouts.`);
      } catch (error: any) {
        logger.error(`❌ Total breakdown creating provider layouts for ${chain}: ${error.message}`);
      }
    }

    // Start background health checks and pre-warm providers asynchronously
    this.startHealthChecks();
    this.prewarmPromise = this.prewarmProviders();
  }

  private async prewarmProviders(): Promise<void> {
    // Trigger underlying provider construction in the background to avoid
    // incurring the dynamic import cost at the first live request.
    const prewarmTasks: Promise<any>[] = [];
    for (const [chain, conn] of this.connections.entries()) {
      const providerDeferred = conn.provider as DeferredProvider<Provider>;
      if (providerDeferred && typeof providerDeferred['ensure'] === 'function') {
        // call a light path (getBlockNumber) to force initialization
        prewarmTasks.push((providerDeferred as any).getBlockNumber().catch(() => {}));
      }
      if (conn.backup) {
        const backupDeferred = conn.backup as DeferredProvider<Provider>;
        if (backupDeferred && typeof backupDeferred['ensure'] === 'function') {
          prewarmTasks.push((backupDeferred as any).getBlockNumber().catch(() => {}));
        }
      }
    }

    await Promise.allSettled(prewarmTasks);
  }

  private async ensureEthersLoaded(): Promise<void> {
    if (!this.ethersModule) {
      this.ethersModule = await import('ethers');
    }
  }

  /**
   * Route execution contexts dynamically based on specific infrastructure health tracking
   */
  public getProvider(chain: SupportedChain): Provider | DeferredProvider<Provider> {
    const connection = this.connections.get(chain);
    if (!connection) {
      throw new Error(`No provider configured for chain: ${chain}`);
    }

    if (!connection.isPrimaryHealthy && connection.isBackupHealthy && connection.backup) {
      return connection.backup;
    }

    return connection.provider;
  }

  /**
   * Execute isolated wrapper requests with decentralized queue processing and isolated retries
   */
  async call<T>(
    chain: SupportedChain,
    fn: (provider: Provider) => Promise<T>,
    operationName: string = 'RPC Call'
  ): Promise<T> {
    const limiter = this.rateLimiters.get(chain);
    const connection = this.connections.get(chain);

    if (!limiter || !connection) {
      throw new Error(`Missing execution configurations mapping on chain: ${chain}`);
    }

    let lastError: any;
    // start with the primary provider as a definite fallback
    let activeProvider: Provider = connection.provider as Provider;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      const startTime = Date.now();
      
      // Select the current operational provider instance
      activeProvider = (!connection.isPrimaryHealthy && connection.backup && connection.isBackupHealthy)
        ? connection.backup as Provider
        : connection.provider as Provider;

      try {
        // Rate-limit exclusively the actual JSON-RPC transport frame call execution
        const result = await limiter(() => {
          return Promise.race([
            // `activeProvider` may be a DeferredProvider; cast to Provider for callers
            fn(activeProvider as unknown as Provider),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout exceeding ${this.REQUEST_TIMEOUT}ms`)), this.REQUEST_TIMEOUT)
            )
          ]);
        });

        // Track running average stats
        const responseTime = Date.now() - startTime;
        connection.stats.calls++;
        connection.stats.avgResponseTime = connection.stats.avgResponseTime === 0 
          ? responseTime 
          : (connection.stats.avgResponseTime * 0.9) + (responseTime * 0.1); // Exponential moving average
        connection.stats.lastUpdated = new Date();

        return result;
      } catch (error: any) {
        lastError = error;
        connection.stats.errors++;

        logger.warn(`[ATTEMPT ${attempt}/${this.MAX_RETRIES} FAILED] ${operationName} on ${chain}. Error: ${error.message}`);

        if (attempt < this.MAX_RETRIES) {
          // Jittered backoff to break up concurrent request bursts
          const backoffDelay = (this.RETRY_DELAY * Math.pow(2, attempt - 1)) + (Math.random() * 200);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }
      }
    }

    // Trip circuit flags if processing runs out of available retry slots
    if (connection.isPrimaryHealthy && activeProvider === connection.provider) {
      connection.isPrimaryHealthy = false;
      logger.error(`[CIRCUIT TRIPPED] Primary RPC node designated offline for: ${chain}`);
    } else if (connection.isBackupHealthy && activeProvider === connection.backup) {
      connection.isBackupHealthy = false;
      logger.error(`[CIRCUIT TRIPPED] Backup WS RPC node designated offline for: ${chain}`);
    }

    throw new Error(`${operationName} failed on ${chain} after ${this.MAX_RETRIES} executions. Source: ${lastError.message}`);
  }

  /* ════════════════════════════════════════════════════════════════════════════════ */
  /* PROXY INTERFACE METHODS
  /* ════════════════════════════════════════════════════════════════════════════════ */

  async getBlockNumber(chain: SupportedChain): Promise<number> {
    return this.call(chain, (p) => p.getBlockNumber(), 'getBlockNumber');
  }

  async getBalance(chain: SupportedChain, address: string): Promise<bigint> {
    return this.call(chain, (p) => p.getBalance(address), `getBalance [${address}]`);
  }

  /* ════════════════════════════════════════════════════════════════════════════════ */
  /* SYSTEM AUDITING & HEALTH MANAGEMENT (Memory and Loop Corrections)
  /* ════════════════════════════════════════════════════════════════════════════════ */

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks().catch((err) => logger.error('Fatal crash inside health monitor thread root', err));
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Evaluates RPC connectivity directly via underlying drivers.
   * Bypasses the active 'this.call' wrapper to avoid circular dependency state updates.
   */
  private async performHealthChecks(): Promise<void> {
    for (const [chain, connection] of this.connections.entries()) {
      connection.lastHealthCheck = new Date();

      // 1. Audit Primary Http Endpoint
      try {
        await Promise.race([
          connection.provider.getBlockNumber(),
          new Promise<never>((_, r) => setTimeout(() => r(new Error('Health Check Timeout')), 4000))
        ]);
        if (!connection.isPrimaryHealthy) {
          logger.info(`[RECOVERY] Primary HTTP RPC endpoint for ${chain} back online.`);
        }
        connection.isPrimaryHealthy = true;
      } catch {
        connection.isPrimaryHealthy = false;
        logger.warn(`[HEALTH FAIL] Primary HTTP RPC node for ${chain} is unresponsive.`);
      }

      // 2. Audit Secondary WS Endpoint
      if (connection.backup) {
        try {
          await Promise.race([
            connection.backup.getBlockNumber(),
            new Promise<never>((_, r) => setTimeout(() => r(new Error('Health Check Timeout')), 4000))
          ]);
          connection.isBackupHealthy = true;
        } catch {
          connection.isBackupHealthy = false;
          logger.warn(`[HEALTH FAIL] Backup WebSocket RPC node for ${chain} is unresponsive.`);
        }
      }
    }
  }

  /**
   * Secure manual recovery action that disposes of lingering socket processes before spinning up new ones.
   */
  async reconnect(chain: SupportedChain): Promise<boolean> {
    const connection = this.connections.get(chain);
    if (!connection) return false;

    logger.info(`[RECONNECTING] Forcing socket teardown sequence on chain context: ${chain}`);

    try {
      // 1. Cleanly unbind and close the old backup WebSocket connection to prevent memory leaks

      if (connection.backup) {
        try {
          await (connection.backup as any).destroy();
        } catch {}
        connection.backup = undefined;
      }

      // 2. Clear old HTTP listener states
      try {
        (connection.provider as any).removeAllListeners();
      } catch {}

      // 3. Re-instantiate provider structures
      const rpcUrl = getRpcUrl(chain, this.network);
      const wsUrl = getWsRpcUrl(chain, this.network);

      await this.ensureEthersLoaded();
      // @ts-ignore - runtime instantiation using dynamically loaded module
      connection.provider = new (this.ethersModule as any).JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
      if (wsUrl) {
        // @ts-ignore
        connection.backup = new (this.ethersModule as any).WebSocketProvider(wsUrl);
      }

      // 4. Test connection health immediately
      await connection.provider.getBlockNumber();
      connection.isPrimaryHealthy = true;
      if (connection.backup) connection.isBackupHealthy = true;

      logger.info(`[RECONNECTED SUCCESS] Instantiation metrics verified online for: ${chain}`);
      return true;
    } catch (error: any) {
      logger.error(`[RECONNECT CRITICAL FAILURE] Unable to reclaim handles on ${chain}: ${error.message}`);
      connection.isPrimaryHealthy = false;
      return false;
    }
  }

  /**
   * Complete teardown routine to clean up intervals and network resources on module termination.
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    for (const [chain, connection] of this.connections.entries()) {
      try {
        try {
          (connection.provider as any).removeAllListeners();
        } catch {}
        if (connection.backup) {
          try { (connection.backup as any).destroy(); } catch {}
        }
      } catch (err: any) {
        logger.error(`Error cleaning up resources for ${chain}: ${err.message}`);
      }
    }

    this.connections.clear();
    this.rateLimiters.clear();
    logger.info('🧹 MultiChainProvider destroyed successfully.');
  }
}

// Global Singleton Management
let instance: MultiChainProvider | null = null;

export function initializeMultiChainProvider(network: 'mainnet' | 'testnet' = 'mainnet'): MultiChainProvider {
  if (!instance) instance = new MultiChainProvider(network);
  return instance;
}

export function getMultiChainProvider(): MultiChainProvider {
  if (!instance) throw new Error('MultiChainProvider not initialized.');
  return instance;
}