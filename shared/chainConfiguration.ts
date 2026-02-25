/**
 * Multi-Chain Configuration for MTAA-DAO
 * Defines RPC endpoints, gas configurations, block explorers, and bridge protocols for all 7 supported chains
 * Phase 1: Foundation for cross-chain withdrawal service
 */

export type SupportedChain = 'ethereum' | 'bsc' | 'polygon' | 'arbitrum' | 'optimism' | 'tron' | 'avalanche';

export interface GasConfiguration {
  low: number;        // Gwei (for ETH/BSC/Polygon/etc) or Sun (for Tron)
  standard: number;
  fast: number;
  estimatedCostUSD: {
    native: number;   // USD cost for native token transfer
    erc20: number;    // USD cost for ERC20 transfer (higher due to complexity)
  };
}

export interface BridgeProtocolConfig {
  protocol: 'layerzero' | 'axelar' | 'wormhole' | 'stargate';
  feePercentage: number;    // 0.3-0.5%
  estimatedLatency: number; // seconds
  minAmount: string;        // Minimum bridge amount
  maxAmount: string;        // Maximum bridge amount
  active: boolean;
}

export interface ChainConfig {
  // Chain identification
  id: SupportedChain;
  name: string;
  chainId: number;           // EVM chain ID (not applicable for Tron)
  nativeToken: string;       // ETH, BNB, MATIC, TRX, AVAX
  nativeTokenDecimals: number;
  
  // RPC Configuration
  rpc: {
    mainnet: string;
    testnet: string;
  };
  wsRpc?: {
    mainnet: string;
    testnet: string;
  };
  
  // Block explorer
  blockExplorer: {
    mainnet: string;
    testnet: string;
  };
  
  // Gas configuration
  gas: GasConfiguration;
  
  // Block timing (for confirmation estimates)
  blockTime: number;         // seconds per block
  requiredConfirmations: number; // blocks needed for finality
  
  // Token standard
  tokenStandard: 'ERC20' | 'BEP20' | 'ERC20-L2' | 'TRC20';
  
  // Bridge support (which bridges this chain supports)
  bridges: BridgeProtocolConfig[];
  
  // General chain info
  isTestnet?: boolean;
  isLayer2?: boolean;        // Optimism, Arbitrum
  isNonEVM?: boolean;        // Tron
  riskLevel: 'low' | 'medium' | 'high';
  liquidity: 'high' | 'medium' | 'low';
}

/**
 * Comprehensive configuration for all 7 supported chains
 */
export const CHAIN_CONFIG: Record<SupportedChain, ChainConfig> = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum Mainnet',
    chainId: 1,
    nativeToken: 'ETH',
    nativeTokenDecimals: 18,
    rpc: {
      mainnet: process.env.ETH_RPC_URL || 'https://eth.blockscout.com',
      testnet: process.env.ETH_TESTNET_RPC_URL || 'https://sepolia.infura.io/v3/YOUR-PROJECT-ID'
    },
    wsRpc: {
      mainnet: process.env.ETH_WS_RPC_URL || 'wss://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY',
      testnet: process.env.ETH_TESTNET_WS_RPC_URL || 'wss://sepolia.infura.io/ws/v3/YOUR-PROJECT-ID'
    },
    blockExplorer: {
      mainnet: 'https://etherscan.io',
      testnet: 'https://sepolia.etherscan.io'
    },
    gas: {
      low: 40,
      standard: 50,
      fast: 70,
      estimatedCostUSD: {
        native: 1.5,   // ~$1.50 for 21k gas at 50 gwei
        erc20: 2.5     // ~$2.50 for 65k gas
      }
    },
    blockTime: 12,
    requiredConfirmations: 12,
    tokenStandard: 'ERC20',
    bridges: [
      {
        protocol: 'layerzero',
        feePercentage: 0.3,
        estimatedLatency: 300,
        minAmount: '1',
        maxAmount: '1000000',
        active: true
      },
      {
        protocol: 'wormhole',
        feePercentage: 0.4,
        estimatedLatency: 600,
        minAmount: '1',
        maxAmount: '1000000',
        active: true
      }
    ],
    isLayer2: false,
    isNonEVM: false,
    riskLevel: 'low',
    liquidity: 'high'
  },

  bsc: {
    id: 'bsc',
    name: 'Binance Smart Chain',
    chainId: 56,
    nativeToken: 'BNB',
    nativeTokenDecimals: 18,
    rpc: {
      mainnet: process.env.BSC_RPC_URL || 'https://bsc.blockscout.com',
      testnet: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-b.binance.org:8545'
    },
    wsRpc: {
      mainnet: process.env.BSC_WS_RPC_URL || 'wss://bsc-mainnet.nodereal.io/ws',
      testnet: process.env.BSC_TESTNET_WS_RPC_URL || 'wss://data-seed-prebsc-1-b.binance.org:8545'
    },
    blockExplorer: {
      mainnet: 'https://bscscan.com',
      testnet: 'https://testnet.bscscan.com'
    },
    gas: {
      low: 3,
      standard: 5,
      fast: 8,
      estimatedCostUSD: {
        native: 0.12,  // ~$0.12 for 21k gas at 5 gwei ($400 BNB)
        erc20: 0.25    // ~$0.25 for 65k gas
      }
    },
    blockTime: 3,
    requiredConfirmations: 20,
    tokenStandard: 'BEP20',
    bridges: [
      {
        protocol: 'layerzero',
        feePercentage: 0.3,
        estimatedLatency: 300,
        minAmount: '1',
        maxAmount: '1000000',
        active: true
      },
      {
        protocol: 'axelar',
        feePercentage: 0.4,
        estimatedLatency: 180,
        minAmount: '1',
        maxAmount: '1000000',
        active: true
      }
    ],
    isLayer2: false,
    isNonEVM: false,
    riskLevel: 'low',
    liquidity: 'high'
  },

  polygon: {
    id: 'polygon',
    name: 'Polygon (Matic)',
    chainId: 137,
    nativeToken: 'MATIC',
    nativeTokenDecimals: 18,
    rpc: {
      mainnet: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      testnet: process.env.POLYGON_TESTNET_RPC_URL || 'https://rpc-mumbai.maticvigil.com'
    },
    wsRpc: {
      mainnet: process.env.POLYGON_WS_RPC_URL || 'wss://polygon-mainnet.g.alchemy.com/v2/YOUR-API-KEY',
      testnet: process.env.POLYGON_TESTNET_WS_RPC_URL || 'wss://ws-mumbai.matic.today'
    },
    blockExplorer: {
      mainnet: 'https://polygonscan.com',
      testnet: 'https://mumbai.polygonscan.com'
    },
    gas: {
      low: 30,
      standard: 40,
      fast: 60,
      estimatedCostUSD: {
        native: 0.08,  // ~$0.08 for 21k gas at 40 gwei ($2 MATIC)
        erc20: 0.15    // ~$0.15 for 65k gas
      }
    },
    blockTime: 2,
    requiredConfirmations: 128,  // Needs more for PoS finality
    tokenStandard: 'ERC20',
    bridges: [
      {
        protocol: 'layerzero',
        feePercentage: 0.4,
        estimatedLatency: 300,
        minAmount: '1',
        maxAmount: '1000000',
        active: true
      },
      {
        protocol: 'axelar',
        feePercentage: 0.4,
        estimatedLatency: 180,
        minAmount: '1',
        maxAmount: '1000000',
        active: true
      }
    ],
    isLayer2: false,
    isNonEVM: false,
    riskLevel: 'low',
    liquidity: 'high'
  },

  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum One',
    chainId: 42161,
    nativeToken: 'ETH',
    nativeTokenDecimals: 18,
    rpc: {
      mainnet: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
      testnet: process.env.ARBITRUM_TESTNET_RPC_URL || 'https://goerli-rollup.arbitrum.io/rpc'
    },
    wsRpc: {
      mainnet: process.env.ARBITRUM_WS_RPC_URL || 'wss://arb1.arbitrum.io/ws',
      testnet: process.env.ARBITRUM_TESTNET_WS_RPC_URL || 'wss://goerli-rollup.arbitrum.io/ws'
    },
    blockExplorer: {
      mainnet: 'https://arbiscan.io',
      testnet: 'https://goerli.arbiscan.io'
    },
    gas: {
      low: 0.1,
      standard: 0.5,
      fast: 1,
      estimatedCostUSD: {
        native: 0.02,  // ~$0.02 for 21k gas at L2 rates
        erc20: 0.05    // ~$0.05 for 65k gas (includes data cost)
      }
    },
    blockTime: 0.25,  // Very fast, but data submission slower
    requiredConfirmations: 1,     // Fast finality on L2
    tokenStandard: 'ERC20-L2',
    bridges: [
      {
        protocol: 'layerzero',
        feePercentage: 0.35,
        estimatedLatency: 300,
        minAmount: '0.1',
        maxAmount: '1000000',
        active: true
      }
    ],
    isLayer2: true,
    isNonEVM: false,
    riskLevel: 'low',
    liquidity: 'high'
  },

  optimism: {
    id: 'optimism',
    name: 'Optimism',
    chainId: 10,
    nativeToken: 'ETH',
    nativeTokenDecimals: 18,
    rpc: {
      mainnet: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
      testnet: process.env.OPTIMISM_TESTNET_RPC_URL || 'https://goerli.optimism.io'
    },
    wsRpc: {
      mainnet: process.env.OPTIMISM_WS_RPC_URL || 'wss://mainnet.optimism.io',
      testnet: process.env.OPTIMISM_TESTNET_WS_RPC_URL || 'wss://goerli.optimism.io'
    },
    blockExplorer: {
      mainnet: 'https://optimistic.etherscan.io',
      testnet: 'https://goerli-optimism.etherscan.io'
    },
    gas: {
      low: 0.1,
      standard: 0.5,
      fast: 1,
      estimatedCostUSD: {
        native: 0.03,  // ~$0.03 including data submission fee
        erc20: 0.08    // ~$0.08 for complex tx
      }
    },
    blockTime: 2,
    requiredConfirmations: 1,
    tokenStandard: 'ERC20-L2',
    bridges: [
      {
        protocol: 'layerzero',
        feePercentage: 0.35,
        estimatedLatency: 300,
        minAmount: '0.1',
        maxAmount: '1000000',
        active: true
      }
    ],
    isLayer2: true,
    isNonEVM: false,
    riskLevel: 'low',
    liquidity: 'medium'
  },

  tron: {
    id: 'tron',
    name: 'TRON Mainnet',
    chainId: -1,  // Not applicable for Tron
    nativeToken: 'TRX',
    nativeTokenDecimals: 6,   // Tron uses 6 decimals
    rpc: {
      mainnet: process.env.TRON_RPC_URL || 'https://api.trongrid.io',
      testnet: process.env.TRON_TESTNET_RPC_URL || 'https://api.shasta.trongrid.io'
    },
    wsRpc: {
      mainnet: process.env.TRON_WS_RPC_URL || 'https://api.trongrid.io',
      testnet: process.env.TRON_TESTNET_WS_RPC_URL || 'https://api.shasta.trongrid.io'
    },
    blockExplorer: {
      mainnet: 'https://tronscan.org',
      testnet: 'https://shasta.tronscan.org'
    },
    gas: {
      low: 0.0001,     // Sun (1 TRX = 1,000,000 Sun)
      standard: 0.001,
      fast: 0.01,
      estimatedCostUSD: {
        native: 0.00015,  // ~$0.00015 for basic transfer (very cheap)
        erc20: 0.001      // ~$0.001 for TRC20 (still very cheap)
      }
    },
    blockTime: 3,
    requiredConfirmations: 19,  // Tron requires 19 confirmations
    tokenStandard: 'TRC20',
    bridges: [
      {
        protocol: 'layerzero',
        feePercentage: 0.5,
        estimatedLatency: 600,
        minAmount: '1',
        maxAmount: '50000',
        active: false  // Limited bridge support for Tron
      }
    ],
    isLayer2: false,
    isNonEVM: true,   // Non-EVM chain
    riskLevel: 'medium',
    liquidity: 'medium'
  },

  avalanche: {
    id: 'avalanche',
    name: 'Avalanche C-Chain',
    chainId: 43114,
    nativeToken: 'AVAX',
    nativeTokenDecimals: 18,
    rpc: {
      mainnet: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
      testnet: process.env.AVALANCHE_TESTNET_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc'
    },
    wsRpc: {
      mainnet: process.env.AVALANCHE_WS_RPC_URL || 'wss://api.avax.network/ext/bc/C/ws',
      testnet: process.env.AVALANCHE_TESTNET_WS_RPC_URL || 'wss://api.avax-test.network/ext/bc/C/ws'
    },
    blockExplorer: {
      mainnet: 'https://snowtrace.io',
      testnet: 'https://testnet.snowtrace.io'
    },
    gas: {
      low: 25,
      standard: 35,
      fast: 55,
      estimatedCostUSD: {
        native: 0.10,  // ~$0.10 for 21k gas at 35 gwei ($50 AVAX)
        erc20: 0.20    // ~$0.20 for 65k gas
      }
    },
    blockTime: 2,
    requiredConfirmations: 1,
    tokenStandard: 'ERC20',
    bridges: [
      {
        protocol: 'layerzero',
        feePercentage: 0.35,
        estimatedLatency: 300,
        minAmount: '1',
        maxAmount: '1000000',
        active: true
      }
    ],
    isLayer2: false,
    isNonEVM: false,
    riskLevel: 'low',
    liquidity: 'medium'
  }
};

/**
 * Get chain configuration by ID
 */
export function getChainConfig(chainId: SupportedChain | number): ChainConfig | null {
  if (typeof chainId === 'string') {
    return CHAIN_CONFIG[chainId] || null;
  }

  // Find by EVM chain ID
  return Object.values(CHAIN_CONFIG).find(chain => chain.chainId === chainId) || null;
}

/**
 * Get all active chains
 */
export function getAllChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIG);
}

/**
 * Get RPC URL for specific chain and network
 */
export function getRpcUrl(chain: SupportedChain, network: 'mainnet' | 'testnet' = 'mainnet'): string {
  const config = CHAIN_CONFIG[chain];
  if (!config) throw new Error(`Unknown chain: ${chain}`);
  return config.rpc[network];
}

/**
 * Get WebSocket RPC URL (if available)
 */
export function getWsRpcUrl(chain: SupportedChain, network: 'mainnet' | 'testnet' = 'mainnet'): string | undefined {
  const config = CHAIN_CONFIG[chain];
  if (!config) throw new Error(`Unknown chain: ${chain}`);
  return config.wsRpc?.[network];
}

/**
 * Get estimated gas cost in USD for a specific chain
 */
export function estimateGasCostUSD(chain: SupportedChain, isNativeTransfer: boolean = true): number {
  const config = CHAIN_CONFIG[chain];
  if (!config) throw new Error(`Unknown chain: ${chain}`);
  return isNativeTransfer ? config.gas.estimatedCostUSD.native : config.gas.estimatedCostUSD.erc20;
}

/**
 * Get best bridge protocol for cross-chain transfer
 */
export function getBestBridge(
  sourceChain: SupportedChain,
  targetChain: SupportedChain,
  priority: 'cost' | 'speed' = 'cost'
): BridgeProtocolConfig | null {
  const sourceConfig = CHAIN_CONFIG[sourceChain];
  if (!sourceConfig) return null;

  const activeBridges = sourceConfig.bridges.filter(b => b.active);
  if (activeBridges.length === 0) return null;

  if (priority === 'cost') {
    return activeBridges.reduce((best, current) =>
      current.feePercentage < best.feePercentage ? current : best
    );
  } else {
    return activeBridges.reduce((best, current) =>
      current.estimatedLatency < best.estimatedLatency ? current : best
    );
  }
}
