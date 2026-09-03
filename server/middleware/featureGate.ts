/**
 * Feature Gate Middleware
 * server/middleware/featureGate.ts
 *
 * Composable backend enforcement layer. Combines:
 *   1. Global flag      — featureVisibilityService (env var / Redis / phase)
 *   2. Persona check    — features.ts registry presentation map
 *   3. Advanced mode    — users.advancedMode in DB, never cached
 *
 * Usage:
 *   router.post('/multisig/setup', featureGate('treasury.multisig'), handler)
 *   router.use('/bridge', featureGate('bridge.swap'))
 *   router.get('/signals', featureGateAny('market.signals', 'market.intelligence'), handler)
 *
 * Also exports: buildManifestForUser() — used by GET /api/v1/features/manifest
 */

import type { Request, Response, NextFunction } from 'express';
import { db } from '../storage';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import {
  FEATURES,
  isFeatureAccessible,
  buildFeatureManifest,
  type Persona,
} from '../../shared/config/features';
import { isFeatureEnabled } from '../services/featureService';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Attached to req by featureGate — available in downstream handlers */
export interface FeatureContext {
  featureId: string;
  persona: Persona;
  advancedMode: boolean;
}

declare global {
  namespace Express {
    interface Request {
      featureContext?: FeatureContext;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: SHARED USER LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

function getAuthenticatedUserId(req: Request): string | null {
  const candidates = [
    (req as any).user?.id,
    (req as any).user?.userId,
    (req as any).userId,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

/** Single DB read per request — returns persona + advancedMode */
async function getUserAccessRecord(userId: string) {
  const rows = await db
    .select({
      persona: users.persona,
      advancedMode: users.advancedMode,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return rows[0] ?? null;
}

async function evaluateFeatureAccess(req: Request, featureId: string) {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return {
      allowed: false,
      status: 401,
      body: { success: false, error: 'Authentication required' },
    } as const;
  }

  const feature = FEATURES[featureId];
  if (!feature) {
    logger.error(`[FeatureGate] Registry miss: "${featureId}"`, { route: req.path });
    return {
      allowed: false,
      status: 500,
      body: { success: false, error: 'Unknown feature gate' },
    } as const;
  }

  if (!checkGlobalFlag(featureId)) {
    logger.info(`[FeatureGate] GLOBAL_OFF: ${featureId}`, { userId, route: req.path });
    return {
      allowed: false,
      status: 503,
      body: {
        success: false,
        error: 'Feature not yet available',
        feature: featureId,
        reason: 'feature_disabled',
      },
    } as const;
  }

  const record = await getUserAccessRecord(userId);
  if (!record) {
    logger.warn(`[FeatureGate] User not found: ${userId}`);
    return {
      allowed: false,
      status: 403,
      body: { success: false, error: 'Access denied' },
    } as const;
  }

  const persona = (record.persona as Persona) ?? 'okedi';
  const advancedMode = record.advancedMode === true;
  const presentation = feature.presentation[persona];
  const accessibility = isFeatureAccessible(featureId, persona, advancedMode);

  if (presentation === 'hidden' || !accessibility.accessible) {
    if (presentation === 'hidden') {
      logger.info(`[FeatureGate] HIDDEN: ${featureId} / ${persona}`, { userId, route: req.path });
      return {
        allowed: false,
        status: 404,
        body: { success: false, error: 'Not found' },
      } as const;
    }

    logger.info(`[FeatureGate] INACCESSIBLE: ${featureId} / ${persona}`, {
      userId,
      route: req.path,
      reason: accessibility.reason,
    });

    return {
      allowed: false,
      status: 403,
      body: {
        success: false,
        error: 'Feature not accessible',
        feature: featureId,
        reason: accessibility.reason,
        unlock: feature.unlock,
      },
    } as const;
  }

  if (feature.requiresAdvancedMode && !advancedMode) {
    logger.warn(`[FeatureGate] ADVANCED_REQUIRED: ${featureId}`, { userId, route: req.path });
    return {
      allowed: false,
      status: 403,
      body: {
        success: false,
        error: 'Advanced Mode required',
        feature: featureId,
        toggle: '/api/v1/settings/advanced-mode',
        unlock: feature.unlock ?? {
          action: 'toggle_advanced_mode',
          label: 'Enable Advanced Mode',
          href: '/api/v1/settings/advanced-mode',
        },
      },
    } as const;
  }

  req.featureContext = { featureId, persona, advancedMode };
  return {
    allowed: true,
    status: 200,
    body: null,
  } as const;
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE 1: GLOBAL FLAG
// ─────────────────────────────────────────────────────────────────────────────
// Checks featureVisibilityService — is this feature deployed at all?
// Returns 503 (not a user problem — feature is off globally).

function checkGlobalFlag(featureId: string): boolean {
  const feature = FEATURES[featureId];
  if (!feature?.featureServiceKey) return true; // no service key = no global gate
  return isFeatureEnabled(feature.featureServiceKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY MIDDLEWARE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * featureGate(featureId)
 *
 * Returns Express middleware that enforces access to a single feature.
 * Apply directly to a route or a router prefix.
 *
 * Error response shape:
 * {
 *   success: false,
 *   error: string,
 *   feature?: string,        // the feature ID
 *   reason?: string,         // why blocked
 *   unlock?: { action, label, href }  // what the user should do
 * }
 */
export function featureGate(featureId: string) {
  return async function featureGateMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await evaluateFeatureAccess(req, featureId);

      if (!result.allowed) {
        return res.status(result.status).json(result.body);
      }

      next();
    } catch (error) {
      logger.error(`[FeatureGate] Error on "${featureId}"`, {
        userId: getAuthenticatedUserId(req),
        route: req.path,
        error,
      });
      return res.status(500).json({ success: false, error: 'Failed to verify feature access' });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OR-GATE: ANY ONE OF N FEATURES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * featureGateAny(...featureIds)
 *
 * Passes if ANY of the listed features is accessible.
 * Useful for routes shared across personas (e.g., Yuki + Amara market data).
 *
 * The last blocking response is what the client receives if all gates fail.
 */
export function featureGateAny(...featureIds: string[]) {
  return async function featureGateAnyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    let lastStatus = 403;
    let lastBody: object = { success: false, error: 'Access denied' };

    for (const featureId of featureIds) {
      const result = await evaluateFeatureAccess(req, featureId);

      if (result.allowed) {
        return next();
      }

      lastStatus = result.status;
      lastBody = result.body;
    }

    return res.status(lastStatus).json(lastBody);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MANIFEST BUILDER — for GET /api/v1/features/manifest
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildManifestForUser(userId)
 *
 * Assembles the full feature manifest for a user:
 *   - persona + advancedMode from DB
 *   - presentation from features.ts registry
 *   - global flag from featureVisibilityService
 *
 * Intended for: GET /api/v1/features/manifest (authenticated)
 * The frontend FeatureProvider can either receive this pre-loaded from the
 * dashboard API response, or fetch it lazily via this endpoint.
 *
 * DROP THIS INTO your features router:
 *
 *   import { buildManifestForUser } from '../middleware/featureGate';
 *   router.get('/manifest', authenticate, async (req, res) => {
 *     const manifest = await buildManifestForUser(req.user.id);
 *     return res.json(manifest);
 *   });
 */
export async function buildManifestForUser(userId: string) {
  const record = await getUserAccessRecord(userId);
  const persona = (record?.persona as Persona) ?? 'okedi';
  const advancedMode = record?.advancedMode === true;

  // Build from features.ts registry (persona + advancedMode)
  const manifest = buildFeatureManifest(persona, advancedMode);

  // Overlay global flag: mark globally-disabled features as inaccessible
  for (const [id, feature] of Object.entries(FEATURES)) {
    if (feature.featureServiceKey && !isFeatureEnabled(feature.featureServiceKey)) {
      if (manifest.features[id]) {
        manifest.features[id] = {
          ...manifest.features[id],
          accessible: false,
          reason: 'feature_disabled',
        };
      }
    }
  }

  return manifest;
}

export default featureGate;
