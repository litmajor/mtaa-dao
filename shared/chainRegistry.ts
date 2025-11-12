import { ethers } from 'ethers';

export enum SupportedChain {
  CELO = 'celo',
  CELO_ALFAJORES = 'celo-alfajores',
  ETHEREUM = 'ethereum',
  POLYGON = 'polygon',
  POLYGON_MUMBAI = 'polygon-mumbai',
  BSC = 'bsc',
  BSC_TESTNET = 'bsc-testnet',
  OPTIMISM = 'optimism',
  ARBITRUM = 'arbitrum'
}

export interface ChainConfig {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  blockExplorer: string;
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
    nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
    isTestnet: false
  },
  [SupportedChain.CELO_ALFAJORES]: {
    chainId: 44787,
    name: 'Celo Alfajores Testnet',
    symbol: 'CELO',
    rpcUrl: 'https://alfajores-forno.celo-testnet.org',
    blockExplorer: 'https://alfajores.celoscan.io',
    nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
    isTestnet: true
  },
  [SupportedChain.ETHEREUM]: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    symbol: 'ETH',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: false
  },
  [SupportedChain.POLYGON]: {
    chainId: 137,
    name: 'Polygon Mainnet',
    symbol: 'MATIC',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    isTestnet: false
  },
  [SupportedChain.POLYGON_MUMBAI]: {
    chainId: 80001,
    name: 'Polygon Mumbai Testnet',
    symbol: 'MATIC',
    rpcUrl: process.env.POLYGON_MUMBAI_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
    blockExplorer: 'https://mumbai.polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    isTestnet: true
  },
  [SupportedChain.BSC]: {
    chainId: 56,
    name: 'BNB Smart Chain Mainnet',
    symbol: 'BNB',
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    blockExplorer: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    isTestnet: false
  },
  [SupportedChain.BSC_TESTNET]: {
    chainId: 97,
    name: 'BSC Testnet',
    symbol: 'BNB',
    rpcUrl: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
    blockExplorer: 'https://testnet.bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    isTestnet: true
  },
  [SupportedChain.OPTIMISM]: {
    chainId: 10,
    name: 'Optimism Mainnet',
    symbol: 'ETH',
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: false
  },
  [SupportedChain.ARBITRUM]: {
    chainId: 42161,
    name: 'Arbitrum One',
    symbol: 'ETH',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: false
  }
};

export class ChainRegistry {
  private static providers: Map<SupportedChain, ethers.JsonRpcProvider> = new Map();

  static getChainConfig(chain: SupportedChain): ChainConfig {
    return CHAIN_CONFIGS[chain];
  }

  static getProvider(chain: SupportedChain): ethers.JsonRpcProvider {
    if (!this.providers.has(chain)) {
      const config = this.getChainConfig(chain);
      this.providers.set(chain, new ethers.JsonRpcProvider(config.rpcUrl));
    }
    return this.providers.get(chain)!;
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