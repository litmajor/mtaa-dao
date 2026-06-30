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

import { Request, Response, NextFunction } from 'express';
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
import { isFeatureEnabled } from '../services/featureVisibilityService';

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
      const userId = (req as any).user?.id ?? (req as any).userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const feature = FEATURES[featureId];
      if (!feature) {
        logger.error(`[FeatureGate] Registry miss: "${featureId}"`, { route: req.path });
        return res.status(500).json({ success: false, error: 'Unknown feature gate' });
      }

      // ── GATE 1: Global flag ──────────────────────────────────────────────────
      if (!checkGlobalFlag(featureId)) {
        logger.info(`[FeatureGate] GLOBAL_OFF: ${featureId}`, { userId, route: req.path });
        return res.status(503).json({
          success: false,
          error: 'Feature not yet available',
          feature: featureId,
          reason: 'feature_disabled',
        });
      }

      // ── DB READ (single, covers gates 2 & 3) ────────────────────────────────
      const record = await getUserAccessRecord(userId as string);
      if (!record) {
        logger.warn(`[FeatureGate] User not found: ${userId}`);
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const persona = (record.persona as Persona) ?? 'okedi';
      const advancedMode = record.advancedMode === true;
      const presentation = feature.presentation[persona];

      // ── GATE 2: Persona presentation ─────────────────────────────────────────
      // 'hidden' = feature does not exist for this persona → 404 not 403.
      // We return a vague 404 so the route topology isn't leaked.
      if (presentation === 'hidden') {
        logger.info(`[FeatureGate] HIDDEN: ${featureId} / ${persona}`, { userId, route: req.path });
        return res.status(404).json({ success: false, error: 'Not found' });
      }

      // 'locked' = feature exists in the persona's surface but access is gated.
      // Still runs gate 3 — a locked feature may also require advanced mode.
      if (presentation === 'locked') {
        const { accessible, reason } = isFeatureAccessible(featureId, persona, advancedMode);
        if (!accessible) {
          logger.info(`[FeatureGate] LOCKED: ${featureId} / ${persona}`, { userId, route: req.path, reason });
          return res.status(403).json({
            success: false,
            error: 'Feature not accessible',
            feature: featureId,
            reason,
            unlock: feature.unlock,
          });
        }
      }

      // ── GATE 3: Advanced mode (hard gate, DB read already done) ─────────────
      if (feature.requiresAdvancedMode && !advancedMode) {
        logger.warn(`[FeatureGate] ADVANCED_REQUIRED: ${featureId}`, { userId, route: req.path });
        return res.status(403).json({
          success: false,
          error: 'Advanced Mode required',
          feature: featureId,
          toggle: '/api/v1/settings/advanced-mode',
          unlock: feature.unlock ?? {
            action: 'toggle_advanced_mode',
            label: 'Enable Advanced Mode',
            href: '/api/v1/settings/advanced-mode',
          },
        });
      }

      if (feature.requiresAdvancedMode) {
        logger.info(`[FeatureGate] ADVANCED_OK: ${featureId}`, { userId, route: req.path });
      }

      // Attach context so downstream handlers can read persona / advancedMode
      req.featureContext = { featureId, persona, advancedMode };

      next();
    } catch (error) {
      logger.error(`[FeatureGate] Error on "${featureId}"`, {
        userId: (req as any).user?.id,
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
      let passed = false;

      await new Promise<void>((resolve) => {
        const mw = featureGate(featureId);
        // Override res.json temporarily to capture the rejection body
        const origJson = res.json.bind(res);
        const origStatus = res.status.bind(res);
        let capturedStatus = 200;

        res.status = (code: number) => {
          capturedStatus = code;
          return res;
        };

        mw(req, res, () => {
          passed = true;
          // Restore overrides
          res.json = origJson;
          res.status = origStatus;
          resolve();
        });

        if (!passed) {
          lastStatus = capturedStatus;
          res.json = origJson;
          res.status = origStatus;
          resolve();
        }
      });

      if (passed) return next();
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
