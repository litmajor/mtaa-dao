
import { Request, Response } from 'express';
import { tokenService } from '../services/tokenService';
import { TokenRegistry } from '../../shared/tokenRegistry';

interface GasEstimateRequest {
  tokenSymbol: string;
  toAddress: string;
  amount: string;
  operationType?: 'transfer' | 'deposit' | 'withdraw';
}

export async function paymentsEstimateGasHandler(req: Request, res: Response) {
  try {
    const { tokenSymbol, toAddress, amount, operationType = 'transfer' }: GasEstimateRequest = req.body;

    // Validate inputs
    if (!tokenSymbol || !toAddress || !amount) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['tokenSymbol', 'toAddress', 'amount']
      });
    }

    // Validate token
    const token = TokenRegistry.getToken(tokenSymbol);
    if (!token) {
      return res.status(400).json({
        error: `Unsupported token: ${tokenSymbol}`,
        supportedTokens: TokenRegistry.getSupportedTokens()
      });
    }

    // Validate address format
    if (!toAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        error: 'Invalid Ethereum address format'
      });
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        error: 'Amount must be a positive number'
      });
    }

    // Estimate gas for the operation
  // Use a default sender address for estimation (could be from config or environment)
  const defaultSender = process.env.DEFAULT_SENDER_ADDRESS || '0x000000000000000000000000000000000000dead';
  const gasEstimateStr = await tokenService.estimateTokenGas(tokenSymbol, toAddress, amount, defaultSender);
  const gasEstimate = BigInt(gasEstimateStr);
    
    // Get current gas price
    const gasPrice = await tokenService.provider.getFeeData();
    
    // Calculate estimated cost
    const estimatedCostWei = gasEstimate * (gasPrice.gasPrice || BigInt(0));
  const estimatedCostCelo = require('ethers').formatUnits(estimatedCostWei, 18); // CELO has 18 decimals

    // Apply operation-specific multipliers for safety
    const operationMultipliers = {
      transfer: 1.1,  // 10% buffer
      deposit: 1.2,   // 20% buffer for vault operations
      withdraw: 1.3   // 30% buffer for complex withdrawals
    };

    const safetyMultiplier = operationMultipliers[operationType];
    const safeGasEstimate = BigInt(Math.ceil(Number(gasEstimate) * safetyMultiplier));

    res.json({
      success: true,
      gasEstimate: {
        operation: operationType,
        token: {
          symbol: tokenSymbol,
          name: token.name,
          decimals: token.decimals
        },
        gas: {
          estimated: gasEstimate.toString(),
          recommended: safeGasEstimate.toString(),
          price: gasPrice.gasPrice?.toString() || '0',
          maxFee: gasPrice.maxFeePerGas?.toString() || '0',
          maxPriorityFee: gasPrice.maxPriorityFeePerGas?.toString() || '0'
        },
        cost: {
          estimatedCELO: estimatedCostCelo,
          safetyMultiplier: safetyMultiplier,
          estimatedUSD: (parseFloat(estimatedCostCelo) * 0.65).toFixed(4) // Rough CELO price
        },
        network: 'Celo',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Gas estimation error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to estimate gas',
      details: error instanceof Error ? error.message : 'Unknown error',
      fallback: {
        // Provide fallback estimates for common operations
        transferGas: '21000',
        erc20TransferGas: '65000',
        vaultDepositGas: '150000',
        vaultWithdrawGas: '200000'
      }
    });
  }
}
