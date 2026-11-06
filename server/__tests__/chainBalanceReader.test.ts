import { afterEach, describe, expect, it, vi } from 'vitest';
import { ethers } from 'ethers';
import {
  ChainBalanceReader,
  type ChainBalanceRpcFactory,
} from '../services/chainBalanceReader';

const erc20 = new ethers.Interface([
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

afterEach(() => {
  vi.unstubAllEnvs();
});

function readerWithRpc(rpc: Record<string, unknown>) {
  const factory = (() => ({
    call: (callback: (provider: ethers.JsonRpcProvider) => Promise<unknown>) =>
      callback(rpc as ethers.JsonRpcProvider),
  })) as unknown as ChainBalanceRpcFactory;
  return new ChainBalanceReader(factory);
}

describe('ChainBalanceReader', () => {
  it('reads native Celo balances with a block hash and exact decimal formatting', async () => {
    vi.stubEnv('CELO_RPC_URL', 'https://celo-rpc.example');
    const rpc = {
      getBlockNumber: vi.fn().mockResolvedValue(123),
      getBlock: vi.fn().mockResolvedValue({ hash: `0x${'a'.repeat(64)}` }),
      getBalance: vi.fn().mockResolvedValue(1_250_000_000_000_000_000n),
    };
    const reader = readerWithRpc(rpc);

    const result = await reader.readBalance({
      chain: 'celo',
      holderAddress: '0x0000000000000000000000000000000000000001',
    });

    expect(result.chainId).toBe(42220);
    expect(result.symbol).toBe('CELO');
    expect(result.balance).toBe('1.25');
    expect(result.blockNumber).toBe(123);
    expect(rpc.getBalance).toHaveBeenCalledWith(
      '0x0000000000000000000000000000000000000001',
      123,
    );
  });

  it('reads an ERC-20 balance at the same block used for its metadata', async () => {
    vi.stubEnv('RPC_URL_ARBITRUM', 'https://arb-rpc.example');
    const rpc = {
      getBlockNumber: vi.fn().mockResolvedValue(456),
      getBlock: vi.fn().mockResolvedValue({ hash: `0x${'b'.repeat(64)}` }),
      send: vi.fn(async (_method: string, params: [{ data: string }]) => {
        if (params[0].data === erc20.encodeFunctionData('decimals')) {
          return erc20.encodeFunctionResult('decimals', [6]);
        }
        return erc20.encodeFunctionResult('balanceOf', [12_345_678n]);
      }),
    };
    const reader = readerWithRpc(rpc);

    const result = await reader.readBalance({
      chain: 42161,
      holderAddress: '0x0000000000000000000000000000000000000002',
      assetAddress: '0x0000000000000000000000000000000000000003',
      symbol: 'USDC',
    });

    expect(result.chain).toBe('arbitrum');
    expect(result.balance).toBe('12.345678');
    expect(result.decimals).toBe(6);
    expect(rpc.send).toHaveBeenCalledTimes(2);
    expect(rpc.send).toHaveBeenCalledWith('eth_call', [
      expect.objectContaining({
        to: '0x0000000000000000000000000000000000000003',
      }),
      '0x1c8',
    ]);
  });

  it('fails explicitly when the requested chain has no configured RPC', async () => {
    const reader = readerWithRpc({});
    await expect(reader.readBalance({
      chain: 'base',
      holderAddress: '0x0000000000000000000000000000000000000004',
    })).rejects.toThrow('Missing RPC URL for base chain 8453');
  });
});
