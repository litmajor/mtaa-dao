// Shared wallet-related types used by client and server

export type SelectedAccount = {
  id?: string
  address: string
  label?: string
  name?: string
  type?: 'wallet' | 'trading' | 'vault' | 'escrow' | string
  balance?: string | number
  currency?: string
}

export type Transaction = {
  id?: string
  hash?: string
  status?: 'pending' | 'processing' | 'confirmed' | 'failed' | string
  from?: string
  to?: string
  amount?: string | number
  timestamp?: number
  meta?: Record<string, unknown>
  // Additional fields used by client UI
  type?: 'received' | 'sent' | 'swap' | 'deposit' | 'withdrawal' | string
  timeAgo?: string | number
  time?: string | number | Date
  description?: string
  memo?: string
}

export type NetworkInfo = {
  chainId: number
  latestBlock?: number
  gasPrice?: number
  connected?: boolean
  error?: string
  networkName?: string
  explorerUrl?: string
}

export type WalletBalance = {
  native: bigint | number | string
  nativeFormatted?: number
  nativeUsd?: number
}

export type TokenInfo = {
  symbol: string
  name?: string
  decimals: number
  balance: string
  balanceFormatted?: number
  error?: string
  priceUsd?: number
  totalSupply?: string
}

export type TokenBalance = {
  address: string
  symbol: string
  balance: string
  balanceFormatted?: number
  valueUsd?: number
}

export type Portfolio = {
  address: string
  nativeBalance: number
  nativeBalanceUsd?: number
  tokens: Record<string, TokenInfo>
  networkInfo?: NetworkInfo
  totalValueUsd?: number
  lastUpdated?: number
}

export type PortfolioSnapshot = {
  timestamp: number
  nativeBalance: number
  tokenBalances: Record<string, TokenInfo>
  totalValueUsd: number
}

export default {} as const
