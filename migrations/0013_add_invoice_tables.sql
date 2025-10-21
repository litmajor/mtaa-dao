
-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR NOT NULL UNIQUE,
  from_user_id VARCHAR REFERENCES users(id) NOT NULL,
  to_user_id VARCHAR REFERENCES users(id),
  dao_id UUID REFERENCES daos(id),
  amount DECIMAL(18, 8) NOT NULL,
  currency VARCHAR NOT NULL DEFAULT 'cUSD',
  description TEXT NOT NULL,
  line_items JSONB DEFAULT '[]',
  status VARCHAR NOT NULL DEFAULT 'draft',
  due_date TIMESTAMP,
  paid_at TIMESTAMP,
  payment_method VARCHAR,
  transaction_hash VARCHAR,
  notes TEXT,
  terms_and_conditions TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Invoice payments table
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) NOT NULL,
  payer_id VARCHAR REFERENCES users(id) NOT NULL,
  amount DECIMAL(18, 8) NOT NULL,
  currency VARCHAR NOT NULL,
  payment_method VARCHAR NOT NULL,
  transaction_hash VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoices_from_user ON invoices(from_user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_to_user ON invoices(to_user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_dao ON invoices(dao_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
