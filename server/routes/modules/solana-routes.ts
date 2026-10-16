import { Router, type Request } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { users } from '../../../shared/schema';
import { isAuthenticated } from '../../auth';
import { db } from '../../db';
import { rateLimiter } from '../../middleware/rateLimiter';
import { checkAmountThreshold, requirePINVerification } from '../../middleware/pin-verification';
import { getRequestUserId } from '../../utils/requestUser';
import { solanaDevnetIntegrationService, solanaIntegrationService } from '../../services/solanaIntegrationService';
import { solanaSigningService, solanaDevnetSigningService } from '../../services/solanaTransactionSigningService';
import { asyncHandler } from '../../middleware/errorHandler';
import { solanaAddressSchema, solanaBalanceQuerySchema, solanaTransferSchema } from './validation-schemas';

const router = Router();
router.use(isAuthenticated);

const requestKey = (req: Request) => getRequestUserId(req) ?? req.ip ?? 'unknown-user';
const readLimiter = rateLimiter({
  windowMs: 60_000,
  max: 60,
  keyGenerator: (req) => `solana:read:${requestKey(req)}`,
});
const writeLimiter = rateLimiter({
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req) => `solana:write:${requestKey(req)}`,
});
const signingLimiter = rateLimiter({
  windowMs: 60_000,
  max: 3,
  keyGenerator: (req) => `solana:sign:${requestKey(req)}`,
});

const getSolanaIntegrationService = (req: Request) =>
  req.query.testnet === 'true' ? solanaDevnetIntegrationService : solanaIntegrationService;

async function requireOwnedSolanaWallet(req: Request, address: string): Promise<boolean> {
  const userId = getRequestUserId(req);
  if (!userId) return false;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return user?.walletAddress === address;
}

// Get Solana balance (SOL or SPL token)
router.post('/solana/balance', readLimiter, asyncHandler(async (req, res) => {
  try {
    const validated = solanaBalanceQuerySchema.parse(req.body);
    const integrationService = getSolanaIntegrationService(req);
    
    let balance: string;
    if (validated.tokenMint) {
      // Get SPL token balance
      balance = await integrationService.getTokenBalance(
        validated.address,
        validated.tokenMint
      );
    } else {
      // Get SOL balance
      balance = await integrationService.getBalance(validated.address);
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
router.get('/solana/token/:mint', readLimiter, asyncHandler(async (req, res) => {
  try {
    const { mint } = req.params;
    const integrationService = getSolanaIntegrationService(req);
    if (!integrationService.validateAddress(mint)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token mint format'
      });
    }

    const tokenInfo = await integrationService.getTokenInfo(mint);

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

// Estimate fees using the actual selected-cluster RPC.
router.get('/solana/fees', readLimiter, asyncHandler(async (req, res) => {
  const { address } = z.object({ address: solanaAddressSchema }).parse(req.query);
  const signingService = req.query.testnet === 'true' ? solanaDevnetSigningService : solanaSigningService;
  const fees = await signingService.estimateFees(address);
  return res.json({ success: true, data: fees });
}));

// Get transaction status from the selected cluster.
router.get('/solana/transaction/:signature', readLimiter, asyncHandler(async (req, res) => {
  const { signature } = req.params;
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) {
    return res.status(400).json({ success: false, message: 'Invalid Solana transaction signature format' });
  }
  const signingService = req.query.testnet === 'true' ? solanaDevnetSigningService : solanaSigningService;
  const status = await signingService.getTransactionStatus(signature);
  return res.json({ success: true, data: status });
}));

// Get recent transactions from the selected cluster.
router.get('/solana/transactions/:address', readLimiter, asyncHandler(async (req, res) => {
  const { address } = req.params;
  const { limit = '10' } = req.query;
  const parsedAddress = solanaAddressSchema.safeParse(address);
  if (!parsedAddress.success) return res.status(400).json({ success: false, message: 'Invalid Solana address format' });
  const parsedLimit = Number.parseInt(String(limit), 10);
  const limitNum = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 10;
  const integrationService = getSolanaIntegrationService(req);
  const transactions = await integrationService.getRecentTransactions(address, limitNum);
  return res.json({ success: true, data: { address, transactions, count: transactions.length } });
}));

// Validate Solana address
router.post('/solana/validate', readLimiter, asyncHandler(async (req, res) => {
  try {
    const schema = z.object({ address: solanaAddressSchema });
    
    const { address } = schema.parse(req.body);
    const isValid = getSolanaIntegrationService(req).validateAddress(address);

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
router.post('/solana/validate-mint', readLimiter, asyncHandler(async (req, res) => {
  try {
    const schema = z.object({ mint: solanaAddressSchema });
    
    const { mint } = schema.parse(req.body);
    let isValid: boolean;
    try {
      isValid = await getSolanaIntegrationService(req).validateTokenMint(mint);
    } catch (error) {
      if ((error as { statusCode?: number })?.statusCode === 503) {
        return res.status(503).json({ success: false, message: 'Solana RPC unavailable while validating token mint' });
      }
      throw error;
    }

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
router.post('/solana/transfer/create', writeLimiter, requirePINVerification, checkAmountThreshold('5000'), asyncHandler(async (req, res) => {
  try {
    const { fromAddress, toAddress, amount, memo } = solanaTransferSchema.parse(req.body);
    if (!await requireOwnedSolanaWallet(req, fromAddress)) {
      return res.status(403).json({ success: false, message: 'Transfer source must match the authenticated account wallet' });
    }
    
    const signingService = req.query.testnet === 'true' ? solanaDevnetSigningService : solanaSigningService;
    
    // For SOL transfer only (no token)
    if (!req.body.tokenMint) {
      let lamports: bigint;
      try {
        lamports = decimalToBaseUnits(amount, 9);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: error instanceof Error ? error.message : 'Invalid SOL amount precision',
        });
      }
      if (lamports > BigInt(Number.MAX_SAFE_INTEGER)) {
        return res.status(400).json({ success: false, message: 'SOL transfer amount exceeds the supported transaction range' });
      }
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
router.post('/solana/transfer-token/create', writeLimiter, requirePINVerification, checkAmountThreshold('5000'), asyncHandler(async (req, res) => {
  try {
    const {
      fromAddress,
      toAddress,
      tokenMint,
      amount,
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

    if (!await requireOwnedSolanaWallet(req, fromAddress)) {
      return res.status(403).json({ success: false, message: 'Transfer source must match the authenticated account wallet' });
    }

    const signingService = req.query.testnet === 'true' ? solanaDevnetSigningService : solanaSigningService;
    const tokenDecimals = await signingService.getTokenDecimals(tokenMint);
    let lamports: bigint;
    try {
      lamports = decimalToBaseUnits(amount, tokenDecimals);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Invalid token amount precision',
      });
    }

    const transaction = await signingService.createSplTokenTransferTransaction({
      fromAddress,
      toAddress,
      mint: tokenMint,
      fromTokenAccount,
      toTokenAccount,
      amount: lamports.toString(),
      decimals: tokenDecimals,
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

// Accept the user's wallet-signed payload; private keys never cross the API boundary.
router.post('/solana/transfer/submit', signingLimiter, requirePINVerification, asyncHandler(async (req, res) => {
  try {
    const { transaction, address } = z.object({
      transaction: z.string().min(1).max(16_384),
      address: solanaAddressSchema,
    }).parse(req.body);
    const signingService = req.query.testnet === 'true' ? solanaDevnetSigningService : solanaSigningService;

    const userId = getRequestUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user?.walletAddress || user.walletAddress !== address) {
      return res.status(403).json({ success: false, message: 'Signing address must match the authenticated account wallet' });
    }

    // Deserialize transaction
    const txBuffer = Buffer.from(transaction, 'base64');
    if (txBuffer.toString('base64') !== transaction) {
      return res.status(400).json({ success: false, message: 'Transaction must be valid base64' });
    }
    const { Transaction } = await import('@solana/web3.js');
    const txToSign = Transaction.from(txBuffer);
    const feePayer = txToSign.compileMessage().accountKeys[0];
    if (!feePayer || feePayer.toBase58() !== user.walletAddress) {
      return res.status(403).json({ success: false, message: 'Transaction fee payer must match the authenticated wallet' });
    }

    const result = await signingService.submitWalletSignedTransaction(txToSign);
    return res.json({ success: result.status !== 'failed', data: result });
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

function decimalToBaseUnits(amount: string, decimals: number): bigint {
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length > decimals) throw new Error(`Amount exceeds the token's ${decimals} decimal places`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');
}
