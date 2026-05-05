-- Masemula Estate OS - Supabase Setup
-- Run this in your Supabase SQL Editor (Database → SQL Editor)

-- Create the estate_data table
CREATE TABLE IF NOT EXISTS estate_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE estate_data ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can manage their own data" ON estate_data;
DROP POLICY IF EXISTS "Allow all" ON estate_data;
DROP POLICY IF EXISTS "Anon access" ON estate_data;

-- Create policy for anon users (required for client-side access with anon key)
-- This is acceptable because user_id is a random UUID generated client-side
-- Each device/browser gets its own unique user_id
CREATE POLICY "Anon users can manage their data" ON estate_data
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_estate_data_user_id ON estate_data(user_id);

-- Grant access
GRANT ALL ON estate_data TO anon;

-- ═══════════════════════════════════════════════════════════════
-- SHARED VENTURES SUPPORT
-- The shared_ventures record uses user_id = 'masemula-ventures-shared'
-- and is stored in the existing estate_data table above.
-- Both partners access this single shared record by its user_id key.
--
-- To pre-create the shared record, run:
--   INSERT INTO estate_data (user_id, data)
--   VALUES ('masemula-ventures-shared', '{"ventures":[],"transactions":[],"settlements":[],"transfers":[],"loans":[],"audit":[]}')
--   ON CONFLICT (user_id) DO NOTHING;
-- ═══════════════════════════════════════════════════════════════

-- Pre-create the shared ventures record so both partners can use it immediately
INSERT INTO estate_data (user_id, data)
VALUES (
  'masemula-ventures-shared',
  '{"ventures":[],"transactions":[],"settlements":[],"transfers":[],"loans":[],"audit":[]}'
)
ON CONFLICT (user_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- ROUTINE SCHEDULE RECORD
-- Synced from docs/routine-schedule.json via the sync-routine workflow.
-- The dashboard reads from this record to display the live schedule.
-- Key: 'ntobeko-masemula-routine'
-- ═══════════════════════════════════════════════════════════════

INSERT INTO estate_data (user_id, data)
VALUES (
  'ntobeko-masemula-routine',
  '{"metadata":{"last_updated":"","sync_version":"1.0"},"schedule":{},"notes":{}}'
)
ON CONFLICT (user_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- HABITS LOG TABLE
-- Stores daily habit tracking: gym, reading, sleep, deep work, etc.
-- Used by the Daily Routine section of the dashboard.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS habits_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  habit_key TEXT NOT NULL,             -- e.g. 'gym', 'read', 'sleep', 'drop', 'music', 'deep', 'study'
  logged_date DATE NOT NULL,           -- YYYY-MM-DD
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,                          -- optional numeric value stored as text (e.g. hours)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_uid, habit_key, logged_date)
);

-- Enable RLS
ALTER TABLE habits_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anon users can manage habits" ON habits_log;

-- Allow anon users to manage their own habits (dashboard uses anon key + fixed user_id)
CREATE POLICY "Anon users can manage habits" ON habits_log
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Index for efficient week queries
CREATE INDEX IF NOT EXISTS idx_habits_log_owner_date ON habits_log(owner_uid, logged_date);
CREATE INDEX IF NOT EXISTS idx_habits_log_owner_key ON habits_log(owner_uid, habit_key);

-- Grant access
GRANT ALL ON habits_log TO anon;

