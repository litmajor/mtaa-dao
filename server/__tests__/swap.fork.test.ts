import { describe, expect, it, beforeAll, vi } from 'vitest';
import { ethers } from 'ethers';
import { resolveProviderUrls } from '../services/providerBootstrap';
import { crossChainSwapService } from '../services/crossChainSwapService';
import { SupportedChain } from '../../shared/chainRegistry';

const FORK_RPC = process.env.ANVIL_FORK_RPC || process.env.ANVIL_RPC_URL || 'http://127.0.0.1:8545';

vi.mock('../services/tokenService', () => ({
  tokenService: {
    getTokenPrice: vi.fn(async () => 1),
  },
}));

let provider: ethers.JsonRpcProvider;

describe('Forked swap smoke test', () => {
  beforeAll(() => {
    provider = new ethers.JsonRpcProvider(FORK_RPC);
  });

  it('can resolve provider URLs from ANVIL_FORK_RPC', () => {
    const urls = resolveProviderUrls({ ANVIL_FORK_RPC: FORK_RPC });
    expect(urls.rpcUrl).toBe(FORK_RPC);
    expect(urls.fallbackRpcUrl).toBeNull();
    expect(urls.fallbackMode).toBe('none');
  });

  it('can fetch a block number from the fork', async () => {
    const block = await provider.getBlockNumber();
    expect(block).toBeGreaterThan(0);
  });

  it('creates a safe swap quote and does not throw on quote retrieval', async () => {
    const fromToken = '0x471EcE3750Da237f93B8E339c536989b8978a438';
    const toToken = '0x471EcE3750Da237f93B8E339c536989b8978a438';
    try {
      const quoteResult = await crossChainSwapService.getSwapQuote(
        SupportedChain.ETHEREUM,
        SupportedChain.ETHEREUM,
        fromToken,
        toToken,
        ethers.parseUnits('0.01', 18).toString(),
        1.0
      );

      expect(quoteResult).toHaveProperty('estimatedToAmount');
      expect(BigInt(quoteResult.estimatedToAmount)).toBeGreaterThan(0n);
    } catch (error: any) {
      console.error('swap quote error:', error);
      throw error;
    }
  });
});
