/**
 * React Hook for Wallet Connection
 * 
 * useWallet - Complete wallet state management and connection
 * useChainSwitcher - Multi-chain switching
 */

'use client'; // For Next.js

import { useState, useCallback, useEffect, useContext, createContext } from 'react';
import Web3 from 'web3';
import type { WalletConfig } from './types';

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
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Get chain ID
      const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
      const chainId = parseInt(chainIdHex, 16);

      // Initialize Web3
      const web3 = new Web3(ethereum);
      const account = web3.eth.accounts.privateKeyToAccount(accounts[0]);

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
      } catch (switchError: unknown) {
        // Chain not added, try to add it
        const se = switchError as { code?: number }
        if (se?.code === 4902) {
          throw new Error('Chain not found. Please add it manually in your wallet.');
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
