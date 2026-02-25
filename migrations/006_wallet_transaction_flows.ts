/**
 * Phase 6: Wallet System - Transaction Flow Tables
 * Adds deposit, withdrawal, and internal transfer tracking
 */

export async function up() {
  return `
    -- Deposits Table
    CREATE TABLE IF NOT EXISTS deposits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      source VARCHAR(50) NOT NULL CHECK (source IN ('offramp_flutterwave', 'offramp_paystack', 'offramp_paychant', 'offramp_kotani', 'offramp_mpesa', 'offramp_airtel', 'external_wallet')),
      amount DECIMAL(18, 8) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'USDC',
      fee_amount DECIMAL(18, 8) DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
      transaction_hash VARCHAR(255),
      external_reference VARCHAR(255),
      gateway_reference VARCHAR(255),
      gateway_response JSONB,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX idx_deposits_user_id ON deposits(user_id);
    CREATE INDEX idx_deposits_status ON deposits(status);
    CREATE INDEX idx_deposits_created_at ON deposits(created_at);
    CREATE INDEX idx_deposits_source ON deposits(source);

    -- Withdrawals Table
    CREATE TABLE IF NOT EXISTS withdrawals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      destination VARCHAR(50) NOT NULL CHECK (destination IN ('offramp_flutterwave', 'offramp_paystack', 'offramp_paychant', 'offramp_kotani', 'offramp_mpesa', 'offramp_airtel', 'external_wallet', 'micro_withdrawal', 'internal_transfer')),
      destination_address VARCHAR(255),
      amount DECIMAL(18, 8) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'USDC',
      fee_amount DECIMAL(18, 8) DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'processing')),
      transaction_hash VARCHAR(255),
      micro_withdrawal_id UUID REFERENCES micro_withdrawals(id),
      gateway_reference VARCHAR(255),
      gateway_response JSONB,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);
    CREATE INDEX idx_withdrawals_from_account_id ON withdrawals(from_account_id);
    CREATE INDEX idx_withdrawals_status ON withdrawals(status);
    CREATE INDEX idx_withdrawals_created_at ON withdrawals(created_at);
    CREATE INDEX idx_withdrawals_destination ON withdrawals(destination);

    -- Internal Transfers Table
    CREATE TABLE IF NOT EXISTS internal_transfers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      to_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      amount DECIMAL(18, 8) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'USDC',
      reason VARCHAR(50) NOT NULL CHECK (reason IN ('trading', 'savings', 'profit_lock', 'rebalance', 'manual')),
      status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX idx_internal_transfers_user_id ON internal_transfers(user_id);
    CREATE INDEX idx_internal_transfers_from_account_id ON internal_transfers(from_account_id);
    CREATE INDEX idx_internal_transfers_to_account_id ON internal_transfers(to_account_id);
    CREATE INDEX idx_internal_transfers_reason ON internal_transfers(reason);
    CREATE INDEX idx_internal_transfers_created_at ON internal_transfers(created_at);
  `;
}

export async function down() {
  return `
    DROP TABLE IF EXISTS internal_transfers CASCADE;
    DROP TABLE IF EXISTS withdrawals CASCADE;
    DROP TABLE IF EXISTS deposits CASCADE;
  `;
}
