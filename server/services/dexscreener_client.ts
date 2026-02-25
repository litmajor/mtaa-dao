/**
 * DexScreener API Client (TypeScript)
 * 
 * Bridges Python backend DexScreener integration with Node.js server
 * Enables token discovery, trending pair detection, and market data enrichment
 */

export interface DexToken {
  address: string;
  name: string;
  symbol: string;
  decimals?: number;
}

export interface DexPair {
  pairAddress: string;
  chainId: string;
  dexId: string;
  baseToken: DexToken;
  quoteToken: DexToken;
  priceUsd: number;
  priceNative?: number;
  liquidity: {
    usd: number;
    base?: number;
    quote?: number;
  };
  volume: {
    h1?: number;
    h6?: number;
    h24: number;
  };
  priceChange: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24: number;
  };
  txns: {
    h1?: { buys?: number; sells?: number };
    h6?: { buys?: number; sells?: number };
    h24?: { buys?: number; sells?: number };
  };
  marketCap?: number;
  fdv?: number; // Fully diluted valuation
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
}

export interface DexSearchResult {
  status: 'success' | 'error';
  total?: number;
  pairs?: DexPair[];
  error?: string;
}

export interface DexTrendingResult {
  status: 'success' | 'error';
  total?: number;
  trending?: DexPair[];
  filters?: {
    chain: string;
    min_liquidity: number;
    min_volume_24h: number;
    min_transactions: number;
    price_change_threshold: number;
  };
  error?: string;
}

export interface DexTokenPairsResult {
  status: 'success' | 'error';
  total?: number;
  pairs?: DexPair[];
  error?: string;
}

/**
 * TypeScript wrapper for DexScreener API
 * Real implementation calls Python backend which handles REST API
 */
export class DexScreenerClient {
  private baseUrl: string;
  private timeout: number = 10000; // 10 seconds

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Search for trading pairs by token name/symbol/address
   */
  async searchPairs(query: string, chains?: string[]): Promise<DexSearchResult> {
    try {
      const params = new URLSearchParams();
      params.append('q', query);
      if (chains && chains.length > 0) {
        params.append('chains', chains.join(','));
      }

      const response = await fetch(`${this.baseUrl}/api/dex/search-pairs?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('DexScreener searchPairs error:', error);
      return {
        status: 'error',
        error: `Failed to search pairs: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get detailed information for a specific pair
   */
  async getPair(chain: string, pairAddress: string): Promise<{ status: 'success' | 'error'; pair?: DexPair; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/dex/pairs/${chain}/${pairAddress}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('DexScreener getPair error:', error);
      return {
        status: 'error',
        error: `Failed to fetch pair: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get all trading pairs for a specific token
   */
  async getTokenPairs(chain: string, tokenAddress: string): Promise<DexTokenPairsResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/dex/token-pairs/${chain}/${tokenAddress}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('DexScreener getTokenPairs error:', error);
      return {
        status: 'error',
        error: `Failed to fetch token pairs: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Find trending pairs based on filters
   */
  async findTrending(options: {
    chain?: string;
    minLiquidity?: number;
    minVolume24h?: number;
    minTransactions?: number;
    priceChangeThreshold?: number;
    limit?: number;
  }): Promise<DexTrendingResult> {
    try {
      const params = new URLSearchParams();
      params.append('chain', options.chain || 'solana');
      params.append('min_liquidity', String(options.minLiquidity || 10000));
      params.append('min_volume_24h', String(options.minVolume24h || 50000));
      params.append('min_transactions', String(options.minTransactions || 100));
      params.append('price_change_threshold', String(options.priceChangeThreshold || 5.0));
      params.append('limit', String(options.limit || 50));

      const response = await fetch(`${this.baseUrl}/api/dex/trending-pairs?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('DexScreener findTrending error:', error);
      return {
        status: 'error',
        error: `Failed to find trending pairs: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Call Python backend directly (if needed for fallback)
   */
  async callPythonBackend(endpoint: string, params?: Record<string, any>): Promise<any> {
    try {
      const url = new URL(`${this.baseUrl}${endpoint}`);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, String(value));
        });
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('DexScreener Python backend call error:', error);
      throw error;
    }
  }
}

// Singleton export
export const dexscreenerClient = new DexScreenerClient();
