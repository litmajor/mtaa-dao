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

import { Request, Response, NextFunction } from 'express';
import { CEXCredentialRepository } from '../repositories/cexCredentialRepository';
import { KeyManagementService } from '../services/keyManagementService';

/**
 * Extended Express Request with CEX credentials
 */
declare global {
  namespace Express {
    interface Request {
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
 * Middleware: Retrieve and validate CEX credentials
 * 
 * Usage:
 * router.post('/place-order', cexAuthMiddleware, placeOrderHandler);
 */
export async function cexAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if user has credentials
    const credExists = await CEXCredentialRepository.credentialsExist(userId);
    if (!credExists) {
      res.status(400).json({
        error: 'CEX credentials not configured',
        message: 'User needs to set up exchange credentials first',
      });
      return;
    }

    // Retrieve and decrypt credentials
    const credentials = await CEXCredentialRepository.getCredentialsByUserId(userId);
    if (!credentials) {
      res.status(400).json({
        error: 'CEX credentials not found',
        message: 'Failed to retrieve credentials',
      });
      return;
    }

    // Check if credentials are active
    if (!credentials.isActive) {
      res.status(403).json({
        error: 'CEX credentials deactivated',
        message: 'Credentials are not active. Please reactivate them.',
      });
      return;
    }

    // Attach credentials to request
    (req as any).cex = {
      credentials: {
        userId,
        exchange: credentials.exchange,
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        passphrase: credentials.passphrase,
      },
      credentialId: credentials.id,
    };

    // Update last used timestamp
    await CEXCredentialRepository.updateLastUsed(userId);

    // Log access
    const keyMgmt = KeyManagementService.getInstance();
    await keyMgmt.logAudit('decrypt', 'api_credentials', true, undefined, userId);

    next();
  } catch (error) {
    const userId = (req as any).user?.id;
    const keyMgmt = KeyManagementService.getInstance();
    await keyMgmt.logAudit(
      'decrypt',
      'api_credentials',
      false,
      error instanceof Error ? error.message : String(error),
      userId
    );

    console.error('CEX auth middleware error:', error);
    res.status(500).json({
      error: 'Failed to retrieve credentials',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Middleware: Optionally retrieve CEX credentials (don't fail if not present)
 * 
 * Usage:
 * router.get('/prices', optionalCexAuthMiddleware, getPricesHandler);
 */
export async function optionalCexAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      // User not authenticated, continue without credentials
      next();
      return;
    }

    const credExists = await CEXCredentialRepository.credentialsExist(userId);
    if (!credExists) {
      // No credentials set up yet, continue without them
      next();
      return;
    }

    // Credentials exist, try to retrieve them
    try {
      const credentials = await CEXCredentialRepository.getCredentialsByUserId(userId);
      if (credentials && credentials.isActive) {
        (req as any).cex = {
          credentials: {
            userId,
            exchange: credentials.exchange,
            apiKey: credentials.apiKey,
            apiSecret: credentials.apiSecret,
            passphrase: credentials.passphrase,
          },
          credentialId: credentials.id,
        };

        await CEXCredentialRepository.updateLastUsed(userId);

        const keyMgmt = KeyManagementService.getInstance();
        await keyMgmt.logAudit('decrypt', 'api_credentials', true, undefined, userId);
      }
    } catch (error) {
      // Log error but continue
      console.warn('Optional CEX auth failed:', error);
    }

    next();
  } catch (error) {
    console.error('Optional CEX auth middleware error:', error);
    // Continue anyway - this is optional
    next();
  }
}

/**
 * Middleware: Validate exchange name parameter
 */
export function validateExchange(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const exchange = req.params.exchange || req.body.exchange;
  const validExchanges = ['binance', 'kraken', 'coinbase', 'bybit', 'kucoin', 'okx'];

  if (!exchange || !validExchanges.includes(exchange.toLowerCase())) {
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
 * Expected format: BTC/USDT, ETH/USD, etc.
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

  if (!apiKey || !apiSecret) {
    res.status(400).json({
      error: 'Missing required fields',
      message: 'Both apiKey and apiSecret are required',
      required: ['apiKey', 'apiSecret'],
      optional: ['passphrase'],
    });
    return;
  }

  if (typeof apiKey !== 'string' || typeof apiSecret !== 'string') {
    res.status(400).json({
      error: 'Invalid field types',
      message: 'apiKey and apiSecret must be strings',
    });
    return;
  }

  if (apiKey.length < 10 || apiSecret.length < 10) {
    res.status(400).json({
      error: 'Invalid credentials',
      message: 'API key and secret appear too short',
    });
    return;
  }

  next();
}

/**
 * Middleware: Rate limiting for credential operations
 * Prevents brute force or abuse
 */
const credentialAccessLog = new Map<string, number[]>();

export function rateLimitCredentials(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // Get access times for this user in the last minute
  const accessTimes = (credentialAccessLog.get(userId) || [])
    .filter(time => time > oneMinuteAgo);

  // Limit to 10 requests per minute
  if (accessTimes.length >= 10) {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded: 10 credential operations per minute',
      retryAfter: Math.ceil((accessTimes[0] + 60000 - now) / 1000),
    });
    return;
  }

  // Record this access
  accessTimes.push(now);
  credentialAccessLog.set(userId, accessTimes);

  // Cleanup old entries occasionally
  if (Math.random() < 0.01) {
    credentialAccessLog.forEach((times, user) => {
      const filtered = times.filter(t => t > oneMinuteAgo);
      if (filtered.length === 0) {
        credentialAccessLog.delete(user);
      } else {
        credentialAccessLog.set(user, filtered);
      }
    });
  }

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
  const userId = (req as any).user?.id;

  console.error('CEX operation error:', error);

  // Log to audit trail
  const keyMgmt = KeyManagementService.getInstance();
  await keyMgmt.logAudit(
    'decrypt',
    'api_credentials',
    false,
    error.message,
    userId
  );

  // Return appropriate error response
  if (error.message.includes('Decryption failed')) {
    res.status(500).json({
      error: 'Credential decryption failed',
      message: 'Unable to access your credentials. This may indicate tampering.',
    });
  } else if (error.message.includes('Master key')) {
    res.status(500).json({
      error: 'System configuration error',
      message: 'Encryption system not properly configured',
    });
  } else {
    res.status(500).json({
      error: 'CEX operation failed',
      message: error.message,
    });
  }
}
