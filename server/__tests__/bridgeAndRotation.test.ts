import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/cryptoWallet', () => ({
  createWalletIfValid: (_privateKey: string, provider: any) => ({ address: '0xabc', provider }),
}));

vi.mock('../../shared/chainRegistry', () => ({
  SupportedChain: { CELO: 'celo', ETHEREUM: 'ethereum' },
  CHAIN_CONFIGS: {
    celo: { rpcUrl: 'https://primary.example', bridgeContract: '0x' + 'd'.repeat(40) },
    ethereum: { rpcUrl: 'https://secondary.example', bridgeContract: '0x' + 'c'.repeat(40) },
  },
  ChainRegistry: { getChainConfig: (chain: string) => ({ rpcUrl: 'https://primary.example', bridgeContract: '0x' + 'd'.repeat(40) }) },
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, readFileSync: () => JSON.stringify({ abi: [] }) };
});

const contractCalls: Array<{ method: string; args: any[] }> = [];

describe('bridge and rotation resilient RPC wiring', () => {
  beforeEach(() => {
    contractCalls.length = 0;
  });

  it('routes bridge dispatch through resilient provider execution', async () => {
    // top-level mocks are hoisted from server/__tests__/test.setup.ts
    // Provide provider URL overrides and inject resilient provider
    vi.stubEnv('BRIDGE_PRIVATE_KEY', '0x' + 'b'.repeat(64));

    const { bridgeProtocolService } = await import('../services/bridgeProtocolService');
    const tx = await bridgeProtocolService.sendLayerZeroMessage('celo' as any, 'ethereum' as any, 'payload', '0x', {
      providerUrl: 'https://primary.example',
      destinationAppAddress: '0x' + 'd'.repeat(40),
      createWallet: (_privateKey: string, provider: any) => ({ address: '0xabc', provider }) as any,
      createContract: (address: string, abi: string[], signer: any) => ({
        address,
        abi,
        signer,
        estimateFees: () => {
          contractCalls.push({ method: 'estimateFees', args: [] });
          return [1n, 0n];
        },
        send: (...args: any[]) => {
          contractCalls.push({ method: 'send', args });
          return { wait: async () => ({ hash: '0xbridgehash' }) };
        },
      }),
      createResilientProvider: (_providerUrl: string) => ({
        call: async (callback: (provider: any) => Promise<any>) => callback({}),
      }),
    });

    expect(tx).toBe('0xbridgehash');
    expect(contractCalls.some((call) => call.method === 'send')).toBe(true);
  });

  it('routes rotation distribution through resilient provider execution', async () => {
    // top-level mocks are hoisted from server/__tests__/test.setup.ts
    vi.stubEnv('CELO_RPC_URL', 'https://primary.example');
    vi.stubEnv('CELO_RPC_FALLBACK_URL', 'https://fallback.example');
    vi.stubEnv('ROTATION_SIGNER_PRIVATE_KEY', '0x' + 'c'.repeat(64));
    vi.stubEnv('ROTATION_MODULE_ADDRESS', '0x1234');

    const { distributeToRecipientOnChain } = await import('../services/rotation_contract');
    const result = await distributeToRecipientOnChain('0xabc', {
      createWallet: (_privateKey: string, provider: any) => ({ address: '0xabc', provider }) as any,
      createContract: (address: string, abi: any[], signer: any) => ({
        address,
        abi,
        signer,
        distributeToRecipient: (...args: any[]) => {
          contractCalls.push({ method: 'distributeToRecipient', args });
          return { wait: async () => ({ transactionHash: '0xrot123', blockNumber: 7 }) };
        },
      }),
      createResilientProvider: (_providerUrl: string) => ({
        call: async (callback: (provider: any) => Promise<any>) => callback({}),
      }),
    });

    expect(result.txHash).toBe('0xrot123');
    expect(contractCalls.some((call) => call.method === 'distributeToRecipient')).toBe(true);
  });
  });
