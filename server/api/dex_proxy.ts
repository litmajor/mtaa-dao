import { Router, Request, Response } from 'express';
import axios from 'axios';
import NodeCache from 'node-cache';
import { ethers } from 'ethers';

const router = Router();
const cache = new NodeCache({ stdTTL: 5, checkperiod: 10 }); // 5s cache

const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  ethereum: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9EB0cE3606EB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI:  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    ETH:  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    BTC:  '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  },
  polygon: {
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0x3813e82e6f7098b9583FC0F33a962D02018B6803',
    DAI:  '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    ETH:  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    BTC:  '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
  },
  arbitrum: {
    USDC: '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
    USDT: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
    DAI:  '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
    WETH: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    ETH:  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    BTC:  '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
  }
};

const CHAIN_ID: Record<string, number> = { ethereum: 1, polygon: 137, arbitrum: 42161 };

const BASE_FEE_PCT = 0.25; // For reporting

router.post('/quote', async (req: Request, res: Response) => {
  try {
    const { chain = 'ethereum', tokenIn, tokenOut, amountIn } = req.body || {};
    if (!tokenIn || !tokenOut || !amountIn) return res.status(400).json({ error: 'Missing tokenIn/tokenOut/amountIn' });

    const addrMap = TOKEN_ADDRESSES[chain] ?? TOKEN_ADDRESSES['ethereum'];
    const fromAddress = addrMap[tokenIn] ?? (typeof tokenIn === 'string' && tokenIn.startsWith('0x') ? tokenIn : null);
    const toAddress = addrMap[tokenOut] ?? (typeof tokenOut === 'string' && tokenOut.startsWith('0x') ? tokenOut : null);

    if (!fromAddress || !toAddress) return res.status(400).json({ error: 'Unknown token symbol or missing address mapping' });

    const cacheKey = `${chain}:${fromAddress}:${toAddress}:${amountIn}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json({ cached: true, ...cached });

    // Provider
    const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Determine decimals for from/to tokens
    const erc20Abi = ['function decimals() view returns (uint8)'];
    let decimalsFrom = 18;
    let decimalsTo = 18;
    try {
      if (fromAddress.toLowerCase() !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
        const token = new ethers.Contract(fromAddress, erc20Abi, provider);
        const d: any = await token.decimals();
        decimalsFrom = Number(d ?? 18);
      }
    } catch (err) {
      decimalsFrom = 18;
    }
    try {
      if (toAddress.toLowerCase() !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
        const token2 = new ethers.Contract(toAddress, erc20Abi, provider);
        const d2: any = await token2.decimals();
        decimalsTo = Number(d2 ?? 18);
      }
    } catch (err) {
      decimalsTo = 18;
    }

    const amountBase = ethers.parseUnits(String(amountIn), decimalsFrom).toString();

    const chainId = CHAIN_ID[chain] ?? 1;
    const url = `https://api.1inch.io/v5.0/${chainId}/quote?fromTokenAddress=${fromAddress}&toTokenAddress=${toAddress}&amount=${amountBase}`;
    const resp = await axios.get(url, { timeout: 8000 });
    const data = resp.data;

    const toAmountBase = data.toTokenAmount ?? data.toTokenAmount;
    const expectedOut = Number(toAmountBase) / Math.pow(10, decimalsTo);

    // build hopDetails from protocols
    const protocols = data.protocols || [];
    const hopDetails: Array<any> = [];
    for (const p of protocols) {
      // p is array of segments
      const seg = p.map((s: any) => s[0]).flat();
      hopDetails.push({ segments: seg, raw: p });
    }

    // Estimate per-hop fee splits (even split of base fee)
    const hopCount = Math.max(1, hopDetails.length);
    const perHopFeePct = BASE_FEE_PCT / hopCount;
    const perHop = hopDetails.map((h) => ({ ...h, feePercent: perHopFeePct }));

    const result = {
      data,
      expectedOut,
      decimalsFrom,
      decimalsTo,
      hopDetails: perHop,
      estimatedGas: data.estimatedGas,
      feePercent: BASE_FEE_PCT,
    };

    cache.set(cacheKey, result);
    return res.json(result);
  } catch (error: any) {
    console.error('dex_proxy error', error?.message ?? error);
    return res.status(500).json({ error: String(error?.message ?? error) });
  }
});

export default router;
