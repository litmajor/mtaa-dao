-- Add plan and plan_expires_at to daos table
ALTER TABLE daos ADD COLUMN plan VARCHAR(20) DEFAULT 'free';
ALTER TABLE daos ADD COLUMN plan_expires_at TIMESTAMP;

-- Create billing_history table for DAOs
CREATE TABLE billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id UUID REFERENCES daos(id) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'KES',
  status VARCHAR(20) DEFAULT 'paid',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
