import { pool } from '../../db';

export async function migratePaymentDomainTables() {
  try {
    console.log('🔄 Running payment domain migrations...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_user_id VARCHAR NOT NULL,
        to_user_id VARCHAR,
        to_address VARCHAR,
        amount DECIMAL(18, 8) NOT NULL,
        currency VARCHAR NOT NULL,
        description TEXT,
        qr_code TEXT,
        celo_uri TEXT,
        status VARCHAR DEFAULT 'pending',
        expires_at TIMESTAMP,
        paid_at TIMESTAMP,
        transaction_hash VARCHAR,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (from_user_id) REFERENCES users(id),
        FOREIGN KEY (to_user_id) REFERENCES users(id)
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_requests_from_user_id ON payment_requests(from_user_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_requests_to_user_id ON payment_requests(to_user_id);
    `);
    console.log('✅ Created payment_requests table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        user_id TEXT NOT NULL,
        reference TEXT NOT NULL,
        type TEXT NOT NULL,
        amount TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'KES',
        provider TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        metadata JSON,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_reference ON payment_transactions(reference);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
    `);
    console.log('✅ Created payment_transactions table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vault_id UUID REFERENCES vaults(id),
        from_user_id VARCHAR REFERENCES users(id),
        to_user_id VARCHAR REFERENCES users(id),
        wallet_address VARCHAR NOT NULL,
        dao_id UUID REFERENCES daos(id),
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR DEFAULT 'cUSD',
        type VARCHAR NOT NULL,
        status VARCHAR DEFAULT 'completed',
        transaction_hash VARCHAR,
        description TEXT,
        disbursement_id VARCHAR,
        stable_inflow_event_id UUID,
        stable_units_microusd NUMERIC(38, 0),
        chain_id INTEGER,
        token_address VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_address ON wallet_transactions(wallet_address);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_dao_id ON wallet_transactions(dao_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_vault_id ON wallet_transactions(vault_id);
    `);
    console.log('✅ Created wallet_transactions table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID REFERENCES wallet_transactions(id),
        payment_request_id UUID REFERENCES payment_requests(id),
        receipt_number VARCHAR NOT NULL,
        pdf_url TEXT,
        email_sent BOOLEAN DEFAULT FALSE,
        email_sent_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_receipts_receipt_number ON payment_receipts(receipt_number);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_receipts_transaction_id ON payment_receipts(transaction_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_receipts_payment_request_id ON payment_receipts(payment_request_id);
    `);
    console.log('✅ Created payment_receipts table');

    console.log('✅ Payment domain migrations completed successfully');
  } catch (error: any) {
    console.error('❌ Payment domain migration failed:', error.message);
    throw error;
  }
}

export async function rollbackPaymentDomainTables() {
  try {
    console.log('🔄 Rolling back payment domain tables...');

    await pool.query(`DROP TABLE IF EXISTS payment_receipts CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS wallet_transactions CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS payment_transactions CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS payment_requests CASCADE;`);

    console.log('✅ Rolled back payment domain tables');
  } catch (error: any) {
    console.error('❌ Payment domain rollback failed:', error.message);
    throw error;
  }
}
