/**
 * Multi-Chain Network Configuration
 * 
 * Centralized configuration for all supported chains with their specific
 * RPC endpoints, explorers, tokens, and DeFi contracts
 */

export interface ChainConfig {
  chainId: number;
  name: string;
  symbol: string; // Native token symbol (ETH, CELO, MATIC, etc)
  decimals: number;
  rpcUrl: string;
  wsRpcUrl?: string; // WebSocket for real-time updates
  explorerUrl: string;
  logoUrl?: string;
  
  // DeFi contract addresses
  uniswapV3Router?: string;
  uniswapV2Router?: string;
  aavePoolAddress?: string;
  curveRegistry?: string;
  
  // Token addresses on this chain
  commonTokens?: {
    stablecoin?: string; // USDC, DAI, cUSD, etc
    wrapped?: string; // WETH, WCELO, WMATIC, etc
    governance?: string; // Optional governance token
  };
  
  // Chain capabilities
  supportsEIP1559: boolean;
  supportsFlashLoan: boolean;
  supportsMultisig: boolean;
  
  // Gas settings
  minGasPrice?: number; // In gwei
  estimatedBlockTime?: number; // In seconds
  confirmationsRequired?: number;
}

/**
 * Supported Chain Configurations
 */
export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  // Ethereum Mainnet
  1: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: process.env.ETH_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
    wsRpcUrl: process.env.ETH_WS_URL || 'wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
    explorerUrl: 'https://etherscan.io',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    aavePoolAddress: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9',
    commonTokens: {
      stablecoin: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      wrapped: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      governance: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI
    },
    supportsEIP1559: true,
    supportsFlashLoan: true,
    supportsMultisig: true,
    confirmationsRequired: 12,
  },

  // Ethereum Sepolia Testnet
  11155111: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_KEY',
    explorerUrl: 'https://sepolia.etherscan.io',
    commonTokens: {
      stablecoin: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Test USDC
      wrapped: '0xfFf9976782d46CC05630D1855a662de4Fde1e42e', // WETH
    },
    supportsEIP1559: true,
    supportsFlashLoan: true,
    supportsMultisig: true,
    confirmationsRequired: 12,
  },

  // Celo Mainnet
  42220: {
    chainId: 42220,
    name: 'Celo Mainnet',
    symbol: 'CELO',
    decimals: 18,
    rpcUrl: 'https://forno.celo.org',
    wsRpcUrl: 'wss://forno.celo.org',
    explorerUrl: 'https://explorer.celo.org',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/celo/info/logo.png',
    uniswapV3Router: '0x5615CDAb10dc425a742d643d949f7F474C6166d8',
    commonTokens: {
      stablecoin: '0x765DE816845861e75A25fCA122bb6bAA735501f7', // cUSD
      wrapped: '0x471EcE3750Da237f93B8E339c536aB5Ff1468DEB', // WCELO
      governance: '0x73a90a4ce72797d1dd9ca10342cca623437b8a6a', // CELO
    },
    supportsEIP1559: false,
    supportsFlashLoan: true,
    supportsMultisig: true,
    estimatedBlockTime: 5,
  },

  // Celo Alfajores Testnet
  44787: {
    chainId: 44787,
    name: 'Celo Alfajores',
    symbol: 'CELO',
    decimals: 18,
    rpcUrl: 'https://alfajores-forno.celo-testnet.org',
    explorerUrl: 'https://alfajores-blockscout.celo-testnet.org',
    commonTokens: {
      stablecoin: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1', // cUSD
      wrapped: '0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9', // cEUR
      governance: '0x7037F7296B2fc7908de7b57a89efaa8319f0C500', // mCELO
    },
    supportsEIP1559: false,
    supportsFlashLoan: false,
    supportsMultisig: true,
    estimatedBlockTime: 5,
  },

  // Polygon (Matic) Mainnet
  137: {
    chainId: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    decimals: 18,
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
    uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    aavePoolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    commonTokens: {
      stablecoin: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
      wrapped: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
    },
    supportsEIP1559: true,
    supportsFlashLoan: true,
    supportsMultisig: true,
    confirmationsRequired: 128,
  },

  // Polygon Mumbai Testnet
  80001: {
    chainId: 80001,
    name: 'Polygon Mumbai',
    symbol: 'MATIC',
    decimals: 18,
    rpcUrl: 'https://rpc-mumbai.maticvigil.com',
    explorerUrl: 'https://mumbai.polygonscan.com',
    commonTokens: {
      stablecoin: '0xe11A86849d11F0B42F5386DA0F0B89176eC3d853', // Test USDC
      wrapped: '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889', // WMATIC
    },
    supportsEIP1559: true,
    supportsFlashLoan: false,
    supportsMultisig: true,
  },

  // Arbitrum One
  42161: {
    chainId: 42161,
    name: 'Arbitrum One',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
    uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    commonTokens: {
      stablecoin: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5F8f', // USDC
      wrapped: '0x82aF49447d8a07e3bd95bd0d56f313302c4d8f13', // WETH
    },
    supportsEIP1559: false, // Arbitrum uses its own gas system
    supportsFlashLoan: true,
    supportsMultisig: true,
    estimatedBlockTime: 0.25,
  },

  // Base
  8453: {
    chainId: 8453,
    name: 'Base',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
    commonTokens: {
      stablecoin: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      wrapped: '0x4200000000000000000000000000000000000006', // WETH
    },
    supportsEIP1559: true,
    supportsFlashLoan: false,
    supportsMultisig: true,
  },

  // Optimism
  10: {
    chainId: 10,
    name: 'Optimism',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png',
    uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    commonTokens: {
      stablecoin: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // USDC
      wrapped: '0x4200000000000000000000000000000000000006', // WETH
    },
    supportsEIP1559: false,
    supportsFlashLoan: true,
    supportsMultisig: true,
  },
};

/**
 * Chain Manager - Handle multi-chain operations
 */
export class ChainManager {
  private currentChainId: number = 1; // Default to Ethereum Mainnet
  private supportedChains: Set<number>;

  constructor(chainIds?: number[]) {
    // Default to all supported chains if not specified
    this.supportedChains = new Set(chainIds || Object.keys(SUPPORTED_CHAINS).map(Number));
  }

  /**
   * Get configuration for a chain
   */
  getChainConfig(chainId: number): ChainConfig {
    const config = SUPPORTED_CHAINS[chainId];
    if (!config) {
      throw new Error(`Chain ${chainId} is not supported`);
    }
    return config;
  }

  /**
   * Check if chain is supported
   */
  isChainSupported(chainId: number): boolean {
    return this.supportedChains.has(chainId);
  }

  /**
   * Get all supported chains
   */
  getSupportedChains(): ChainConfig[] {
    return Array.from(this.supportedChains)
      .map(chainId => this.getChainConfig(chainId))
      .sort((a, b) => a.chainId - b.chainId);
  }

  /**
   * Switch to a different chain
   */
  switchChain(chainId: number): ChainConfig {
    if (!this.isChainSupported(chainId)) {
      throw new Error(`Cannot switch to unsupported chain ${chainId}`);
    }
    this.currentChainId = chainId;
    return this.getChainConfig(chainId);
  }

  /**
   * Get current chain
   */
  getCurrentChain(): ChainConfig {
    return this.getChainConfig(this.currentChainId);
  }

  /**
   * Get current chain ID
   */
  getCurrentChainId(): number {
    return this.currentChainId;
  }

  /**
   * Get chain by name
   */
  getChainByName(name: string): ChainConfig | null {
    const chain = Object.values(SUPPORTED_CHAINS).find(
      c => c.name.toLowerCase() === name.toLowerCase()
    );
    return chain || null;
  }

  /**
   * Get testnet chains only
   */
  getTestnets(): ChainConfig[] {
    return this.getSupportedChains().filter(chain =>
      chain.name.includes('Testnet') || chain.name.includes('Sepolia') || chain.name.includes('Alfajores') || chain.name.includes('Mumbai')
    );
  }

  /**
   * Get mainnet chains only
   */
  getMainnets(): ChainConfig[] {
    return this.getSupportedChains().filter(chain =>
      !chain.name.includes('Testnet') && !chain.name.includes('Sepolia') && !chain.name.includes('Alfajores') && !chain.name.includes('Mumbai')
    );
  }
}

export const createChainManager = (chainIds?: number[]): ChainManager => {
  return new ChainManager(chainIds);
};
