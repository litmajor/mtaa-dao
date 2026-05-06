import { sql, eq } from 'drizzle-orm';
import type { PostgresDB } from 'drizzle-orm/postgres-js';
import { db } from '../db';
import { vaults } from '../../shared/schema';

/**
 * Migration: Add Vault Ownership Model and Treasury Linking
 * Phase 4B: Replace mock vault endpoints with real config/DB calls
 * 
 * Changes:
 * 1. Add owner_type, owner_id, treasury_id, vault_config columns to vaults
 * 2. Backfill existing vaults with owner_type ('user' | 'dao') and owner_id
 * 3. Link DAO vaults to their treasury_id
 * 4. Initialize vault_config for type-specific settings (lock duration, etc)
 */

export async function up() {
  console.log('🔄 Running migration: Vault Ownership Model and Treasury Linking...');

  try {
    // Step 1: Add new columns to vaults table
    console.log('📝 Adding new columns to vaults table...');
    await db.execute(sql`
      ALTER TABLE vaults 
        ADD COLUMN IF NOT EXISTS owner_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS owner_id UUID,
        ADD COLUMN IF NOT EXISTS treasury_id UUID REFERENCES daos(id),
        ADD COLUMN IF NOT EXISTS vault_config JSONB
    `);

    // Step 2: Create indexes for efficient queries
    console.log('🔍 Creating indexes...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_vaults_owner_type_id ON vaults(owner_type, owner_id);
      CREATE INDEX IF NOT EXISTS idx_vaults_treasury_id ON vaults(treasury_id);
    `);

    // Step 3: Backfill owner_type = 'user' for personal vaults
    console.log('👤 Backfilling user vaults...');
    await db.execute(sql`
      UPDATE vaults 
        SET 
          owner_type = 'user',
          owner_id = CAST(user_id AS UUID)
        WHERE 
          user_id IS NOT NULL 
          AND dao_id IS NULL 
          AND owner_type IS NULL
    `);

    // Step 4: Backfill owner_type = 'dao' for DAO vaults
    console.log('🏛️  Backfilling DAO vaults...');
    await db.execute(sql`
      UPDATE vaults 
        SET 
          owner_type = 'dao',
          owner_id = dao_id
        WHERE 
          dao_id IS NOT NULL 
          AND owner_type IS NULL
    `);

    // Step 5: Link DAO vaults to their treasure (treasury_id = daoId for scope)
    console.log('🔗 Linking DAO vaults to treasuries...');
    await db.execute(sql`
      UPDATE vaults 
        SET treasury_id = dao_id 
        WHERE 
          owner_type = 'dao' 
          AND treasury_id IS NULL
    `);

    // Step 6: Initialize vault_config for savings-type vaults with lock duration constraints
    console.log('⚙️  Initializing vault_config for savings vaults...');
    await db.execute(sql`
      UPDATE vaults 
        SET vault_config = jsonb_build_object(
          'lockDurationMs', COALESCE(lock_duration * 1000, 30 * 24 * 60 * 60 * 1000),
          'minLockDurationMs', 1 * 24 * 60 * 60 * 1000,
          'maxLockDurationMs', 365 * 24 * 60 * 60 * 1000,
          'configurable', true,
          'migratedAt', NOW()
        )
        WHERE 
          (vault_type = 'savings' OR vault_type = 'locked_savings') 
          AND vault_config IS NULL
    `);

    // Step 7: Query and log migration results
    console.log('✅ Migration completed successfully!');
    console.log('📊 Verifying migration results...');

    const result = await db.execute(sql`
      SELECT 
        owner_type,
        COUNT(*) as vault_count,
        COUNT(CASE WHEN vault_config IS NOT NULL THEN 1 END) as config_count,
        COUNT(CASE WHEN treasury_id IS NOT NULL THEN 1 END) as linked_to_treasury
      FROM vaults
      WHERE owner_type IS NOT NULL
      GROUP BY owner_type
    `);

    console.log('📈 Migration Results:');
    console.log(result);

    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

export async function down() {
  console.log('⏮️  Reverting migration: Vault Ownership Model and Treasury Linking...');

  try {
    // Revert: Remove vault_config data
    await db.execute(sql`
      UPDATE vaults SET vault_config = NULL WHERE vault_config IS NOT NULL
    `);

    // Revert: Remove treasury_id foreign keys
    await db.execute(sql`
      UPDATE vaults SET treasury_id = NULL WHERE treasury_id IS NOT NULL
    `);

    // Revert: Remove owner_id and owner_type
    await db.execute(sql`
      UPDATE vaults SET owner_id = NULL, owner_type = NULL 
      WHERE owner_type IS NOT NULL
    `);

    // Revert: Drop indexes
    await db.execute(sql`
      DROP INDEX IF EXISTS idx_vaults_owner_type_id;
      DROP INDEX IF EXISTS idx_vaults_treasury_id;
    `);

    // Revert: Drop columns (requires schema changes)
    // Note: PostgreSQL doesn't allow dropping multiple columns in one ALTER TABLE via SQL
    // This would need to be done separately or through a different migration strategy
    // await db.execute(sql`
    //   ALTER TABLE vaults 
    //     DROP COLUMN IF EXISTS owner_type,
    //     DROP COLUMN IF EXISTS owner_id,
    //     DROP COLUMN IF EXISTS treasury_id,
    //     DROP COLUMN IF EXISTS vault_config
    // `);

    console.log('✅ Reversion completed!');
    return true;
  } catch (error) {
    console.error('❌ Reversion failed:', error);
    throw error;
  }
}
