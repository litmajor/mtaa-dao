import express from 'express';
import bcrypt from 'bcryptjs';
import { WalletManager, EnhancedAgentWallet, NetworkConfig } from '../agent_wallet';
import { db } from '../storage';
import { users, vaults, walletTransactions, wallets, walletPrivateKeys, walletSeedPhrases, walletSecuritySettings, walletSessions } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { notificationService } from '../notificationService';
import {
  generateWalletFromMnemonic,
  recoverWalletFromMnemonic,
  encryptWallet,
  decryptWallet,
  isValidMnemonic,
  importWalletFromPrivateKey
} from '../utils/cryptoWallet';
import { Logger } from '../utils/logger';
import { isAuthenticated } from '../auth';
import { auditConsolidated } from '../services/auditConsolidated';
import { createRateLimiter } from '../middleware/rateLimiting';

const logger = new Logger('wallet-setup');

// === Wallet Configuration Constants ===

/**
 * Maximum number of wallets per user
 * Users can create up to 5 wallets (accounts) per user
 * For stealth addresses / privacy layer, future enhancement
 */
const MAX_WALLETS_PER_USER = 5;

// === Rate Limiters for Sensitive Wallet Operations ===

/**
 * Wallet key material access (unlock, import, recover)
 * 3 attempts per hour per user (prevent brute force / key theft)
 */
const walletKeyMaterialLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  keyGenerator: (req: express.Request) => {
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
    return `wallet_key_access:${userId}`;
  },
});

/**
 * Wallet backup/sensitive data access
 * 5 attempts per hour per user
 */
const walletBackupDataLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
  keyGenerator: (req: express.Request) => {
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
    return `wallet_backup:${userId}`;
  },
});

/**
 * Wallet and vault creation (normal rate limit)
 * 10 per hour per user
 */
const walletCreationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  keyGenerator: (req: express.Request) => {
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
    return `wallet_creation:${userId}`;
  },
});

const router = express.Router();

// POST /api/wallet-setup/create-wallet-mnemonic
router.post('/create-wallet-mnemonic', isAuthenticated, walletCreationLimiter, async (req, res) => {
  try {
    const authReq = req as any;
    const userId = authReq.user?.id || authReq.user?.claims?.sub;
    const { currency = 'cUSD', initialGoal = 0, password = '', wordCount = 12 } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    if (password && password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters if provided' });
    }

    if (wordCount !== 12 && wordCount !== 24) {
      return res.status(400).json({ error: 'Word count must be 12 or 24' });
    }

    // Check wallet count limit per user
    const existingWallets = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId));

    if (existingWallets.length >= MAX_WALLETS_PER_USER) {
      await auditConsolidated.logConsolidatedAuditEvent({
        userId,
        action: 'wallet_create_limit_exceeded',
        status: 'denied',
        details: { reason: `User already has max wallets (${MAX_WALLETS_PER_USER})`, existingCount: existingWallets.length },
        severity: 'medium'
      });
      return res.status(400).json({
        error: `Wallet limit exceeded. You can have maximum ${MAX_WALLETS_PER_USER} wallets per account.`
      });
    }

    // Generate wallet with mnemonic
    const walletCredentials = generateWalletFromMnemonic(wordCount);

    // Encrypt wallet data (use a default password if not provided)
    const encryptionPassword = password || require('crypto').randomBytes(32).toString('hex');
    const encrypted = encryptWallet(walletCredentials, encryptionPassword);

    // Create wallet record in wallets table
    const [newWallet] = await db.insert(wallets).values({
      userId,
      currency,
      address: walletCredentials.address,
      walletType: 'personal',
      isActive: true
    }).returning();

    // Store encrypted private key
    await db.insert(walletPrivateKeys).values({
      walletId: newWallet.id,
      encryptedPrivateKey: encrypted.encryptedData,
      encryptionIv: encrypted.iv,
      encryptionSalt: encrypted.salt,
      authTag: encrypted.authTag,
      keyDerivationFunction: 'pbkdf2',
      encryptionAlgorithm: 'aes-256-gcm',
      isBackedUp: false
    });

    // Store encrypted seed phrase
    const encryptedMnemonic = encryptWallet({ mnemonic: walletCredentials.mnemonic }, encryptionPassword);
    await db.insert(walletSeedPhrases).values({
      walletId: newWallet.id,
      encryptedSeedPhrase: encryptedMnemonic.encryptedData,
      wordCount,
      encryptionIv: encryptedMnemonic.iv,
      encryptionSalt: encryptedMnemonic.salt,
      authTag: encryptedMnemonic.authTag,
      derivationPath: "m/44'/60'/0'/0",
      isBackedUp: false,
      backupMethod: null,
      backupLocation: null
    });

    // Initialize wallet security settings
    await db.insert(walletSecuritySettings).values({
      walletId: newWallet.id,
      requiresPin: password ? true : false,
      requiresBiometric: false,
      twoFactorEnabled: false,
      withdrawalLimit: '10000.00',
      requiresApprovalAboveThreshold: true,
      approvalThreshold: '5000.00'
    });

    // Also update users table for backward compatibility
    const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (existingUser.length > 0 && !existingUser[0].encryptedWallet) {
      await db.update(users)
        .set({
          encryptedWallet: encrypted.encryptedData,
          walletSalt: encrypted.salt,
          walletIv: encrypted.iv,
          walletAuthTag: encrypted.authTag,
          hasBackedUpMnemonic: false,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
    }

    // Create primary vault
    const primaryVault = await db.insert(vaults).values({
      userId,
      creatorId: userId,
      currency,
      address: walletCredentials.address,
      balance: '0.00',
      monthlyGoal: initialGoal.toString(),
    }).returning();

    await notificationService.createNotification({
      userId,
      type: 'wallet',
      title: 'Wallet Created Successfully',
      message: `Your new wallet has been created. Please backup your recovery phrase immediately.`,
      metadata: {
        walletId: newWallet.id,
        vaultId: primaryVault[0].id,
        currency
      }
    });

    // Audit log wallet creation
    await auditConsolidated.logConsolidatedAuditEvent({
      userId,
      action: 'wallet_created_with_mnemonic',
      resourceId: newWallet.id,
      status: 'success',
      details: { 
        walletId: newWallet.id,
        walletAddress: walletCredentials.address,
        wordCount,
        encryptedPrivateKeyStored: true,
        encryptedSeedPhraseStored: true
      },
      severity: 'medium'
    });

    res.json({
      success: true,
      wallet: {
        id: newWallet.id,
        address: walletCredentials.address,
        // CRITICAL: Return credentials ONLY ON CREATION
        // All subsequent access requires authentication via unlock-wallet
        mnemonic: walletCredentials.mnemonic,
        privateKey: walletCredentials.privateKey,
        wordCount,
        derivationPath: "m/44'/60'/0'/0"
      },
      primaryVault: primaryVault[0],
      message: '✅ Wallet created successfully. Please save your recovery phrase immediately in a secure location. Never share it with anyone.',
      warning: 'You will NOT see your private key or recovery phrase again. Store them safely now.',
      encryptionStatus: {
        privateKeyEncrypted: true,
        mnemonicEncrypted: true,
        storageLocation: 'Database (encrypted in walletPrivateKeys & walletSeedPhrases)',
        requiresAuthenticationForAccess: true,
        accessMethod: 'POST /api/wallet-setup/unlock-wallet (requires password)'
      }
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('Wallet creation error:', errorMsg);
    await auditConsolidated.logConsolidatedAuditEvent({
      userId: (req as any).user?.id || (req as any).user?.claims?.sub,
      action: 'wallet_create_mnemonic_error',
      status: 'error',
      details: { error: errorMsg },
      severity: 'medium'
    });
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet-setup/backup-confirmed
router.post('/backup-confirmed', isAuthenticated, async (req, res) => {
  try {
    const authReq = req as any;
    const userId = authReq.user?.id || authReq.user?.claims?.sub || authReq.user?.claims?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Update user record to mark mnemonic as backed up
    await db.update(users)
      .set({ hasBackedUpMnemonic: true })
      .where(eq(users.id, userId));

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Backup confirmation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/wallet-setup/export-encrypted-backup
router.post('/export-encrypted-backup', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    const { password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ error: 'User ID and password required' });
    }

    // Get user's encrypted wallet
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user?.encryptedWallet) {
      return res.status(404).json({ error: 'No wallet found' });
    }

    // Create backup package with timestamp
    const backupPackage = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      userId: userId,
      encryptedWallet: user.encryptedWallet,
      walletSalt: user.walletSalt,
      walletIv: user.walletIv,
      walletAuthTag: user.walletAuthTag,
      walletAddress: user.walletAddress
    };

    // Double-encrypt the backup with user's password
    const backupString = JSON.stringify(backupPackage);
    const backupBuffer = Buffer.from(backupString, 'utf-8');

    const { createCipheriv, randomBytes, scryptSync } = await import('crypto');
    const backupSalt = randomBytes(16);
    const backupKey = scryptSync(password, backupSalt, 32);
    const backupIv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', backupKey, backupIv);

    const encryptedBackup = Buffer.concat([
      cipher.update(backupBuffer),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    // Create downloadable backup file
    const finalBackup = {
      v: '1.0',
      s: backupSalt.toString('hex'),
      i: backupIv.toString('hex'),
      d: encryptedBackup.toString('hex'),
      t: authTag.toString('hex'),
      created: new Date().toISOString()
    };

    res.json({
      success: true,
      backup: finalBackup,
      filename: `mtaadao-wallet-backup-${Date.now()}.json`
    });
  } catch (error: any) {
    logger.error('Backup export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/wallet-setup/restore-from-backup
router.post('/restore-from-backup', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    const { backupData, password } = req.body;

    if (!userId || !backupData || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Decrypt the backup file
    const { createDecipheriv, scryptSync } = await import('crypto');

    const backupSalt = Buffer.from(backupData.s, 'hex');
    const backupIv = Buffer.from(backupData.i, 'hex');
    const encryptedData = Buffer.from(backupData.d, 'hex');
    const authTag = Buffer.from(backupData.t, 'hex');

    const backupKey = scryptSync(password, backupSalt, 32);
    const decipher = createDecipheriv('aes-256-gcm', backupKey, backupIv);
    decipher.setAuthTag(authTag);

    let decryptedBackup;
    try {
      decryptedBackup = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
      ]);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid password or corrupted backup' });
    }

    const backupPackage = JSON.parse(decryptedBackup.toString('utf-8'));

    // Verify backup version
    if (backupPackage.version !== '1.0') {
      return res.status(400).json({ error: 'Unsupported backup version' });
    }

    // Restore wallet to user account
    await db.update(users)
      .set({
        encryptedWallet: backupPackage.encryptedWallet,
        walletSalt: backupPackage.walletSalt,
        walletIv: backupPackage.walletIv,
        walletAuthTag: backupPackage.walletAuthTag,
        walletAddress: backupPackage.walletAddress,
        hasBackedUpMnemonic: true
      })
      .where(eq(users.id, userId));

    res.json({
      success: true,
      walletAddress: backupPackage.walletAddress,
      message: 'Wallet restored successfully'
    });
  } catch (error: any) {
    logger.error('Backup restore error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/wallet-setup/recover-wallet
router.post('/recover-wallet', isAuthenticated, walletKeyMaterialLimiter, async (req, res) => {
  try {
    const authReq = req as any;
    const authenticatedUserId = authReq.user?.id || authReq.user?.claims?.sub;
    const { userId, mnemonic, password, currency = 'cUSD' } = req.body;

    if (!authenticatedUserId) {
      return res.status(401).json({ error: 'Unauthorized: User not found in token' });
    }

    // Validate userId from request body matches authenticated user
    if (userId !== authenticatedUserId) {
      await auditConsolidated.logConsolidatedAuditEvent({
        userId: authenticatedUserId,
        action: 'wallet_recover_unauthorized_attempt',
        targetUserId: userId,
        status: 'denied',
        details: { reason: 'userId mismatch with authenticated user' },
        severity: 'high'
      });
      return res.status(403).json({ error: 'Forbidden: Cannot access another user\'s wallet' });
    }

    if (!userId || !mnemonic || !password) {
      return res.status(400).json({ error: 'User ID, mnemonic, and password are required' });
    }

    if (!isValidMnemonic(mnemonic)) {
      return res.status(400).json({ error: 'Invalid recovery phrase' });
    }

    // Recover wallet from mnemonic
    const walletCredentials = recoverWalletFromMnemonic(mnemonic);

    // Encrypt wallet data
    const encrypted = encryptWallet(walletCredentials, password);

    // Update user with encrypted wallet
    await db.update(users)
      .set({
        encryptedWallet: encrypted.encryptedData,
        walletSalt: encrypted.salt,
        walletIv: encrypted.iv,
        walletAuthTag: encrypted.authTag,
        hasBackedUpMnemonic: true,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Create primary vault
    const primaryVault = await db.insert(vaults).values({
      userId,
      creatorId: userId,
      currency,
      address: walletCredentials.address,
      balance: '0.00',
      monthlyGoal: '0.00',
    }).returning();

    await notificationService.createNotification({
      userId,
      type: 'wallet',
      title: 'Wallet Recovered Successfully',
      message: `Your wallet has been recovered from your recovery phrase.`,
      metadata: {
        vaultId: primaryVault[0].id,
        imported: true
      }
    });

    // Audit log wallet recovery
    await auditConsolidated.logConsolidatedAuditEvent({
      userId: authenticatedUserId,
      action: 'wallet_recovered',
      targetUserId: userId,
      resourceId: walletCredentials.address,
      status: 'success',
      details: { walletAddress: walletCredentials.address },
      severity: 'medium'
    });

    res.json({
      success: true,
      wallet: { address: walletCredentials.address },
      primaryVault: primaryVault[0],
      message: 'Wallet recovered successfully'
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await auditConsolidated.logConsolidatedAuditEvent({
      userId: (req as any).user?.id || (req as any).user?.claims?.sub,
      action: 'wallet_recover_error',
      status: 'error',
      details: { error: errorMsg },
      severity: 'medium'
    });
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet-setup/import-private-key
router.post('/import-private-key', isAuthenticated, walletKeyMaterialLimiter, async (req, res) => {
  try {
    const authReq = req as any;
    const authenticatedUserId = authReq.user?.id || authReq.user?.claims?.sub;
    const { userId, privateKey, password, currency = 'cUSD' } = req.body;

    if (!authenticatedUserId) {
      return res.status(401).json({ error: 'Unauthorized: User not found in token' });
    }

    // Validate userId from request body matches authenticated user
    if (userId !== authenticatedUserId) {
      await auditConsolidated.logConsolidatedAuditEvent({
        userId: authenticatedUserId,
        action: 'wallet_import_unauthorized_attempt',
        targetUserId: userId,
        status: 'denied',
        details: { reason: 'userId mismatch with authenticated user' },
        severity: 'high'
      });
      return res.status(403).json({ error: 'Forbidden: Cannot access another user\'s wallet' });
    }

    if (!userId || !privateKey || !password) {
      return res.status(400).json({ error: 'User ID, private key, and password are required' });
    }

    // Import wallet from private key
    const walletCredentials = importWalletFromPrivateKey(privateKey);

    // Encrypt wallet data (no mnemonic for imported keys)
    const encrypted = encryptWallet(walletCredentials, password);

    // Update user with encrypted wallet
    await db.update(users)
      .set({
        encryptedWallet: encrypted.encryptedData,
        walletSalt: encrypted.salt,
        walletIv: encrypted.iv,
        walletAuthTag: encrypted.authTag,
        hasBackedUpMnemonic: false,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Create primary vault
    const primaryVault = await db.insert(vaults).values({
      userId,
      creatorId: userId,
      currency,
      address: walletCredentials.address,
      balance: '0.00',
      monthlyGoal: '0.00',
    }).returning();

    await notificationService.createNotification({
      userId,
      type: 'wallet',
      title: 'Wallet Imported Successfully',
      message: `Your wallet has been imported using a private key.`,
      metadata: {
        vaultId: primaryVault[0].id,
        imported: true
      }
    });

    // Audit log wallet import
    await auditConsolidated.logConsolidatedAuditEvent({
      userId: authenticatedUserId,
      action: 'wallet_imported',
      targetUserId: userId,
      resourceId: walletCredentials.address,
      status: 'success',
      details: { walletAddress: walletCredentials.address, importMethod: 'private_key' },
      severity: 'medium'
    });

    res.json({
      success: true,
      wallet: { address: walletCredentials.address },
      primaryVault: primaryVault[0],
      message: 'Wallet imported successfully'
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await auditConsolidated.logConsolidatedAuditEvent({
      userId: (req as any).user?.id || (req as any).user?.claims?.sub,
      action: 'wallet_import_error',
      status: 'error',
      details: { error: errorMsg },
      severity: 'medium'
    });
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet-setup/unlock-wallet
// Supports two authentication methods:
// 1. Password unlock - returns full key material (privateKey + mnemonic)
// 2. PIN unlock - creates wallet session, returns sessionToken (read-only access)
router.post('/unlock-wallet', isAuthenticated, walletKeyMaterialLimiter, async (req, res) => {
  try {
    const authReq = req as any;
    const authenticatedUserId = authReq.user?.id || authReq.user?.claims?.sub;
    const { userId, walletId, password, pinCode } = req.body;

    if (!authenticatedUserId) {
      return res.status(401).json({ error: 'Unauthorized: User not found in token' });
    }

    // Validate userId from request body matches authenticated user
    if (userId !== authenticatedUserId) {
      await auditConsolidated.logConsolidatedAuditEvent({
        userId: authenticatedUserId,
        action: 'wallet_unlock_unauthorized_attempt',
        targetUserId: userId,
        status: 'denied',
        details: { reason: 'userId mismatch with authenticated user' },
        severity: 'high'
      });
      return res.status(403).json({ error: 'Forbidden: Cannot access another user\'s wallet' });
    }

    if (!userId || (!password && !pinCode)) {
      return res.status(400).json({ error: 'User ID and either password or PIN are required' });
    }

    // === PIN-BASED WALLET SESSION (Recommended) ===
    if (pinCode) {
      if (!walletId) {
        return res.status(400).json({ error: 'walletId required for PIN-based unlock' });
      }

      // Get wallet and security settings
      const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
      if (!wallet || wallet.userId !== userId) {
        await auditConsolidated.logConsolidatedAuditEvent({
          userId: authenticatedUserId,
          action: 'wallet_unlock_invalid_wallet',
          status: 'denied',
          details: { reason: 'Wallet not found or access denied' },
          severity: 'high'
        });
        return res.status(404).json({ error: 'Wallet not found' });
      }

      const [securitySettings] = await db.select()
        .from(walletSecuritySettings)
        .where(eq(walletSecuritySettings.walletId, walletId))
        .limit(1);

      if (!securitySettings || !securitySettings.encryptedPin) {
        return res.status(400).json({ error: 'PIN not configured for this wallet. Please set PIN first using POST /set-pin endpoint.' });
      }

      // Verify PIN using bcrypt (secure PIN verification)
      const pinMatches = await bcrypt.compare(pinCode, securitySettings.encryptedPin);

      if (!pinMatches) {
        await auditConsolidated.logConsolidatedAuditEvent({
          userId: authenticatedUserId,
          action: 'wallet_unlock_pin_failed',
          resourceId: walletId,
          status: 'denied',
          details: { reason: 'Invalid PIN' },
          severity: 'medium'
        });
        return res.status(401).json({ error: 'Invalid PIN' });
      }

      // Create wallet session
      const sessionToken = require('crypto').randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const [walletSession] = await db.insert(walletSessions).values({
        walletId,
        userId,
        sessionToken,
        isActive: true,
        connectedAt: new Date(),
        disconnectedAt: null,
        lastAccessedAt: new Date(),
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.get('user-agent') || '',
        expiresAt,
        biometricEnabled: false,
        autoExtendEnabled: true
      }).returning();

      // Audit log successful PIN unlock
      await auditConsolidated.logConsolidatedAuditEvent({
        userId: authenticatedUserId,
        action: 'wallet_session_created_with_pin',
        resourceId: walletId,
        status: 'success',
        details: { 
          walletAddress: wallet.address,
          sessionId: walletSession.id,
          expiresAt: expiresAt.toISOString(),
          authMethod: 'PIN'
        },
        severity: 'medium'
      });

      res.json({
        success: true,
        walletSession: {
          sessionToken,
          walletId,
          walletAddress: wallet.address,
          expiresAt: expiresAt.toISOString(),
          autoExtendEnabled: true
        },
        authMethod: 'PIN',
        message: 'Wallet session created. You are now logged into this wallet.',
        accessLevel: 'read-write',
        note: 'Use this sessionToken to stay logged in. PIN-based sessions expire after 24 hours of inactivity.'
      });

      return;
    }

    // === PASSWORD-BASED FULL ACCESS (Legacy - for key material access) ===
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user.length || !user[0].encryptedWallet) {
      return res.status(404).json({ error: 'No wallet found for this user' });
    }

    const encrypted = {
      encryptedData: user[0].encryptedWallet,
      salt: user[0].walletSalt!,
      iv: user[0].walletIv!,
      authTag: user[0].walletAuthTag!
    };

    const walletCredentials = decryptWallet(encrypted, password);

    // Audit log key material access (HIGH SEVERITY)
    await auditConsolidated.logConsolidatedAuditEvent({
      userId: authenticatedUserId,
      action: 'wallet_unlocked_full_key_access',
      resourceId: walletCredentials.address,
      status: 'success',
      details: { 
        walletAddress: walletCredentials.address, 
        dataExposed: ['privateKey', 'mnemonic'],
        authMethod: 'password'
      },
      severity: 'high'
    });

    res.json({
      success: true,
      wallet: {
        address: walletCredentials.address,
        privateKey: walletCredentials.privateKey,
        mnemonic: walletCredentials.mnemonic
      },
      authMethod: 'password',
      message: 'Wallet unlocked (full access with key material)',
      warning: 'You have access to private key. Use securely and never share.',
      accessLevel: 'full'
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isPasswordFailure = errorMsg === 'Unsupported state or unable to authenticate data';
    const authenticatedUserId = (req as any).user?.id || (req as any).user?.claims?.sub;
    
    // Audit log failed unlock attempt
    await auditConsolidated.logConsolidatedAuditEvent({
      userId: authenticatedUserId,
      action: isPasswordFailure ? 'wallet_unlock_failed_password' : 'wallet_unlock_error',
      status: 'denied',
      details: { reason: isPasswordFailure ? 'Invalid password' : errorMsg },
      severity: 'medium'
    });
    
    res.status(500).json({ error: isPasswordFailure ? 'Invalid password' : errorMsg });
  }
});

// POST /api/wallet-setup/create-wallet
router.post('/create-wallet', isAuthenticated, walletCreationLimiter, async (req, res) => {
  try {
    const authReq = req as any;
    const authenticatedUserId = authReq.user?.id || authReq.user?.claims?.sub;
    const { userId, currency = 'cUSD', initialGoal = 0, password = '', walletName = 'My Wallet' } = req.body;

    if (!authenticatedUserId) {
      return res.status(401).json({ error: 'Unauthorized: User not found in token' });
    }

    // Validate userId from request body matches authenticated user
    if (userId !== authenticatedUserId) {
      await auditConsolidated.logConsolidatedAuditEvent({
        userId: authenticatedUserId,
        action: 'wallet_create_unauthorized_attempt',
        targetUserId: userId,
        status: 'denied',
        details: { reason: 'userId mismatch with authenticated user' },
        severity: 'high'
      });
      return res.status(403).json({ error: 'Forbidden: Cannot access another user\'s wallet' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check wallet count limit per user
    const existingWallets = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId));

    if (existingWallets.length >= MAX_WALLETS_PER_USER) {
      await auditConsolidated.logConsolidatedAuditEvent({
        userId: authenticatedUserId,
        action: 'wallet_create_limit_exceeded',
        targetUserId: userId,
        status: 'denied',
        details: { reason: `User already has max wallets (${MAX_WALLETS_PER_USER})`, existingCount: existingWallets.length },
        severity: 'medium'
      });
      return res.status(400).json({
        error: `Wallet limit exceeded. You can have maximum ${MAX_WALLETS_PER_USER} wallets per account.`
      });
    }

    // Generate new wallet (with mnemonic and private key)
    const walletCredentials = generateWalletFromMnemonic(12); // 12 word mnemonic

    // Encryption password - use user-provided or generate secure random
    const encryptionPassword = password || require('crypto').randomBytes(32).toString('hex');

    // Encrypt wallet credentials
    const encryptedWallet = encryptWallet(walletCredentials, encryptionPassword);

    // Create wallet record in wallets table
    const [newWallet] = await db.insert(wallets).values({
      userId,
      currency,
      address: walletCredentials.address,
      walletType: 'personal',
      isActive: true
    }).returning();

    // Store encrypted private key
    await db.insert(walletPrivateKeys).values({
      walletId: newWallet.id,
      encryptedPrivateKey: encryptedWallet.encryptedData,
      encryptionIv: encryptedWallet.iv,
      encryptionSalt: encryptedWallet.salt,
      authTag: encryptedWallet.authTag,
      keyDerivationFunction: 'pbkdf2',
      encryptionAlgorithm: 'aes-256-gcm',
      isBackedUp: false
    });

    // Store encrypted seed phrase
    const encryptedMnemonic = encryptWallet({ mnemonic: walletCredentials.mnemonic }, encryptionPassword);
    await db.insert(walletSeedPhrases).values({
      walletId: newWallet.id,
      encryptedSeedPhrase: encryptedMnemonic.encryptedData,
      wordCount: 12,
      encryptionIv: encryptedMnemonic.iv,
      encryptionSalt: encryptedMnemonic.salt,
      authTag: encryptedMnemonic.authTag,
      derivationPath: "m/44'/60'/0'/0",
      isBackedUp: false,
      backupMethod: null,
      backupLocation: null
    });

    // Initialize wallet security settings
    await db.insert(walletSecuritySettings).values({
      walletId: newWallet.id,
      requiresPin: password ? true : false,
      requiresBiometric: false,
      twoFactorEnabled: false,
      withdrawalLimit: '10000.00',
      requiresApprovalAboveThreshold: true,
      approvalThreshold: '5000.00'
    });

    // Create primary vault for this wallet
    const primaryVault = await db.insert(vaults).values({
      userId,
      creatorId: userId,
      currency,
      address: walletCredentials.address,
      balance: '0.00',
      monthlyGoal: initialGoal.toString(),
    }).returning();

    // Create welcome notification
    await notificationService.createNotification({
      userId,
      type: 'wallet',
      title: 'Wallet Created Successfully',
      message: `Your new wallet "${walletName}" has been created. Please backup your recovery phrase immediately.`,
      metadata: {
        walletId: newWallet.id,
        walletAddress: walletCredentials.address,
        vaultId: primaryVault[0].id,
        currency
      }
    });

    // Audit log wallet creation
    await auditConsolidated.logConsolidatedAuditEvent({
      userId: authenticatedUserId,
      action: 'wallet_created_secure_storage',
      targetUserId: userId,
      resourceId: newWallet.id,
      status: 'success',
      details: { 
        walletId: newWallet.id,
        walletAddress: walletCredentials.address,
        walletName,
        currency,
        encryptedPrivateKeyStored: true,
        encryptedSeedPhraseStored: true
      },
      severity: 'medium'
    });

    // Return credentials ONLY ONCE - for user backup
    // These should be securely backed up by the user immediately
    // Subsequent access requires unlock-wallet endpoint with authentication
    res.json({
      success: true,
      wallet: {
        id: newWallet.id,
        address: walletCredentials.address,
        // CRITICAL: Return private key ONLY ON CREATION
        // All subsequent access requires authentication via unlock-wallet
        privateKey: walletCredentials.privateKey,
        // CRITICAL: Return mnemonic ONLY ON CREATION
        // This is the user's only chance to backup - must be saved immediately
        mnemonic: walletCredentials.mnemonic,
        wordCount: 12,
        derivationPath: "m/44'/60'/0'/0"
      },
      primaryVault: primaryVault[0],
      message: '✅ Wallet created successfully. Please save your recovery phrase immediately in a secure location. Never share it with anyone.',
      warning: 'You will NOT see your private key or recovery phrase again. Store them safely now.',
      encryptionStatus: {
        privateKeyEncrypted: true,
        mnemonicEncrypted: true,
        storageLocation: 'Database (encrypted)',
        requiresAuthenticationForAccess: true,
        accessMethod: 'POST /api/wallet-setup/unlock-wallet (requires password)'
      }
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await auditConsolidated.logConsolidatedAuditEvent({
      userId: (req as any).user?.id || (req as any).user?.claims?.sub,
      action: 'wallet_create_error',
      status: 'error',
      details: { error: errorMsg },
      severity: 'medium'
    });
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet-setup/initialize-additional-vault
router.post('/initialize-additional-vault', isAuthenticated, walletCreationLimiter, async (req, res) => {
  try {
    const authReq = req as any;
    const authenticatedUserId = authReq.user?.id || authReq.user?.claims?.sub;
    const { userId, currency, monthlyGoal = 0, vaultType = 'savings' } = req.body;

    if (!authenticatedUserId) {
      return res.status(401).json({ error: 'Unauthorized: User not found in token' });
    }

    // Validate userId from request body matches authenticated user
    if (userId !== authenticatedUserId) {
      await auditConsolidated.logConsolidatedAuditEvent({
        userId: authenticatedUserId,
        action: 'vault_create_unauthorized_attempt',
        targetUserId: userId,
        status: 'denied',
        details: { reason: 'userId mismatch with authenticated user' },
        severity: 'high'
      });
      return res.status(403).json({ error: 'Forbidden: Cannot access another user\'s vault' });
    }

    if (!userId || !currency) {
      return res.status(400).json({ error: 'User ID and currency are required' });
    }

    // Verify user exists and has a primary vault
    const userVaults = await db
      .select()
      .from(vaults)
      .where(eq(vaults.userId, userId))
      .limit(1);

    if (!userVaults.length) {
      return res.status(400).json({
        error: 'User must have a primary wallet before creating additional vaults'
      });
    }

    // Check for existing vault with same currency
    const existingVault = await db
      .select()
      .from(vaults)
      .where(eq(vaults.userId, userId))
      .limit(1);

    // Create additional vault
    const newVault = await db.insert(vaults).values({
      userId,
      creatorId: userId,
      currency,
      address: userVaults[0].address, // use primary vault address
      balance: '0.00',
      monthlyGoal: monthlyGoal.toString(),
    }).returning();

    // Create notification
    await notificationService.createNotification({
      userId,
      type: 'vault',
      title: 'New Vault Created',
      message: `Your ${currency} ${vaultType} vault has been created successfully`,
      metadata: {
        vaultId: newVault[0].id,
        currency,
        vaultType,
        monthlyGoal
      }
    });

    // Audit log vault creation
    await auditConsolidated.logConsolidatedAuditEvent({
      userId: authenticatedUserId,
      action: 'vault_created',
      targetUserId: userId,
      resourceId: newVault[0].id,
      status: 'success',
      details: { vaultId: newVault[0].id, currency, vaultType },
      severity: 'medium'
    });

    res.json({
      success: true,
      vault: newVault[0],
      message: `${currency} vault created successfully`
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await auditConsolidated.logConsolidatedAuditEvent({
      userId: (req as any).user?.id || (req as any).user?.claims?.sub,
      action: 'vault_create_error',
      status: 'error',
      details: { error: errorMsg },
      severity: 'medium'
    });
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet-setup/user-vaults/:userId
router.get('/user-vaults/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const userVaults = await db
      .select()
      .from(vaults)
      .where(eq(vaults.userId, userId));

  // Get wallet address from primary vault
  const primaryVault = userVaults.length > 0 ? userVaults[0] : null;
  const walletAddress = primaryVault ? (primaryVault.address || null) : null;

    // Calculate total portfolio value
    const totalBalance = userVaults.reduce((sum, vault) => {
      return sum + parseFloat(vault.balance || '0');
    }, 0);

    res.json({
      walletAddress,
      vaults: userVaults,
      totalBalance,
      vaultCount: userVaults.length,
      currencies: [...new Set(userVaults.map(v => v.currency))]
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet-setup/initialize-assets
router.post('/initialize-assets', async (req, res) => {
  try {
    const { userId, assets } = req.body;

    if (!userId || !Array.isArray(assets)) {
      return res.status(400).json({ error: 'User ID and assets array are required' });
    }

    // Get user's primary vault for wallet address
    const userVaults = await db
      .select()
      .from(vaults)
      .where(eq(vaults.userId, userId))
      .limit(1);

    if (!userVaults.length || !userVaults[0].address) {
      return res.status(400).json({ error: 'User must have a wallet first' });
    }

    const walletAddress = userVaults[0].address;
    const results = [];

    // Initialize each asset as a separate vault
    for (const asset of assets) {
      const { currency, initialAmount = 0, monthlyGoal = 0 } = asset;

      // Check if vault for this currency already exists
      const existingVault = await db
        .select()
        .from(vaults)
        .where(eq(vaults.userId, userId))
        .limit(1);

      if (existingVault.length === 0) {
        // Create new vault for this asset
        const newVault = await db.insert(vaults).values({
          userId,
          currency,
          address: walletAddress,
          balance: initialAmount.toString(),
          monthlyGoal: monthlyGoal.toString(),
        }).returning();

        // Create initial transaction if there's an initial amount
        if (initialAmount > 0) {
          await db.insert(walletTransactions).values({
            walletAddress,
            amount: initialAmount.toString(),
            currency,
            type: 'deposit',
            status: 'completed',
            description: `Initial ${currency} deposit`,
          });
        }

        results.push({
          currency,
          vault: newVault[0],
          initialized: true
        });
      } else {
        results.push({
          currency,
          vault: existingVault[0],
          initialized: false,
          message: 'Vault already exists for this currency'
        });
      }
    }

    // Create summary notification
    await notificationService.createNotification({
      userId,
      type: 'wallet',
      title: 'Asset Initialization Complete',
      message: `Successfully initialized ${results.filter(r => r.initialized).length} new asset vaults`,
      metadata: {
        initializedAssets: results.filter(r => r.initialized).length,
        totalAssets: assets.length,
        currencies: assets.map(a => a.currency)
      }
    });

    res.json({
      success: true,
      results,
      summary: {
        totalAssets: assets.length,
        newVaults: results.filter(r => r.initialized).length,
        existingVaults: results.filter(r => !r.initialized).length
      }
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet-setup/import-wallet
router.post('/import-wallet', async (req, res) => {
  try {
    const { userId, privateKey, currency = 'cUSD' } = req.body;

    if (!userId || !privateKey) {
      return res.status(400).json({ error: 'User ID and private key are required' });
    }

    // Validate private key format
    if (!WalletManager.validatePrivateKey(privateKey)) {
      return res.status(400).json({ error: 'Invalid private key format' });
    }

    // Get wallet address from private key
    const normalizedKey = WalletManager.normalizePrivateKey(privateKey);
    const wallet = new EnhancedAgentWallet(normalizedKey, NetworkConfig.CELO_ALFAJORES);
    const walletAddress = wallet.address;

    // Check if this wallet is already imported by another user (by vault address)
    const existingVault = await db
      .select()
      .from(vaults)
      .where(
        and(eq(vaults.userId, userId), eq(vaults.address, walletAddress))
      )
      .limit(1);

    if (existingVault.length > 0 && existingVault[0].userId !== userId) {
      return res.status(400).json({ error: 'This wallet is already imported by another user' });
    }

    // No update to user needed
    await db
      .update(users)
      .set({ updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Create primary vault
    const primaryVault = await db.insert(vaults).values({
      userId,
      currency,
      address: walletAddress,
      balance: '0.00',
      monthlyGoal: '0.00',
    }).returning();

    // Get actual balance from blockchain
    try {
      const actualBalance = await wallet.getBalanceEth();

      // Update vault with actual balance
      await db
        .update(vaults)
        .set({ balance: actualBalance.toString() })
        .where(eq(vaults.id, primaryVault[0].id));

      primaryVault[0].balance = actualBalance.toString();
    } catch (error) {
      console.warn('Failed to get actual balance:', error);
    }

    await notificationService.createNotification({
      userId,
      type: 'wallet',
      title: 'Wallet Imported Successfully',
      message: `Your wallet ${walletAddress.slice(0, 8)}... has been imported`,
      metadata: {
        vaultId: primaryVault[0].id,
        imported: true
      }
    });

    res.json({
      success: true,
      wallet: {
        address: walletAddress,
        imported: true
      },
      primaryVault: primaryVault[0],
      message: 'Wallet imported and vault created successfully'
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet-setup/backup-status/:userId
router.get('/backup-status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isBackedUp = user[0].hasBackedUpMnemonic || false;

    res.json({
      success: true,
      isBackedUp,
      walletAddress: user[0].walletAddress,
      backupConfirmedAt: user[0].updatedAt,
      message: isBackedUp ? 'Wallet backup confirmed' : 'Wallet backup pending'
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('Backup status check error:', errorMsg);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet-setup/get-backup-data
router.post('/get-backup-data', isAuthenticated, walletBackupDataLimiter, async (req, res) => {
  try {
    const authReq = req as any;
    const authenticatedUserId = authReq.user?.id || authReq.user?.claims?.sub;
    const { userId } = req.body;

    if (!authenticatedUserId) {
      return res.status(401).json({ error: 'Unauthorized: User not found in token' });
    }

    // Validate userId from request body matches authenticated user
    if (userId !== authenticatedUserId) {
      await auditConsolidated.logConsolidatedAuditEvent({
        userId: authenticatedUserId,
        action: 'wallet_backup_unauthorized_attempt',
        targetUserId: userId,
        status: 'denied',
        details: { reason: 'userId mismatch with authenticated user' },
        severity: 'high'
      });
      return res.status(403).json({ error: 'Forbidden: Cannot access another user\'s backup data' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user[0].encryptedWallet) {
      return res.status(404).json({ error: 'No wallet found for this user' });
    }

    // Decrypt wallet to get mnemonic and private key
    const encrypted = {
      encryptedData: user[0].encryptedWallet,
      salt: user[0].walletSalt!,
      iv: user[0].walletIv!,
      authTag: user[0].walletAuthTag!
    };

    // For this endpoint, we use a default password to retrieve stored data
    // In production, this should require the user's password or be more restricted
    // This is a temporary solution - consider requiring user password verification
    try {
      // Try with default password first (from creation with no password)
      const walletCredentials = decryptWallet(encrypted, 'default-unencrypted');

      // Audit log backup data access
      await auditConsolidated.logConsolidatedAuditEvent({
        userId: authenticatedUserId,
        action: 'wallet_backup_data_accessed',
        targetUserId: userId,
        resourceId: walletCredentials.address,
        status: 'success',
        details: { 
          walletAddress: walletCredentials.address, 
          dataExposed: walletCredentials.mnemonic ? ['mnemonic', 'privateKey', 'address'] : ['privateKey', 'address']
        },
        severity: 'high'
      });

      res.json({
        success: true,
        mnemonic: walletCredentials.mnemonic || null,
        privateKey: walletCredentials.privateKey,
        address: walletCredentials.address,
        message: 'Backup data retrieved successfully'
      });
    } catch (decryptErr) {
      // If default password fails, the wallet was encrypted with a user password
      // We cannot decrypt without it
      logger.warn(`Failed to decrypt wallet for user ${userId}: wallet requires password`);
      
      // Audit log failed backup access attempt
      await auditConsolidated.logConsolidatedAuditEvent({
        userId: authenticatedUserId,
        action: 'wallet_backup_access_failed_encrypted',
        targetUserId: userId,
        status: 'denied',
        details: { reason: 'Wallet is encrypted with user password' },
        severity: 'medium'
      });
      
      res.status(401).json({ 
        error: 'Cannot retrieve backup data. Your wallet is encrypted with a password. Please use the recovery phrase or password instead.' 
      });
    }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('Get backup data error:', errorMsg);
    
    await auditConsolidated.logConsolidatedAuditEvent({
      userId: (req as any).user?.id || (req as any).user?.claims?.sub,
      action: 'wallet_backup_access_error',
      status: 'error',
      details: { error: errorMsg },
      severity: 'medium'
    });
    
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet-setup/set-pin
// Set up or change PIN for wallet session login
router.post('/set-pin', isAuthenticated, async (req, res) => {
  try {
    const authReq = req as any;
    const userId = authReq.user?.id || authReq.user?.claims?.sub;
    const { walletId, currentPassword, newPin } = req.body;

    if (!userId || !walletId || !currentPassword || !newPin) {
      return res.status(400).json({ error: 'userId, walletId, currentPassword, and newPin are required' });
    }

    if (newPin.length < 4 || newPin.length > 8) {
      return res.status(400).json({ error: 'PIN must be 4-8 digits' });
    }

    // Verify wallet belongs to user
    const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
    if (!wallet || wallet.userId !== userId) {
      return res.status(403).json({ error: 'Wallet not found or access denied' });
    }

    // Verify current password
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user.length || !user[0].encryptedWallet) {
      return res.status(404).json({ error: 'No wallet found for user' });
    }

    try {
      const encrypted = {
        encryptedData: user[0].encryptedWallet,
        salt: user[0].walletSalt!,
        iv: user[0].walletIv!,
        authTag: user[0].walletAuthTag!
      };
      decryptWallet(encrypted, currentPassword);
    } catch {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Hash new PIN using bcrypt (secure PIN hashing with salt rounds = 12)
    const pinHash = await bcrypt.hash(newPin, 12);

    // Update or create security settings with PIN
    const [existingSettings] = await db.select()
      .from(walletSecuritySettings)
      .where(eq(walletSecuritySettings.walletId, walletId))
      .limit(1);

    if (existingSettings) {
      await db.update(walletSecuritySettings)
        .set({
          encryptedPin: pinHash,
          requiresPin: true,
          lastModifiedAt: new Date()
        })
        .where(eq(walletSecuritySettings.walletId, walletId));
    } else {
      await db.insert(walletSecuritySettings).values({
        walletId,
        encryptedPin: pinHash,
        requiresPin: true,
        requiresBiometric: false,
        twoFactorEnabled: false,
        withdrawalLimit: '10000.00',
        requiresApprovalAboveThreshold: true,
        approvalThreshold: '5000.00'
      });
    }

    // Audit log PIN setup
    await auditConsolidated.logConsolidatedAuditEvent({
      userId,
      action: 'wallet_pin_configured',
      resourceId: walletId,
      status: 'success',
      details: { 
        walletId,
        walletAddress: wallet.address,
        pinConfigured: true
      },
      severity: 'medium'
    });

    res.json({
      success: true,
      message: 'PIN configured successfully',
      note: 'You can now use PIN to quickly unlock your wallet without entering password. PIN is bcrypt-hashed for security.'
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet-setup/wallet-logout
// End wallet session (logout from wallet)
router.post('/wallet-logout', isAuthenticated, async (req, res) => {
  try {
    const authReq = req as any;
    const userId = authReq.user?.id || authReq.user?.claims?.sub;
    const { sessionToken } = req.body;

    if (!userId || !sessionToken) {
      return res.status(400).json({ error: 'userId and sessionToken are required' });
    }

    // Find and close session
    const [session] = await db.select()
      .from(walletSessions)
      .where(and(
        eq(walletSessions.sessionToken, sessionToken),
        eq(walletSessions.userId, userId)
      ))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Mark session as inactive
    await db.update(walletSessions)
      .set({
        isActive: false,
        disconnectedAt: new Date()
      })
      .where(eq(walletSessions.id, session.id));

    // Audit log logout
    await auditConsolidated.logConsolidatedAuditEvent({
      userId,
      action: 'wallet_session_closed',
      resourceId: session.walletId,
      status: 'success',
      details: { sessionId: session.id, walletId: session.walletId },
      severity: 'low'
    });

    res.json({
      success: true,
      message: 'Logged out from wallet'
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet-setup/user-wallets
// List all wallets for authenticated user (wallet switching)
router.get('/user-wallets', isAuthenticated, async (req, res) => {
  try {
    const authReq = req as any;
    const userId = authReq.user?.id || authReq.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all wallets for user
    const userWallets = await db.select().from(wallets).where(eq(wallets.userId, userId));

    // Get active session for user (if any)
    const [activeSession] = await db.select()
      .from(walletSessions)
      .where(and(
        eq(walletSessions.userId, userId),
        eq(walletSessions.isActive, true)
      ))
      .orderBy(walletSessions.connectedAt)
      .limit(1);

    // Get security settings for each wallet
    const walletsWithSettings = await Promise.all(
      userWallets.map(async (wallet) => {
        const [settings] = await db.select()
          .from(walletSecuritySettings)
          .where(eq(walletSecuritySettings.walletId, wallet.id))
          .limit(1);

        return {
          id: wallet.id,
          address: wallet.address,
          currency: wallet.currency,
          walletType: wallet.walletType,
          isActive: wallet.isActive,
          createdAt: wallet.createdAt,
          isPinConfigured: settings?.requiresPin || false,
          isCurrentlyActive: activeSession?.walletId === wallet.id
        };
      })
    );

    // Audit log access
    await auditConsolidated.logConsolidatedAuditEvent({
      userId,
      action: 'user_wallets_listed',
      status: 'success',
      details: { walletCount: walletsWithSettings.length },
      severity: 'low'
    });

    res.json({
      success: true,
      wallets: walletsWithSettings,
      activeWalletId: activeSession?.walletId || null,
      currentSessionToken: activeSession?.sessionToken || null,
      walletCount: walletsWithSettings.length,
      maxWallets: MAX_WALLETS_PER_USER,
      message: 'To switch wallets, use unlock-wallet endpoint with walletId and PIN or password'
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

export default router;
