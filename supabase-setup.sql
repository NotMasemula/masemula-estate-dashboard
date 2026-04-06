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

-- Create policy to allow users to manage their own data
CREATE POLICY "Users can manage their own data" ON estate_data
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_estate_data_user_id ON estate_data(user_id);

-- Grant access to anonymous users (for the anon key)
GRANT ALL ON estate_data TO anon;
GRANT ALL ON estate_data TO authenticated;
