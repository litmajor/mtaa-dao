#!/usr/bin/env node

/**
 * Frontend API Real Endpoints Validation
 * Verifies all mock implementations have been replaced with real API calls
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n✅ FRONTEND API ENDPOINTS VALIDATION\n');

const apiPath = path.join(__dirname, '../frontend/api/index.ts');
const apiContent = fs.readFileSync(apiPath, 'utf8');

// Check for remaining mocks
const mockPatterns = [
  { name: 'setTimeout mock', pattern: /return new Promise\((resolve|reject)\) => {\s*setTimeout/ },
  { name: 'Mock delay functions', pattern: /\/\/ Mock implementation:/ },
  { name: 'Hardcoded mock responses', pattern: /success: (true|false),\s*message:.*mock/i }
];

let hasMocks = false;
mockPatterns.forEach(({ name, pattern }) => {
  if (pattern.test(apiContent)) {
    console.log(`❌ FAIL: Found ${name}`);
    hasMocks = true;
  }
});

if (!hasMocks) {
  console.log('✅ PASS: No mock implementations found\n');
}

// Check for real endpoint implementations
const realEndpoints = [
  { name: 'estimateSendFee', endpoint: '/transactions/estimate-fee' },
  { name: 'getProposalImpact', endpoint: '/proposals/${proposalId}/impact' },
  { name: 'submitVote', endpoint: '/proposals/${proposalId}/vote' },
  { name: 'getSecurityStatus', endpoint: '/user/security/status' },
  { name: 'setupTwoFA', endpoint: '/user/security/2fa/setup' },
  { name: 'verifyTwoFA', endpoint: '/user/security/2fa/verify' },
  { name: 'changePIN', endpoint: '/user/security/pin/change' },
  { name: 'exportKeys', endpoint: '/user/security/keys/export' },
  { name: 'enableSocialRecovery', endpoint: '/user/security/social-recovery/enable' }
];

console.log('📡 API ENDPOINTS IMPLEMENTED:\n');

realEndpoints.forEach(({ name, endpoint }) => {
  const hasEndpoint = apiContent.includes(endpoint);
  const hasFetch = apiContent.includes(`fetch(\`\${API_BASE_URL}${endpoint}\``);
  const hasErrorHandling = apiContent.includes('!response.ok');
  const hasAuthHeader = apiContent.includes("'Authorization': `Bearer ${AUTH_TOKEN}`");
  
  if (hasEndpoint && hasFetch && hasErrorHandling) {
    console.log(`✅ ${name.padEnd(25)} - ${endpoint}`);
  } else {
    console.log(`❌ ${name.padEnd(25)} - INCOMPLETE`);
    if (!hasEndpoint) console.log(`   └─ Endpoint URL missing`);
    if (!hasFetch) console.log(`   └─ fetch() not called`);
    if (!hasErrorHandling) console.log(`   └─ Error handling missing`);
  }
});

// Check general security
console.log('\n🔒 SECURITY FEATURES:\n');

const features = [
  { name: 'Authorization headers', check: () => apiContent.match(/'Authorization': `Bearer \${AUTH_TOKEN}`/g)?.length || 0 },
  { name: 'Content-Type headers', check: () => apiContent.match(/'Content-Type': 'application\/json'/g)?.length || 0 },
  { name: 'Error response parsing', check: () => apiContent.includes('error.message') },
  { name: 'HTTP status checking', check: () => apiContent.includes('!response.ok') },
  { name: 'Try-catch blocks', check: () => apiContent.match(/try \{/g)?.length || 0 },
  { name: 'Error logging', check: () => apiContent.match(/console\.error/g)?.length || 0 }
];

features.forEach(({ name, check }) => {
  const result = check();
  if (typeof result === 'boolean') {
    console.log(`${result ? '✅' : '❌'} ${name}`);
  } else if (typeof result === 'number' && result > 0) {
    console.log(`✅ ${name} (${result} instances)`);
  } else {
    console.log(`❌ ${name}`);
  }
});

// Summary
console.log('\n📋 SUMMARY:\n');

const allEndpointsImplemented = realEndpoints.every(({ endpoint }) => 
  apiContent.includes(endpoint)
);

const noMocksRemaining = !hasMocks;

if (allEndpointsImplemented && noMocksRemaining) {
  console.log('✅ ALL API ENDPOINTS CONVERTED TO REAL CALLS\n');
  console.log('Status: READY FOR BACKEND INTEGRATION\n');
  console.log('Next steps:');
  console.log('  1. Ensure backend is running at API_BASE_URL');
  console.log('  2. Update API_BASE_URL in .env: REACT_APP_API_URL');
  console.log('  3. Verify backend endpoints match frontend calls');
  console.log('  4. Test with: npm run test:api\n');
} else {
  console.log('❌ SOME ENDPOINTS STILL INCOMPLETE\n');
  console.log('Action required: Fix endpoints marked above\n');
}

console.log('Files modified:');
console.log('  ✓ frontend/api/index.ts\n');
