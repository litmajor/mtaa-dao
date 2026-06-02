/**
 * Trading & DEX Simulators - INTERMEDIATE Depth
 * 
 * Simulates 5 core trading actions:
 * 1. Spot Trade - Buy/sell on spot markets
 * 2. Margin Trade - Leverage trading on margin
 * 3. Perpetuals/Futures - Derivatives trading with funding rates
 * 4. DEX Swap - Decentralized exchange swaps with slippage
 * 5. Flash Loan - Flash loan usage and repayment
 * 
 * INTERMEDIATE depth: Volatility impact, slippage modeling, historical data analysis
 * Includes liquidity analysis, price impact, funding rate simulation
 */

import { SimulationService, SimulationResult, SimulationParams, SimulationStatus, SimulationDepth } from './simulationFramework';

/**
 * Spot Trade Simulator
 * Buy/sell cryptocurrencies on spot markets
 * 
 * Input params:
 * - userId: string
 * - side: 'BUY' | 'SELL'
 * - symbol: string (e.g., 'BTC/USDT')
 * - quantity: number
 * - currentPrice: number
 * - volatility?: number (24h volatility %, default 2)
 * 
 * Simulates:
 * - Trading fees (maker/taker)
 * - Slippage impact
 * - Price volatility impact on execution
 * - Exchange-specific fee tiers
 */
export class SpotTradeSimulator extends SimulationService {
  constructor() {
    super('SPOT_TRADE', SimulationDepth.INTERMEDIATE);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();

    const missing = this.validateRequired(params, ['userId', 'side', 'symbol', 'quantity', 'currentPrice']);
    if (missing.length > 0) {
      return this.createError(`Missing required parameters: ${missing.join(', ')}`, params);
    }

    const { userId, side, symbol, quantity, currentPrice, volatility = 2.0, userBalance = 100000, currentHolding = 0 } = params;

    if (quantity <= 0 || currentPrice <= 0) {
      return this.createError('Quantity and price must be positive', params);
    }

    // Fee structure (basis points)
    const takerFee = 10; // 0.1%
    const makerFee = 5;  // 0.05%
    const estimatedFee = takerFee; // Assume taker

    // Slippage calculation based on order size
    const orderSizeRatio = (quantity * currentPrice) / 1000000; // Assume 1M daily volume
    const slippageBp = Math.min(100, orderSizeRatio * 100); // Up to 1% slippage

    const executionPrice = side === 'BUY' 
      ? currentPrice * (1 + this.basisPoints(slippageBp))
      : currentPrice * (1 - this.basisPoints(slippageBp));

    const totalValue = quantity * executionPrice;
    const fees = this.round(totalValue * this.basisPoints(estimatedFee), 8);

    const beforeState = {
      balance: userBalance,
      position: currentHolding,
      symbol,
      currentPrice,
    };

    // SELL: validate holdings
    if (side === 'SELL' && quantity > currentHolding) {
      return this.createError(`Insufficient holdings to sell. Holding: ${currentHolding}, Trying to sell: ${quantity}`, params);
    }

    const afterState = side === 'BUY' 
      ? {
          balance: userBalance - totalValue - fees,
          position: this.round(currentHolding + quantity, 8),
          symbol,
          executionPrice,
        }
      : {
          balance: userBalance + totalValue - fees,
          position: this.round(currentHolding - quantity, 8),
          symbol,
          executionPrice,
        };

    const delta = {
      feesCollected: fees,
      slippageImpact: this.round(quantity * currentPrice * this.basisPoints(slippageBp), 8),
      balanceDelta: side === 'BUY' ? -totalValue - fees : totalValue - fees,
      positionDelta: side === 'BUY' ? quantity : -quantity,
    };

    // Risk factors
    const riskFactors: string[] = [];
    const warnings: string[] = [];

    if (slippageBp > 50) {
      riskFactors.push('high-slippage');
      warnings.push(`Slippage of ${(slippageBp / 100).toFixed(2)}% due to large order size`);
    }

    if (volatility > 5) {
      riskFactors.push('high-volatility');
      warnings.push(`High volatility (${volatility}%) - execution price may vary`);
    }

    if (side === 'BUY' && totalValue + fees > userBalance) {
      riskFactors.push('insufficient-balance');
      return this.createError('Insufficient balance to execute trade', params);
    }

    // Warn if using default balance assumption
    if (params.userBalance === undefined) {
      warnings.push('Using default `userBalance` assumption of 100000 — provide explicit balance for accurate results');
    }

    const riskLevel = riskFactors.length === 0 ? 'LOW' : 
                      riskFactors.length === 1 ? 'MEDIUM' : 'HIGH';

    return {
      status: SimulationStatus.SUCCESS,
      depth: this.depth,
      timestamp: Date.now(),
      executionTimeMs: Math.max(1, Date.now() - startTime),
      beforeState,
      afterState,
      delta,
      riskLevel,
      riskFactors,
      warnings,
      errors: [],
      reversibilityWindow: {
        minGracePeriodHours: 1,
        recommendedGracePeriodHours: 24,
        maxGracePeriodDays: 30,
      },
      summary: `Spot ${side} ${quantity} ${symbol} at ${executionPrice.toFixed(8)} USDT`,
      impactedEntities: [
        { type: 'wallet', id: userId, impact: `Balance delta: ${delta.balanceDelta.toFixed(8)}` },
        { type: 'exchange', id: 'spot-market', impact: `${quantity} ${symbol} volume` },
      ],
      simulationData: {
        executionPrice,
        slippagePercentage: slippageBp / 100,
        volatility,
        orderSizeRatio,
      },
    };
  }
}

/**
 * Margin Trade Simulator
 * Leverage trading with collateral requirements
 * 
 * Input params:
 * - userId: string
 * - side: 'LONG' | 'SHORT'
 * - symbol: string
 * - quantity: number
 * - leverage: number (1-125)
 * - currentPrice: number
 * - collateral: number
 * 
 * Simulates:
 * - Collateral requirements and ratios
 * - Liquidation price calculation
 * - Margin interest/funding fees
 * - Volatility impact on margin calls
 */
export class MarginTradeSimulator extends SimulationService {
  constructor() {
    super('MARGIN_TRADE', SimulationDepth.INTERMEDIATE);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();

    const missing = this.validateRequired(params, ['userId', 'side', 'symbol', 'quantity', 'leverage', 'currentPrice', 'collateral']);
    if (missing.length > 0) {
      return this.createError(`Missing required parameters: ${missing.join(', ')}`, params);
    }

    const { userId, side, symbol, quantity, leverage, currentPrice, collateral, volatility = 3.0 } = params;

    if (leverage < 1 || leverage > 125) {
      return this.createError('Leverage must be between 1 and 125', params);
    }

    if (collateral <= 0) {
      return this.createError('Collateral must be positive', params);
    }

    // Margin requirements
    const initialMarginRequired = 100 / leverage; // 1% for 100x, etc.
    const maintenanceMargin = initialMarginRequired * 0.5;

    const positionValue = quantity * currentPrice;
    const marginRequired = positionValue * (initialMarginRequired / 100);

    if (collateral < marginRequired) {
      return this.createError(`Insufficient margin. Required: ${marginRequired.toFixed(8)}, Available: ${collateral.toFixed(8)}`, params);
    }

    // Liquidation price calculation
    const liquidationPrice = side === 'LONG'
      ? currentPrice * (1 - (maintenanceMargin / 100))
      : currentPrice * (1 + (maintenanceMargin / 100));

    // Funding rate (annualized %)
    const fundingRateAnnual = 5 + (volatility * 0.5); // 5% base + volatility impact
    const fundingRateHourly = fundingRateAnnual / 8760;

    // Interest calculation (simplified hourly)
    const interestCost = positionValue * (fundingRateHourly / 100);

    // Slippage (slightly higher than spot due to leverage)
    const orderSizeRatio = (positionValue / leverage) / 1000000; // Normalized by leverage
    const slippageBp = Math.min(150, orderSizeRatio * 150);

    const executionPrice = side === 'LONG'
      ? currentPrice * (1 + this.basisPoints(slippageBp))
      : currentPrice * (1 - this.basisPoints(slippageBp));

    const fees = this.round(positionValue * this.basisPoints(10), 8); // 10 bp = 0.1% opening fee

    const beforeState = {
      collateral,
      position: 0,
      collateralRatio: 100,
      leverage,
      symbol,
    };

    const marginUsed = this.round(marginRequired, 8);
    const collateralRatio = this.round((collateral / marginRequired) * 100, 2);

    const afterState = {
      collateral: collateral - marginUsed,
      position: quantity,
      collateralRatio,
      leverage,
      symbol,
      liquidationPrice,
      fundingRate: fundingRateHourly,
    };

    const delta = {
      marginUsed,
      positionDelta: quantity,
      feesCollected: fees,
      fundingCost: interestCost,
      slippageImpact: this.round(positionValue * this.basisPoints(slippageBp), 8),
    };

    // Risk factors
    const riskFactors: string[] = [];
    const warnings: string[] = [];

    if (leverage > 50) {
      riskFactors.push('extreme-leverage');
      warnings.push(`Extreme leverage (${leverage}x) - high liquidation risk`);
    } else if (leverage > 20) {
      riskFactors.push('high-leverage');
      warnings.push(`High leverage (${leverage}x) - significant liquidation risk`);
    }

    if (collateralRatio < 150) {
      riskFactors.push('low-margin-ratio');
      warnings.push(`Low margin ratio (${collateralRatio}%) - close to liquidation threshold`);
    }

    if (volatility > 5) {
      riskFactors.push('high-volatility');
      warnings.push(`High volatility (${volatility}%) - increased liquidation risk`);
    }

    warnings.push(`Liquidation price: ${liquidationPrice.toFixed(8)} USDT`);
    warnings.push(`Hourly funding cost: ${interestCost.toFixed(8)} USDT`);

    const riskLevel = collateralRatio < 110 ? 'CRITICAL' :
              collateralRatio < 150 ? 'HIGH' :
              leverage > 50 ? 'HIGH' : 'MEDIUM';
    
    return {
      status: SimulationStatus.SUCCESS,
      depth: this.depth,
      timestamp: Date.now(),
      executionTimeMs: Math.max(1, Date.now() - startTime),
      beforeState,
      afterState,
      delta,
      riskLevel,
      riskFactors,
      warnings,
      errors: [],
      reversibilityWindow: {
        minGracePeriodHours: 1,
        recommendedGracePeriodHours: 12,
        maxGracePeriodDays: 7,
      },
      summary: `${side} ${quantity} ${symbol} at ${leverage}x leverage, liquidation at ${liquidationPrice.toFixed(8)}`,
      impactedEntities: [
        { type: 'wallet', id: userId, impact: `Collateral: ${(collateral - marginUsed).toFixed(8)}` },
        { type: 'margin-account', id: `margin-${userId}`, impact: `Position: ${quantity} contracts` },
        { type: 'exchange', id: 'margin-market', impact: `${symbol} margin interest accruing` },
      ],
      simulationData: {
        executionPrice,
        liquidationPrice,
        fundingRateAnnual: fundingRateAnnual.toFixed(2),
        fundingRateHourly: fundingRateHourly.toFixed(6),
        marginRatio: collateralRatio,
        initialMarginBp: initialMarginRequired * 100,
        maintenanceBp: maintenanceMargin * 100,
      },
    };
  }
}

/**
 * Perpetuals/Futures Trade Simulator
 * 
 * Input params:
 * - userId: string
 * - side: 'LONG' | 'SHORT'
 * - symbol: string
 * - quantity: number
 * - leverage: number
 * - entryPrice: number
 * - currentPrice: number
 * - collateral: number
 */
export class PerpetualsFuturesSimulator extends SimulationService {
  constructor() {
    super('PERPETUALS_FUTURES', SimulationDepth.INTERMEDIATE);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();

    const missing = this.validateRequired(params, ['userId', 'side', 'symbol', 'quantity', 'leverage', 'entryPrice', 'currentPrice', 'collateral']);
    if (missing.length > 0) {
      return this.createError(`Missing required parameters: ${missing.join(', ')}`, params);
    }

    const { userId, side, symbol, quantity, leverage, entryPrice, currentPrice, collateral, volatility = 2.5 } = params;

    if (leverage < 1 || leverage > 125) {
      return this.createError('Leverage must be between 1 and 125', params);
    }

    // Calculate unrealized P&L
    const priceChange = side === 'LONG' ? currentPrice - entryPrice : entryPrice - currentPrice;
    const pnl = quantity * priceChange;
    const marginRequired = (quantity * entryPrice) / leverage;

    // Validate collateral covers margin required
    if (collateral < marginRequired) {
      return this.createError(`Insufficient margin for perp position. Required: ${marginRequired.toFixed(8)}, Available: ${collateral.toFixed(8)}`, params);
    }

    // P&L percentage should account for leverage when reporting risk (leveraged P&L%)
    const rawPricePct = (priceChange / entryPrice) * 100;
    const pnlPercentage = rawPricePct * leverage; // leveraged P&L%

    // Funding rate impact (perpetuals specific)
    const fundingRateAnnual = 3 + (volatility * 0.3);
    const fundingCostPerPosition = quantity * entryPrice * (fundingRateAnnual / 36500); // Daily rate

    // Liquidation price
    const maintenanceMargin = (100 / leverage) * 0.5;
    const liquidationPrice = side === 'LONG'
      ? entryPrice * (1 - (maintenanceMargin / 100))
      : entryPrice * (1 + (maintenanceMargin / 100));

    const beforeState = {
      collateral,
      position: 0,
      entry: 0,
      pnl: 0,
      leverage,
    };

    const afterState = {
      collateral: Math.max(0, collateral - marginRequired),
      position: quantity,
      entry: entryPrice,
      currentPrice,
      unrealizedPnl: pnl,
      pnlPercentage,
      liquidationPrice,
    };

    const delta = {
      marginUsed: marginRequired,
      unrealizedPnl: pnl,
      fundingCost: fundingCostPerPosition,
      positionDelta: quantity,
    };

    const riskFactors: string[] = [];
    const warnings: string[] = [];

    if (pnlPercentage < -20) {
      riskFactors.push('high-drawdown');
      warnings.push(`Position is down ${Math.abs(pnlPercentage).toFixed(2)}% (leveraged) - consider risk management`);
    }

    if (leverage > 20) {
      riskFactors.push('high-leverage');
      warnings.push(`${leverage}x leverage creates liquidation risk`);
    }

    if (volatility > 5) {
      riskFactors.push('volatile-market');
      warnings.push(`High volatility (${volatility}%) may trigger liquidation`);
    }

    const riskLevel = Math.abs(pnlPercentage) > 500 ? 'CRITICAL' :
              Math.abs(pnlPercentage) > 200 ? 'HIGH' :
              Math.abs(pnlPercentage) > 50 ? 'MEDIUM' : 'LOW';

    return {
      status: SimulationStatus.SUCCESS,
      depth: this.depth,
      timestamp: Date.now(),
      executionTimeMs: Math.max(1, Date.now() - startTime),
      beforeState,
      afterState,
      delta,
      riskLevel,
      riskFactors,
      warnings,
      errors: [],
      reversibilityWindow: {
        minGracePeriodHours: 0.5,
        recommendedGracePeriodHours: 6,
        maxGracePeriodDays: 30,
      },
      summary: `${side} ${quantity} ${symbol} perps @ ${leverage}x, P&L: ${pnl.toFixed(8)}`,
      impactedEntities: [
        { type: 'wallet', id: userId, impact: `Unrealized P&L: ${pnl.toFixed(8)}` },
        { type: 'perp-position', id: `${symbol}-${userId}`, impact: `${quantity} contracts` },
      ],
      simulationData: {
        unrealizedPnl: pnl,
        pnlPercentage,
        fundingRate: fundingRateAnnual.toFixed(2),
        liquidationPrice,
        markPrice: currentPrice,
      },
    };
  }
}

/**
 * DEX Swap Simulator
 * Decentralized exchange swap with liquidity pool impact
 */
export class DexSwapSimulator extends SimulationService {
  constructor() {
    super('DEX_SWAP', SimulationDepth.INTERMEDIATE);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();

    const missing = this.validateRequired(params, ['userId', 'tokenIn', 'tokenOut', 'amountIn', 'reserveIn', 'reserveOut']);
    if (missing.length > 0) {
      return this.createError(`Missing required parameters: ${missing.join(', ')}`, params);
    }

    const { userId, tokenIn, tokenOut, amountIn, reserveIn, reserveOut, slippageTolerance = 0.5 } = params;

    if (amountIn <= 0) {
      return this.createError('Amount must be positive', params);
    }

    // DEX fee (percent)
    const dexFeePercent = 0.003; // 0.3%
    const feeAmount = amountIn * dexFeePercent;
    const amountInAfterFee = amountIn - feeAmount;

    // AMM formula using amountIn after fee (Uniswap v2 style):
    // amountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee)
    const amountOut = (amountInAfterFee * reserveOut) / (reserveIn + amountInAfterFee);

    // Price impact (compare tokenOut per tokenIn)
    const spotPrice = amountOut / amountInAfterFee; // tokenOut per tokenIn
    const expectedPrice = reserveOut / reserveIn; // tokenOut per tokenIn
    const priceImpact = ((expectedPrice - spotPrice) / expectedPrice) * 100;

    // Slippage
    const minimumAmountOut = amountOut * (1 - (slippageTolerance / 100));

    // Liquidity provider fee impact comes from the feeAmount (stays in pool on the tokenIn side)
    const lpFees = feeAmount;

    const beforeState = {
      tokenIn,
      tokenOut,
      balanceIn: 100,
      balanceOut: 100,
      reserveIn,
      reserveOut,
    };

    const afterState = {
      balanceIn: 100 - amountIn,
      balanceOut: 100 + amountOut,
      reserveIn: reserveIn + amountIn, // fee also added to reserveIn
      reserveOut: reserveOut - amountOut,
    };

    const delta = {
      tokenInDelta: -amountIn,
      tokenOutDelta: amountOut,
      feesCollected: feeAmount,
      priceImpact: this.round(priceImpact, 8),
    };

    const riskFactors: string[] = [];
    const warnings: string[] = [];

    if (priceImpact > 5) {
      riskFactors.push('high-price-impact');
      warnings.push(`High price impact: ${priceImpact.toFixed(2)}% - consider splitting order`);
    }

    if (amountOut < minimumAmountOut) {
      riskFactors.push('slippage-exceeded');
      return this.createError(`Slippage exceeds tolerance. Min: ${minimumAmountOut.toFixed(8)}, Got: ${amountOut.toFixed(8)}`, params);
    }

    if (reserveIn < amountIn * 100) {
      riskFactors.push('low-liquidity');
      warnings.push('Pool liquidity is low - swap may revert');
    }

    const riskLevel = priceImpact > 10 ? 'HIGH' : priceImpact > 5 ? 'MEDIUM' : 'LOW';

    return {
      status: SimulationStatus.SUCCESS,
      depth: this.depth,
      timestamp: Date.now(),
      executionTimeMs: Math.max(1, Date.now() - startTime),
      beforeState,
      afterState,
      delta,
      riskLevel,
      riskFactors,
      warnings,
      errors: [],
      reversibilityWindow: {
        minGracePeriodHours: 0.1,
        recommendedGracePeriodHours: 1,
        maxGracePeriodDays: 7,
      },
      summary: `Swap ${amountIn} ${tokenIn} → ${amountOut.toFixed(8)} ${tokenOut} (${priceImpact.toFixed(2)}% impact)`,
      impactedEntities: [
        { type: 'wallet', id: userId, impact: `Received: ${amountOut.toFixed(8)} ${tokenOut}` },
        { type: 'pool', id: `${tokenIn}-${tokenOut}`, impact: `Reserves: +${amountIn} ${tokenIn}` },
      ],
      simulationData: {
        amountOut,
        spotPrice,
        expectedPrice,
        priceImpact,
        minimumAmountOut,
        slippageTolerance,
        lpFees,
      },
    };
  }
}

/**
 * Flash Loan Simulator
 * Flash loan execution and repayment simulation
 */
export class FlashLoanSimulator extends SimulationService {
  constructor() {
    super('FLASH_LOAN', SimulationDepth.INTERMEDIATE);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();

    const missing = this.validateRequired(params, ['userId', 'token', 'amount', 'poolLiquidity']);
    if (missing.length > 0) {
      return this.createError(`Missing required parameters: ${missing.join(', ')}`, params);
    }

    const { userId, token, amount, poolLiquidity, actionType = 'arbitrage' } = params;

    if (amount <= 0) {
      return this.createError('Loan amount must be positive', params);
    }

    if (amount > poolLiquidity) {
      return this.createError(`Requested amount exceeds pool liquidity. Requested: ${amount}, Available: ${poolLiquidity}`, params);
    }

    // Flash loan fees (typically 0.05-0.09%)
    const flashLoanFeeBp = 5; // 0.05%
    const fee = amount * this.basisPoints(flashLoanFeeBp);

    // Execution cost (gas/slippage for the action being performed)
    const executionCostBp = actionType === 'arbitrage' ? 50 : 
                            actionType === 'liquidation' ? 30 : 20;
    const executionCost = amount * this.basisPoints(executionCostBp);

    // Estimate profit based on action type multipliers (avoid fabricated flat profit)
    const profitMultipliers: { [k: string]: number } = {
      arbitrage: 0.007, // 0.7%
      liquidation: 0.07, // 7% (liquidation bonus)
      swap: 0.005, // 0.5%
      default: 0.001,
    };
    const multiplier = profitMultipliers[actionType] ?? profitMultipliers.default;
    const estimatedProfit = amount * multiplier;
    const netProfit = estimatedProfit - fee - executionCost;

    const beforeState = {
      loanBalance: 0,
      poolLiquidity,
      fee: 0,
      profit: 0,
    };

    const afterState = {
      loanBalance: 0, // Flash loans repay within transaction
      poolLiquidity: poolLiquidity + fee, // principal returned, fee remains in pool
      repaymentAmount: amount + fee,
      profit: Math.max(0, netProfit),
    };

    const delta = {
      loanDelta: 0,
      feeCollected: fee,
      executionCost,
      netProfitChange: netProfit,
      liquidityImpact: fee,
    };

    const riskFactors: string[] = [];
    const warnings: string[] = [];

    if (amount > poolLiquidity * 0.1) {
      riskFactors.push('large-flash-loan');
      warnings.push('Flash loan size is >10% of pool - may impact price');
    }

    if (netProfit < 0) {
      riskFactors.push('negative-profit');
      warnings.push(`Flash loan fees and execution costs exceed potential profit by ${Math.abs(netProfit).toFixed(8)}`);
    }

    if (actionType === 'liquidation') {
      riskFactors.push('liquidation-risk');
      warnings.push('Liquidation action may cause MEV/sandwich attacks');
    }

    const riskLevel = netProfit < 0 ? 'CRITICAL' : 
                      amount > poolLiquidity * 0.15 ? 'HIGH' : 'MEDIUM';

    return {
      status: SimulationStatus.SUCCESS,
      depth: this.depth,
      timestamp: Date.now(),
      executionTimeMs: Math.max(1, Date.now() - startTime),
      beforeState,
      afterState,
      delta,
      riskLevel,
      riskFactors,
      warnings,
      errors: [],
      reversibilityWindow: {
        minGracePeriodHours: 0,
        recommendedGracePeriodHours: 0.25,
        maxGracePeriodDays: 1,
      },
      summary: `Flash loan ${amount} ${token} for ${actionType} - fee ${fee.toFixed(8)}, net profit ${netProfit.toFixed(8)}`,
      impactedEntities: [
        { type: 'wallet', id: userId, impact: `Profit: ${netProfit.toFixed(8)} ${token}` },
        { type: 'pool', id: token, impact: `Liquidity: ${poolLiquidity + fee}` },
      ],
      simulationData: {
        flashLoanFee: flashLoanFeeBp / 100,
        repaymentAmount: amount + fee,
        estimatedProfit,
        executionCost,
        netProfit,
        actionType,
      },
    };
  }
}
