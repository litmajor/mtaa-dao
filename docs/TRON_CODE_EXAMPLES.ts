// TRON Integration Service - Code Examples
// Copy-paste ready implementations for common use cases

import { tronIntegrationService, tronTestnetService } from './services/tronIntegrationService';
import { ChainRegistry, SupportedChain } from './shared/chainRegistry';
import { AppError } from './middleware/errorHandler';

// ============================================================================
// EXAMPLE 1: Cross-Chain Balance Checker
// ============================================================================

export async function getBalanceUnified(chain: SupportedChain, address: string): Promise<string> {
  const config = ChainRegistry.getChainConfig(chain);

  switch (config.chainType) {
    case 'evm':
      // Existing EVM logic
      return '0';

    case 'tron':
      const service = chain === SupportedChain.TRON 
        ? tronIntegrationService 
        : tronTestnetService;
      
      return await service.getBalance(address);

    case 'solana':
      // Future Solana implementation
      return '0';

    default:
      throw new AppError(`Unsupported chain type: ${config.chainType}`, 400);
  }
}

// ============================================================================
// EXAMPLE 2: Token Balance Retrieval with Decimal Handling
// ============================================================================

interface TokenBalance {
  symbol: string;
  balance: string;
  decimals: number;
  uiAmount: string;
  address: string;
}

export async function getTokenBalanceFormatted(
  chain: SupportedChain,
  userAddress: string,
  tokenAddress: string
): Promise<TokenBalance> {
  if (chain !== SupportedChain.TRON && chain !== SupportedChain.TRON_SHASTA) {
    throw new AppError('Only TRON chains supported for this example', 400);
  }

  const service = chain === SupportedChain.TRON 
    ? tronIntegrationService 
    : tronTestnetService;

  // Validate inputs
  if (!service.validateAddress(userAddress)) {
    throw new AppError('Invalid user address', 400);
  }

  if (!service.validateAddress(tokenAddress)) {
    throw new AppError('Invalid token address', 400);
  }

  // Get token info and balance in parallel
  const [tokenInfo, rawBalance] = await Promise.all([
    service.getTokenInfo(tokenAddress),
    service.getTokenBalance(userAddress, tokenAddress)
  ]);

  // Convert raw amount to UI amount
  const uiAmount = service.onChainToUiAmount(rawBalance, tokenInfo.decimals);

  return {
    symbol: tokenInfo.symbol || 'UNKNOWN',
    balance: rawBalance,
    decimals: tokenInfo.decimals,
    uiAmount,
    address: tokenAddress
  };
}

// Usage:
// const balance = await getTokenBalanceFormatted(
//   SupportedChain.TRON,
//   'TN3W4H6rK33gn8qbtV2K9rkYtYjtJtQBXe',
//   'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
// );
// console.log(`${balance.symbol}: ${balance.uiAmount}`);

// ============================================================================
// EXAMPLE 3: Pre-Transfer Validation
// ============================================================================

interface TransferValidation {
  isValid: boolean;
  reason?: string;
  estimatedFee?: string;
  canExecute: boolean;
}

export async function validateTransfer(
  chain: SupportedChain,
  fromAddress: string,
  toAddress: string,
  tokenAddress: string | null,
  amount: string
): Promise<TransferValidation> {
  if (chain !== SupportedChain.TRON && chain !== SupportedChain.TRON_SHASTA) {
    return { isValid: false, reason: 'Chain not supported', canExecute: false };
  }

  const service = chain === SupportedChain.TRON 
    ? tronIntegrationService 
    : tronTestnetService;

  try {
    // Validate addresses
    if (!service.validateAddress(fromAddress)) {
      return { isValid: false, reason: 'Invalid from address', canExecute: false };
    }

    if (!service.validateAddress(toAddress)) {
      return { isValid: false, reason: 'Invalid to address', canExecute: false };
    }

    // Check if recipient is activated
    const recipientActivated = await service.isAccountActivated(toAddress);
    if (!recipientActivated) {
      return { 
        isValid: false, 
        reason: 'Recipient address not activated (needs 0.1+ TRX)', 
        canExecute: false 
      };
    }

    // Get token info for validation
    if (tokenAddress && !service.validateAddress(tokenAddress)) {
      return { isValid: false, reason: 'Invalid token address', canExecute: false };
    }

    let decimals = 6; // Default
    let estimatedFee = '0.1'; // TRX

    if (tokenAddress) {
      const tokenInfo = await service.getTokenInfo(tokenAddress);
      decimals = tokenInfo.decimals;
    }

    // Validate amount format
    if (!service.validateTransferAmount(amount, decimals)) {
      return { 
        isValid: false, 
        reason: `Invalid amount format for ${decimals} decimals`, 
        canExecute: false 
      };
    }

    // Check sender balance
    const hasSufficientBalance = await service.hassufficientBalance(
      fromAddress,
      amount,
      tokenAddress || undefined
    );

    if (!hasSufficientBalance) {
      return { 
        isValid: false, 
        reason: 'Insufficient balance', 
        canExecute: false 
      };
    }

    // Get fees and check energy
    const fees = await service.estimateFees();
    const accountInfo = await service.getAccountInfo(fromAddress);

    const nativeBalance = await service.getBalance(fromAddress);
    const canPayFee = parseFloat(nativeBalance) >= parseFloat(fees.networkFee);

    if (!canPayFee) {
      return { 
        isValid: false, 
        reason: `Insufficient TRX for fees (need ${fees.networkFee}, have ${nativeBalance})`, 
        canExecute: false 
      };
    }

    // All checks passed
    return {
      isValid: true,
      estimatedFee: fees.networkFee,
      canExecute: true
    };
  } catch (error) {
    return { 
      isValid: false, 
      reason: error instanceof Error ? error.message : 'Unknown error', 
      canExecute: false 
    };
  }
}

// Usage:
// const validation = await validateTransfer(
//   SupportedChain.TRON,
//   'TN3W4H6rK33gn8qbtV2K9rkYtYjtJtQBXe',
//   'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
//   'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
//   '100.5'
// );
// if (validation.canExecute) {
//   console.log(`Can execute transfer with fee: ${validation.estimatedFee}`);
// }

// ============================================================================
// EXAMPLE 4: Transaction Monitoring
// ============================================================================

interface TransactionMonitor {
  txid: string;
  status: string;
  confirmations: number;
  energyUsed: number;
  fee: string;
}

export async function monitorTransaction(
  chain: SupportedChain,
  txid: string,
  maxRetries: number = 30,
  retryDelayMs: number = 2000
): Promise<TransactionMonitor> {
  if (chain !== SupportedChain.TRON && chain !== SupportedChain.TRON_SHASTA) {
    throw new AppError('Only TRON chains supported', 400);
  }

  const service = chain === SupportedChain.TRON 
    ? tronIntegrationService 
    : tronTestnetService;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const txStatus = await service.getTransactionStatus(txid);

      if (txStatus.status === 'confirmed' || txStatus.status === 'failed') {
        return {
          txid,
          status: txStatus.status,
          confirmations: txStatus.confirmations || 0,
          energyUsed: txStatus.energyUsed || 0,
          fee: txStatus.fee.toString()
        };
      }

      // Still pending, wait and retry
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    } catch (error) {
      console.error(`Error monitoring transaction (attempt ${i + 1}):`, error);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new AppError(`Transaction ${txid} not confirmed after ${maxRetries} retries`, 504);
}

// Usage:
// const result = await monitorTransaction(
//   SupportedChain.TRON,
//   '0a4ebbfb98c98d5e94d1c0b8c2b8c0b8c0b8c0b8c0b8c0b8c0b8c0b8c0b8c0b8',
//   30,
//   2000
// );

// ============================================================================
// EXAMPLE 5: Fee Analysis for Cost Estimation
// ============================================================================

interface FeeAnalysis {
  networkFee: string;
  energyCostTrx: string;
  bandwidthCostTrx: string;
  totalEstimatedCost: string;
}

export async function analyzeFees(
  chain: SupportedChain,
  energyNeeded: number = 25000,
  bandwidthBytes: number = 268
): Promise<FeeAnalysis> {
  if (chain !== SupportedChain.TRON && chain !== SupportedChain.TRON_SHASTA) {
    throw new AppError('Only TRON chains supported', 400);
  }

  const service = chain === SupportedChain.TRON 
    ? tronIntegrationService 
    : tronTestnetService;

  const fees = await service.estimateFees();

  // Convert SUN costs to TRX
  const energyCostSun = energyNeeded * fees.energyPrice;
  const bandwidthCostSun = bandwidthBytes * fees.bandwidthPrice;
  const energyCostTrx = (energyCostSun / 1_000_000).toFixed(6);
  const bandwidthCostTrx = (bandwidthCostSun / 1_000_000).toFixed(6);

  // Total cost = network fee + energy cost + bandwidth cost
  const totalCostTrx = (
    parseFloat(fees.networkFee) + 
    parseFloat(energyCostTrx) + 
    parseFloat(bandwidthCostTrx)
  ).toFixed(6);

  return {
    networkFee: fees.networkFee,
    energyCostTrx,
    bandwidthCostTrx,
    totalEstimatedCost: totalCostTrx
  };
}

// Usage:
// const fees = await analyzeFees(SupportedChain.TRON);
// console.log(`Total cost: ${fees.totalEstimatedCost} TRX`);

// ============================================================================
// EXAMPLE 6: Batch Account Analysis
// ============================================================================

interface AccountAnalysis {
  address: string;
  totalBalance: string;
  liquid: string;
  frozen: string;
  energyPercentage: number;
  bandwidthPercentage: number;
  isActive: boolean;
}

export async function analyzeAccounts(
  chain: SupportedChain,
  addresses: string[]
): Promise<AccountAnalysis[]> {
  if (chain !== SupportedChain.TRON && chain !== SupportedChain.TRON_SHASTA) {
    throw new AppError('Only TRON chains supported', 400);
  }

  const service = chain === SupportedChain.TRON 
    ? tronIntegrationService 
    : tronTestnetService;

  const analyses = await Promise.all(
    addresses.map(async (address) => {
      try {
        if (!service.validateAddress(address)) {
          throw new AppError('Invalid address', 400);
        }

        const [accountInfo, isActive] = await Promise.all([
          service.getAccountInfo(address),
          service.isAccountActivated(address)
        ]);

        const energyPercentage = accountInfo.energyLimit 
          ? (accountInfo.energyUsed / accountInfo.energyLimit) * 100 
          : 0;

        const bandwidthPercentage = accountInfo.bandwidthLimit 
          ? (accountInfo.bandwidthUsed / accountInfo.bandwidthLimit) * 100 
          : 0;

        return {
          address,
          totalBalance: accountInfo.balance,
          liquid: accountInfo.unfrozenBalance || '0',
          frozen: accountInfo.frozenBalance || '0',
          energyPercentage: Math.round(energyPercentage),
          bandwidthPercentage: Math.round(bandwidthPercentage),
          isActive
        };
      } catch (error) {
        console.error(`Error analyzing account ${address}:`, error);
        throw error;
      }
    })
  );

  return analyses;
}

// Usage:
// const analyses = await analyzeAccounts(SupportedChain.TRON, [
//   'TN3W4H6rK33gn8qbtV2K9rkYtYjtJtQBXe',
//   'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
// ]);

// ============================================================================
// INTEGRATION WITH API ROUTES
// ============================================================================

// Express.js example route
/*
import express from 'express';

const router = express.Router();

router.get('/api/tron/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const balance = await getBalanceUnified(SupportedChain.TRON, address);
    res.json({ address, balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/tron/validate-transfer', async (req, res) => {
  try {
    const { from, to, tokenAddress, amount } = req.body;
    const validation = await validateTransfer(
      SupportedChain.TRON,
      from,
      to,
      tokenAddress || null,
      amount
    );
    res.json(validation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/tron/tx/:txid', async (req, res) => {
  try {
    const { txid } = req.params;
    const status = await monitorTransaction(SupportedChain.TRON, txid, 5, 1000);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
*/

// ============================================================================
// EXPORT ALL EXAMPLES
// ============================================================================

export {
  getBalanceUnified,
  getTokenBalanceFormatted,
  validateTransfer,
  monitorTransaction,
  analyzeFees,
  analyzeAccounts
};
