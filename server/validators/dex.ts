import { z } from 'zod';

const CHAIN_ENUM = z.enum(['ethereum','solana','polygon','bsc','base','arbitrum']).optional();

export const searchPairsQuerySchema = z.object({
  q: z.string().min(1, 'Query parameter q is required'),
  chains: z.string().optional(),
  limit: z.preprocess((val) => (val === undefined ? undefined : Number(val)), z.number().int().min(1).max(100).optional()),
});

export const syncSymbolUniverseBodySchema = z.object({
  chains: z.array(z.string()).optional(),
  minLiquidity: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().nonnegative().optional()),
  minVolume: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().nonnegative().optional()),
  limitPerChain: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().min(1).max(500).optional()),
  retryCount: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().min(0).max(5).optional()),
});

export type SearchPairsQuery = typeof searchPairsQuerySchema;
