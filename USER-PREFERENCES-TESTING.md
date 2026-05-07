# Testing user_preferences after RLS fix

## Database Changes (Completed)
- ✅ Dropped CHECK constraint that restricted owner_uid to 'masemula-estate-dashboard'
- ✅ Migrated existing row: owner_uid now = user UUID (8cfd23ed-0e88-4ecc-8fe6-a31aa3a48dd9)
- ✅ Created RLS policies with `owner_uid = auth.uid()::text` 
- ✅ Verified authenticated role has table privileges (SELECT/INSERT/UPDATE/DELETE)

## Frontend Changes (Completed)
- ✅ Added session verification in `loadUserPreferences()`
- ✅ Graceful fallback if no session attached

## Test Steps

### 1. Hard Refresh
- Press **Ctrl+Shift+F5** (Windows) or **Cmd+Shift+R** (Mac)
- Clear browser cache to load latest code

### 2. Log In
- Open dashboard
- Log in as: **8cfd23ed-0e88-4ecc-8fe6-a31aa3a48dd9**
- Dashboard should load without 403 errors

### 3. Check Console Logs
Open DevTools (F12) → Console tab, look for:

**Expected on successful login:**
```
✅ Dashboard ready. USER_ID (user UUID): 8cfd23ed-0e88-4ecc-8fe6-a31aa3a48dd9
✅ Session verified for user_preferences query: 8cfd23ed-0e88-4ecc-8fe6-a31aa3a48dd9
```

**If you see:**
```
⚠️ loadUserPreferences: No session attached to sbClient. Using default theme.
```
→ Session timing issue (will still work, just uses default theme)

### 4. Check Network Tab
- Open DevTools → Network tab
- Reload page
- Look for `user_preferences` POST request
- Should show: **200** or **201** (success)
- ❌ Should NOT show: **403** or **400**

### 5. Test Theme Toggle
- Click sun/moon icon in top-right
- Theme should switch
- Refresh page
- Theme should persist
- Check Network tab: toggle should make PATCH request → **200**

### 6. Verify Data in Database
In Supabase SQL Editor, run:
```sql
SELECT id, owner_uid, dark_mode, created_at 
FROM public.user_preferences 
WHERE owner_uid = '8cfd23ed-0e88-4ecc-8fe6-a31aa3a48dd9'
LIMIT 1;
```

Expected: One row with your user UUID as owner_uid

## If Issues Persist

### 403 Still Appearing?
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+Shift+F5)
3. Check console for session verification logs
4. Run test query in SQL Editor to verify row exists and has correct owner_uid

### 400 Bad Request?
1. Check USER_ID matches auth.uid()
2. Verify owner_uid column is UUID type
3. Confirm RLS policies use `auth.uid()::text` casting

### Row Not Inserting?
1. Verify authenticated role has INSERT privilege (check step 3 above)
2. Look for error message in browser console
3. Check INSERT policy has correct `WITH CHECK` clause

## Success Indicators
- ✅ Login completes without 403/404 errors
- ✅ Console shows session verification log
- ✅ Network tab shows 200 for user_preferences requests
- ✅ Theme toggle saves and persists across refresh
- ✅ SQL query shows row with correct owner_uid
