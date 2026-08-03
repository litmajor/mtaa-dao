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

export type BalanceCategory = 'native' | 'tokens' | 'investment-pools' | 'vaults' | 'staking'

export interface WalletProvider {
  id: 'metamask' | 'valora' | 'minipay' | 'internal'
  name: string
  icon: string
  isConnected: boolean
  address?: string
  chainId?: number
}

export interface NativeBalance {
  amount: string
  symbol: string
  valueUSD: string
}

export interface TokenBalance {
  symbol: string
  address: string
  amount: string
  valueUSD: string
  decimals: number
}

export interface InvestmentPoolBalance {
  poolId: string
  poolName: string
  shares: string
  sharePrice: string
  valueUSD: string
  apy: string
  poolAddress: string
}

export interface VaultBalance {
  vaultId: string
  vaultName: string
  type: 'personal' | 'shared'
  shares: string
  sharePrice: string
  valueUSD: string
  apy: string
  vaultAddress: string
}

export interface StakingRewards {
  totalStaked: string
  totalRewards: string
  valueUSD: string
}

export interface BalanceBreakdown {
  nativeBalance: NativeBalance
  tokens: TokenBalance[]
  investmentPools: InvestmentPoolBalance[]
  vaults: VaultBalance[]
  stakingRewards: StakingRewards
}

export interface ProviderBalance {
  providerId: WalletProvider['id']
  chainId?: number
  address?: string
  native: NativeBalance
  tokens: TokenBalance[]
  totalValueUSD: string
}

export interface AggregatedBalance {
  totalValueUSD: string
  totalValueByCurrency: Record<string, string>
  breakdown: BalanceBreakdown
  providerBalances: ProviderBalance[]
  providers: WalletProvider[]
  lastUpdated: Date
  isLoading: boolean
  error?: string
}

export interface AggregatedBalanceRequest {
  userAddress: string
  chainId?: number
  includeCategories: BalanceCategory[]
}

export interface AggregatedBalanceResponse {
  totalValueUSD: string
  totalValueByCurrency: Record<string, string>
  breakdown: BalanceBreakdown
  providerBalances: ProviderBalance[]
  providers?: WalletProvider[]
}

export default {} as const
