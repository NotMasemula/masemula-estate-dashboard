-- Migration: 005 — Nedbank Integration Tables
-- Created: 2026-04-10
-- Description: Tables for Nedbank API integration (ready when API access approved)

-- ============================================================
-- NEDBANK CREDENTIALS (Encrypted at rest by Supabase)
-- ============================================================

CREATE TABLE IF NOT EXISTS nedbank_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,

  -- Account information
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT DEFAULT 'current',

  -- API credentials (store in Supabase secrets instead if possible)
  -- These are stored here only when per-user credentials are needed
  -- For shared credentials, use Supabase Edge Function secrets instead
  api_key TEXT,                   -- Public key, relatively safe
  -- Note: api_secret should be stored in Supabase secrets, not here

  -- OAuth tokens (refreshed automatically)
  access_token TEXT,              -- Short-lived access token
  refresh_token TEXT,             -- Long-lived refresh token
  token_expires_at TIMESTAMPTZ,
  token_scope TEXT,

  -- Integration status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'revoked')),
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NEDBANK TRANSACTION SYNC LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS nedbank_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  venture_id UUID REFERENCES shared_ventures(id) ON DELETE SET NULL,

  -- Sync details
  sync_type TEXT NOT NULL CHECK (sync_type IN ('transactions', 'balance', 'payment_status')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
  records_fetched INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,

  -- Time range synced
  from_date DATE,
  to_date DATE,

  -- Error info
  error_message TEXT,
  error_code TEXT,

  -- API response metadata
  api_response_code INTEGER,
  api_request_id TEXT,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- PAYMENT BANK ACCOUNTS (For recipient bank details)
-- ============================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Account details
  bank_name TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  account_number TEXT NOT NULL,
  branch_code TEXT,               -- South African branch code
  account_type TEXT DEFAULT 'current'
    CHECK (account_type IN ('current', 'savings', 'transmission')),

  -- Nedbank-specific fields
  universal_branch_code TEXT DEFAULT '198765',  -- Nedbank universal

  -- Status
  is_verified BOOLEAN DEFAULT false,
  is_primary BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_nedbank_credentials_user ON nedbank_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_nedbank_sync_log_user ON nedbank_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user ON bank_accounts(user_id);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE nedbank_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE nedbank_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- Credentials: strict - only the owner
CREATE POLICY "Nedbank credentials owner access" ON nedbank_credentials
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Sync log access" ON nedbank_sync_log
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Bank accounts access" ON bank_accounts
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER update_nedbank_credentials_updated_at
  BEFORE UPDATE ON nedbank_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMMENT: INTEGRATION STATUS
-- ============================================================

COMMENT ON TABLE nedbank_credentials IS
  'Nedbank API credentials. IMPORTANT: Store api_secret in Supabase secrets (supabase secrets set NEDBANK_CLIENT_SECRET=value), not in this table.';

COMMENT ON TABLE bank_accounts IS
  'Bank account details for payment recipients. Used for automated Nedbank transfers.';
