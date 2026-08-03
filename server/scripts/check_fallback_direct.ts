import 'dotenv/config';
import { ethers } from 'ethers';

function timeout(ms: number) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function tryProvider(url: string, name: string) {
  console.log(`Trying provider ${name}: ${url}`);
  const p = new ethers.JsonRpcProvider(url);
  const res = await Promise.race([p.getBlockNumber(), timeout(8000)]);
  return res;
}

async function main() {
  const primary = process.env.CELO_RPC_URL;
  const fallback = process.env.CELO_RPC_FALLBACK_URL || process.env.CELO_RPC_FALLBACK || null;

  if (!primary || !fallback) {
    console.error('Set CELO_RPC_URL and CELO_RPC_FALLBACK_URL in env to run this check');
    process.exit(2);
  }

  try {
    const b = await tryProvider(primary, 'primary');
    console.log('Primary succeeded unexpectedly, block:', b);
    console.log('This means primary is reachable; fallback not exercised.');
    process.exit(0);
  } catch (err: any) {
    console.warn('Primary failed as expected:', err?.message || String(err));
    try {
      const bf = await tryProvider(fallback, 'fallback');
      console.log('Fallback succeeded, block:', bf);
      process.exit(0);
    } catch (err2: any) {
      console.error('Fallback failed:', err2?.message || String(err2));
      process.exit(1);
    }
  }
}

main();
