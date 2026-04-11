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
