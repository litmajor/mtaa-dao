/**
 * CEX Authentication Middleware
 * Validates and provides access to encrypted credentials for CEX operations
 * 
 * Responsibilities:
 * - Retrieve user's CEX credentials
 * - Verify credentials are valid and active
 * - Decrypt credentials for use
 * - Handle missing/invalid credentials
 * - Log all credential access
 */

import type { Request, Response, NextFunction } from 'express';
import { CEXCredentialRepository } from '../repositories/cexCredentialRepository';
import { KeyManagementService } from '../services/keyManagementService';

// Standard Express type extension
declare global {
  namespace Express {
    interface User {
      id: string;
    }
    interface Request {
      user?: User;
      cex?: {
        credentials: {
          userId: string;
          exchange: string;
          apiKey: string;
          apiSecret: string;
          passphrase?: string;
        };
        credentialId: string;
      };
    }
  }
}

/**
 * Helper: Fire-and-forget audit logging to prevent blocking main API path
 */
function logAuditAsync(
  action: 'encrypt' | 'decrypt' | 'rotate' | 'reencrypt',
  resource: string,
  success: boolean,
  error?: string,
  userId?: string
): void {
  KeyManagementService.getInstance()
    .logAudit(action, resource, success, error, userId)
    .catch((err) => console.error('Failed to write audit log:', err));
}

/**
 * Middleware: Retrieve and validate CEX credentials
 */
export async function cexAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  try {
    // Single DB call instead of existence check + fetch
    const credentials = await CEXCredentialRepository.getCredentialsByUserId(userId);
    
    if (!credentials) {
      res.status(400).json({
        error: 'CEX credentials not configured',
        message: 'User needs to set up exchange credentials first',
      });
      return;
    }

    if (!credentials.isActive) {
      res.status(403).json({
        error: 'CEX credentials deactivated',
        message: 'Credentials are not active. Please reactivate them.',
      });
      return;
    }

    // Attach strongly-typed credentials
    req.cex = {
      credentials: {
        userId,
        exchange: credentials.exchange,
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        passphrase: credentials.passphrase,
      },
      credentialId: credentials.id,
    };

    // Update last used timestamp in background
    CEXCredentialRepository.updateLastUsed(userId).catch((err) =>
      console.error('Failed to update last used timestamp:', err)
    );

    // Audit log
    logAuditAsync('decrypt', 'api_credentials', true, undefined, userId);

    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logAuditAsync('decrypt', 'api_credentials', false, errorMessage, userId);

    console.error('CEX auth middleware error:', error);
    res.status(500).json({
      error: 'Failed to retrieve credentials',
      message: errorMessage,
    });
  }
}

/**
 * Middleware: Optionally retrieve CEX credentials (don't fail if not present)
 */
export async function optionalCexAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    return next();
  }

  try {
    const credentials = await CEXCredentialRepository.getCredentialsByUserId(userId);
    if (credentials && credentials.isActive) {
      req.cex = {
        credentials: {
          userId,
          exchange: credentials.exchange,
          apiKey: credentials.apiKey,
          apiSecret: credentials.apiSecret,
          passphrase: credentials.passphrase,
        },
        credentialId: credentials.id,
      };

      CEXCredentialRepository.updateLastUsed(userId).catch((err) =>
        console.error('Failed to update last used timestamp:', err)
      );

      logAuditAsync('decrypt', 'api_credentials', true, undefined, userId);
    }
  } catch (error) {
    console.warn('Optional CEX auth failed:', error);
  }

  next();
}

/**
 * Middleware: Validate exchange name parameter
 */
export function validateExchange(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const exchange = (req.params.exchange || req.body.exchange)?.toString().toLowerCase();
  const validExchanges = ['binance', 'kraken', 'coinbase', 'bybit', 'kucoin', 'okx'];

  if (!exchange || !validExchanges.includes(exchange)) {
    res.status(400).json({
      error: 'Invalid exchange',
      message: `Exchange must be one of: ${validExchanges.join(', ')}`,
      supportedExchanges: validExchanges,
    });
    return;
  }

  next();
}

/**
 * Middleware: Validate trading pair format
 */
export function validateTradingPair(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const pair = req.query.pair || req.body.pair;
  const pairRegex = /^[A-Z0-9]+\/[A-Z0-9]+$/;

  if (!pair || !pairRegex.test(String(pair))) {
    res.status(400).json({
      error: 'Invalid trading pair',
      message: 'Trading pair must be in format: BTC/USDT',
      example: 'BTC/USDT',
    });
    return;
  }

  next();
}

/**
 * Middleware: Validate request body for credential storage
 */
export function validateCredentialRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { apiKey, apiSecret } = req.body;

  if (typeof apiKey !== 'string' || typeof apiSecret !== 'string') {
    res.status(400).json({
      error: 'Invalid field types',
      message: 'apiKey and apiSecret must be valid strings',
    });
    return;
  }

  if (apiKey.trim().length < 10 || apiSecret.trim().length < 10) {
    res.status(400).json({
      error: 'Invalid credentials',
      message: 'API key and secret appear too short',
    });
    return;
  }

  next();
}

/**
 * Middleware: Sliding-window rate limiting for credential operations
 */
const credentialAccessLog = new Map<string, number[]>();

// Run explicit cleanup interval every 5 minutes to prevent memory leaks
setInterval(() => {
  const oneMinuteAgo = Date.now() - 60000;
  for (const [userId, times] of credentialAccessLog.entries()) {
    const validTimes = times.filter((t) => t > oneMinuteAgo);
    if (validTimes.length === 0) {
      credentialAccessLog.delete(userId);
    } else {
      credentialAccessLog.set(userId, validTimes);
    }
  }
}, 300000);

export function rateLimitCredentials(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  const accessTimes = (credentialAccessLog.get(userId) || []).filter(
    (time) => time > oneMinuteAgo
  );

  if (accessTimes.length >= 10) {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded: 10 credential operations per minute',
      retryAfter: Math.ceil((accessTimes[0] + 60000 - now) / 1000),
    });
    return;
  }

  accessTimes.push(now);
  credentialAccessLog.set(userId, accessTimes);

  next();
}

/**
 * Error handler for CEX operations
 */
export async function handleCEXError(
  error: any,
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user?.id;
  const message = error instanceof Error ? error.message : String(error);

  console.error('CEX operation error:', error);

  logAuditAsync('decrypt', 'api_credentials', false, message, userId);

  if (message.includes('Decryption failed')) {
    res.status(500).json({
      error: 'Credential decryption failed',
      message: 'Unable to access your credentials. This may indicate tampering.',
    });
  } else if (message.includes('Master key')) {
    res.status(500).json({
      error: 'System configuration error',
      message: 'Encryption system not properly configured',
    });
  } else {
    res.status(500).json({
      error: 'CEX operation failed',
      message,
    });
  }
}