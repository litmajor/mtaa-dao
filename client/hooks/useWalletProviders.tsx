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
  type WalletProvider
} from '../agent-wallet/wallet-provider-integrations';

export interface ProviderConnectionState {
  provider: WalletProvider | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  web3: Web3 | null;
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
      if (!typeof window !== 'undefined' || !(window as any).ethereum?.isMetaMask) {
        throw new Error('MetaMask not installed. Please install the MetaMask extension.');
      }

      const ethereum = (window as any).ethereum;
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask');
      }

      const web3 = new Web3(ethereum);

      setState({
        provider: WALLET_PROVIDERS.metamask,
        isConnecting: false,
        isConnected: true,
        error: null,
        web3,
        account: accounts[0]
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }, []);

  /**
   * Connect to Coinbase Wallet
   */
  const connectCoinbase = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      if (!typeof window !== 'undefined' || !(window as any).coinbaseWalletExtension) {
        throw new Error('Coinbase Wallet not installed. Please install the Coinbase Wallet extension.');
      }

      const provider = (window as any).coinbaseWalletExtension;
      const accounts = await provider.request({ method: 'eth_requestAccounts' });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from Coinbase Wallet');
      }

      const web3 = new Web3(provider);

      setState({
        provider: WALLET_PROVIDERS.coinbase,
        isConnecting: false,
        isConnected: true,
        error: null,
        web3,
        account: accounts[0]
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : String(error)
      }));
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
    const w = window as any;

    switch (providerId.toLowerCase()) {
      case 'metamask':
        return !!w.ethereum?.isMetaMask;
      case 'coinbase':
        return !!w.coinbaseWalletExtension;
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

    const w = window as any;
    const detected: DetectedWallet[] = [];
    const apps: DetectedWallet[] = [];

    // ============= BROWSER EXTENSIONS =============
    
    // MetaMask Extension
    if (w.ethereum?.isMetaMask) {
      detected.push({
        id: 'metamask',
        name: 'MetaMask',
        type: 'extension',
        installed: true,
        url: 'https://metamask.io'
      });
    }

    // Coinbase Wallet Extension
    if (w.coinbaseWalletExtension) {
      detected.push({
        id: 'coinbase',
        name: 'Coinbase Wallet',
        type: 'extension',
        installed: true,
        url: 'https://www.coinbase.com/wallet'
      });
    }

    // Rabby Wallet Extension
    if (w.ethereum?.isRabby) {
      detected.push({
        id: 'rabby',
        name: 'Rabby Wallet',
        type: 'extension',
        installed: true,
        url: 'https://rabby.io'
      });
    }

    // Brave Wallet (built-in)
    if (w.ethereum?.isBraveWallet) {
      detected.push({
        id: 'brave',
        name: 'Brave Wallet',
        type: 'extension',
        installed: true,
        url: 'https://brave.com/wallet'
      });
    }

    // Crypto.com DeFi Wallet
    if (w.ethereum?.isDeficonnect) {
      detected.push({
        id: 'defiwallet',
        name: 'Crypto.com DeFi Wallet',
        type: 'extension',
        installed: true,
        url: 'https://crypto.com'
      });
    }

    // Trust Wallet Web
    if (w.trustwallet?.ethereum) {
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
