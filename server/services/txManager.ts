import { pool } from '../db';
import { getMultiChainProvider } from './multiChainProvider';
import { gasPriceOracle } from './gasPriceOracle';
import { Logger } from '../utils/logger';
import type { Signer, Provider, TransactionRequest, TransactionResponse, TransactionReceipt } from 'ethers';
import { redis as sharedRedis } from './redis';

const logger = Logger.getLogger();

type SupportedChain = 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base' | 'avalanche' | 'bsc';

type RawSigner = Signer & {
  signTransaction?: (tx: TransactionRequest) => Promise<string>;
  connect?: (provider: Provider) => Signer;
};

/**
 * TransactionLifecycleManager
 * - DB-backed nonce sequencing (creates table on-demand)
 * - Broadcast + monitor with bump-and-replace on timeouts
 */
export class TransactionLifecycleManager {
  private readonly WATCHDOG_MS = 60_000; // wait 60s before considering tx stuck

  constructor() {}

  async ensureNonceTable(): Promise<void> {
    // create simple table if missing — safe to call repeatedly
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_nonces (
        id SERIAL PRIMARY KEY,
        address VARCHAR(255) NOT NULL,
        chain VARCHAR(50) NOT NULL,
        next_nonce BIGINT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(address, chain)
      )
    `);
  }

  /**
   * Atomically reserve the next nonce for an (address, chain) pair.
   */
  async getNextNonce(address: string, chain: SupportedChain): Promise<number> {
    await this.ensureNonceTable();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Try to select for update
      const selectRes = await client.query(
        `SELECT next_nonce FROM wallet_nonces WHERE address = $1 AND chain = $2 FOR UPDATE`,
        [address, chain]
      );

      const rowCount = selectRes.rowCount ?? 0;
      if (rowCount > 0) {
        const nextNonceRaw = selectRes.rows[0].next_nonce as string | number;
        const nextNonce = BigInt(nextNonceRaw);
        const useNonce = Number(nextNonce);

        // increment stored next_nonce
        await client.query(`UPDATE wallet_nonces SET next_nonce = $1, updated_at = NOW() WHERE address = $2 AND chain = $3`, [useNonce + 1, address, chain]);

        await client.query('COMMIT');
        return useNonce;
      }

      // If no row, fetch on-chain pending nonce and insert next_nonce = onChain + 1
      const onchain = await getMultiChainProvider().call<number>(chain, (p: Provider) => p.getTransactionCount(address, 'pending'), 'getTransactionCount');
      const onchainNum = Number(onchain);

      await client.query(`INSERT INTO wallet_nonces(address, chain, next_nonce, updated_at) VALUES ($1, $2, $3, NOW())`, [address, chain, onchainNum + 1]);

      await client.query('COMMIT');
      return onchainNum;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (e) {}
      logger.error('getNextNonce failed', err);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Broadcast a transaction ensuring nonce ordering and automatic replacement if stuck.
   * signer: an ethers.Wallet-like object with `signTransaction` or `sendTransaction`.
   */
  async broadcastTransaction(
    chain: SupportedChain,
    signer: RawSigner,
    txRequest: TransactionRequest,
    opts?: { bumpPct?: number }
  ): Promise<TransactionResponse> {
    const address = (signer as any).address || (await signer.getAddress());
    const nonce = await this.getNextNonce(address, chain);

    const provider = getMultiChainProvider().getProvider(chain);
    const feeData = await gasPriceOracle.getOptimalGasStrategy(provider, chain, 'fast');

    const tx: TransactionRequest = {
      ...txRequest,
      nonce,
      ...feeData
    };

    // Ensure chainId is present when signing
    try {
      const network = await getMultiChainProvider().call<{ chainId?: bigint }>(chain, (p: Provider) => p.getNetwork(), 'getNetwork');
      if (!tx.chainId && network?.chainId) tx.chainId = Number(network.chainId);
    } catch (e: unknown) {
      const errMsg = (e as Error)?.message ?? String(e ?? 'unknown');
      logger.warn('Could not read network chainId before signing', errMsg);
    }

    let signedTx: string;
    if (typeof signer.signTransaction === 'function') {
      signedTx = await signer.signTransaction(tx);
    } else if (typeof signer.sendTransaction === 'function') {
      // signer can send directly; rely on sendTransaction to broadcast
      try {
        const connected = signer.connect ? signer.connect(provider as unknown as Provider) : signer;
        const response = await (connected as any).sendTransaction(tx) as TransactionResponse;
        this.monitorTransaction(chain, response.hash, tx, signer).catch((err) => logger.warn('monitor error', err));
        return response;
      } catch (err) {
        logger.error('sendTransaction via signer failed', (err as Error)?.message ?? err);
        throw err;
      }
    } else {
      throw new Error('Unsupported signer: no signTransaction or sendTransaction');
    }

    // Broadcast signed tx
    const response = await getMultiChainProvider().call<TransactionResponse>(chain, (p: any) => (p as any).sendTransaction(signedTx), 'sendTransaction');

    // Start monitoring asynchronously (pass signer so we can re-sign if needed)
    this.monitorTransaction(chain, response.hash, tx, signer).catch((err) => logger.warn('monitor error', err));

    return response;
  }

  /**
   * Monitor the tx lifecycle and bump/re-submit on timeout
   */
  private async monitorTransaction(chain: SupportedChain, txHash: string, originalTx: TransactionRequest | any, signer?: RawSigner | any) {
    try {
      const providerCall = getMultiChainProvider();
      // wait for 1 confirmation, timeout after WATCHDOG_MS
      const receipt = await providerCall.call<TransactionReceipt | null>(chain, (p: Provider) => p.waitForTransaction(txHash, 1, this.WATCHDOG_MS), 'waitForTransaction');
      if (receipt && (receipt as TransactionReceipt).status === 1) {
        logger.info(`Tx ${txHash} confirmed on ${chain}`);
        return;
      }
      logger.warn(`Tx ${txHash} failed or reverted on ${chain}`, receipt);
    } catch (err: any) {
      // Consider this a timeout or provider error -> attempt bump & resubmit
      logger.warn(`Tx ${txHash} not confirmed within ${this.WATCHDOG_MS}ms on ${chain}: ${err?.message || err}`);
      try {
        await this.bumpGasAndResubmit(chain, originalTx, undefined, signer);
      } catch (bumpErr) {
        logger.error('Failed to bump and resubmit tx', bumpErr);
      }
    }
  }

  /**
   * Create a replacement transaction with a higher gas price and re-broadcast.
   */
  private async bumpGasAndResubmit(chain: SupportedChain, originalTx: TransactionRequest | any, bumpPct?: number, signer?: RawSigner | any) {
    const provider = getMultiChainProvider().getProvider(chain);
    const currentGas = originalTx.maxFeePerGas || originalTx.gasPrice || '0';
    const newPrice = await gasPriceOracle.getReplacementPrice(provider, chain, currentGas, bumpPct);

    const bumpedTx = {
      ...originalTx,
      // prefer EIP-1559 fields if original had them
      ...(originalTx.maxFeePerGas ? { maxFeePerGas: newPrice, maxPriorityFeePerGas: originalTx.maxPriorityFeePerGas } : { gasPrice: newPrice })
    };

    // Re-sign and resend using the provided signer when possible
    if (signer) {
      try {
        if (typeof signer.sendTransaction === 'function') {
          const connected = signer.connect ? signer.connect(provider as unknown as Provider) : signer;
          const response = await (connected as any).sendTransaction(bumpedTx) as TransactionResponse;
          // Monitor the new transaction
          this.monitorTransaction(chain, response.hash, bumpedTx, signer).catch((err) => logger.warn('monitor error', err));
          return response;
        }

        if (typeof signer.signTransaction === 'function') {
          const signed = await signer.signTransaction(bumpedTx as TransactionRequest);
          const response = await getMultiChainProvider().call<TransactionResponse>(chain, (p: any) => (p as any).sendTransaction(signed), 'sendTransaction-bump');
          this.monitorTransaction(chain, response.hash, bumpedTx, signer).catch((err) => logger.warn('monitor error', err));
          return response;
        }
      } catch (err) {
        logger.error('Automatic bump/resend failed using signer', err);
        throw err;
      }
    }

    // Fallback: if originalTx.rawSigned is present, broadcast it (best-effort)
    if (originalTx.rawSigned) {
      await getMultiChainProvider().call(chain, (p: any) => (p as any).sendTransaction(originalTx.rawSigned), 'sendTransaction-bump');
      return;
    }

    throw new Error('Cannot auto-bump: no signer provided and no rawSigned payload available; caller must re-sign and resend with same nonce');
  }
}

/**
 * Redis-backed distributed nonce manager for multi-instance safety.
 * If `REDIS_URL` is present, prefer this manager to coordinate nonces across processes.
 */
interface TxOptions {
  urgency?: 'slow' | 'standard' | 'fast' | 'instant';
  gasLimitBuffer?: number;
}

class RedisTransactionLifecycleManager {
  private redis: any | null;
  private readonly LOCK_TTL = 10_000; // ms

  constructor(redisClient?: any | null) {
    // Prefer an injected client; fall back to the shared singleton `sharedRedis`.
    this.redis = redisClient ?? sharedRedis ?? null;
  }

  async sendTransaction(
    chain: SupportedChain,
    signer: Signer,
    txRequest: TransactionRequest,
    options: TxOptions = { urgency: 'standard', gasLimitBuffer: 1.15 }
  ): Promise<TransactionResponse> {
    if (!this.redis) {
      // Fallback to in-process manager if Redis not configured
      return new TransactionLifecycleManager().broadcastTransaction(chain as SupportedChain, signer as any, txRequest as any, { bumpPct: undefined }) as Promise<TransactionResponse>;
    }

    const multiProvider = getMultiChainProvider();
    const provider = multiProvider.getProvider(chain as SupportedChain) as Provider;
    const connected = (signer.connect ? signer.connect(provider as any) : signer) as Signer & { sendTransaction?: Function };

    const walletAddress = await signer.getAddress();
    const lockKey = `nonce_lock:${chain}:${walletAddress}`;
    const trackingKey = `nonce_tracker:${chain}:${walletAddress}`;

    // Acquire lock
    let lockAcquired = false;
    while (!lockAcquired) {
      // sharedRedis.setnx accepts seconds for expiry; convert ms -> sec
      const ttlSec = Math.ceil(this.LOCK_TTL / 1000);
      const ok = await this.redis.setnx(lockKey, 'locked', ttlSec);
      if (ok === true || ok === 'OK') lockAcquired = true;
      else await new Promise((r) => setTimeout(r, 50));
    }

    try {
      // 2. Fetch the Correct Nonce
      let nonce: number;
      const cachedNonce = await this.redis.get(trackingKey);
      if (cachedNonce !== null) {
        nonce = parseInt(cachedNonce, 10);
      } else {
        const onchain = await Promise.resolve(multiProvider.call<number>(chain as SupportedChain, (p: Provider) => p.getTransactionCount(walletAddress, 'pending'), 'getTransactionCount'));
        nonce = Number(onchain);
      }

      // 3. Extract Dynamic Gas Fee Matrices From The Oracle
      const dynamicFees = await gasPriceOracle.getOptimalGasStrategy(provider as any, chain as any, (options.urgency || 'standard') as any);

      // 4. Simulate Gas Estimation safely
      let gasLimit = (txRequest as any).gasLimit as bigint | undefined;
      if (!gasLimit) {
        try {
          const estimated = await provider.estimateGas({ ...(txRequest as any), from: walletAddress });
          const buffer = options.gasLimitBuffer ?? 1.15;
          gasLimit = (BigInt(estimated.toString()) * BigInt(Math.floor(buffer * 100))) / BigInt(100);
        } catch (err: any) {
          logger.error(`[TX MANAGER] Gas estimation failed: ${(err && err.message) || String(err)}. Using default.`);
          gasLimit = BigInt(250000);
        }
      }

      // 5. Construct & Sign Final Transaction Framework Payload
      const builtTx: TransactionRequest = {
        ...txRequest,
        nonce,
        gasLimit,
        ...(dynamicFees as object)
      } as TransactionRequest;

      logger.info(`[TX MANAGER] Dispatching transaction nonce ${nonce} to ${chain}...`);

      const txResponse = await (connected as any).sendTransaction(builtTx);

      // 6. Atomically Increment the Cached Nonce state for subsequent pipeline loops
      await this.redis.set(trackingKey, String(nonce + 1), 3600);

      return txResponse as TransactionResponse;
    } catch (error: any) {
      logger.error(`[TX MANAGER CRITICAL] Pipeline execution drop on ${chain}: ${(error && error.message) || String(error)}`);
      throw error;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  async syncNonceWithNetwork(chain: SupportedChain, walletAddress: string): Promise<void> {
    if (!this.redis) return;
    const provider = getMultiChainProvider().getProvider(chain as SupportedChain) as Provider;
    const networkNonce = await provider.getTransactionCount(walletAddress, 'pending');
    const trackingKey = `nonce_tracker:${chain}:${walletAddress}`;
    await this.redis.set(trackingKey, String(networkNonce), 3600);
    logger.info(`[TX MANAGER] Forced alignment: synchronized nonce to ${networkNonce} for ${walletAddress}`);
  }
}

// Prefer shared Redis-backed manager when available, otherwise fall back to DB-backed manager
export const txManager = (typeof sharedRedis !== 'undefined' && sharedRedis) ? new RedisTransactionLifecycleManager(sharedRedis) : new TransactionLifecycleManager();
