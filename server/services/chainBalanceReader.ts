import { ethers } from 'ethers';
import { ResilientRpcProvider } from './resilientRpcProvider';

export const EVM_CHAINS = {
  celo: { chainId: 42220, testChainId: 44787, env: 'CELO', nativeSymbol: 'CELO' },
  ethereum: { chainId: 1, testChainId: 11155111, env: 'ETHEREUM', nativeSymbol: 'ETH' },
  polygon: { chainId: 137, testChainId: 80002, env: 'POLYGON', nativeSymbol: 'POL' },
  arbitrum: { chainId: 42161, testChainId: 421614, env: 'ARBITRUM', nativeSymbol: 'ETH' },
  optimism: { chainId: 10, testChainId: 11155420, env: 'OPTIMISM', nativeSymbol: 'ETH' },
  base: { chainId: 8453, testChainId: 84532, env: 'BASE', nativeSymbol: 'ETH' },
  avalanche: { chainId: 43114, testChainId: 43113, env: 'AVALANCHE', nativeSymbol: 'AVAX' },
  bsc: { chainId: 56, testChainId: 97, env: 'BSC', nativeSymbol: 'BNB' },
} as const;

export type EvmChainName = keyof typeof EVM_CHAINS;

export interface ChainAssetBalance {
  chain: EvmChainName;
  chainId: number;
  assetAddress: string | null;
  holderAddress: string;
  symbol: string;
  decimals: number;
  balance: string;
  blockNumber: number;
  blockHash: string;
  observedAt: Date;
}

const ERC20_INTERFACE = new ethers.Interface([
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

const NATIVE_ASSET = new Set([
  'native',
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);

type Rpc = Pick<ethers.JsonRpcProvider, 'getBlockNumber' | 'getBlock' | 'getBalance' | 'send'>;
export type ChainBalanceRpcFactory = (
  chainId: number,
  primaryUrl: string,
  fallbackUrl?: string
) => Pick<ResilientRpcProvider, 'call'>;

function normalizeChain(value: string | number): { name: EvmChainName; chainId: number } {
  const testnetAliases: Record<string, EvmChainName> = {
    alfajores: 'celo',
    celoalfajores: 'celo',
    sepolia: 'ethereum',
    ethereumsepolia: 'ethereum',
    polygonamoy: 'polygon',
    arbitrumsepolia: 'arbitrum',
    optimismsepolia: 'optimism',
    basesepolia: 'base',
    avalanchefuji: 'avalanche',
    bsctestnet: 'bsc',
  };
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return normalizeChain(Number(value));
  }

  for (const [name, config] of Object.entries(EVM_CHAINS) as [EvmChainName, (typeof EVM_CHAINS)[EvmChainName]][]) {
    if (typeof value === 'number') {
      if (value === config.chainId || value === config.testChainId) {
        return { name, chainId: value };
      }
      continue;
    }

    const normalized = value.toLowerCase().replace(/[\s_-]+/g, '');
    if (testnetAliases[normalized] === name) {
      return { name, chainId: config.testChainId };
    }
    if (normalized === name.replace(/[\s_-]+/g, '')) {
      return { name, chainId: config.chainId };
    }
    if (normalized === `${name}mainnet`) {
      return { name, chainId: config.chainId };
    }
    if (normalized === `${name}testnet` || normalized === `${name}amoy` || normalized === `${name}alfajores`) {
      return { name, chainId: config.testChainId };
    }
  }

  throw new Error(`Unsupported EVM chain: ${value}`);
}

function rpcUrls(chain: EvmChainName, chainId: number): { primary: string; fallback?: string } {
  const config = EVM_CHAINS[chain];
  const testnet = chainId === config.testChainId;
  const suffix = testnet ? '_TESTNET' : '';
  const primary =
    process.env[`RPC_URL_${config.env}${suffix}`] ??
    process.env[`RPC_URL_${config.env}_${testnet ? 'TESTNET' : 'MAINNET'}`] ??
    (chain === 'celo'
      ? testnet ? process.env.CELO_ALFAJORES_RPC_URL : process.env.CELO_RPC_URL
      : process.env[`${config.env}_RPC_URL`]);
  if (!primary) {
    throw new Error(`Missing RPC URL for ${chain} chain ${chainId}`);
  }

  const fallback =
    process.env[`RPC_URL_${config.env}${suffix}_BACKUP`] ??
    process.env[`RPC_URL_${config.env}_${testnet ? 'TESTNET' : 'MAINNET'}_BACKUP`] ??
    (chain === 'celo' ? process.env.CELO_RPC_FALLBACK_URL : undefined);
  return { primary, fallback };
}

function createRpc(chainId: number, primaryUrl: string, fallbackUrl?: string) {
  const chainLabel = Object.entries(EVM_CHAINS).find(([, config]) =>
    config.chainId === chainId || config.testChainId === chainId
  )?.[0] as EvmChainName | undefined;
  if (!chainLabel) throw new Error(`Unsupported EVM chain id: ${chainId}`);

  const providerFactory = (url: string) => {
    const request = new ethers.FetchRequest(url);
    request.timeout = Number(process.env.CHAIN_RPC_TIMEOUT_MS ?? 10_000);
    return new ethers.JsonRpcProvider(request, chainId, { staticNetwork: true });
  };

  return new ResilientRpcProvider({
    primary: { name: `${chainLabel}-primary`, httpUrl: primaryUrl },
    fallback: fallbackUrl ? { name: `${chainLabel}-fallback`, httpUrl: fallbackUrl } : undefined,
    createProvider: providerFactory,
  });
}

export class ChainBalanceReader {
  constructor(private readonly rpcFactory: ChainBalanceRpcFactory = createRpc) {}

  async readBalance(input: {
    chain: string | number;
    holderAddress: string;
    assetAddress?: string | null;
    symbol?: string;
  }): Promise<ChainAssetBalance> {
    const { name, chainId } = normalizeChain(input.chain);
    if (!ethers.isAddress(input.holderAddress)) {
      throw new Error(`Invalid holder address for ${name}: ${input.holderAddress}`);
    }

    const { primary, fallback } = rpcUrls(name, chainId);
    const rpc = this.rpcFactory(chainId, primary, fallback);
    const holderAddress = ethers.getAddress(input.holderAddress);
    const blockNumber = await rpc.call((provider) => (provider as Rpc).getBlockNumber());
    const block = await rpc.call((provider) => (provider as Rpc).getBlock(blockNumber));
    if (!block?.hash) throw new Error(`Chain ${name} returned no block hash at ${blockNumber}`);

    const assetAddress = input.assetAddress?.trim() || null;
    const isNative = assetAddress === null || NATIVE_ASSET.has(assetAddress.toLowerCase());
    let balanceRaw: bigint;
    let decimals: number;
    let symbol: string;

    if (isNative) {
      balanceRaw = await rpc.call((provider) => (provider as Rpc).getBalance(holderAddress, blockNumber));
      decimals = 18;
      symbol = input.symbol || EVM_CHAINS[name].nativeSymbol;
    } else {
      if (!ethers.isAddress(assetAddress)) {
        throw new Error(`Invalid token address for ${name}: ${assetAddress}`);
      }
      const token = ethers.getAddress(assetAddress);
      const [balanceData, decimalsData] = await Promise.all([
        rpc.call((provider) => (provider as Rpc).send('eth_call', [
          {
            to: token,
            data: ERC20_INTERFACE.encodeFunctionData('balanceOf', [holderAddress]),
          },
          ethers.toQuantity(blockNumber),
        ])),
        rpc.call((provider) => (provider as Rpc).send('eth_call', [
          {
            to: token,
            data: ERC20_INTERFACE.encodeFunctionData('decimals'),
          },
          ethers.toQuantity(blockNumber),
        ])),
      ]);
      [balanceRaw] = ERC20_INTERFACE.decodeFunctionResult('balanceOf', balanceData) as unknown as [bigint];
      decimals = Number(ERC20_INTERFACE.decodeFunctionResult('decimals', decimalsData)[0]);
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
        throw new Error(`Token at ${token} returned invalid decimals`);
      }
      return {
        chain: name,
        chainId,
        assetAddress: token,
        holderAddress,
        symbol: input.symbol ?? 'UNKNOWN',
        decimals,
        balance: ethers.formatUnits(balanceRaw, decimals),
        blockNumber,
        blockHash: block.hash,
        observedAt: new Date(),
      };
    }

    return {
      chain: name,
      chainId,
      assetAddress: null,
      holderAddress,
      symbol,
      decimals,
      balance: ethers.formatUnits(balanceRaw, decimals),
      blockNumber,
      blockHash: block.hash,
      observedAt: new Date(),
    };
  }
}

export const chainBalanceReader = new ChainBalanceReader();
