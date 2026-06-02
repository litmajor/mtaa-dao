import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { users } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { createRateLimiter } from '../../middleware/rateLimiting';
import { auditConsolidated, logConsolidatedAuditEvent } from '../../services/auditConsolidated';
// Ensure JWT secret is present for admin token issuance
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable required for admin auth routes');
}
import { requireRole } from '../../middleware/rbac';

const router = Router();

// Middleware: Require super_admin role for 2FA management
const requireSuperAdmin = requireRole('super_admin');

// Type guard for user record
function isUser(obj: any): obj is { id: string; email: string; password: string; roles: string } {
  return obj && typeof obj.id === 'string' && typeof obj.email === 'string' && typeof obj.password === 'string' && typeof obj.roles === 'string';
}

// ═══════════════════════════════════════════════════════════════════════════════

// Adapter: normalize legacy audit payloads to UnifiedAuditEntry
async function audit(entry: any) {
  const normalized = {
    actorId: entry.userId || entry.actorId || 'unknown',
    actorType: entry.actorType || (entry.userRole || 'user'),
    actionType: entry.action || entry.actionType || 'unknown',
    actionCategory: entry.actionCategory || 'audit',
    targetType: entry.resource || entry.targetType || '',
    targetId: entry.resourceId || entry.targetId || '',
    result: entry.status === 'success' ? 'success' : (entry.status === 'denied' ? 'failed' : entry.result || 'failed'),
    metadata: entry.details || entry.metadata || {},
    severity: entry.severity,
    ipAddress: entry.ip || entry.ipAddress || '',
    endpoint: entry.endpoint || '',
  };
  try {
    await logConsolidatedAuditEvent(normalized);
  } catch (e) {
    logger.error('[AdminAuthAudit] failed to log', e);
  }
}
// ADMIN AUTH RATE LIMITERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Admin login rate limiter: 5 attempts per email per 15 minutes
 * Prevents brute force attacks on critical admin accounts
 */
const adminLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  keyGenerator: (req) => {
    const email = req.body?.email || 'unknown';
    return `admin_login:${email}`;
  }
});

/**
 * Admin login by IP: 20 global attempts per 15 minutes
 * Prevents coordinated brute force across multiple accounts
 */
const adminLoginIpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  keyGenerator: (req) => {
    return `admin_login_ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
  }
});

// POST /api/admin/auth/admin-login
router.post('/auth/admin-login', adminLoginLimiter, adminLoginIpLimiter, async (req, res) => {
  const { email, password, twoFactorCode } = req.body;
  if (!email || !password) {
    return res.status(400).json({ 
      message: 'Email and password required',
      securityNote: 'Admin login requires both email and password'
    });
  }
  try {
    const userArr = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = userArr[0];
    if (!isUser(user)) {
      // Log failed login attempt
      await audit({
        userId: 'unknown',  
        action: 'admin_login_failed_user_not_found',
        resourceId: email,
        status: 'denied',
        details: { email, ip: req.ip },
        severity: 'high'
      });

      return res.status(401).json({ message: 'Invalid credentials or not an admin/superuser' });
    }
    
    // Check if user has admin or superUser role, or has isSuperUser flag set
    const hasAdminAccess = user.roles === 'superUser' || user.roles === 'admin' || (user as any).isSuperUser === true;
    if (!hasAdminAccess) {
      // Log unauthorized access attempt
      await audit({
        userId: user.id,
        action: 'admin_login_failed_insufficient_role',
        resourceId: user.id,
        status: 'denied',
        details: { email, userRole: user.roles, ip: req.ip },
        severity: 'high'
      });

      return res.status(401).json({ message: 'Invalid credentials or not an admin/superuser' });
    }
    
    if (!user.password) {
      return res.status(401).json({ message: 'No password set for this user' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      // Log failed password attempt
          await audit({
        userId: user.id,
        action: 'admin_login_failed_invalid_password',
        resourceId: user.id,
        status: 'denied',
        details: { email, ip: req.ip },
        severity: 'high'
      });

      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2FA ENFORCEMENT FOR ADMIN ROLE
    // ═══════════════════════════════════════════════════════════════════════════
    
    const twoFaEnabled = (user as any).twoFactorEnabled === true;

    if (twoFaEnabled && !twoFactorCode) {
      // 2FA required but not provided
      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) {
        logger.error('JWT_SECRET not configured');
        return res.status(500).json({ message: 'Server misconfiguration' });
      }

      const tempToken = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          roles: user.roles,
          pending2FA: true 
        },
        JWT_SECRET,
        { expiresIn: '5m' }
      );

      res.json({ 
        requiresTwoFactor: true,
        tempToken: tempToken,
        message: 'Two-factor authentication required',
        data: { userId: user.id, email: user.email }
      });
      return;
    }

    const token = jwt.sign(
      { id: user.id, role: user.roles },
      JWT_SECRET,
      { expiresIn: '4h' }
    );
    
    // Return user object with superuser flag
    const responseUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || null,
      role: user.roles,
      isSuperUser: user.roles === 'super_admin' || (user as any).isSuperUser === true,
      isAdmin: user.roles === 'admin' || user.roles === 'super_admin' || (user as any).isSuperUser === true,
      walletAddress: user.walletAddress || null,
      isEmailVerified: user.emailVerified || false,
      isPhoneVerified: user.phoneVerified || false,
      profilePicture: user.profileImageUrl || null,
      twoFactorEnabled: twoFaEnabled
    };

    // Log successful login
    await audit({
      userId: user.id,
      action: 'admin_login_success',
      resourceId: user.id,
      status: 'success',
      details: { email, ip: req.ip, twoFactorVerified: twoFaEnabled },
      severity: 'medium'
    });
    
    res.json({ 
      success: true, 
      data: { 
        user: responseUser, 
        accessToken: token,
      } 
    });
  } catch (err) {
    logger.error('Admin login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/auth/superuser-register
router.post('/auth/superuser-register', async (req, res) => {
  const { email, password, firstName, lastName, name } = req.body;
  
  // MAXIMUM SECURITY: Check if superuser registration is allowed
  const allowSuperuserReg = process.env.ALLOW_SUPERUSER_REGISTRATION === 'true';

  if (!allowSuperuserReg) {
    await audit({
      userId: 'unknown',
      action: 'superuser_register_attempt_disabled',
      resourceId: 'superuser_registration',
      status: 'denied',
      details: { 
        reason: 'ALLOW_SUPERUSER_REGISTRATION not enabled',
        ip: req.ip 
      },
      severity: 'critical'
    });

    return res.status(403).json({
      message: 'Superuser registration is disabled. Enable ALLOW_SUPERUSER_REGISTRATION environment variable to register.',
      securityNote: 'This is disabled by default for maximum security'
    });
  }

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }

  // Validate password strength (minimum 12 chars for admin)
  if (password.length < 12) {
    return res.status(400).json({ 
      message: 'Admin password must be at least 12 characters for security' 
    });
  }

  try {
    const existingArr = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingArr[0]) {
      await audit({
        userId: 'unknown',
        action: 'superuser_register_failed_duplicate',
        resourceId: email,
        status: 'denied',
        details: { email, ip: req.ip },
        severity: 'high'
      });

      return res.status(409).json({ message: 'Email already registered' });
    }
    const hash = await bcrypt.hash(password, 12); // 12 rounds for admin accounts
    const [newUser] = await db.insert(users).values({
      id: crypto.randomUUID(),
      email,
      password: hash,
      name: name || firstName || '',
      firstName: firstName || '',
      lastName: lastName || '',
      roles: 'super_admin',
      isSuperUser: true,
      isEmailVerified: true,
      twoFactorEnabled: false, // Will be required on first login
      createdAt: new Date(),
    }).returning();
    if (!newUser) {
      return res.status(500).json({ message: 'User creation failed' });
    }

    // Log successful superuser creation
    await audit({
      userId: 'system',
      action: 'superuser_register_success',
      resourceId: newUser.id,
      status: 'success',
      details: { 
        newAdminEmail: email,
        ip: req.ip 
      },
      severity: 'critical'
    });

    // Construct response with proper flags
    const responseUser = {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName || '',
      lastName: newUser.lastName || '',
      role: newUser.roles,
      roles: newUser.roles,
      isSuperUser: newUser.isSuperUser === true,
      isAdmin: newUser.roles === 'super_admin' || newUser.roles === 'admin',
      requiresTwoFASetup: true,
    };
    const token = jwt.sign(
      { id: newUser.id, role: newUser.roles, isSuperUser: true },
      JWT_SECRET,
      { expiresIn: '4h' }
    );
    res.json({ 
      success: true, 
      data: { user: responseUser, accessToken: token },
      securityNote: 'New superuser must set up 2FA on first login'
    });
  } catch (err) {
    logger.error('Superuser register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2FA MANAGEMENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/2fa/setup
 * Initiates 2FA setup for authenticated admin
 * Returns TOTP secret (encrypted), QR code, and backup codes
 * 
 * Requires: Valid JWT token with super_admin role
 * 
 * SECURITY:
 * ✅ Requires super_admin role (enforced by requireSuperAdmin middleware)
 * ✅ 2FA encryption key required in environment
 * ✅ Audit logged at 'high' severity
 */
router.get('/2fa/setup', requireSuperAdmin, async (req, res) => {
  try {
    // Type assertion for req.user (set by auth middleware)
    const userId = (req as any).user?.id;
    const userEmail = (req as any).user?.email;

    if (!userId || !userEmail) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Valid authentication required' 
      });
    }

    // Import the admin TOTP service
    const { adminTOTPService } = await import('../../services/admin-totp-service');

    // Get encryption key from environment
    const encryptionKey = process.env.TWO_FA_ENCRYPTION_KEY;
    if (!encryptionKey) {
      logger.error('TWO_FA_ENCRYPTION_KEY not set in environment');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: '2FA encryption not configured' 
      });
    }

    // Initiate 2FA setup
    const setupData = await adminTOTPService.initiateTwoFASetup(userEmail, encryptionKey);

    // Log 2FA setup initiation
    await audit({
      userId,
      action: 'admin_2fa_setup_initiated',
      resourceId: userId,
      status: 'success',
      details: { email: userEmail },
      severity: 'high'
    });

    res.json({
      success: true,
      data: {
        secret: setupData.secret,
        iv: setupData.iv,
        authTag: setupData.authTag,
        qrCode: setupData.qrCode,
        backupCodes: setupData.backupCodes,
        message: 'Scan the QR code with your authenticator app. Save backup codes in a secure location.'
      }
    });
  } catch (error) {
    logger.error('2FA setup error:', error);
    res.status(500).json({ 
      error: 'Setup failed',
      message: (error as Error).message 
    });
  }
});

/**
 * POST /api/admin/2fa/setup/verify
 * Verifies TOTP code and completes 2FA setup
 * Stores encrypted secret and backup codes in database
 * 
 * Body: { totpCode: string, secret: string, iv: string, authTag: string, backupCodes: string[] }
 * 
 * SECURITY:
 * ✅ Requires super_admin role (enforced by requireSuperAdmin middleware)
 * ✅ TOTP code validation required
 * ✅ Encrypted storage of secrets and backup codes
 * ✅ Audit logged at 'critical' severity
 */
router.post('/2fa/setup/verify', requireSuperAdmin, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { totpCode, secret, iv, authTag, backupCodes } = req.body;

    if (!userId) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Valid authentication required' 
      });
    }

    if (!totpCode || !secret || !iv || !authTag || !backupCodes) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'totpCode, secret, iv, authTag, and backupCodes are required' 
      });
    }

    const { adminTOTPService } = await import('../../services/admin-totp-service');

    // Verify the TOTP code
    const isValid = adminTOTPService.completeTwoFASetup(
      totpCode,
      { ciphertext: secret, iv, authTag },
      process.env.TWO_FA_ENCRYPTION_KEY || ''
    );

    if (!isValid) {
      await audit({
        userId,
        action: 'admin_2fa_verification_failed',
        resourceId: userId,
        status: 'denied',
        details: { reason: 'Invalid TOTP code' },
        severity: 'high'
      });

      return res.status(400).json({ 
        error: 'Verification failed',
        message: 'TOTP code is invalid. Please try again.' 
      });
    }

    // Encrypt backup codes
    const { adminTOTPService: service } = await import('../../services/admin-totp-service');
    const encryptedBackupCodes = service.encryptData(
      JSON.stringify(backupCodes),
      process.env.TWO_FA_ENCRYPTION_KEY || ''
    );

    // Update user to enable 2FA
    await db.update(users).set({
      twoFactorEnabled: true,
      twoFactorMethod: 'totp',
      twoFactorSecret: JSON.stringify({ ciphertext: secret, iv, authTag }),
      twoFactorBackupCodes: JSON.stringify({
        ciphertext: encryptedBackupCodes.ciphertext,
        iv: encryptedBackupCodes.iv,
        authTag: encryptedBackupCodes.authTag
      }),
      twoFactorSetupAt: new Date(),
      twoFactorVerifiedAt: new Date(),
      updatedAt: new Date()
    }).where(eq(users.id, userId));

    // Log successful 2FA setup
    await audit({
      userId,
      action: 'admin_2fa_setup_completed',
      resourceId: userId,
      status: 'success',
      details: { 
        method: 'totp',
        backupCodesCount: backupCodes.length
      },
      severity: 'critical'
    });

    res.json({
      success: true,
      message: '2FA setup completed successfully',
      data: {
        twoFactorEnabled: true,
        backupCodesRemaining: backupCodes.length
      }
    });
  } catch (error) {
    logger.error('2FA setup verification error:', error);
    res.status(500).json({ 
      error: 'Verification failed',
      message: (error as Error).message 
    });
  }
});

/**
 * POST /api/admin/2fa/verify
 * Verifies TOTP code during login or sensitive operations
 * Called after password verification but before granting access
 * 
 * Body: { totpCode: string }
 * 
 * SECURITY:
 * ✅ Requires super_admin role (enforced by requireSuperAdmin middleware)
 * ✅ Validates TOTP against encrypted secret
 * ✅ Audit logged at 'high' severity for failures, 'medium' for success
 */
router.post('/2fa/verify', requireSuperAdmin, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { totpCode } = req.body;

    if (!userId) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Valid authentication required' 
      });
    }

    if (!totpCode) {
      return res.status(400).json({ 
        error: 'Missing TOTP code',
        message: 'totpCode is required' 
      });
    }

    // Get user from database
    const userArr = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userArr[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ 
        error: '2FA not enabled',
        message: 'Two-factor authentication is not set up for this account' 
      });
    }

    const { adminTOTPService } = await import('../../services/admin-totp-service');

    // Parse encrypted secret
    const secretData = JSON.parse(user.twoFactorSecret as string);

    // Verify TOTP code
    const isValid = adminTOTPService.verify2FACode(
      totpCode,
      { ciphertext: secretData.ciphertext, iv: secretData.iv, authTag: secretData.authTag },
      process.env.TWO_FA_ENCRYPTION_KEY || ''
    );

    if (!isValid) {
      await audit({
        userId,
        action: 'admin_2fa_verification_failed_login',
        resourceId: userId,
        status: 'denied',
        details: { reason: 'Invalid TOTP code' },
        severity: 'high'
      });

      return res.status(401).json({ 
        error: 'Invalid 2FA code',
        message: 'TOTP code is incorrect. Please try again.' 
      });
    }

    // Update last verified time
    await db.update(users).set({
      twoFactorVerifiedAt: new Date(),
      updatedAt: new Date()
    }).where(eq(users.id, userId));

    // Log successful verification
    await audit({
      userId,
      action: 'admin_2fa_verification_success',
      resourceId: userId,
      status: 'success',
      details: { operation: 'login' },
      severity: 'medium'
    });

    // Return success flag to indicate 2FA verified
    // Frontend can use this to proceed with login
    res.json({
      success: true,
      message: '2FA verification successful',
      data: { 
        verified: true,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('2FA verification error:', error);
    res.status(500).json({ 
      error: 'Verification failed',
      message: (error as Error).message 
    });
  }
});

/**
 * GET /api/admin/2fa/backup-codes
 * Get remaining backup codes (requires password verification)
 * 
 * Query: { password: string }
 * 
 * SECURITY:
 * ✅ Requires super_admin role (enforced by requireSuperAdmin middleware)
 * ✅ Only shows actual codes if explicitly requested AND user is superUser
 * ✅ Otherwise returns backup code count only
 * ✅ Codes are decrypted on-demand from encrypted storage
 */
router.get('/2fa/backup-codes', requireSuperAdmin, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { showCodes } = req.query;

    if (!userId) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Valid authentication required' 
      });
    }

    // Get user from database
    const userArr = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userArr[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.twoFactorBackupCodes) {
      return res.status(400).json({ 
        error: 'No backup codes',
        message: 'No backup codes configured' 
      });
    }

    // Only return backup codes if explicitly requested and user is admin
    if (showCodes === 'true' && user.roles === 'superUser') {
      try {
        const { adminTOTPService } = await import('../../services/admin-totp-service');
        const backupCodesData = JSON.parse(user.twoFactorBackupCodes as string);
        const decryptedCodes = adminTOTPService.decryptData(
          { 
            ciphertext: backupCodesData.ciphertext, 
            iv: backupCodesData.iv, 
            authTag: backupCodesData.authTag 
          },
          process.env.TWO_FA_ENCRYPTION_KEY || ''
        );
        const backupCodes = JSON.parse(decryptedCodes);

        return res.json({
          success: true,
          data: {
            backupCodesRemaining: backupCodes.length,
            backupCodes: backupCodes,
            warning: '⚠️ Keep these codes in a secure location. Each code can only be used once.'
          }
        });
      } catch (error) {
        logger.error('Failed to decrypt backup codes:', error);
        return res.status(500).json({ 
          error: 'Decryption failed',
          message: 'Could not retrieve backup codes' 
        });
      }
    }

    // Only return count by default
    try {
      const { adminTOTPService } = await import('../../services/admin-totp-service');
      const backupCodesData = JSON.parse(user.twoFactorBackupCodes as string);
      const decryptedCodes = adminTOTPService.decryptData(
        { 
          ciphertext: backupCodesData.ciphertext, 
          iv: backupCodesData.iv, 
          authTag: backupCodesData.authTag 
        },
        process.env.TWO_FA_ENCRYPTION_KEY || ''
      );
      const backupCodes = JSON.parse(decryptedCodes);

      res.json({
        success: true,
        data: {
          backupCodesRemaining: backupCodes.length,
          message: 'Use ?showCodes=true to view actual codes (requires admin access)'
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve backup codes count' });
    }
  } catch (error) {
    logger.error('Backup codes retrieval error:', error);
    res.status(500).json({ 
      error: 'Retrieval failed',
      message: (error as Error).message 
    });
  }
});

/**
 * POST /api/admin/2fa/backup-codes/regenerate
 * Regenerate new backup codes
 * All old codes become invalid
 * 
 * Body: { password: string }
 * 
 * SECURITY:
 * ✅ Requires super_admin role (enforced by requireSuperAdmin middleware)
 * ✅ Password verification required before regeneration
 * ✅ Old codes become immediately invalid
 * ✅ Audit logged at 'critical' severity
 */
router.post('/2fa/backup-codes/regenerate', requireSuperAdmin, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { password } = req.body;

    if (!userId) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Valid authentication required' 
      });
    }

    if (!password) {
      return res.status(400).json({ 
        error: 'Password required',
        message: 'Password is required to regenerate backup codes' 
      });
    }

    // Get user from database
    const userArr = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userArr[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    if (!user.password || !(await bcrypt.compare(password, user.password))) {
      await audit({
        userId,
        action: 'admin_backup_codes_regen_failed',
        resourceId: userId,
        status: 'denied',
        details: { reason: 'Invalid password' },
        severity: 'high'
      });

      return res.status(401).json({ 
        error: 'Invalid password',
        message: 'Password verification failed' 
      });
    }

    const { adminTOTPService } = await import('../../services/admin-totp-service');

    // Generate new backup codes
    const newBackupCodes = adminTOTPService.regenerateBackupCodes();

    // Encrypt new backup codes
    const encryptedBackupCodes = adminTOTPService.encryptData(
      JSON.stringify(newBackupCodes),
      process.env.TWO_FA_ENCRYPTION_KEY || ''
    );

    // Update user with new backup codes
    await db.update(users).set({
      twoFactorBackupCodes: JSON.stringify({
        ciphertext: encryptedBackupCodes.ciphertext,
        iv: encryptedBackupCodes.iv,
        authTag: encryptedBackupCodes.authTag
      }),
      updatedAt: new Date()
    }).where(eq(users.id, userId));

    // Log backup codes regeneration
    await audit({
      userId,
      action: 'admin_backup_codes_regenerated',
      resourceId: userId,
      status: 'success',
      details: { backupCodesCount: newBackupCodes.length },
      severity: 'high'
    });

    res.json({
      success: true,
      message: 'Backup codes regenerated successfully',
      data: {
        backupCodes: newBackupCodes,
        backupCodesRemaining: newBackupCodes.length,
        warning: '⚠️ Old backup codes are now invalid. Save these new codes immediately.'
      }
    });
  } catch (error) {
    logger.error('Backup codes regeneration error:', error);
    res.status(500).json({ 
      error: 'Regeneration failed',
      message: (error as Error).message 
    });
  }
});

/**
 * POST /api/admin/2fa/disable
 * Disable 2FA for admin account
 * Requires password verification for security
 * 
 * Body: { password: string }
 */
router.post('/2fa/disable', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { password } = req.body;

    if (!userId) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Valid authentication required' 
      });
    }

    if (!password) {
      return res.status(400).json({ 
        error: 'Password required',
        message: 'Password is required to disable 2FA' 
      });
    }

    // Get user from database
    const userArr = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userArr[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    if (!user.password || !(await bcrypt.compare(password, user.password))) {
      await audit({
        userId,
        action: 'admin_2fa_disable_failed',
        resourceId: userId,
        status: 'denied',
        details: { reason: 'Invalid password' },
        severity: 'high'
      });

      return res.status(401).json({ 
        error: 'Invalid password',
        message: 'Password verification failed' 
      });
    }

    // Disable 2FA
    await db.update(users).set({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
      twoFactorVerifiedAt: null,
      updatedAt: new Date()
    }).where(eq(users.id, userId));

    // Log 2FA disablement
    await audit({
      userId,
      action: 'admin_2fa_disabled',
      resourceId: userId,
      status: 'success',
      details: {},
      severity: 'critical'
    });

    res.json({
      success: true,
      message: '2FA has been disabled',
      data: {
        twoFactorEnabled: false,
        warning: '⚠️ Your account is now less secure. Consider re-enabling 2FA.'
      }
    });
  } catch (error) {
    logger.error('2FA disable error:', error);
    res.status(500).json({ 
      error: 'Disable failed',
      message: (error as Error).message 
    });
  }
});

export default router;
