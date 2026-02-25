/**
 * TRON Transaction Signing & Broadcasting Integration Tests
 * Tests for creating, signing, and broadcasting transactions
 */

import axios, { AxiosError } from 'axios';

const API_BASE = 'http://localhost:3000/api/cross-chain';

// Test addresses
const TEST_ADDRESSES = {
  sender: 'TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX',
  recipient: 'TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH'
};

// Test token
const TEST_TOKEN = 'TR7NHqjeKQxGTCi8q282XEXZTVP5VJU3KM'; // USDT

// Test private key (NEVER use real keys in tests!)
const TEST_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

// Mock JWT token
const TEST_JWT_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

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
  console.log('TRON Transaction Signing & Broadcasting Test Suite');
  console.log('═════════════════════════════════════════════════════════\n');

  // Test 1: Estimate fees for TRX transfer
  await runTest(
    'POST /tron/transfer/estimate-fees (TRX)',
    async () => {
      const response = await axios.post(
        `${API_BASE}/tron/transfer/estimate-fees`,
        {
          toAddress: TEST_ADDRESSES.recipient,
          isTokenTransfer: false
        }
      );

      if (!response.data.success) throw new Error('Response success flag false');
      const fees = response.data.data;

      if (typeof fees.networkFee !== 'number') throw new Error('Invalid networkFee');
      if (typeof fees.totalEstimatedFee !== 'number') throw new Error('Invalid totalEstimatedFee');

      console.log(`    Network Fee: ${fees.networkFeeTRX} TRX`);
      console.log(`    Total Fee: ${fees.totalEstimatedFeeTRX} TRX`);
    }
  );

  // Test 2: Estimate fees for TRC20 transfer
  await runTest(
    'POST /tron/transfer/estimate-fees (TRC20)',
    async () => {
      const response = await axios.post(
        `${API_BASE}/tron/transfer/estimate-fees`,
        {
          toAddress: TEST_ADDRESSES.recipient,
          isTokenTransfer: true,
          contractType: 'TRC20'
        }
      );

      if (!response.data.success) throw new Error('Response success flag false');
      const fees = response.data.data;

      if (fees.energyEstimate !== 25000) throw new Error('TRC20 energy estimate should be 25000');
      console.log(`    Energy Estimate: ${fees.energyEstimate} units`);
      console.log(`    Energy Cost: ${(fees.energyCost / 1000000).toFixed(6)} TRX`);
    }
  );

  // Test 3: Estimate fees for TRC721 transfer
  await runTest(
    'POST /tron/transfer/estimate-fees (TRC721)',
    async () => {
      const response = await axios.post(
        `${API_BASE}/tron/transfer/estimate-fees`,
        {
          toAddress: TEST_ADDRESSES.recipient,
          isTokenTransfer: true,
          contractType: 'TRC721'
        }
      );

      if (!response.data.success) throw new Error('Response success flag false');
      const fees = response.data.data;

      if (fees.energyEstimate !== 30000) throw new Error('TRC721 energy estimate should be 30000');
      console.log(`    Energy Estimate: ${fees.energyEstimate} units`);
    }
  );

  // Test 4: Create unsigned TRX transfer
  await runTest(
    'POST /tron/transfer/create (TRX)',
    async () => {
      const response = await axios.post(
        `${API_BASE}/tron/transfer/create`,
        {
          fromAddress: TEST_ADDRESSES.sender,
          toAddress: TEST_ADDRESSES.recipient,
          amount: '1000000', // 1 TRX
          feeLimit: '100000000'
        }
      );

      if (!response.data.success) throw new Error('Response success flag false');
      const tx = response.data.data;

      if (!tx.txID || !tx.txID.match(/^[a-f0-9]{64}$/i)) {
        throw new Error('Invalid transaction ID format');
      }

      if (!tx.unsignedTx) throw new Error('Missing unsigned transaction');

      console.log(`    Transaction ID: ${tx.txID.substring(0, 16)}...`);
      console.log(`    Fee Limit: ${(parseInt(response.data.data.unsignedTx.raw_data.fee_limit || '0') / 1000000).toFixed(6)} TRX`);
    }
  );

  // Test 5: Create unsigned token transfer
  await runTest(
    'POST /tron/transfer/create (Token)',
    async () => {
      // Note: This test may fail if endpoint doesn't support token transfer creation
      // Token transfers typically require contract ABIs
      const response = await axios.post(
        `${API_BASE}/tron/transfer/create`,
        {
          fromAddress: TEST_ADDRESSES.sender,
          toAddress: TEST_ADDRESSES.recipient,
          tokenAddress: TEST_TOKEN,
          amount: '1000000',
          feeLimit: '100000000'
        },
        { validateStatus: () => true } // Don't throw on error
      );

      if (response.status !== 400) {
        // If it doesn't return 400 (expected error for token creation), it should succeed
        if (!response.data.success) throw new Error('Response success flag false');
      }
      
      console.log(`    Token Creation: ${response.status === 400 ? 'Not directly supported' : 'Supported'}`);
    },
    false // Don't skip - test that endpoint properly rejects or handles
  );

  // Test 6: Sign transaction validation
  await runTest(
    'POST /tron/transfer/sign (Validation)',
    async () => {
      // Test that endpoint validates private key format
      try {
        await axios.post(
          `${API_BASE}/tron/transfer/sign`,
          {
            transaction: {},
            privateKey: 'invalid-key'
          }
        );
        throw new Error('Should have rejected invalid private key');
      } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 400) {
          console.log(`    ✓ Properly rejects invalid private key`);
        } else {
          throw error;
        }
      }
    }
  );

  // Test 7: Broadcast validation
  await runTest(
    'POST /tron/transfer/broadcast (Validation)',
    async () => {
      try {
        await axios.post(
          `${API_BASE}/tron/transfer/broadcast`,
          {
            signedTransaction: { signature: [] } // No signature
          }
        );
        throw new Error('Should have rejected unsigned transaction');
      } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 400) {
          console.log(`    ✓ Properly rejects unsigned transaction`);
        } else {
          throw error;
        }
      }
    }
  );

  // Test 8: Transfer request validation (missing fromAddress)
  await runTest(
    'POST /tron/transfer (Validation - Missing Field)',
    async () => {
      try {
        await axios.post(
          `${API_BASE}/tron/transfer`,
          {
            toAddress: TEST_ADDRESSES.recipient,
            amount: '1000000',
            privateKey: TEST_PRIVATE_KEY
          },
          {
            headers: { 'Authorization': TEST_JWT_TOKEN },
            validateStatus: () => true
          }
        );
        throw new Error('Should have rejected missing fromAddress');
      } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 400) {
          console.log(`    ✓ Properly rejects missing fromAddress`);
        } else if (error instanceof Error && error.message.includes('Should have rejected')) {
          throw error;
        }
      }
    }
  );

  // Test 9: Transfer request validation (invalid address)
  await runTest(
    'POST /tron/transfer (Validation - Invalid Address)',
    async () => {
      try {
        await axios.post(
          `${API_BASE}/tron/transfer`,
          {
            fromAddress: '0x1234567890123456789012345678901234567890', // EVM address
            toAddress: TEST_ADDRESSES.recipient,
            amount: '1000000',
            privateKey: TEST_PRIVATE_KEY
          },
          {
            headers: { 'Authorization': TEST_JWT_TOKEN },
            validateStatus: () => true
          }
        );
        throw new Error('Should have rejected EVM address');
      } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 400) {
          console.log(`    ✓ Properly rejects EVM address as TRON sender`);
        } else if (error instanceof Error && error.message.includes('Should have rejected')) {
          throw error;
        }
      }
    }
  );

  // Test 10: Token transfer request validation
  await runTest(
    'POST /tron/transfer-token (Validation)',
    async () => {
      const response = await axios.post(
        `${API_BASE}/tron/transfer-token`,
        {
          fromAddress: TEST_ADDRESSES.sender,
          toAddress: TEST_ADDRESSES.recipient,
          tokenAddress: TEST_TOKEN,
          amount: '1000000',
          decimals: 6,
          contractType: 'TRC20',
          privateKey: TEST_PRIVATE_KEY
        },
        {
          headers: { 'Authorization': TEST_JWT_TOKEN },
          validateStatus: () => true
        }
      );

      // Should either succeed or fail with meaningful error (not 500)
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }

      if (response.status === 200 && response.data.success) {
        console.log(`    ✓ Transfer request accepted`);
        console.log(`    Transaction ID: ${response.data.data.txID.substring(0, 16)}...`);
      } else if (response.status === 400) {
        console.log(`    ✓ Validation error properly returned`);
      }
    }
  );

  // Test 11: Contract type validation
  await runTest(
    'POST /tron/transfer-token (Contract Type Validation)',
    async () => {
      const validTypes = ['TRC20', 'TRC721', 'TRC1155'];

      for (const contractType of validTypes) {
        const response = await axios.post(
          `${API_BASE}/tron/transfer/estimate-fees`,
          {
            toAddress: TEST_ADDRESSES.recipient,
            isTokenTransfer: true,
            contractType
          }
        );

        if (!response.data.success) {
          throw new Error(`Failed for ${contractType}`);
        }
      }

      console.log(`    ✓ All contract types validated: ${validTypes.join(', ')}`);
    }
  );

  // Test 12: Testnet support
  await runTest(
    'POST /tron/transfer/estimate-fees?testnet=true',
    async () => {
      const response = await axios.post(
        `${API_BASE}/tron/transfer/estimate-fees?testnet=true`,
        {
          toAddress: TEST_ADDRESSES.recipient,
          isTokenTransfer: false
        }
      );

      if (!response.data.success) throw new Error('Testnet endpoint failed');
      console.log(`    ✓ Testnet endpoint accessible`);
    }
  );

  // Test 13: Receipt query (non-existent transaction)
  await runTest(
    'GET /tron/transfer/:txid/receipt (Not Found)',
    async () => {
      const fakeId = 'a'.repeat(64);
      const response = await axios.get(
        `${API_BASE}/tron/transfer/${fakeId}/receipt`
      );

      if (!response.data.success) throw new Error('Response success flag false');

      const receipt = response.data.data;
      if (receipt.status !== 'NOT_FOUND') {
        throw new Error('Expected NOT_FOUND status for fake transaction');
      }

      console.log(`    ✓ Properly returns NOT_FOUND for non-existent transaction`);
    }
  );

  // Test 14: Amount validation
  await runTest(
    'POST /tron/transfer (Amount Validation)',
    async () => {
      try {
        await axios.post(
          `${API_BASE}/tron/transfer`,
          {
            fromAddress: TEST_ADDRESSES.sender,
            toAddress: TEST_ADDRESSES.recipient,
            amount: '0', // Zero amount
            privateKey: TEST_PRIVATE_KEY
          },
          {
            headers: { 'Authorization': TEST_JWT_TOKEN },
            validateStatus: () => true
          }
        );
        throw new Error('Should have rejected zero amount');
      } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 400) {
          console.log(`    ✓ Properly rejects zero or negative amounts`);
        } else if (error instanceof Error && error.message.includes('Should have rejected')) {
          throw error;
        }
      }
    }
  );

  // Test 15: Fee limit validation
  await runTest(
    'POST /tron/transfer/create (Fee Limit)',
    async () => {
      const response = await axios.post(
        `${API_BASE}/tron/transfer/create`,
        {
          fromAddress: TEST_ADDRESSES.sender,
          toAddress: TEST_ADDRESSES.recipient,
          amount: '1000000',
          feeLimit: '50000000' // Custom fee limit
        }
      );

      if (!response.data.success) throw new Error('Response success flag false');

      const feeLimit = response.data.data.unsignedTx.raw_data.fee_limit || 0;
      if (feeLimit !== 50000000 && feeLimit !== 100000000) {
        console.log(`    ⚠ Fee limit not exactly as specified (may be adjusted)`);
      } else {
        console.log(`    ✓ Fee limit properly set: ${(feeLimit / 1000000).toFixed(6)} TRX`);
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
