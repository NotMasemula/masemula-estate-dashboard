-- COMPREHENSIVE FIX for estate_data schema mismatch
-- Problem: Table in public schema, but REST API looks in api schema
-- Solution: Ensure table exists in api schema

-- Step 1: Check if table exists in public
-- SELECT * FROM information_schema.tables WHERE table_schema='public' AND table_name='estate_data';

-- Step 2: Create api schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS api;

-- Step 3: Check current table state  
-- SELECT table_schema, table_name FROM information_schema.tables WHERE table_name='estate_data';

-- Step 4a: If table exists in public, copy to api and drop public version
DO $$ 
BEGIN
  -- Check if table exists in public schema
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'estate_data'
  ) THEN
    -- Copy data to api schema if table doesn't exist there yet
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'api' AND table_name = 'estate_data'
    ) THEN
      -- Create in api schema first with same structure
      CREATE TABLE api.estate_data AS SELECT * FROM public.estate_data;
      -- Create primary key
      ALTER TABLE api.estate_data ADD PRIMARY KEY (id);
      -- Add unique constraint
      ALTER TABLE api.estate_data ADD UNIQUE (user_id);
      -- Set defaults  
      ALTER TABLE api.estate_data ALTER COLUMN created_at SET DEFAULT now();
      ALTER TABLE api.estate_data ALTER COLUMN updated_at SET DEFAULT now();
    ELSE
      -- Merge data if table exists in both
      INSERT INTO api.estate_data SELECT * FROM public.estate_data 
      ON CONFLICT (user_id) DO UPDATE 
      SET data = EXCLUDED.data, updated_at = now();
    END IF;
    
    -- Drop public version after successful copy
    DROP TABLE IF EXISTS public.estate_data;
  END IF;
END $$;

-- Step 4b: If table doesn't exist anywhere, create in api schema
CREATE TABLE IF NOT EXISTS api.estate_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text UNIQUE NOT NULL,
  data jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Step 5: Enable RLS
ALTER TABLE api.estate_data ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop existing policies and recreate
DROP POLICY IF EXISTS "Service role can access estate_data" ON api.estate_data;
DROP POLICY IF EXISTS "Anon users read access" ON api.estate_data;

-- Service role policy (full access)
CREATE POLICY "Service role can access estate_data" ON api.estate_data
  AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon/Auth users can read and insert their own records
CREATE POLICY "Users can read their own data" ON api.estate_data
  AS PERMISSIVE FOR SELECT TO authenticated, anon
  USING (user_id = current_user_id() OR user_id ILIKE 'masemula-dashboard%');

CREATE POLICY "Users can insert data" ON api.estate_data
  AS PERMISSIVE FOR INSERT TO authenticated, anon
  WITH CHECK (user_id = current_user_id() OR user_id ILIKE 'masemula-dashboard%');

CREATE POLICY "Users can update their own data" ON api.estate_data
  AS PERMISSIVE FOR UPDATE TO authenticated, anon
  USING (user_id = current_user_id() OR user_id ILIKE 'masemula-dashboard%')
  WITH CHECK (user_id = current_user_id() OR user_id ILIKE 'masemula-dashboard%');

-- Step 7: Grant permissions
GRANT SELECT, INSERT, UPDATE ON api.estate_data TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA api TO anon, authenticated, service_role;

-- Verify final state
-- SELECT table_schema, table_name FROM information_schema.tables WHERE table_name='estate_data';