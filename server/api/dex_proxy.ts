import { Router } from 'express';
import type { Request, Response } from 'express';
import axios from 'axios';
import NodeCache from 'node-cache';
import { ethers } from 'ethers';

const router = Router();
const cache = new NodeCache({ stdTTL: 5, checkperiod: 10 }); // 5s cache

export const CHAIN_ID: Record<string, number> = {
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  celo: 42220,
};

export const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  ethereum: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9EB0cE3606EB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI:  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    ETH:  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    BTC:  '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  },
  polygon: {
    USDC:  '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Native Circle USDC
    USDCe: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Bridged USDC.e
    USDT:  '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // Fixed Mainnet USDT
    DAI:   '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    WETH:  '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    POL:   '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Native POL Gas Token
    MATIC: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    ETH:   '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH on Polygon
    BTC:   '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', // WBTC
    WBTC:  '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
  },
  arbitrum: {
    USDC:  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Native Circle USDC
    USDCe: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // Bridged USDC.e
    USDT:  '0xFd086bC7CD5C481DCC9C85ebe478A1C0b69FCbb9',
    DAI:   '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    WETH:  '0x82aF49447D8a07e3bd95BD0d56f35241523fBAB1',
    ETH:   '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    BTC:   '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', // WBTC
    WBTC:  '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
  },
  celo: {
    CELO:  '0x471EcE3750Da237f93B8E339c536989b8978a438', // Native CELO ERC-20 interface
    ETH:   '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    USDC:  '0xcebA387E66192A4e280D8dEFa5c69502A5092a4E', // Native Circle USDC
    USDT:  '0x48065fbBE25f71C9282ddf5e1cD6d6A887483D5e', // Native Tether USDT
    cUSD:  '0x765DE81E82F2141F3a162332611a5A58e3981254', // Celo Dollar
    cEUR:  '0xD8763C2d873327d9753a5E23E4515B35C148Eb82', // Celo Euro
    WETH:  '0x66803158480d5888327080000000000000000000',
    WBTC:  '0xD629eb00dE27e8A00f57a62A980182C0EaE84379',
    BTC:   '0xD629eb00dE27e8A00f57a62A980182C0EaE84379',
  },
};

const BASE_FEE_PCT = 0.25;

router.post('/quote', async (req: Request, res: Response) => {
  try {
    const { chain = 'ethereum', tokenIn, tokenOut, amountIn } = req.body || {};

    if (!tokenIn || !tokenOut || !amountIn) {
      return res.status(400).json({ error: 'Missing tokenIn, tokenOut, or amountIn' });
    }

    const selectedChain = String(chain).toLowerCase();
    if (!CHAIN_ID[selectedChain]) {
      return res.status(400).json({ error: `Unsupported chain: ${chain}` });
    }

    const addrMap = TOKEN_ADDRESSES[selectedChain];
    const fromAddress =
      addrMap[tokenIn] ?? (typeof tokenIn === 'string' && ethers.isAddress(tokenIn) ? tokenIn : null);
    const toAddress =
      addrMap[tokenOut] ?? (typeof tokenOut === 'string' && ethers.isAddress(tokenOut) ? tokenOut : null);

    if (!fromAddress || !toAddress) {
      return res.status(400).json({ error: 'Invalid or unmapped token address' });
    }

    const cacheKey = `${selectedChain}:${fromAddress}:${toAddress}:${amountIn}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json({ cached: true, ...(cached as object) });

    const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Fetch token decimals with fallbacks
    const erc20Abi = ['function decimals() view returns (uint8)'];
    let decimalsFrom = 18;
    let decimalsTo = 18;

    const NATIVE_TOKEN = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    if (fromAddress.toLowerCase() !== NATIVE_TOKEN) {
      try {
        const token = new ethers.Contract(fromAddress, erc20Abi, provider);
        decimalsFrom = Number(await token.decimals());
      } catch {
        decimalsFrom = 18;
      }
    }

    if (toAddress.toLowerCase() !== NATIVE_TOKEN) {
      try {
        const token2 = new ethers.Contract(toAddress, erc20Abi, provider);
        decimalsTo = Number(await token2.decimals());
      } catch {
        decimalsTo = 18;
      }
    }

    // Safely convert amountIn string to base atomic units using BigInt
    const amountBase = ethers.parseUnits(String(amountIn), decimalsFrom).toString();
    const chainId = CHAIN_ID[selectedChain];

    const apiKey = process.env.ONE_INCH_API_KEY;

    // Test mode / Local Mock fallback
    if (process.env.NODE_ENV === 'test' || !apiKey) {
      console.info('[dex_proxy] Using mock quote mode.');

      // 99% simulation output using BigInt precision
      const rawIn = ethers.parseUnits(String(amountIn), decimalsTo);
      const simulatedOutputBase = (rawIn * 99n) / 100n;
      const expectedOut = parseFloat(ethers.formatUnits(simulatedOutputBase, decimalsTo));

      const mockData = {
        toAmount: simulatedOutputBase.toString(),
        protocols: [[[{ name: 'uniswap-v3', part: 100, fromTokenAddress: fromAddress, toTokenAddress: toAddress }]]],
        gas: 120000,
      };

      const result = {
        data: mockData,
        expectedOut,
        decimalsFrom,
        decimalsTo,
        hopDetails: [{ segments: ['uniswap-v3'], raw: mockData.protocols, feePercent: BASE_FEE_PCT }],
        estimatedGas: mockData.gas,
        feePercent: BASE_FEE_PCT,
      };

      cache.set(cacheKey, result);
      return res.json(result);
    }

    // Production 1inch v6 API Call with Auth Header
    const url = `https://api.1inch.dev/swap/v6.0/${chainId}/quote?src=${fromAddress}&dst=${toAddress}&amount=${amountBase}`;
    const resp = await axios.get(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 8000,
    });

    const data = resp.data;
    const toAmountBase = data.dstAmount || data.toAmount || data.toTokenAmount || '0';

    // Avoid JS precision loss by formatting BigInt base units safely
    const expectedOut = parseFloat(ethers.formatUnits(toAmountBase, decimalsTo));

    // Parse protocol routing hops safely
    const rawProtocols = data.protocols || [];
    const hopDetails: Array<{ segments: string[]; raw: any }> = [];

    for (const route of rawProtocols) {
      const segments: string[] = [];
      if (Array.isArray(route)) {
        for (const step of route) {
          if (Array.isArray(step)) {
            step.forEach((sub: any) => {
              if (sub?.name) segments.push(sub.name);
            });
          }
        }
      }
      hopDetails.push({ segments, raw: route });
    }

    const hopCount = Math.max(1, hopDetails.length);
    const perHopFeePct = BASE_FEE_PCT / hopCount;
    const perHop = hopDetails.map((h) => ({ ...h, feePercent: perHopFeePct }));

    const result = {
      data,
      expectedOut,
      decimalsFrom,
      decimalsTo,
      hopDetails: perHop,
      estimatedGas: data.gas || data.estimatedGas || 0,
      feePercent: BASE_FEE_PCT,
    };

    cache.set(cacheKey, result);
    return res.json(result);
  } catch (error: any) {
    const errorDetails = error?.response?.data || error?.message || error;
    console.error('dex_proxy error:', errorDetails);

    return res.status(500).json({
      error: 'Failed to generate swap quote',
      details: typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : String(errorDetails),
    });
  }
});

export default router;