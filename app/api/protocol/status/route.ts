import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Environment-driven addresses
const RPC_URL = process.env.RPC_URL || process.env.CELO_RPC_URL || 'http://localhost:8545';
const MTAA_TOKEN_ADDRESS = process.env.MTAA_TOKEN_ADDRESS || process.env.PROTOCOL_MTAA_TOKEN_ADDRESS || '';
const APY_CALCULATOR_ADDRESS = process.env.APY_CALCULATOR_ADDRESS || process.env.PROTOCOL_APY_CALCULATOR_ADDRESS || '';

// Minimal ABIs
const MTAA_ABI = [
  'function getTotalStaked() view returns (uint256)'
];
const APY_ABI = [
  'function getCurrentAPY() view returns (uint256)'
];

const TOTAL_SUPPLY = BigInt('1000000000') * BigInt('1000000000000000000'); // 1_000_000_000 * 1e18

export async function GET() {
  try {
    if (!MTAA_TOKEN_ADDRESS || !APY_CALCULATOR_ADDRESS) {
      return NextResponse.json({ error: 'MTAA_TOKEN_ADDRESS or APY_CALCULATOR_ADDRESS not configured' }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const mtaa = new ethers.Contract(MTAA_TOKEN_ADDRESS, MTAA_ABI, provider);
    const apyCalc = new ethers.Contract(APY_CALCULATOR_ADDRESS, APY_ABI, provider);

    const [totalStakedRaw, apyBpRaw] = await Promise.all([
      mtaa.getTotalStaked(),
      apyCalc.getCurrentAPY()
    ]);

    const totalStaked = BigInt(totalStakedRaw.toString());
    const apyBp = Number(apyBpRaw.toString());

    // TVL percent (basis points): (totalStaked * 10000) / TOTAL_SUPPLY
    const tvlBps = totalStaked === BigInt(0)
      ? 0
      : Number((totalStaked * BigInt(10000)) / TOTAL_SUPPLY);

    const tvlPercent = tvlBps / 100; // e.g., 1250 -> 12.5%

    return NextResponse.json({
      totalStaked: totalStaked.toString(),
      tvlBps,
      tvlPercent,
      apyBp,
      apyPercent: apyBp / 100
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
