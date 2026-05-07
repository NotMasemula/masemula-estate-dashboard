-- ═══════════════════════════════════════════════════════════════════════════
-- Fix user_preferences RLS Policies
-- Problem: Policies allow auth.uid() = NULL (anonymous), causing 403 on REST API
-- Solution: Restrict to authenticated users who own their own row
-- ═══════════════════════════════════════════════════════════════════════════

-- IMPORTANT: Run this in Supabase SQL Editor only if the table exists
-- If it doesn't exist yet, run SQL-CREATE-USER-PREFERENCES.sql first

-- Step 1: Drop existing policies (if they exist)
DROP POLICY IF EXISTS "user_preferences_select_own_dashboard" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_insert_own_dashboard" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_update_own_dashboard" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_delete_own_dashboard" ON public.user_preferences;

-- Step 2: Create improved policies with explicit "TO authenticated" clause
-- This ensures anonymous requests are rejected before checking EXISTS

-- SELECT: User can only read their own preferences
CREATE POLICY "user_preferences_select_own"
ON public.user_preferences
FOR SELECT
TO authenticated
USING (
  owner_uid = auth.uid()
);

-- INSERT: User can only create preferences for themselves
CREATE POLICY "user_preferences_insert_own"
ON public.user_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  owner_uid = auth.uid()
);

-- UPDATE: User can only update their own preferences
CREATE POLICY "user_preferences_update_own"
ON public.user_preferences
FOR UPDATE
TO authenticated
USING (
  owner_uid = auth.uid()
)
WITH CHECK (
  owner_uid = auth.uid()
);

-- DELETE: User can only delete their own preferences
CREATE POLICY "user_preferences_delete_own"
ON public.user_preferences
FOR DELETE
TO authenticated
USING (
  owner_uid = auth.uid()
);

-- Step 3: Verify RLS is enabled on the table
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Step 4: Verify table is exposed to PostgREST API
-- (Cannot be done via SQL, must be done in Supabase Console → Table Editor)
-- Look for the table → Click ⋯ menu → "Expose to API" should be enabled
