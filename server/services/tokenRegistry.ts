/**
 * Token Registry Service
 * 
 * Manages supported tokens across all blockchains.
 * Provides token metadata, categorization, and validation.
 */

import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

// ============= TYPES & INTERFACES =============

export interface TokenMetadata {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chain: 'ethereum' | 'polygon' | 'tron' | 'solana' | 'optimism' | 'arbitrum' | 'base' | 'bsc' | 'celo' | 'ton';
  chainId?: string | number;
  category: 'stablecoin' | 'wrapped' | 'native' | 'governance' | 'utility' | 'bridge';
  logoUrl?: string;
  coingeckoId?: string;
  description?: string;
  added: string; // ISO timestamp
}

export interface TokenRegistryFilter {
  chain?: string;
  category?: string;
  symbol?: string;
  address?: string;
}

// ============= TOKEN REGISTRY SERVICE =============

class TokenRegistry {
  private tokens: Map<string, TokenMetadata> = new Map();
  private tokensByChain: Map<string, TokenMetadata[]> = new Map();
  private tokensByCategory: Map<string, TokenMetadata[]> = new Map();
  private lastUpdated: number = 0;

  constructor() {
    this.initializeTokens();
  }

  /**
   * Initialize with default tokens
   */
  private initializeTokens(): void {
    // Native tokens
    const nativeTokens: TokenMetadata[] = [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        address: '0x0000000000000000000000000000000000000000', // Native
        decimals: 18,
        chain: 'ethereum',
        chainId: 1,
        category: 'native',
        logoUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
        coingeckoId: 'ethereum',
        added: new Date().toISOString()
      },
      {
        symbol: 'SOL',
        name: 'Solana',
        address: 'So11111111111111111111111111111111111111112',
        decimals: 9,
        chain: 'solana',
        category: 'native',
        logoUrl: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
        coingeckoId: 'solana',
        added: new Date().toISOString()
      },
      {
        symbol: 'TRX',
        name: 'TRON',
        address: 'TNUC9Qb1rRKPjYvRjSrgQajc1ieNaWys2d', // Mainnet
        decimals: 6,
        chain: 'tron',
        category: 'native',
        logoUrl: 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png',
        coingeckoId: 'tron',
        added: new Date().toISOString()
      }
    ];

    // Stablecoins
    const stablecoins: TokenMetadata[] = [
      {
        symbol: 'USDT',
        name: 'Tether USD',
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        decimals: 6,
        chain: 'ethereum',
        chainId: 1,
        category: 'stablecoin',
        logoUrl: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
        coingeckoId: 'tether',
        added: new Date().toISOString()
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        decimals: 6,
        chain: 'ethereum',
        chainId: 1,
        category: 'stablecoin',
        logoUrl: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
        coingeckoId: 'usd-coin',
        added: new Date().toISOString()
      },
      {
        symbol: 'PYUSD',
        name: 'PayPal USD',
        address: '0x6c3ea9036406852006290770bedfcaba0e23e8f1',
        decimals: 6,
        chain: 'ethereum',
        chainId: 1,
        category: 'stablecoin',
        logoUrl: 'https://assets.coingecko.com/coins/images/32563/large/PYUSD.png',
        coingeckoId: 'paypal-usd',
        added: new Date().toISOString()
      },
      {
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        address: '0x6b175474e89094c44da98b954eedeac495271d0f',
        decimals: 18,
        chain: 'ethereum',
        chainId: 1,
        category: 'stablecoin',
        logoUrl: 'https://assets.coingecko.com/coins/images/9956/large/4mICQk6.png',
        coingeckoId: 'dai',
        added: new Date().toISOString()
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: 'EPjFWaJsfqwzpm9NstUkqKKU2hyTQaw4LvcjwNYumGj',
        decimals: 6,
        chain: 'solana',
        category: 'stablecoin',
        logoUrl: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
        coingeckoId: 'usd-coin',
        added: new Date().toISOString()
      },
      {
        symbol: 'USDT',
        name: 'Tether USD',
        address: 'Es9vMFrzaCERmJfrF4H2FYD9iM7h1nxeyceB8FSVqWCA',
        decimals: 6,
        chain: 'solana',
        category: 'stablecoin',
        logoUrl: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
        coingeckoId: 'tether',
        added: new Date().toISOString()
      },
      {
        symbol: 'USDT',
        name: 'Tether USD',
        address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // Mainnet
        decimals: 6,
        chain: 'tron',
        category: 'stablecoin',
        logoUrl: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
        coingeckoId: 'tether',
        added: new Date().toISOString()
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8', // Mainnet
        decimals: 6,
        chain: 'tron',
        category: 'stablecoin',
        logoUrl: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
        coingeckoId: 'usd-coin',
        added: new Date().toISOString()
      }
    ];

    // Wrapped tokens
    const wrappedTokens: TokenMetadata[] = [
      {
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
        decimals: 8,
        chain: 'ethereum',
        chainId: 1,
        category: 'wrapped',
        logoUrl: 'https://assets.coingecko.com/coins/images/7598/large/wrapped_bitcoin_wbtc.png',
        coingeckoId: 'wrapped-bitcoin',
        added: new Date().toISOString()
      },
      {
        symbol: 'WETH',
        name: 'Wrapped Ether',
        address: 'So11111111111111111111111111111111111111112', // WSOL on Solana
        decimals: 9,
        chain: 'solana',
        category: 'wrapped',
        logoUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
        coingeckoId: 'ethereum',
        added: new Date().toISOString()
      },
      {
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        address: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5plSmw',
        decimals: 8,
        chain: 'solana',
        category: 'wrapped',
        logoUrl: 'https://assets.coingecko.com/coins/images/7598/large/wrapped_bitcoin_wbtc.png',
        coingeckoId: 'wrapped-bitcoin',
        added: new Date().toISOString()
      }
    ];

    // Governance tokens
    const governanceTokens: TokenMetadata[] = [
      {
        symbol: 'CELO',
        name: 'Celo',
        address: '0x0000000000000000000000000000000000000000', // Native on Celo
        decimals: 18,
        chain: 'celo',
        category: 'governance',
        logoUrl: 'https://assets.coingecko.com/coins/images/11090/large/icon-celo-CELO-logo.png',
        coingeckoId: 'celo',
        added: new Date().toISOString()
      }
    ];

    // Combine all tokens
    const allTokens = [...nativeTokens, ...stablecoins, ...wrappedTokens, ...governanceTokens];

    // Initialize maps
    allTokens.forEach(token => {
      const key = `${token.chain}:${token.address.toLowerCase()}`;
      this.tokens.set(key, token);

      // Index by chain
      if (!this.tokensByChain.has(token.chain)) {
        this.tokensByChain.set(token.chain, []);
      }
      this.tokensByChain.get(token.chain)!.push(token);

      // Index by category
      if (!this.tokensByCategory.has(token.category)) {
        this.tokensByCategory.set(token.category, []);
      }
      this.tokensByCategory.get(token.category)!.push(token);
    });

    this.lastUpdated = Date.now();
    logger.info(`TokenRegistry initialized with ${allTokens.length} tokens`);
  }

  /**
   * Get token by address and chain
   */
  getToken(chain: string, address: string): TokenMetadata | null {
    const key = `${chain.toLowerCase()}:${address.toLowerCase()}`;
    return this.tokens.get(key) || null;
  }

  /**
   * Get all tokens for a chain
   */
  getTokensByChain(chain: string): TokenMetadata[] {
    return this.tokensByChain.get(chain.toLowerCase()) || [];
  }

  /**
   * Get all tokens in a category
   */
  getTokensByCategory(category: string): TokenMetadata[] {
    return this.tokensByCategory.get(category.toLowerCase()) || [];
  }

  /**
   * Get tokens by multiple filters
   */
  filterTokens(filter: TokenRegistryFilter): TokenMetadata[] {
    let results = Array.from(this.tokens.values());

    if (filter.chain) {
      results = results.filter(t => t.chain === filter.chain?.toLowerCase());
    }

    if (filter.category) {
      results = results.filter(t => t.category === filter.category?.toLowerCase());
    }

    if (filter.symbol) {
      results = results.filter(t => t.symbol === filter.symbol?.toUpperCase());
    }

    if (filter.address) {
      results = results.filter(t => t.address.toLowerCase() === filter.address?.toLowerCase());
    }

    return results;
  }

  /**
   * Get all tokens
   */
  getAllTokens(): TokenMetadata[] {
    return Array.from(this.tokens.values());
  }

  /**
   * Get tokens for display (with filters)
   */
  getAssets(chain?: string, category?: string): TokenMetadata[] {
    let results = Array.from(this.tokens.values());

    if (chain) {
      results = results.filter(t => t.chain === chain.toLowerCase());
    }

    if (category) {
      results = results.filter(t => t.category === category.toLowerCase());
    }

    // Sort by symbol
    results.sort((a, b) => a.symbol.localeCompare(b.symbol));

    return results;
  }

  /**
   * Validate token address for a chain
   */
  validateToken(chain: string, address: string): boolean {
    const token = this.getToken(chain, address);
    return token !== null;
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): string[] {
    return Array.from(this.tokensByChain.keys());
  }

  /**
   * Get supported categories
   */
  getSupportedCategories(): string[] {
    return Array.from(this.tokensByCategory.keys());
  }

  /**
   * Add or update token
   */
  addToken(token: TokenMetadata): void {
    const key = `${token.chain}:${token.address.toLowerCase()}`;
    this.tokens.set(key, token);

    // Update chain index
    if (!this.tokensByChain.has(token.chain)) {
      this.tokensByChain.set(token.chain, []);
    }
    const chainTokens = this.tokensByChain.get(token.chain)!;
    const existingIndex = chainTokens.findIndex(t => t.address.toLowerCase() === token.address.toLowerCase());
    if (existingIndex >= 0) {
      chainTokens[existingIndex] = token;
    } else {
      chainTokens.push(token);
    }

    // Update category index
    if (!this.tokensByCategory.has(token.category)) {
      this.tokensByCategory.set(token.category, []);
    }
    const categoryTokens = this.tokensByCategory.get(token.category)!;
    const catIndex = categoryTokens.findIndex(t => t.address.toLowerCase() === token.address.toLowerCase());
    if (catIndex >= 0) {
      categoryTokens[catIndex] = token;
    } else {
      categoryTokens.push(token);
    }

    logger.info(`Token added/updated: ${token.symbol} on ${token.chain}`);
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTokens: number;
    chainCount: number;
    categoryCount: number;
    lastUpdated: string;
  } {
    return {
      totalTokens: this.tokens.size,
      chainCount: this.tokensByChain.size,
      categoryCount: this.tokensByCategory.size,
      lastUpdated: new Date(this.lastUpdated).toISOString()
    };
  }
}

// ============= SERVICE INSTANCE =============

const tokenRegistry = new TokenRegistry();

export { tokenRegistry, TokenRegistry };
