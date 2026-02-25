import { z } from 'zod';

// Base schemas
export const chainNameSchema = z.string().toLowerCase().trim().refine(
  (val) => ['celo', 'ethereum', 'polygon', 'optimism', 'arbitrum', 'bsc', 'tron', 'ton', 'solana'].includes(val),
  { message: 'Unsupported chain' }
);

// EVM address (0x...), Solana address (44 base58), or TRON address (T... base58)
export const addressSchema = z.string().trim().refine(
  (val) => /^0x[0-9a-fA-F]{40}$/.test(val) || // EVM: 0x + 40 hex chars
          /^[1-9A-HJ-NP-Z]{44}$/.test(val) ||   // Solana: 44 base58 chars
          /^T[1-9A-HJ-NP-Z]{33}$/.test(val),    // TRON: T + 33 base58 chars
  { message: 'Invalid address format (EVM: 0x..., Solana: base58, or TRON: T...)' }
);

export const amountSchema = z.string().trim().refine(
  (val) => /^\d+(\.\d+)?$/.test(val) && parseFloat(val) > 0,
  { message: 'Invalid amount - must be positive number' }
);

// Transfer schemas
export const transferSchema = z.object({
  sourceChain: chainNameSchema,
  destinationChain: chainNameSchema,
  tokenAddress: addressSchema,
  amount: amountSchema,
  destinationAddress: addressSchema,
  vaultId: z.string().optional()
}).refine(
  (data) => data.sourceChain !== data.destinationChain,
  { message: 'Source and destination chains must be different' }
);

// Fees schemas
export const feesSchema = z.object({
  sourceChain: chainNameSchema,
  destinationChain: chainNameSchema,
  amount: amountSchema
}).refine(
  (data) => data.sourceChain !== data.destinationChain,
  { message: 'Source and destination chains must be different' }
);

// Swap schemas
export const swapQuoteSchema = z.object({
  fromChain: chainNameSchema,
  toChain: chainNameSchema,
  fromToken: z.string().toUpperCase().trim().refine(
    (val) => /^[A-Z0-9]{2,10}$/.test(val),
    { message: 'Invalid token symbol' }
  ),
  toToken: z.string().toUpperCase().trim().refine(
    (val) => /^[A-Z0-9]{2,10}$/.test(val),
    { message: 'Invalid token symbol' }
  ),
  fromAmount: amountSchema,
  slippageTolerance: z.number().min(0).max(100).optional().default(1.0)
}).refine(
  (data) => data.fromChain !== data.toChain,
  { message: 'Source and destination chains must be different' }
);

export const swapExecuteSchema = z.object({
  quote: z.object({}).passthrough(),
  userAddress: addressSchema
});

// Solana-specific schemas
export const solanaAddressSchema = z.string().trim().refine(
  (val) => /^[1-9A-HJ-NP-Z]{44}$/.test(val),
  { message: 'Invalid Solana address format (must be 44 character base58)' }
);

export const solanaTokenMintSchema = z.string().trim().refine(
  (val) => /^[1-9A-HJ-NP-Z]{44}$/.test(val),
  { message: 'Invalid token mint address format' }
);

export const solanaBalanceQuerySchema = z.object({
  address: solanaAddressSchema,
  tokenMint: solanaTokenMintSchema.optional() // Optional - if omitted, returns SOL balance
});

export const solanaTransferSchema = z.object({
  fromAddress: solanaAddressSchema,
  toAddress: solanaAddressSchema,
  mint: solanaTokenMintSchema,
  amount: amountSchema
});

export const solanaSignTransactionSchema = z.object({
  address: solanaAddressSchema,
  transaction: z.string(),
  signers: z.array(solanaAddressSchema)
});

// TRON-specific schemas
export const tronAddressSchema = z.string().trim().refine(
  (val) => /^T[1-9A-HJ-NP-Z]{33}$/.test(val),
  { message: 'Invalid TRON address format (must start with T)' }
);

export const tronTransferSchema = z.object({
  fromAddress: tronAddressSchema,
  toAddress: tronAddressSchema,
  amount: amountSchema,
  tokenAddress: z.string().optional(),
  feeLimit: z.number().min(0).optional()
});

export const tronSignTransactionSchema = z.object({
  address: tronAddressSchema,
  transaction: z.string()
});

// Governance schemas
export const governanceProposalSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  startTime: z.number().min(Math.floor(Date.now() / 1000)),
  endTime: z.number(),
  options: z.array(z.string().min(1)).min(2),
  targetChains: z.array(chainNameSchema).min(1)
}).refine(
  (data) => data.endTime > data.startTime,
  { message: 'End time must be after start time' }
);

export const governanceVoteSchema = z.object({
  proposalId: z.string(),
  option: z.number().min(0),
  userAddress: addressSchema
});

// Vault schemas
export const vaultSchema = z.object({
  chains: z.array(chainNameSchema).min(2),
  name: z.string().min(1).max(255)
});
