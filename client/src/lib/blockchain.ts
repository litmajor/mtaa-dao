import {
  createPublicClient,
  createWalletClient as createViemWalletClient, // Renamed to avoid conflict
  custom,
  http,
  parseEther, // For 18-decimal tokens like CELO
  formatEther, // For 18-decimal tokens like CELO
  parseUnits, // More general for ERC-20 tokens with varying decimals
  formatUnits, // More general for ERC-20 tokens with varying decimals
  encodeFunctionData, // For robust ERC-20 function calls
  Abi, // For ABI type safety
} from 'viem';
import { celo, celoAlfajores } from 'viem/chains';

// --- Celo Network Configurations ---
// Define Celo Mainnet
export const celoMainnet = {
  ...celo,
  rpcUrls: {
    default: { http: ['https://forno.celo.org'] },
    public: { http: ['https://forno.celo.org'] }
  },
  blockExplorers: { // Add block explorers directly to chain config
    default: { name: 'CeloScan', url: 'https://celoscan.io' },
  },
};

// Define Celo Alfajores Testnet
export const alfajores = {
  ...celoAlfajores,
  rpcUrls: {
    default: { http: ['https://alfajores-forno.celo-testnet.org'] },
    public: { http: ['https://alfajores-forno.celo-testnet.org'] }
  },
  blockExplorers: { // Add block explorers directly to chain config
    default: { name: 'CeloScan', url: 'https://alfajores.celoscan.io' },
  },
};

// --- Current Network Selection ---
// Use testnet for development. Change to celoMainnet for production.
export const currentNetwork = alfajores; // Or celoMainnet;

// --- Viem Clients ---
// Public client for reading blockchain data (e.g., balances, contract calls)
export const publicClient = createPublicClient({
  chain: currentNetwork,
  transport: http()
});

// --- Wallet Availability Checks ---
// Type guard for window.ethereum
interface EthereumWindow extends Window {
  ethereum?: {
    isMiniPay?: boolean;
    selectedAddress?: string;
    chainId?: string;
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    on: (eventName: string, callback: (...args: any[]) => void) => void;
    removeListener: (eventName: string, callback: (...args: any[]) => void) => void;
  };
}

// Check if MiniPay is available
export const isMiniPay = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!(window as EthereumWindow).ethereum?.isMiniPay;
};

// Check if any wallet (like MetaMask, MiniPay) is available
export const isWalletAvailable = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!(window as EthereumWindow).ethereum;
};

// --- Wallet Client Initialization ---
// Custom function to get a viem wallet client instance
// Renamed from createWalletClient to avoid shadowing viem's createWalletClient
export const getWalletClientInstance = () => {
  if (!isWalletAvailable()) {
    throw new Error('No wallet available. Please install MiniPay or another Celo wallet.');
  }

  // Ensure window.ethereum is not null/undefined before passing to custom transport
  const ethereumProvider = (window as EthereumWindow).ethereum;
  if (!ethereumProvider) {
    throw new Error('Ethereum provider not found.');
  }

  return createViemWalletClient({ // Use the aliased viem function
    chain: currentNetwork,
    transport: custom(ethereumProvider)
  });
};

// --- Wallet Connection ---
export const connectWallet = async (): Promise<string[]> => {
  if (!isWalletAvailable()) {
    throw new Error('No wallet found. Please install MiniPay or another Celo wallet.');
  }

  // Request accounts from the wallet
  const accounts = await (window as EthereumWindow).ethereum!.request({
    method: 'eth_requestAccounts',
    params: []
  });

  return accounts;
};

// --- Balance Fetching ---
// Get native CELO balance
export const getBalance = async (address: string): Promise<string> => {
  try {
    const balance = await publicClient.getBalance({
      address: address as `0x${string}`
    });
    // formatEther formats a BigInt to a string representing Ether (18 decimals)
    return formatEther(balance);
  } catch (error) {
    console.error('Error getting CELO balance:', error);
    return '0';
  }
};

// --- Transaction Sending ---
// --- Gas Estimation ---
// Estimate gas fee for native CELO transfer
export const estimateCeloGasFee = async (
  to: string,
  amount: string
): Promise<string> => {
  try {
    const gas = await publicClient.estimateGas({
      account: to as `0x${string}`,
      to: to as `0x${string}`,
      value: parseEther(amount)
    });
    const gasPrice = await publicClient.getGasPrice();
    const fee = gas * gasPrice;
    return formatEther(fee);
  } catch (error) {
    console.error('Error estimating CELO gas fee:', error);
    return '0';
  }
};

// Estimate gas fee for cUSD (ERC-20) transfer
export const estimateCUSDGasFee = async (
  to: string,
  amount: string
): Promise<string> => {
  try {
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to as `0x${string}`, parseUnits(amount, 18)],
    });
    const gas = await publicClient.estimateGas({
      account: to as `0x${string}`,
      to: CUSD_TOKEN_ADDRESS as `0x${string}`,
      data: data,
      value: BigInt(0)
    });
    const gasPrice = await publicClient.getGasPrice();
    const fee = gas * gasPrice;
    return formatEther(fee);
  } catch (error) {
    console.error('Error estimating cUSD gas fee:', error);
    return '0';
  }
};
// Send native CELO transaction
export const sendCelo = async (
  to: string,
  amount: string // Amount in user-readable units (e.g., "0.5")
): Promise<string> => {
  const walletClient = getWalletClientInstance();
  const [account] = await walletClient.getAddresses();

  const hash = await walletClient.sendTransaction({
    account,
    to: to as `0x${string}`,
    value: parseEther(amount) // parseEther converts string (e.g., "0.5") to BigInt (0.5 * 10^18)
  });

  return hash;
};

// cUSD token contract address (Alfajores testnet)
// IMPORTANT: Use the correct address for Mainnet if deploying there.
// Alfajores: 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1
// Mainnet: 0x765DE816845861e75A25fCA122bb6898B8B1282a
export const CUSD_TOKEN_ADDRESS = String(currentNetwork.id) === String(celoMainnet.id)
  ? '0x765DE816845861e75A25fCA122bb6898B8B1282a'
  : '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1';

// ABI for ERC-20 transfer function
const ERC20_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const; // 'as const' makes it a literal type, improving type safety with viem

// Send cUSD transaction
export const sendCUSD = async (
  to: string,
  amount: string // Amount in user-readable units (e.g., "2.5")
): Promise<string> => {
  const walletClient = getWalletClientInstance();
  const [account] = await walletClient.getAddresses();

  // Encode the transfer function call using viem's encodeFunctionData
  // parseUnits is used for ERC-20 tokens, explicitly specifying decimals (cUSD has 18)
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [to as `0x${string}`, parseUnits(amount, 18)], // cUSD has 18 decimals
  });

  const hash = await walletClient.sendTransaction({
    account,
    to: CUSD_TOKEN_ADDRESS as `0x${string}`, // Target is the cUSD token contract
    data: data,
    value: BigInt(0), // No native currency (CELO) sent with ERC-20 transfer
  });

  return hash;
};

// Get cUSD balance
export const getCUSDBalance = async (address: string): Promise<string> => {
  try {
    const data = await publicClient.readContract({
      address: CUSD_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI, // Use the defined ERC20_ABI
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });

    // formatUnits is used for ERC-20 tokens, explicitly specifying decimals (cUSD has 18)
    return formatUnits(data as bigint, 18); // cUSD has 18 decimals
  } catch (error) {
    console.error('Error getting cUSD balance:', error);
    return '0';
  }
};

// --- Network Switching ---
export const switchToCelo = async (): Promise<void> => {
  if (!isWalletAvailable()) {
    throw new Error('No wallet available. Please install a Celo-compatible wallet.');
  }

  const ethereumProvider = (window as EthereumWindow).ethereum;
  if (!ethereumProvider) {
    throw new Error('Ethereum provider not found.');
  }

  try {
    // Attempt to switch to the currentNetwork's chain ID
    await ethereumProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${currentNetwork.id.toString(16)}` }],
    });
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to the wallet (MetaMask specific)
    if (switchError.code === 4902) {
      try {
        // Attempt to add the network to the wallet
        await ethereumProvider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: `0x${currentNetwork.id.toString(16)}`,
              chainName: currentNetwork.name,
              nativeCurrency: currentNetwork.nativeCurrency,
              rpcUrls: currentNetwork.rpcUrls.default.http, // Use array from chain config
              blockExplorerUrls: currentNetwork.blockExplorers?.default.url ? [currentNetwork.blockExplorers.default.url] : [],
            }
          ],
        });
      } catch (addError: any) { // Type addError for better error handling
        console.error('Error adding network:', addError);
        throw new Error(`Failed to add network: ${addError.message || 'Unknown error'}`);
      }
    } else {
      console.error('Error switching network:', switchError);
      throw new Error(`Failed to switch network: ${switchError.message || 'Unknown error'}`);
    }
  }
};

// --- Utility Functions ---
export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// This function is redundant if isValidAddress from useWallet is used.
// Keeping it for now but consider consolidating.
export const isValidCeloAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};