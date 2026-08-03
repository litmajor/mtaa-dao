import 'dotenv/config';
import { ResilientRpcProvider } from '../services/resilientRpcProvider';

async function main() {
  const primary = process.env.CELO_RPC_URL;
  const fallback = process.env.CELO_RPC_FALLBACK_URL || process.env.CELO_RPC_FALLBACK || null;

  if (!primary) {
    console.error('CELO_RPC_URL is not set. Set it to your Alchemy (or primary) URL and rerun.');
    process.exit(2);
  }
  if (!fallback) {
    console.error('CELO_RPC_FALLBACK_URL (or CELO_RPC_FALLBACK) is not set. Set it to your QuickNode (or fallback) URL and rerun.');
    process.exit(2);
  }

  const onFailover = (from: string, to: string, reason: string) => {
    console.warn(`FAILOVER: ${from} -> ${to} : ${reason}`);
  };
  const onRecover = (name: string) => {
    console.info(`RECOVERED: ${name}`);
  };

  const provider = new ResilientRpcProvider({
    primary: { name: 'primary', httpUrl: primary },
    fallback: { name: 'fallback', httpUrl: fallback },
    cooldownMs: 60_000,
    onFailover,
    onRecover,
  });

  try {
    console.log('Calling getBlockNumber() via resilient provider...');
    const block = await provider.call(async (p) => {
      return await p.getBlockNumber();
    });
    console.log('Success, block:', block);
  } catch (err: any) {
    console.error('Call failed:', err && err.message ? err.message : String(err));
    process.exit(1);
  }
}

main();
