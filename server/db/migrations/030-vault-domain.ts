import { pool } from '../../db';

export async function migrateVaultDomainTables() {
  try {
    console.log('🔄 Running vault domain migrations...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vaults (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id),
        dao_id UUID REFERENCES daos(id),
        creator_id VARCHAR REFERENCES users(id),
        name VARCHAR DEFAULT 'Personal Vault',
        description TEXT,
        currency VARCHAR NOT NULL,
        address VARCHAR,
        balance DECIMAL(18,8) DEFAULT 0,
        monthly_goal DECIMAL(18,8) DEFAULT 0,
        vault_type VARCHAR DEFAULT 'regular',
        lock_duration INTEGER,
        locked_until TIMESTAMP,
        interest_rate DECIMAL(5,4) DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        status VARCHAR DEFAULT 'ACTIVE',
        version INTEGER DEFAULT 1,
        risk_level VARCHAR DEFAULT 'low',
        min_deposit DECIMAL(18,8) DEFAULT 0,
        max_deposit DECIMAL(18,8),
        total_value_locked DECIMAL(18,8) DEFAULT 0,
        share_supply DECIMAL(18,8) DEFAULT 0,
        yield_generated DECIMAL(18,8) DEFAULT 0,
        yield_strategy VARCHAR,
        performance_fee DECIMAL(5,4) DEFAULT 0.1,
        management_fee DECIMAL(5,4) DEFAULT 0.02,
        owner_type VARCHAR,
        owner_id UUID,
        treasury_id UUID REFERENCES daos(id),
        vault_config JSONB,
        manager_role_grant_tx VARCHAR,
        rebalancer_role_grant_tx VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Created vaults table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vault_token_holdings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vault_id UUID NOT NULL REFERENCES vaults(id),
        token_symbol VARCHAR NOT NULL,
        balance DECIMAL(18,8) NOT NULL,
        value_usd DECIMAL(18,8) DEFAULT 0,
        last_price_update TIMESTAMP DEFAULT NOW(),
        average_entry_price DECIMAL(18,8),
        total_deposited DECIMAL(18,8) DEFAULT 0,
        total_withdrawn DECIMAL(18,8) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vault_token_holdings_vault_id ON vault_token_holdings(vault_id);`);
    console.log('✅ Created vault_token_holdings table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vault_performance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vault_id UUID NOT NULL REFERENCES vaults(id),
        period VARCHAR NOT NULL,
        period_start TIMESTAMP NOT NULL,
        period_end TIMESTAMP NOT NULL,
        starting_value DECIMAL(18,8) NOT NULL,
        ending_value DECIMAL(18,8) NOT NULL,
        yield DECIMAL(18,8) DEFAULT 0,
        yield_percentage DECIMAL(8,4) DEFAULT 0,
        fees_collected DECIMAL(18,8) DEFAULT 0,
        deposits DECIMAL(18,8) DEFAULT 0,
        withdrawals DECIMAL(18,8) DEFAULT 0,
        sharpe_ratio DECIMAL(8,4),
        max_drawdown DECIMAL(8,4),
        volatility DECIMAL(8,4),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vault_performance_vault_id ON vault_performance(vault_id);`);
    console.log('✅ Created vault_performance table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vault_strategy_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vault_id UUID NOT NULL REFERENCES vaults(id),
        strategy_id VARCHAR NOT NULL,
        token_symbol VARCHAR NOT NULL,
        allocated_amount DECIMAL(18,8) NOT NULL,
        allocation_percentage DECIMAL(5,2) NOT NULL,
        current_value DECIMAL(18,8) DEFAULT 0,
        yield_earned DECIMAL(18,8) DEFAULT 0,
        last_rebalance TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vault_strategy_allocations_vault_id ON vault_strategy_allocations(vault_id);`);
    console.log('✅ Created vault_strategy_allocations table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vault_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vault_id UUID NOT NULL REFERENCES vaults(id),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        transaction_type VARCHAR NOT NULL,
        token_symbol VARCHAR NOT NULL,
        amount DECIMAL(18,8) NOT NULL,
        value_usd DECIMAL(18,8) DEFAULT 0,
        transaction_hash VARCHAR,
        block_number INTEGER,
        gas_used DECIMAL(18,8),
        gas_fee DECIMAL(18,8),
        status VARCHAR DEFAULT 'completed',
        strategy_id VARCHAR,
        shares_minted DECIMAL(18,8),
        shares_burned DECIMAL(18,8),
        metadata JSONB,
        provider VARCHAR DEFAULT 'unknown',
        from_address VARCHAR,
        timestamp TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vault_transactions_vault_id ON vault_transactions(vault_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vault_transactions_user_id ON vault_transactions(user_id);`);
    console.log('✅ Created vault_transactions table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vault_risk_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vault_id UUID NOT NULL REFERENCES vaults(id),
        assessment_date TIMESTAMP DEFAULT NOW(),
        overall_risk_score INTEGER NOT NULL,
        liquidity_risk INTEGER DEFAULT 0,
        smart_contract_risk INTEGER DEFAULT 0,
        market_risk INTEGER DEFAULT 0,
        concentration_risk INTEGER DEFAULT 0,
        protocol_risk INTEGER DEFAULT 0,
        risk_factors JSONB,
        recommendations JSONB,
        next_assessment_due TIMESTAMP,
        assessed_by VARCHAR REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vault_risk_assessments_vault_id ON vault_risk_assessments(vault_id);`);
    console.log('✅ Created vault_risk_assessments table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vault_governance_proposals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vault_id UUID NOT NULL REFERENCES vaults(id),
        dao_id UUID NOT NULL REFERENCES daos(id),
        proposal_id UUID REFERENCES proposals(id),
        governance_type VARCHAR NOT NULL,
        proposed_changes JSONB NOT NULL,
        current_parameters JSONB,
        required_quorum INTEGER DEFAULT 50,
        voting_deadline TIMESTAMP NOT NULL,
        status VARCHAR DEFAULT 'active',
        executed_at TIMESTAMP,
        execution_tx_hash VARCHAR,
        created_by VARCHAR NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vault_governance_proposals_vault_id ON vault_governance_proposals(vault_id);`);
    console.log('✅ Created vault_governance_proposals table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS withdrawal_approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vault_id UUID NOT NULL REFERENCES vaults(id),
        dao_id UUID NOT NULL REFERENCES daos(id),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        amount DECIMAL(25,8) NOT NULL,
        destination VARCHAR NOT NULL,
        status VARCHAR DEFAULT 'pending' NOT NULL,
        required_signatures INTEGER NOT NULL,
        current_signatures INTEGER DEFAULT 0 NOT NULL,
        signers JSONB DEFAULT '[]',
        expires_at TIMESTAMP NOT NULL,
        executed_at TIMESTAMP,
        executed_by VARCHAR REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_withdrawal_approvals_vault_id ON withdrawal_approvals(vault_id);`);
    console.log('✅ Created withdrawal_approvals table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS multisig_signatures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        approval_id UUID NOT NULL REFERENCES withdrawal_approvals(id),
        signer_id VARCHAR NOT NULL REFERENCES users(id),
        signer_role VARCHAR NOT NULL,
        signature TEXT NOT NULL,
        signed_at TIMESTAMP DEFAULT NOW() NOT NULL,
        ip_address VARCHAR,
        is_valid BOOLEAN DEFAULT TRUE NOT NULL,
        verification_error TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_multisig_signatures_approval_id ON multisig_signatures(approval_id);`);
    console.log('✅ Created multisig_signatures table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vault_withdrawal_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vault_id UUID NOT NULL REFERENCES vaults(id),
        date DATE NOT NULL,
        daily_total_withdrawn DECIMAL(25,8) NOT NULL DEFAULT 0,
        withdrawal_count INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT unique_vault_date UNIQUE (vault_id, date)
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vault_withdrawal_tracking_vault_id ON vault_withdrawal_tracking(vault_id);`);
    console.log('✅ Created vault_withdrawal_tracking table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vault_id UUID REFERENCES vaults(id),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        transaction_type VARCHAR NOT NULL,
        amount DECIMAL(18,8),
        token_symbol VARCHAR,
        status VARCHAR DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 5,
        tx_hash VARCHAR,
        error_message TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pending_transactions_vault_id ON pending_transactions(vault_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pending_transactions_user_id ON pending_transactions(user_id);`);
    console.log('✅ Created pending_transactions table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS locked_savings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        vault_id UUID NOT NULL REFERENCES vaults(id),
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR DEFAULT 'cUSD',
        lock_period INTEGER NOT NULL,
        interest_rate DECIMAL(5,4) DEFAULT 0.05,
        locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
        unlocks_at TIMESTAMP NOT NULL,
        status VARCHAR DEFAULT 'locked',
        penalty DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_locked_savings_vault_id ON locked_savings(vault_id);`);
    console.log('✅ Created locked_savings table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS savings_goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        title VARCHAR NOT NULL,
        description TEXT,
        target_amount DECIMAL(10,2) NOT NULL,
        current_amount DECIMAL(10,2) DEFAULT 0,
        currency VARCHAR DEFAULT 'KES',
        target_date TIMESTAMP,
        category VARCHAR DEFAULT 'general',
        is_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);`);
    console.log('✅ Created savings_goals table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS loan_facilities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dao_id UUID NOT NULL REFERENCES daos(id),
        address VARCHAR,
        stablecoin VARCHAR,
        elder_council VARCHAR,
        funded_amount DECIMAL(18,8) DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_loan_facilities_dao_id ON loan_facilities(dao_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_loan_facilities_address ON loan_facilities(address);`);
    console.log('✅ Created loan_facilities table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS budget_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        category VARCHAR NOT NULL,
        allocated_amount DECIMAL(10,2) NOT NULL,
        spent_amount DECIMAL(10,2) DEFAULT 0,
        month VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_budget_plans_user_id ON budget_plans(user_id);`);
    console.log('✅ Created budget_plans table');

    console.log('✅ Vault domain migrations completed successfully');
  } catch (error: any) {
    console.error('❌ Vault domain migration failed:', error.message);
    throw error;
  }
}

export async function rollbackVaultDomainTables() {
  try {
    console.log('🔄 Rolling back vault domain tables...');

    await pool.query(`DROP TABLE IF EXISTS budget_plans CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS loan_facilities CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS savings_goals CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS locked_savings CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS pending_transactions CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS vault_withdrawal_tracking CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS multisig_signatures CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS withdrawal_approvals CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS vault_governance_proposals CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS vault_risk_assessments CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS vault_transactions CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS vault_strategy_allocations CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS vault_performance CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS vault_token_holdings CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS vaults CASCADE;`);

    console.log('✅ Rolled back vault domain tables');
  } catch (error: any) {
    console.error('❌ Vault domain rollback failed:', error.message);
    throw error;
  }
}
