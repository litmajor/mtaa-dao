/**
 * React Hook for Wallet Connection
 * 
 * useWallet - Complete wallet state management and connection
 * useChainSwitcher - Multi-chain switching
 */

'use client'; // For Next.js

import { useState, useCallback, useEffect, useContext, createContext } from 'react';
import type Web3 from 'web3';
import { getChainConfig } from './chains';
import { portfolioService, type PortfolioState } from '../services/portfolioService';

// Basic account and provider types
export type Account = { address: string; chainId?: number; balance?: string } | null

export type WalletConnectResult = { success: boolean; account?: Account; error?: string }

export type WalletProvider = { id?: string; name?: string; raw?: unknown }

type WindowEthereumShim = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>
  on?: (event: string, cb: (...args: unknown[]) => void) => void
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void
  isMetaMask?: boolean
  [k: string]: unknown
}

/**
 * Wallet Connection State
 */
export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  balance: string | null;
  balanceEth: number | null;
  isLoading: boolean;
  error: string | null;
  web3: Web3 | null;
  account: Account | null;
}

/**
 * Wallet Context Type
 */
export interface WalletContextType extends WalletState {
  connect: (provider?: WalletProvider | WindowEthereumShim) => Promise<void>;
  disconnect: () => void;
  switchChain: (chainId: number) => Promise<void>;
  getBalance: () => Promise<string>;
  clear: () => void;
}

// Create context
export const WalletContext = createContext<WalletContextType | undefined>(undefined);

/**
 * useWallet - Hook for wallet operations
 */
export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}

/**
 * WalletProvider Component
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    chainId: null,
    balance: null,
    balanceEth: null,
    isLoading: false,
    error: null,
    web3: null,
    account: null
  });

  /**
   * Connect wallet via MetaMask or other provider
   */
  const connect = useCallback(async (provider?: WalletProvider | WindowEthereumShim) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Try MetaMask first
      const ethereum = (provider as WindowEthereumShim) || (typeof window !== 'undefined' ? (window as unknown as { ethereum?: unknown }).ethereum as WindowEthereumShim | undefined : undefined);

      if (!ethereum) throw new Error('No wallet provider found. Please install MetaMask or similar.');

      // Request account access
      const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Get chain ID (cast to string to satisfy TS)
      const chainIdHex = (await ethereum.request({ method: 'eth_chainId' })) as string;
      const chainId = parseInt(chainIdHex, 16);

      // Initialize Web3 (dynamic import to avoid bundling it into main chunk)
      const Web3Module = await import('web3');
      // Support both ESM default and CJS exports
      // @ts-ignore
      const Web3Ctor: typeof Web3 = Web3Module.default || Web3Module;
      // @ts-ignore
      const web3 = new Web3Ctor(ethereum);
      // MetaMask returns an address, not a private key. Do NOT attempt to
      // derive an account from a private key. Store the address instead.
      const address = Array.isArray(accounts) ? accounts[0] : (accounts as unknown as string);
      const account = { address } as Account;

      // Get balance
      const balance = await web3.eth.getBalance(accounts[0]);
      const balanceEth = Number(web3.utils.fromWei(balance, 'ether'));

      setState({
        isConnected: true,
        address: accounts[0],
        chainId,
        balance: balance.toString(),
        balanceEth,
        isLoading: false,
        error: null,
        web3,
        account
      });

      // Fetch portfolio for connected address (fire-and-forget)
      try {
        portfolioService.fetchPortfolio(address).then((portfolio: PortfolioState) => {
          try { window.dispatchEvent(new CustomEvent('portfolio:updated', { detail: portfolio })); } catch(e){}
        })
      } catch (e) {
        // ignore portfolio fetch errors
      }

      // Listen for account changes
      if (typeof ethereum.on === 'function') {
        try {
          ethereum.on('accountsChanged', (newAccounts: unknown) => {
            const arr = Array.isArray(newAccounts) ? (newAccounts as string[]) : [];
            if (arr.length === 0) {
              setState(prev => ({
                ...prev,
                isConnected: false,
                address: null,
                account: null
              }));
            } else {
              setState(prev => ({ ...prev, address: arr[0] }));
            }
          });
        } catch (e) {
          // ignore listener binding errors
        }
      }

      // Listen for chain changes
      if (typeof ethereum.on === 'function') {
        try {
          ethereum.on('chainChanged', (newChainId: unknown) => {
            if (typeof newChainId === 'string') setState(prev => ({ ...prev, chainId: parseInt(newChainId, 16) }));
          });
        } catch (e) {
          // ignore
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setState(prev => ({ ...prev, isLoading: false, error: msg }));
    }
  }, []);

  // Auto-reconnect: restore wallet state for returning users without prompting
  // (uses `eth_accounts` which does not show a permission popup).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as { ethereum?: WindowEthereumShim };
    const ethereum = w.ethereum;
    let mounted = true;
    if (!ethereum || typeof ethereum.request !== 'function') return;

    (async () => {
      try {
        const accounts = (await ethereum.request({ method: 'eth_accounts' })) as string[];
        const arr = Array.isArray(accounts) ? accounts : [];
        if (!mounted || arr.length === 0) return;

        // Get chain id and basic balance info, but don't request accounts (no popup)
        const chainIdHex = (await ethereum.request({ method: 'eth_chainId' })) as string;
        const chainId = parseInt(chainIdHex, 16);

        const Web3Module = await import('web3');
        // @ts-ignore
        const Web3Ctor: typeof Web3 = Web3Module.default || Web3Module;
        // @ts-ignore
        const web3 = new Web3Ctor(ethereum as any);
        const balance = await web3.eth.getBalance(arr[0]);
        const balanceEth = Number(web3.utils.fromWei(balance, 'ether'));

        setState(prev => ({
          ...prev,
          isConnected: true,
          address: arr[0],
          chainId,
          balance: balance.toString(),
          balanceEth,
          web3,
          account: { address: arr[0] }
        }));

        // Fetch portfolio on auto-reconnect
        try {
          portfolioService.fetchPortfolio(arr[0]).then((portfolio: PortfolioState) => {
            try { window.dispatchEvent(new CustomEvent('portfolio:updated', { detail: portfolio })); } catch(e){}
          })
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // ignore auto-reconnect errors
      }
    })();

    return () => { mounted = false };
  }, []);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      address: null,
      chainId: null,
      balance: null,
      balanceEth: null,
      isLoading: false,
      error: null,
      web3: null,
      account: null
    });
  }, []);

  /**
   * Switch to different chain
   */
  const switchChain = useCallback(async (chainId: number) => {
    try {
      const ethereum = (typeof window !== 'undefined' ? (window as any).ethereum : null);
      if (!ethereum) throw new Error('No wallet provider');

      const chainIdHex = '0x' + chainId.toString(16);

      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }]
        });
        // update local chain id on success
        setState(prev => ({ ...prev, chainId }));
      } catch (switchError: unknown) {
        // Chain not added, try to add it
        const se = switchError as { code?: number }
        if (se?.code === 4902) {
          const cfg = getChainConfig(chainId)
          if (!cfg) {
            throw new Error('Chain not found and no registry entry available.');
          }

          // Attempt to request the wallet to add the chain
          try {
            await ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: chainIdHex,
                chainName: cfg.name,
                rpcUrls: cfg.rpcUrls || [],
                nativeCurrency: cfg.nativeCurrency,
                blockExplorerUrls: cfg.explorer ? [cfg.explorer] : undefined
              }]
            });
            // After adding, attempt to switch again
            await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
            setState(prev => ({ ...prev, chainId }));
            return;
          } catch (addErr) {
            throw addErr;
          }
        }
        throw switchError;
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setState(prev => ({ ...prev, error: msg }));
    }
  }, []);

  /**
   * Get current balance
   */
  const getBalance = useCallback(async (): Promise<string> => {
    if (!state.web3 || !state.address) {
      throw new Error('Wallet not connected');
    }

    try {
      const balance = await state.web3.eth.getBalance(state.address);
      const balanceEth = Number(state.web3.utils.fromWei(balance, 'ether'));
      
      setState(prev => ({
        ...prev,
        balance: balance.toString(),
        balanceEth
      }));

      return balance.toString();
    } catch (error) {
      throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [state.web3, state.address]);

  /**
   * Clear state
   */
  const clear = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const value: WalletContextType = {
    ...state,
    connect,
    disconnect,
    switchChain,
    getBalance,
    clear
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}
