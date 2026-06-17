// Lazy-load heavy `viem` library at runtime to avoid large client bundles.
// We provide lightweight local helpers for common utilities (parse/format) and
// a `publicClient` wrapper that initializes `viem` on first use.

// Minimal Celo network configs (avoid importing viem/chains at module load)
export const celoMainnet = {
  id: 42220,
  name: 'Celo Mainnet',
  rpcUrls: { default: { http: ['https://forno.celo.org'] } },
  blockExplorers: { default: { name: 'CeloScan', url: 'https://celoscan.io' } },
  nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 }
};

export const alfajores = {
  id: 44787,
  name: 'Alfajores Testnet',
  rpcUrls: { default: { http: ['https://alfajores-forno.celo-testnet.org'] } },
  blockExplorers: { default: { name: 'CeloScan', url: 'https://alfajores.celoscan.io' } },
  nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 }
};

// --- Current Network Selection ---
// Use testnet for development. Change to celoMainnet for production.
export const currentNetwork = alfajores; // Or celoMainnet;

// --- Lazy viem client ---
let _publicClient: any = null;
async function ensureViemClient() {
  if (_publicClient) return _publicClient;
  const mod = await import('viem');
  // Support environments where the module is wrapped under a `default` property
  const createPublicClient = (mod as any).createPublicClient ?? (mod as any).default?.createPublicClient;
  const http = (mod as any).http ?? (mod as any).default?.http;
  if (!createPublicClient || !http) {
    throw new Error('viem createPublicClient/http not available');
  }
  const rpc = currentNetwork.rpcUrls?.default?.http?.[0] || 'https://alfajores-forno.celo-testnet.org';
  _publicClient = createPublicClient({ chain: currentNetwork as any, transport: http(rpc) });
  return _publicClient;
}

// Wrapper that exposes common publicClient methods and lazy-initializes viem.
export const publicClient = {
  async getBalance(args: any) {
    const c = await ensureViemClient();
    return c.getBalance(args);
  },
  async readContract(args: any) {
    const c = await ensureViemClient();
    return c.readContract(args);
  },
  async estimateGas(args: any) {
    const c = await ensureViemClient();
    return c.estimateGas(args);
  },
  // Add other delegated methods as needed
};

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

// MiniPay specific features
export const getMiniPayFeatures = () => {
  return {
    isMiniPay: isMiniPay(),
    supportsLocalPayments: isMiniPay(), // MiniPay supports local payment methods
    supportsCUSD: isMiniPay(), // MiniPay natively supports cUSD
    supportsPhoneNumber: isMiniPay(), // MiniPay can access phone numbers
    supportsBiometric: isMiniPay(), // MiniPay supports biometric authentication
  };
};

// Get user's phone number from MiniPay (if available)
export const getMiniPayPhoneNumber = async (): Promise<string | null> => {
  if (!isMiniPay()) return null;
  
  try {
    const phoneNumber = await (window as EthereumWindow).ethereum!.request({
      method: 'eth_requestPhoneNumber',
    });
    return phoneNumber;
  } catch (error) {
    console.warn('Could not get phone number from MiniPay:', error);
    return null;
  }
};

// --- Wallet Client Initialization ---
// Custom function to get a viem wallet client instance
// Renamed from createWalletClient to avoid shadowing viem's createWalletClient
export const getWalletClientInstance = async () => {
  if (!isWalletAvailable()) {
    throw new Error('No wallet available. Please install MiniPay or another Celo wallet.');
  }

  const ethereumProvider = (window as EthereumWindow).ethereum;
  if (!ethereumProvider) {
    throw new Error('Ethereum provider not found.');
  }

  const mod = await import('viem');
  const createWalletClient = (mod as any).createWalletClient ?? (mod as any).default?.createWalletClient;
  const custom = (mod as any).custom ?? (mod as any).default?.custom;
  if (!createWalletClient || !custom) {
    throw new Error('viem createWalletClient/custom not available');
  }
  return createWalletClient({ chain: currentNetwork as any, transport: custom(ethereumProvider) });
};

// --- Balance Functions ---

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
  if (!isValidCeloAddress(address)) {
    throw new Error('Invalid Celo address');
  }
  const balanceBigInt = await publicClient.getBalance({ address: address as `0x${string}` });
  return formatEther(balanceBigInt as bigint);
};

// --- cUSD Balance Fetching ---
export const getCUSDBalance = async (address: string): Promise<string> => {
  if (!isValidCeloAddress(address)) {
    throw new Error('Invalid Celo address');
  }
  const balanceBigInt = await publicClient.readContract({
    address: CUSD_TOKEN_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`]
  });
  return formatUnits(balanceBigInt as bigint, 18);
};

// --- Transaction Sending ---

// Send native CELO transaction
export const sendCelo = async (
  to: string,
  amount: string // Amount in user-readable units (e.g., "0.5")
): Promise<string> => {
  const walletClient = await getWalletClientInstance();
  const [account] = await walletClient.getAddresses();

  const hash = await walletClient.sendTransaction({
    account,
    to: to as `0x${string}`,
    value: parseEther(amount) // returns bigint
  });

  return hash;
};

// --- Send cUSD Transaction ---
export const sendCUSD = async (
  to: string,
  amount: string // Amount in user-readable units (e.g., "10")
): Promise<string> => {
  if (!isValidCeloAddress(to)) {
    throw new Error('Invalid Celo address');
  }
  const walletClient = await getWalletClientInstance();
  const [account] = await walletClient.getAddresses();
  const amountBigInt = parseUnits(amount, 18);
  // Lazy import encodeFunctionData from viem when needed
  const mod = await import('viem');
  const encodeFunctionData = (mod as any).encodeFunctionData ?? (mod as any).default?.encodeFunctionData;
  if (!encodeFunctionData) throw new Error('viem encodeFunctionData not available');
  const data = encodeFunctionData({ abi: ERC20_ABI as any, functionName: 'transfer', args: [to as `0x${string}`, amountBigInt] });
  const hash = await walletClient.sendTransaction({ account, to: CUSD_TOKEN_ADDRESS as `0x${string}`, data });
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

// --- Estimate Gas Fee for cUSD (ERC-20) Transfer ---
export const estimateCUSDGasFee = async (
  from: string,
  to: string,
  amount: string // Amount in user-readable units (e.g., "10")
): Promise<string> => {
  if (!isValidCeloAddress(from) || !isValidCeloAddress(to)) {
    throw new Error('Invalid Celo address');
  }
  const amountBigInt = parseUnits(amount, 18);
  // Encode transfer data (lazy-import viem encoder)
  const mod = await import('viem');
  const encodeFunctionData = (mod as any).encodeFunctionData ?? (mod as any).default?.encodeFunctionData;
  if (!encodeFunctionData) throw new Error('viem encodeFunctionData not available');
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [to as `0x${string}`, amountBigInt]
  });
  // Estimate gas
  const gas = await publicClient.estimateGas({
    account: from as `0x${string}`,
    to: CUSD_TOKEN_ADDRESS as `0x${string}`,
    data
  });
  return gas.toString();
};

// --- Estimate Gas Fee for Native CELO Transfer ---
export const estimateCeloGasFee = async (
  from: string,
  to: string,
  amount: string // Amount in user-readable units (e.g., "0.5")
): Promise<string> => {
  if (!isValidCeloAddress(from) || !isValidCeloAddress(to)) {
    throw new Error('Invalid Celo address');
  }
  const valueBigInt = parseEther(amount);
  // Estimate gas
  const gas = await publicClient.estimateGas({
    account: from as `0x${string}`,
    to: to as `0x${string}`,
    value: valueBigInt
  });
  return gas.toString();
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

// --- Lightweight unit helpers (synchronous, no external deps) ---
function pow10(n: number) {
  return BigInt(10) ** BigInt(n);
}

export function parseUnits(value: string, decimals = 18): bigint {
  const parts = String(value).split('.');
  const whole = parts[0] || '0';
  const fraction = (parts[1] || '').slice(0, decimals).padEnd(decimals, '0');
  const wholeBig = BigInt(whole) * pow10(decimals);
  const fracBig = BigInt(fraction || '0');
  return wholeBig + fracBig;
}

export function parseEther(value: string): bigint {
  return parseUnits(value, 18);
}

export function formatUnits(value: bigint, decimals = 18): string {
  const neg = value < 0n;
  const v = neg ? -value : value;
  const whole = v / pow10(decimals);
  const frac = v % pow10(decimals);
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole.toString()}${fracStr ? `.${fracStr}` : ''}`;
}

export function formatEther(value: bigint): string {
  return formatUnits(value, 18);
}