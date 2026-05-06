-- Migration: Move estate_data table to api schema for REST API access
-- Problem: Supabase PostgREST by default exposes 'api' schema
-- Solution: Create table in api schema instead of public

CREATE SCHEMA IF NOT EXISTS api;

-- Create the table in api schema (or migrate if exists in public)
CREATE TABLE IF NOT EXISTS api.estate_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text UNIQUE NOT NULL,
  data jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- If the table already exists in public, we could copy data and drop public version
-- (But for safety, leaving this as a comment - manual migration if needed)
-- DO $$ BEGIN
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'estate_data') THEN
--     INSERT INTO api.estate_data SELECT * FROM public.estate_data ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now();
--     DROP TABLE public.estate_data;
--   END IF;
-- END $$;

-- Enable RLS and set policies if needed
ALTER TABLE api.estate_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to access
CREATE POLICY "Service role can access estate_data" ON api.estate_data
  AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions to anon and authenticated users if needed
GRANT SELECT, INSERT, UPDATE ON api.estate_data TO anon, authenticated;