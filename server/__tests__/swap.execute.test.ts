import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Pool, PoolClient } from 'pg';
import { crossChainSwapService, type SwapQuote } from '../services/crossChainSwapService';
import { SupportedChain } from '../../shared/chainRegistry';
import { randomUUID } from 'crypto';

// Mock db.insert to use raw SQL (avoiding Drizzle ORM initialization issues)
let testPool: Pool;

// Mapping from camelCase (Drizzle) to snake_case (SQL)
const camelToSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

vi.mock('../db', () => {
  return {
    db: {
      insert: (table: any) => ({
        values: (data: any) => ({
          returning: async () => {
            if (!testPool) {
              testPool = new Pool({ connectionString: process.env.DATABASE_URL });
            }
            
            // Insert using raw SQL, converting camelCase keys to snake_case
            const cols = Object.keys(data).map(k => camelToSnakeCase(k));
            const vals = Object.values(data);
            const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');
            const colStr = cols.join(',');
            const query = `INSERT INTO cross_chain_transfers (${colStr}) VALUES (${placeholders}) RETURNING id`;
            
            try {
              const result = await testPool.query(query, vals);
              return result.rows.map((row: any) => ({ id: row.id, ...data }));
            } catch (error: any) {
              console.error('SQL Insert Error:', {
                query,
                cols,
                vals,
                error: error.message,
                detail: error.detail
              });
              throw error;
            }
          }
        })
      }),
      update: (table: any) => ({
        set: () => ({
          where: async () => {}
        })
      })
    }
  };
});

// Mock synchronizerAgent to avoid background processing
vi.mock('../agents/synchronizer', () => ({
  synchronizerAgent: {
    receiveState: vi.fn()
  }
}));

describe('executeSwap persistence (real database)', () => {
  let pool: Pool;
  let testClient: PoolClient;

  beforeEach(async () => {
    // Mock processSwap to prevent actual background work
    vi.spyOn(crossChainSwapService as any, 'processSwap').mockResolvedValue(undefined);

    // Connect to test database
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not set for persistence tests');
    }

    pool = new Pool({ connectionString: databaseUrl });
    testClient = await pool.connect();
  });

  afterEach(async () => {
    // Clean up test data
    if (testClient) {
      await testClient.query('DELETE FROM cross_chain_transfers WHERE user_id LIKE $1', ['test-user-%']);
      testClient.release();
    }
    if (pool) {
      await pool.end();
    }
    vi.clearAllMocks();
  });

  it('persists swap quote to database with correct schema and values', async () => {
    const testUserId = `test-user-${Date.now()}`;
    const userAddress = '0xuser123abc';

    const dummyQuote = {
      fromChain: SupportedChain.CELO,
      toChain: SupportedChain.POLYGON,
      fromToken: '0x471EcE3750Da237f93B8E339c536989b8978a438',
      toToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      fromAmount: '1000000000000000000', // 1 CELO
      estimatedToAmount: '950000000000000', // ~950 USDC (6 decimals, scaled to 18)
      exchangeRate: 0.95,
      priceImpact: 1.0,
      estimatedGas: '0.05',
      route: ['0x471EcE3750Da237f93B8E339c536989b8978a438', 'Bridge', '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'],
      bridgeFee: '1000000000000000',
      slippageTolerance: 1.0,
    } as unknown as SwapQuote;

    // Execute swap (writes to DB)
    let execution;
    try {
      execution = await crossChainSwapService.executeSwap(testUserId, dummyQuote, userAddress);
    } catch (error: any) {
      console.error('executeSwap error:', error?.message, error?.cause);
      throw error;
    }

    // Verify the execution response
    expect(execution).toHaveProperty('swapId');
    expect(execution.status).toBe('pending');

    // Query the database to verify persistence
    const result = await testClient.query(
      'SELECT * FROM cross_chain_transfers WHERE id = $1',
      [execution.swapId]
    );

    expect(result.rows.length).toBe(1);
    const row = result.rows[0];

    // Verify all required fields were persisted
    expect(row.id).toBe(execution.swapId);
    expect(row.user_id).toBe(testUserId);
    expect(row.source_chain).toBe('celo');
    expect(row.target_chain).toBe('polygon');
    expect(row.source_token).toBe('0x471EcE3750Da237f93B8E339c536989b8978a438');
    expect(row.target_token).toBe('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174');
    // Decimal values from DB include trailing zeros; normalize for comparison
    expect(row.source_amount?.toString().replace(/\.0+$/, '')).toBe('1000000000000000000');
    expect(row.target_amount?.toString().replace(/\.0+$/, '')).toBe('950000000000000');
    expect(row.recipient_address).toBe(userAddress);
    expect(row.status).toBe('pending');
    expect(row.bridge_protocol).toBe('none'); // default value
    expect(row.withdrawal_id).toBeDefined(); // should be auto-generated UUID
    expect(row.created_at).toBeDefined(); // should have timestamp
  });

  it('persists swap with slippage tolerance and all quote data', async () => {
    const testUserId = `test-user-slippage-${Date.now()}`;
    const userAddress = '0xuser456def';

    const quoteWithSlippage = {
      fromChain: SupportedChain.BSC,
      toChain: SupportedChain.ETHEREUM,
      fromToken: '0x55d398326f99059fF775485246999027B3197955', // USDT on BSC
      toToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
      fromAmount: '5000000000000000000', // 5 tokens
      estimatedToAmount: '4975000000000000000', // 4.975 tokens (0.5% slippage)
      exchangeRate: 0.995,
      priceImpact: 2.5,
      estimatedGas: '0.15',
      route: ['0x55d398326f99059fF775485246999027B3197955', 'Bridge', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'],
      bridgeFee: '5000000000000000', // 0.1%
      slippageTolerance: 2.0,
    } as unknown as SwapQuote;

    const execution = await crossChainSwapService.executeSwap(testUserId, quoteWithSlippage, userAddress);

    // Verify persistence
    const result = await testClient.query(
      'SELECT * FROM cross_chain_transfers WHERE id = $1',
      [execution.swapId]
    );

    expect(result.rows.length).toBe(1);
    const row = result.rows[0];

    expect(row.source_amount?.toString().replace(/\.0+$/, '')).toBe('5000000000000000000');
    expect(row.target_amount?.toString().replace(/\.0+$/, '')).toBe('4975000000000000000');
    expect(row.source_chain).toBe('bsc');
    expect(row.target_chain).toBe('ethereum');
    expect(row.status).toBe('pending');
    expect(row.recipient_address).toBe(userAddress);
  });

  it('each swap gets unique withdrawalId and swapId', async () => {
    const testUserId = `test-user-unique-${Date.now()}`;
    const userAddress = '0xuserUnique';

    const quote = {
      fromChain: SupportedChain.CELO,
      toChain: SupportedChain.CELO,
      fromToken: '0x471EcE3750Da237f93B8E339c536989b8978a438',
      toToken: '0x471EcE3750Da237f93B8E339c536989b8978a438',
      fromAmount: '1000000000000000000',
      estimatedToAmount: '1000000000000000000',
      exchangeRate: 1.0,
      priceImpact: 0,
      estimatedGas: '0.01',
      route: ['direct'],
      bridgeFee: '0',
      slippageTolerance: 0.1,
    } as unknown as SwapQuote;

    // Execute two swaps
    const exec1 = await crossChainSwapService.executeSwap(testUserId, quote, userAddress);
    const exec2 = await crossChainSwapService.executeSwap(testUserId, quote, userAddress);

    expect(exec1.swapId).not.toBe(exec2.swapId);
    expect(exec1.status).toBe('pending');
    expect(exec2.status).toBe('pending');
  });

  it('persists large realistic swap amounts near decimal(38,18) boundary', async () => {
    const testUserId = `test-user-large-${Date.now()}`;
    const userAddress = '0xuserLarge';

    // decimal(38, 18) max value ≈ 10^20 (20 integer digits)
    // Test with 99 tokens at 18 decimals = 99 * 10^18 (safely under the boundary)
    // This represents a realistic large swap
    const largeAmount = '99000000000000000000'; // 99 tokens, 18 decimals

    const largeQuote = {
      fromChain: SupportedChain.ETHEREUM,
      toChain: SupportedChain.POLYGON,
      fromToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      toToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
      fromAmount: largeAmount, // 99 WETH
      estimatedToAmount: '148500000000', // ~1485 USDC (6 decimals, scaled)
      exchangeRate: 1500,
      priceImpact: 0.5,
      estimatedGas: '0.5',
      route: ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 'Uniswap', '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'],
      bridgeFee: '1485000000', // 0.1%
      slippageTolerance: 1.0,
    } as unknown as SwapQuote;

    const execution = await crossChainSwapService.executeSwap(testUserId, largeQuote, userAddress);
    expect(execution.status).toBe('pending');

    // Verify in database
    const result = await testClient.query(
      'SELECT source_amount, target_amount FROM cross_chain_transfers WHERE id = $1',
      [execution.swapId]
    );

    expect(result.rows.length).toBe(1);
    const row = result.rows[0];

    // Verify large amounts persisted correctly (normalized for decimal trailing zeros)
    expect(row.source_amount?.toString().replace(/\.0+$/, '')).toBe(largeAmount);
    expect(row.target_amount?.toString().replace(/\.0+$/, '')).toBe('148500000000');
  });
});

describe('decimal(38,18) boundary validation', () => {
  // This test validates that the schema change actually solves the overflow issue
  // and documents the practical limits for token amounts
  let testPool: Pool;
  let testClient: PoolClient;

  beforeEach(async () => {
    if (!testPool) {
      testPool = new Pool({ connectionString: process.env.DATABASE_URL });
    }
    testClient = await testPool.connect();
  });

  afterEach(async () => {
    await testClient.query('DELETE FROM cross_chain_transfers WHERE user_id LIKE $1', ['boundary-test-%']);
    testClient.release();
  });

  it('verifies decimal(38,18) ceiling accommodates realistic token amounts', async () => {
    // decimal(38, 18): 38 total digits, 18 after decimal = max value ≈ 10^20 (99.9 * 10^18)
    // Token amounts represented in atomic units (wei) at 18 decimals
    
    const testCases = [
      { name: '1 token', value: '1000000000000000000' },           // 10^18 ✅
      { name: '99 tokens (near boundary)', value: '99000000000000000000' },  // 99 * 10^18 ✅
      { name: '100,000 tokens', value: '100000000000000000000000' }, // 10^23 - should fail
    ];

    for (const testCase of testCases.slice(0, 2)) { // Only test the ones that should pass
      try {
        await testClient.query(
          `INSERT INTO cross_chain_transfers (
            withdrawal_id, user_id, source_chain, source_token,
            source_amount, target_chain, target_token, target_amount, 
            recipient_address, status
          ) VALUES ($1, $2, 'test-chain', '0xtest', $3, 'test-chain', '0xtest', $3, '0xtest', 'pending')`,
          [randomUUID(), `boundary-test-${testCase.name}`, testCase.value]
        );
        console.log(`✓ ${testCase.name} persisted successfully`);
      } catch (error: any) {
        console.error(`✗ ${testCase.name} failed:`, error.message);
        throw error;
      }
    }

    // Verify that amounts beyond boundary would fail
    try {
      await testClient.query(
        `INSERT INTO cross_chain_transfers (
          withdrawal_id, user_id, source_chain, source_token,
          source_amount, target_chain, target_token, target_amount,
          recipient_address, status
        ) VALUES ($1, $2, 'test-chain', '0xtest', $3, 'test-chain', '0xtest', $3, '0xtest', 'pending')`,
        [randomUUID(), 'boundary-test-overflow', '100000000000000000000000']
      );
      throw new Error('Expected overflow error but insert succeeded');
    } catch (error: any) {
      // This is expected
      expect(error.message).toContain('numeric field overflow');
      console.log('✓ Correctly rejected amount beyond decimal(38,18) capacity');
    }
  });
});
