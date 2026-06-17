#!/usr/bin/env node
// Fallback JS key generator — runs with Node (no ts-node required)
// Uses project's ethers dependency which is already installed.
try {
  const { ethers } = require('ethers');
  const wallet = ethers.Wallet.createRandom();
  console.log('PRIVATE_KEY=' + wallet.privateKey);
  console.log('ADDRESS=' + wallet.address);
  console.log('\nSECURITY: Do NOT commit the private key. Store it in a secrets manager or a gitignored .env file.');
} catch (err) {
  console.error('Failed to generate key. Ensure `ethers` is installed in the project.');
  console.error(err && err.message ? err.message : err);
  process.exit(1);
}
