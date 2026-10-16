import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { and, asc, desc, eq, gte } from 'drizzle-orm';
import { db, pool } from '../../db';
import { requireRole } from '../../middleware/rbac';
import { AppError, ValidationError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { priceOracle } from '../../services/priceOracle';
import { valuationAssetCandidates, valuationAssets } from '../../../shared/schema';

const router = Router();
const requireValuationAdmin = requireRole('admin', 'super_admin', 'governance');

const assetClassSchema = z.enum(['stable', 'major', 'mid', 'alt']);

const createSchema = z.object({
  symbol: z.string().trim().min(1).max(32).transform((symbol) => symbol.toUpperCase()),
  coingeckoId: z.string().trim().min(1).max(128).nullable().optional(),
  assetClass: assetClassSchema,
  maxDeviationPct: z.number().min(0.05).max(25).default(2),
  haircutPct: z.number().min(0).max(50).default(0),
  chain: z.string().trim().min(1).max(64).nullable().optional(),
  contractAddress: z.string().trim().min(1).max(128).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  addedReason: z.string().trim().min(1).max(2000).optional(),
  isActive: z.boolean().default(true),
});

const patchSchema = createSchema
  .omit({ symbol: true })
  .partial()
  .refine((asset) => Object.keys(asset).length > 0, 'At least one field must be provided');

const candidateListSchema = z.object({
  status: z.enum(['proposed', 'approved', 'rejected', 'stale', 'already_allowlisted']).default('proposed'),
  min_score: z.coerce.number().int().min(0).max(100).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const manualCandidateSchema = z.object({
  symbol: z.string().trim().min(1).max(32).transform((symbol) => symbol.toUpperCase()),
  coingeckoId: z.string().trim().min(1).max(128).nullable().optional(),
  name: z.string().trim().min(1).max(128).optional(),
  reason: z.string().trim().min(1).max(2000),
});

const approveCandidateSchema = z.object({
  coingeckoId: z.string().trim().min(1).max(128).nullable().optional(),
  assetClass: assetClassSchema,
  maxDeviationPct: z.number().min(0.05).max(25).default(2),
  haircutPct: z.number().min(0).max(50).default(0),
  chain: z.string().trim().min(1).max(64).nullable().optional(),
  contractAddress: z.string().trim().min(1).max(128).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  addedReason: z.string().trim().min(1).max(2000),
});

const rejectCandidateSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

function getActorId(req: Request): string | null {
  return req.user?.userId || req.user?.claims?.sub || req.user?.id || null;
}

async function reloadAllowlist(): Promise<void> {
  const activeAssets = await priceOracle.reloadValuationAllowlist();
  logger.info('Reloaded valuation allowlist after admin change', { activeAssets });
}

router.get('/', requireValuationAdmin, async (_req, res, next) => {
  try {
    const assets = await db
      .select()
      .from(valuationAssets)
      .orderBy(asc(valuationAssets.symbol));
    res.json({ assets });
  } catch (error) {
    next(error);
  }
});

router.post('/reload', requireValuationAdmin, async (_req, res, next) => {
  try {
    const activeAssets = await reloadAllowlist();
    res.json({ reloaded: true, activeAssets });
  } catch (error) {
    next(error);
  }
});

router.get('/candidates', requireValuationAdmin, async (req, res, next) => {
  try {
    const query = candidateListSchema.parse(req.query);
    const candidates = await db
      .select()
      .from(valuationAssetCandidates)
      .where(
        and(
          eq(valuationAssetCandidates.status, query.status),
          gte(valuationAssetCandidates.score, query.min_score)
        )
      )
      .orderBy(desc(valuationAssetCandidates.score), desc(valuationAssetCandidates.lastSeenAt))
      .limit(query.limit);
    res.json({ candidates });
  } catch (error) {
    next(error);
  }
});

router.post('/candidates', requireValuationAdmin, async (req, res, next) => {
  try {
    const input = manualCandidateSchema.parse(req.body);
    const [activeAsset] = await db
      .select({ symbol: valuationAssets.symbol })
      .from(valuationAssets)
      .where(and(eq(valuationAssets.symbol, input.symbol), eq(valuationAssets.isActive, true)))
      .limit(1);
    if (activeAsset) {
      throw new ValidationError(`${input.symbol} is already in the valuation allowlist`);
    }
    if (input.coingeckoId) {
      const [assetWithId] = await db
        .select({ symbol: valuationAssets.symbol })
        .from(valuationAssets)
        .where(
          and(
            eq(valuationAssets.coingeckoId, input.coingeckoId),
            eq(valuationAssets.isActive, true)
          )
        )
        .limit(1);
      if (assetWithId) {
        throw new ValidationError(
          `CoinGecko id ${input.coingeckoId} is already allowlisted as ${assetWithId.symbol}`
        );
      }
      const [candidateWithId] = await db
        .select({ symbol: valuationAssetCandidates.symbol })
        .from(valuationAssetCandidates)
        .where(eq(valuationAssetCandidates.coingeckoId, input.coingeckoId))
        .limit(1);
      if (candidateWithId) {
        throw new ValidationError(
          `CoinGecko id ${input.coingeckoId} is already associated with ${candidateWithId.symbol}`
        );
      }
    }
    const [candidate] = await db
      .insert(valuationAssetCandidates)
      .values({
        symbol: input.symbol,
        coingeckoId: input.coingeckoId ?? null,
        name: input.name ?? null,
        score: 0,
        criteriaSnapshot: {
          origin: 'admin manual proposal',
          marketCapRank: null,
          exchangeCount: null,
          trustedVolume30dUsd: null,
          trustScore: null,
          ageDays: null,
        },
        status: 'proposed',
        source: 'manual',
        reason: input.reason,
        proposedBy: getActorId(req),
      })
      .onConflictDoNothing({ target: valuationAssetCandidates.symbol })
      .returning();
    if (!candidate) {
      throw new ValidationError(`A valuation candidate for ${input.symbol} already exists`);
    }
    res.status(201).json({ candidate });
  } catch (error) {
    next(error);
  }
});

router.post('/candidates/:id/approve', requireValuationAdmin, async (req, res, next) => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  if (!parsedId.success) {
    next(new ValidationError('Candidate id must be a UUID'));
    return;
  }

  let input: z.infer<typeof approveCandidateSchema>;
  try {
    input = approveCandidateSchema.parse(req.body);
  } catch (error) {
    next(error);
    return;
  }

  const actorId = getActorId(req);
  let client: PoolClient | undefined;
  let committed = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const { rows: candidateRows } = await client.query<{
      id: string;
      symbol: string;
      coingecko_id: string | null;
      source: 'pipeline' | 'manual';
      reason: string;
      status: string;
    }>(
      `SELECT id, symbol, coingecko_id, source, reason, status
       FROM public.valuation_asset_candidates
       WHERE id = $1
       FOR UPDATE`,
      [parsedId.data]
    );
    const candidate = candidateRows[0];
    if (!candidate) throw new AppError('Valuation candidate not found', 404);
    if (candidate.status !== 'proposed') {
      throw new ValidationError(`Candidate cannot be approved from status '${candidate.status}'`);
    }

    const coingeckoId = input.coingeckoId ?? candidate.coingecko_id;
    if (!coingeckoId) {
      throw new ValidationError('A CoinGecko id is required before this candidate can be approved');
    }
    const { rows: existingAssets } = await client.query<{ is_active: boolean }>(
      `SELECT is_active FROM public.valuation_assets WHERE symbol = $1 FOR UPDATE`,
      [candidate.symbol]
    );
    if (existingAssets[0]?.is_active) {
      throw new ValidationError(`${candidate.symbol} is already active in the valuation allowlist`);
    }

    const [asset] = (
      await client.query(
        `INSERT INTO public.valuation_assets
           (symbol, coingecko_id, asset_class, max_deviation_pct, haircut_pct, chain,
            contract_address, is_active, notes, source, added_reason, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11, $11)
         ON CONFLICT (symbol) DO UPDATE SET
           coingecko_id = EXCLUDED.coingecko_id,
           asset_class = EXCLUDED.asset_class,
           max_deviation_pct = EXCLUDED.max_deviation_pct,
           haircut_pct = EXCLUDED.haircut_pct,
           chain = EXCLUDED.chain,
           contract_address = EXCLUDED.contract_address,
           is_active = true,
           notes = EXCLUDED.notes,
           source = EXCLUDED.source,
           added_reason = EXCLUDED.added_reason,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
         WHERE public.valuation_assets.is_active = false
         RETURNING *`,
        [
          candidate.symbol,
          coingeckoId,
          input.assetClass,
          input.maxDeviationPct,
          input.haircutPct,
          input.chain ?? null,
          input.contractAddress ?? null,
          input.notes ?? null,
          candidate.source,
          input.addedReason,
          actorId,
        ]
      )
    ).rows;
    if (!asset) {
      throw new ValidationError(`Unable to promote candidate ${candidate.symbol}`);
    }

    await client.query(
      `UPDATE public.valuation_asset_candidates
       SET status = 'approved',
           reviewed_by = $2,
           reviewed_at = NOW(),
           review_notes = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [candidate.id, actorId, input.addedReason]
    );
    await client.query('COMMIT');
    committed = true;
    await reloadAllowlist();
    res.status(201).json({ asset });
  } catch (error) {
    if (client && !committed) {
      await client.query('ROLLBACK').catch((rollbackError: unknown) => {
        logger.error('Failed to roll back valuation candidate approval', {
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        });
      });
    }
    next(error);
  } finally {
    client?.release();
  }
});

router.post('/candidates/:id/reject', requireValuationAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const input = rejectCandidateSchema.parse(req.body);
    const [candidate] = await db
      .update(valuationAssetCandidates)
      .set({
        status: 'rejected',
        reviewedBy: getActorId(req),
        reviewedAt: new Date(),
        reviewNotes: input.reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(valuationAssetCandidates.id, id),
          eq(valuationAssetCandidates.status, 'proposed')
        )
      )
      .returning();
    if (!candidate) throw new AppError('Proposed valuation candidate not found', 404);
    res.json({ candidate });
  } catch (error) {
    next(error);
  }
});

router.get('/health/review', requireValuationAdmin, async (_req, res, next) => {
  try {
    const assets = await db
      .select()
      .from(valuationAssets)
      .where(and(eq(valuationAssets.isActive, true), eq(valuationAssets.reviewRequired, true)))
      .orderBy(asc(valuationAssets.reviewFlaggedAt), asc(valuationAssets.symbol));
    res.json({ assets });
  } catch (error) {
    next(error);
  }
});

router.post('/health/:symbol/resolve', requireValuationAdmin, async (req, res, next) => {
  try {
    const symbol = String(req.params.symbol).trim().toUpperCase();
    const [asset] = await db
      .update(valuationAssets)
      .set({
        reviewRequired: false,
        reviewResolvedAt: new Date(),
        reviewResolvedBy: getActorId(req),
        quorumFailureSince: new Date(),
        reviewReason: null,
        updatedBy: getActorId(req),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(valuationAssets.symbol, symbol),
          eq(valuationAssets.isActive, true),
          eq(valuationAssets.reviewRequired, true)
        )
      )
      .returning();
    if (!asset) throw new AppError('Active asset requiring review not found', 404);
    res.json({ asset, resolved: true });
  } catch (error) {
    next(error);
  }
});

router.get('/:symbol', requireValuationAdmin, async (req, res, next) => {
  try {
    const symbol = String(req.params.symbol).trim().toUpperCase();
    const [asset] = await db
      .select()
      .from(valuationAssets)
      .where(eq(valuationAssets.symbol, symbol))
      .limit(1);
    if (!asset) throw new AppError('Valuation asset not found', 404);
    res.json({ asset });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireValuationAdmin, async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const actorId = getActorId(req);
    const [asset] = await db
      .insert(valuationAssets)
      .values({
        symbol: input.symbol,
        coingeckoId: input.coingeckoId ?? null,
        assetClass: input.assetClass,
        maxDeviationPct: String(input.maxDeviationPct),
        haircutPct: String(input.haircutPct),
        chain: input.chain ?? null,
        contractAddress: input.contractAddress ?? null,
        notes: input.notes ?? null,
        isActive: input.isActive,
        source: 'manual',
        addedReason:
          input.addedReason ?? input.notes ?? 'Manually added through valuation-assets admin API',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .onConflictDoNothing({ target: valuationAssets.symbol })
      .returning();

    if (!asset) throw new ValidationError(`Valuation asset ${input.symbol} already exists`);
    await reloadAllowlist();
    res.status(201).json({ asset });
  } catch (error) {
    next(error);
  }
});

router.patch('/:symbol', requireValuationAdmin, async (req, res, next) => {
  try {
    const symbol = String(req.params.symbol).trim().toUpperCase();
    const input = patchSchema.parse(req.body);
    const [asset] = await db
      .update(valuationAssets)
      .set({
        ...(input.coingeckoId !== undefined ? { coingeckoId: input.coingeckoId } : {}),
        ...(input.assetClass !== undefined ? { assetClass: input.assetClass } : {}),
        ...(input.maxDeviationPct !== undefined
          ? { maxDeviationPct: String(input.maxDeviationPct) }
          : {}),
        ...(input.haircutPct !== undefined ? { haircutPct: String(input.haircutPct) } : {}),
        ...(input.chain !== undefined ? { chain: input.chain } : {}),
        ...(input.contractAddress !== undefined
          ? { contractAddress: input.contractAddress }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.addedReason !== undefined ? { addedReason: input.addedReason } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedBy: getActorId(req),
        updatedAt: new Date(),
      })
      .where(eq(valuationAssets.symbol, symbol))
      .returning();

    if (!asset) throw new AppError('Valuation asset not found', 404);
    await reloadAllowlist();
    res.json({ asset });
  } catch (error) {
    next(error);
  }
});

router.delete('/:symbol', requireValuationAdmin, async (req, res, next) => {
  try {
    const symbol = String(req.params.symbol).trim().toUpperCase();
    const [asset] = await db
      .update(valuationAssets)
      .set({ isActive: false, updatedBy: getActorId(req), updatedAt: new Date() })
      .where(eq(valuationAssets.symbol, symbol))
      .returning();
    if (!asset) throw new AppError('Valuation asset not found', 404);
    await reloadAllowlist();
    res.json({ asset, deactivated: true });
  } catch (error) {
    next(error);
  }
});

export default router;
