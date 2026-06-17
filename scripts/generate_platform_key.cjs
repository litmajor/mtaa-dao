#!/usr/bin/env node
// CommonJS fallback — run with `node scripts/generate_platform_key.cjs`
try {
  const { Wallet } = require('ethers');
  const wallet = Wallet.createRandom();
  console.log('PRIVATE_KEY=' + wallet.privateKey);
  console.log('ADDRESS=' + wallet.address);
  console.log('\nSECURITY: Do NOT commit the private key. Store it in a secrets manager or a gitignored .env file.');
} catch (err) {
  console.error('Failed to generate key. Ensure `ethers` is installed in the project.');
  console.error(err && err.message ? err.message : err);
  process.exit(1);
}
