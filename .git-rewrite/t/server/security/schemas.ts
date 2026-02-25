
import { z } from 'zod';
import { sanitizedStringSchema, sanitizedEmailSchema, sanitizedAmountSchema } from './inputSanitizer';

// Authentication schemas
export const loginSchema = z.object({
  email: sanitizedEmailSchema,
  password: z.string().min(8).max(100),
});

export const registerSchema = z.object({
  email: sanitizedEmailSchema,
  password: z.string().min(8).max(100),
  name: sanitizedStringSchema.refine(val => val.length <= 100, { message: "Name must be at most 100 characters" }),
  role: z.enum(['user', 'contributor', 'admin']).optional(),
});

// Proposal schemas
export const proposalSchema = z.object({
  title: sanitizedStringSchema.refine(val => val.length <= 200, { message: "Title must be at most 200 characters" }),
  description: sanitizedStringSchema.refine(val => val.length <= 5000, { message: "Description must be at most 5000 characters" }),
  amount: sanitizedAmountSchema.optional(),
  category: z.enum(['governance', 'funding', 'technical', 'community']),
  daoId: z.string().uuid(),
});

// Vault schemas
export const vaultDepositSchema = z.object({
  amount: sanitizedAmountSchema,
  vaultType: z.enum(['personal', 'community']),
  token: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
});

export const vaultWithdrawalSchema = z.object({
  amount: sanitizedAmountSchema,
  vaultId: z.string().uuid(),
  recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid recipient address'),
});

// Payment schemas
export const paymentSchema = z.object({
  amount: sanitizedAmountSchema,
  recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid recipient address'),
  description: sanitizedStringSchema.refine(val => val.length <= 500, { message: "Description must be at most 500 characters" }).optional(),
  paymentMethod: z.enum(['crypto', 'mpesa', 'kotanipay', 'stripe']),
});

// User profile schemas
export const profileUpdateSchema = z.object({
  name: sanitizedStringSchema.refine(val => val.length <= 100, { message: "Name must be at most 100 characters" }).optional(),
  bio: sanitizedStringSchema.refine(val => val.length <= 500, { message: "Bio must be at most 500 characters" }).optional(),
  avatar: z.string().url().optional(),
  location: sanitizedStringSchema.refine(val => val.length <= 100, { message: "Location must be at most 100 characters" }).optional(),
});
