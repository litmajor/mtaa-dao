import { Router } from 'express';
import { z } from 'zod';
import { solanaIntegrationService } from '../../services/solanaIntegrationService';
import { solanaSigningService, solanaDevnetSigningService } from '../../services/solanaTransactionSigningService';
import { asyncHandler } from '../../middleware/errorHandler';
import { solanaBalanceQuerySchema, solanaTransferSchema } from './validation-schemas';

const router = Router();

// Get Solana balance (SOL or SPL token)
router.post('/solana/balance', asyncHandler(async (req, res) => {
  try {
    const validated = solanaBalanceQuerySchema.parse(req.body);
    
    let balance: string;
    if (validated.tokenMint) {
      // Get SPL token balance
      balance = await solanaIntegrationService.getTokenBalance(
        validated.address,
        validated.tokenMint
      );
    } else {
      // Get SOL balance
      balance = await solanaIntegrationService.getBalance(validated.address);
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

// Get Solana token info
router.get('/solana/token/:mint', asyncHandler(async (req, res) => {
  try {
    const { mint } = req.params;
    
    // Validate mint format
    if (!/^[1-9A-HJ-NP-Z]{44}$/.test(mint)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token mint format'
      });
    }

    const tokenInfo = await solanaIntegrationService.getTokenInfo(mint);

    res.json({
      success: true,
      data: tokenInfo
    });
  } catch (error) {
    if ((error as any).message === 'Failed to fetch token information') {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch token information'
      });
    }
    throw error;
  }
}));

// Estimate Solana transaction fees
router.get('/solana/fees', asyncHandler(async (req, res) => {
  const fees = await solanaIntegrationService.estimateFees();

  res.json({
    success: true,
    data: fees
  });
}));

// Get Solana transaction status
router.get('/solana/transaction/:signature', asyncHandler(async (req, res) => {
  try {
    const { signature } = req.params;
    
    const status = await solanaIntegrationService.getTransactionStatus(signature);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    if ((error as any).statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    throw error;
  }
}));

// Get recent Solana transactions
router.get('/solana/transactions/:address', asyncHandler(async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = '10' } = req.query;

    // Validate address format
    if (!/^[1-9A-HJ-NP-Z]{44}$/.test(address)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Solana address format'
      });
    }

    const limitNum = Math.min(parseInt(limit as string) || 10, 50); // Max 50
    const transactions = await solanaIntegrationService.getRecentTransactions(address, limitNum);

    res.json({
      success: true,
      data: { address, transactions, count: transactions.length }
    });
  } catch (error) {
    throw error;
  }
}));

// Validate Solana address
router.post('/solana/validate', asyncHandler(async (req, res) => {
  try {
    const schema = z.object({
      address: z.string()
    });
    
    const { address } = schema.parse(req.body);
    const isValid = solanaIntegrationService.validateAddress(address);

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

// Validate Solana token mint
router.post('/solana/validate-mint', asyncHandler(async (req, res) => {
  try {
    const schema = z.object({
      mint: z.string()
    });
    
    const { mint } = schema.parse(req.body);
    const isValid = await solanaIntegrationService.validateTokenMint(mint);

    res.json({
      success: true,
      data: { mint, isValid }
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

// Create Solana SOL transfer transaction
router.post('/solana/transfer/create', asyncHandler(async (req, res) => {
  try {
    const { fromAddress, toAddress, amount, decimals, memo } = solanaTransferSchema.parse(req.body);
    
    const signingService = req.query.testnet === 'true' ? solanaDevnetSigningService : solanaSigningService;
    
    // For SOL transfer only (no token)
    if (!req.body.tokenMint) {
      const lamports = BigInt(Math.floor(parseFloat(amount) * 1000000000));
      const transaction = await signingService.createSolTransferTransaction({
        fromAddress,
        toAddress,
        amount: lamports.toString(),
        decimals: 9,
        memo
      });

      res.json({
        success: true,
        message: 'SOL transfer transaction created',
        data: {
          transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
          blockHash: transaction.recentBlockhash
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'For token transfers, use /solana/transfer-token endpoint'
      });
    }
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

// Create Solana SPL token transfer transaction
router.post('/solana/transfer-token/create', asyncHandler(async (req, res) => {
  try {
    const {
      fromAddress,
      toAddress,
      tokenMint,
      amount,
      decimals,
      fromTokenAccount,
      toTokenAccount,
      memo
    } = solanaTransferSchema.parse({
      ...req.body,
      tokenMint: req.body.tokenMint
    });

    if (!tokenMint) {
      return res.status(400).json({
        success: false,
        message: 'tokenMint is required for token transfers'
      });
    }

    if (!fromTokenAccount || !toTokenAccount) {
      return res.status(400).json({
        success: false,
        message: 'fromTokenAccount and toTokenAccount are required for token transfers'
      });
    }

    const signingService = req.query.testnet === 'true' ? solanaDevnetSigningService : solanaSigningService;
    const lamports = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals || 9)));

    const transaction = await signingService.createSplTokenTransferTransaction({
      fromAddress,
      toAddress,
      mint: tokenMint,
      fromTokenAccount,
      toTokenAccount,
      amount: lamports.toString(),
      decimals: decimals || 9,
      memo
    });

    res.json({
      success: true,
      message: 'SPL token transfer transaction created',
      data: {
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        blockHash: transaction.recentBlockhash
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

// Sign Solana transaction
router.post('/solana/transfer/sign', asyncHandler(async (req, res) => {
  try {
    const schema = z.object({
      transaction: z.string(), // Base64 encoded transaction
      privateKey: z.string()
    });

    const { transaction, privateKey } = schema.parse(req.body);
    const signingService = req.query.testnet === 'true' ? solanaDevnetSigningService : solanaSigningService;

    // Deserialize transaction
    const txBuffer = Buffer.from(transaction, 'base64');
    const { Transaction } = await import('@solana/web3.js');
    const txToSign = Transaction.from(txBuffer);

    const signed = await signingService.signTransaction(txToSign, privateKey);

    res.json({
      success: true,
      message: 'Transaction signed successfully',
      data: {
        transaction: signed.serialize().toString('base64')
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

export const solanaRoutes = router;
