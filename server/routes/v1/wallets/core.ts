/**
 * V1 Wallets Core Router (Production)
 *
 * Canonical wallet CRUD under /v1/wallets
 *
 * GET    /v1/wallets
 * POST   /v1/wallets
 * GET    /v1/wallets/:walletId
 * PATCH  /v1/wallets/:walletId          (partial update — implemented)
 * DELETE /v1/wallets/:walletId/deactivate
 *
 * PUT kept as alias of PATCH with Deprecation hint for old clients.
 */

import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { WalletError, walletGenerationService } from '../../../services/wallet-generation-service';
import { isAuthenticated } from '../../../auth';
import { walletOwnershipGuard } from '../../../middleware/walletValidation';
import { rateLimitPerUser } from '../../../middleware/rateLimit';
import { logger } from '../../../utils/logger';

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────

const WALLET_TYPES = ['personal', 'dao', 'treasury', 'smart_contract'] as const;

const ownershipChallengeSchema = z.object({
  address: z.string().trim().regex(/^0x[0-9a-fA-F]{40}$/),
});

const registerWalletSchema = z.object({
  address: z.string().trim().regex(/^0x[0-9a-fA-F]{40}$/),
  currency: z.string().trim().min(1).max(16).default('USDC').transform((s) => s.toUpperCase()),
  walletType: z.enum(WALLET_TYPES).default('personal'),
  challengeId: z.string().uuid(),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  publicKey: z.string().max(256).optional(),
  label: z.string().trim().min(1).max(64).optional(),
});

/** Only safe metadata fields — not key material or irreversible type elevating without audit */
const updateWalletSchema = z
  .object({
    label: z.string().trim().min(1).max(64).optional(),
    currency: z
      .string()
      .trim()
      .min(1)
      .max(16)
      .transform((s) => s.toUpperCase())
      .optional(),
    // Disallow silent type changes unless explicitly allowed by service policy
    walletType: z.enum(WALLET_TYPES).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, {
    message: 'At least one field is required',
  });

const walletIdParamSchema = z.object({
  walletId: z.string().uuid(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  includeInactive: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getUserId(req: Request): string | null {
  const u = (req as any).user;
  return u?.id ?? u?.claims?.sub ?? u?.claims?.id ?? null;
}

function isZodError(err: unknown): err is z.ZodError {
  return err instanceof z.ZodError;
}

function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown
) {
  const body: Record<string, unknown> = {
    success: false,
    error: message,
    code,
  };
  if (details && process.env.NODE_ENV !== 'production') {
    body.details = details;
  }
  return res.status(status).json(body);
}

function mapServiceError(err: unknown): { status: number; code: string; message: string } {
  if (err instanceof WalletError) {
    return { status: err.status, code: err.code, message: err.message };
  }
  const message = err instanceof Error ? err.message : 'Unexpected error';
  const lower = message.toLowerCase();

  if (lower.includes('not found')) {
    return { status: 404, code: 'WALLET_NOT_FOUND', message: 'Wallet not found' };
  }
  if (lower.includes('not authorized') || lower.includes('forbidden')) {
    return { status: 403, code: 'WALLET_FORBIDDEN', message: 'Not allowed' };
  }
  if (lower.includes('already') || lower.includes('duplicate')) {
    return { status: conflictStatus(), code: 'WALLET_CONFLICT', message: message };
  }
  return { status: 500, code: 'WALLET_INTERNAL', message: 'Wallet operation failed' };
}

function conflictStatus() {
  return 409;
}

async function requireUser(
  req: Request,
  res: Response
): Promise<string | null> {
  const userId = getUserId(req);
  if (!userId) {
    sendError(res, 401, 'UNAUTHORIZED', 'User not authenticated');
    return null;
  }
  return userId;
}

/** Strip secrets before responding */
function publicWallet<T extends Record<string, unknown>>(wallet: T): T {
  const {
    masterPassword: _mp,
    encryptedSeed: _es,
    privateKey: _pk,
    mnemonic: _mn,
    seedPhrase: _sp,
    ...rest
  } = wallet as any;
  return rest as T;
}

// ─────────────────────────────────────────────────────────────
// GET /v1/wallets
// ─────────────────────────────────────────────────────────────

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = await requireUser(req, res);
    if (!userId) return;

    const query = listQuerySchema.parse(req.query);

    const data = await walletGenerationService.getUserWallets(userId, {
      limit: query.limit,
      offset: query.offset,
      includeInactive: query.includeInactive,
    });

    res.json({
      success: true,
      data,
      meta: {
        count: data.length,
        limit: query.limit,
        offset: query.offset,
      },
      _links: {
        self: '/v1/wallets',
        create: {
          method: 'POST',
          href: '/v1/wallets/register/challenge',
          description: 'Generate keys client-side, then prove address ownership to register',
        },
      },
    });
  } catch (error) {
    if (isZodError(error)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query', error.flatten());
    }
    logger.error('Failed to list wallets', { error });
    const mapped = mapServiceError(error);
    // List failures are not "404" unless truly no user context
    return sendError(
      res,
      mapped.status === 404 ? 500 : mapped.status,
      'WALLET_LIST_FAILED',
      mapped.status === 500 ? 'Failed to list wallets' : mapped.message
    );
  }
});

// ─────────────────────────────────────────────────────────────
// POST /v1/wallets — server-side key generation is intentionally not exposed.
// ─────────────────────────────────────────────────────────────

router.post(
  '/',
  isAuthenticated,
  rateLimitPerUser('wallet-create', 10, '15min'),
  (_req, res) => sendError(
    res,
    501,
    'CLIENT_WALLET_REQUIRED',
    'Generate wallet keys on your device, then use POST /v1/wallets/register/challenge and POST /v1/wallets/register.'
  )
);

// ─────────────────────────────────────────────────────────────
// Client-generated wallet ownership proof
// ─────────────────────────────────────────────────────────────

router.post(
  '/register/challenge',
  isAuthenticated,
  rateLimitPerUser('wallet-register-challenge', 10, '15min'),
  async (req, res) => {
    try {
      const userId = await requireUser(req, res);
      if (!userId) return;
      const { address } = ownershipChallengeSchema.parse(req.body);
      const challenge = await walletGenerationService.createOwnershipChallenge(userId, address);
      return res.status(200).json({ success: true, data: challenge });
    } catch (error) {
      if (isZodError(error)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid address', error.flatten());
      }
      logger.error('Failed to issue wallet registration challenge', { error });
      const mapped = mapServiceError(error);
      return sendError(res, mapped.status, mapped.code, mapped.message);
    }
  }
);

router.post(
  '/register',
  isAuthenticated,
  rateLimitPerUser('wallet-register', 10, '15min'),
  async (req, res) => {
    try {
      const userId = await requireUser(req, res);
      if (!userId) return;
      const validated = registerWalletSchema.parse(req.body);
      const registration = await walletGenerationService.registerClientGeneratedWallet(
        userId,
        validated.address,
        validated.currency,
        validated.walletType,
        {
          challengeId: validated.challengeId,
          signature: validated.signature,
          publicKey: validated.publicKey,
          label: validated.label,
        }
      );
      return res.status(201).json({ success: true, data: registration });
    } catch (error) {
      if (isZodError(error)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid wallet registration', error.flatten());
      }
      logger.error('Failed to register client-generated wallet', { error });
      const mapped = mapServiceError(error);
      return sendError(res, mapped.status, mapped.code, mapped.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// Param middleware: validate UUID before ownership guard
// ─────────────────────────────────────────────────────────────

router.param('walletId', (req, res, next, value) => {
  const parsed = walletIdParamSchema.safeParse({ walletId: value });
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'walletId must be a UUID');
  }
  next();
});

// ─────────────────────────────────────────────────────────────
// GET /v1/wallets/:walletId
// ─────────────────────────────────────────────────────────────

router.get(
  '/:walletId',
  isAuthenticated,
  walletOwnershipGuard,
  async (req, res) => {
    try {
      const userId = await requireUser(req, res);
      if (!userId) return;

      const { walletId } = req.params;
      const wallet = await walletGenerationService.getUserWallet(userId, walletId);

      if (!wallet) {
        return sendError(res, 404, 'WALLET_NOT_FOUND', 'Wallet not found');
      }

      res.json({
        success: true,
        data: publicWallet(wallet as any),
        _links: {
          self: `/v1/wallets/${walletId}`,
          list: '/v1/wallets',
          update: { method: 'PATCH', href: `/v1/wallets/${walletId}` },
          deactivate: {
            method: 'DELETE',
            href: `/v1/wallets/${walletId}/deactivate`,
          },
          balance: `/v1/wallets/${walletId}/balance`,
          sessions: `/v1/wallets/${walletId}/sessions`,
        },
      });
    } catch (error) {
      logger.error('Failed to get wallet', { error });
      const mapped = mapServiceError(error);
      return sendError(res, mapped.status, mapped.code, mapped.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// PATCH /v1/wallets/:walletId  (real update)
// ─────────────────────────────────────────────────────────────

async function handleUpdate(req: Request, res: Response) {
  try {
    const userId = await requireUser(req, res);
    if (!userId) return;

    const { walletId } = req.params;
    const validated = updateWalletSchema.parse(req.body);

    // Service must implement update; if missing, fail closed
    const updated = await walletGenerationService.updateWallet(userId, walletId, validated);

    res.json({
      success: true,
      data: publicWallet(updated as any),
      message: 'Wallet updated successfully',
      _links: { self: `/v1/wallets/${walletId}` },
    });
  } catch (error) {
    if (isZodError(error)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid body', error.flatten());
    }
    logger.error('Failed to update wallet', { error });
    const mapped = mapServiceError(error);
    return sendError(res, mapped.status, 'WALLET_UPDATE_FAILED', mapped.message);
  }
}

router.patch(
  '/:walletId',
  isAuthenticated,
  walletOwnershipGuard,
  rateLimitPerUser('wallet-update', 30, '15min'),
  handleUpdate
);

/** @deprecated Prefer PATCH */
router.put(
  '/:walletId',
  isAuthenticated,
  walletOwnershipGuard,
  rateLimitPerUser('wallet-update', 30, '15min'),
  (req, res, next) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader(
      'Warning',
      '299 - "PUT /v1/wallets/:id is deprecated; use PATCH"'
    );
    next();
  },
  handleUpdate
);

// ─────────────────────────────────────────────────────────────
// DELETE /v1/wallets/:walletId/deactivate
// ─────────────────────────────────────────────────────────────

router.delete(
  '/:walletId/deactivate',
  isAuthenticated,
  walletOwnershipGuard,
  rateLimitPerUser('wallet-deactivate', 10, '15min'),
  async (req, res) => {
    try {
      const userId = await requireUser(req, res);
      if (!userId) return;

      const { walletId } = req.params;
      const result = await walletGenerationService.deactivateWallet(
        userId,
        walletId
      );

      res.json({
        success: true,
        data: publicWallet((result ?? { id: walletId, active: false }) as any),
        message: 'Wallet deactivated successfully',
        _links: { wallets: '/v1/wallets' },
      });
    } catch (error) {
      logger.error('Failed to deactivate wallet', { error });
      const mapped = mapServiceError(error);
      return sendError(
        res,
        mapped.status,
        'WALLET_DEACTIVATION_FAILED',
        mapped.message
      );
    }
  }
);

export default router;