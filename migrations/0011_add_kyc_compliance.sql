
-- KYC Verifications Table
CREATE TABLE IF NOT EXISTS kyc_verifications (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Verification data
  email TEXT,
  email_verified BOOLEAN DEFAULT false,
  phone TEXT,
  phone_verified BOOLEAN DEFAULT false,
  
  -- Document verification
  id_document_type TEXT,
  id_document_number TEXT,
  id_document_front_url TEXT,
  id_document_back_url TEXT,
  id_verification_status TEXT,
  
  -- Proof of address
  proof_of_address_type TEXT,
  proof_of_address_url TEXT,
  address_verification_status TEXT,
  
  -- Personal information
  first_name TEXT,
  last_name TEXT,
  date_of_birth TEXT,
  nationality TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  
  -- Verification metadata
  verification_provider TEXT,
  verification_reference TEXT,
  verification_data JSONB,
  
  -- AML screening
  aml_screening_status TEXT,
  aml_screening_provider TEXT,
  aml_screening_reference TEXT,
  aml_screening_data JSONB,
  
  -- Transaction limits
  daily_limit INTEGER DEFAULT 100,
  monthly_limit INTEGER DEFAULT 3000,
  annual_limit INTEGER DEFAULT 10000,
  
  -- Review and approval
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  notes TEXT,
  
  -- Timestamps
  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Compliance Audit Logs Table
CREATE TABLE IF NOT EXISTS compliance_audit_logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  severity TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Suspicious Activities Table
CREATE TABLE IF NOT EXISTS suspicious_activities (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Detection details
  detected_by TEXT,
  detection_rules JSONB,
  related_transactions JSONB,
  
  -- Investigation
  investigated_by TEXT,
  investigation_notes TEXT,
  investigated_at TIMESTAMP,
  
  -- Resolution
  resolution TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMP,
  
  -- Reporting
  reported_to_authorities BOOLEAN DEFAULT false,
  report_reference TEXT,
  reported_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_kyc_user ON kyc_verifications(user_id);
CREATE INDEX idx_kyc_status ON kyc_verifications(status);
CREATE INDEX idx_kyc_tier ON kyc_verifications(tier);
CREATE INDEX idx_audit_user ON compliance_audit_logs(user_id);
CREATE INDEX idx_audit_event ON compliance_audit_logs(event_type);
CREATE INDEX idx_suspicious_user ON suspicious_activities(user_id);
CREATE INDEX idx_suspicious_status ON suspicious_activities(status);
CREATE INDEX idx_suspicious_severity ON suspicious_activities(severity);

-- Add verification_level to users if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'verification_level') THEN
    ALTER TABLE users ADD COLUMN verification_level TEXT DEFAULT 'none';
  END IF;
END $$;
