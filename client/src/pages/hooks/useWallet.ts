import { useState, useEffect, useCallback } from 'react';
import {
  connectWallet,
  getBalance, // This should return amount in user-readable units (e.g., ETH/CELO, not wei)
  getCUSDBalance, // This should return amount in user-readable units (e.g., USD, not wei)
  isMiniPay,
  isWalletAvailable,
  switchToCelo,
  sendCelo, // This function must handle converting `amount: string` to BigNumber/wei
  sendCUSD, // This function must handle converting `amount: string` to BigNumber/wei
  formatAddress
} from '@/lib/blockchain';
import useToast from '@/components/ui/use-toast'; // this is my Shadcn UI toast

// Define expected chain IDs for Celo networks
// You can adjust these based on the networks your dApp supports (e.g., mainnet, Alfajores)
const CELO_ALFAJORES_CHAIN_ID = '0xaef3'; // 44787 in decimal
const CELO_MAINNET_CHAIN_ID = '0x2a64'; // 42220 in decimal
// Define the wallet state interface

interface WalletState {
  isConnected: boolean;
  address: string | null;
  celoBalance: string; // Store as string to avoid floating point issues and match BigNumber conversion
  cusdBalance: string; // Store as string
  isLoading: boolean; // General loading for connect/send operations
  isRefreshingBalances: boolean; // Specific loading for balance refreshing
  error: string | null;
  isMiniPay: boolean;
  chainId: string | null; // Store chain ID
}

interface SendTransactionParams {
  to: string;
  amount: string; // Amount in user-readable units (e.g., "0.5")
  currency: 'CELO' | 'cUSD';
}

export const useWallet = () => {
  const { toast } = useToast();
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    celoBalance: '0',
    cusdBalance: '0',
    isLoading: false,
    isRefreshingBalances: false,
    error: null,
    isMiniPay: isMiniPay(),
    chainId: null,
  });

  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (!isWalletAvailable()) {
        throw new Error('No wallet found. Please install MiniPay or another Celo wallet (e.g., MetaMask).');
      }

      await switchToCelo(); // Ensure wallet is on a Celo network
      const accounts = await connectWallet();
      const address = accounts[0];
      const chainId = (window as any).ethereum.chainId; // Get current chain ID after connection

      // Validate connected chain ID
      if (chainId !== CELO_ALFAJORES_CHAIN_ID && chainId !== CELO_MAINNET_CHAIN_ID) {
        throw new Error(`Please switch to Celo Mainnet or Alfajores (Connected chain ID: ${chainId}).`);
      }

      const [celoBalance, cusdBalance] = await Promise.all([
        getBalance(address),
        getCUSDBalance(address)
      ]);

      setState({
        isConnected: true,
        address,
        celoBalance,
        cusdBalance,
        isLoading: false,
        isRefreshingBalances: false,
        error: null,
        isMiniPay: isMiniPay(),
        chainId: chainId,
      });

      toast({
        title: '🔗 Wallet Connected',
        description: `Address: ${formatAddress(address)}`,
      });

      if (isMiniPay()) {
        toast({
          title: '🟡 MiniPay Detected',
          description: 'You are using MiniPay for transactions.',
        });
      }

    } catch (error: any) {
      console.error('Wallet connection error:', error); // Log full error for debugging
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to connect wallet',
        chainId: null, // Reset chainId on connection failure
      }));

      toast({
        title: '❌ Wallet Connection Failed',
        description: error.message || 'Unable to connect to wallet.',
        variant: 'destructive',
      });
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      address: null,
      celoBalance: '0',
      cusdBalance: '0',
      isLoading: false,
      isRefreshingBalances: false,
      error: null,
      isMiniPay: isMiniPay(), // Re-check MiniPay status
      chainId: null,
    });

    toast({
      title: '🔌 Wallet Disconnected',
      description: 'You have disconnected your wallet.',
    });
  }, []);

  const refreshBalances = useCallback(async () => {
    if (!state.address) return;

    setState(prev => ({ ...prev, isRefreshingBalances: true })); // Set refreshing state

    try {
      const [celoBalance, cusdBalance] = await Promise.all([
        getBalance(state.address),
        getCUSDBalance(state.address)
      ]);

      setState(prev => ({
        ...prev,
        celoBalance,
        cusdBalance,
        isRefreshingBalances: false, // Clear refreshing state on success
      }));
    } catch (error) {
      console.error('Failed to refresh balances:', error);
      setState(prev => ({
        ...prev,
        isRefreshingBalances: false, // Clear refreshing state on error
        // Optionally, set an error specifically for balance refreshing if needed
      }));
    }
  }, [state.address]);

  const sendTransaction = useCallback(async ({ to, amount, currency }: SendTransactionParams): Promise<string> => {
    if (!state.address) {
      throw new Error('Wallet not connected. Please connect your wallet to send transactions.');
    }
    // Add specific chain ID check before sending
    if (state.chainId !== CELO_ALFAJORES_CHAIN_ID && state.chainId !== CELO_MAINNET_CHAIN_ID) {
      throw new Error(`Incorrect network. Please switch to Celo Mainnet or Alfajores to send ${currency}.`);
    }

    setState(prev => ({ ...prev, isLoading: true, error: null })); // General loading for transaction

    try {
      let hash: string;

      if (currency === 'CELO') {
        hash = await sendCelo(to, amount); // `sendCelo` must convert amount to wei
      } else if (currency === 'cUSD') {
        hash = await sendCUSD(to, amount); // `sendCUSD` must convert amount to wei
      } else {
        throw new Error('Unsupported currency for transaction.');
      }

      toast({
        title: '✅ Transaction Sent!',
        description: `Sent ${amount} ${currency} to ${formatAddress(to)}. Hash: ${hash.slice(0, 10)}...`,
        // Consider adding an action button to view on explorer here if it's the main send function
      });

      // Refresh balances after a short delay to allow for block confirmation
      setTimeout(() => {
        refreshBalances();
      }, 3000); // 3-second delay

      setState(prev => ({ ...prev, isLoading: false }));
      return hash;
    } catch (error: any) {
      console.error('Transaction failed:', error); // Log full error object

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Transaction failed'
      }));

      // More descriptive error toasts
      let toastDescription = 'Transaction could not be completed.';
      if (error.message?.toLowerCase().includes("insufficient funds")) {
        toastDescription = "Insufficient balance for this transaction.";
      } else if (error.message?.toLowerCase().includes("user rejected")) {
        toastDescription = "Transaction rejected by user.";
      } else if (error.shortMessage) { // Common in viem/wagmi errors
        toastDescription = `Error: ${error.shortMessage}`;
      } else if (error.code) { // E.g., Metamask RPC error codes
          toastDescription = `Error Code ${error.code}: ${error.message}`;
      }

      toast({
        title: '❌ Transaction Failed',
        description: toastDescription,
        variant: 'destructive',
      });

      throw error; // Re-throw to allow component to catch and handle
    }
  }, [state.address, state.chainId, refreshBalances]); // Added state.chainId to dependencies

  // Auto-connect and initial balance fetch on component mount
  useEffect(() => {
    const checkConnection = async () => {
      // Check if wallet is available and if an address is already selected
      if (isWalletAvailable() && (window as any).ethereum && (window as any).ethereum.selectedAddress) {
        const address = (window as any).ethereum.selectedAddress;
        const chainId = (window as any).ethereum.chainId;

        // Basic check for Celo network before fetching balances
        if (chainId !== CELO_ALFAJORES_CHAIN_ID && chainId !== CELO_MAINNET_CHAIN_ID) {
          console.warn(`Wallet connected to non-Celo network: ${chainId}. Balances might be inaccurate.`);
          setState(prev => ({
            ...prev,
            isConnected: true, // Still connected, but on wrong chain
            address: address,
            chainId: chainId,
            isMiniPay: isMiniPay(),
          }));
          toast({
            title: '⚠️ Wrong Network',
            description: `Please switch your wallet to Celo Mainnet or Alfajores. Currently on Chain ID: ${chainId}.`,
            variant: 'destructive',
          });
          return; // Stop here if on wrong chain
        }

        try {
          const [celoBalance, cusdBalance] = await Promise.all([
            getBalance(address),
            getCUSDBalance(address)
          ]);

          setState(prev => ({ // Use functional update for safety
            ...prev,
            isConnected: true,
            address,
            celoBalance,
            cusdBalance,
            isLoading: false,
            error: null,
            isMiniPay: isMiniPay(),
            chainId: chainId,
          }));

          toast({
            title: '🔗 Wallet Auto-Connected',
            description: `Address: ${formatAddress(address)}`,
          });
        } catch (error) {
          console.error('Failed to get initial balances or auto-connect:', error);
          setState(prev => ({ ...prev, isLoading: false, error: 'Failed to retrieve initial wallet state.' }));
          toast({
            title: '❌ Auto-Connect Failed',
            description: 'Could not retrieve wallet balances. Try connecting manually.',
            variant: 'destructive',
          });
        }
      }
    };

    checkConnection();
  }, []); // Empty dependency array means this runs once on mount

  // Event listeners for wallet changes (accounts, chain)
  useEffect(() => {
    if (!isWalletAvailable() || !(window as any).ethereum) return;

    const ethereum = (window as any).ethereum;

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('Accounts changed:', accounts);
      if (accounts.length === 0) {
        disconnect(); // Wallet locked or disconnected
      } else if (accounts[0] !== state.address) {
        // Account switched, re-connect to get new balances/state
        connect();
      }
    };

    const handleChainChanged = (chainId: string) => {
      console.log('Chain changed to:', chainId);
      // If the wallet was connected, attempt to reconnect to update state
      // and prompt user if on wrong chain
      if (state.isConnected) {
        connect();
      } else {
        // If not connected, just update the chainId state
        setState(prev => ({ ...prev, chainId: chainId }));
      }
    };

    // Attach listeners
    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    // Cleanup listeners on component unmount
    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [state.address, state.isConnected, connect, disconnect]); // Dependencies for event listeners

  return {
    ...state,
    connect,
    disconnect,
    sendTransaction,
    refreshBalances,
    // Formatted balances for display
    formattedCeloBalance: parseFloat(state.celoBalance).toFixed(4), // Example: 4 decimal places for CELO
    formattedCUSDBalance: parseFloat(state.cusdBalance).toFixed(2), // Example: 2 decimal places for cUSD
    formattedAddress: state.address ? formatAddress(state.address) : null,
    // Calculate total balance (assuming 1 CELO ~ 1 USD for display purposes or using an oracle)
    // For a real app, you might fetch exchange rates to calculate this accurately.
    totalBalanceInUSD: (parseFloat(state.celoBalance) * 1 /* CELO_USD_RATE */) + parseFloat(state.cusdBalance),
  };
};