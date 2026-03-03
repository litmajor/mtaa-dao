/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MULTI-CHAIN WALLET AGGREGATOR SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Aggregates wallet balances across:
 * • Ethereum, Polygon, Arbitrum, Optimism (EVM)
 * • Celo (EVM-compatible)
 * 
 * Supports:
 * • User wallets (personal holdings)
 * • DAO wallets (treasury context)
 * • Multi-signature wallets
 * • Hierarchical balance aggregation
 */

import { ethers } from 'ethers';
import { Logger } from '../utils/logger';
import { userWalletsTable } from '../db/schema/strategies';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';

const logger = Logger.getLogger();

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer?: string;
  nativeToken: { symbol: string; decimals: number };
}

export interface TokenBalance {
  address: string;
  symbol: string;
  decimals: number;
  balance: number; // normalized to decimals
  balanceRaw: string; // raw on-chain value
  priceUsd?: number;
  balanceUsd: number;
}

export interface WalletAggregation {
  walletAddress: string;
  chain: string;
  chainId: number;
  context: 'user' | 'dao'; // User vs DAO treasury
  nativeBalance: TokenBalance;
  tokens: TokenBalance[];
  totalValueUsd: number;
  lastUpdated: number;
}

export interface UserPortfolioSnapshot {
  userId: string;
  wallets: WalletAggregation[];
  totalValueUsd: number;
  daoTotalValueUsd: number;
  userTotalValueUsd: number;
  byChain: Record<string, number>; // {ethereum: 50000, polygon: 30000}
  byContext: Record<'user' | 'dao', number>;
  lastUpdated: number;
}

// ════════════════════════════════════════════════════════════════════════════════
// CHAIN CONFIGURATIONS
// ════════════════════════════════════════════════════════════════════════════════

const CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    nativeToken: { symbol: 'ETH', decimals: 18 },
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    nativeToken: { symbol: 'MATIC', decimals: 18 },
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    nativeToken: { symbol: 'ETH', decimals: 18 },
  },
  optimism: {
    chainId: 10,
    name: 'Optimism',
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeToken: { symbol: 'ETH', decimals: 18 },
  },
  celo: {
    chainId: 42220,
    name: 'Celo',
    rpcUrl: process.env.CELO_RPC_URL || 'https://forno.celo.org',
    blockExplorer: 'https://celoscan.io',
    nativeToken: { symbol: 'CELO', decimals: 18 },
  },
};

// ════════════════════════════════════════════════════════════════════════════════
// TOKEN ADDRESSES (for balance queries)
// ════════════════════════════════════════════════════════════════════════════════

const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  ethereum: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDd86b8E8F6f5d2',
  },
  polygon: {
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFF958023D60d76287',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
  arbitrum: {
    USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5F8d',
    DAI: '0xDA10009e2000436a7c4ac7be34cd3bEe0e238b88',
  },
  optimism: {
    USDC: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    DAI: '0xDA10009e2000436a7c4ac7be34cd3bEe0e238b88',
  },
  celo: {
    cusd: '0x765DE816845861e75A25fCA122bb6bAA3c1EC9b0',
    cUSDT: '0x48065fbBE7f90Cd25b76Smart4e1dC9A8FF8e55d',
  },
};

// ════════════════════════════════════════════════════════════════════════════════
// MULTI-CHAIN WALLET AGGREGATOR
// ════════════════════════════════════════════════════════════════════════════════

class MultiChainWalletAggregator {
  private providers: Map<string, ethers.Provider> = new Map();
  private erc20Abi = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
  ];

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    for (const [chain, config] of Object.entries(CHAINS)) {
      try {
        this.providers.set(chain, new ethers.JsonRpcProvider(config.rpcUrl));
        logger.debug(`[Wallet] Initialized provider for ${chain}`);
      } catch (error) {
        logger.warn(`[Wallet] Failed to initialize ${chain} provider:`, error);
      }
    }
  }

  /**
   * Get all wallet addresses for a user (with context)
   */
  async getUserWallets(userId: string, context?: 'user' | 'dao'): Promise<WalletAggregation[]> {
    try {
      const query = context
        ? and(eq(userWalletsTable.userId, userId), eq(userWalletsTable.context, context))
        : eq(userWalletsTable.userId, userId);

      const wallets = await db.select().from(userWalletsTable).where(query);

      const aggregations: WalletAggregation[] = [];

      for (const wallet of wallets) {
        const aggregation = await this.fetchWalletBalance(
          wallet.address,
          wallet.chain,
          wallet.context as 'user' | 'dao'
        );
        if (aggregation) {
          aggregations.push(aggregation);
        }
      }

      return aggregations;
    } catch (error) {
      logger.error(`[Wallet] Error fetching user wallets for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Fetch balance for a single wallet on a chain
   */
  async fetchWalletBalance(
    address: string,
    chain: string,
    context: 'user' | 'dao'
  ): Promise<WalletAggregation | null> {
    try {
      const chainConfig = CHAINS[chain];
      if (!chainConfig) {
        logger.warn(`[Wallet] Unknown chain: ${chain}`);
        return null;
      }

      const provider = this.providers.get(chain);
      if (!provider) {
        logger.warn(`[Wallet] No provider for chain: ${chain}`);
        return null;
      }

      // Get native balance
      const balanceRaw = await provider.getBalance(address);
      const nativeBalance: TokenBalance = {
        address,
        symbol: chainConfig.nativeToken.symbol,
        decimals: chainConfig.nativeToken.decimals,
        balance: parseFloat(ethers.formatUnits(balanceRaw, chainConfig.nativeToken.decimals)),
        balanceRaw: balanceRaw.toString(),
        balanceUsd: 0,
      };

      // Get token balances
      const tokens: TokenBalance[] = [];
      const tokenAddrs = TOKEN_ADDRESSES[chain] || {};

      for (const [symbol, tokenAddress] of Object.entries(tokenAddrs)) {
        try {
          const contract = new ethers.Contract(tokenAddress, this.erc20Abi, provider);
          const [balance, decimals] = await Promise.all([
            contract.balanceOf(address),
            contract.decimals(),
          ]);

          if (balance > 0n) {
            tokens.push({
              address: tokenAddress,
              symbol,
              decimals,
              balance: parseFloat(ethers.formatUnits(balance, decimals)),
              balanceRaw: balance.toString(),
              balanceUsd: 0,
            });
          }
        } catch (error) {
          logger.warn(`[Wallet] Error fetching ${symbol} balance on ${chain}:`, error);
        }
      }

      const totalValueUsd = 0; // Would be populated with price data

      return {
        walletAddress: address,
        chain,
        chainId: chainConfig.chainId,
        context,
        nativeBalance,
        tokens,
        totalValueUsd,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      logger.error(`[Wallet] Error fetching wallet balance for ${address} on ${chain}:`, error);
      return null;
    }
  }

  /**
   * Get complete portfolio snapshot for user
   */
  async getUserPortfolioSnapshot(userId: string): Promise<UserPortfolioSnapshot | null> {
    try {
      const userWallets = await this.getUserWallets(userId, 'user');
      const daoWallets = await this.getUserWallets(userId, 'dao');

      const allWallets = [...userWallets, ...daoWallets];

      if (allWallets.length === 0) {
        logger.warn(`[Wallet] No wallets found for user ${userId}`);
        return null;
      }

      // Aggregate by chain
      const byChain: Record<string, number> = {};
      const byContext: Record<'user' | 'dao', number> = { user: 0, dao: 0 };

      let totalValueUsd = 0;
      let userTotalValueUsd = 0;
      let daoTotalValueUsd = 0;

      for (const wallet of allWallets) {
        const walletValue = wallet.totalValueUsd;
        totalValueUsd += walletValue;

        if (wallet.context === 'user') {
          userTotalValueUsd += walletValue;
          byContext.user += walletValue;
        } else {
          daoTotalValueUsd += walletValue;
          byContext.dao += walletValue;
        }

        if (!byChain[wallet.chain]) {
          byChain[wallet.chain] = 0;
        }
        byChain[wallet.chain] += walletValue;
      }

      return {
        userId,
        wallets: allWallets,
        totalValueUsd,
        daoTotalValueUsd,
        userTotalValueUsd,
        byChain,
        byContext,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      logger.error(`[Wallet] Error creating portfolio snapshot for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Add a wallet to user's account
   */
  async addWallet(
    userId: string,
    address: string,
    chain: string,
    context: 'user' | 'dao' = 'user',
    daoId?: string
  ): Promise<boolean> {
    try {
      const chainConfig = CHAINS[chain];
      if (!chainConfig) {
        logger.error(`[Wallet] Invalid chain: ${chain}`);
        return false;
      }

      await db.insert(userWalletsTable).values({
        id: `wallet_${userId}_${address}_${chain}`,
        userId,
        address,
        chain,
        chainId: chainConfig.chainId,
        walletType: 'external', // Default, would be detectted in UI
        context,
        daoId,
        isActive: true,
        cachedBalanceUsd: '0',
      });

      logger.info(`[Wallet] Added wallet ${address} on ${chain} for user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`[Wallet] Error adding wallet:`, error);
      return false;
    }
  }

  /**
   * Get wallet summary (quick view)
   */
  async getWalletSummary(userId: string): Promise<{ total: number; byChain: Record<string, number> } | null> {
    const snapshot = await this.getUserPortfolioSnapshot(userId);
    if (!snapshot) return null;

    return {
      total: snapshot.totalValueUsd,
      byChain: snapshot.byChain,
    };
  }
}

export const walletAggregator = new MultiChainWalletAggregator();
