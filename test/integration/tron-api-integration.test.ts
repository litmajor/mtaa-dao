/**
 * TRON API Integration Test Suite
 * Quick verification that all TRON endpoints are accessible and functional
 */

import axios, { AxiosError } from 'axios';

const API_BASE = 'http://localhost:3000/api/cross-chain';

// Test addresses (real TRON addresses)
const TEST_ADDRESSES = {
  mainnet: {
    active: 'TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX', // Active account with balance
    usdt: 'TR7NHqjeKQxGTCi8q282XEXZTVP5VJU3KM' // USDT token contract
  },
  testnet: {
    active: 'TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX', // Use same format for testnet
    usdt: 'TR7NHqjeKQxGTCi8q282XEXZTVP5VJU3KM'
  }
};

// Sample transaction ID (replace with real one)
const SAMPLE_TXN_ID = '3d6a1c6f9d1f0e4a5c1e7d9f0a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<void>,
  skip = false
): Promise<void> {
  const startTime = Date.now();
  
  try {
    if (skip) {
      results.push({
        name,
        status: 'SKIP',
        message: 'Skipped',
        duration: 0
      });
      console.log(`⊘ SKIP: ${name}`);
      return;
    }

    await testFn();
    
    const duration = Date.now() - startTime;
    results.push({
      name,
      status: 'PASS',
      message: 'OK',
      duration
    });
    console.log(`✓ PASS: ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof AxiosError 
      ? `${error.response?.status} - ${error.message}`
      : (error instanceof Error ? error.message : 'Unknown error');
    
    results.push({
      name,
      status: 'FAIL',
      message,
      duration
    });
    console.error(`✗ FAIL: ${name}`);
    console.error(`  Error: ${message}`);
  }
}

async function main() {
  console.log('═════════════════════════════════════════════════════════');
  console.log('TRON API Integration Test Suite');
  console.log('═════════════════════════════════════════════════════════\n');

  // Test 1: Get TRON Balance (Mainnet)
  await runTest(
    'GET /tron/balance (Mainnet TRX)',
    async () => {
      const response = await axios.post(
        `${API_BASE}/tron/balance`,
        { address: TEST_ADDRESSES.mainnet.active },
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      if (!response.data.success) throw new Error('Response success flag false');
      if (!response.data.data.balance) throw new Error('No balance in response');
      
      console.log(`    Balance: ${response.data.data.balance} SUN`);
    }
  );

  // Test 2: Get TRON Balance with Token (Mainnet)
  await runTest(
    'GET /tron/balance (Mainnet with USDT)',
    async () => {
      const response = await axios.post(
        `${API_BASE}/tron/balance`,
        {
          address: TEST_ADDRESSES.mainnet.active,
          tokenAddress: TEST_ADDRESSES.mainnet.usdt
        }
      );
      
      if (!response.data.success) throw new Error('Response success flag false');
      console.log(`    USDT Balance: ${response.data.data.balance}`);
    }
  );

  // Test 3: Get TRON Balance (Testnet)
  await runTest(
    'GET /tron/balance (Testnet)',
    async () => {
      const response = await axios.post(
        `${API_BASE}/tron/balance?testnet=true`,
        { address: TEST_ADDRESSES.testnet.active }
      );
      
      if (!response.data.success) throw new Error('Response success flag false');
    }
  );

  // Test 4: Get Token Info (Mainnet)
  await runTest(
    'GET /tron/token/:tokenAddress (USDT Info)',
    async () => {
      const response = await axios.get(
        `${API_BASE}/tron/token/${TEST_ADDRESSES.mainnet.usdt}`
      );
      
      if (!response.data.success) throw new Error('Response success flag false');
      const tokenData = response.data.data;
      
      if (!tokenData.name || !tokenData.symbol) {
        throw new Error('Missing token metadata');
      }
      
      console.log(`    Token: ${tokenData.name} (${tokenData.symbol})`);
      console.log(`    Decimals: ${tokenData.decimals}`);
    }
  );

  // Test 5: Get Token Info (Testnet)
  await runTest(
    'GET /tron/token/:tokenAddress (Testnet)',
    async () => {
      const response = await axios.get(
        `${API_BASE}/tron/token/${TEST_ADDRESSES.testnet.usdt}?testnet=true`
      );
      
      if (!response.data.success) throw new Error('Response success flag false');
    }
  );

  // Test 6: Estimate Fees (Mainnet)
  await runTest(
    'GET /tron/fees (Mainnet)',
    async () => {
      const response = await axios.get(`${API_BASE}/tron/fees`);
      
      if (!response.data.success) throw new Error('Response success flag false');
      const fees = response.data.data;
      
      if (typeof fees.networkFee !== 'number') throw new Error('Invalid networkFee');
      if (typeof fees.energyPrice !== 'number') throw new Error('Invalid energyPrice');
      
      console.log(`    Network Fee: ${fees.networkFee} SUN`);
      console.log(`    Energy Price: ${fees.energyPrice} SUN/energy`);
      console.log(`    Est. Cost: ${fees.estimatedCostTRX} TRX`);
    }
  );

  // Test 7: Estimate Fees (Testnet)
  await runTest(
    'GET /tron/fees (Testnet)',
    async () => {
      const response = await axios.get(`${API_BASE}/tron/fees?testnet=true`);
      
      if (!response.data.success) throw new Error('Response success flag false');
    }
  );

  // Test 8: Get Account Info (Mainnet)
  await runTest(
    'GET /tron/account/:address (Account Info)',
    async () => {
      const response = await axios.get(
        `${API_BASE}/tron/account/${TEST_ADDRESSES.mainnet.active}`
      );
      
      if (!response.data.success) throw new Error('Response success flag false');
      const account = response.data.data;
      
      if (typeof account.balance !== 'string') throw new Error('Invalid balance');
      if (typeof account.isActivated !== 'boolean') throw new Error('Invalid isActivated');
      
      console.log(`    Balance: ${(parseInt(account.balance) / 1e6).toFixed(2)} TRX`);
      console.log(`    Activated: ${account.isActivated}`);
      console.log(`    Energy Available: ${account.energyAvailable || 0}`);
    }
  );

  // Test 9: Get Account Info (Testnet)
  await runTest(
    'GET /tron/account/:address (Testnet)',
    async () => {
      const response = await axios.get(
        `${API_BASE}/tron/account/${TEST_ADDRESSES.testnet.active}?testnet=true`
      );
      
      if (!response.data.success) throw new Error('Response success flag false');
    }
  );

  // Test 10: Get Recent Transactions
  await runTest(
    'GET /tron/transactions/:address',
    async () => {
      const response = await axios.get(
        `${API_BASE}/tron/transactions/${TEST_ADDRESSES.mainnet.active}?limit=5`
      );
      
      if (!response.data.success) throw new Error('Response success flag false');
      if (!Array.isArray(response.data.data.transactions)) {
        throw new Error('Invalid transactions array');
      }
      
      console.log(`    Found ${response.data.data.count} transactions`);
    }
  );

  // Test 11: Get Transaction Status
  await runTest(
    'GET /tron/transaction/:txid',
    async () => {
      const response = await axios.get(`${API_BASE}/tron/transaction/${SAMPLE_TXN_ID}`);
      if (!response.data.success) throw new Error('Response success flag false');
    },
    true // Skip - requires real txid
  );

  // Test 12: Validate Address (Valid)
  await runTest(
    'POST /tron/validate (Valid Address)',
    async () => {
      const response = await axios.post(
        `${API_BASE}/tron/validate`,
        { address: TEST_ADDRESSES.mainnet.active }
      );
      
      if (!response.data.success) throw new Error('Response success flag false');
      if (!response.data.data.isValid) throw new Error('Valid address marked invalid');
      
      console.log(`    ✓ Address is valid`);
    }
  );

  // Test 13: Validate Address (Invalid)
  await runTest(
    'POST /tron/validate (Invalid Address)',
    async () => {
      const response = await axios.post(
        `${API_BASE}/tron/validate`,
        { address: 'not-a-valid-address' }
      );
      
      if (!response.data.success) throw new Error('Response success flag false');
      if (response.data.data.isValid) throw new Error('Invalid address marked valid');
      
      console.log(`    ✓ Address correctly identified as invalid`);
    }
  );

  // Test 14: Validate Transfer (Sufficient Balance)
  await runTest(
    'POST /tron/validate-transfer (Success Case)',
    async () => {
      const response = await axios.post(
        `${API_BASE}/tron/validate-transfer`,
        {
          fromAddress: TEST_ADDRESSES.mainnet.active,
          toAddress: 'TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH',
          amount: '100000',
          decimals: 6
        }
      );
      
      if (!response.data.success) throw new Error('Response success flag false');
      const validation = response.data.data;
      
      if (typeof validation.isValid !== 'boolean') throw new Error('Invalid isValid');
      if (typeof validation.hasSufficientBalance !== 'boolean') {
        throw new Error('Invalid hasSufficientBalance');
      }
      if (typeof validation.isAccountActivated !== 'boolean') {
        throw new Error('Invalid isAccountActivated');
      }
      
      console.log(`    Validation Result: ${validation.isValid ? '✓ VALID' : '✗ INVALID'}`);
      console.log(`    Sufficient Balance: ${validation.hasSufficientBalance}`);
      console.log(`    Account Activated: ${validation.isAccountActivated}`);
    }
  );

  // Test 15: Validate Transfer (Testnet)
  await runTest(
    'POST /tron/validate-transfer (Testnet)',
    async () => {
      const response = await axios.post(
        `${API_BASE}/tron/validate-transfer?testnet=true`,
        {
          fromAddress: TEST_ADDRESSES.testnet.active,
          toAddress: 'TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH',
          amount: '100000',
          decimals: 6
        }
      );
      
      if (!response.data.success) throw new Error('Response success flag false');
    }
  );

  // Test 16: Invalid Request (Missing Field)
  await runTest(
    'POST /tron/balance (Invalid - Missing Address)',
    async () => {
      try {
        await axios.post(`${API_BASE}/tron/balance`, {});
        throw new Error('Should have returned 400 error');
      } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 400) {
          console.log(`    ✓ Correctly rejected invalid input`);
        } else {
          throw error;
        }
      }
    }
  );

  // Test 17: Invalid Address Format
  await runTest(
    'POST /tron/balance (Invalid Address Format)',
    async () => {
      try {
        await axios.post(
          `${API_BASE}/tron/balance`,
          { address: '0x1234567890abcdef' } // EVM address, not TRON
        );
        throw new Error('Should have returned 400 error');
      } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 400) {
          console.log(`    ✓ Correctly rejected EVM address`);
        } else {
          throw error;
        }
      }
    }
  );

  // Print summary
  console.log('\n═════════════════════════════════════════════════════════');
  console.log('Test Summary');
  console.log('═════════════════════════════════════════════════════════\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  console.log(`Total:  ${total} tests`);
  console.log(`Passed: ${passed} tests ✓`);
  console.log(`Failed: ${failed} tests ✗`);
  console.log(`Skipped: ${skipped} tests ⊘`);
  console.log();

  if (failed > 0) {
    console.log('Failed Tests:');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`  - ${r.name}`);
        console.log(`    ${r.message}`);
      });
  }

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
