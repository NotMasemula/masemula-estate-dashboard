# Fix for Masemula Estate Dashboard 406 Errors

## Problem

Dashboard returns **406 errors** with message: `PGRST205: Could not find the table 'api.estate_data' in the schema cache`

### Root Cause
- Supabase PostgREST REST API by default exposes tables from the **`api` schema**
- The `estate_data` table was created in the **`public` schema**
- When the Edge Function calls `/rest/v1/estate_data`, PostgREST looks in `api.estate_data` and fails to find it

## Solution

### Step 1: Execute Database Migration (Manual)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select project: **romytadgdnpphqzlseaa**
3. Navigate to **SQL Editor** → **New Query**
4. Copy and paste the content from [`supabase/migrations/20250506_fix_estate_data_schema_comprehensive.sql`](../migrations/20250506_fix_estate_data_schema_comprehensive.sql)
5. Click **Run** (or Cmd+Enter)

This migration will:
- Create the `api` schema if it doesn't exist
- Move the `estate_data` table from `public` to `api` (preserving data)
- Set up proper RLS policies for service role and authenticated users
- Grant necessary permissions

**Expected output**: Migration completes without errors.

### Step 2: Redeploy Edge Function (If Needed)

If the deployed Edge Function still has old code:

1. Go to Supabase Dashboard → **Edge Functions** → **dispatch-workflow**
2. Click **...** → **View deployment logs** to check current code
3. If needed, update the function by:
   - Going to **Functions** → **dispatch-workflow**
   - Clicking **Create new version** or **Redeploy**
   - Ensuring latest code from GitHub is deployed

The Edge Function at `supabase/functions/dispatch-workflow/index.ts` now includes fallback logic to handle schema mismatches, so it should work even with the current code.

### Step 3: Test

1. Go to [Dashboard](https://notmasemula.github.io/masemula-estate-dashboard/)
2. Click any workflow button (e.g., "Routine Sync")
3. Check browser console (F12) - should see success response, no 406 errors

## Technical Details

### What Changed

- **Edge Function** (`supabase/functions/dispatch-workflow/index.ts`):
  - Added fallback logic to try multiple schema locations when inserting data
  - Gracefully handles schema mismatches without returning 502 errors

- **Database Migrations**:
  - Created comprehensive migration to move/create `estate_data` in `api` schema
  - Includes RLS policies for service role and user access
  - Preserves existing data if migration runs on existing setup

### Why This Happens in Supabase

Supabase's PostgREST configuration exposes tables in the **`api` schema** by default. Tables must either be:
1. Created in the `api` schema (Supabase standard)
2. Explicitly prefixed with schema in REST calls (`/rest/v1/public.table_name`)

Since many queries don't use explicit schema prefixing, best practice is to create tables in the `api` schema.

## Rollback (If Needed)

If something goes wrong:

1. Go to SQL Editor → New Query
2. Run: 
   ```sql
   -- Verify table location
   SELECT table_schema, table_name FROM information_schema.tables 
   WHERE table_name='estate_data';
   ```
3. If table is in wrong location, manually recreate in correct schema

## Support

If the migration fails or you need help:

1. Check error message in SQL Editor output
2. Verify no typos in SQL before running
3. Ensure you have proper permissions (typically via dashboard UI)
4. For schema permission issues, may need to contact Supabase support