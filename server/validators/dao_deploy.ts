import { z } from 'zod';

const ethAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');
const uuidOrAddress = z.union([ethAddress, z.string().uuid()]);

export const daoDataSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  daoType: z.string().min(1),
  category: z.string().optional(),
  causeTags: z.array(z.string()).optional(),
  primaryCause: z.string().optional(),
  treasuryType: z.enum(['cusd', 'dual', 'custom']).optional(),
  customTokenAddress: ethAddress.optional(),
  durationDays: z.number().int().positive().optional(),
  rotationFrequency: z.enum(['weekly', 'monthly', 'quarterly']).optional(),
});

export const daoDeploySchema = z.object({
  daoData: daoDataSchema,
  founderWallet: uuidOrAddress,
  invitedMembers: z.array(uuidOrAddress).optional(),
  selectedElders: z.array(uuidOrAddress).min(1),
  multisig: z
    .object({
      enabled: z.boolean().optional(),
      signers: z.array(uuidOrAddress).optional(),
      requiredSignatures: z.number().int().min(1).max(10).optional(),
      contractAddress: ethAddress.optional(),
    })
    .optional(),
});

export type DaoDeploySchema = typeof daoDeploySchema;
