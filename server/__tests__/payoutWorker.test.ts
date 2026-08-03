import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateCalls: Array<{ status: string; lastError?: string; retryCount?: number; transactionHash?: string }> = [];
const selectResults: Array<Record<string, unknown>> = [];

const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => selectResults,
      }),
    }),
  }),
  update: () => ({
    set: (values: Record<string, unknown>) => ({
      where: async () => {
        updateCalls.push(values as any);
      },
    }),
  }),
};

vi.mock('../db', () => ({ db: mockDb }));
vi.mock('../shared/financialEnhancedSchema', () => ({ referralPayouts: { status: 'status', id: 'id' } }));
vi.mock('../utils/cryptoWallet', () => ({
  createWalletIfValid: (_privateKey: string, provider: any) => ({
    address: '0xabc',
    provider,
    sendTransaction: async () => ({ hash: '0xabc123' }),
  }),
}));

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');

  class MockJsonRpcProvider {
    constructor(public url: string) {}

    async getFeeData() {
      if (this.url === 'https://primary.example') {
        throw Object.assign(new Error('rate limited'), { status: 429 });
      }
      return {
        maxFeePerGas: 1n,
        maxPriorityFeePerGas: 1n,
      };
    }
  }

  class MockContract {
    constructor(public address: string, public abi: any[], public signer: any) {}

    async distributeReward() {
      return { hash: '0xabc123' };
    }
  }

  return {
    ...actual,
    JsonRpcProvider: MockJsonRpcProvider,
    Contract: MockContract,
  };
});

describe('payout worker', () => {
  beforeEach(() => {
    updateCalls.length = 0;
    selectResults.length = 0;
    selectResults.push({ id: 'payout-1', amount: 5, destinationAddress: '0xdef', requestId: null, retryCount: 0 });
  });

  it('uses the resilient provider path for payout execution and completes via fallback after a 429', async () => {
    vi.stubEnv('CELO_RPC_URL', 'https://primary.example');
    vi.stubEnv('CELO_RPC_FALLBACK_URL', 'https://fallback.example');
    vi.stubEnv('PRIVATE_KEY', '0x' + 'a'.repeat(64));
    vi.stubEnv('MTAA_CONTRACT_ADDR', '0x1234');

    const { processPendingPayouts } = await import('../services/payout-worker');
    const { JsonRpcProvider } = await import('ethers');
    const recorded: Array<{ signer: any; args: any[] }> = [];
    await processPendingPayouts({
      createProvider: (url: string) => new JsonRpcProvider(url) as any,
      createWallet: (_privateKey: string, provider: any) => ({ address: '0xabc', provider } as any),
      createContract: (address: string, abi: string[], signer: any) => {
        const contract = {
          address,
          abi,
          signer,
          distributeReward: async (...args: any[]) => {
            recorded.push({ signer, args });
            return { hash: '0xabc123' };
          },
        };
        return contract;
      },
    });

    expect(recorded).toHaveLength(1);
    expect(recorded[0].signer.address).toBe('0xabc');
    expect(recorded[0].args[0]).toBeDefined();
    expect(recorded[0].args[1]).toBe('0xdef');

    expect(updateCalls).toContainEqual(expect.objectContaining({ status: 'completed', transactionHash: '0xabc123' }));
    expect(updateCalls.some((call) => call.status === 'failed')).toBe(false);
  });
});
