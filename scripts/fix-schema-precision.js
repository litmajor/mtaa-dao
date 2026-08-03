#!/usr/bin/env node
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    console.log('Checking current column precision...');
    const check = await pool.query(`
      SELECT column_name, udt_name, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'cross_chain_transfers' 
        AND column_name IN ('source_amount', 'target_amount')
    `);
    
    console.log('Current schema:', check.rows);
    
    console.log('Applying schema migration...');
    await pool.query(`
      ALTER TABLE cross_chain_transfers
        ALTER COLUMN source_amount TYPE decimal(38, 18),
        ALTER COLUMN target_amount TYPE decimal(38, 18)
    `);
    
    console.log('✓ Schema updated successfully');
    
    console.log('Verifying new schema...');
    const verify = await pool.query(`
      SELECT column_name, udt_name, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'cross_chain_transfers' 
        AND column_name IN ('source_amount', 'target_amount')
    `);
    
    console.log('Updated schema:', verify.rows);
    await pool.end();
  } catch (error) {
    console.error('✗ Error:', error.message);
    if (error.detail) console.error('  Detail:', error.detail);
    await pool.end();
    process.exit(1);
  }
})();
