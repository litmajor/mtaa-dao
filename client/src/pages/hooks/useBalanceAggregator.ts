/**
 * useBalanceAggregator.ts
 * 
 * Aggregates balances across all wallet types and investment products
 * Supports multiple wallet providers: MetaMask, Valora, MiniPay, Internal Wallet
 * 
 * Balance Categories:
 * - Native wallet balance
 * - Investment pools (shares & value)
 * - Vaults (personal & shared)
 * - Staking rewards
 * - Token holdings
 */

import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

declare global {
  interface Window {
    ethereum?: any;
    solana?: any;
    celo?: any;
    minipay?: any;
  }
}

export interface WalletProvider {
  id: 'metamask' | 'valora' | 'minipay' | 'internal';
  name: string;
  icon: string;
  isConnected: boolean;
  address?: string;
  chainId?: number;
}

export interface BalanceBreakdown {
  // Core wallet
  nativeBalance: {
    amount: string;
    symbol: string;
    valueUSD: string;
  };
  
  // Tokens
  tokens: Array<{
    symbol: string;
    address: string;
    amount: string;
    valueUSD: string;
    decimals: number;
  }>;
  
  // Investment Pools
  investmentPools: Array<{
    poolId: string;
    poolName: string;
    shares: string;
    sharePrice: string;
    valueUSD: string;
    apy: string;
    poolAddress: string;
  }>;
  
  // Vaults
  vaults: Array<{
    vaultId: string;
    vaultName: string;
    type: 'personal' | 'shared';
    shares: string;
    sharePrice: string;
    valueUSD: string;
    apy: string;
    vaultAddress: string;
  }>;
  
  // Staking
  stakingRewards: {
    totalStaked: string;
    totalRewards: string;
    valueUSD: string;
  };
}

export interface AggregatedBalance {
  totalValueUSD: string;
  totalValueByCurrency: Record<string, string>;
  breakdown: BalanceBreakdown;
  providers: WalletProvider[];
  lastUpdated: Date;
  isLoading: boolean;
  error?: string;
}

export const useBalanceAggregator = () => {
  const { address, isConnected, chainId } = useAccount();
  const [aggregated, setAggregated] = useState<AggregatedBalance>({
    totalValueUSD: '0',
    totalValueByCurrency: {},
    breakdown: {
      nativeBalance: { amount: '0', symbol: 'ETH', valueUSD: '0' },
      tokens: [],
      investmentPools: [],
      vaults: [],
      stakingRewards: { totalStaked: '0', totalRewards: '0', valueUSD: '0' },
    },
    providers: [],
    lastUpdated: new Date(),
    isLoading: false,
  });

  const [providers, setProviders] = useState<WalletProvider[]>([
    {
      id: 'metamask',
      name: 'MetaMask',
      icon: '🦊',
      isConnected: false,
      address: undefined,
    },
    {
      id: 'valora',
      name: 'Valora',
      icon: '💳',
      isConnected: false,
      address: undefined,
    },
    {
      id: 'minipay',
      name: 'MiniPay',
      icon: '💰',
      isConnected: false,
      address: undefined,
    },
    {
      id: 'internal',
      name: 'Internal Wallet',
      icon: '🔐',
      isConnected: false,
      address: undefined,
    },
  ]);

  // Fetch all balances for current address
  const fetchAggregatedBalances = useCallback(async () => {
    if (!address) return;

    setAggregated((prev) => ({ ...prev, isLoading: true, error: undefined }));

    try {
      // Fetch from backend which aggregates across all sources
      const response = await fetch('/api/wallet/balances-aggregated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          chainId,
          includeCategories: [
            'native',
            'tokens',
            'investment-pools',
            'vaults',
            'staking',
          ],
        }),
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch aggregated balances');

      const data = await response.json();

      // Calculate totals
      let totalUSD = 0;
      const currencyTotals: Record<string, string> = {};

      // Sum all values
      totalUSD += parseFloat(data.breakdown.nativeBalance.valueUSD || '0');
      data.breakdown.tokens.forEach((token: any) => {
        totalUSD += parseFloat(token.valueUSD || '0');
        currencyTotals[token.symbol] = (
          parseFloat(currencyTotals[token.symbol] || '0') +
          parseFloat(token.amount || '0')
        ).toString();
      });
      data.breakdown.investmentPools.forEach((pool: any) => {
        totalUSD += parseFloat(pool.valueUSD || '0');
      });
      data.breakdown.vaults.forEach((vault: any) => {
        totalUSD += parseFloat(vault.valueUSD || '0');
      });
      totalUSD += parseFloat(data.breakdown.stakingRewards.valueUSD || '0');

      setAggregated({
        totalValueUSD: totalUSD.toFixed(2),
        totalValueByCurrency: currencyTotals,
        breakdown: data.breakdown,
        providers: data.providers || providers,
        lastUpdated: new Date(),
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching aggregated balances:', error);
      setAggregated((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [address, chainId, providers]);

  // Fetch when address or chainId changes
  useEffect(() => {
    if (isConnected && address) {
      fetchAggregatedBalances();
      // Refresh every 30 seconds
      const interval = setInterval(fetchAggregatedBalances, 30000);
      return () => clearInterval(interval);
    }
  }, [isConnected, address, chainId, fetchAggregatedBalances]);

  // Detect connected wallet providers
  useEffect(() => {
    const detectProviders = async () => {
      const detected = [...providers];

      // Check MetaMask
      if (window.ethereum?.isMetaMask) {
        detected[0].isConnected = isConnected && address ? true : false;
        detected[0].address = address;
      }

      // Check Valora
      if (window.celo?.isValora) {
        const valoraConnected = await checkValoraConnection();
        detected[1].isConnected = valoraConnected;
      }

      // Check MiniPay
      if (window.minipay?.isConnected) {
        detected[2].isConnected = true;
        detected[2].address = window.minipay.address;
      }

      // Internal wallet always available
      detected[3].isConnected = true;
      detected[3].address = address || 'internal-wallet';

      setProviders(detected);
    };

    detectProviders();
  }, [isConnected, address, providers]);

  const checkValoraConnection = async (): Promise<boolean> => {
    try {
      if (!window.celo?.isValora) return false;
      const accounts = await window.celo.request({ method: 'eth_accounts' });
      return accounts.length > 0;
    } catch {
      return false;
    }
  };

  return {
    ...aggregated,
    providers,
    refetch: fetchAggregatedBalances,
    getCategoryTotal: (category: keyof BalanceBreakdown) => {
      const cat = aggregated.breakdown[category];
      if (category === 'nativeBalance') {
        return (cat as any).valueUSD || '0';
      }
      if (category === 'stakingRewards') {
        return (cat as any).valueUSD || '0';
      }
      if (Array.isArray(cat)) {
        return cat
          .reduce((sum, item) => sum + parseFloat(item.valueUSD || '0'), 0)
          .toFixed(2);
      }
      return '0';
    },
    getProviderBalance: (providerId: WalletProvider['id']): string => {
      // Sum balance for specific provider
      const provider = providers.find((p) => p.id === providerId);
      if (!provider?.isConnected) return '0';

      // This would need more detailed tracking per provider
      return aggregated.totalValueUSD;
    },
  };
};

export default useBalanceAggregator;
