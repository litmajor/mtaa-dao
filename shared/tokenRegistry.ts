// Phase 3: Advanced Token Registry for MtaaDAO
// Supports multi-chain tokens: CELO, cUSD, cEUR, USDT, BTC, ETH, USDC, MTAA
// Integrated with cross-chain bridge support (LayerZero, Axelar, Wormhole)

import type { SupportedChain } from './chainConfiguration';

export interface TokenInfo {
  symbol: string;
  name: string;
  address: {
    mainnet: string;
    testnet: string;
  };
  decimals: number;
  category: 'native' | 'stablecoin' | 'community' | 'bridged';
  isActive: boolean;
  logoUrl?: string;
  description?: string;
  priceApi?: string; // For price fetching (CoinGecko ID)
  riskLevel: 'low' | 'medium' | 'high';
  maxDailyVolume?: string; // In token units
  requiresKyc?: boolean;
  emerging?: boolean; // Mark tokens as emerging/new
  celoNativeOnly?: boolean; // mark tokens that are Celo-native and shouldn't be treated as CEX-listed
  
  // Multi-chain support
  chains?: {
    [chain in SupportedChain]?: {
      address: string;
      decimals: number;
      isActive: boolean;
      bridges?: {
        [targetChain in SupportedChain]?: BridgeRoute;
      };
    };
  };
  
  metadata?: {
    riskScore?: 'low' | 'medium' | 'high';
    liquidityScore?: number;        // 1-100, higher = more liquidity
    volatilityScore?: number;       // 1-100, higher = more volatile
      supportedExchanges?: string[]; // Exchanges where token is traded
  };
}

// Bridge configuration for cross-chain token transfers
export interface BridgeRoute {
  protocol: 'layerzero' | 'axelar' | 'wormhole' | 'stargate';
  bridgeContract?: string;
  minimumAmount: string;
  maximumAmount: string;
  estimatedTime: number;           // in seconds
  feePercentage: number;           // 0.1 - 1.0%
  active: boolean;
}

export interface BridgeConfig {
  protocol: 'layerzero' | 'axelar' | 'wormhole' | 'stargate';
  sourceChain: string;
  targetChain: string;
  bridgeContract?: string;
  minimumAmount: string;
  estimatedTime: number;           // in seconds
}

export interface TokenConfig {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  isStable: boolean;
  isNative: boolean;
  coingeckoId: string;
  category: 'native' | 'stable' | 'crypto' | 'fiat';
  bridge?: BridgeConfig;
}


export interface YieldStrategy {
  id: string;
  name: string;
  description: string;
  apy: number; // Annual percentage yield
  riskLevel: 'low' | 'medium' | 'high';
  supportedTokens: string[]; // Token symbols
  protocol: string; // e.g., 'Moola', 'Ubeswap', 'Curve'
  isActive: boolean;
  minDeposit?: string;
  maxDeposit?: string;
  lockPeriod?: number; // in days
  fees: {
    deposit?: number; // percentage
    withdraw?: number; // percentage
    performance?: number; // percentage
  };
}

// Comprehensive token registry for Phase 3
export const TOKEN_REGISTRY: Record<string, TokenInfo> = {
  CELO: {
    symbol: 'CELO',
    name: 'Celo Native Asset',
    address: {
      mainnet: '0x471EcE3750Da237f93B8E339c536989b8978a438', // CELO native
      testnet: '0x471EcE3750Da237f93B8E339c536989b8978a438'
    },
    decimals: 18,
    category: 'native',
    isActive: true,
    logoUrl: '/tokens/celo.png',
    description: 'Celo native token for payments and governance',
    priceApi: 'coingecko:celo',
    riskLevel: 'low'
  },

  cUSD: {
    symbol: 'cUSD',
    name: 'Celo Dollar',
    address: {
      mainnet: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
      testnet: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1'
    },
    decimals: 18,
    category: 'stablecoin',
    isActive: true,
    logoUrl: '/tokens/cusd.png',
    description: 'Celo Dollar stablecoin pegged to USD',
    priceApi: 'coingecko:celo-dollar',
    riskLevel: 'low'
  },

  cEUR: {
    symbol: 'cEUR',
    name: 'Celo Euro',
    address: {
      mainnet: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
      testnet: '0x10c892A6EC43a53E45a9D5ba3F7cFF4eD2E5b04B'
    },
    decimals: 18,
    category: 'stablecoin',
    isActive: true,
    logoUrl: '/tokens/ceur.png',
    description: 'Celo Euro stablecoin pegged to EUR',
    priceApi: 'coingecko:celo-euro',
    riskLevel: 'low',
    metadata: {
      riskScore: 'low',
      liquidityScore: 70,
      volatilityScore: 5,
      supportedExchanges: []
    },
    celoNativeOnly: true,
  },

  cKES: {
    symbol: 'cKES',
    name: 'Celo Kenyan Shilling',
    address: {
      mainnet: '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0',
      testnet: '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0'
    },
    decimals: 18,
    category: 'stablecoin',
    isActive: true,
    logoUrl: '/tokens/ckes.png',
    description: 'Celo Kenyan Shilling stablecoin pegged to KES',
    priceApi: 'coingecko:celo-kenyan-shilling',
    riskLevel: 'low',
    emerging: true,
    metadata: {
      riskScore: 'low',
      liquidityScore: 45,
      volatilityScore: 8,
      supportedExchanges: []
    },
    celoNativeOnly: true,
  },

  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    address: {
      mainnet: '0x88eeC49252c8cbc039DCdB394c0c2BA2f1637EA0', // Bridged USDT on Celo
      testnet: '0x0000000000000000000000000000000000000000' // Testnet address TBD
    },
    decimals: 6, // Note: USDT typically uses 6 decimals
    category: 'bridged',
    isActive: false, // Inactive on testnet until proper address is available
    logoUrl: '/tokens/usdt.png',
    description: 'Tether USD bridged to Celo via Wormhole',
    priceApi: 'coingecko:tether',
    riskLevel: 'low',
    requiresKyc: true,
    metadata: {
      riskScore: 'low',
      liquidityScore: 95,
      volatilityScore: 2,
      supportedExchanges: ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx']
    }
  },

  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin (Bridged)',
    address: {
      mainnet: '0x0000000000000000000000000000000000000000', // Placeholder - update after bridge deployment
      testnet: '0x0000000000000000000000000000000000000000'
    },
    decimals: 8,
    category: 'bridged',
    isActive: false, // Will be activated after bridge deployment and address confirmation
    logoUrl: '/tokens/btc.png',
    description: 'Bitcoin bridged to Celo',
    priceApi: 'coingecko:bitcoin',
    riskLevel: 'high', // Higher risk due to bridging complexity
    requiresKyc: true,
    metadata: {
      riskScore: 'high',
      liquidityScore: 85,
      volatilityScore: 75,
      supportedExchanges: ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx']
    }
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum (Bridged)',
    address: {
      mainnet: '0x0000000000000000000000000000000000000000', // Placeholder - update after bridge deployment
      testnet: '0x0000000000000000000000000000000000000000'
    },
    decimals: 18,
    category: 'bridged',
    isActive: false, // Will be activated after bridge deployment and address confirmation
    logoUrl: '/tokens/eth.png',
    description: 'Ethereum bridged to Celo via CrossChainBridge contract',
    priceApi: 'coingecko:ethereum',
    riskLevel: 'high', // Higher risk due to bridging complexity
    requiresKyc: true,
    metadata: {
      riskScore: 'high',
      liquidityScore: 90,
      volatilityScore: 65,
      supportedExchanges: ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx']
    }
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin (Native)',
    address: {
      mainnet: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', // Celo native USDC
      testnet: '0x2550F036b621f94073647E7f4163736E3f1C3094' // Celo testnet USDC
    },
    decimals: 6,
    category: 'stablecoin',
    isActive: true,
    logoUrl: '/tokens/usdc.png',
    description: 'USD Coin native to Celo',
    priceApi: 'coingecko:usd-coin',
    riskLevel: 'low',
    metadata: {
      riskScore: 'low',
      liquidityScore: 92,
      volatilityScore: 2,
      supportedExchanges: ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx']
    }
  },

  // Framework for custom community tokens
  MTAA: {
    symbol: 'MTAA',
    name: 'MtaaDAO Token',
    address: {
      mainnet: '0x0000000000000000000000000000000000000000', // Deploy later
      testnet: '0x0000000000000000000000000000000000000000'
    },
    decimals: 18,
    category: 'community',
    isActive: false, // Will be activated via governance
    logoUrl: '/tokens/mtaa.png',
    description: 'MtaaDAO governance and utility token',
    riskLevel: 'medium',
    maxDailyVolume: '100000', // Example limit
    emerging: true,
    metadata: {
      riskScore: 'medium',
      liquidityScore: 30,
      volatilityScore: 45,
      supportedExchanges: ['kucoin']
    }
  }
};

// Yield strategies for Phase 3
export const YIELD_STRATEGIES: Record<string, YieldStrategy> = {
  MOOLA_LENDING: {
    id: 'moola-lending',
    name: 'Moola Lending',
    description: 'Earn yield by lending cUSD, cEUR to Moola Protocol',
    apy: 8.5,
    riskLevel: 'low',
    supportedTokens: ['cUSD', 'cEUR'],
    protocol: 'Moola',
    isActive: true,
    minDeposit: '10',
    fees: {
      deposit: 0,
      withdraw: 0,
      performance: 10 // 10% performance fee
    }
  },

  CELO_STAKING: {
    id: 'celo-staking',
    name: 'Celo Validator Staking',
    description: 'Stake CELO with validator groups for epoch rewards',
    apy: 6.2,
    riskLevel: 'low',
    supportedTokens: ['CELO'],
    protocol: 'Celo Validators',
    isActive: true,
    minDeposit: '1',
    lockPeriod: 3, // 3 days unbonding period
    fees: {
      deposit: 0,
      withdraw: 0,
      performance: 5
    }
  },

  UBESWAP_LP: {
    id: 'ubeswap-lp',
    name: 'Ubeswap Liquidity Pools',
    description: 'Provide liquidity to CELO/cUSD, cUSD/cEUR pairs',
    apy: 12.3,
    riskLevel: 'medium',
    supportedTokens: ['CELO', 'cUSD', 'cEUR'],
    protocol: 'Ubeswap',
    isActive: true,
    minDeposit: '50',
    fees: {
      deposit: 0.1,
      withdraw: 0.1,
      performance: 15
    }
  }
};

// Helper functions for token operations
export class TokenRegistry {
  static getToken(symbol: string): TokenInfo | null {
    return TOKEN_REGISTRY[symbol] || null;
  }

  static getActiveTokens(): TokenInfo[] {
    return Object.values(TOKEN_REGISTRY).filter(token => token.isActive);
  }

  static getTokensByCategory(category: TokenInfo['category']): TokenInfo[] {
    return Object.values(TOKEN_REGISTRY).filter(
      token => token.category === category && token.isActive
    );
  }

  static getTokenAddress(symbol: string, network: 'mainnet' | 'testnet'): string | null {
    const token = TOKEN_REGISTRY[symbol];
    return token?.address[network] || null;
  }

  static getSupportedTokensForStrategy(strategyId: string): TokenInfo[] {
    const strategy = YIELD_STRATEGIES[strategyId];
    if (!strategy) return [];

    return strategy.supportedTokens
      .map(symbol => TOKEN_REGISTRY[symbol])
      .filter(token => token && token.isActive) as TokenInfo[];
  }

  static getActiveStrategies(): YieldStrategy[] {
    return Object.values(YIELD_STRATEGIES).filter(strategy => strategy.isActive);
  }

  // Backwards-compatible convenience method used across the codebase
  static getSupportedTokens(): TokenInfo[] {
    return TokenRegistry.getAllTokens();
  }

  /**
   * Get all Celo-native symbols that should NEVER hit CEX APIs.
   * Includes both native assets and tokens with no meaningful CEX presence.
   */
  static getCeloNativeSymbols(): Set<string> {
    return new Set(
      Object.values(TOKEN_REGISTRY)
        .filter(t => 
          t.category === 'native' || 
          t.category === 'stablecoin' ||
          t.symbol === 'MTAA'
        )
        .map(t => t.symbol)
    );
    // Returns: Set { 'CELO', 'cUSD', 'cEUR', 'cKES', 'MTAA', 'USDT', 'USDC' }
    // Note: USDT and USDC included because as bridged tokens on Celo,
    // they behave differently than native USDT/USDC on Ethereum
  }

  static addCustomToken(symbol: string, tokenInfo: TokenInfo): void {
    // This will be controlled by DAO governance
    TOKEN_REGISTRY[symbol] = tokenInfo;
  }

  static validateTokenAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  // Get all supported tokens
  static getAllTokens(): TokenInfo[] {
    return Object.values(TOKEN_REGISTRY);
  }

  /**
   * Return tokens that are safe to treat as CEX-tradable (not celo-native-only)
   */
  static getCEXTradableSymbols(): string[] {
    return Object.values(TOKEN_REGISTRY)
      .filter(t => !t.celoNativeOnly)
      .map(t => t.symbol);
  }

  // Get token by address
  static getTokenByAddress(address: string): TokenInfo | null {
    return Object.values(TOKEN_REGISTRY).find((token) =>
      token.address?.mainnet?.toLowerCase() === address.toLowerCase() || token.address?.testnet?.toLowerCase() === address.toLowerCase()
    ) || null;
  }
}

// Type exports for use in other modules
export type SupportedToken = keyof typeof TOKEN_REGISTRY;
export type StrategyId = keyof typeof YIELD_STRATEGIES;

// Create enum for Zod validation
export const SupportedTokenEnum = {
  CELO: 'CELO',
  cUSD: 'cUSD',
  cEUR: 'cEUR',
  cKES: 'cKES',
  USDT: 'USDT',
  USDC: 'USDC',
  BTC: 'BTC',
  ETH: 'ETH',
  MTAA: 'MTAA'
} as const;