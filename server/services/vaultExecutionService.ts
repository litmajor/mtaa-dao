/**
 * Vault Execution Service
 * 
 * Monitors and executes trading strategies within vaults.
 * Handles multi-depositor accounting, P&L tracking, and automated execution.
 */

import { EventEmitter } from 'events';
import { SmartRouter } from './smart-router';
import { DexIntegrationService } from './dex-integration-service';
import { CCXTService } from './ccxt-service';
import { CrossChainService } from './cross-chain-service';

interface VaultState {
  vaultId: string;
  name: string;
  strategyId: string;
  totalValue: number;
  totalShares: number;
  depositors: Map<string, DepositorState>;
  positions: Position[];
  performanceHistory: PerformanceEntry[];
  lastExecutionTime: number;
  isActive: boolean;
}

interface DepositorState {
  userId: string;
  depositAmount: number;
  shares: number;
  currentValue: number;
  profitLoss: number;
  depositedAt: Date;
  lastUpdateAt: Date;
}

interface Position {
  symbol: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  exchange?: string;
  chain?: string;
}

interface PerformanceEntry {
  timestamp: Date;
  totalValue: number;
  dailyReturn: number;
  cumulativeReturn: number;
  trades: number;
}

interface StrategyBlock {
  id: string;
  type: 'condition' | 'action' | 'logic' | 'risk' | 'execution';
  label: string;
  config: Record<string, any>;
  inputs: string[];
  outputs: string[];
}

interface StrategyExecution {
  strategyId: string;
  blockId: string;
  condition?: {
    metric: string;
    operator: string;
    value: number;
  };
  action?: {
    type: string;
    token?: string;
    amount?: number;
    target?: string;
  };
  executedAt?: Date;
  result?: any;
  error?: string;
}

export class VaultExecutionService extends EventEmitter {
  private vaults: Map<string, VaultState> = new Map();
  private smartRouter: SmartRouter;
  private dexService: DexIntegrationService;
  private ccxtService: CCXTService;
  private crossChainService: CrossChainService;
  private executionIntervals: Map<string, NodeJS.Timeout> = new Map();
  private performanceInterval: NodeJS.Timeout | null = null;

  constructor(
    smartRouter: SmartRouter,
    dexService: DexIntegrationService,
    ccxtService: CCXTService,
    crossChainService: CrossChainService
  ) {
    super();
    this.smartRouter = smartRouter;
    this.dexService = dexService;
    this.ccxtService = ccxtService;
    this.crossChainService = crossChainService;
  }

  /**
   * Create a new vault with a deployed strategy
   */
  async createVault(
    vaultId: string,
    name: string,
    strategyId: string,
    initialBalance: number
  ): Promise<VaultState> {
    const vault: VaultState = {
      vaultId,
      name,
      strategyId,
      totalValue: initialBalance,
      totalShares: 1_000_000, // Start with 1M shares for precision
      depositors: new Map(),
      positions: [],
      performanceHistory: [],
      lastExecutionTime: Date.now(),
      isActive: true,
    };

    this.vaults.set(vaultId, vault);

    // Start execution loop for this vault
    this.startVaultExecution(vaultId);

    this.emit('vault:created', { vaultId, name, strategyId });
    return vault;
  }

  /**
   * Deposit capital into a vault and issue shares
   */
  async depositToVault(
    vaultId: string,
    userId: string,
    amount: number
  ): Promise<{ shares: number; currentValue: number }> {
    const vault = this.vaults.get(vaultId);
    if (!vault) throw new Error(`Vault ${vaultId} not found`);
    if (!vault.isActive) throw new Error(`Vault ${vaultId} is inactive`);

    // Calculate shares based on current vault value
    const sharePrice = vault.totalValue / vault.totalShares;
    const sharesToIssue = Math.floor(amount / sharePrice);

    if (sharesToIssue === 0) throw new Error('Deposit too small');

    // Update vault state
    vault.totalValue += amount;
    vault.totalShares += sharesToIssue;

    // Track depositor
    const existingDepositor = vault.depositors.get(userId);
    const depositor: DepositorState = {
      userId,
      depositAmount: (existingDepositor?.depositAmount || 0) + amount,
      shares: (existingDepositor?.shares || 0) + sharesToIssue,
      currentValue: amount,
      profitLoss: 0,
      depositedAt: existingDepositor?.depositedAt || new Date(),
      lastUpdateAt: new Date(),
    };

    vault.depositors.set(userId, depositor);

    this.emit('deposit:received', {
      vaultId,
      userId,
      amount,
      shares: sharesToIssue,
      sharePrice,
    });

    return { shares: sharesToIssue, currentValue: amount };
  }

  /**
   * Withdraw from a vault (redeem shares)
   */
  async withdrawFromVault(
    vaultId: string,
    userId: string,
    sharesToRedeem: number
  ): Promise<{ amount: number; profitLoss: number }> {
    const vault = this.vaults.get(vaultId);
    if (!vault) throw new Error(`Vault ${vaultId} not found`);

    const depositor = vault.depositors.get(userId);
    if (!depositor) throw new Error(`User not deposited in vault ${vaultId}`);
    if (depositor.shares < sharesToRedeem) throw new Error('Insufficient shares');

    // Calculate withdrawal amount based on current share price
    const sharePrice = vault.totalValue / vault.totalShares;
    const withdrawAmount = sharesToRedeem * sharePrice;

    // Calculate P&L
    const originalDeposit = depositor.depositAmount;
    const currentValue = (depositor.shares / vault.totalShares) * vault.totalValue;
    const profitLoss = currentValue - originalDeposit;

    // Update vault state
    vault.totalValue -= withdrawAmount;
    vault.totalShares -= sharesToRedeem;
    depositor.shares -= sharesToRedeem;
    depositor.currentValue = (depositor.shares / vault.totalShares) * vault.totalValue;

    // Remove depositor if no shares left
    if (depositor.shares === 0) {
      vault.depositors.delete(userId);
    }

    this.emit('withdrawal:processed', {
      vaultId,
      userId,
      sharesToRedeem,
      withdrawAmount,
      profitLoss,
      sharePrice,
    });

    return { amount: withdrawAmount, profitLoss };
  }

  /**
   * Start execution loop for a vault
   */
  private startVaultExecution(vaultId: string): void {
    // Execute strategy blocks every 5 seconds (can be adjusted per vault)
    const interval = setInterval(async () => {
      try {
        await this.executeVaultStrategy(vaultId);
      } catch (err) {
        console.error(`Vault ${vaultId} execution error:`, err);
        this.emit('execution:error', { vaultId, error: err });
      }
    }, 5000);

    this.executionIntervals.set(vaultId, interval);
  }

  /**
   * Execute a single round of strategy blocks for a vault
   */
  private async executeVaultStrategy(vaultId: string): Promise<void> {
    const vault = this.vaults.get(vaultId);
    if (!vault || !vault.isActive) return;

    // In a real implementation, fetch the strategy from database
    // For now, we'll simulate strategy execution
    const strategy = await this.fetchStrategy(vault.strategyId);
    if (!strategy || !strategy.blocks) return;

    const executionLog: StrategyExecution[] = [];

    // Execute each block in sequence
    for (const block of strategy.blocks) {
      try {
        const execution = await this.executeBlock(vault, block, strategy);
        if (execution) {
          executionLog.push(execution);
        }
      } catch (err) {
        console.error(`Block ${block.id} execution failed:`, err);
      }
    }

    // Update vault performance history
    if (executionLog.length > 0) {
      this.recordPerformance(vault, executionLog.length);
      this.emit('vault:executed', {
        vaultId,
        executions: executionLog,
        timestamp: new Date(),
      });
    }

    vault.lastExecutionTime = Date.now();
  }

  /**
   * Execute a single strategy block
   */
  private async executeBlock(
    vault: VaultState,
    block: StrategyBlock,
    strategy: any
  ): Promise<StrategyExecution | null> {
    const execution: StrategyExecution = {
      strategyId: strategy.id,
      blockId: block.id,
    };

    try {
      switch (block.type) {
        case 'condition':
          return await this.evaluateCondition(vault, block, execution);

        case 'action':
          return await this.executeAction(vault, block, execution);

        case 'logic':
          return await this.evaluateLogic(vault, block, execution);

        case 'risk':
          return await this.checkRiskControls(vault, block, execution);

        default:
          return null;
      }
    } catch (err) {
      execution.error = String(err);
      return execution;
    }
  }

  /**
   * Evaluate a condition block (price, volume, RSI, etc.)
   */
  private async evaluateCondition(
    vault: VaultState,
    block: StrategyBlock,
    execution: StrategyExecution
  ): Promise<StrategyExecution> {
    const { metric, token, operator, value, period } = block.config;

    let conditionMet = false;
    let currentValue = 0;

    try {
      switch (metric) {
        case 'price':
          const priceData = await this.ccxtService.getPrices([`${token}/USDT`]);
          currentValue = priceData?.[`${token}/USDT`]?.price || 0;
          conditionMet = this.compareValues(currentValue, operator, value);
          break;

        case 'rsi':
          // Fetch OHLCV and calculate RSI
          const ohlcv = await this.ccxtService.getOHLCV(`${token}/USDT`, '1h', 50);
          currentValue = this.calculateRSI(ohlcv, period || 14);
          conditionMet = this.compareValues(currentValue, operator, value);
          break;

        case 'volume':
          const volumeData = await this.ccxtService.getOHLCV(`${token}/USDT`, '1h', 1);
          currentValue = volumeData?.[volumeData.length - 1]?.[7] || 0; // Volume
          conditionMet = this.compareValues(currentValue, operator, value);
          break;

        case 'time':
          const hour = new Date().getHours();
          conditionMet = this.compareValues(hour, operator, value);
          break;

        default:
          conditionMet = false;
      }

      execution.condition = { metric, operator, value };
      execution.result = {
        conditionMet,
        currentValue,
        metric,
      };

      return execution;
    } catch (err) {
      execution.error = String(err);
      return execution;
    }
  }

  /**
   * Execute an action block (buy, sell, swap, bridge, etc.)
   */
  private async executeAction(
    vault: VaultState,
    block: StrategyBlock,
    execution: StrategyExecution
  ): Promise<StrategyExecution> {
    const { type, token, amount, target, exchange } = block.config;

    try {
      switch (type) {
        case 'swap':
          return await this.executeSwapAction(vault, block, execution);

        case 'buy':
        case 'sell':
          return await this.executeCexAction(vault, block, execution);

        case 'bridge':
          return await this.executeBridgeAction(vault, block, execution);

        case 'move':
          return await this.executeMoveAction(vault, block, execution);

        case 'alert':
          this.emit('vault:alert', {
            vaultId: vault.vaultId,
            message: block.config.message,
            severity: block.config.severity,
            timestamp: new Date(),
          });
          execution.result = { alert: true };
          return execution;

        default:
          throw new Error(`Unknown action type: ${type}`);
      }
    } catch (err) {
      execution.error = String(err);
      return execution;
    }
  }

  /**
   * Execute a swap action (DEX trade)
   */
  private async executeSwapAction(
    vault: VaultState,
    block: StrategyBlock,
    execution: StrategyExecution
  ): Promise<StrategyExecution> {
    const { fromToken, toToken, amount, slippage } = block.config;

    // Calculate swap amount based on vault balance
    let swapAmount = amount;
    if (amount === 'all' || amount === 'max') {
      const position = vault.positions.find((p) => p.symbol === fromToken);
      swapAmount = position?.amount || 0;
    }

    // Preview swap
    const route = await this.smartRouter.calculateRoute(
      fromToken,
      toToken,
      swapAmount,
      slippage || 0.5
    );

    if (!route || !route.outputAmount) {
      throw new Error('No route found for swap');
    }

    // Execute swap
    const txResult = await this.dexService.executeSwap({
      fromToken,
      toToken,
      amount: swapAmount,
      slippage: slippage || 0.5,
      userAddress: vault.vaultId, // Use vault address
    });

    // Update vault positions
    this.updateVaultPosition(vault, fromToken, -swapAmount);
    this.updateVaultPosition(vault, toToken, route.outputAmount);

    execution.action = { type: 'swap', fromToken, toToken, amount: swapAmount };
    execution.result = {
      txHash: txResult.txHash,
      outputAmount: route.outputAmount,
      priceImpact: route.priceImpact,
    };
    execution.executedAt = new Date();

    return execution;
  }

  /**
   * Execute a CEX buy/sell action
   */
  private async executeCexAction(
    vault: VaultState,
    block: StrategyBlock,
    execution: StrategyExecution
  ): Promise<StrategyExecution> {
    const { type, symbol, quantity, exchange } = block.config;

    try {
      const order = await this.ccxtService.createOrder(
        exchange || 'binance',
        symbol,
        'market',
        type === 'buy' ? quantity : -quantity
      );

      // Update vault positions
      const baseToken = symbol.split('/')[0];
      if (type === 'buy') {
        this.updateVaultPosition(vault, baseToken, quantity);
      } else {
        this.updateVaultPosition(vault, baseToken, -quantity);
      }

      execution.action = { type, symbol, quantity };
      execution.result = { orderId: order.id, status: order.status };
      execution.executedAt = new Date();

      return execution;
    } catch (err) {
      execution.error = String(err);
      return execution;
    }
  }

  /**
   * Execute a bridge action (cross-chain transfer)
   */
  private async executeBridgeAction(
    vault: VaultState,
    block: StrategyBlock,
    execution: StrategyExecution
  ): Promise<StrategyExecution> {
    const { asset, fromChain, toChain, amount } = block.config;

    const txResult = await this.crossChainService.executeBridge({
      asset,
      fromChain,
      toChain,
      amount,
      recipient: vault.vaultId,
    });

    execution.action = { type: 'bridge', asset, fromChain, toChain, amount };
    execution.result = { txHash: txResult.txHash, status: txResult.status };
    execution.executedAt = new Date();

    return execution;
  }

  /**
   * Execute a move action (internal transfer)
   */
  private async executeMoveAction(
    vault: VaultState,
    block: StrategyBlock,
    execution: StrategyExecution
  ): Promise<StrategyExecution> {
    const { fromAccount, toAccount, amount } = block.config;

    // In real implementation, would call wallet service
    this.emit('vault:transfer', {
      vaultId: vault.vaultId,
      from: fromAccount,
      to: toAccount,
      amount,
    });

    execution.action = { type: 'move', fromAccount, toAccount, amount };
    execution.result = { status: 'pending' };
    execution.executedAt = new Date();

    return execution;
  }

  /**
   * Evaluate logic blocks (AND, OR, NOT)
   */
  private async evaluateLogic(
    vault: VaultState,
    block: StrategyBlock,
    execution: StrategyExecution
  ): Promise<StrategyExecution | null> {
    // Logic blocks combine condition results
    const { operator, conditions } = block.config;
    execution.result = { operator, conditionCount: conditions?.length || 0 };
    return execution;
  }

  /**
   * Check risk controls (stop-loss, take-profit, max drawdown)
   */
  private async checkRiskControls(
    vault: VaultState,
    block: StrategyBlock,
    execution: StrategyExecution
  ): Promise<StrategyExecution> {
    const { maxLoss, maxDrawdown, dailyTradeLimit } = block.config;
    const vaultValue = vault.totalValue;
    const performance = vault.performanceHistory[vault.performanceHistory.length - 1];

    const violations = {
      maxLoss: false,
      maxDrawdown: false,
      dailyTradeLimit: false,
    };

    if (maxLoss && performance) {
      violations.maxLoss = performance.cumulativeReturn < -maxLoss;
    }

    if (maxDrawdown && performance) {
      violations.maxDrawdown = performance.dailyReturn < -maxDrawdown;
    }

    if (violations.maxLoss || violations.maxDrawdown) {
      vault.isActive = false;
      this.emit('vault:risk-triggered', {
        vaultId: vault.vaultId,
        violations,
      });
    }

    execution.result = { violations, vaultActive: vault.isActive };
    return execution;
  }

  /**
   * Helper: Compare values based on operator
   */
  private compareValues(current: number, operator: string, target: number): boolean {
    switch (operator) {
      case '>':
        return current > target;
      case '<':
        return current < target;
      case '==':
        return current === target;
      case '>=':
        return current >= target;
      case '<=':
        return current <= target;
      case 'between':
        return false; // Would need min/max
      default:
        return false;
    }
  }

  /**
   * Helper: Calculate RSI (Relative Strength Index)
   */
  private calculateRSI(ohlcv: any[], period: number = 14): number {
    if (ohlcv.length < period) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = ohlcv.length - period; i < ohlcv.length; i++) {
      const change = ohlcv[i][4] - ohlcv[i - 1][4]; // close - previous close
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / (avgLoss || 1);
    const rsi = 100 - 100 / (1 + rs);

    return rsi;
  }

  /**
   * Update a vault's position
   */
  private updateVaultPosition(vault: VaultState, symbol: string, amount: number): void {
    let position = vault.positions.find((p) => p.symbol === symbol);

    if (!position) {
      position = {
        symbol,
        amount,
        entryPrice: 0,
        currentPrice: 0,
        unrealizedPnL: 0,
      };
      vault.positions.push(position);
    } else {
      position.amount += amount;
    }

    if (position.amount <= 0) {
      vault.positions = vault.positions.filter((p) => p.symbol !== symbol);
    }
  }

  /**
   * Record performance metrics
   */
  private recordPerformance(vault: VaultState, trades: number): void {
    const previousEntry = vault.performanceHistory[vault.performanceHistory.length - 1];
    const previousValue = previousEntry?.totalValue || vault.totalValue;
    const dailyReturn = ((vault.totalValue - previousValue) / previousValue) * 100;
    const cumulativeReturn =
      previousEntry?.cumulativeReturn || 0 + (dailyReturn * vault.totalValue) / 10000;

    const entry: PerformanceEntry = {
      timestamp: new Date(),
      totalValue: vault.totalValue,
      dailyReturn,
      cumulativeReturn,
      trades,
    };

    vault.performanceHistory.push(entry);

    // Keep last 365 days
    if (vault.performanceHistory.length > 365) {
      vault.performanceHistory.shift();
    }
  }

  /**
   * Fetch strategy from database (stub)
   */
  private async fetchStrategy(strategyId: string): Promise<any> {
    // In real implementation, fetch from database
    return {
      id: strategyId,
      blocks: [],
    };
  }

  /**
   * Get vault state
   */
  getVault(vaultId: string): VaultState | undefined {
    return this.vaults.get(vaultId);
  }

  /**
   * Get depositor state
   */
  getDepositor(vaultId: string, userId: string): DepositorState | undefined {
    return this.vaults.get(vaultId)?.depositors.get(userId);
  }

  /**
   * Get vault performance
   */
  getPerformance(vaultId: string): PerformanceEntry[] {
    return this.vaults.get(vaultId)?.performanceHistory || [];
  }

  /**
   * Pause vault execution
   */
  pauseVault(vaultId: string): void {
    const vault = this.vaults.get(vaultId);
    if (vault) {
      vault.isActive = false;
      const interval = this.executionIntervals.get(vaultId);
      if (interval) clearInterval(interval);
      this.emit('vault:paused', { vaultId });
    }
  }

  /**
   * Resume vault execution
   */
  resumeVault(vaultId: string): void {
    const vault = this.vaults.get(vaultId);
    if (vault) {
      vault.isActive = true;
      this.startVaultExecution(vaultId);
      this.emit('vault:resumed', { vaultId });
    }
  }

  /**
   * Stop all vaults
   */
  stop(): void {
    this.vaults.forEach((vault) => {
      vault.isActive = false;
    });

    this.executionIntervals.forEach((interval) => clearInterval(interval));
    this.executionIntervals.clear();

    if (this.performanceInterval) clearInterval(this.performanceInterval);
  }
}

export default VaultExecutionService;
