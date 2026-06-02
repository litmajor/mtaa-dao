/**
 * useWalletProviders Hook
 * 
 * Advanced hook for managing multiple wallet provider connections
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import Web3 from 'web3';
import {
  WALLET_PROVIDERS,
  getSupportedProviders,
  getProvidersForChain,
  type ProviderInfo,
} from '../agent-wallet/wallet-provider-integrations';

type WindowWithEthereum = Window & Record<string, unknown> & { ethereum?: unknown; coinbaseWalletExtension?: unknown };

function isEthereum(obj: unknown): obj is { request: (args: { method: string; params?: unknown }) => Promise<unknown>; isMetaMask?: boolean; on?: any } {
  return !!obj && typeof obj === 'object' && typeof (obj as any).request === 'function'
}

export interface ProviderConnectionState {
  provider: ProviderInfo | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  web3: unknown | null;
  account: string | null;
}

/**
 * useWalletProviders - Hook for multi-provider wallet management
 */
export function useWalletProviders(chainId: number = 1) {
  const [state, setState] = useState<ProviderConnectionState>({
    provider: null,
    isConnecting: false,
    isConnected: false,
    error: null,
    web3: null,
    account: null
  });

  /**
   * Get providers available for current chain
   */
  const getAvailableProviders = useCallback(() => {
    return getProvidersForChain(chainId);
  }, [chainId]);

  /**
   * Connect to MetaMask
   */
  const connectMetaMask = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      if (typeof window === 'undefined') throw new Error('MetaMask not available');
      const w = window as unknown as WindowWithEthereum;
      const eth = w.ethereum;
      if (!isEthereum(eth) || !eth.isMetaMask) throw new Error('MetaMask not installed. Please install the MetaMask extension.');

      const accounts = await eth.request({ method: 'eth_requestAccounts' });

      if (!Array.isArray(accounts) || accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask');
      }

      const web3 = new Web3(eth as any);

      setState({
        provider: WALLET_PROVIDERS.metamask,
        isConnecting: false,
        isConnected: true,
        error: null,
        web3,
        account: accounts[0]
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setState(prev => ({ ...prev, isConnecting: false, error: msg }));
    }
  }, []);

  /**
   * Connect to Coinbase Wallet
   */
  const connectCoinbase = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      if (typeof window === 'undefined') throw new Error('Coinbase Wallet not available');
      const w = window as unknown as WindowWithEthereum;
      const prov = w.coinbaseWalletExtension;
      if (!isEthereum(prov)) throw new Error('Coinbase Wallet not installed. Please install the Coinbase Wallet extension.');

      const accounts = await (prov as any).request({ method: 'eth_requestAccounts' });

      if (!Array.isArray(accounts) || accounts.length === 0) {
        throw new Error('No accounts returned from Coinbase Wallet');
      }

      const web3 = new Web3(prov as any);

      setState({
        provider: WALLET_PROVIDERS.coinbase,
        isConnecting: false,
        isConnected: true,
        error: null,
        web3,
        account: accounts[0]
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setState(prev => ({ ...prev, isConnecting: false, error: msg }));
    }
  }, []);

  /**
   * Connect to WalletConnect
   */
  const connectWalletConnect = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // This would use WalletConnect SDK
      // For now, placeholder implementation
      throw new Error('WalletConnect integration in progress');
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }, []);

  /**
   * Connect to Ledger
   */
  const connectLedger = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // This would use LedgerJS SDK
      // For now, placeholder implementation
      throw new Error('Ledger integration in progress');
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }, []);

  /**
   * Generic connect function by provider ID
   */
  const connectProvider = useCallback(async (providerId: string) => {
    switch (providerId.toLowerCase()) {
      case 'metamask':
        return connectMetaMask();
      case 'coinbase':
        return connectCoinbase();
      case 'walletconnect':
        return connectWalletConnect();
      case 'ledger':
        return connectLedger();
      default:
        setState(prev => ({
          ...prev,
          error: `Provider ${providerId} not implemented yet`
        }));
    }
  }, [connectMetaMask, connectCoinbase, connectWalletConnect, connectLedger]);

  /**
   * Disconnect current provider
   */
  const disconnect = useCallback(() => {
    setState({
      provider: null,
      isConnecting: false,
      isConnected: false,
      error: null,
      web3: null,
      account: null
    });
  }, []);

  /**
   * Check if specific provider is installed
   */
  const isProviderInstalled = useCallback((providerId: string): boolean => {
    if (typeof window === 'undefined') return false;
    const w = window as unknown as WindowWithEthereum;

    switch (providerId.toLowerCase()) {
      case 'metamask':
        return isEthereum(w.ethereum) && !!(w.ethereum as any).isMetaMask;
      case 'coinbase':
        return !!w.coinbaseWalletExtension && isEthereum(w.coinbaseWalletExtension);
      case 'walletconnect':
        return true; // WalletConnect works via QR code
      case 'ledger':
        return true; // Ledger works via USB/Bluetooth
      default:
        return false;
    }
  }, []);

  return {
    ...state,
    getAvailableProviders,
    connectMetaMask,
    connectCoinbase,
    connectWalletConnect,
    connectLedger,
    connectProvider,
    disconnect,
    isProviderInstalled,
    supportedProviders: getSupportedProviders()
  };
}

/**
 * Hook to detect installed wallet providers (Extensions + Apps)
 */
export interface DetectedWallet {
  id: string;
  name: string;
  type: 'extension' | 'app' | 'injected';
  installed: boolean;
  url?: string;
}

export function useInstalledWallets(chainId: number = 1) {
  const [installed, setInstalled] = useState<DetectedWallet[]>([]);
  const [detectedApps, setDetectedApps] = useState<DetectedWallet[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const w = window as unknown as WindowWithEthereum;
    const detected: DetectedWallet[] = [];
    const apps: DetectedWallet[] = [];

    // ============= BROWSER EXTENSIONS =============
    
    // MetaMask Extension
    if (isEthereum(w.ethereum) && (w.ethereum as any).isMetaMask) {
      detected.push({
        id: 'metamask',
        name: 'MetaMask',
        type: 'extension',
        installed: true,
        url: 'https://metamask.io'
      });
    }

    // Coinbase Wallet Extension
    if (w.coinbaseWalletExtension && isEthereum(w.coinbaseWalletExtension)) {
      detected.push({
        id: 'coinbase',
        name: 'Coinbase Wallet',
        type: 'extension',
        installed: true,
        url: 'https://www.coinbase.com/wallet'
      });
    }

    // Rabby Wallet Extension
    if (isEthereum(w.ethereum) && (w.ethereum as any).isRabby) {
      detected.push({
        id: 'rabby',
        name: 'Rabby Wallet',
        type: 'extension',
        installed: true,
        url: 'https://rabby.io'
      });
    }

    // Brave Wallet (built-in)
    if (isEthereum(w.ethereum) && (w.ethereum as any).isBraveWallet) {
      detected.push({
        id: 'brave',
        name: 'Brave Wallet',
        type: 'extension',
        installed: true,
        url: 'https://brave.com/wallet'
      });
    }

    // Crypto.com DeFi Wallet
    if (isEthereum(w.ethereum) && (w.ethereum as any).isDeficonnect) {
      detected.push({
        id: 'defiwallet',
        name: 'Crypto.com DeFi Wallet',
        type: 'extension',
        installed: true,
        url: 'https://crypto.com'
      });
    }

    // Trust Wallet Web
    if (w.trustwallet && (w.trustwallet as any).ethereum) {
      detected.push({
        id: 'trustwallet',
        name: 'Trust Wallet',
        type: 'extension',
        installed: true,
        url: 'https://trustwallet.com'
      });
    }

    // ============= MOBILE APPS (via DeepLink Detection) =============

    // Minipay App (Celo-specific mobile wallet)
    if (chainId === 42220 || chainId === 44787) {
      // Minipay is a Celo-specific mobile wallet
      // Detect if on mobile and can deep link to Minipay
      const isMobile = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);
      if (isMobile) {
        apps.push({
          id: 'minipay',
          name: 'Minipay',
          type: 'app',
          installed: true, // Assume installed on Celo chain
          url: 'https://minipay.im'
        });
      }
    }

    // Trust Wallet App (Mobile)
    if (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent)) {
      apps.push({
        id: 'trustwallet-app',
        name: 'Trust Wallet (App)',
        type: 'app',
        installed: false, // Would need explicit check
        url: 'https://trustwallet.com'
      });
    }

    // Argent App
    if (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent)) {
      apps.push({
        id: 'argent-app',
        name: 'Argent (App)',
        type: 'app',
        installed: false,
        url: 'https://argent.xyz'
      });
    }

    // Rainbow App
    if (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent)) {
      apps.push({
        id: 'rainbow-app',
        name: 'Rainbow (App)',
        type: 'app',
        installed: false,
        url: 'https://rainbow.me'
      });
    }

    // Zerion App
    if (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent)) {
      apps.push({
        id: 'zerion-app',
        name: 'Zerion (App)',
        type: 'app',
        installed: false,
        url: 'https://zerion.io'
      });
    }

    setInstalled(detected);
    setDetectedApps(apps);
  }, [chainId]);

  return {
    extensions: installed,
    apps: detectedApps,
    allWallets: [...installed, ...detectedApps],
    totalDetected: installed.length + detectedApps.length
  };
}
