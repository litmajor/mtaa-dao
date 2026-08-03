import { pool } from '../../db';

export async function migrateInvestmentPoolsTables() {
  try {
    console.log('🔄 Running investment pool migrations...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS investment_pools (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dao_id UUID REFERENCES daos(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        symbol VARCHAR(10) NOT NULL,
        description TEXT,
        contract_address VARCHAR(255),
        total_value_locked DECIMAL(18,8) DEFAULT 0,
        share_token_supply DECIMAL(18,8) DEFAULT 0,
        share_price DECIMAL(18,8) DEFAULT 1.0,
        performance_fee INTEGER DEFAULT 200,
        minimum_investment DECIMAL(18,2) DEFAULT 10.00,
        is_active BOOLEAN DEFAULT TRUE,
        created_by VARCHAR REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_investment_pools_dao_id ON investment_pools(dao_id);`);
    console.log('✅ Created investment_pools table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pool_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pool_id UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
        asset_symbol VARCHAR(10) NOT NULL,
        asset_name VARCHAR(100),
        token_address VARCHAR(255),
        network VARCHAR(50),
        target_allocation INTEGER NOT NULL,
        current_balance DECIMAL(18,8) DEFAULT 0,
        current_value_usd DECIMAL(18,2) DEFAULT 0,
        last_price_usd DECIMAL(18,2),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pool_assets_pool_id ON pool_assets(pool_id);`);
    console.log('✅ Created pool_assets table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pool_investments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pool_id UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        investment_amount_usd DECIMAL(18,2) NOT NULL,
        shares_minted DECIMAL(18,8) NOT NULL,
        share_price_at_investment DECIMAL(18,8) NOT NULL,
        payment_token VARCHAR(50),
        transaction_hash VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        invested_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pool_investments_pool_id ON pool_investments(pool_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pool_investments_user_id ON pool_investments(user_id);`);
    console.log('✅ Created pool_investments table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pool_withdrawals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pool_id UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        shares_burned DECIMAL(18,8) NOT NULL,
        withdrawal_value_usd DECIMAL(18,2) NOT NULL,
        share_price_at_withdrawal DECIMAL(18,8) NOT NULL,
        fee_charged DECIMAL(18,2) DEFAULT 0,
        net_amount DECIMAL(18,2),
        transaction_hash VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        withdrawn_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pool_withdrawals_pool_id ON pool_withdrawals(pool_id);`);
    console.log('✅ Created pool_withdrawals table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pool_rebalances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pool_id UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
        initiated_by VARCHAR REFERENCES users(id),
        tvl_before DECIMAL(18,2),
        tvl_after DECIMAL(18,2),
        assets_changed JSONB,
        transaction_hash VARCHAR(255),
        reason TEXT,
        status VARCHAR(50) DEFAULT 'completed',
        rebalanced_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pool_rebalances_pool_id ON pool_rebalances(pool_id);`);
    console.log('✅ Created pool_rebalances table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pool_performance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pool_id UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
        tvl DECIMAL(18,2),
        share_price DECIMAL(18,8),
        total_return_percentage DECIMAL(10,4),
        btc_price DECIMAL(18,2),
        eth_price DECIMAL(18,2),
        sol_price DECIMAL(18,2),
        bnb_price DECIMAL(18,2),
        xrp_price DECIMAL(18,2),
        ltc_price DECIMAL(18,2),
        volatility DECIMAL(10,4),
        sharpe_ratio DECIMAL(10,4),
        snapshot_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pool_performance_pool_id ON pool_performance(pool_id);`);
    console.log('✅ Created pool_performance table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pool_swap_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pool_id UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
        rebalance_id UUID REFERENCES pool_rebalances(id),
        from_asset VARCHAR(10) NOT NULL,
        to_asset VARCHAR(10) NOT NULL,
        amount_from DECIMAL(18,8) NOT NULL,
        amount_to DECIMAL(18,8) NOT NULL,
        exchange_rate DECIMAL(18,8),
        dex_used VARCHAR(50),
        transaction_hash VARCHAR(255),
        gas_fee DECIMAL(18,8),
        status VARCHAR(50) DEFAULT 'pending',
        swapped_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pool_swap_transactions_pool_id ON pool_swap_transactions(pool_id);`);
    console.log('✅ Created pool_swap_transactions table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pool_proposals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pool_id UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        proposal_type VARCHAR(50) NOT NULL,
        details JSONB,
        total_voting_power DECIMAL(18,8) DEFAULT 0,
        votes_for DECIMAL(18,8) DEFAULT 0,
        votes_against DECIMAL(18,8) DEFAULT 0,
        votes_abstain DECIMAL(18,8) DEFAULT 0,
        quorum_required DECIMAL(5,2) DEFAULT 30.00,
        approval_threshold DECIMAL(5,2) DEFAULT 51.00,
        status VARCHAR(50) DEFAULT 'active',
        created_by VARCHAR REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        voting_ends_at TIMESTAMP NOT NULL,
        executed_at TIMESTAMP,
        execution_tx_hash VARCHAR(255),
        execution_result JSONB
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pool_proposals_pool_id ON pool_proposals(pool_id);`);
    console.log('✅ Created pool_proposals table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pool_votes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        proposal_id UUID NOT NULL REFERENCES pool_proposals(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vote VARCHAR(20) NOT NULL,
        voting_power DECIMAL(18,8) NOT NULL,
        share_percentage DECIMAL(10,6),
        reason TEXT,
        voted_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pool_votes_proposal_id ON pool_votes(proposal_id);`);
    console.log('✅ Created pool_votes table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pool_governance_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pool_id UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
        default_quorum DECIMAL(5,2) DEFAULT 30.00,
        default_approval_threshold DECIMAL(5,2) DEFAULT 51.00,
        voting_period_days INTEGER DEFAULT 3,
        min_shares_to_propose DECIMAL(18,8) DEFAULT 1.0,
        proposal_cooldown_hours INTEGER DEFAULT 24,
        timelock_hours INTEGER DEFAULT 24,
        governance_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pool_governance_settings_pool_id ON pool_governance_settings(pool_id);`);
    console.log('✅ Created pool_governance_settings table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pool_vote_delegations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pool_id UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
        delegator_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        delegate_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        delegated_shares DECIMAL(18,8) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        delegated_at TIMESTAMP DEFAULT NOW(),
        revoked_at TIMESTAMP
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pool_vote_delegations_pool_id ON pool_vote_delegations(pool_id);`);
    console.log('✅ Created pool_vote_delegations table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS portfolio_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        risk_level VARCHAR(50) NOT NULL,
        target_return_annual DECIMAL(5,2),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Created portfolio_templates table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS template_asset_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID NOT NULL REFERENCES portfolio_templates(id) ON DELETE CASCADE,
        asset_symbol VARCHAR(10) NOT NULL,
        target_allocation INTEGER NOT NULL
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_template_asset_allocations_template_id ON template_asset_allocations(template_id);`);
    console.log('✅ Created template_asset_allocations table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS rebalancing_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pool_id UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
        auto_rebalance_enabled BOOLEAN DEFAULT FALSE,
        rebalance_frequency VARCHAR(50) DEFAULT 'weekly',
        rebalance_threshold INTEGER DEFAULT 500,
        last_rebalance_check TIMESTAMP,
        next_rebalance_scheduled TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_rebalancing_settings_pool_id ON rebalancing_settings(pool_id);`);
    console.log('✅ Created rebalancing_settings table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS asset_price_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_symbol VARCHAR(10) NOT NULL,
        price_usd DECIMAL(18,2) NOT NULL,
        market_cap DECIMAL(20,2),
        volume_24h DECIMAL(20,2),
        price_change_24h DECIMAL(10,4),
        recorded_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_asset_price_history_asset_symbol ON asset_price_history(asset_symbol);`);
    console.log('✅ Created asset_price_history table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS liquidity_pool_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pool_address VARCHAR NOT NULL,
        chain_id VARCHAR NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        total_liquidity NUMERIC(20,8) DEFAULT 0,
        volume_24h NUMERIC(20,8) DEFAULT 0,
        fee_24h NUMERIC(20,8) DEFAULT 0,
        token_a_balance NUMERIC(20,8) DEFAULT 0,
        token_b_balance NUMERIC(20,8) DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_liquidity_pool_metrics_address ON liquidity_pool_metrics(pool_address);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_liquidity_pool_metrics_chain_id ON liquidity_pool_metrics(chain_id);`);
    console.log('✅ Created liquidity_pool_metrics table');

    console.log('✅ Investment pool and trading metrics migrations completed successfully');
  } catch (error: any) {
    console.error('❌ Investment pool migration failed:', error.message);
    throw error;
  }
}

export async function rollbackInvestmentPoolsTables() {
  try {
    console.log('🔄 Rolling back investment pool tables...');

    await pool.query(`DROP TABLE IF EXISTS liquidity_pool_metrics CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS asset_price_history CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS rebalancing_settings CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS template_asset_allocations CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS portfolio_templates CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS pool_vote_delegations CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS pool_governance_settings CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS pool_votes CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS pool_proposals CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS pool_swap_transactions CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS pool_performance CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS pool_rebalances CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS pool_withdrawals CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS pool_investments CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS pool_assets CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS investment_pools CASCADE;`);

    console.log('✅ Rolled back investment pool tables');
  } catch (error: any) {
    console.error('❌ Investment pool rollback failed:', error.message);
    throw error;
  }
}
