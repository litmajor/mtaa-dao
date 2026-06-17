#!/usr/bin/env ts-node
/**
 * Small helper script: call `requestOracleAuthorization()` on a deployed rewards manager
 * Usage:
 *   PLATFORM_PRIVATE_KEY=0x... RPC_URL=... ts-node scripts/request_oracle_authorization.ts <rewardsManagerAddress>
 */
import { ethers } from 'ethers';

async function main() {
  const addr = process.argv[2];
  if (!addr) {
    console.error('Usage: ts-node scripts/request_oracle_authorization.ts <rewardsManagerAddress>');
    process.exit(2);
  }

  const rpc = process.env.RPC_URL || process.env.CELO_RPC_URL;
  const pk = process.env.PLATFORM_PRIVATE_KEY;
  if (!rpc || !pk) {
    console.error('Missing RPC_URL or PLATFORM_PRIVATE_KEY env vars');
    process.exit(2);
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);

  const ABI = [
    'function requestOracleAuthorization() external',
  ];

  const c = new ethers.Contract(addr, ABI, wallet);
  try {
    const tx = await c.requestOracleAuthorization();
    const receipt = await tx.wait();
    console.log('AuthorizationRequested emitted, tx:', receipt.transactionHash);
  } catch (err) {
    console.error('Failed to call requestOracleAuthorization', err);
  }
}

main();
