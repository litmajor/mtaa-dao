export type SwapState =
  | 'DRAFT'
  | 'VALID'
  | 'INSUFFICIENT_LIQUIDITY'
  | 'HIGH_IMPACT'
  | 'UNSUPPORTED_PAIR'
  | 'READY';

export interface SwapRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: number; // human units
  slippageTolerance: number; // percent, e.g. 0.5 -> 0.5%
  chain?: string;
}

export interface SwapAnalysis {
  route: string[];
  dexes: string[];

  expectedOut: number;
  minimumOut: number;

  executionPrice: number; // tokenOut per tokenIn
  marketPrice: number;

  priceImpact: number; // percent
  feePercent: number; // percent

  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';

  state: SwapState;
  warnings: string[];
}

import axios from 'axios';

export class SwapEngine {
  // Mock market prices (tokenOut per tokenIn when quoting against USDC)
  static MARKET_PRICE: Record<string, number> = {
    USDC: 1,
    USDT: 1,
    DAI: 1,
    ETH: 2500,
    BTC: 65000,
  };

  // Simple pool depth estimate (human units of tokenIn)
  static POOL_DEPTH: Record<string, number> = {
    USDC: 5_000_000,
    USDT: 5_000_000,
    DAI: 3_000_000,
    ETH: 10_000,
    BTC: 500,
  };

  // Base protocol fee percent
  static BASE_FEE_PCT = 0.25; // 0.25%

  // Common token addresses for 1inch on supported chains (example subset)
  static TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
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

  static CHAIN_ID: Record<string, number> = {
    ethereum: 1,
    polygon: 137,
    arbitrum: 42161,
  };

  static analyze(req: SwapRequest): SwapAnalysis {
    const { tokenIn, tokenOut, amountIn, slippageTolerance = 0.5, chain = 'ethereum' } = req;
    const warnings: string[] = [];

    if (tokenIn === tokenOut) {
      return {
        route: [tokenIn],
        dexes: [],
        expectedOut: amountIn,
        minimumOut: amountIn,
        executionPrice: 1,
        marketPrice: 1,
        priceImpact: 0,
        feePercent: 0,
        riskLevel: 'LOW',
        state: 'UNSUPPORTED_PAIR',
        warnings: ['Token pair is identical'],
      };
    }

    // Simple route finder: direct if both known, otherwise go via USDC
    let route: string[] = [];
    if (SwapEngine.MARKET_PRICE[tokenIn] && SwapEngine.MARKET_PRICE[tokenOut]) {
      route = [tokenIn, tokenOut];
    } else {
      // Unsupported tokens or unknown price
      route = [tokenIn, 'USDC', tokenOut];
    }

    // market price tokenOut per tokenIn: priceOut / priceIn
    const priceIn = SwapEngine.MARKET_PRICE[tokenIn] ?? SwapEngine.MARKET_PRICE['USDC'];
    const priceOut = SwapEngine.MARKET_PRICE[tokenOut] ?? SwapEngine.MARKET_PRICE['USDC'];
    const marketPrice = priceOut / priceIn;

    // Estimate price impact via depth model: impactPct = min( (amountIn / poolDepth) * factor, 50 )
    const poolDepth = SwapEngine.POOL_DEPTH[tokenIn] ?? 100000;
    const impactFactor = 1.2; // empirical
    let priceImpactPct = Math.min((amountIn / poolDepth) * 100 * impactFactor, 50);

    // Adjust priceImpact to be small for stablecoins
    if (tokenIn === 'USDC' && tokenOut === 'USDT') priceImpactPct = Math.min(priceImpactPct, 0.1);

    // Execution price includes price impact
    const executionPrice = marketPrice * (1 - priceImpactPct / 100);

    // Fees
    const feePercent = SwapEngine.BASE_FEE_PCT; // percent

    // expected out before slippage tolerance
    const expectedOut = amountIn * executionPrice * (1 - feePercent / 100);

    const minimumOut = expectedOut * (1 - slippageTolerance / 100);

    // Risk level heuristics
    let riskLevel: SwapAnalysis['riskLevel'] = 'LOW';
    if (priceImpactPct > 3) riskLevel = 'MEDIUM';
    if (priceImpactPct > 8) riskLevel = 'HIGH';

    // State determination
    let state: SwapState = 'VALID';
    if (priceImpactPct > 25) state = 'INSUFFICIENT_LIQUIDITY';
    else if (priceImpactPct > 8) state = 'HIGH_IMPACT';
    else state = 'READY';

    if (state !== 'READY') warnings.push(`Quote state: ${state}`);

    // DEX selection heuristic
    const dexes = route.length === 2 ? ['UniswapV3'] : ['Curve', 'UniswapV3'];

    return {
      route,
      dexes,
      expectedOut,
      minimumOut,
      executionPrice,
      marketPrice,
      priceImpact: priceImpactPct,
      feePercent,
      riskLevel,
      state,
      warnings,
    };
  }

  // Async analysis that attempts to use 1inch quote API for live routing and per-hop details.
  static async analyzeLive(req: SwapRequest): Promise<SwapAnalysis> {
    const { tokenIn, tokenOut, amountIn, slippageTolerance = 0.5, chain = 'ethereum' } = req;

    // Try to map to addresses
    const addrMap = SwapEngine.TOKEN_ADDRESSES[chain] ?? SwapEngine.TOKEN_ADDRESSES['ethereum'];
    const fromAddress = addrMap[tokenIn] ?? null;
    const toAddress = addrMap[tokenOut] ?? null;

    if (!fromAddress || !toAddress) {
      // fallback to internal model
      return SwapEngine.analyze(req);
    }

    const chainId = SwapEngine.CHAIN_ID[chain] ?? 1;

    // 1inch expects amount in token base units; assume 18 decimals for unknowns
    const decimalsFrom = 18;
    const amountBase = Math.floor(amountIn * Math.pow(10, decimalsFrom)).toString();

    try {
      // Call server-side proxy which handles decimals and caching
      const resp = await axios.post('/api/dex/quote', { chain, tokenIn, tokenOut, amountIn }, { timeout: 7000 });
      const payload = resp.data;
      const data = payload.data || {};

      const expectedOut = payload.expectedOut ?? 0;
      const decimalsTo = payload.decimalsTo ?? 18;

      const executionPrice = expectedOut / amountIn;
      const marketPrice = (SwapEngine.MARKET_PRICE[tokenOut] ?? 1) / (SwapEngine.MARKET_PRICE[tokenIn] ?? 1);

      const priceImpact = ((marketPrice - executionPrice) / marketPrice) * 100;

      const protocols = data.protocols || payload.hopDetails || [];
      const hopDetails: Array<{ dex: string; raw?: any; feePercent?: number }> = [];
      if (payload.hopDetails) {
        for (const h of payload.hopDetails) {
          hopDetails.push({ dex: (h.segments || []).join('>') || 'unknown', raw: h.raw, feePercent: h.feePercent });
        }
      } else if (protocols.length) {
        for (const p of protocols) {
          const seg = p.map((s: any) => s[0]).flat();
          hopDetails.push({ dex: seg.join('>'), raw: p, feePercent: undefined });
        }
      }

      const feePercent = payload.feePercent ?? SwapEngine.BASE_FEE_PCT;

      const minimumOut = expectedOut * (1 - slippageTolerance / 100);

      let riskLevel: SwapAnalysis['riskLevel'] = 'LOW';
      if (priceImpact > 3) riskLevel = 'MEDIUM';
      if (priceImpact > 8) riskLevel = 'HIGH';

      let state: SwapState = 'READY';
      if (priceImpact > 25) state = 'INSUFFICIENT_LIQUIDITY';
      else if (priceImpact > 8) state = 'HIGH_IMPACT';
      else state = 'READY';

      const dexes = hopDetails.map(h => h.dex);

      const analysis: SwapAnalysis = {
        route: [tokenIn, tokenOut],
        dexes,
        expectedOut,
        minimumOut,
        executionPrice,
        marketPrice,
        priceImpact,
        feePercent,
        riskLevel,
        state,
        warnings: [],
      };

      // Attach hopDetails as a loose extension for UI
      (analysis as any).hopDetails = hopDetails;
      (analysis as any).estimatedGas = data.estimatedGas;

      return analysis;
    } catch (err) {
      // network or API error: fallback
      return SwapEngine.analyze(req);
    }
  }
}
