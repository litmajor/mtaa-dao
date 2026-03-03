/**
 * 2FA and PIN Verification Routes
 * Endpoints for withdrawal verification using 2FA and PIN
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { twoFAService } from '../services/two-fa-service';
import { pinService } from '../services/pin-service';
import { walletGenerationService } from '../services/wallet-generation-service';
import { withdrawalSigningService } from '../services/withdrawal-signing-service';
import { db } from '../db';
import { wallets } from '@shared/schema';
import { eq } from 'drizzle-orm';

export const router = Router();
export const twoFARouter = Router();
export const pinRouter = Router();

/**
 * GET /config
 * Get current 2FA configuration
 */
router.get('/config', authenticateToken as any, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id as string;

    // Get user's primary wallet
    const userWallets = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!userWallets[0]) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
      });
    }

    const walletId = userWallets[0].id;

    // Get 2FA config
    const config = await twoFAService.get2FAConfig(userId);
    const isPINRequired = await pinService.isPINRequired(walletId);
    const isPINConfigured = await pinService.isPINConfigured(walletId);

    res.json({
      success: true,
      config: {
        twoFA: config,
        pin: {
          required: isPINRequired,
          configured: isPINConfigured,
        },
      },
    });
  } catch (error) {
    console.error('Error getting 2FA config:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /setup
 * Enable 2FA for withdrawal verification
 */
router.post('/setup', authenticateToken as any, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { method, destination } = req.body;

    // Validate method
    if (!['SMS', 'EMAIL', 'AUTHENTICATOR'].includes(method)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid 2FA method. Must be SMS, EMAIL, or AUTHENTICATOR',
      });
    }

    // Enable 2FA
    const result = await twoFAService.enable2FA(userId, method);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Send OTP if SMS or EMAIL
    if ((method === 'SMS' || method === 'EMAIL') && destination) {
      // Create initial OTP for setup verification
      const otpResult = await twoFAService.createWithdrawalOTP(userId);

      if (otpResult.success && otpResult.otpId) {
        // In production, send OTP via SMS or email
        console.log(`📱 Setup OTP sent via ${method}`);
      }
    }

    res.json({
      success: true,
      message: `2FA enabled via ${method}`,
      backupCodes: result.backupCodes,
      method,
    });
  } catch (error) {
    console.error('Error setting up 2FA:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /generate
 * Generate OTP for withdrawal
 */
router.post('/generate', authenticateToken as any, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id as string;

    // Check if 2FA is enabled
    const isEnabled = await twoFAService.is2FAEnabled(userId);

    if (!isEnabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is not enabled for this account',
      });
    }

    // Generate OTP
    const result = await twoFAService.createWithdrawalOTP(userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Get 2FA method to determine delivery method
    const config = await twoFAService.get2FAConfig(userId);

    // Send OTP via configured method
    if (config?.config?.method) {
      const sendResult = await twoFAService.send2FAOTP(
        userId,
        result.otpId!,
        config.config.method as any,
        '' // destination would come from user profile
      );

      if (!sendResult.success) {
        console.warn('Failed to send 2FA OTP:', sendResult.error);
      }
    }

    res.json({
      success: true,
      otpId: result.otpId,
      message: 'OTP generated. Check your configured 2FA method.',
      expiresIn: 300, // 5 minutes
    });
  } catch (error) {
    console.error('Error generating OTP:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /verify
 * Verify 2FA code
 */
router.post('/verify', authenticateToken as any, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { otpId, code, useBackupCode } = req.body;

    if (!otpId || !code) {
      return res.status(400).json({
        success: false,
        error: 'OTP ID and code are required',
      });
    }

    let verifyResult;

    if (useBackupCode) {
      // Verify backup code instead
      verifyResult = await twoFAService.verifyBackupCode(userId, code);
    } else {
      // Verify regular OTP
      verifyResult = await twoFAService.verifyWithdrawalOTP(userId, otpId, code);
    }

    if (!verifyResult.success) {
      return res.status(400).json(verifyResult);
    }

    res.json({
      success: true,
      message: 'OTP verified successfully',
      verificationToken: `otp_verified_${userId}_${Date.now()}`, // Used for withdrawal
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /pin/setup
 * Setup PIN for wallet
 */
router.post('/pin/setup', authenticateToken as any, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { pin, currentPin } = req.body;

    if (!pin) {
      return res.status(400).json({
        success: false,
        error: 'PIN is required',
      });
    }

    // Get user's primary wallet
    const userWallets = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!userWallets[0]) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
      });
    }

    const walletId = userWallets[0].id;

    // Set PIN
    const result = await pinService.setPIN(walletId, pin, currentPin);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Error setting PIN:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /requirements
 * Get PIN requirements
 */
router.get('/requirements', authenticateToken as any, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id as string;

    // Get user's primary wallet
    const userWallets = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!userWallets[0]) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
      });
    }

    const walletId = userWallets[0].id;

    // Get PIN requirements
    const result = await pinService.getPINRequirements(walletId);

    res.json(result);
  } catch (error) {
    console.error('Error getting PIN requirements:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /pin/verify
 * Verify PIN for withdrawal
 */
router.post('/pin/verify', authenticateToken as any, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({
        success: false,
        error: 'PIN is required',
      });
    }

    // Get user's primary wallet
    const userWallets = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!userWallets[0]) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
      });
    }

    const walletId = userWallets[0].id;

    // Verify PIN
    const result = await pinService.verifyPINForTransaction(walletId, pin, 'withdrawal');

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: result.message,
      verificationToken: `pin_verified_${userId}_${Date.now()}`,
    });
  } catch (error) {
    console.error('Error verifying PIN:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /verify-withdrawal
 * Create withdrawal with 2FA/PIN verification
 */
router.post('/verify-withdrawal', authenticateToken as any, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const {
      accountId,
      toAddress,
      amount,
      currency,
      otpId,
      otpCode,
      pin,
      useBackupCode,
    } = req.body;

    // Validate required fields
    if (!toAddress || !amount || !currency) {
      return res.status(400).json({
        success: false,
        error: 'toAddress, amount, and currency are required',
      });
    }

    // Get user's wallet
    const userWallets = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!userWallets[0]) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
      });
    }

    const walletId = userWallets[0].id;

    // Step 1: Verify 2FA if enabled
    const is2FAEnabled = await twoFAService.is2FAEnabled(userId);

    if (is2FAEnabled) {
      if (!otpId || !otpCode) {
        // First request - need to generate OTP
        if (req.body.step === 1) {
          const otpResult = await twoFAService.createWithdrawalOTP(userId);

          if (!otpResult.success) {
            return res.status(400).json(otpResult);
          }

          return res.json({
            success: true,
            step: 2,
            message: 'OTP generated. Please verify.',
            otpId: otpResult.otpId,
          });
        }

        return res.status(400).json({
          success: false,
          error: 'OTP verification required',
        });
      }

      // Verify OTP
      let verifyResult;

      if (useBackupCode) {
        verifyResult = await twoFAService.verifyBackupCode(userId, otpCode);
      } else {
        verifyResult = await twoFAService.verifyWithdrawalOTP(userId, otpId, otpCode);
      }

      if (!verifyResult.success) {
        return res.status(400).json(verifyResult);
      }
    }

    // Step 2: Verify PIN if configured
    const isPINRequired = await pinService.isPINRequired(walletId);

    if (isPINRequired) {
      if (!pin) {
        return res.status(400).json({
          success: false,
          error: 'PIN verification required',
        });
      }

      const pinResult = await pinService.verifyPINForTransaction(
        walletId,
        pin,
        'withdrawal'
      );

      if (!pinResult.success) {
        return res.status(400).json(pinResult);
      }
    }

    // Step 3: Prepare withdrawal for signing
    const prepareResult = await withdrawalSigningService.prepareWithdrawalForSigning(
      userId,
      accountId!,
      toAddress,
      toAddress,
      amount,
      currency
    );

    if (!prepareResult.success) {
      return res.status(400).json(prepareResult);
    }

    // Step 4: Sign withdrawal transaction
    const signResult = await withdrawalSigningService.signWithdrawalTransaction(
      userId,
      walletId,
      prepareResult.withdrawalId!,
      prepareResult.transaction!
    );

    if (!signResult.success) {
      return res.status(400).json(signResult);
    }

    // Step 5: Execute signed withdrawal
    const executeResult = await withdrawalSigningService.executeSignedWithdrawal(
      userId,
      prepareResult.withdrawalId!,
      signResult.signedTransaction!.raw
    );

    if (!executeResult.success) {
      return res.status(400).json(executeResult);
    }

    res.json({
      success: true,
      message: 'Withdrawal initiated successfully',
      transactionHash: executeResult.transactionHash,
      withdrawalId: prepareResult.withdrawalId,
    });
  } catch (error) {
    console.error('Error processing verified withdrawal:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /pin/disable
 * Disable PIN requirement
 */
router.post('/pin/disable', authenticateToken as any, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({
        success: false,
        error: 'Current PIN is required to disable PIN',
      });
    }

    // Get user's wallet
    const userWallets = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!userWallets[0]) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
      });
    }

    const walletId = userWallets[0].id;

    // Disable PIN
    const result = await pinService.disablePIN(walletId, pin);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Error disabling PIN:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

export const setupWithdrawalVerificationRoutes = (app: any) => {
  app.use(router);
};
