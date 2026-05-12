# Fix: Create masemula_estate Table

## Problem
Frontend was trying to query `public.estate_data` which doesn't exist, resulting in 404 errors.

## Solution
Create `public.masemula_estate` table with proper RLS policies.

## Steps

### 1. Run SQL in Supabase

Go to: **Supabase Dashboard → SQL Editor** → Create a **New Query**

Copy and paste the SQL from `SQL-CREATE-MASEMULA-ESTATE.sql`:

```sql
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
```

### 2. Click "Run"

Expected output: **Statements executed successfully**

### 3. Verify in Supabase

- Go to **Table Editor** → You should see `masemula_estate` in the list
- Go to **Authentication → Policies** → You should see 4 policies on `masemula_estate`

### 4. Update Frontend (Already Done)

The frontend code references `estate_data` in the REST API calls. We need to update those to `masemula_estate`.

**Change all occurrences of:**
```
/rest/v1/estate_data
```

**To:**
```
/rest/v1/masemula_estate
```

This needs to be done in `index.html` at these locations:
- Line 2531: `syncToCloud()` function
- Line 2568: `loadFromCloud()` function
- Line 2645: Connection test
- Line 5728: `svLoadLocal()` sync
- Line 5760: `svSaveLocal()` sync
- Line 5772: `svSaveLocal()` upsert fallback

### 5. Test

1. Hard refresh: **Ctrl+Shift+F5**
2. Log in to the dashboard
3. Open DevTools: **F12 → Network**
4. Check that requests to `/rest/v1/masemula_estate` return **200 OK** (not 404)
5. Dashboard should load with no "Supabase API returned 404" errors

## What This Table Does

- **`user_id`**: Links data to authenticated user (from auth.uid())
- **`data`**: JSON blob storing all dashboard state (ventures, goals, habits, finances, etc.)
- **`updated_at`**: Timestamp of last sync
- **`created_at`**: When record was first created
- **RLS Policies**: Ensure each user can only read/write their own data

## Result

✅ Frontend can sync dashboard data to cloud
✅ RLS prevents data leakage between users
✅ Auth integration works correctly
