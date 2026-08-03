import { pool } from '../../db';

export async function migrateTreasuryDomainTables() {
  try {
    console.log('🔄 Running treasury domain migrations...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS dao_multisig_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
        required_approvals INTEGER NOT NULL DEFAULT 2,
        total_signers INTEGER NOT NULL,
        signer_addresses JSONB DEFAULT '[]',
        withdrawal_threshold DECIMAL(18,2) DEFAULT 1000.00,
        roles_allowed_to_approve JSONB DEFAULT '["admin","elder"]',
        auto_complete_on_threshold BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_dao_multisig_config_dao_id ON dao_multisig_config(dao_id);`);
    console.log('✅ Created dao_multisig_config table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS treasury_positions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
        treasury_vault_id UUID REFERENCES vaults(id) ON DELETE SET NULL,
        asset_node_id VARCHAR NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        chain VARCHAR(20) NOT NULL,
        contract_address VARCHAR(255) NOT NULL,
        balance DECIMAL(18,8) NOT NULL DEFAULT 0,
        balance_usd DECIMAL(18,2),
        cost_basis DECIMAL(18,2),
        acquisition_timestamp TIMESTAMP,
        last_rebalance_timestamp TIMESTAMP,
        asset_class VARCHAR(30),
        risk_level VARCHAR(20),
        dao_type VARCHAR(30),
        treasury_mode VARCHAR(30),
        treasury_size VARCHAR(30),
        risk_profile VARCHAR(30),
        next_distribution_window TIMESTAMP,
        needs_liquidity_by TIMESTAMP,
        yield_earned DECIMAL(18,8) DEFAULT 0,
        yield_strategy VARCHAR(50),
        exit_liquidity VARCHAR(20),
        exit_time_at_5_percent_slippage INTEGER,
        bridge_cost_if_moving DECIMAL(5,2),
        rebalance_deviation DECIMAL(5,2),
        is_locked_until TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_positions_dao_id ON treasury_positions(dao_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_positions_symbol ON treasury_positions(symbol);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_positions_chain ON treasury_positions(chain);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_positions_dao_type ON treasury_positions(dao_type);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_positions_next_distribution ON treasury_positions(next_distribution_window);`);
    console.log('✅ Created treasury_positions table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS treasury_multisig_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dao_id UUID NOT NULL REFERENCES daos(id),
        multisig_wallet_id UUID NOT NULL REFERENCES multisig_wallets(id),
        proposed_by VARCHAR NOT NULL REFERENCES users(id),
        transaction_type VARCHAR NOT NULL,
        amount DECIMAL(18,2) NOT NULL,
        currency VARCHAR DEFAULT 'cUSD',
        recipient VARCHAR,
        purpose TEXT NOT NULL,
        contract_function VARCHAR,
        params JSONB,
        required_signatures INTEGER NOT NULL,
        current_signatures INTEGER DEFAULT 0,
        signers JSONB DEFAULT '[]',
        status VARCHAR DEFAULT 'pending',
        approved_at TIMESTAMP,
        submitted_at TIMESTAMP,
        submitted_tx_hash VARCHAR,
        executed_at TIMESTAMP,
        execution_tx_hash VARCHAR,
        expires_at TIMESTAMP NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_multisig_transactions_dao_id ON treasury_multisig_transactions(dao_id);`);
    console.log('✅ Created treasury_multisig_transactions table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS treasury_withdrawal_approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
        withdrawal_id UUID NOT NULL REFERENCES wallet_transactions(id) ON DELETE CASCADE,
        approver_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        approved BOOLEAN NOT NULL,
        voted_at TIMESTAMP DEFAULT NOW(),
        comment TEXT
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_withdrawal_approvals_withdrawal_id ON treasury_withdrawal_approvals(withdrawal_id);`);
    console.log('✅ Created treasury_withdrawal_approvals table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS treasury_budget_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dao_id UUID NOT NULL REFERENCES daos(id),
        category VARCHAR NOT NULL,
        allocated_amount DECIMAL(18,2) NOT NULL,
        spent_amount DECIMAL(18,2) DEFAULT 0,
        remaining_amount DECIMAL(18,2) NOT NULL,
        period VARCHAR NOT NULL,
        period_start TIMESTAMP NOT NULL,
        period_end TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by VARCHAR NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_budget_allocations_dao_id ON treasury_budget_allocations(dao_id);`);
    console.log('✅ Created treasury_budget_allocations table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS treasury_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dao_id UUID NOT NULL REFERENCES daos(id),
        actor_id VARCHAR NOT NULL REFERENCES users(id),
        action VARCHAR NOT NULL,
        amount DECIMAL(18,2),
        previous_balance DECIMAL(18,2),
        new_balance DECIMAL(18,2),
        category VARCHAR,
        reason TEXT NOT NULL,
        multisig_tx_id UUID REFERENCES treasury_multisig_transactions(id),
        transaction_hash VARCHAR,
        ip_address VARCHAR,
        metadata JSONB,
        severity VARCHAR DEFAULT 'medium',
        timestamp TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_audit_log_dao_id ON treasury_audit_log(dao_id);`);
    console.log('✅ Created treasury_audit_log table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS treasury_reconciliation_audits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reconciliation_type VARCHAR NOT NULL,
        entity_id UUID NOT NULL,
        computed_value DECIMAL(20,8) NOT NULL,
        on_chain_value DECIMAL(20,8) NOT NULL,
        discrepancy DECIMAL(20,8) NOT NULL,
        discrepancy_percent DECIMAL(5,4) NOT NULL,
        reconciliation_status VARCHAR DEFAULT 'matched' NOT NULL,
        last_on_chain_check TIMESTAMP NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_reconciliation_audits_entity_id ON treasury_reconciliation_audits(entity_id);`);
    console.log('✅ Created treasury_reconciliation_audits table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS treasury_approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
        transaction_id VARCHAR,
        recipient_address VARCHAR(42) NOT NULL,
        amount DECIMAL(18,8) NOT NULL,
        amount_usd DECIMAL(18,2) NOT NULL,
        description TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        required_signatures INTEGER NOT NULL,
        signatures JSONB DEFAULT '[]',
        rejection_reason TEXT,
        rejected_by VARCHAR REFERENCES users(id),
        rejected_at TIMESTAMP,
        executed_at TIMESTAMP,
        executed_by VARCHAR REFERENCES users(id),
        expires_at TIMESTAMP NOT NULL,
        created_by VARCHAR NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_approvals_dao_id ON treasury_approvals(dao_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_approvals_status ON treasury_approvals(status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_approvals_expires_at ON treasury_approvals(expires_at);`);
    console.log('✅ Created treasury_approvals table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS treasury_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
        transaction_id VARCHAR,
        recipient_address VARCHAR(42) NOT NULL,
        amount DECIMAL(18,8) NOT NULL,
        amount_usd DECIMAL(18,2),
        description TEXT,
        status VARCHAR(20) NOT NULL,
        whitelist_approved BOOLEAN NOT NULL DEFAULT FALSE,
        amount_validated BOOLEAN NOT NULL DEFAULT FALSE,
        multisig_required BOOLEAN NOT NULL DEFAULT FALSE,
        multisig_approved BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_transactions_dao_id ON treasury_transactions(dao_id);`);
    console.log('✅ Created treasury_transactions table');

    console.log('✅ Treasury domain migrations completed successfully');
  } catch (error: any) {
    console.error('❌ Treasury domain migration failed:', error.message);
    throw error;
  }
}

export async function rollbackTreasuryDomainTables() {
  try {
    console.log('🔄 Rolling back treasury domain tables...');

    await pool.query(`DROP TABLE IF EXISTS treasury_transactions CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS treasury_approvals CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS treasury_reconciliation_audits CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS treasury_audit_log CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS treasury_budget_allocations CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS treasury_withdrawal_approvals CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS treasury_multisig_transactions CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS treasury_positions CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS dao_multisig_config CASCADE;`);

    console.log('✅ Rolled back treasury domain tables');
  } catch (error: any) {
    console.error('❌ Treasury domain rollback failed:', error.message);
    throw error;
  }
}
