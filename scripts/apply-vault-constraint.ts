/**
 * PRIORITY 2 Issue #3: Apply Vault Ownership Constraint Migration
 * 
 * This script applies the SQL migration to add a CHECK constraint
 * ensuring every vault belongs to exactly one owner (user OR DAO).
 * 
 * Usage: npx tsx scripts/apply-vault-constraint.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

async function applyMigration() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    // Read the migration file
    const migrationPath = resolve('migrations/0031_add_vault_ownership_constraint.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('🔄 Applying vault ownership constraint migration...');
    console.log('📝 SQL:');
    console.log(migrationSQL);
    console.log('\n');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement) {
        console.log(`⏳ Executing: ${statement.substring(0, 80)}...`);
        await pool.query(statement);
        console.log(`✅ Success`);
      }
    }
    
    // Verify constraint exists
    console.log('\n🔍 Verifying constraint...');
    const result = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints
      WHERE table_name = 'vaults' AND constraint_name = 'vault_owner_check'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Constraint "vault_owner_check" successfully created!');
    } else {
      console.error('❌ Constraint verification failed');
      process.exit(1);
    }
    
    // Check for any existing orphaned vaults
    console.log('\n🔍 Checking for orphaned vaults...');
    const orphanedResult = await pool.query(`
      SELECT COUNT(*) as count FROM vaults 
      WHERE (user_id IS NULL AND dao_id IS NULL)
      OR (user_id IS NOT NULL AND dao_id IS NOT NULL)
    `);
    
    const orphanedCount = parseInt(orphanedResult.rows[0].count);
    if (orphanedCount === 0) {
      console.log('✅ No orphaned vaults found');
    } else {
      console.warn(`⚠️  WARNING: Found ${orphanedCount} orphaned vault(s)`);
      console.warn('   These vaults violate the new constraint and should be fixed');
    }
    
    // Display vault distribution
    console.log('\n📊 Vault distribution:');
    const distributionResult = await pool.query(`
      SELECT 
        CASE 
          WHEN user_id IS NOT NULL THEN 'Personal Vault'
          WHEN dao_id IS NOT NULL THEN 'DAO Vault'
        END as vault_type,
        COUNT(*) as count
      FROM vaults
      WHERE user_id IS NOT NULL OR dao_id IS NOT NULL
      GROUP BY vault_type
    `);
    
    for (const row of distributionResult.rows) {
      console.log(`   ${row.vault_type}: ${row.count}`);
    }
    
    console.log('\n✨ Migration completed successfully!');
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
