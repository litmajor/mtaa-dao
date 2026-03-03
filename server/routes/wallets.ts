/**
 * Wallet Integration Routes - Phase 2
 * REST API endpoints for wallet management and blockchain transactions
 */

import { Router, Request, Response, NextFunction } from "express";
import { verifyMessage } from "ethers";
import {
  connectWallet,
  disconnectWallet,
  getWalletConnections,
  getWalletByAddress,
  syncWalletBalances,
  queueTransaction,
  getTransactionQueue,
  recordTransaction,
  getWalletTransactions,
  getTransactionByHash,
  getSupportedNetworks,
  getNetworkTokens,
  verifyWalletOwnership,
  getWalletPortfolio,
} from "../services/wallet-service";
import { authenticateToken } from "../middleware/auth";
import { walletValidation } from "../middleware/validation";

const router = Router();

// ============================================
// PHASE 1 FIX: Signature Verification Helper
// ============================================
/**
 * Verify EIP-191 signed message from wallet owner
 * Prevents users from queueing transactions on wallets they don't own
 */
async function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signature: string
): Promise<boolean> {
  try {
    const recoveredAddress = verifyMessage(message, signature);
    // Compare addresses (case-insensitive)
    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch (error) {
    console.error('Error verifying wallet signature:', error);
    return false;
  }
}

/**
 * Generate a nonce for signature verification
 * Prevents replay attacks (same signature used multiple times)
 */
const nonceMap = new Map<string, { nonce: number; timestamp: number }>();

function getNonce(walletAddress: string): number {
  const key = walletAddress.toLowerCase();
  const existing = nonceMap.get(key);
  
  if (existing && Date.now() - existing.timestamp < 3600000) { // 1 hour TTL
    return existing.nonce;
  }
  
  const nonce = Math.floor(Math.random() * 1000000);
  nonceMap.set(key, { nonce, timestamp: Date.now() });
  return nonce;
}

function verifyAndIncrementNonce(walletAddress: string, nonce: number): boolean {
  const key = walletAddress.toLowerCase();
  const existing = nonceMap.get(key);
  
  if (!existing || existing.nonce !== nonce) {
    return false;
  }
  
  // Increment nonce for next use
  nonceMap.set(key, { nonce: nonce + 1, timestamp: Date.now() });
  return true;
}

// ==================== WALLET CONNECTION ENDPOINTS ====================

/**
 * POST /api/wallets/connect
 * Connect wallet to account
 */
router.post(
  "/connect",
  walletValidation.connectWallet,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const connection = await connectWallet(
        req.body.accountId,
        req.user?.id || "",
        req.body.chainId,
        req.body.walletAddress,
        req.body.walletLabel
      );

      res.status(201).json({
        success: true,
        data: connection,
        message: "Wallet connected successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/wallets/account/:accountId
 * Get all wallet connections for account
 */
router.get(
  "/account/:accountId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const connections = await getWalletConnections(req.params.accountId);

      res.json({
        success: true,
        data: connections,
        count: connections.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/wallets/address/:address/:chainId
 * Get wallet by address
 */
router.get(
  "/address/:address/:chainId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wallet = await getWalletByAddress(
        req.params.address,
        parseInt(req.params.chainId)
      );

      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: "Wallet not found",
        });
      }

      res.json({
        success: true,
        data: wallet,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/wallets/:id/disconnect
 * Disconnect wallet
 */
router.post(
  "/:id/disconnect",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await disconnectWallet(req.params.id);

      res.json({
        success: true,
        message: "Wallet disconnected",
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== BALANCE ENDPOINTS ====================

/**
 * POST /api/wallets/:id/sync-balances
 * Sync wallet balances from blockchain
 */
router.post(
  "/:id/sync-balances",
  walletValidation.syncWalletBalances,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await syncWalletBalances(
        req.params.id,
        req.body.balances
      );

      res.json({
        success: true,
        message: "Balances synced successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/wallets/:id/portfolio
 * Get wallet portfolio (all balances)
 */
router.get(
  "/:id/portfolio",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const portfolio = await getWalletPortfolio(req.params.id);

      res.json({
        success: true,
        data: portfolio,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== TRANSACTION ENDPOINTS ====================

/**
 * POST /api/wallets/:id/send
 * Queue transaction - PHASE 1: Requires wallet signature
 */
router.post(
  "/:id/send",
  walletValidation.queueTransaction,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const walletId = req.params.id;
      const { 
        toAddress, 
        amount, 
        tokenSymbol, 
        description,
        walletAddress,      // PHASE 1: Wallet address (used for signature verification)
        signature,           // PHASE 1: EIP-191 signed message
        nonce                // PHASE 1: Nonce for replay protection
      } = req.body;

      // PHASE 1 FIX: Verify wallet ownership via signature
      if (!walletAddress || !signature || nonce === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Transaction requires wallet signature for security. Please sign the transaction with your wallet.'
        });
      }

      // Create message for signing (includes nonce to prevent replay)
      const message = `Send ${amount} ${tokenSymbol} to ${toAddress}\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;

      // Verify the signature matches the wallet address
      const isValidSignature = await verifyWalletSignature(walletAddress, message, signature);
      if (!isValidSignature) {
        return res.status(401).json({
          success: false,
          message: 'Wallet signature verification failed. Transaction rejected.'
        });
      }

      // Verify nonce hasn't been used before (prevent replay)
      if (!verifyAndIncrementNonce(walletAddress, nonce)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired nonce. Please generate a new transaction.'
        });
      }

      // Queue the transaction
      const queueId = await queueTransaction(
        walletId,
        toAddress,
        amount.toString(),
        tokenSymbol,
        description
      );

      console.log(`[AUDIT] Transaction queued for wallet ${walletAddress} by user ${(req.user as any)?.id}`);

      res.status(201).json({
        success: true,
        data: { queueId },
        message: "Transaction queued successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/wallets/:id/transactions
 * Get wallet transactions
 */
router.get(
  "/:id/transactions",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;

      const transactions = await getWalletTransactions(
        req.params.id,
        limit,
        offset
      );

      res.json({
        success: true,
        data: transactions,
        pagination: { limit, offset, count: transactions.length },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/wallets/tx/:txHash
 * Get transaction by hash
 */
router.get(
  "/tx/:txHash",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transaction = await getTransactionByHash(req.params.txHash);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: "Transaction not found",
        });
      }

      res.json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== VERIFICATION ENDPOINTS ====================

/**
 * POST /api/wallets/:id/verify
 * Verify wallet ownership
 */
router.post(
  "/:id/verify",
  walletValidation.verifyWallet,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const verified = await verifyWalletOwnership(
        req.params.id,
        req.body.signature
      );

      res.json({
        success: true,
        data: { verified },
        message: "Wallet verified successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== NETWORK ENDPOINTS ====================

/**
 * GET /api/wallets/networks/supported
 * Get supported blockchain networks
 */
router.get(
  "/networks/supported",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const networks = await getSupportedNetworks();

      res.json({
        success: true,
        data: networks,
        count: networks.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/wallets/networks/:chainId/tokens
 * Get tokens for network
 */
router.get(
  "/networks/:chainId/tokens",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await getNetworkTokens(parseInt(req.params.chainId));

      res.json({
        success: true,
        data: tokens,
        count: tokens.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== ADMIN ENDPOINTS ====================

/**
 * GET /api/wallets/queue/pending
 * Get pending transaction queue
 * Admin only
 */
router.get(
  "/admin/queue/pending",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: "Admin access required",
        });
      }

      const queue = await getTransactionQueue("pending", 100);

      res.json({
        success: true,
        data: queue,
        count: queue.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
