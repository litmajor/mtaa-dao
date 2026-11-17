export type FlashLoanState =
  | 'DRAFT'
  | 'PROFITABLE'
  | 'UNPROFITABLE'
  | 'HIGH_RISK'
  | 'READY_TO_EXECUTE'
  | 'SIMULATING'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED';

export interface FlashLoanRequest {
  asset: string;
  loanAmount: number; // human units
  loanFeePercentage: number; // percent (eg 0.05 for 0.05%) or 0.09 for 0.09%
  executionPlan: string;
  estimatedProfit: number; // human units
  chain?: string; // 'ethereum' | 'polygon' | 'arbitrum' etc.
  gasCostPerUnit?: number; // optional override USD per gas unit
}

export interface FlashLoanAnalysis {
  fee: number;
  repaymentAmount: number;
  netProfit: number;
  profitMargin: number; // absolute
  profitMarginPct: number; // percent of loan
  gasUsage: number;
  gasCost: number;

  state: FlashLoanState;
  warnings: string[];
}

export class FlashLoanEngine {
  static MIN_PROFIT_PCT = 0.005; // 0.5% minimal profit threshold
  static HIGH_RISK_EXECUTIONS = ['MEV', 'mev', 'LIQUIDATION', 'liquidation'];
  static GAS_USAGE: Record<string, number> = {
    arbitrage: 200000,
    ARBITRAGE: 200000,
    liquidation: 350000,
    LIQUIDATION: 350000,
    swap: 250000,
    SWAP: 250000,
    mev: 300000,
    MEV: 300000,
  };

  // USD per gas unit approximations
  static GAS_USD: Record<string, number> = {
    ethereum: 8.22e-7,
    polygon: 1.79e-7,
    arbitrum: 6.68e-7,
  };

  static analyze(req: FlashLoanRequest): FlashLoanAnalysis {
    const { loanAmount, loanFeePercentage, estimatedProfit, executionPlan, chain, gasCostPerUnit } = req;

    // Interpret loanFeePercentage: if given as percent like 0.09 mean 0.09%? Our UI uses 0.09 for 0.09%.
    // We'll support both: if value > 1 assume it's percent (e.g., 0.09 means 0.09%), so convert to fraction of 1.
    // If loanFeePercentage <= 1 and > 0, assume percent value (0.09 => 0.09%) => divisor 100.
    let feePct = Number(loanFeePercentage);
    if (isNaN(feePct) || feePct < 0) feePct = 0.0005; // default 0.05%
    // If user provided 0.09 expecting percent representation, treat as 0.09% => 0.0009
    if (feePct > 1) {
      // e.g., 5 => 5% -> 0.05
      feePct = feePct / 100;
    } else {
      // small numbers like 0.09 mean 0.09% -> divide by 100
      feePct = feePct / 100;
    }

    const fee = loanAmount * feePct;
    const repaymentAmount = loanAmount + fee;
    // Gas estimation
    const gasUsage = FlashLoanEngine.GAS_USAGE[executionPlan] ?? 220000;
    const gasUnitCost = typeof gasCostPerUnit === 'number' ? gasCostPerUnit : (FlashLoanEngine.GAS_USD[String(chain || 'ethereum')] ?? FlashLoanEngine.GAS_USD.ethereum);
    const gasCost = gasUsage * gasUnitCost;

    const netProfit = estimatedProfit - fee - gasCost;
    const profitMargin = netProfit;
    const profitMarginPct = loanAmount > 0 ? (profitMargin / loanAmount) * 100 : 0;

    const warnings: string[] = [];

    // Decide state
    let state: FlashLoanState = 'DRAFT';

    if (loanAmount <= 0) {
      state = 'DRAFT';
      warnings.push('Loan amount must be greater than zero');
    } else if (netProfit <= 0) {
      state = 'UNPROFITABLE';
      warnings.push('Net profit is non-positive after fees');
    } else {
      // Profit positive
      if (profitMarginPct < (FlashLoanEngine.MIN_PROFIT_PCT * 100)) {
        state = 'UNPROFITABLE';
        warnings.push('Profit below minimum threshold');
      } else if (FlashLoanEngine.HIGH_RISK_EXECUTIONS.includes(String(executionPlan))) {
        state = 'HIGH_RISK';
        warnings.push('Execution plan marked as high risk');
      } else {
        state = 'PROFITABLE';
      }
    }

    // If profit looks good and no warnings -> ready to execute
    if (state === 'PROFITABLE' && warnings.length === 0) {
      state = 'READY_TO_EXECUTE';
    }

    return {
      fee,
      repaymentAmount,
      netProfit,
      profitMargin,
      profitMarginPct,
      gasUsage,
      gasCost,
      state,
      warnings,
    };
  }
}
