// utils/tokens.ts
import { publicClient } from "@/lib/blockchain";

export const getTokenInfo = async (tokenAddress: string) => {
  const abi = [
    { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
    { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
    { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  ];

  const name = await publicClient.readContract({ address: tokenAddress as `0x${string}`, abi, functionName: "name" });
  const symbol = await publicClient.readContract({ address: tokenAddress as `0x${string}`, abi, functionName: "symbol" });
  const decimals = await publicClient.readContract({ address: tokenAddress as `0x${string}`, abi, functionName: "decimals" });

  return { name, symbol, decimals };
};
