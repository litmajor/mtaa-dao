import { Router } from 'express';
import { z } from 'zod';
import { tronIntegrationService, tronTestnetService } from '../../services/tronIntegrationService';
import { tronSigningService, tronTestnetSigningService } from '../../services/tronTransactionSigningService';
import { asyncHandler } from '../../middleware/errorHandler';
import { isAuthenticated } from '../../nextAuthMiddleware';
import { requirePINVerification, checkAmountThreshold } from '../../middleware/pin-verification';
import { tronAddressSchema, tronTransferSchema, amountSchema } from './validation-schemas';

const router = Router();

// Get TRON balance (TRX or TRC20 token)
router.post('/tron/balance', asyncHandler(async (req, res) => {
  try {
    const schema = z.object({
      address: tronAddressSchema,
      tokenAddress: z.string().optional()
    });
    
    const validated = schema.parse(req.body);
    
    let balance: string;
    const tronService = req.query.testnet === 'true' ? tronTestnetService : tronIntegrationService;
    
    if (validated.tokenAddress) {
      // Get TRC20 token balance
      balance = await tronService.getTokenBalance(
        validated.address,
        validated.tokenAddress
      );
    } else {
      // Get TRX balance
      balance = await tronService.getBalance(validated.address);
    }

    res.json({
      success: true,
      data: { address: validated.address, balance }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: error.errors
      });
    }
    throw error;
  }
}));

// Get TRON token info
router.get('/tron/token/:tokenAddress', asyncHandler(async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const tronService = req.query.testnet === 'true' ? tronTestnetService : tronIntegrationService;
    
    // Validate token address format
    if (!/^T[1-9A-HJ-NP-Z]{33}$/.test(tokenAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid TRON token address format'
      });
    }

    const tokenInfo = await tronService.getTokenInfo(tokenAddress);

    res.json({
      success: true,
      data: tokenInfo
    });
  } catch (error) {
    if ((error as any).message?.includes('token') || (error as any).statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: 'Token not found'
      });
    }
    throw error;
  }
}));

// Estimate TRON transaction fees
router.get('/tron/fees', asyncHandler(async (req, res) => {
  const tronService = req.query.testnet === 'true' ? tronTestnetService : tronIntegrationService;
  const fees = await tronService.estimateFees();

  res.json({
    success: true,
    data: fees
  });
}));

// Get TRON transaction status
router.get('/tron/transaction/:txid', asyncHandler(async (req, res) => {
  try {
    const { txid } = req.params;
    const tronService = req.query.testnet === 'true' ? tronTestnetService : tronIntegrationService;
    
    const status = await tronService.getTransactionStatus(txid);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    if ((error as any).statusCode === 404 || (error as any).message?.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    throw error;
  }
}));

// Get recent TRON transactions
router.get('/tron/transactions/:address', asyncHandler(async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = '10' } = req.query;
    const tronService = req.query.testnet === 'true' ? tronTestnetService : tronIntegrationService;

    // Validate address format
    if (!/^T[1-9A-HJ-NP-Z]{33}$/.test(address)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid TRON address format'
      });
    }

    const limitNum = Math.min(parseInt(limit as string) || 10, 50); // Max 50
    const transactions = await tronService.getRecentTransactions(address, limitNum);

    res.json({
      success: true,
      data: { address, transactions, count: transactions.length }
    });
  } catch (error) {
    throw error;
  }
}));

// Get TRON account info
router.get('/tron/account/:address', asyncHandler(async (req, res) => {
  try {
    const { address } = req.params;
    const tronService = req.query.testnet === 'true' ? tronTestnetService : tronIntegrationService;

    // Validate address format
    if (!/^T[1-9A-HJ-NP-Z]{33}$/.test(address)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid TRON address format'
      });
    }

    const accountInfo = await tronService.getAccountInfo(address);

    res.json({
      success: true,
      data: accountInfo
    });
  } catch (error) {
    if ((error as any).statusCode === 404 || (error as any).message?.includes('Account not found')) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }
    throw error;
  }
}));

// Validate TRON address
router.post('/tron/validate', asyncHandler(async (req, res) => {
  try {
    const schema = z.object({
      address: z.string()
    });
    
    const { address } = schema.parse(req.body);
    const tronService = req.query.testnet === 'true' ? tronTestnetService : tronIntegrationService;
    const isValid = tronService.validateAddress(address);

    res.json({
      success: true,
      data: { address, isValid }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: error.errors
      });
    }
    throw error;
  }
}));

// Validate TRON transfer (pre-flight checks)
router.post('/tron/validate-transfer', asyncHandler(async (req, res) => {
  try {
    const validated = tronTransferSchema.parse(req.body);
    const tronService = req.query.testnet === 'true' ? tronTestnetService : tronIntegrationService;

    // Check sender has sufficient balance
    const hasSufficientBalance = await tronService.hasSufficientBalance(
      validated.fromAddress,
      validated.amount,
      validated.tokenAddress
    );

    // Get fee estimate
    const fees = await tronService.estimateFees();

    // Check account is activated (TRON requirement)
    const isActivated = await tronService.isAccountActivated(validated.fromAddress);

    res.json({
      success: true,
      data: {
        from: validated.fromAddress,
        to: validated.toAddress,
        amount: validated.amount,
        hasSufficientBalance,
        isAccountActivated: isActivated,
        estimatedFees: fees,
        isValid: hasSufficientBalance && isActivated
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: error.errors
      });
    }
    throw error;
  }
}));

// Create unsigned TRX transfer transaction
router.post('/tron/transfer/create', asyncHandler(async (req, res) => {
  try {
    const validated = z.object({
      fromAddress: tronAddressSchema,
      toAddress: tronAddressSchema,
      amount: amountSchema,
      feeLimit: z.string().optional()
    }).parse(req.body);

    const signingService = req.query.testnet === 'true' ? tronTestnetSigningService : tronSigningService;

    const transaction = await signingService.createTrxTransferTransaction({
      fromAddress: validated.fromAddress,
      toAddress: validated.toAddress,
      amount: validated.amount,
      feeLimit: validated.feeLimit ? parseInt(validated.feeLimit) : undefined
    });

    res.json({
      success: true,
      data: {
        txID: transaction.txID,
        rawData: transaction.raw_data,
        unsignedTx: transaction,
        message: 'Transaction created. Sign with privateKey or HSM and broadcast.'
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: error.errors
      });
    }
    throw error;
  }
}));

// Sign TRX transfer with private key
router.post('/tron/transfer/sign', asyncHandler(async (req, res) => {
  try {
    const validated = z.object({
      transaction: z.any(),
      privateKey: z.string().length(66, { message: 'Private key must be 66 character hex string' })
    }).parse(req.body);

    const signingService = req.query.testnet === 'true' ? tronTestnetSigningService : tronSigningService;

    const signedTx = await signingService.signTransactionWithPrivateKey(
      validated.transaction,
      validated.privateKey
    );

    res.json({
      success: true,
      message: 'Transaction signed successfully',
      data: {
        txID: signedTx.txID,
        signature: signedTx.signature,
        signedTx
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: error.errors
      });
    }
    throw error;
  }
}));

// Broadcast signed TRON transaction
router.post('/tron/transfer/broadcast', asyncHandler(async (req, res) => {
  try {
    const validated = z.object({
      signedTx: z.any()
    }).parse(req.body);

    const signingService = req.query.testnet === 'true' ? tronTestnetSigningService : tronSigningService;

    const result = await signingService.broadcastTransaction(validated.signedTx);

    res.json({
      success: true,
      message: 'Transaction broadcasted successfully',
      data: result
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: error.errors
      });
    }
    throw error;
  }
}));

// One-step TRON transfer (create, sign, and broadcast)
// Requires: PIN verification for security (sending to external address)
router.post('/tron/transfer', isAuthenticated, requirePINVerification, checkAmountThreshold('5000'), asyncHandler(async (req, res) => {
  try {
    const validated = tronTransferSchema.parse(req.body);
    const signingService = req.query.testnet === 'true' ? tronTestnetSigningService : tronSigningService;

    const result = await signingService.executeTrxTransfer({
      fromAddress: validated.fromAddress,
      toAddress: validated.toAddress,
      amount: validated.amount,
      feeLimit: validated.feeLimit,
      privateKey: req.body.privateKey
    });

    res.json({
      success: true,
      message: 'TRON transfer completed successfully',
      data: result
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: error.errors
      });
    }
    throw error;
  }
}));

export const tronRoutes = router;
