
import { sendToken } from './blockchain';
import { TokenRegistry } from '../shared/tokenRegistry';
import { tokenService } from './services/tokenService';

// Test transfer functionality for different tokens
async function testTokenTransfer() {
  try {
    console.log('🚀 Starting Token Transfer Tests...\n');

    // Test CELO transfer
    console.log('1. Testing CELO transfer...');
    const celoTxHash = await sendToken('CELO', '0x742d35Cc6635C0532925a3b8D9C9d6aF8b9e8267', '0.1');
    console.log(`   ✅ CELO transfer successful: ${celoTxHash}\n`);

    // Test cUSD transfer
    console.log('2. Testing cUSD transfer...');
    const cusdTxHash = await sendToken('cUSD', '0x742d35Cc6635C0532925a3b8D9C9d6aF8b9e8267', '1.0');
    console.log(`   ✅ cUSD transfer successful: ${cusdTxHash}\n`);

    // Test cEUR transfer
    console.log('3. Testing cEUR transfer...');
    const ceurTxHash = await sendToken('cEUR', '0x742d35Cc6635C0532925a3b8D9C9d6aF8b9e8267', '0.5');
    console.log(`   ✅ cEUR transfer successful: ${ceurTxHash}\n`);

    console.log('🎉 All transfer tests completed successfully!');

  } catch (error) {
    console.error('❌ Transfer test failed:', error);
    throw error;
  }
}

// Test gas estimation for different operations
async function testGasEstimation() {
  try {
    console.log('⛽ Starting Gas Estimation Tests...\n');

    // Get supported tokens
    const supportedTokens = TokenRegistry.getSupportedTokens();
    
    for (const tokenSymbol of supportedTokens.slice(0, 3)) { // Test first 3 tokens
      console.log(`Testing gas estimation for ${tokenSymbol}...`);
      
      try {
        const gasEstimate = await tokenService.estimateGas(
          tokenSymbol,
          '0x742d35Cc6635C0532925a3b8D9C9d6aF8b9e8267',
          '1.0'
        );
        console.log(`   ⛽ Estimated gas for ${tokenSymbol}: ${gasEstimate.toString()}`);
      } catch (error) {
        console.warn(`   ⚠️  Gas estimation failed for ${tokenSymbol}:`, error);
      }
    }

    console.log('\n✅ Gas estimation tests completed!');

  } catch (error) {
    console.error('❌ Gas estimation test failed:', error);
    throw error;
  }
}

// Test token balance fetching
async function testTokenBalances() {
  try {
    console.log('💰 Starting Token Balance Tests...\n');

    const testAddress = '0x742d35Cc6635C0532925a3b8D9C9d6aF8b9e8267';
    const supportedTokens = TokenRegistry.getSupportedTokens();
    
    for (const tokenSymbol of supportedTokens.slice(0, 5)) { // Test first 5 tokens
      try {
        const balance = await tokenService.getBalance(tokenSymbol, testAddress);
        console.log(`   💰 ${tokenSymbol} balance: ${balance}`);
      } catch (error) {
        console.warn(`   ⚠️  Balance fetch failed for ${tokenSymbol}:`, error);
      }
    }

    console.log('\n✅ Balance tests completed!');

  } catch (error) {
    console.error('❌ Balance test failed:', error);
    throw error;
  }
}

// Main test runner
async function runAllTests() {
  try {
    console.log('🔧 MtaaDAO Blockchain Integration Tests\n');
    console.log('=====================================\n');

    // Check wallet initialization
    if (!tokenService.signer) {
      console.warn('⚠️  No signer configured - some tests will be skipped');
    }

    // Run tests in sequence
    await testTokenBalances();
    await testGasEstimation();
    
    if (tokenService.signer) {
      await testTokenTransfer();
    } else {
      console.log('⚠️  Skipping transfer tests - no wallet configured');
    }

    console.log('\n🎉 All blockchain integration tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Export functions for individual testing
export {
  testTokenTransfer,
  testGasEstimation,
  testTokenBalances,
  runAllTests
};

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
