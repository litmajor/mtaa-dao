/**
 * Payment Flow Simulators - BASIC Depth
 * 
 * Simulates 5 core payment actions:
 * 1. Deposit - User deposits funds into escrow/platform
 * 2. Withdrawal - User withdraws funds from platform
 * 3. P2P Transfer - Direct transfer between users
 * 4. Recurring Payment - Setup scheduled recurring payments
 * 5. Payment Settlement - Settle pending payment requests
 * 
 * BASIC depth: Fee calculations, rate conversions, simple fund flow
 * No volatility modeling, no historical backtesting, no Monte Carlo
 */

import { SimulationService, SimulationResult, SimulationParams, SimulationStatus, SimulationDepth } from './simulationFramework';

/**
 * Payment Deposit Simulator
 * User deposits funds into platform (fiat or crypto)
 * 
 * Input params:
 * - userId: string
 * - amount: number
 * - currency: 'USD' | 'EUR' | 'BTC' | 'ETH' | 'MTAA'
 * - paymentMethod: 'bank_transfer' | 'card' | 'wallet'
 * - exchangeRate?: number (for non-USD deposits)
 * 
 * Simulates:
 * - Deposit fees by method
 * - Exchange rate impact
 * - Platform working capital impact
 * - Reversibility window (deposits are fully reversible)
 */
export class PaymentDepositSimulator extends SimulationService {
  constructor() {
    super('PAYMENT_DEPOSIT', SimulationDepth.BASIC);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();

    // Validate required fields
    const missing = this.validateRequired(params, ['userId', 'amount', 'currency', 'paymentMethod']);
    if (missing.length > 0) {
      return this.createError(`Missing required parameters: ${missing.join(', ')}`, params);
    }

    const { userId, amount, currency, paymentMethod, exchangeRate = 1.0 } = params;

    // Validate inputs
    if (amount <= 0) {
      return this.createError('Deposit amount must be greater than 0', params);
    }

    // Define fee structures by payment method (in basis points)
    const depositFees: Record<string, number> = {
      bank_transfer: 30,    // 0.3%
      card: 200,            // 2.0%
      wallet: 50,           // 0.5%
    };

    const feeBp = depositFees[paymentMethod] || 100;
    const fee = this.round(amount * this.basisPoints(feeBp), 2);
    const netDeposit = this.round(amount - fee, 2);
    const nativeAmount = this.round(netDeposit * exchangeRate, 8);

    // Platform working capital impact
    const beforeState = {
      userBalance: 0,
      platformFloat: 10000000, // Mock value
      pendingDeposits: 42,
      totalAssets: 500000000,
    };

    const afterState = {
      userBalance: nativeAmount,
      platformFloat: beforeState.platformFloat + netDeposit,
      pendingDeposits: beforeState.pendingDeposits - 1,
      totalAssets: beforeState.totalAssets + nativeAmount,
    };

    const delta = {
      userBalanceDelta: nativeAmount,
      platformFloatDelta: netDeposit,
      feesCollected: fee,
      assetsIncrease: nativeAmount,
    };

    // Risk assessment
    const riskFactors: string[] = [];
    const warnings: string[] = [];

    if (amount > 100000) {
      riskFactors.push('large-deposit');
      warnings.push('Deposit exceeds $100K - may trigger compliance review');
    }

    if (paymentMethod === 'card' && amount > 5000) {
      riskFactors.push('high-card-load');
      warnings.push('Card deposit exceeds typical limits - may take longer to clear');
    }

    return {
      status: SimulationStatus.SUCCESS,
      depth: this.depth,
      timestamp: Date.now(),
      executionTimeMs: Date.now() - startTime,
      beforeState,
      afterState,
      delta,
      riskLevel: 'LOW',
      riskFactors,
      warnings,
      errors: [],
      reversibilityWindow: {
        minGracePeriodHours: 24,
        recommendedGracePeriodHours: 72,
        maxGracePeriodDays: 365, // Full year for deposits - highest reversibility
      },
      summary: `Deposit ${amount} ${currency} → ${nativeAmount} MTAA (fee: ${fee} ${currency})`,
      impactedEntities: [
        {
          type: 'user_account',
          id: userId,
          impact: `+${nativeAmount} MTAA`,
        },
        {
          type: 'platform_treasury',
          id: 'treasury',
          impact: `+${netDeposit} ${currency} (working capital)`,
        },
      ],
      simulationData: {
        grossAmount: amount,
        feeBp,
        fee,
        netDeposit,
        currency,
        exchangeRate,
        paymentMethod,
        nativeAmount,
      },
    };
  }
}

/**
 * Payment Withdrawal Simulator
 * User withdraws funds to external account (bank, wallet, etc)
 * 
 * Input params:
 * - userId: string
 * - amount: number (in MTAA or native currency)
 * - currency: 'USD' | 'EUR' | 'BTC' | 'ETH' | 'MTAA'
 * - destination: 'bank' | 'wallet' | 'card'
 * - userBalance: number (current MTAA balance)
 * 
 * Simulates:
 * - Withdrawal fees
 * - Liquidity check (platform must have funds)
 * - KYC/AML compliance checks
 * - Reversibility window
 */
export class PaymentWithdrawalSimulator extends SimulationService {
  constructor() {
    super('PAYMENT_WITHDRAWAL', SimulationDepth.BASIC);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();

    const missing = this.validateRequired(params, ['userId', 'amount', 'currency', 'destination', 'userBalance']);
    if (missing.length > 0) {
      return this.createError(`Missing required parameters: ${missing.join(', ')}`, params);
    }

    const { userId, amount, currency, destination, userBalance } = params;

    if (amount <= 0) {
      return this.createError('Withdrawal amount must be greater than 0', params);
    }

    if (amount > userBalance) {
      return this.createError(`Insufficient balance. Have ${userBalance}, requested ${amount}`, params);
    }

    // Fee structures by destination
    const withdrawalFees: Record<string, number> = {
      bank: 100,    // 1.0%
      wallet: 75,   // 0.75%
      card: 150,    // 1.5%
    };

    const feeBp = withdrawalFees[destination] || 100;
    const fee = this.round(amount * this.basisPoints(feeBp), 2);
    const netWithdrawal = this.round(amount - fee, 2);

    const beforeState = {
      userBalance: userBalance,
      pendingWithdrawals: 18,
      platformLiquidity: 50000000,
      totalAssets: 500000000,
    };

    const afterState = {
      userBalance: this.round(userBalance - amount, 2),
      pendingWithdrawals: beforeState.pendingWithdrawals + 1,
      platformLiquidity: this.round(beforeState.platformLiquidity - netWithdrawal, 2),
      totalAssets: this.round(beforeState.totalAssets - amount, 2),
    };

    const delta = {
      userBalanceDelta: -amount,
      liquidityDelta: -netWithdrawal,
      feesCollected: fee,
      assetsDecrease: amount,
    };

    const riskFactors: string[] = [];
    const warnings: string[] = [];

    // Liquidity check
    if (afterState.platformLiquidity < 1000000) {
      riskFactors.push('low-liquidity');
      warnings.push('Platform liquidity below safe threshold - withdrawal may be delayed');
    }

    // Large withdrawal
    if (amount > userBalance * 0.5) {
      riskFactors.push('large-withdrawal');
      warnings.push('Withdrawal exceeds 50% of balance - may trigger compliance review');
    }

    // Bank transfer with large amount
    if (destination === 'bank' && amount > 50000) {
      riskFactors.push('threshold-alert');
      warnings.push('Bank withdrawal exceeds $50K - OFAC/AML screening required');
    }

    return {
      status: SimulationStatus.SUCCESS,
      depth: this.depth,
      timestamp: Date.now(),
      executionTimeMs: Date.now() - startTime,
      beforeState,
      afterState,
      delta,
      riskLevel: warnings.length > 0 ? 'HIGH' : 'MEDIUM',
      riskFactors,
      warnings,
      errors: [],
      reversibilityWindow: {
        minGracePeriodHours: 24,
        recommendedGracePeriodHours: 48,
        maxGracePeriodDays: 30, // Shorter than deposits - user received funds externally
      },
      summary: `Withdraw ${amount} MTAA → ${netWithdrawal} ${currency} to ${destination} (fee: ${fee} MTAA)`,
      impactedEntities: [
        {
          type: 'user_account',
          id: userId,
          impact: `-${amount} MTAA`,
        },
        {
          type: 'platform_treasury',
          id: 'treasury',
          impact: `-${netWithdrawal} ${currency}`,
        },
      ],
      simulationData: {
        requestedAmount: amount,
        feeBp,
        fee,
        netWithdrawal,
        currency,
        destination,
        userBalanceRemaining: afterState.userBalance,
      },
    };
  }
}

/**
 * P2P Payment Transfer Simulator
 * Direct transfer of funds between two users
 * 
 * Input params:
 * - userId: string (sender)
 * - recipientId: string
 * - amount: number
 * - memo?: string
 * - userBalance: number
 * 
 * Simulates:
 * - P2P transfer fees
 * - Beneficiary account validation
 * - Fund flow impact
 * - Reversibility (easily reversible within platform)
 */
export class PaymentP2PTransferSimulator extends SimulationService {
  constructor() {
    super('PAYMENT_P2P_TRANSFER', SimulationDepth.BASIC);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();

    const missing = this.validateRequired(params, ['userId', 'recipientId', 'amount', 'userBalance']);
    if (missing.length > 0) {
      return this.createError(`Missing required parameters: ${missing.join(', ')}`, params);
    }

    const { userId, recipientId, amount, userBalance, memo = '' } = params;

    if (amount <= 0) {
      return this.createError('Transfer amount must be greater than 0', params);
    }

    if (amount > userBalance) {
      return this.createError(`Insufficient balance. Have ${userBalance}, requested ${amount}`, params);
    }

    if (userId === recipientId) {
      return this.createError('Cannot transfer to yourself', params);
    }

    // P2P fees are minimal (0.1%) - internal transfers
    const feeBp = 10;
    const fee = this.round(amount * this.basisPoints(feeBp), 2);
    const netTransfer = this.round(amount - fee, 2);

    const beforeState = {
      senderBalance: userBalance,
      recipientBalance: 0, // Not provided but needed for impact
      pendingTransfers: 156,
    };

    const afterState = {
      senderBalance: this.round(userBalance - amount, 2),
      recipientBalance: netTransfer,
      pendingTransfers: beforeState.pendingTransfers + 1,
    };

    const delta = {
      senderBalanceDelta: -amount,
      recipientBalanceDelta: netTransfer,
      feesCollected: fee,
    };

    const riskFactors: string[] = [];
    const warnings: string[] = [];

    // Multiple rapid transfers to different recipients = risk
    if (amount > userBalance * 0.3) {
      riskFactors.push('large-transfer');
      warnings.push('Transfer exceeds 30% of sender balance');
    }

    if (memo.toLowerCase().includes('loan') || memo.toLowerCase().includes('investment')) {
      riskFactors.push('potential-securities');
      warnings.push('Transfer memo suggests possible unregistered securities activity - verify compliance');
    }

    return {
      status: SimulationStatus.SUCCESS,
      depth: this.depth,
      timestamp: Date.now(),
      executionTimeMs: Date.now() - startTime,
      beforeState,
      afterState,
      delta,
      riskLevel: riskFactors.length > 0 ? 'MEDIUM' : 'LOW',
      riskFactors,
      warnings,
      errors: [],
      reversibilityWindow: {
        minGracePeriodHours: 24,
        recommendedGracePeriodHours: 48,
        maxGracePeriodDays: 90, // High reversibility - internal transfer
      },
      summary: `P2P transfer ${amount} MTAA from ${userId} to ${recipientId} (net: ${netTransfer} MTAA, fee: ${fee} MTAA)`,
      impactedEntities: [
        {
          type: 'user_account',
          id: userId,
          impact: `-${amount} MTAA`,
        },
        {
          type: 'user_account',
          id: recipientId,
          impact: `+${netTransfer} MTAA`,
        },
      ],
      simulationData: {
        senderAmount: amount,
        feeBp,
        fee,
        recipientAmount: netTransfer,
        memo,
        senderBalanceRemaining: afterState.senderBalance,
        recipientBalanceAfter: afterState.recipientBalance,
      },
    };
  }
}

/**
 * Recurring Payment Setup Simulator
 * Setup automatic recurring/scheduled payments
 * 
 * Input params:
 * - userId: string
 * - recipientId: string
 * - amount: number (per cycle)
 * - frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'
 * - startDate: number (unix timestamp)
 * - cycles?: number (how many times to repeat, undefined = infinite)
 * - userBalance: number
 * 
 * Simulates:
 * - Setup fee
 * - Total commitment impact
 * - Projected fund utilization
 * - Reversibility (cancellable anytime)
 */
export class RecurringPaymentSetupSimulator extends SimulationService {
  constructor() {
    super('RECURRING_PAYMENT_SETUP', SimulationDepth.BASIC);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();

    const missing = this.validateRequired(params, ['userId', 'recipientId', 'amount', 'frequency', 'startDate', 'userBalance']);
    if (missing.length > 0) {
      return this.createError(`Missing required parameters: ${missing.join(', ')}`, params);
    }

    const { userId, recipientId, amount, frequency, startDate, cycles = undefined, userBalance } = params;

    if (amount <= 0) {
      return this.createError('Payment amount must be greater than 0', params);
    }

    if (startDate < Date.now()) {
      return this.createError('Start date must be in the future', params);
    }

    // Setup fee: 0.5% of single payment
    const setupFeeBp = 50;
    const setupFee = this.round(amount * this.basisPoints(setupFeeBp), 2);

    // Calculate frequency multiplier for projections
    const frequencyMap: Record<string, number> = {
      weekly: 52,
      biweekly: 26,
      monthly: 12,
      quarterly: 4,
      annual: 1,
    };

    const cyclesPerYear = frequencyMap[frequency] || 12;
    const projectedCyclesPerYear = Math.min(cycles || cyclesPerYear, cyclesPerYear);
    const projectedAnnualAmount = this.round(amount * projectedCyclesPerYear, 2);
    const totalSetupCost = setupFee;

    const beforeState = {
      userBalance: userBalance,
      activeRecurringPayments: 3,
      totalRecurringMonthly: 500, // Mock data
      availableBalance: userBalance,
    };

    const afterState = {
      userBalance: this.round(userBalance - setupFee, 2),
      activeRecurringPayments: beforeState.activeRecurringPayments + 1,
      totalRecurringMonthly: this.round(beforeState.totalRecurringMonthly + (amount / (cyclesPerYear / 12)), 2),
      availableBalance: this.round(userBalance - setupFee, 2),
    };

    const delta = {
      setupFeeDeducted: setupFee,
      balanceDelta: -setupFee,
      recurringCommitmentAdded: projectedAnnualAmount,
    };

    const riskFactors: string[] = [];
    const warnings: string[] = [];

    // Check if recurring burden is too high
    const monthlyBurden = afterState.totalRecurringMonthly;
    if (monthlyBurden > userBalance * 0.5) {
      riskFactors.push('high-commitment');
      warnings.push(`Recurring payments exceed 50% of balance (${monthlyBurden} MTAA/month)`);
    }

    if (!cycles) {
      warnings.push('This is a perpetual recurring payment - cancellation required to stop');
    }

    return {
      status: SimulationStatus.SUCCESS,
      depth: this.depth,
      timestamp: Date.now(),
      executionTimeMs: Date.now() - startTime,
      beforeState,
      afterState,
      delta,
      riskLevel: riskFactors.length > 0 ? 'MEDIUM' : 'LOW',
      riskFactors,
      warnings,
      errors: [],
      reversibilityWindow: {
        minGracePeriodHours: 24,
        recommendedGracePeriodHours: 48,
        maxGracePeriodDays: 365, // Fully reversible - can cancel anytime
      },
      summary: `Setup recurring ${frequency} payment of ${amount} MTAA to ${recipientId} (setup fee: ${setupFee} MTAA, projected annual: ${projectedAnnualAmount} MTAA)`,
      impactedEntities: [
        {
          type: 'user_account',
          id: userId,
          impact: `-${setupFee} MTAA (setup) + recurring -${amount} MTAA/${frequency}`,
        },
        {
          type: 'user_account',
          id: recipientId,
          impact: `+${amount} MTAA/${frequency}`,
        },
      ],
      simulationData: {
        paymentAmount: amount,
        frequency,
        setupFeeBp,
        setupFee,
        totalCycles: cycles || 'indefinite',
        projectedAnnualAmount,
        projectedMonthlyBurden: afterState.totalRecurringMonthly,
        startDate: new Date(startDate).toISOString(),
      },
    };
  }
}

/**
 * Payment Settlement Simulator
 * Settle a pending payment request from another user
 * 
 * Input params:
 * - userId: string (payer)
 * - requestId: string (payment request identifier)
 * - amount: number
 * - userBalance: number
 * - senderId: string (who requested payment)
 * 
 * Simulates:
 * - Settlement fees
 * - Dispute impact (if disputed)
 * - Escrow release (if in escrow)
 * - Fund availability impact
 */
export class PaymentSettlementSimulator extends SimulationService {
  constructor() {
    super('PAYMENT_SETTLEMENT', SimulationDepth.BASIC);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();

    const missing = this.validateRequired(params, ['userId', 'requestId', 'amount', 'userBalance', 'senderId']);
    if (missing.length > 0) {
      return this.createError(`Missing required parameters: ${missing.join(', ')}`, params);
    }

    const { userId, requestId, amount, userBalance, senderId } = params;

    if (amount <= 0) {
      return this.createError('Settlement amount must be greater than 0', params);
    }

    if (amount > userBalance) {
      return this.createError(`Insufficient balance. Have ${userBalance}, owed ${amount}`, params);
    }

    // Settlement fees: 0.2% (lower than other transfers since it's resolving existing obligation)
    const settlementFeeBp = 20;
    const settlementFee = this.round(amount * this.basisPoints(settlementFeeBp), 2);
    const netSettlement = this.round(amount - settlementFee, 2);

    const beforeState = {
      payerBalance: userBalance,
      payerOutstandingRequests: 2,
      payeeBalance: 0, // Not provided
      platformPendingSettlements: 42,
    };

    const afterState = {
      payerBalance: this.round(userBalance - amount, 2),
      payerOutstandingRequests: Math.max(beforeState.payerOutstandingRequests - 1, 0),
      payeeBalance: netSettlement,
      platformPendingSettlements: beforeState.platformPendingSettlements - 1,
    };

    const delta = {
      payerBalanceDelta: -amount,
      payeeBalanceDelta: netSettlement,
      feesCollected: settlementFee,
      outstandingRequestsResolved: 1,
    };

    const riskFactors: string[] = [];
    const warnings: string[] = [];

    // Late payment (if we had timestamp data)
    const isLatePayment = false; // Would check against request due date
    if (isLatePayment) {
      riskFactors.push('late-payment');
      warnings.push('This payment is overdue - note may be recorded');
    }

    return {
      status: SimulationStatus.SUCCESS,
      depth: this.depth,
      timestamp: Date.now(),
      executionTimeMs: Date.now() - startTime,
      beforeState,
      afterState,
      delta,
      riskLevel: 'LOW',
      riskFactors,
      warnings,
      errors: [],
      reversibilityWindow: {
        minGracePeriodHours: 24,
        recommendedGracePeriodHours: 72,
        maxGracePeriodDays: 7, // Shorter - settles a dispute resolution
      },
      summary: `Settle payment request ${requestId}: ${amount} MTAA to ${senderId} (net: ${netSettlement} MTAA, fee: ${settlementFee} MTAA)`,
      impactedEntities: [
        {
          type: 'user_account',
          id: userId,
          impact: `-${amount} MTAA`,
        },
        {
          type: 'user_account',
          id: senderId,
          impact: `+${netSettlement} MTAA (settlement)`,
        },
        {
          type: 'payment_request',
          id: requestId,
          impact: 'SETTLED',
        },
      ],
      simulationData: {
        requestId,
        paymentAmount: amount,
        settlementFeeBp,
        settlementFee,
        netAmount: netSettlement,
        payeeId: senderId,
        payerBalanceAfter: afterState.payerBalance,
      },
    };
  }
}
