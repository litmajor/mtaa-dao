/**
 * Multi-Chain Provider
 * Abstraction layer for managing RPC connections across all 7 supported chains
 * Handles connection pooling, failover, rate limiting, and retry logic
 */

import { ethers } from 'ethers';
import { Logger } from '../utils/logger';
import { CHAIN_CONFIG, SupportedChain, getRpcUrl, getWsRpcUrl } from '../../shared/chainConfiguration';
import pLimit from 'p-limit';

const logger = new Logger('multi-chain-provider');

interface ProviderStats {
  calls: number;
  errors: number;
  avgResponseTime: number;
  lastUpdated: Date;
}

interface RpcConnection {
  provider: ethers.Provider;
  backup?: ethers.Provider;
  stats: ProviderStats;
  isHealthy: boolean;
  lastHealthCheck: Date;
}

export class MultiChainProvider {
  private connections: Map<SupportedChain, RpcConnection> = new Map();
  private rateLimiters: Map<SupportedChain, ReturnType<typeof pLimit>> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Configuration
  private readonly HEALTH_CHECK_INTERVAL = 30 * 1000; // 30 seconds
  private readonly REQUEST_TIMEOUT = 10 * 1000; // 10 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // ms

  constructor(private network: 'mainnet' | 'testnet' = 'mainnet') {
    this.initialize();
  }

  /**
   * Initialize all chain connections
   */
  private initialize(): void {
    const chains = Object.keys(CHAIN_CONFIG) as SupportedChain[];

    for (const chain of chains) {
      const config = CHAIN_CONFIG[chain];
      const rpcUrl = getRpcUrl(chain, this.network);

      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // Create backup provider if websocket available
        let backup: ethers.Provider | undefined;
        const wsUrl = getWsRpcUrl(chain, this.network);
        if (wsUrl) {
          try {
            backup = new ethers.WebSocketProvider(wsUrl);
          } catch (error) {
            logger.warn(`Failed to create WebSocket provider for ${chain}: ${(error as any).message}`);
          }
        }

        this.connections.set(chain, {
          provider,
          backup,
          stats: {
            calls: 0,
            errors: 0,
            avgResponseTime: 0,
            lastUpdated: new Date()
          },
          isHealthy: true,
          lastHealthCheck: new Date()
        });

        // Create rate limiter (5 concurrent requests per chain)
        this.rateLimiters.set(chain, pLimit(5));

        logger.info(`✅ Initialized ${chain} provider (${config.name})`);
      } catch (error) {
        logger.error(`❌ Failed to initialize ${chain}: ${(error as any).message}`);
      }
    }

    // Start health checks
    this.startHealthChecks();
  }

  /**
   * Get provider for a specific chain
   */
  getProvider(chain: SupportedChain): ethers.Provider {
    const connection = this.connections.get(chain);
    if (!connection) {
      throw new Error(`No provider configured for chain: ${chain}`);
    }

    if (!connection.isHealthy && connection.backup) {
      logger.warn(`⚠️ Primary provider unhealthy for ${chain}, using backup`);
      return connection.backup;
    }

    return connection.provider;
  }

  /**
   * Execute RPC call with retry logic and rate limiting
   */
  async call<T>(
    chain: SupportedChain,
    fn: (provider: ethers.Provider) => Promise<T>,
    operationName: string = 'RPC call'
  ): Promise<T> {
    const limiter = this.rateLimiters.get(chain);
    if (!limiter) {
      throw new Error(`No rate limiter configured for chain: ${chain}`);
    }

    return limiter(async () => {
      const connection = this.connections.get(chain);
      if (!connection) {
        throw new Error(`No provider configured for chain: ${chain}`);
      }

      let lastError: any;
      const startTime = Date.now();

      for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
        try {
          const provider = connection.isHealthy ? connection.provider : connection.backup || connection.provider;

          // Execute with timeout
          const result = await Promise.race([
            fn(provider),
            new Promise<T>((_, reject) =>
              setTimeout(() => reject(new Error(`RPC call timeout after ${this.REQUEST_TIMEOUT}ms`)), this.REQUEST_TIMEOUT)
            )
          ]);

          // Update stats on success
          const responseTime = Date.now() - startTime;
          connection.stats.calls++;
          connection.stats.avgResponseTime = (connection.stats.avgResponseTime + responseTime) / 2;

          return result;
        } catch (error: any) {
          lastError = error;
          connection.stats.errors++;

          if (attempt < this.MAX_RETRIES) {
            const delay = this.RETRY_DELAY * Math.pow(2, attempt - 1);
            logger.warn(
              `${operationName} attempt ${attempt} failed on ${chain}: ${error.message}. Retrying in ${delay}ms...`
            );
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      connection.isHealthy = false;
      throw new Error(`${operationName} failed on ${chain} after ${this.MAX_RETRIES} attempts: ${lastError.message}`);
    });
  }

  /**
   * Get block number from chain
   */
  async getBlockNumber(chain: SupportedChain): Promise<number> {
    return this.call(chain, provider => provider.getBlockNumber(), `Get block number`);
  }

  /**
   * Get balance on chain
   */
  async getBalance(chain: SupportedChain, address: string): Promise<bigint> {
    return this.call(
      chain,
      provider => provider.getBalance(address),
      `Get balance for ${address}`
    );
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(chain: SupportedChain, txHash: string) {
    return this.call(
      chain,
      provider => provider.getTransactionReceipt(txHash),
      `Get tx receipt ${txHash}`
    );
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(
    chain: SupportedChain,
    txHash: string,
    confirmations: number = 1,
    timeout?: number
  ) {
    return this.call(
      chain,
      provider => provider.waitForTransaction(txHash, confirmations, timeout),
      `Wait for tx ${txHash}`
    );
  }

  /**
   * Call contract function (read-only)
   */
  async call_function(
    chain: SupportedChain,
    target: string,
    data: string,
    from?: string
  ): Promise<string> {
    return this.call(
      chain,
      provider => provider.call({ to: target, data, from }),
      `Call function on ${target}`
    );
  }

  /**
   * Estimate gas
   */
  async estimateGas(
    chain: SupportedChain,
    transaction: {
      to?: string;
      from?: string;
      data?: string;
      value?: bigint;
    }
  ): Promise<bigint> {
    return this.call(
      chain,
      provider => provider.estimateGas(transaction),
      `Estimate gas`
    );
  }

  /**
   * Get transaction count (nonce)
   */
  async getTransactionCount(chain: SupportedChain, address: string): Promise<number> {
    return this.call(
      chain,
      provider => provider.getTransactionCount(address),
      `Get nonce for ${address}`
    );
  }

  /**
   * Get fee data
   */
  async getFeeData(chain: SupportedChain) {
    return this.call(
      chain,
      provider => provider.getFeeData(),
      `Get fee data`
    );
  }

  /**
   * Get network info
   */
  async getNetwork(chain: SupportedChain) {
    return this.call(
      chain,
      provider => provider.getNetwork(),
      `Get network info`
    );
  }

  /**
   * Get block
   */
  async getBlock(chain: SupportedChain, blockNumberOrTag: number | string) {
    return this.call(
      chain,
      provider => provider.getBlock(blockNumberOrTag),
      `Get block ${blockNumberOrTag}`
    );
  }

  /**
   * Perform health checks on all chains
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private async performHealthChecks(): Promise<void> {
    const chains = Array.from(this.connections.keys());

    for (const chain of chains) {
      try {
        const blockNumber = await this.getBlockNumber(chain);
        const connection = this.connections.get(chain);
        if (connection) {
          connection.isHealthy = true;
          connection.lastHealthCheck = new Date();
          logger.debug(`✅ Health check passed for ${chain} (block ${blockNumber})`);
        }
      } catch (error) {
        const connection = this.connections.get(chain);
        if (connection) {
          connection.isHealthy = false;
          connection.lastHealthCheck = new Date();
          logger.warn(`⚠️ Health check failed for ${chain}: ${(error as any).message}`);
        }
      }
    }
  }

  /**
   * Get provider statistics
   */
  getStats(chain: SupportedChain): ProviderStats | null {
    return this.connections.get(chain)?.stats || null;
  }

  /**
   * Get all provider statistics
   */
  getAllStats(): Record<SupportedChain, ProviderStats> {
    const stats: Record<string, ProviderStats> = {};
    this.connections.forEach((connection, chain) => {
      stats[chain] = connection.stats;
    });
    return stats as Record<SupportedChain, ProviderStats>;
  }

  /**
   * Get health status of all chains
   */
  getHealthStatus(): Record<SupportedChain, { healthy: boolean; lastCheck: Date }> {
    const status: Record<string, { healthy: boolean; lastCheck: Date }> = {};
    this.connections.forEach((connection, chain) => {
      status[chain] = {
        healthy: connection.isHealthy,
        lastCheck: connection.lastHealthCheck
      };
    });
    return status as Record<SupportedChain, { healthy: boolean; lastCheck: Date }>;
  }

  /**
   * Reconnect a specific chain (useful after network issues)
   */
  async reconnect(chain: SupportedChain): Promise<boolean> {
    try {
      const blockNumber = await this.getBlockNumber(chain);
      const connection = this.connections.get(chain);
      if (connection) {
        connection.isHealthy = true;
        connection.lastHealthCheck = new Date();
        logger.info(`✅ Reconnected to ${chain} (block ${blockNumber})`);
        return true;
      }
    } catch (error) {
      logger.error(`❌ Failed to reconnect to ${chain}: ${(error as any).message}`);
    }
    return false;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.connections.forEach(connection => {
      // Close WebSocket connections if applicable
      if (connection.backup instanceof ethers.WebSocketProvider) {
        connection.backup.destroy();
      }
    });

    this.connections.clear();
    this.rateLimiters.clear();
    logger.info('🧹 MultiChainProvider destroyed');
  }
}

/**
 * Singleton instance for application-wide use
 */
let instance: MultiChainProvider | null = null;

export function initializeMultiChainProvider(network: 'mainnet' | 'testnet' = 'mainnet'): MultiChainProvider {
  if (!instance) {
    instance = new MultiChainProvider(network);
  }
  return instance;
}

export function getMultiChainProvider(): MultiChainProvider {
  if (!instance) {
    throw new Error('MultiChainProvider not initialized. Call initializeMultiChainProvider first.');
  }
  return instance;
}

export function destroyMultiChainProvider(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
