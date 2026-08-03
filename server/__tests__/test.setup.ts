import { vi } from 'vitest';

// Centralized hoisted mocks for tests to avoid cross-file mock hoisting issues.
vi.mock('../utils/cryptoWallet', () => ({
  createWalletIfValid: (_privateKey: string, provider: any) => ({
    address: '0xabc',
    provider,
  }),
}));

vi.mock('../../shared/chainRegistry', () => ({
  SupportedChain: {
    CELO: 'celo',
    ETHEREUM: 'ethereum',
    POLYGON: 'polygon',
    BSC: 'bsc',
  },
  CHAIN_CONFIGS: {
    celo: { rpcUrl: 'https://primary.example', bridgeContract: '0x' + 'b'.repeat(40) },
    ethereum: { rpcUrl: 'https://secondary.example', bridgeContract: '0x' + 'c'.repeat(40) },
  },
  ChainRegistry: {
    getChainConfig: (chain: string) => ({ rpcUrl: 'https://primary.example', bridgeContract: '0x' + 'd'.repeat(40) }),
  },
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    readFileSync: () => JSON.stringify({ abi: [] }),
  };
});

export {};
