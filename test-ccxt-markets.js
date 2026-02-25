#!/usr/bin/env node

/**
 * CCXT Market Scan Test Script
 * 
 * Tests all market scanning endpoints and verifies data loads correctly
 * Run with: node test-ccxt-markets.js
 */

const BASE_URL = process.env.SERVER_URL || 'http://localhost:3000';

async function test(name, url, expectedFields = []) {
  console.log(`\n📊 Testing: ${name}`);
  console.log(`   URL: ${url}`);
  
  try {
    const response = await fetch(`${BASE_URL}${url}`);
    const data = await response.json();
    
    if (!response.ok) {
      console.log(`❌ FAILED (${response.status}): ${data.error || 'Unknown error'}`);
      if (data.details) console.log(`   Details: ${data.details}`);
      return false;
    }
    
    // Check expected fields
    let fieldsOk = true;
    for (const field of expectedFields) {
      if (!(field in data)) {
        console.log(`⚠️  Missing field: ${field}`);
        fieldsOk = false;
      }
    }
    
    // Show summary
    if (data.exchanges_count !== undefined) {
      console.log(`✅ SUCCESS - Found ${data.exchanges_count} exchanges`);
      console.log(`   Unique symbols: ${data.unique_symbols_total}`);
    } else if (data.exchange !== undefined) {
      console.log(`✅ SUCCESS - ${data.exchange}`);
      console.log(`   Total available: ${data.total_available}`);
      console.log(`   Returned: ${data.returned}`);
      console.log(`   Sample symbols: ${data.symbols?.slice(0, 3).join(', ')}`);
    } else if (data.status !== undefined) {
      console.log(`✅ SUCCESS - Status: ${data.status}`);
      if (data.message) console.log(`   ${data.message}`);
    } else if (data.exchanges !== undefined) {
      console.log(`✅ SUCCESS - Found ${data.available?.length || data.exchanges?.length} exchanges`);
      console.log(`   Exchanges: ${data.available?.join(', ') || Object.keys(data.exchanges).join(', ')}`);
    } else if (data.health !== undefined) {
      console.log(`✅ SUCCESS - Health: ${data.health.status}`);
    }
    
    return fieldsOk;
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('🚀 CCXT MARKET SCAN TEST SUITE');
  console.log('='.repeat(60));
  console.log(`Server: ${BASE_URL}`);
  
  const results = [];
  
  // Test 1: Check exchange status
  results.push(await test(
    'Get Exchange Status',
    '/api/exchanges/status',
    ['exchanges', 'available', 'health']
  ));
  
  // Test 2: Get available exchanges
  results.push(await test(
    'Get Available Exchanges',
    '/api/exchanges/available',
    ['exchanges']
  ));
  
  // Test 3: Scan all exchanges
  console.log('\n⏳ This may take a few seconds (scanning all 6 exchanges)...');
  results.push(await test(
    'Scan All Exchanges',
    '/api/exchanges/scan-all?limit=50',
    ['exchanges_count', 'unique_symbols_total', 'scan_results']
  ));
  
  // Test 4: Scan individual exchanges
  const exchanges = ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx'];
  for (const exchange of exchanges) {
    results.push(await test(
      `Scan ${exchange.toUpperCase()}`,
      `/api/exchanges/scan/${exchange}?limit=20`,
      ['exchange', 'symbols', 'total_available']
    ));
  }
  
  // Test 5: Reload markets
  results.push(await test(
    'Force Reload All Markets',
    '/api/exchanges/reload-all-markets',
    ['status', 'results']
  ));
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  const percentage = ((passed / total) * 100).toFixed(1);
  
  console.log(`\n✅ PASSED: ${passed}/${total} (${percentage}%)\n`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Market scanning is working correctly.\n');
  } else {
    console.log('⚠️  Some tests failed. Check the output above.\n');
  }
  
  process.exit(passed === total ? 0 : 1);
}

// Run tests
runTests().catch(console.error);
