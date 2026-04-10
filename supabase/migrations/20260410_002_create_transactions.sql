-- Migration: 002 — Create Transactions & Expenses
-- Created: 2026-04-10
-- Description: Transaction logging for shared ventures (Shopify, Stripe, manual)

-- ============================================================
-- VENTURE TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS venture_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venture_id UUID NOT NULL REFERENCES shared_ventures(id) ON DELETE CASCADE,

  -- Transaction details
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense', 'refund', 'adjustment')),
  category TEXT,                  -- e.g. 'shopify_sale', 'ad_spend', 'subscription'
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',

  -- Source tracking
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'shopify', 'stripe', 'nedbank', 'stitch')),
  external_id TEXT,               -- ID from source system (Shopify order ID, etc.)
  external_reference TEXT,        -- Reference number

  -- Shared expense configuration
  is_shared_expense BOOLEAN NOT NULL DEFAULT false,
  owner_share_percentage NUMERIC(5, 2) DEFAULT 50.00,
  partner_share_percentage NUMERIC(5, 2) DEFAULT 50.00,

  -- Date information
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),

  -- Approval workflow
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'disputed', 'resolved')),
  approved_by_owner BOOLEAN DEFAULT false,
  approved_by_partner BOOLEAN DEFAULT false,
  owner_approved_at TIMESTAMPTZ,
  partner_approved_at TIMESTAMPTZ,

  -- Who logged it
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRANSACTION DISPUTES
-- ============================================================

CREATE TABLE IF NOT EXISTS transaction_disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES venture_transactions(id) ON DELETE CASCADE,
  venture_id UUID NOT NULL REFERENCES shared_ventures(id) ON DELETE CASCADE,

  -- Dispute details
  raised_by_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'withdrawn')),

  -- Resolution
  resolution_notes TEXT,
  resolved_by_user_id TEXT,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WEBHOOK EVENTS (for idempotency)
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,   -- Shopify/Stripe event ID
  source TEXT NOT NULL CHECK (source IN ('shopify', 'stripe', 'nedbank')),
  event_type TEXT NOT NULL,           -- e.g. 'orders/paid', 'payment_intent.succeeded'
  status TEXT NOT NULL DEFAULT 'processed'
    CHECK (status IN ('processed', 'failed', 'skipped')),
  payload JSONB,                      -- Full event payload (for debugging)
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_venture_transactions_venture ON venture_transactions(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_transactions_date ON venture_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_venture_transactions_source ON venture_transactions(source);
CREATE INDEX IF NOT EXISTS idx_venture_transactions_approval ON venture_transactions(approval_status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_external_id ON webhook_events(external_id);
CREATE INDEX IF NOT EXISTS idx_transaction_disputes_transaction ON transaction_disputes(transaction_id);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE venture_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venture transaction access" ON venture_transactions
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Dispute access" ON transaction_disputes
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Webhook events: write via service role only, read by anon
CREATE POLICY "Webhook events read" ON webhook_events
  FOR SELECT TO anon USING (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER update_venture_transactions_updated_at
  BEFORE UPDATE ON venture_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
