import { useState, useEffect, useCallback } from 'react';
import { getBalance, connectWallet, currentNetwork, publicClient } from '@/lib/blockchain';
import { parseUnits, encodeFunctionData } from 'viem';

declare global {
  interface Window {
    ethereum?: any;
    solana?: any;
    celo?: any;
  }
}

export interface WalletState {
  address: string;
  isConnected: boolean;
  balance: string;
  chainId: number | null;
  provider: string | null;
}

export const useWallet = () => {
  const [walletState, setWalletState] = useState<WalletState>({
    address: '',
    isConnected: false,
    balance: '0',
    chainId: null,
    provider: null
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if wallet is already connected
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          await updateWalletState(accounts[0], 'metamask');
        }
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  };

  const updateWalletState = async (address: string, provider: string) => {
    try {
      let balance = '0';
      let chainId = null;

      if (window.ethereum) {
        // Get balance using viem utilities
        try {
          balance = await getBalance(address);
        } catch (balanceError) {
          console.warn('Error fetching balance with viem, falling back to direct call:', balanceError);
          // Fallback to direct ethereum call
          const balanceHex = await window.ethereum.request({
            method: 'eth_getBalance',
            params: [address, 'latest']
          });
          balance = (parseInt(balanceHex, 16) / 1e18).toFixed(4);
        }

        // Get chain ID
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        chainId = parseInt(chainIdHex, 16);
      }

      setWalletState({
        address,
        isConnected: true,
        balance,
        chainId,
        provider
      });

    } catch (error) {
      console.error('Error updating wallet state:', error);
    }
  };

  // Add refresh balances function
  const refreshBalances = useCallback(async () => {
    if (!walletState.address || !walletState.isConnected) return;
    
    setIsRefreshingBalances(true);
    try {
      await updateWalletState(walletState.address, walletState.provider || 'metamask');
    } catch (error) {
      console.error('Error refreshing balances:', error);
    } finally {
      setIsRefreshingBalances(false);
    }
  }, [walletState.address, walletState.isConnected, walletState.provider]);

  const connectMetaMask = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
      }

      // Use viem connection utility
      const accounts = await connectWallet();

      if (accounts.length > 0) {
        await updateWalletState(accounts[0], 'metamask');

        // Switch to Celo network if not already on it
        await switchToCelo();
      }
    } catch (error: any) {
      setError(error.message);
      console.error('MetaMask connection error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const connectValora = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Valora deep link connection
      const dappUrl = window.location.origin;
      const dappName = 'MtaaDAO';
      const valoraDeepLink = `celo://wallet/dapp?url=${encodeURIComponent(dappUrl)}&name=${encodeURIComponent(dappName)}`;

      // For mobile, try deep link
      if (/Mobi|Android/i.test(navigator.userAgent)) {
        window.location.href = valoraDeepLink;
      } else {
        // For desktop, show QR code or instructions
        setError('Please use Valora mobile app to connect');
      }
    } catch (error: any) {
      setError(error.message);
      console.error('Valora connection error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const connectMiniPay = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // MiniPay integration
      if (window.ethereum && window.ethereum.isMiniPay) {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });

        if (accounts.length > 0) {
          await updateWalletState(accounts[0], 'minipay');
        }
      } else {
        // Redirect to MiniPay or show instructions
        setError('Please use Opera MiniPay to connect');
      }
    } catch (error: any) {
      setError(error.message);
      console.error('MiniPay connection error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const switchToCelo = async () => {
    try {
      if (!window.ethereum) return;

      // Use the current network from blockchain config (could be testnet or mainnet)
      const targetChainId = `0x${currentNetwork.id.toString(16)}`;
      
      // Try to switch to the configured Celo network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainId }],
      });
    } catch (switchError: any) {
      // If the chain hasn't been added to MetaMask, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${currentNetwork.id.toString(16)}`,
              chainName: currentNetwork.name,
              nativeCurrency: currentNetwork.nativeCurrency,
              rpcUrls: currentNetwork.rpcUrls.default.http,
              blockExplorerUrls: currentNetwork.blockExplorers ? [currentNetwork.blockExplorers.default.url] : []
            }]
          });
        } catch (addError) {
          console.error('Error adding Celo network:', addError);
        }
      }
    }
  };

  const disconnect = () => {
    setWalletState({
      address: '',
      isConnected: false,
      balance: '0',
      chainId: null,
      provider: null
    });
    setError(null);
  };

  const sendTransaction = async (to: string, amount: string, tokenAddress?: string) => {
    try {
      if (!walletState.isConnected || !window.ethereum) {
        throw new Error('Wallet not connected');
      }

      let txParams;

      if (tokenAddress) {
        // ERC-20 token transfer using viem for precise encoding
        const transferData = encodeFunctionData({
          abi: [{
            inputs: [
              { internalType: 'address', name: 'to', type: 'address' },
              { internalType: 'uint256', name: 'amount', type: 'uint256' },
            ],
            name: 'transfer',
            outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
            stateMutability: 'nonpayable',
            type: 'function',
          }],
          functionName: 'transfer',
          args: [to as `0x${string}`, parseUnits(amount, 18)]
        });
        
        txParams = {
          from: walletState.address,
          to: tokenAddress,
          data: transferData,
          // Let provider estimate gas
        };
      } else {
        // Native CELO transfer using viem for precise conversion
        txParams = {
          from: walletState.address,
          to,
          value: `0x${parseUnits(amount, 18).toString(16)}`,
          // Let provider estimate gas
        };
      }

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });

      return txHash;
    } catch (error: any) {
      console.error('Transaction error:', error);
      throw error;
    }
  };

  return {
    ...walletState,
    isLoading,
    isRefreshingBalances,
    error,
    connectMetaMask,
    connectValora,
    connectMiniPay,
    disconnect,
    sendTransaction,
    switchToCelo,
    refreshBalances
  };
};