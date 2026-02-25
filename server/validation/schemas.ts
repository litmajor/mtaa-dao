import { z } from 'zod';

/**
 * Week 2: Input Validation Schemas using Zod
 * 
 * Provides centralized validation for all API endpoints
 * - Prevents invalid data from reaching handlers
 * - Provides consistent error messages
 * - Documents expected input format
 */

// ============================================================================
// Authentication & Authorization Schemas
// ============================================================================

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain uppercase, lowercase, and numbers'
  ),
  firstName: z.string().min(1, 'First name required').max(50),
  lastName: z.string().min(1, 'Last name required').max(50),
});

export const TokenRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token required'),
});

// ============================================================================
// DAO Management Schemas
// ============================================================================

export const CreateDAOSchema = z.object({
  name: z.string().min(1, 'DAO name required').max(100),
  description: z.string().max(1000).optional(),
  treasuryBalance: z.string().regex(/^\d+(\.\d{1,18})?$/, 'Invalid balance format'),
});

export const UpdateDAOSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  treasuryBalance: z.string().regex(/^\d+(\.\d{1,18})?$/, 'Invalid balance format').optional(),
});

export const DAOIdSchema = z.object({
  daoId: z.string().uuid('Invalid DAO ID format'),
});

// ============================================================================
// Proposal Execution Schemas
// ============================================================================

export const ProposalExecutionQueueSchema = z.object({
  daoId: z.string().uuid('Invalid DAO ID'),
  proposalId: z.string().uuid('Invalid proposal ID'),
  executionType: z.enum([
    'treasury_transfer',
    'vault_operation',
    'member_action',
    'governance_change',
    'disbursement',
  ]),
  executionData: z.record(z.unknown()).optional(),
  scheduledFor: z.coerce.date().optional(),
});

export const ExecuteProposalSchema = z.object({
  daoId: z.string().uuid('Invalid DAO ID'),
  proposalId: z.string().uuid('Invalid proposal ID'),
});

export const CancelExecutionSchema = z.object({
  daoId: z.string().uuid('Invalid DAO ID'),
  executionId: z.string().uuid('Invalid execution ID'),
});

// ============================================================================
// Treasury Transfer Schemas
// ============================================================================

export const TreasuryTransferSchema = z.object({
  daoId: z.string().uuid('Invalid DAO ID'),
  recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  amount: z.number().positive('Amount must be positive').max(10_000_000, 'Amount exceeds maximum'),
  currency: z.string().min(1).max(10),
  description: z.string().max(500).optional(),
  fromVault: z.boolean().optional(),
});

export const BulkTransferSchema = z.object({
  daoId: z.string().uuid('Invalid DAO ID'),
  transfers: z.array(
    z.object({
      recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid recipient address'),
      amount: z.number().positive(),
      currency: z.string().min(1).max(10),
    })
  ).min(1, 'At least one transfer required').max(100, 'Maximum 100 transfers allowed'),
});

// ============================================================================
// Vault Operation Schemas
// ============================================================================

export const VaultDepositSchema = z.object({
  vaultId: z.string().uuid('Invalid vault ID'),
  userId: z.string().uuid('Invalid user ID'),
  tokenSymbol: z.string().min(1).max(10),
  amount: z.string().regex(/^\d+(\.\d{1,18})?$/, 'Invalid amount format'),
});

export const VaultWithdrawalSchema = z.object({
  vaultId: z.string().uuid('Invalid vault ID'),
  userId: z.string().uuid('Invalid user ID'),
  tokenSymbol: z.string().min(1).max(10),
  amount: z.string().regex(/^\d+(\.\d{1,18})?$/, 'Invalid amount format'),
  transactionHash: z.string().optional(),
});

// ============================================================================
// Governance Schemas
// ============================================================================

export const CreateProposalSchema = z.object({
  daoId: z.string().uuid('Invalid DAO ID'),
  title: z.string().min(5, 'Title too short').max(200),
  description: z.string().min(10, 'Description too short').max(5000),
  proposalType: z.enum([
    'treasury_allocation',
    'member_action',
    'governance_change',
    'disbursement',
  ]),
  votingDeadline: z.coerce.date().refine(
    (date) => date > new Date(),
    'Voting deadline must be in the future'
  ),
});

export const VoteOnProposalSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
  vote: z.enum(['for', 'against', 'abstain']),
  weight: z.number().positive().optional(),
});

// ============================================================================
// Member Management Schemas
// ============================================================================

export const AddDAOMemberSchema = z.object({
  daoId: z.string().uuid('Invalid DAO ID'),
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['owner', 'admin', 'member']),
});

export const UpdateMemberRoleSchema = z.object({
  daoId: z.string().uuid('Invalid DAO ID'),
  userId: z.string().uuid('Invalid user ID'),
  newRole: z.enum(['owner', 'admin', 'member']),
});

export const RemoveDAOMemberSchema = z.object({
  daoId: z.string().uuid('Invalid DAO ID'),
  userId: z.string().uuid('Invalid user ID'),
});

// ============================================================================
// Payment/Billing Schemas
// ============================================================================

export const CreateBillSplitSchema = z.object({
  daoId: z.string().uuid('Invalid DAO ID').optional(),
  userId: z.string().uuid('Invalid user ID'),
  title: z.string().min(1).max(200),
  totalAmount: z.number().positive('Amount must be positive'),
  currency: z.string().min(1).max(10),
  participants: z.array(
    z.object({
      userId: z.string().uuid('Invalid participant ID'),
      sharePercentage: z.number().positive().max(100),
    })
  ).min(2, 'At least 2 participants required'),
});

export const PayBillSchema = z.object({
  billSplitId: z.string().uuid('Invalid bill split ID'),
  amount: z.number().positive('Amount must be positive'),
});

export const CreateRecurringPaymentSchema = z.object({
  daoId: z.string().uuid('Invalid DAO ID').optional(),
  userId: z.string().uuid('Invalid user ID'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().min(1).max(10),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  recipients: z.array(
    z.object({
      userId: z.string().uuid('Invalid recipient ID'),
      percentage: z.number().positive().max(100),
    })
  ).min(1, 'At least one recipient required'),
});

// ============================================================================
// Admin Schemas
// ============================================================================

export const UserListQuerySchema = z.object({
  page: z.string().regex(/^\d+$/, 'Invalid page number').transform(Number).optional(),
  limit: z.string().regex(/^\d+$/, 'Invalid limit').transform(Number).optional(),
  search: z.string().max(100).optional(),
  role: z.string().optional(),
  status: z.enum(['active', 'banned']).optional(),
});

export const BanUserSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  banned: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const UpdateUserRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  newRole: z.enum(['user', 'moderator', 'admin', 'super_admin']),
});

// ============================================================================
// Query Schemas
// ============================================================================

export const PaginationSchema = z.object({
  page: z.string().regex(/^\d+$/, 'Invalid page').transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/, 'Invalid limit').transform(Number).default('20'),
});

export const DateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine(
  (data) => !data.startDate || !data.endDate || data.startDate <= data.endDate,
  { message: 'Start date must be before end date' }
);

// ============================================================================
// Type Exports (for TypeScript)
// ============================================================================

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type TokenRefreshInput = z.infer<typeof TokenRefreshSchema>;
export type CreateDAOInput = z.infer<typeof CreateDAOSchema>;
export type UpdateDAOInput = z.infer<typeof UpdateDAOSchema>;
export type ProposalExecutionInput = z.infer<typeof ProposalExecutionQueueSchema>;
export type TreasuryTransferInput = z.infer<typeof TreasuryTransferSchema>;
export type CreateProposalInput = z.infer<typeof CreateProposalSchema>;
export type VoteOnProposalInput = z.infer<typeof VoteOnProposalSchema>;
export type CreateBillSplitInput = z.infer<typeof CreateBillSplitSchema>;
export type CreateRecurringPaymentInput = z.infer<typeof CreateRecurringPaymentSchema>;

/**
 * Validation helper to safely parse and validate input
 * Returns either parsed data or structured error information
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: Record<string, string[]>;
} {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });
      return { success: false, errors };
    }
    return { 
      success: false, 
      errors: { general: ['Validation failed'] } 
    };
  }
}
