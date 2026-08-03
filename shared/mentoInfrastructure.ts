import { ethers } from "ethers";

export const MENTO_BROKER_ADDRESS = "0x777A8255cA72412f0d706dc03C9D1987306B4CaD";

export const MENTO_BROKER_ABI = [
  "function getExchangeProviders() external view returns (address[])",
  "function getAmountOut(address exchangeProvider, address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256)",
];

export interface MentoQuoteResult {
  provider: string;
  amountOut: bigint;
}

export async function getBestMentoQuote(
  provider: ethers.Provider,
  tokenInAddr: string,
  tokenOutAddr: string,
  amountIn: bigint,
  brokerAddress: string = MENTO_BROKER_ADDRESS
): Promise<MentoQuoteResult | null> {
  const broker = new ethers.Contract(brokerAddress, MENTO_BROKER_ABI, provider);
  const providers: string[] = await broker.getExchangeProviders();

  let best: MentoQuoteResult | null = null;

  for (const exchangeProvider of providers) {
    try {
      const out: bigint = await broker.getAmountOut(
        exchangeProvider,
        tokenInAddr,
        tokenOutAddr,
        amountIn
      );

      if (out > 0n && (!best || out > best.amountOut)) {
        best = {
          provider: exchangeProvider,
          amountOut: out,
        };
      }
    } catch {
      continue;
    }
  }

  return best;
}
