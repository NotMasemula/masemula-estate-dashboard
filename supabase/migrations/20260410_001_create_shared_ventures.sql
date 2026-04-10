-- Migration: 001 — Create Shared Ventures Schema
-- Created: 2026-04-10
-- Description: Core tables for shared venture management between two parties

-- ============================================================
-- SHARED VENTURES
-- ============================================================

CREATE TABLE IF NOT EXISTS shared_ventures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'setup'
    CHECK (status IN ('setup', 'active', 'paused', 'closed')),

  -- Participants
  owner_user_id TEXT NOT NULL,
  partner_user_id TEXT,

  -- Split configuration
  owner_profit_share NUMERIC(5, 2) NOT NULL DEFAULT 50.00
    CHECK (owner_profit_share >= 0 AND owner_profit_share <= 100),
  partner_profit_share NUMERIC(5, 2) NOT NULL DEFAULT 50.00
    CHECK (partner_profit_share >= 0 AND partner_profit_share <= 100),

  -- Reinvestment
  reinvestment_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00
    CHECK (reinvestment_percentage >= 0 AND reinvestment_percentage < 100),

  -- Payment configuration
  payment_method TEXT NOT NULL DEFAULT 'manual'
    CHECK (payment_method IN ('manual', 'nedbank_api')),

  -- Metadata
  currency TEXT NOT NULL DEFAULT 'ZAR',
  timezone TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STARTUP CAPITAL
-- ============================================================

CREATE TABLE IF NOT EXISTS startup_capital (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venture_id UUID NOT NULL REFERENCES shared_ventures(id) ON DELETE CASCADE,

  -- Contributions
  owner_contribution NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  partner_contribution NUMERIC(12, 2) NOT NULL DEFAULT 0.00,

  -- Loan tracking (when one party covers the other)
  loan_active BOOLEAN NOT NULL DEFAULT false,
  loan_debtor_user_id TEXT,       -- Who owes money
  loan_creditor_user_id TEXT,     -- Who is owed money
  loan_amount NUMERIC(12, 2) DEFAULT 0.00,
  loan_remaining NUMERIC(12, 2) DEFAULT 0.00,
  loan_repayment_type TEXT DEFAULT 'installment'
    CHECK (loan_repayment_type IN ('lump_sum', 'installment')),

  -- Installment configuration
  installment_type TEXT DEFAULT 'percentage'
    CHECK (installment_type IN ('percentage', 'fixed_amount')),
  installment_percentage NUMERIC(5, 2) DEFAULT 10.00,  -- % of debtor's profit share
  installment_fixed_amount NUMERIC(12, 2),

  -- Status
  fully_repaid BOOLEAN NOT NULL DEFAULT false,
  repaid_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_shared_ventures_owner ON shared_ventures(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_ventures_partner ON shared_ventures(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_startup_capital_venture ON startup_capital(venture_id);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================
-- NOTE: These policies use USING (true) to allow anonymous access,
-- matching the existing estate_data table pattern in supabase-setup.sql.
-- The dashboard currently uses client-generated user_id UUIDs without
-- Supabase Auth. When Auth is enabled, update these policies to use
-- auth.uid()::text = owner_user_id (or partner_user_id).
-- See docs/SUPABASE-SECURITY.md for the migration guide.
-- ============================================================

ALTER TABLE shared_ventures ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_capital ENABLE ROW LEVEL SECURITY;

-- Shared ventures: both owner and partner can access
CREATE POLICY "Venture participants access" ON shared_ventures
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- Startup capital: venture participants only
CREATE POLICY "Startup capital venture access" ON startup_capital
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shared_ventures_updated_at
  BEFORE UPDATE ON shared_ventures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_startup_capital_updated_at
  BEFORE UPDATE ON startup_capital
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
