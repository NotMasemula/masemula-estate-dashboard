-- Create public.masemula_estate table for dashboard data sync
CREATE TABLE IF NOT EXISTS public.masemula_estate (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.masemula_estate ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own estate data
CREATE POLICY "Users can read own masemula_estate"
ON public.masemula_estate
FOR SELECT
USING (auth.uid() = user_id);

-- RLS Policy: Users can update their own estate data
CREATE POLICY "Users can update own masemula_estate"
ON public.masemula_estate
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can insert their own estate data
CREATE POLICY "Users can insert masemula_estate"
ON public.masemula_estate
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own estate data
CREATE POLICY "Users can delete own masemula_estate"
ON public.masemula_estate
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_masemula_estate_user_id ON public.masemula_estate(user_id);
