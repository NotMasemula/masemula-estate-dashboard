-- Migration: 003 — Create Settlements
-- Created: 2026-04-10
-- Description: Monthly settlement calculations and tracking

-- ============================================================
-- SETTLEMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venture_id UUID NOT NULL REFERENCES shared_ventures(id) ON DELETE CASCADE,

  -- Period
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Revenue totals
  total_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  shopify_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  stripe_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  other_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,

  -- Expense totals
  total_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_shared_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  owner_expense_share NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  partner_expense_share NUMERIC(12, 2) NOT NULL DEFAULT 0.00,

  -- Reinvestment
  reinvestment_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,

  -- Net profit calculation
  gross_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,    -- Revenue - Expenses
  net_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,       -- Gross - Reinvestment

  -- Profit shares (before loan deductions)
  owner_gross_share NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  partner_gross_share NUMERIC(12, 2) NOT NULL DEFAULT 0.00,

  -- Loan deductions
  loan_deduction_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  loan_debtor TEXT,                -- Which party pays the loan instalment

  -- Final amounts to be paid
  owner_net_payout NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  partner_net_payout NUMERIC(12, 2) NOT NULL DEFAULT 0.00,

  -- Status and approval
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'paid', 'disputed')),
  owner_approved BOOLEAN DEFAULT false,
  partner_approved BOOLEAN DEFAULT false,
  owner_approved_at TIMESTAMPTZ,
  partner_approved_at TIMESTAMPTZ,

  -- Digital signatures
  owner_signature TEXT,           -- Timestamp-based signature
  partner_signature TEXT,
  owner_signed_at TIMESTAMPTZ,
  partner_signed_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one settlement per venture per period
  UNIQUE (venture_id, period_year, period_month)
);

-- ============================================================
-- SETTLEMENT LINE ITEMS (for detailed breakdown)
-- ============================================================

CREATE TABLE IF NOT EXISTS settlement_line_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES venture_transactions(id) ON DELETE SET NULL,

  -- Line item details
  description TEXT NOT NULL,
  category TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense', 'adjustment')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_settlements_venture ON settlements(venture_id);
CREATE INDEX IF NOT EXISTS idx_settlements_period ON settlements(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlement_line_items_settlement ON settlement_line_items(settlement_id);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settlement access" ON settlements
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Settlement line items access" ON settlement_line_items
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER update_settlements_updated_at
  BEFORE UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
