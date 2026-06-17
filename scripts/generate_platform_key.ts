#!/usr/bin/env ts-node
/**
 * Generate a new platform wallet keypair for local/dev use.
 * Usage:
 *   ts-node scripts/generate_platform_key.ts
 *
 * WARNING: Do NOT commit the generated private key. Store it in a secure
 * secret store (AWS Secrets Manager, GitHub Secrets, Vault) or a local
 * `.env` file that is gitignored.
 */
import { Wallet } from 'ethers';

function main() {
  const wallet = Wallet.createRandom();

  console.log('=== PLATFORM WALLET GENERATED ===');
  console.log('PRIVATE_KEY=' + wallet.privateKey);
  console.log('ADDRESS=' + wallet.address);
  console.log();
  console.log('Add to your .env (example):');
  console.log(`PLATFORM_PRIVATE_KEY=${wallet.privateKey}`);
  console.log('RPC_URL=your_rpc_url_here');
  console.log();
  console.log('Remember: rotate and protect this key. For production use a secrets manager.');
}

main();
