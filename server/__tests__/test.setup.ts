import { vi } from 'vitest';

// Set up required environment variables FIRST, before any module imports
// This ensures config validation doesn't fail on import
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-this-is-long-enough-for-32-chars-requirement';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-this-is-long-enough-for-32-chars';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-this-is-long-enough-for-32-chars';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || 'flutterwave-secret';
process.env.PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'paystack-secret';
process.env.WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '123456';
process.env.WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || 'token';

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
