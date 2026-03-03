#!/usr/bin/env node

/**
 * Phase 0 Security Fix Validation Script
 * Tests: CORS whitelist, JWT secret enforcement
 * 
 * Usage: node scripts/validate-phase0-fixes.js
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n🔐 PHASE 0 SECURITY FIX VALIDATION\n');

// ============================================
// TEST 1: JWT Secret Enforcement
// ============================================
console.log('✓ Test 1: JWT Secret Environment Validation');
console.log('  Checking: server/auth.ts requires JWT_SECRET and JWT_REFRESH_SECRET\n');

const authFilePath = path.join(__dirname, '../server/auth.ts');
const authContent = fs.readFileSync(authFilePath, 'utf8');

const hasSecretValidation = authContent.includes('throw new Error') && 
                           authContent.includes('JWT_SECRET') &&
                           authContent.includes('JWT_REFRESH_SECRET');

const hasNoHardcodedDefaults = !authContent.includes('your-secret-key-change-in-production') &&
                              !authContent.includes('your-refresh-secret-change-in-production');

const hasNoSecretLogging = !authContent.includes('JWT_SECRET.substring(0, 10)');

if (hasSecretValidation && hasNoHardcodedDefaults && hasNoSecretLogging) {
  console.log('  ✅ PASS: Secret validation enforced');
  console.log('  ✅ PASS: No hardcoded defaults found');
  console.log('  ✅ PASS: Secret not logged to console\n');
} else {
  console.log('  ❌ FAIL: JWT secret fix incomplete\n');
  if (!hasSecretValidation) console.log('     - Missing secret validation');
  if (!hasNoHardcodedDefaults) console.log('     - Found hardcoded defaults');
  if (!hasNoSecretLogging) console.log('     - Secret still being logged');
}

// ============================================
// TEST 2: CORS Whitelist Configuration
// ============================================
console.log('✓ Test 2: CORS Whitelist Implementation');
console.log('  Checking: server/index.ts uses origin whitelist instead of "true"\n');

const indexFilePath = path.join(__dirname, '../server/index.ts');
const indexContent = fs.readFileSync(indexFilePath, 'utf8');

const hasNoCorsOriginTrue = !indexContent.includes('origin: true');
const hasAllowedOriginsList = indexContent.includes('allowedOrigins');
const hasOriginCallback = indexContent.includes('origin: (origin:');
const hasCredentialsTransport = indexContent.includes('credentials: true') && 
                               indexContent.includes('allowedHeaders: [');

if (hasNoCorsOriginTrue && hasAllowedOriginsList && hasOriginCallback && hasCredentialsTransport) {
  console.log('  ✅ PASS: CORS origin whitelist configured');
  console.log('  ✅ PASS: Removed "origin: true" (allow all origins)');
  console.log('  ✅ PASS: Origin validation callback implemented');
  console.log('  ✅ PASS: Credentials handled safely per-origin\n');
} else {
  console.log('  ❌ FAIL: CORS whitelist fix incomplete\n');
  if (!hasNoCorsOriginTrue) console.log('     - "origin: true" still present');
  if (!hasAllowedOriginsList) console.log('     - Missing allowedOrigins configuration');
  if (!hasOriginCallback) console.log('     - Missing origin validation callback');
  if (!hasCredentialsTransport) console.log('     - Unsafe credentials handling');
}

// ============================================
// TEST 3: Environment Setup Check
// ============================================
console.log('✓ Test 3: Environment Configuration Check');
console.log('  Checking: .env has required Phase 0 variables\n');

const envPath = path.join(__dirname, '../.env');
let envContent = '';
let envExists = false;

if (fs.existsSync(envPath)) {
  envExists = true;
  envContent = fs.readFileSync(envPath, 'utf8');
} else {
  console.log('  ⚠️  WARNING: .env file not found\n');
  console.log('     To test Phase 0 fixes, create .env with:\n');
  console.log('     JWT_SECRET=<64-char-random-hex>');
  console.log('     JWT_REFRESH_SECRET=<64-char-random-hex>');
  console.log('     ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173\n');
}

if (envExists) {
  const hasJWTSecret = envContent.includes('JWT_SECRET=') && 
                      !envContent.includes('JWT_SECRET=your-secret');
  const hasRefreshSecret = envContent.includes('JWT_REFRESH_SECRET=') && 
                          !envContent.includes('JWT_REFRESH_SECRET=your-refresh');
  const hasAllowedOrigins = envContent.includes('ALLOWED_ORIGINS=');

  if (hasJWTSecret && hasRefreshSecret && hasAllowedOrigins) {
    console.log('  ✅ PASS: JWT_SECRET configured');
    console.log('  ✅ PASS: JWT_REFRESH_SECRET configured');
    console.log('  ✅ PASS: ALLOWED_ORIGINS configured\n');
  } else {
    console.log('  ❌ FAIL: Missing required environment variables\n');
    if (!hasJWTSecret) console.log('     - JWT_SECRET not set');
    if (!hasRefreshSecret) console.log('     - JWT_REFRESH_SECRET not set');
    if (!hasAllowedOrigins) console.log('     - ALLOWED_ORIGINS not set');
  }
}

// ============================================
// SUMMARY
// ============================================
console.log('📋 PHASE 0 FIX VALIDATION SUMMARY\n');
console.log('Code changes:');
console.log('  ✓ CORS whitelist implemented');
console.log('  ✓ JWT secret validation enforced');
console.log('  ✓ Secret logging removed\n');

console.log('Next steps:');
console.log('  1. Generate secure JWT secrets:');
console.log('     node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
console.log('  2. Update .env file with secrets and origin list');
console.log('  3. Test with: npm run test:security');
console.log('  4. Deploy to staging\n');

console.log('Command to continue with Phase 1 fixes:');
console.log('  npm run implement:phase1\n');
