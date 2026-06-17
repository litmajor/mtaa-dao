/**
 * DeFi Integration Module - Production Implementation
 * 
 * Handles DeFi operations: token swaps, liquidity provision, staking
 * Supports multiple protocols across different chains
 */

import Web3 from 'web3';
type Web3Type = InstanceType<typeof Web3>;
import type { GasConfig, TransactionResult } from './types';

// ERC20 Standard ABI for token interactions
const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{"name": "", "type": "string"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_spender", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {"name": "_owner", "type": "address"},
      {"name": "_spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  }
] as const;

// Uniswap V3 Router ABI (complete)
const UNISWAP_V3_ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "tokenIn", type: "address" },
          { internalType: "address", name: "tokenOut", type: "address" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          { internalType: "address", name: "recipient", type: "address" },
          { internalType: "uint256", name: "deadline", type: "uint256" },
          { internalType: "uint256", name: "amountIn", type: "uint256" },
          { internalType: "uint256", name: "amountOutMinimum", type: "uint256" },
          { internalType: "uint160", name: "sqrtPriceLimitX96", type: "uint160" }
        ],
        internalType: "struct ISwapRouter.ExactInputSingleParams",
        name: "params",
        type: "tuple"
      }
    ],
    name: "exactInputSingle",
    outputs: [{ internalType: "uint256", name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      {
        components: [
          { internalType: "bytes", name: "path", type: "bytes" },
          { internalType: "address", name: "recipient", type: "address" },
          { internalType: "uint256", name: "deadline", type: "uint256" },
          { internalType: "uint256", name: "amountIn", type: "uint256" },
          { internalType: "uint256", name: "amountOutMinimum", type: "uint256" }
        ],
        internalType: "struct ISwapRouter.ExactInputParams",
        name: "params",
        type: "tuple"
      }
    ],
    name: "exactInput",
    outputs: [{ internalType: "uint256", name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
    type: "function"
  }
];

// Uniswap V3 Factory ABI for pool lookups
const UNISWAP_V3_FACTORY_ABI = [
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
      { internalType: "uint24", name: "fee", type: "uint24" }
    ],
    name: "getPool",
    outputs: [{ internalType: "address", name: "pool", type: "address" }],
    stateMutability: "view",
    type: "function"
  }
];

// Uniswap V3 Pool ABI for slot0 and liquidity data
const UNISWAP_V3_POOL_ABI = [
  {
    inputs: [],
    name: "slot0",
    outputs: [
      { internalType: "uint160", name: "sqrtPriceX96", type: "uint160" },
      { internalType: "int24", name: "tick", type: "int24" },
      { internalType: "uint16", name: "observationIndex", type: "uint16" },
      { internalType: "uint16", name: "observationCardinality", type: "uint16" },
      { internalType: "uint16", name: "observationCardinalityNext", type: "uint16" },
      { internalType: "uint8", name: "feeProtocol", type: "uint8" },
      { internalType: "bool", name: "unlocked", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "liquidity",
    outputs: [{ internalType: "uint128", name: "", type: "uint128" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "fee",
    outputs: [{ internalType: "uint24", name: "", type: "uint24" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "token0",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "token1",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  }
];

// Uniswap V3 NonfungiblePositionManager ABI for position management
const UNISWAP_V3_NFT_POSITION_MANAGER_ABI = [
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "uint256", name: "index", type: "uint256" }
    ],
    name: "tokenOfOwnerByIndex",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "positions",
    outputs: [
      {
        components: [
          { internalType: "uint96", name: "nonce", type: "uint96" },
          { internalType: "address", name: "operator", type: "address" },
          { internalType: "address", name: "token0", type: "address" },
          { internalType: "address", name: "token1", type: "address" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          { internalType: "int24", name: "tickLower", type: "int24" },
          { internalType: "int24", name: "tickUpper", type: "int24" },
          { internalType: "uint128", name: "liquidity", type: "uint128" },
          { internalType: "uint256", name: "feeGrowthInside0LastX128", type: "uint256" },
          { internalType: "uint256", name: "feeGrowthInside1LastX128", type: "uint256" },
          { internalType: "uint128", name: "tokensOwed0", type: "uint128" },
          { internalType: "uint128", name: "tokensOwed1", type: "uint128" }
        ],
        internalType: "struct INonfungiblePositionManager.Position",
        name: "",
        type: "tuple"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "token0", type: "address" },
          { internalType: "address", name: "token1", type: "address" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          { internalType: "int24", name: "tickLower", type: "int24" },
          { internalType: "int24", name: "tickUpper", type: "int24" },
          { internalType: "uint256", name: "amount0Desired", type: "uint256" },
          { internalType: "uint256", name: "amount1Desired", type: "uint256" },
          { internalType: "uint256", name: "amount0Min", type: "uint256" },
          { internalType: "uint256", name: "amount1Min", type: "uint256" },
          { internalType: "address", name: "recipient", type: "address" },
          { internalType: "uint256", name: "deadline", type: "uint256" }
        ],
        internalType: "struct INonfungiblePositionManager.MintParams",
        name: "params",
        type: "tuple"
      }
    ],
    name: "mint",
    outputs: [
      { internalType: "uint256", name: "tokenId", type: "uint256" },
      { internalType: "uint128", name: "liquidity", type: "uint128" },
      { internalType: "uint256", name: "amount0", type: "uint256" },
      { internalType: "uint256", name: "amount1", type: "uint256" }
    ],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "tokenId", type: "uint256" },
          { internalType: "uint128", name: "liquidity", type: "uint128" },
          { internalType: "uint256", name: "amount0Min", type: "uint256" },
          { internalType: "uint256", name: "amount1Min", type: "uint256" },
          { internalType: "uint256", name: "deadline", type: "uint256" }
        ],
        internalType: "struct INonfungiblePositionManager.DecreaseLiquidityParams",
        name: "params",
        type: "tuple"
      }
    ],
    name: "decreaseLiquidity",
    outputs: [
      { internalType: "uint256", name: "amount0", type: "uint256" },
      { internalType: "uint256", name: "amount1", type: "uint256" }
    ],
    stateMutability: "payable",
    type: "function"
  }
];

// Aave Pool ABI for flash loans and lending
const AAVE_POOL_ABI = [
  {
    inputs: [
      { internalType: "address", name: "asset", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "interestRateMode", type: "uint256" },
      { internalType: "uint16", name: "referralCode", type: "uint16" },
      { internalType: "address", name: "onBehalfOf", type: "address" }
    ],
    name: "supply",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "asset", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "address", name: "to", type: "address" }
    ],
    name: "withdraw",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address[]", name: "assets", type: "address[]" },
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
      { internalType: "uint256[]", name: "interestRateModes", type: "uint256[]" },
      { internalType: "address", name: "onBehalfOf", type: "address" },
      { internalType: "bytes", name: "params", type: "bytes" },
      { internalType: "uint16", name: "referralCode", type: "uint16" }
    ],
    name: "flashLoan",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "asset", type: "address" }],
    name: "getReserveData",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "configuration", type: "uint256" },
          { internalType: "uint128", name: "liquidityIndex", type: "uint128" },
          { internalType: "uint128", name: "currentLiquidityRate", type: "uint128" },
          { internalType: "uint128", name: "variableBorrowIndex", type: "uint128" },
          { internalType: "uint128", name: "currentVariableBorrowRate", type: "uint128" },
          { internalType: "uint128", name: "currentStableBorrowRate", type: "uint128" },
          { internalType: "uint40", name: "lastUpdateTimestamp", type: "uint40" },
          { internalType: "uint16", name: "id", type: "uint16" },
          { internalType: "address", name: "aTokenAddress", type: "address" },
          { internalType: "address", name: "stableDebtTokenAddress", type: "address" },
          { internalType: "address", name: "variableDebtTokenAddress", type: "address" },
          { internalType: "address", name: "interestRateStrategyAddress", type: "address" },
          { internalType: "uint128", name: "accruedToTreasury", type: "uint128" },
          { internalType: "uint128", name: "unbacked", type: "uint128" },
          { internalType: "uint128", name: "isolationModeTotalDebt", type: "uint128" }
        ],
        internalType: "struct DataTypes.ReserveData",
        name: "",
        type: "tuple"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
];

// Chainlink Price Feed ABI
const CHAINLINK_PRICE_FEED_ABI = [
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { internalType: "uint80", name: "roundId", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function"
  }
];

export interface SwapQuote {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  expectedOutput: string;
  minimumOutput: string;
  priceImpact: number;
  route: string[];
  gasEstimate: number;
  protocol: 'uniswap-v3';
  feeTier: number;
}

export interface LiquidityPosition {
  poolAddress: string;
  token0: string;
  token1: string;
  amount0: string;
  amount1: string;
  liquidity: string;
  lowerTick?: number;
  upperTick?: number;
  fee?: number;
}

export interface StakingInfo {
  protocol: string;
  address: string;
  stakedAmount: string;
  rewards: string;
  APY: number;
  rewardToken: string;
  duration?: number;
}

export interface FlashLoan {
  tokenAddress: string;
  amount: string;
  premium: string;
  receiver: string;
}

export interface PoolInfo {
  address: string;
  token0: string;
  token1: string;
  fee: number;
  sqrtPriceX96: string;
  liquidity: string;
  tick: number;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  balance: string;
  allowance: string;
}

/**
 * Protocol addresses by chain ID
 */
const PROTOCOL_ADDRESSES: Record<number, {
  uniswapV3Router: string;
  uniswapV3Factory: string;
  uniswapV3PositionManager: string;
  aavePool: string;
  chainlinkEthUsd: string;
  weth: string;
}> = {
  1: { // Ethereum Mainnet
    uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    uniswapV3PositionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    aavePool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    chainlinkEthUsd: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  },
  137: { // Polygon
    uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    uniswapV3PositionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    aavePool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    chainlinkEthUsd: '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0',
    weth: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
  },
  42161: { // Arbitrum
    uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    uniswapV3PositionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    aavePool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    chainlinkEthUsd: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
    weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
  }
};

/**
 * Common token addresses by chain ID
 */
const COMMON_TOKENS: Record<number, Record<string, string>> = {
  1: {
    'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
  },
  137: {
    'WETH': '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    'DAI': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    'WBTC': '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6'
  },
  42161: {
    'WETH': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    'USDT': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    'DAI': '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    'WBTC': '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f'
  }
};

/**
 * DeFi Service - Handle DeFi operations
 */
export class DeFiService {
  private web3: Web3Type;
  private accountAddress: string;
  private chainId: number;
  private addresses: typeof PROTOCOL_ADDRESSES[1];

  constructor(web3: Web3Type, accountAddress: string, chainId: number) {
    this.web3 = web3;
    this.accountAddress = accountAddress;
    this.chainId = chainId;
    this.addresses = PROTOCOL_ADDRESSES[chainId] || PROTOCOL_ADDRESSES[1];

    if (!this.addresses) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }
  }

  /**
   * Get token contract instance
   */
  private getTokenContract(tokenAddress: string) {
    return new this.web3.eth.Contract(ERC20_ABI as any, tokenAddress);
  }

  /**
   * Get Uniswap V3 router contract instance
   */
  private getUniswapV3Router() {
    return new this.web3.eth.Contract(
      UNISWAP_V3_ROUTER_ABI as any,
      this.addresses.uniswapV3Router
    );
  }

  /**
   * Get Uniswap V3 factory contract instance
   */
  private getUniswapV3Factory() {
    return new this.web3.eth.Contract(
      UNISWAP_V3_FACTORY_ABI as any,
      this.addresses.uniswapV3Factory
    );
  }

  /**
   * Get Uniswap V3 position manager contract instance
   */
  private getPositionManager() {
    return new this.web3.eth.Contract(
      UNISWAP_V3_NFT_POSITION_MANAGER_ABI as any,
      this.addresses.uniswapV3PositionManager
    );
  }

  /**
   * Get Aave pool contract instance
   */
  private getAavePool() {
    return new this.web3.eth.Contract(
      AAVE_POOL_ABI as any,
      this.addresses.aavePool
    );
  }

  /**
   * Get token information (symbol, decimals, balance, allowance)
   */
  async getTokenInfo(tokenAddress: string, spender?: string): Promise<TokenInfo> {
    try {
      const contract = this.getTokenContract(tokenAddress);

      const [symbol, decimals, balance, allowance] = await Promise.all([
        contract.methods.symbol().call().catch(() => 'UNKNOWN'),
        contract.methods.decimals().call().then((d: string) => parseInt(d)),
        contract.methods.balanceOf(this.accountAddress).call(),
        spender 
          ? contract.methods.allowance(this.accountAddress, spender).call()
          : Promise.resolve('0')
      ]);

      return {
        address: tokenAddress,
        symbol,
        decimals,
        balance: balance.toString(),
        allowance: allowance.toString()
      };
    } catch (error) {
      console.error(`Failed to get token info for ${tokenAddress}:`, error);
      throw new Error(`Token info query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Approve token spending for a specific spender
   */
  async approveToken(
    tokenAddress: string,
    spender: string,
    amount: string
  ): Promise<TransactionResult> {
    try {
      if (!amount || BigInt(amount) <= 0) {
        throw new Error('Approval amount must be provided and greater than 0');
      }
      const contract = this.getTokenContract(tokenAddress);

      const tx = contract.methods.approve(spender, amount);
      const gasEstimate = await tx.estimateGas({ from: this.accountAddress });

      const receipt = await tx.send({
        from: this.accountAddress,
        gas: Math.floor(Number(gasEstimate) * 1.2).toString()
      });

      return {
        hash: receipt.transactionHash,
        status: receipt.status ? 'success' : 'failed',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Token approval failed:', error);
      throw new Error(`Approval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get swap quote from DEX using on-chain data and price calculations
   */
  async getSwapQuote(
    inputToken: string,
    outputToken: string,
    inputAmount: string,
    slippageTolerance: number = 0.5
  ): Promise<SwapQuote> {
    try {
      // Validate inputs
      if (!this.web3.utils.isAddress(inputToken) || !this.web3.utils.isAddress(outputToken)) {
        throw new Error('Invalid token address provided');
      }

      if (BigInt(inputAmount) <= 0) {
        throw new Error('Input amount must be greater than 0');
      }

      // Get token decimals for accurate calculation
      const [inputDecimals, outputDecimals] = await Promise.all([
        this.getTokenInfo(inputToken).then(t => t.decimals),
        this.getTokenInfo(outputToken).then(t => t.decimals)
      ]);

      // Find best pool (try multiple fee tiers: 0.05%, 0.3%, 1%)
      const feeTiers = [500, 3000, 10000];
      let bestPool: PoolInfo | null = null;
      let bestPrice = 0;

      const factory = this.getUniswapV3Factory();

      for (const fee of feeTiers) {
        try {
          const poolAddress = await factory.methods.getPool(inputToken, outputToken, fee).call();

          if (poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000') {
            const poolContract = new this.web3.eth.Contract(UNISWAP_V3_POOL_ABI as any, poolAddress);
            const [slot0, liquidity, poolToken0, poolToken1] = await Promise.all([
              poolContract.methods.slot0().call(),
              poolContract.methods.liquidity().call(),
              poolContract.methods.token0().call(),
              poolContract.methods.token1().call()
            ]);

            const sqrtPriceX96 = BigInt(slot0.sqrtPriceX96.toString());
            const liquidityBN = BigInt(liquidity.toString());

            // price = (sqrtPriceX96 ** 2) / 2**192 gives token1 per token0
            const price = Number(sqrtPriceX96) ** 2 / (2 ** 192);

            // Determine if inputToken is token0 or token1 and adjust price accordingly
            let priceOutPerIn = price;
            if (poolToken0.toLowerCase() === inputToken.toLowerCase() && poolToken1.toLowerCase() === outputToken.toLowerCase()) {
              // price is token1 per token0 -> fine
              priceOutPerIn = price;
            } else if (poolToken1.toLowerCase() === inputToken.toLowerCase() && poolToken0.toLowerCase() === outputToken.toLowerCase()) {
              // price is token1 per token0, but input is token1 -> invert
              priceOutPerIn = 1 / price;
            } else {
              // Pool token ordering doesn't match requested pair exactly; skip
              continue;
            }

            // Adjust for token decimals (output per input in raw token units)
            const decimalAdjustment = 10 ** (outputDecimals - inputDecimals);
            const adjustedPrice = priceOutPerIn * decimalAdjustment;

            // Prefer the pool with the most liquidity
            if (!bestPool || liquidityBN > BigInt(bestPool.liquidity)) {
              bestPrice = adjustedPrice;
              bestPool = {
                address: poolAddress,
                token0: poolToken0,
                token1: poolToken1,
                fee,
                sqrtPriceX96: sqrtPriceX96.toString(),
                liquidity: liquidity.toString(),
                tick: Number(slot0.tick)
              };
            }
          }
        } catch (err) {
          continue;
        }
      }

      if (!bestPool) {
        throw new Error('No liquidity pool found for token pair');
      }

      // Improved output estimation using on-chain price and fee
      const feeMultiplier = (1_000_000 - bestPool.fee) / 1_000_000;
      const inputDecimalsNum = inputDecimals;
      const outputDecimalsNum = outputDecimals;

      const inputAmountDecimal = Number(inputAmount) / (10 ** inputDecimalsNum);
      const amountInAfterFee = inputAmountDecimal * feeMultiplier;

      const expectedOutputDecimal = amountInAfterFee * bestPrice; // price already adjusted for decimals
      const expectedOutput = Math.floor(expectedOutputDecimal).toString();

      // Calculate minimum output with slippage tolerance
      const slippageMultiplier = BigInt(Math.floor((100 - slippageTolerance) * 100));
      const minimumOutput = (BigInt(expectedOutput) * slippageMultiplier / BigInt(10000)).toString();

      // Estimate price impact based on input vs pool liquidity (approximate)
      const liquidityRaw = BigInt(bestPool.liquidity);
      const liquidityAdjusted = Number(liquidityRaw) / (10 ** inputDecimalsNum || 1);
      const impactEstimate = liquidityAdjusted > 0 ? (amountInAfterFee / liquidityAdjusted) * 100 : 100;
      const priceImpact = Math.min(100, Math.max(0.01, impactEstimate + slippageTolerance));

      // Estimate gas based on fee tier
      const gasEstimate = bestPool.fee === 500 ? 110000 : 145000;

      return {
        inputToken,
        outputToken,
        inputAmount,
        expectedOutput,
        minimumOutput,
        priceImpact,
        route: [inputToken, outputToken],
        gasEstimate,
        protocol: 'uniswap-v3',
        feeTier: bestPool.fee
      };
    } catch (error) {
      console.error('Failed to get swap quote:', error);
      throw new Error(`Swap quote failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute token swap via Uniswap V3 Router
   */
  async executeSwap(
    quote: SwapQuote,
    routerAddress?: string,
    gasConfig?: GasConfig
  ): Promise<TransactionResult> {
    try {
      // Validate quote
      if (!quote.expectedOutput || quote.expectedOutput === '0') {
        throw new Error('Invalid swap quote - no output amount');
      }

      if (!quote.minimumOutput || quote.minimumOutput === '0') {
        throw new Error('Invalid swap quote - no minimum output set');
      }

      console.log(`Executing swap: ${quote.inputAmount} ${quote.inputToken} -> ${quote.outputToken}`);

      // Resolve router address (accept optional override)
      const routerAddr = routerAddress || this.addresses.uniswapV3Router;

      // Step 1: Check and approve token spending if needed
      const tokenContract = this.getTokenContract(quote.inputToken);
      const currentAllowance = await tokenContract.methods.allowance(
        this.accountAddress,
        routerAddr
      ).call();

      if (BigInt(currentAllowance.toString()) < BigInt(quote.inputAmount)) {
        console.log('Approving token spending...');
        await this.approveToken(quote.inputToken, routerAddr, quote.inputAmount);
      }

      // Step 2: Prepare swap parameters
      const router = new this.web3.eth.Contract(UNISWAP_V3_ROUTER_ABI as any, routerAddr);
      const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes

      // Use fee from quote (critical fix)
      const fee = quote.feeTier || 3000;

      const swapParams = {
        tokenIn: quote.inputToken,
        tokenOut: quote.outputToken,
        fee: fee,
        recipient: this.accountAddress,
        deadline: deadline,
        amountIn: quote.inputAmount,
        amountOutMinimum: quote.minimumOutput,
        sqrtPriceLimitX96: '0' // No price limit
      };

      // Step 3: Estimate gas
      const value = quote.inputToken.toLowerCase() === this.addresses.weth.toLowerCase()
        ? quote.inputAmount
        : '0';

      const gasEstimate = await router.methods.exactInputSingle(swapParams).estimateGas({
        from: this.accountAddress,
        value
      });

      const gasLimit = gasConfig?.gasLimit || Math.floor(Number(gasEstimate) * 1.3);

      // EIP-1559 support: compute maxFee/maxPriority if node supports baseFeePerGas
      const latest = await this.web3.eth.getBlock('latest');
      let txOptions: any = { from: this.accountAddress, gas: gasLimit.toString(), value };

      if (latest && (latest as any).baseFeePerGas) {
        const baseFee = latest.baseFeePerGas ? BigInt(String(latest.baseFeePerGas)) : 0n;
        const priority = gasConfig?.maxPriorityFeePerGas ? BigInt(String(gasConfig.maxPriorityFeePerGas)) : 2000000000n; // 2 gwei
        const maxFee = baseFee * 2n + priority;
        txOptions.maxPriorityFeePerGas = priority.toString();
        txOptions.maxFeePerGas = maxFee.toString();
      } else {
        const gasPrice = gasConfig?.gasPrice || await this.web3.eth.getGasPrice();
        txOptions.gasPrice = gasPrice.toString();
      }

      // Step 4: Execute swap
      const receipt = await router.methods.exactInputSingle(swapParams).send(txOptions);

      return {
        hash: receipt.transactionHash,
        status: receipt.status ? 'success' : 'failed',
        timestamp: Date.now(),
        gasUsed: receipt.gasUsed?.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString()
      };
    } catch (error) {
      console.error('Swap execution failed:', error);
      throw new Error(`Swap failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get liquidity positions for account from Uniswap V3 Position Manager
   */
  async getLiquidityPositions(): Promise<LiquidityPosition[]> {
    try {
      const positionManager = this.getPositionManager();
      const positions: LiquidityPosition[] = [];

      // Get number of positions owned by account
      const balance = await positionManager.methods.balanceOf(this.accountAddress).call();
      const balanceNum = parseInt(balance.toString());

      if (balanceNum === 0) {
        return positions;
      }

      // Fetch all positions
      for (let i = 0; i < balanceNum; i++) {
        try {
          const tokenId = await positionManager.methods.tokenOfOwnerByIndex(
            this.accountAddress,
            i
          ).call();

          const position = await positionManager.methods.positions(tokenId).call();

          // Get pool address for this position
          const factory = this.getUniswapV3Factory();
          const poolAddress = await factory.methods.getPool(
            position.token0,
            position.token1,
            position.fee
          ).call();

          // Get current pool state for amount calculation
          const poolContract = new this.web3.eth.Contract(
            UNISWAP_V3_POOL_ABI as any,
            poolAddress
          );
          const slot0 = await poolContract.methods.slot0().call();
          const currentTick = Number(slot0.tick);

          // Calculate token amounts from liquidity and ticks
          const liquidity = BigInt(position.liquidity.toString());
          const tickLower = Number(position.tickLower);
          const tickUpper = Number(position.tickUpper);

          // Get token decimals
          const [token0Decimals, token1Decimals] = await Promise.all([
            this.getTokenInfo(position.token0).then(t => t.decimals),
            this.getTokenInfo(position.token1).then(t => t.decimals)
          ]);

          // Calculate amounts using tick math (simplified)
          const sqrtPriceLower = Math.sqrt(1.0001 ** tickLower);
          const sqrtPriceUpper = Math.sqrt(1.0001 ** tickUpper);
          const sqrtPriceCurrent = Math.sqrt(1.0001 ** currentTick);

          let amount0 = '0';
          let amount1 = '0';

          if (currentTick < tickLower) {
            // All in token0
            const amount0Float = Number(liquidity) * (sqrtPriceUpper - sqrtPriceLower) / (sqrtPriceLower * sqrtPriceUpper);
            amount0 = Math.floor(amount0Float * (10 ** token0Decimals)).toString();
          } else if (currentTick >= tickUpper) {
            // All in token1
            const amount1Float = Number(liquidity) * (sqrtPriceUpper - sqrtPriceLower);
            amount1 = Math.floor(amount1Float * (10 ** token1Decimals)).toString();
          } else {
            // In range - both tokens
            const amount0Float = Number(liquidity) * (sqrtPriceUpper - sqrtPriceCurrent) / (sqrtPriceCurrent * sqrtPriceUpper);
            const amount1Float = Number(liquidity) * (sqrtPriceCurrent - sqrtPriceLower);
            amount0 = Math.floor(amount0Float * (10 ** token0Decimals)).toString();
            amount1 = Math.floor(amount1Float * (10 ** token1Decimals)).toString();
          }

          positions.push({
            poolAddress,
            token0: position.token0,
            token1: position.token1,
            amount0,
            amount1,
            liquidity: position.liquidity.toString(),
            lowerTick: tickLower,
            upperTick: tickUpper,
            fee: Number(position.fee)
          });
        } catch (err) {
          console.warn(`Failed to fetch position at index ${i}:`, err);
          continue;
        }
      }

      return positions;
    } catch (error) {
      console.error('Failed to get liquidity positions:', error);
      throw new Error(`Liquidity query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Add liquidity to a Uniswap V3 pool with auto-calculated ticks
   */
  async addLiquidity(
    token0: string,
    token1: string,
    amount0: string,
    amount1: string,
    gasConfig?: GasConfig,
    tickRange?: { lower: number; upper: number }
  ): Promise<TransactionResult> {
    try {
      console.log(`Adding liquidity: ${amount0} ${token0} + ${amount1} ${token1}`);

      // Validate inputs
      if (!this.web3.utils.isAddress(token0) || !this.web3.utils.isAddress(token1)) {
        throw new Error('Invalid token address');
      }

      // Get token decimals
      const [token0Info, token1Info] = await Promise.all([
        this.getTokenInfo(token0),
        this.getTokenInfo(token1)
      ]);

      // Find best pool
      const factory = this.getUniswapV3Factory();
      const feeTiers = [500, 3000, 10000];
      let bestPoolAddress: string | null = null;
      let bestFee = 3000;
      let bestLiquidity = BigInt(0);

      for (const fee of feeTiers) {
        try {
          const poolAddress = await factory.methods.getPool(token0, token1, fee).call();
          if (poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000') {
            const poolContract = new this.web3.eth.Contract(
              UNISWAP_V3_POOL_ABI as any,
              poolAddress
            );
            const liquidity = await poolContract.methods.liquidity().call();
            const liqBN = BigInt(liquidity.toString());

            if (liqBN > bestLiquidity) {
              bestLiquidity = liqBN;
              bestPoolAddress = poolAddress;
              bestFee = fee;
            }
          }
        } catch (err) {
          continue;
        }
      }

      if (!bestPoolAddress) {
        throw new Error('No liquidity pool found for token pair');
      }

      // Get current tick for range calculation
      const poolContract = new this.web3.eth.Contract(
        UNISWAP_V3_POOL_ABI as any,
        bestPoolAddress
      );
      const slot0 = await poolContract.methods.slot0().call();
      const currentTick = Number(slot0.tick);

      // Calculate tick range (default to +/- 10% price range)
      const tickSpacing = bestFee === 500 ? 10 : bestFee === 3000 ? 60 : 200;
      const rangeMultiplier = tickRange ? 0 : 600; // ~10% price range in ticks

      const lowerTick = tickRange 
        ? Math.floor(tickRange.lower / tickSpacing) * tickSpacing
        : Math.floor((currentTick - rangeMultiplier) / tickSpacing) * tickSpacing;
      const upperTick = tickRange
        ? Math.ceil(tickRange.upper / tickSpacing) * tickSpacing
        : Math.ceil((currentTick + rangeMultiplier) / tickSpacing) * tickSpacing;

      // Step 1: Approve both tokens
      const positionManager = this.getPositionManager();

      for (const [token, amount] of [[token0, amount0], [token1, amount1]]) {
        const tokenContract = this.getTokenContract(token);
        const allowance = await tokenContract.methods.allowance(
          this.accountAddress,
          this.addresses.uniswapV3PositionManager
        ).call();

        if (BigInt(allowance.toString()) < BigInt(amount)) {
          console.log(`Approving ${token}...`);
          await this.approveToken(
            token,
            this.addresses.uniswapV3PositionManager,
            amount
          );
        }
      }

      // Step 2: Prepare mint parameters
      const deadline = Math.floor(Date.now() / 1000) + 1800;

      // Calculate minimum amounts (1% slippage)
      const minAmount0 = (BigInt(amount0) * BigInt(99) / BigInt(100)).toString();
      const minAmount1 = (BigInt(amount1) * BigInt(99) / BigInt(100)).toString();

      const mintParams = {
        token0,
        token1,
        fee: bestFee,
        tickLower: lowerTick,
        tickUpper: upperTick,
        amount0Desired: amount0,
        amount1Desired: amount1,
        amount0Min: minAmount0,
        amount1Min: minAmount1,
        recipient: this.accountAddress,
        deadline
      };

      // Step 3: Estimate and execute
      const gasEstimate = await positionManager.methods.mint(mintParams).estimateGas({
        from: this.accountAddress
      });

      const gasLimit = gasConfig?.gasLimit || Math.floor(Number(gasEstimate) * 1.3);
      const gasPrice = gasConfig?.gasPrice || await this.web3.eth.getGasPrice();

      const receipt = await positionManager.methods.mint(mintParams).send({
        from: this.accountAddress,
        gas: gasLimit.toString(),
        gasPrice: gasPrice.toString()
      });

      return {
        hash: receipt.transactionHash,
        status: receipt.status ? 'success' : 'failed',
        timestamp: Date.now(),
        gasUsed: receipt.gasUsed?.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString()
      };
    } catch (error) {
      console.error('Add liquidity failed:', error);
      throw new Error(`Liquidity provision failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Remove liquidity from a Uniswap V3 pool position
   */
  async removeLiquidity(
    poolAddress: string,
    liquidity: string,
    gasConfig?: GasConfig
  ): Promise<TransactionResult> {
    try {
      console.log(`Removing liquidity from ${poolAddress}: ${liquidity}`);

      // Find the position NFT associated with this pool
      const positionManager = this.getPositionManager();
      const balance = await positionManager.methods.balanceOf(this.accountAddress).call();
      const balanceNum = parseInt(balance.toString());

      let targetTokenId: string | null = null;

      for (let i = 0; i < balanceNum; i++) {
        const tokenId = await positionManager.methods.tokenOfOwnerByIndex(
          this.accountAddress,
          i
        ).call();

        const position = await positionManager.methods.positions(tokenId).call();

        // Check if this position matches the pool
        const factory = this.getUniswapV3Factory();
        const positionPool = await factory.methods.getPool(
          position.token0,
          position.token1,
          position.fee
        ).call();

        if (positionPool.toLowerCase() === poolAddress.toLowerCase() &&
            BigInt(position.liquidity.toString()) >= BigInt(liquidity)) {
          targetTokenId = tokenId.toString();
          break;
        }
      }

      if (!targetTokenId) {
        throw new Error('No matching liquidity position found');
      }

      // Prepare decrease liquidity parameters
      const deadline = Math.floor(Date.now() / 1000) + 1800;

      const decreaseParams = {
        tokenId: targetTokenId,
        liquidity: liquidity,
        amount0Min: '0', // Set to 0 for simplicity, production should calculate minimums
        amount1Min: '0',
        deadline
      };

      // Estimate and execute
      const gasEstimate = await positionManager.methods.decreaseLiquidity(decreaseParams).estimateGas({
        from: this.accountAddress
      });

      const gasLimit = gasConfig?.gasLimit || Math.floor(Number(gasEstimate) * 1.3);
      const gasPrice = gasConfig?.gasPrice || await this.web3.eth.getGasPrice();

      const receipt = await positionManager.methods.decreaseLiquidity(decreaseParams).send({
        from: this.accountAddress,
        gas: gasLimit.toString(),
        gasPrice: gasPrice.toString()
      });

      return {
        hash: receipt.transactionHash,
        status: receipt.status ? 'success' : 'failed',
        timestamp: Date.now(),
        gasUsed: receipt.gasUsed?.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString()
      };
    } catch (error) {
      console.error('Remove liquidity failed:', error);
      throw new Error(`Liquidity removal failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get staking opportunities from Aave and other protocols
   */
  async getStakingOpportunities(): Promise<StakingInfo[]> {
    try {
      const opportunities: StakingInfo[] = [];

      // Aave lending opportunities
      try {
        const aavePool = this.getAavePool();
        const commonTokens = COMMON_TOKENS[this.chainId] || {};

        for (const [symbol, address] of Object.entries(commonTokens)) {
          try {
            const reserveData = await aavePool.methods.getReserveData(address).call();
            const liquidityRate = BigInt(reserveData.currentLiquidityRate.toString());

            // Aave rates are in RAY (27 decimals), convert to APY percentage
            // APY = (1 + rate/1e27)^31536000 - 1, simplified linear approximation
            const apy = Number(liquidityRate) / 1e25; // Approximate APY in percentage

            if (apy > 0.01) { // Only show if APY > 0.01%
              opportunities.push({
                protocol: 'Aave V3',
                address: address,
                stakedAmount: '0',
                rewards: '0',
                APY: parseFloat(apy.toFixed(2)),
                rewardToken: symbol,
                duration: 0 // Flexible duration
              });
            }
          } catch (err) {
            continue;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch Aave opportunities:', err);
      }

      // Sort by APY descending
      opportunities.sort((a, b) => b.APY - a.APY);

      return opportunities;
    } catch (error) {
      console.error('Failed to get staking opportunities:', error);
      throw new Error(`Staking query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stake tokens in Aave lending pool
   */
  async stakeTokens(
    stakingAddress: string,
    amount: string,
    gasConfig?: GasConfig
  ): Promise<TransactionResult> {
    try {
      console.log(`Staking ${amount} tokens at ${stakingAddress}`);

      // Validate
      if (!this.web3.utils.isAddress(stakingAddress)) {
        throw new Error('Invalid staking address');
      }

      if (BigInt(amount) <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Step 1: Approve token for Aave pool
      const tokenContract = this.getTokenContract(stakingAddress);
      const allowance = await tokenContract.methods.allowance(
        this.accountAddress,
        this.addresses.aavePool
      ).call();

      if (BigInt(allowance.toString()) < BigInt(amount)) {
        console.log('Approving token for Aave pool...');
        await this.approveToken(stakingAddress, this.addresses.aavePool, amount);
      }

      // Step 2: Supply to Aave
      const aavePool = this.getAavePool();

      const gasEstimate = await aavePool.methods.supply(
        stakingAddress,
        amount,
        0, // Interest rate mode (0 for supply)
        0, // Referral code
        this.accountAddress
      ).estimateGas({ from: this.accountAddress });

      const gasLimit = gasConfig?.gasLimit || Math.floor(Number(gasEstimate) * 1.3);
      const gasPrice = gasConfig?.gasPrice || await this.web3.eth.getGasPrice();

      const receipt = await aavePool.methods.supply(
        stakingAddress,
        amount,
        0,
        0,
        this.accountAddress
      ).send({
        from: this.accountAddress,
        gas: gasLimit.toString(),
        gasPrice: gasPrice.toString()
      });

      return {
        hash: receipt.transactionHash,
        status: receipt.status ? 'success' : 'failed',
        timestamp: Date.now(),
        gasUsed: receipt.gasUsed?.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString()
      };
    } catch (error) {
      console.error('Staking failed:', error);
      throw new Error(`Staking failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Claim staking rewards from Aave (withdraws underlying asset + accrued interest)
   */
  async claimRewards(
    stakingAddress: string,
    gasConfig?: GasConfig
  ): Promise<TransactionResult> {
    try {
      console.log(`Claiming rewards from ${stakingAddress}`);

      // Get aToken balance (represents staked amount + rewards)
      const aavePool = this.getAavePool();
      const reserveData = await aavePool.methods.getReserveData(stakingAddress).call();
      const aTokenAddress = reserveData.aTokenAddress;

      const aTokenContract = this.getTokenContract(aTokenAddress);
      const aTokenBalance = await aTokenContract.methods.balanceOf(this.accountAddress).call();

      if (BigInt(aTokenBalance.toString()) <= 0) {
        throw new Error('No staked balance to claim');
      }

      // Withdraw all from Aave
      const gasEstimate = await aavePool.methods.withdraw(
        stakingAddress,
        aTokenBalance.toString(),
        this.accountAddress
      ).estimateGas({ from: this.accountAddress });

      const gasLimit = gasConfig?.gasLimit || Math.floor(Number(gasEstimate) * 1.3);
      const gasPrice = gasConfig?.gasPrice || await this.web3.eth.getGasPrice();

      const receipt = await aavePool.methods.withdraw(
        stakingAddress,
        aTokenBalance.toString(),
        this.accountAddress
      ).send({
        from: this.accountAddress,
        gas: gasLimit.toString(),
        gasPrice: gasPrice.toString()
      });

      return {
        hash: receipt.transactionHash,
        status: receipt.status ? 'success' : 'failed',
        timestamp: Date.now(),
        gasUsed: receipt.gasUsed?.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString()
      };
    } catch (error) {
      console.error('Claim rewards failed:', error);
      throw new Error(`Reward claim failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Request flash loan via Aave (requires implementing IFlashLoanReceiver)
   */
  async requestFlashLoan(
    lender: string,
    token: string,
    amount: string,
    receiver: string
  ): Promise<TransactionResult> {
    try {
      console.log(`Requesting flash loan: ${amount} of ${token}`);

      // Validate
      if (!this.web3.utils.isAddress(token) || !this.web3.utils.isAddress(receiver)) {
        throw new Error('Invalid token or receiver address');
      }

      if (BigInt(amount) <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Aave flash loan fee is 0.09%
      const premium = (BigInt(amount) * BigInt(9) / BigInt(10000)).toString();

      console.log(`Flash loan premium: ${premium}`);

      // Prepare flash loan parameters
      const aavePool = this.getAavePool();
      const params = '0x'; // Empty params - receiver contract should handle logic

      const gasEstimate = await aavePool.methods.flashLoan(
        receiver,
        [token],
        [amount],
        [0], // Interest rate modes
        this.accountAddress,
        params,
        0 // Referral code
      ).estimateGas({ from: this.accountAddress });

      const gasLimit = Math.floor(Number(gasEstimate) * 1.5); // Higher buffer for flash loans
      const gasPrice = await this.web3.eth.getGasPrice();

      const receipt = await aavePool.methods.flashLoan(
        receiver,
        [token],
        [amount],
        [0],
        this.accountAddress,
        params,
        0
      ).send({
        from: this.accountAddress,
        gas: gasLimit.toString(),
        gasPrice: gasPrice.toString()
      });

      return {
        hash: receipt.transactionHash,
        status: receipt.status ? 'success' : 'failed',
        timestamp: Date.now(),
        gasUsed: receipt.gasUsed?.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString()
      };
    } catch (error) {
      console.error('Flash loan request failed:', error);
      throw new Error(`Flash loan failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current APY for a token from Aave
   */
  async getAPY(tokenAddress: string, protocol?: string): Promise<number> {
    try {
      if (protocol && protocol.toLowerCase() !== 'aave') {
        console.warn(`Protocol ${protocol} not yet supported, defaulting to Aave`);
      }

      const aavePool = this.getAavePool();
      const reserveData = await aavePool.methods.getReserveData(tokenAddress).call();

      // Convert Aave liquidity rate (RAY, 27 decimals) to APY percentage
      const liquidityRate = BigInt(reserveData.currentLiquidityRate.toString());
      const apy = Number(liquidityRate) / 1e25;

      return parseFloat(apy.toFixed(4));
    } catch (error) {
      console.error('Failed to get APY:', error);
      return 0;
    }
  }

  /**
   * Estimate swap output using on-chain pool data
   */
  async estimateSwapOutput(
    inputToken: string,
    outputToken: string,
    inputAmount: string
  ): Promise<string> {
    try {
      if (BigInt(inputAmount) <= 0) {
        return '0';
      }

      // Get quote from best pool
      const quote = await this.getSwapQuote(inputToken, outputToken, inputAmount, 0);
      return quote.expectedOutput;
    } catch (error) {
      console.error('Swap estimation failed:', error);
      return '0';
    }
  }

  /**
   * Get ETH/USD price from Chainlink price feed
   */
  async getEthPrice(): Promise<number> {
    try {
      const priceFeed = new this.web3.eth.Contract(
        CHAINLINK_PRICE_FEED_ABI as any,
        this.addresses.chainlinkEthUsd
      );

      const roundData = await priceFeed.methods.latestRoundData().call();
      const decimals = await priceFeed.methods.decimals().call();

      const price = Number(roundData.answer) / (10 ** Number(decimals));
      return price;
    } catch (error) {
      console.error('Failed to get ETH price:', error);
      return 0;
    }
  }

  /**
   * Get pool information for a token pair
   */
  async getPoolInfo(token0: string, token1: string, fee: number): Promise<PoolInfo | null> {
    try {
      const factory = this.getUniswapV3Factory();
      const poolAddress = await factory.methods.getPool(token0, token1, fee).call();

      if (!poolAddress || poolAddress === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      const poolContract = new this.web3.eth.Contract(
        UNISWAP_V3_POOL_ABI as any,
        poolAddress
      );

      const [slot0, liquidity, poolFee, t0, t1] = await Promise.all([
        poolContract.methods.slot0().call(),
        poolContract.methods.liquidity().call(),
        poolContract.methods.fee().call(),
        poolContract.methods.token0().call(),
        poolContract.methods.token1().call()
      ]);

      return {
        address: poolAddress,
        token0: t0,
        token1: t1,
        fee: Number(poolFee),
        sqrtPriceX96: slot0.sqrtPriceX96.toString(),
        liquidity: liquidity.toString(),
        tick: Number(slot0.tick)
      };
    } catch (error) {
      console.error('Failed to get pool info:', error);
      return null;
    }
  }

  /**
   * Get account token balances for common tokens
   */
  async getAccountBalances(): Promise<TokenInfo[]> {
    try {
      const commonTokens = COMMON_TOKENS[this.chainId] || {};
      const balances: TokenInfo[] = [];

      for (const [symbol, address] of Object.entries(commonTokens)) {
        try {
          const info = await this.getTokenInfo(address);
          balances.push({
            ...info,
            symbol
          });
        } catch (err) {
          continue;
        }
      }

      return balances;
    } catch (error) {
      console.error('Failed to get account balances:', error);
      return [];
    }
  }
}

/**
 * Factory function to create DeFiService instance
 */
export const createDeFiService = (
  web3: Web3Type,
  accountAddress: string,
  chainId: number
): DeFiService => {
  return new DeFiService(web3, accountAddress, chainId);
};

export default DeFiService;