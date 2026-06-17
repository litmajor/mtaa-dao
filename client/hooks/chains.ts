export type ChainConfig = {
  id: number
  name: string
  rpcUrls?: string[]
  explorer?: string
  nativeCurrency?: {
    name: string
    symbol: string
    decimals: number
  }
}

// Use Vite env variables (VITE_RPC_<CHAINID>) when available, otherwise fall back to public endpoints.
const env = (globalThis as any).import.meta?.env || ({} as Record<string, string>)

function rpcEnv(chainId: number, fallback: string) {
  const key = `VITE_RPC_${chainId}`
  return env[key] || fallback
}

export const CHAINS: Record<number, ChainConfig> = {
  1: {
    id: 1,
    name: 'Ethereum Mainnet',
    rpcUrls: [rpcEnv(1, 'https://cloudflare-eth.com')],
    explorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  },
  11155111: {
    id: 11155111,
    name: 'Ethereum Sepolia',
    rpcUrls: [rpcEnv(11155111, 'https://rpc.sepolia.org')],
    explorer: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  },
  42161: {
    id: 42161,
    name: 'Arbitrum One',
    rpcUrls: [rpcEnv(42161, 'https://arb1.arbitrum.io/rpc')],
    explorer: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  },
  42220: {
    id: 42220,
    name: 'Celo Mainnet',
    rpcUrls: [rpcEnv(42220, 'https://forno.celo.org')],
    explorer: 'https://explorer.celo.org',
    nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 }
  },
  44787: {
    id: 44787,
    name: 'Celo Alfajores',
    rpcUrls: [rpcEnv(44787, 'https://alfajores-forno.celo-testnet.org')],
    explorer: 'https://alfajores-blockscout.celo-testnet.org',
    nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 }
  },
  137: {
    id: 137,
    name: 'Polygon',
    rpcUrls: [rpcEnv(137, 'https://polygon-rpc.com')],
    explorer: 'https://polygonscan.com',
    nativeCurrency: { name: 'Matic', symbol: 'MATIC', decimals: 18 }
  },
  80001: {
    id: 80001,
    name: 'Polygon Mumbai',
    rpcUrls: [rpcEnv(80001, 'https://rpc-mumbai.maticvigil.com')],
    explorer: 'https://mumbai.polygonscan.com',
    nativeCurrency: { name: 'Matic', symbol: 'MATIC', decimals: 18 }
  },
  8453: {
    id: 8453,
    name: 'Base',
    rpcUrls: [rpcEnv(8453, 'https://mainnet.base.org')],
    explorer: 'https://basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  },
  10: {
    id: 10,
    name: 'Optimism',
    rpcUrls: [rpcEnv(10, 'https://mainnet.optimism.io')],
    explorer: 'https://optimistic.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  }
}

export function getChainConfig(chainId: number): ChainConfig | undefined {
  return CHAINS[chainId]
}
