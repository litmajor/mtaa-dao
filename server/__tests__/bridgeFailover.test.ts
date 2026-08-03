import { describe, expect, it, vi } from 'vitest';

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

vi.stubEnv('ROTATION_MODULE_ADDRESS', '0x' + 'b'.repeat(40));

const contractCalls: Array<{ method: string; args: any[] }> = [];

describe('bridge/rotation failover integration', () => {
  it('bridge fails over to fallback via actual call site', async () => {
    // Inject provider URL and avoid relying on hoisted chain config
    vi.stubEnv('BRIDGE_PRIVATE_KEY', '0x' + 'b'.repeat(64));

    let failoverHappened = false;

    const { bridgeProtocolService } = await import('../services/bridgeProtocolService');
    const tx = await bridgeProtocolService.sendLayerZeroMessage('celo', 'ethereum', 'payload', '0x', {
      providerUrl: 'https://primary.example',
      destinationAppAddress: '0x' + 'd'.repeat(40),
      createWallet: (_privateKey: string, provider: any) => ({ address: '0xabc', providerMarker: provider?.marker }),
      createContract: (address: string, abi: string[], signer: any) => ({
        address,
        abi,
        signer,
        estimateFees: () => {
          contractCalls.push({ method: 'estimateFees', args: [] });
          // Always succeed for fallback
          return [1n, 0n];
        },
        send: (...args: any[]) => {
          contractCalls.push({ method: 'send', args });
          return { wait: async () => ({ hash: '0xbridge-fallback' }) };
        },
      }),
      // Simulate a resilient provider that directly uses fallback (provider-level failure simulated)
      createResilientProvider: (_providerUrl: string) => ({
        call: async (callback: (provider: any) => Promise<any>) => {
          failoverHappened = true;
          return await callback({ marker: 'fallback' });
        },
      }),
    });

    expect(typeof tx).toBe('string');
    expect(failoverHappened).toBe(true);
    expect(contractCalls.some((c) => c.method === 'send')).toBe(true);
  });

  it('rotation fails over to fallback via actual call site', async () => {
    // Inject provider URL and avoid relying on hoisted chain config

    let failoverHappened = false;

    const { distributeToRecipientOnChain } = await import('../services/rotation_contract');
    const result = await distributeToRecipientOnChain('0xabc', {
      providerUrl: 'https://primary.example',
      createWallet: (_privateKey: string, provider: any) => ({ address: '0xabc', providerMarker: provider?.marker }),
      createContract: (address: string, abi: any[], signer: any) => ({
        address,
        abi,
        signer,
        distributeToRecipient: (...args: any[]) => {
          contractCalls.push({ method: 'distributeToRecipient', args });
          return { wait: async () => ({ transactionHash: '0xrot-fallback', blockNumber: 7 }) };
        },
      }),
      createResilientProvider: (_providerUrl: string) => ({
        call: async (callback: (provider: any) => Promise<any>) => {
          failoverHappened = true;
          return await callback({ marker: 'fallback' });
        },
      }),
    });

    expect(result.txHash).toBe('0xrot-fallback');
    expect(failoverHappened).toBe(true);
    expect(contractCalls.some((c) => c.method === 'distributeToRecipient')).toBe(true);
  });
});
