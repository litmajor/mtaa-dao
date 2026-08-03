/**
 * useBalanceAggregator.ts (moved)
 * Aggregates balances across all wallet types and investment products
 */

import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import type {
  AggregatedBalance,
  AggregatedBalanceResponse,
  BalanceBreakdown,
  ProviderBalance,
  WalletProvider,
} from '@shared/types/wallet';

declare global {
  interface Window {
    ethereum?: any;
    solana?: any;
    celo?: any;
    minipay?: { isConnected?: boolean; address?: string };
  }
}

const initialProviders: WalletProvider[] = [
  { id: 'metamask', name: 'MetaMask', icon: '🦊', isConnected: false },
  { id: 'valora', name: 'Valora', icon: '💳', isConnected: false },
  { id: 'minipay', name: 'MiniPay', icon: '💰', isConnected: false },
  { id: 'internal', name: 'Internal Wallet', icon: '🔐', isConnected: false },
];

const initialAggregated: AggregatedBalance = {
  totalValueUSD: '0',
  totalValueByCurrency: {},
  breakdown: {
    nativeBalance: { amount: '0', symbol: 'ETH', valueUSD: '0' },
    tokens: [],
    investmentPools: [],
    vaults: [],
    stakingRewards: { totalStaked: '0', totalRewards: '0', valueUSD: '0' },
  },
  providerBalances: [],
  providers: initialProviders,
  lastUpdated: new Date(0),
  isLoading: false,
};

export const useBalanceAggregator = () => {
  const { address, isConnected, chainId } = useAccount();
  const [aggregated, setAggregated] = useState<AggregatedBalance>(initialAggregated);
  const [providers, setProviders] = useState<WalletProvider[]>(initialProviders);

  const fetchAggregatedBalances = useCallback(
    async (signal?: AbortSignal) => {
      if (!address) return;

      setAggregated((prev) => ({ ...prev, isLoading: true, error: undefined }));

      try {
        const response = await fetch('/api/v1/wallets/balance/aggregated', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal,
          body: JSON.stringify({
            userAddress: address,
            chainId,
            includeCategories: ['native', 'tokens', 'investment-pools', 'vaults', 'staking'],
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch aggregated balances');
        }

        const data = (await response.json()) as AggregatedBalanceResponse;
        const breakdown = data.breakdown;

        setAggregated((prev) => ({
          ...prev,
          totalValueUSD: data.totalValueUSD,
          totalValueByCurrency: data.totalValueByCurrency,
          breakdown,
          providerBalances: data.providerBalances,
          lastUpdated: new Date(),
          isLoading: false,
        }));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        console.error('Error fetching aggregated balances:', error);
        setAggregated((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    },
    [address, chainId]
  );

  useEffect(() => {
    if (!isConnected || !address) return;

    const controller = new AbortController();
    fetchAggregatedBalances(controller.signal);
    const interval = setInterval(() => fetchAggregatedBalances(controller.signal), 30000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [address, chainId, fetchAggregatedBalances, isConnected]);

  useEffect(() => {
    const detectProviders = async () => {
      const detected: WalletProvider[] = [
        {
          id: 'metamask',
          name: 'MetaMask',
          icon: '🦊',
          isConnected: Boolean(window.ethereum?.isMetaMask && isConnected && address),
          address: window.ethereum?.isMetaMask ? address : undefined,
        },
        {
          id: 'valora',
          name: 'Valora',
          icon: '💳',
          isConnected: false,
        },
        {
          id: 'minipay',
          name: 'MiniPay',
          icon: '💰',
          isConnected: Boolean(window.minipay?.isConnected),
          address: window.minipay?.address,
        },
        {
          id: 'internal',
          name: 'Internal Wallet',
          icon: '🔐',
          isConnected: Boolean(address),
          address: address || 'internal-wallet',
        },
      ];

      if (window.celo?.isValora && typeof window.celo.request === 'function') {
        try {
          const accounts = await window.celo.request({ method: 'eth_accounts' });
          detected[1].isConnected = Array.isArray(accounts) && accounts.length > 0;
        } catch {
          detected[1].isConnected = false;
        }
      }

      setProviders(detected);
    };

    detectProviders();
  }, [address, isConnected]);

  const getCategoryTotal = (category: keyof BalanceBreakdown) => {
    const value = aggregated.breakdown[category];

    if (Array.isArray(value)) {
      return value
        .reduce((total, item) => total + parseFloat(item.valueUSD ?? '0'), 0)
        .toFixed(2);
    }

    return 'valueUSD' in value ? value.valueUSD : '0';
  };

  const getProviderBalance = (providerId: WalletProvider['id']): string => {
    const providerBalance = aggregated.providerBalances.find((item) => item.providerId === providerId);
    return providerBalance ? providerBalance.totalValueUSD : '0';
  };

  return {
    ...aggregated,
    providers,
    refetch: fetchAggregatedBalances,
    getCategoryTotal,
    getProviderBalance,
  };
};

export default useBalanceAggregator;
