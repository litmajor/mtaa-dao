import { pool } from '../../db';

export async function migrateAgentSubscriptions() {
  try {
    console.log('🔄 Running agent subscriptions and indexer checkpoint migrations...');

    // Create dao_agent_subscriptions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dao_agent_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dao_id UUID NOT NULL,
        agent_id VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created dao_agent_subscriptions table');

    // Create unique index
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_dao_agent_idx 
      ON dao_agent_subscriptions (dao_id, agent_id);
    `);
    console.log('✅ Created unique index unique_dao_agent_idx');

    // Create indexer_checkpoints table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS indexer_checkpoints (
        id VARCHAR(255) PRIMARY KEY,
        last_indexed_block INTEGER NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created indexer_checkpoints table');

    // Add foreign key constraint if 'daos' table exists
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'daos') THEN
          IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_dao_agent_subscriptions_dao'
          ) THEN
            ALTER TABLE dao_agent_subscriptions
            ADD CONSTRAINT fk_dao_agent_subscriptions_dao 
            FOREIGN KEY (dao_id) REFERENCES daos(id) ON DELETE CASCADE;
          END IF;
        END IF;
      END $$;
    `);
    console.log('✅ Created foreign key constraint on dao_agent_subscriptions');

    return true;
  } catch (error) {
    console.error('❌ Error running agent subscriptions migration:', error);
    throw error;
  }
}

export async function rollbackAgentSubscriptions() {
  try {
    console.log('🔄 Rolling back agent subscriptions and indexer checkpoint migrations...');

    await pool.query('DROP TABLE IF EXISTS dao_agent_subscriptions CASCADE;');
    await pool.query('DROP TABLE IF EXISTS indexer_checkpoints CASCADE;');

    console.log('✅ Rollback completed');
    return true;
  } catch (error) {
    console.error('❌ Error rolling back agent subscriptions migration:', error);
    throw error;
  }
}
