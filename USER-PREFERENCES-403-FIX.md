# Fixing user_preferences 403 Error

## Problem
When loading the dashboard, you see a 403 Forbidden error:
```
POST https://[project].supabase.co/rest/v1/user_preferences → 403
```

This happens even though the table exists and has RLS policies.

## Root Cause
The RLS policies require `auth.uid()` to match a value, but the request is being sent as **(anonymous)** because:

1. **Session timing issue**: `loadUserPreferences()` is called before the Supabase session is fully attached to `sbClient`
2. **Anonymous request**: Without a session, Supabase treats the REST request as (anonymous), so `auth.uid()` returns NULL
3. **Policy blocks NULL**: The policy checks `EXISTS (SELECT 1 FROM user_dashboards WHERE user_id = auth.uid()...)`, which fails when `auth.uid()` is NULL → 403

## Solution (2 Steps)

### Step 1: Update RLS Policies in Supabase ✅
Run the SQL script `SQL-USER-PREFERENCES-RLS-FIX.sql` in your Supabase SQL Editor:

**What it does:**
- Drops old policies that allowed anonymous with complex EXISTS checks
- Creates new policies with `TO authenticated` clause (rejects anonymous immediately)
- Simplifies condition to `owner_uid = auth.uid()` (user can only access their own row)

**Why it works:**
- `TO authenticated` rejects unauthenticated requests before checking the condition
- Simple equality check is clearer and faster

### Step 2: Code Fix (Already Applied) ✅
The `index.html` now includes session verification in `loadUserPreferences()`:

```javascript
async function loadUserPreferences(){
  try {
    // Verify session is attached to sbClient BEFORE making API call
    const { data: { session } } = await sbClient.auth.getSession();
    if (!session) {
      console.warn('⚠️ loadUserPreferences: No session attached to sbClient. Using default theme.');
      applyTheme(true);
      return;
    }
    console.log('✅ Session verified for user_preferences query:', session.user.id);
    
    // Now proceed with API call...
    const { data, error } = await sbClient.from('user_preferences').select('id,dark_mode').eq('owner_uid', USER_ID).maybeSingle();
    // ...rest of function
  }
}
```

**Why it works:**
- Checks if session exists on sbClient before making API call
- If no session, uses default theme (graceful fallback)
- If session exists, proceeds with the authenticated API call

## Testing

1. **Hard refresh** your dashboard (Ctrl+Shift+F5)
2. **Log in** to the dashboard
3. **Open Developer Tools** → Network tab
4. Look for the `user_preferences` POST request
   - ❌ Before fix: Shows 403
   - ✅ After fix: Shows 200 (or 201 if creating new row)

## If Still Getting 403

Check these:

1. **Verify table is exposed to API**
   - Go to Supabase Console → Table Editor
   - Find `user_preferences` table
   - Click ⋯ menu
   - Make sure "Expose to API" is enabled (not greyed out)

2. **Verify RLS is enabled**
   - In Table Editor, select `user_preferences`
   - Check that "Enable RLS" is toggled ON
   - You should see policies listed below

3. **Check policies were created**
   - In Table Editor, click `user_preferences`
   - Scroll down to "Policies" section
   - You should see 4 policies:
     - user_preferences_select_own
     - user_preferences_insert_own
     - user_preferences_update_own
     - user_preferences_delete_own
   - Each should show "TO authenticated"

4. **Verify session is actually being set**
   - Open browser console
   - Look for log: `✅ Session verified for user_preferences query: [user-id]`
   - If you see: `⚠️ loadUserPreferences: No session attached to sbClient`
     - This means the auth flow hasn't completed yet
     - Check if login is working and `bootstrapAuth()` finishes successfully

## How to Verify Everything Works

In browser console, after login, run:
```javascript
const { data: { session } } = await sbClient.auth.getSession();
console.log('Session user:', session?.user?.id);
console.log('USER_ID:', USER_ID);

// Try to fetch user_preferences
const { data, error } = await sbClient.from('user_preferences').select('*').eq('owner_uid', USER_ID).single();
console.log('Result:', { data, error });
```

Expected output:
- Session user should show a UUID
- USER_ID should match the session user ID
- Result.data should show your preferences row or null (not an error)

## Reference: What Changed

**Before:**
```sql
CREATE POLICY "user_preferences_select_own_dashboard"
ON public.user_preferences
FOR SELECT
TO public  -- ❌ Allows anonymous
USING (
  EXISTS (
    SELECT 1
    FROM user_dashboards ud
    WHERE ud.user_id = auth.uid()  -- ❌ NULL for anonymous
      AND ud.dashboard_key = 'masemula-estate-dashboard'
  )
);
```

**After:**
```sql
CREATE POLICY "user_preferences_select_own"
ON public.user_preferences
FOR SELECT
TO authenticated  -- ✅ Rejects anonymous immediately
USING (
  owner_uid = auth.uid()  -- ✅ Simple check, auth.uid() is never NULL here
);
```

## Questions?
Check the console logs:
- `✅ Dashboard ready. USER_ID (user UUID): ...` — Auth completed
- `✅ Session verified for user_preferences query: ...` — Session attached
- `⚠️ loadUserPreferences: No session attached to sbClient` — Timing issue, see next step
