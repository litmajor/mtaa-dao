import { ethers } from 'ethers';

export enum SupportedChain {
  CELO = 'celo',
  CELO_ALFAJORES = 'celo-alfajores',
  ETHEREUM = 'ethereum',
  POLYGON = 'polygon',
  POLYGON_AMOY = 'polygon-amoy', // FIX: Upgraded from deprecated Mumbai testnet to Amoy
  BSC = 'bsc',
  BSC_TESTNET = 'bsc-testnet',
  OPTIMISM = 'optimism',
  ARBITRUM = 'arbitrum',
  TRON = 'tron',
  TRON_SHASTA = 'tron-shasta',
  TON = 'ton',
  TON_TESTNET = 'ton-testnet'
}

// FIX: Added distinct architecture types to protect execution loops
export type ChainArchitecture = 'evm' | 'tvm' | 'ton';

export interface ChainConfig {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  blockExplorer: string;
  architecture: ChainArchitecture; // FIX: Strict type tag for safe dynamic dispatch routing
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  bridgeContract?: string;
  vaultFactory?: string;
  governanceContract?: string;
  isTestnet: boolean;
}

export const CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = {
  [SupportedChain.CELO]: {
    chainId: 42220,
    name: 'Celo Mainnet',
    symbol: 'CELO',
    rpcUrl: 'https://forno.celo.org',
    blockExplorer: 'https://celoscan.io',
    architecture: 'evm',
    nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
    isTestnet: false
  },
  [SupportedChain.CELO_ALFAJORES]: {
    chainId: 44787,
    name: 'Celo Alfajores Testnet',
    symbol: 'CELO',
    rpcUrl: 'https://alfajores-forno.celo-testnet.org',
    blockExplorer: 'https://alfajores.celoscan.io',
    architecture: 'evm',
    nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
    isTestnet: true
  },
  [SupportedChain.ETHEREUM]: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    symbol: 'ETH',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    architecture: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: false
  },
  [SupportedChain.POLYGON]: {
    chainId: 137,
    name: 'Polygon Mainnet',
    symbol: 'MATIC',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    architecture: 'evm',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    isTestnet: false
  },
  [SupportedChain.POLYGON_AMOY]: {
    chainId: 80002, // FIX: Updated to correct Amoy network specification ID
    name: 'Polygon Amoy Testnet',
    symbol: 'MATIC',
    rpcUrl: process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.gateway.fm',
    blockExplorer: 'https://amoy.polygonscan.com',
    architecture: 'evm',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    isTestnet: true
  },
  [SupportedChain.BSC]: {
    chainId: 56,
    name: 'BNB Smart Chain Mainnet',
    symbol: 'BNB',
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    blockExplorer: 'https://bscscan.com',
    architecture: 'evm',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    isTestnet: false
  },
  [SupportedChain.BSC_TESTNET]: {
    chainId: 97,
    name: 'BSC Testnet',
    symbol: 'BNB',
    rpcUrl: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
    blockExplorer: 'https://testnet.bscscan.com',
    architecture: 'evm',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    isTestnet: true
  },
  [SupportedChain.OPTIMISM]: {
    chainId: 10,
    name: 'Optimism Mainnet',
    symbol: 'ETH',
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    architecture: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: false
  },
  [SupportedChain.ARBITRUM]: {
    chainId: 42161,
    name: 'Arbitrum One',
    symbol: 'ETH',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    architecture: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: false
  },
  [SupportedChain.TRON]: {
    chainId: 728126428,
    name: 'TRON Mainnet',
    symbol: 'TRX',
    rpcUrl: process.env.TRON_RPC_URL || 'https://api.trongrid.io',
    blockExplorer: 'https://tronscan.org',
    architecture: 'tvm', // FIX: Explicitly separated from standard EVM routing configurations
    nativeCurrency: { name: 'Tronix', symbol: 'TRX', decimals: 6 },
    isTestnet: false
  },
  [SupportedChain.TRON_SHASTA]: {
    chainId: 2494104990,
    name: 'TRON Shasta Testnet',
    symbol: 'TRX',
    rpcUrl: process.env.TRON_SHASTA_RPC_URL || 'https://api.shasta.trongrid.io',
    blockExplorer: 'https://shasta.tronscan.org',
    architecture: 'tvm',
    nativeCurrency: { name: 'Tronix', symbol: 'TRX', decimals: 6 },
    isTestnet: true
  },
  [SupportedChain.TON]: {
    chainId: 0,
    name: 'TON Mainnet',
    symbol: 'TON',
    rpcUrl: process.env.TON_RPC_URL || 'https://toncenter.com/api/v2/jsonRPC',
    blockExplorer: 'https://tonscan.org',
    architecture: 'ton', // FIX: Declared dedicated architecture model
    nativeCurrency: { name: 'Toncoin', symbol: 'TON', decimals: 9 },
    isTestnet: false
  },
  [SupportedChain.TON_TESTNET]: {
    chainId: 1,
    name: 'TON Testnet',
    symbol: 'TON',
    rpcUrl: process.env.TON_TESTNET_RPC_URL || 'https://testnet.toncenter.com/api/v2/jsonRPC',
    blockExplorer: 'https://testnet.tonscan.org',
    architecture: 'ton',
    nativeCurrency: { name: 'Toncoin', symbol: 'TON', decimals: 9 },
    isTestnet: true
  }
};

export class ChainRegistry {
  private static evmProviders: Map<SupportedChain, ethers.JsonRpcProvider> = new Map();

  static getChainConfig(chain: SupportedChain): ChainConfig {
    return CHAIN_CONFIGS[chain];
  }

  /**
   * Safe EVM Provider Extractor.
   * FIX: Throws explicit compiler exceptions if invoked on Non-EVM network layers.
   */
  static getEVMProvider(chain: SupportedChain): ethers.JsonRpcProvider {
    const config = this.getChainConfig(chain);
    if (config.architecture !== 'evm') {
      throw new Error(`Execution error: Cannot instantiate ethers JSON-RPC wrapper for non-EVM protocol: ${chain}`);
    }

    if (!this.evmProviders.has(chain)) {
      this.evmProviders.set(chain, new ethers.JsonRpcProvider(config.rpcUrl));
    }
    return this.evmProviders.get(chain)!;
  }

  /**
   * Generic HttpClient parameters extractor for custom Non-EVM protocol clients (TronWeb/TonWeb)
   */
  static getGenericRpcUrl(chain: SupportedChain): string {
    return this.getChainConfig(chain).rpcUrl;
  }

  static getAllChains(): SupportedChain[] {
    return Object.values(SupportedChain);
  }

  static getMainnetChains(): SupportedChain[] {
    return this.getAllChains().filter(chain => !CHAIN_CONFIGS[chain].isTestnet);
  }

  static isTestnet(chain: SupportedChain): boolean {
    return CHAIN_CONFIGS[chain].isTestnet;
  }
}