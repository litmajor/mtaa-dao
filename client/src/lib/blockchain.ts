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

export interface StablecoinAsset {
  readonly id: string;
  readonly symbol: 'cUSD' | 'USDC' | 'USDT';
  readonly chainId: number;
  readonly chainName: string;
  readonly address: string;
  readonly decimals: number;
  readonly explorerUrl: string;
}

export interface WalletNetwork {
  id: number;
  name: string;
  rpcUrls: { default: { http: string[] } };
  blockExplorers: { default: { name: string; url: string } };
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

const walletNetworks: WalletNetwork[] = [
  celoMainnet,
  alfajores,
  {
    id: 1,
    name: 'Ethereum Mainnet',
    rpcUrls: { default: { http: [import.meta.env.VITE_ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com'] } },
    blockExplorers: { default: { name: 'Etherscan', url: 'https://etherscan.io' } },
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  {
    id: 8453,
    name: 'Base Mainnet',
    rpcUrls: { default: { http: [import.meta.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org'] } },
    blockExplorers: { default: { name: 'Basescan', url: 'https://basescan.org' } },
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
];

export const SUPPORTED_STABLECOIN_ASSETS: readonly StablecoinAsset[] = [
  {
    id: 'celo-mainnet-cusd',
    symbol: 'cUSD',
    chainId: 42220,
    chainName: 'Celo Mainnet',
    address: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
    decimals: 18,
    explorerUrl: 'https://celoscan.io',
  },
  {
    id: 'celo-mainnet-usdc',
    symbol: 'USDC',
    chainId: 42220,
    chainName: 'Celo Mainnet',
    address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    decimals: 6,
    explorerUrl: 'https://celoscan.io',
  },
  {
    id: 'celo-mainnet-usdt',
    symbol: 'USDT',
    chainId: 42220,
    chainName: 'Celo Mainnet',
    address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
    decimals: 6,
    explorerUrl: 'https://celoscan.io',
  },
  {
    id: 'ethereum-mainnet-usdc',
    symbol: 'USDC',
    chainId: 1,
    chainName: 'Ethereum Mainnet',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    explorerUrl: 'https://etherscan.io',
  },
  {
    id: 'ethereum-mainnet-usdt',
    symbol: 'USDT',
    chainId: 1,
    chainName: 'Ethereum Mainnet',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    explorerUrl: 'https://etherscan.io',
  },
  {
    id: 'base-mainnet-usdc',
    symbol: 'USDC',
    chainId: 8453,
    chainName: 'Base Mainnet',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    explorerUrl: 'https://basescan.org',
  },
  {
    id: 'alfajores-testnet-cusd',
    symbol: 'cUSD',
    chainId: 44787,
    chainName: 'Alfajores Testnet',
    address: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1',
    decimals: 18,
    explorerUrl: 'https://alfajores.celoscan.io',
  },
];

export function getStablecoinAsset(assetId: string): StablecoinAsset {
  const asset = SUPPORTED_STABLECOIN_ASSETS.find((candidate) => candidate.id === assetId);
  if (!asset) throw new Error('This stablecoin/network combination is not supported.');
  return asset;
}

export function getWalletNetwork(chainId: number): WalletNetwork | undefined {
  return walletNetworks.find((network) => network.id === chainId);
}

// --- Current Network Selection ---
// Select the production network explicitly at build time; default safely to testnet.
const configuredNetwork = import.meta.env.VITE_CELO_NETWORK ?? 'alfajores';
if (configuredNetwork !== 'alfajores' && configuredNetwork !== 'mainnet') {
  throw new Error('VITE_CELO_NETWORK must be either "alfajores" or "mainnet".');
}
export const currentNetwork = configuredNetwork === 'mainnet' ? celoMainnet : alfajores;

// --- Lazy viem client ---
let _publicClient: any = null;
const _publicClients = new Map<number, any>();
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

async function ensurePublicClient(chainId: number) {
  const existing = _publicClients.get(chainId);
  if (existing) return existing;
  const network = getWalletNetwork(chainId);
  if (!network) throw new Error(`Network ${chainId} is not supported by this wallet.`);
  const mod = await import('viem');
  const createPublicClient = (mod as any).createPublicClient ?? (mod as any).default?.createPublicClient;
  const http = (mod as any).http ?? (mod as any).default?.http;
  if (!createPublicClient || !http) throw new Error('viem createPublicClient/http not available');
  const client = createPublicClient({
    chain: network as any,
    transport: http(network.rpcUrls.default.http[0]),
  });
  _publicClients.set(chainId, client);
  return client;
}

export async function getStablecoinBalance(address: string, assetId: string): Promise<string> {
  if (!isValidCeloAddress(address)) throw new Error('Invalid EVM wallet address.');
  const asset = getStablecoinAsset(assetId);
  const client = await ensurePublicClient(asset.chainId);
  const rawBalance = await client.readContract({
    address: asset.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  });
  return formatUnits(rawBalance as bigint, asset.decimals);
}

export async function getNativeBalance(address: string, chainId: number): Promise<string> {
  if (!isValidCeloAddress(address)) throw new Error('Invalid EVM wallet address.');
  const client = await ensurePublicClient(chainId);
  return formatEther(await client.getBalance({ address: address as `0x${string}` }) as bigint);
}

export async function sendStablecoin(
  to: string,
  amount: string,
  assetId: string,
  expectedSender?: string,
): Promise<string> {
  if (!isValidCeloAddress(to)) throw new Error('Invalid EVM destination address.');
  const asset = getStablecoinAsset(assetId);
  const network = getWalletNetwork(asset.chainId);
  if (!network) throw new Error('The selected asset network is not supported.');
  const provider = (window as EthereumWindow).ethereum;
  if (!provider) throw new Error('No compatible wallet is available.');
  const activeChainHex = await provider.request({ method: 'eth_chainId' });
  const activeChainId = typeof activeChainHex === 'string' ? Number.parseInt(activeChainHex, 16) : NaN;
  if (activeChainId !== asset.chainId) throw new Error(`Switch your wallet to ${asset.chainName} before sending.`);

  const walletClient = await getWalletClientInstanceForNetwork(network);
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error('No wallet account is available for this transfer.');
  if (expectedSender && account.toLowerCase() !== expectedSender.toLowerCase()) {
    throw new Error('The connected wallet account changed. Review the sender and try again.');
  }
  const amountBigInt = parseUnitsStrict(amount, asset.decimals);
  const mod = await import('viem');
  const encodeFunctionData = (mod as any).encodeFunctionData ?? (mod as any).default?.encodeFunctionData;
  if (!encodeFunctionData) throw new Error('viem encodeFunctionData not available');
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [to as `0x${string}`, amountBigInt],
  });
  return walletClient.sendTransaction({
    account,
    to: asset.address as `0x${string}`,
    data,
  });
}

function parseUnitsStrict(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255
    || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)
    || (value.split('.')[1]?.length ?? 0) > decimals
    || !/[1-9]/.test(value)) {
    throw new Error(`Enter a positive amount with no more than ${decimals} decimal places.`);
  }
  return parseUnits(value, decimals);
}

async function getWalletClientInstanceForNetwork(network: WalletNetwork) {
  const provider = (window as EthereumWindow).ethereum;
  if (!provider) throw new Error('Ethereum provider not found.');
  const mod = await import('viem');
  const createWalletClient = (mod as any).createWalletClient ?? (mod as any).default?.createWalletClient;
  const custom = (mod as any).custom ?? (mod as any).default?.custom;
  if (!createWalletClient || !custom) throw new Error('viem createWalletClient/custom not available');
  return createWalletClient({ chain: network as any, transport: custom(provider) });
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
  amount: string, // Amount in user-readable units (e.g., "10")
  expectedSender?: string
): Promise<string> => {
  if (!isValidCeloAddress(to)) {
    throw new Error('Invalid Celo address');
  }
  const walletClient = await getWalletClientInstance();
  const [account] = await walletClient.getAddresses();
  if (!account) {
    throw new Error('No wallet account is available for this transfer.');
  }
  if (expectedSender && account.toLowerCase() !== expectedSender.toLowerCase()) {
    throw new Error('The connected wallet account changed. Review the sender and try again.');
  }
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
export const switchToWalletNetwork = async (chainId: number): Promise<void> => {
  const network = getWalletNetwork(chainId);
  if (!network) throw new Error(`Network ${chainId} is not supported by this wallet.`);
  const provider = (window as EthereumWindow).ethereum;
  if (!provider) throw new Error('No wallet available. Please install a compatible wallet.');
  const chainIdHex = `0x${network.id.toString(16)}`;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (error) {
    const switchError = typeof error === 'object' && error !== null
      ? error as { code?: number; message?: string }
      : { message: String(error) };
    if (switchError.code !== 4902) {
      throw new Error(`Failed to switch to ${network.name}: ${switchError.message || 'Unknown wallet error'}`);
    }
    try {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainIdHex,
          chainName: network.name,
          nativeCurrency: network.nativeCurrency,
          rpcUrls: network.rpcUrls.default.http,
          blockExplorerUrls: [network.blockExplorers.default.url],
        }],
      });
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } catch (addError) {
      const errorMessage = addError instanceof Error ? addError.message : 'Unknown wallet error';
      throw new Error(`Failed to add ${network.name}: ${errorMessage}`);
    }
  }
};

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