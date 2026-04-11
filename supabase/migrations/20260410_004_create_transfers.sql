-- Migration: 004 — Create Transfers & Notifications
-- Created: 2026-04-10
-- Description: Transfer tracking and notification preferences

-- ============================================================
-- VENTURE TRANSFERS
-- ============================================================

CREATE TABLE IF NOT EXISTS venture_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  venture_id UUID NOT NULL REFERENCES shared_ventures(id) ON DELETE CASCADE,

  -- Parties
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,

  -- Amount
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  type TEXT NOT NULL CHECK (type IN ('profit_share', 'loan_repayment', 'expense_reimbursement')),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'pending_manual_transfer',
      'pending_automated',
      'processing',
      'transferred',
      'received',
      'failed',
      'cancelled'
    )),

  -- Payment method
  payment_method TEXT NOT NULL DEFAULT 'manual'
    CHECK (payment_method IN ('manual', 'nedbank_api')),

  -- Manual transfer info
  manual_instructions TEXT,       -- "Transfer to Tshegofatso: Nedbank acc 1234567890"
  manual_transfer_reference TEXT, -- Reference number provided by sender

  -- Nedbank API fields (when using automated transfers)
  nedbank_payment_id TEXT,        -- Nedbank payment reference
  nedbank_reference TEXT,         -- Nedbank transaction reference
  nedbank_status TEXT,            -- Raw status from Nedbank

  -- Timestamps
  initiated_at TIMESTAMPTZ,
  transferred_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,

  -- Email settings
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  email_address TEXT,

  -- SMS settings (future)
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  phone_number TEXT,

  -- Notification types
  notify_new_transaction BOOLEAN NOT NULL DEFAULT true,
  notify_pending_approval BOOLEAN NOT NULL DEFAULT true,
  notify_settlement_ready BOOLEAN NOT NULL DEFAULT true,
  notify_transfer_received BOOLEAN NOT NULL DEFAULT true,
  notify_dispute_opened BOOLEAN NOT NULL DEFAULT true,
  notify_report_ready BOOLEAN NOT NULL DEFAULT true,
  notify_daily_digest BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATION LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  venture_id UUID REFERENCES shared_ventures(id) ON DELETE SET NULL,

  -- Notification details
  type TEXT NOT NULL,             -- 'new_transaction', 'settlement_ready', etc.
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'in_app')),
  subject TEXT,
  body TEXT,

  -- Delivery status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  external_id TEXT,               -- ID from Resend/Twilio
  error_message TEXT,

  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_venture_transfers_settlement ON venture_transfers(settlement_id);
CREATE INDEX IF NOT EXISTS idx_venture_transfers_venture ON venture_transfers(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_transfers_status ON venture_transfers(status);
CREATE INDEX IF NOT EXISTS idx_venture_transfers_nedbank ON venture_transfers(nedbank_payment_id);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE venture_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transfer access" ON venture_transfers
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Notification prefs access" ON notification_preferences
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Notification log read" ON notification_log
  FOR SELECT TO anon USING (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER update_venture_transfers_updated_at
  BEFORE UPDATE ON venture_transfers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
