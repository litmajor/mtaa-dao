import { pool } from '../../db';

export async function migrateMonitoringMetricsTables() {
  try {
    console.log('🔄 Running monitoring metrics tables migration...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS platform_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        total_daos INTEGER NOT NULL DEFAULT 0,
        active_daos INTEGER NOT NULL DEFAULT 0,
        total_members INTEGER NOT NULL DEFAULT 0,
        total_vaults INTEGER NOT NULL DEFAULT 0,
        active_vaults INTEGER NOT NULL DEFAULT 0,
        total_tvl NUMERIC(20,8) NOT NULL DEFAULT 0,
        total_transactions INTEGER NOT NULL DEFAULT 0,
        total_fees NUMERIC(20,8) NOT NULL DEFAULT 0,
        total_revenue NUMERIC(20,8) NOT NULL DEFAULT 0,
        cpu_usage NUMERIC(5,2) DEFAULT 0,
        memory_usage NUMERIC(5,2) DEFAULT 0,
        disk_usage NUMERIC(5,2) DEFAULT 0,
        network_latency INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS defi_protocol_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        protocol_name VARCHAR NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        tvl NUMERIC(20,8) DEFAULT 0,
        total_users INTEGER DEFAULT 0,
        status VARCHAR DEFAULT 'active',
        last_update TIMESTAMP NOT NULL DEFAULT NOW(),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cefi_exchange_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        exchange_name VARCHAR NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        volume_24h NUMERIC(20,8) DEFAULT 0,
        users INTEGER DEFAULT 0,
        status VARCHAR DEFAULT 'active',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS blockchain_health_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chain_name VARCHAR NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        block_height INTEGER DEFAULT 0,
        transaction_count INTEGER DEFAULT 0,
        average_block_time NUMERIC(10,2) DEFAULT 0,
        network_health_score NUMERIC(5,2) DEFAULT 100,
        status VARCHAR DEFAULT 'healthy',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS revenue_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date TEXT NOT NULL,
        total_revenue NUMERIC(20,8) NOT NULL DEFAULT 0,
        transaction_fees NUMERIC(20,8) NOT NULL DEFAULT 0,
        platform_fees NUMERIC(20,8) NOT NULL DEFAULT 0,
        other_revenue NUMERIC(20,8) NOT NULL DEFAULT 0,
        revenue_by_source JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_provider_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_name VARCHAR NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        success_rate NUMERIC(5,2) DEFAULT 0,
        total_transactions INTEGER DEFAULT 0,
        total_volume NUMERIC(20,8) DEFAULT 0,
        status VARCHAR DEFAULT 'active',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_performance_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id VARCHAR NOT NULL,
        date TEXT NOT NULL,
        tasks_completed INTEGER NOT NULL DEFAULT 0,
        success_rate NUMERIC(5,2) DEFAULT 0,
        average_response_time NUMERIC(10,2) DEFAULT 0,
        user_satisfaction NUMERIC(5,2) DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_usage_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date TEXT NOT NULL,
        total_requests INTEGER NOT NULL DEFAULT 0,
        successful_requests INTEGER NOT NULL DEFAULT 0,
        failed_requests INTEGER NOT NULL DEFAULT 0,
        average_response_time NUMERIC(10,2) DEFAULT 0,
        total_data_transferred NUMERIC(20,8) DEFAULT 0,
        top_endpoints JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS platform_growth_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date TEXT NOT NULL,
        new_users INTEGER NOT NULL DEFAULT 0,
        total_users INTEGER NOT NULL DEFAULT 0,
        user_retention NUMERIC(5,2) DEFAULT 0,
        new_daos INTEGER NOT NULL DEFAULT 0,
        total_daos INTEGER NOT NULL DEFAULT 0,
        monthly_active_users INTEGER NOT NULL DEFAULT 0,
        weekly_active_users INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS referral_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date TEXT NOT NULL,
        total_referrals INTEGER NOT NULL DEFAULT 0,
        new_referrals_today INTEGER NOT NULL DEFAULT 0,
        referred_users_count INTEGER NOT NULL DEFAULT 0,
        referred_users_active INTEGER NOT NULL DEFAULT 0,
        total_referral_rewards NUMERIC(20,8) NOT NULL DEFAULT 0,
        rewards_distributed_today NUMERIC(20,8) NOT NULL DEFAULT 0,
        average_reward_per_referral NUMERIC(20,8) NOT NULL DEFAULT 0,
        top_referrer_count INTEGER DEFAULT 0,
        average_referrals_per_user NUMERIC(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reward_distribution (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_id VARCHAR NOT NULL,
        reward_type VARCHAR NOT NULL,
        date TEXT NOT NULL,
        amount NUMERIC(20,8) NOT NULL DEFAULT 0,
        status VARCHAR NOT NULL DEFAULT 'pending',
        distribution_date TIMESTAMP,
        source VARCHAR DEFAULT 'activities',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_ticket_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date TIMESTAMP NOT NULL DEFAULT NOW(),
        total_tickets INTEGER NOT NULL DEFAULT 0,
        open_tickets INTEGER NOT NULL DEFAULT 0,
        in_progress_tickets INTEGER NOT NULL DEFAULT 0,
        resolved_tickets INTEGER NOT NULL DEFAULT 0,
        closed_tickets INTEGER NOT NULL DEFAULT 0,
        avg_first_response_time NUMERIC(10,2) DEFAULT 0,
        avg_resolution_time NUMERIC(10,2) DEFAULT 0,
        resolution_rate NUMERIC(5,2) DEFAULT 0,
        satisfaction_score NUMERIC(3,1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      ALTER TABLE support_ticket_metrics
        ADD COLUMN IF NOT EXISTS in_progress_tickets INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS closed_tickets INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS avg_first_response_time NUMERIC(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS avg_resolution_time NUMERIC(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS resolution_rate NUMERIC(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS satisfaction_score NUMERIC(3,1) DEFAULT 0;
    `);
    await pool.query(`
      ALTER TABLE support_ticket_metrics
        ALTER COLUMN date TYPE TIMESTAMP USING date::timestamp;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS dao_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dao_id UUID REFERENCES daos(id),
        dao_type VARCHAR,
        region VARCHAR,
        cause VARCHAR,
        member_count INTEGER NOT NULL DEFAULT 0,
        treasury_value NUMERIC(20,8) NOT NULL DEFAULT 0,
        proposal_count INTEGER NOT NULL DEFAULT 0,
        health_score INTEGER DEFAULT 100,
        growth_rate NUMERIC(5,2) DEFAULT 0,
        record_date TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS leaderboard_rankings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL,
        ranking_type VARCHAR NOT NULL,
        rank INTEGER NOT NULL,
        score INTEGER NOT NULL,
        stars INTEGER DEFAULT 0,
        contributions INTEGER NOT NULL DEFAULT 0,
        trend VARCHAR DEFAULT 'stable',
        record_date TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Monitoring metrics tables migration completed successfully');
  } catch (error: any) {
    console.error('❌ Monitoring metrics migration failed:', error.message);
    throw error;
  }
}

export async function rollbackMonitoringMetricsTables() {
  try {
    console.log('🔄 Rolling back monitoring metrics tables...');

    await pool.query(`DROP TABLE IF EXISTS leaderboard_rankings CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS dao_analytics CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS support_ticket_metrics CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS reward_distribution CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS referral_metrics CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS platform_growth_metrics CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS api_usage_metrics CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS agent_performance_metrics CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS payment_provider_metrics CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS revenue_metrics CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS blockchain_health_metrics CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS cefi_exchange_metrics CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS defi_protocol_metrics CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS platform_metrics CASCADE;`);

    console.log('✅ Rolled back monitoring metrics tables');
  } catch (error: any) {
    console.error('❌ Monitoring metrics tables rollback failed:', error.message);
    throw error;
  }
}
