
import { z } from 'zod';
import { db } from '../db';
import { users, daos } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Comprehensive validation schemas
export const daoCreationSchema = z.object({
  name: z.string()
    .min(3, 'DAO name must be at least 3 characters')
    .max(100, 'DAO name must not exceed 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'DAO name can only contain letters, numbers, spaces, hyphens, and underscores'),
  
  description: z.string()
    .min(20, 'Description must be at least 20 characters to help members understand the purpose')
    .max(2000, 'Description must not exceed 2000 characters'),
  
  daoType: z.enum(['savings', 'investment', 'community', 'funeral', 'wedding'], {
    errorMap: () => ({ message: 'Please select a valid DAO type' })
  }),
  
  governanceModel: z.enum(['1-person-1-vote', 'weighted-stake'], {
    errorMap: () => ({ message: 'Please select a governance model' })
  }),
  
  quorum: z.number()
    .min(20, 'Quorum must be at least 20% to ensure participation')
    .max(100, 'Quorum cannot exceed 100%'),
  
  votingPeriod: z.string()
    .regex(/^\d+[dhw]$/, 'Voting period must be in format: number followed by d (days), h (hours), or w (weeks)')
    .refine((val) => {
      const num = parseInt(val);
      const unit = val.slice(-1);
      if (unit === 'h') return num >= 24; // Minimum 24 hours
      if (unit === 'd') return num >= 1 && num <= 30; // 1-30 days
      if (unit === 'w') return num >= 1 && num <= 12; // 1-12 weeks
      return false;
    }, 'Voting period must be at least 24 hours and reasonable for your DAO type'),
  
  treasuryType: z.enum(['cusd', 'celo', 'dual'], {
    errorMap: () => ({ message: 'Please select a treasury type' })
  }),
  
  depositRequired: z.boolean(),
  
  minimumDeposit: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 10000;
  }, 'Minimum deposit must be between 0 and 10,000'),
  
  elders: z.array(z.string().uuid('Invalid elder user ID')).min(2, 'At least 2 elders are required for security').max(10, 'Maximum 10 elders allowed'),
  
  multisigEnabled: z.boolean(),
  
  requiredSignatures: z.number().optional().refine((val, ctx) => {
    if (ctx.parent.multisigEnabled && (!val || val < 2)) {
      return false;
    }
    return true;
  }, 'When multisig is enabled, at least 2 required signatures needed'),
  
  peerInviteEnabled: z.boolean()
});

export type DaoCreationInput = z.infer<typeof daoCreationSchema>;

/**
 * Server-side validation for DAO creation
 * Returns detailed validation errors or null if valid
 */
export async function validateDaoCreation(
  userId: string, 
  data: unknown
): Promise<{ valid: boolean; errors?: string[]; data?: DaoCreationInput }> {
  const errors: string[] = [];
  
  try {
    // Parse and validate input
    const validatedData = daoCreationSchema.parse(data);
    
    // Check user permissions
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user) {
      errors.push('User not found or not authenticated');
      return { valid: false, errors };
    }
    
    if (user.isBanned) {
      errors.push('Your account is suspended. Please contact support.');
      return { valid: false, errors };
    }
    
    // Check DAO creation eligibility (rate limiting, abuse prevention)
    const recentDaos = await db.select()
      .from(daos)
      .where(eq(daos.createdBy, userId))
      .orderBy(desc(daos.createdAt))
      .limit(1);
    
    if (recentDaos.length > 0) {
      const lastDaoCreated = new Date(recentDaos[0].createdAt);
      const hoursSinceLastDao = (Date.now() - lastDaoCreated.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastDao < 1) {
        errors.push('Please wait at least 1 hour between creating DAOs to prevent abuse');
        return { valid: false, errors };
      }
    }
    
    // Validate elders exist and are not banned
    const eldersData = await db.select()
      .from(users)
      .where(sql`${users.id} = ANY(${validatedData.elders})`);
    
    if (eldersData.length !== validatedData.elders.length) {
      errors.push('One or more selected elders not found');
      return { valid: false, errors };
    }
    
    const bannedElders = eldersData.filter(e => e.isBanned);
    if (bannedElders.length > 0) {
      errors.push('One or more selected elders have suspended accounts');
      return { valid: false, errors };
    }
    
    // Validate multisig requirements
    if (validatedData.multisigEnabled) {
      if (!validatedData.requiredSignatures || validatedData.requiredSignatures < 2) {
        errors.push('Multisig requires at least 2 required signatures');
        return { valid: false, errors };
      }
      
      if (validatedData.requiredSignatures > validatedData.elders.length) {
        errors.push('Required signatures cannot exceed number of elders');
        return { valid: false, errors };
      }
    }
    
    return { valid: true, data: validatedData };
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return { valid: false, errors: zodErrors };
    }
    
    return { valid: false, errors: ['Validation failed: ' + (error instanceof Error ? error.message : 'Unknown error')] };
  }
}
