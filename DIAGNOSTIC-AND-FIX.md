# 🔧 Diagnostic & Fix Guide

## ✅ What Was Fixed

**Supabase Project URL Updated**
- Old: `romytadgdnpphqzlseaa.supabase.co` ❌
- New: `ribmywnovgzsmtuaxgrn.supabase.co` ✅

## 🚨 Current Issue: User Not in `public.user_dashboards`

### The Problem

When you login, the dashboard tries to fetch your assigned dashboards:

```javascript
// This query succeeds (connects to public.user_dashboards)
// But returns EMPTY because your user ID is not in the table
await sbClient.from('user_dashboards').select('dashboard_key').eq('user_id', YOUR_USER_ID)
```

Result: `"No dashboards assigned to this user"`

### Why

The `public.user_dashboards` table currently has only **2 users**:

| user_id | dashboard_key |
|---------|---------------|
| `bce167e8-6d23-4df5-8290-10194af0769f` | masemula-estate-dashboard |
| `e1cfd092-82af-4653-b65a-773c40a691c6` | blanco-enterprise-dashboard |

If you're logging in as a different user, they're not in this list.

---

## 🔍 Step 1: Find Your User ID

### Option A: Get it from console (after attempting login)

1. Open dashboard: https://notmasemula.github.io/masemula-estate-dashboard/
2. Try to login
3. Open Console (F12)
4. Run:
   ```javascript
   // This will show your user UUID even if auth flow fails
   window.DashboardAuth.getState()
   
   // Or manually fetch:
   window.supabase?.auth.getUser().then(r => console.log('Your user ID:', r.data?.user?.id))
   ```
5. **Copy the user ID** (looks like: `12345678-abcd-ef12-3456-789abcdef012`)

### Option B: Get it from Supabase Console

1. Go to: https://app.supabase.com/
2. Select your project: `ribmywnovgzsmtuaxgrn`
3. Auth → Users
4. Find your email and copy the UUID from the leftmost column

---

## 🆔 Step 2: Tell Me Your User ID

Once you have your user ID, provide it in one of these formats:

**Example:**
```
My user ID is: 12345678-abcd-ef12-3456-789abcdef012
```

---

## 🛠️ Step 3: I'll Run the SQL to Assign Your Dashboard

Once I have your user ID, I'll insert you into `public.user_dashboards`:

```sql
INSERT INTO public.user_dashboards (user_id, dashboard_key, created_at)
VALUES ('YOUR_USER_ID_HERE', 'masemula-estate-dashboard', now());
```

This tells Supabase: "This user is allowed to see masemula-estate-dashboard"

---

## ✨ After the Fix

Once your user ID is in `public.user_dashboards`:

1. **Refresh the dashboard** (Ctrl+F5)
2. **Login again** with your email
3. **Check console** (F12):
   ```
   ✅ Authenticated user ID: 12345678-abcd-ef12-3456-789abcdef012
   ✅ Allowed dashboard keys: ["masemula-estate-dashboard"]
   ✅ Selected dashboard: masemula-estate-dashboard
   ✅ Loaded X items for masemula-estate-dashboard
   ```
4. **Dashboard loads** with your personal data ✅

---

## 🧪 Test Commands

After your user is added, use these to validate:

### In Browser Console (F12):

```javascript
// 1. Check your auth state
window.DashboardAuth.getState()

// 2. Manually fetch your dashboard keys
window.supabase?.from('user_dashboards').select('*').eq('user_id', window.DashboardAuth.getState().currentUserId).then(r => console.log('user_dashboards:', r.data))

// 3. Check personal_items count
window.supabase?.from('personal_items').select('count', { count: 'exact' }).eq('dashboard_key', 'masemula-estate-dashboard').then(r => console.log('items count:', r.count))

// 4. Run full auth flow
window.DashboardAuth.completeAuthAndLoadDashboard().then(r => console.log('Auth result:', r))
```

---

## ❌ Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "No dashboards assigned" | User not in `public.user_dashboards` | Add user to table (Step 3) |
| "relation 'api.user_dashboards' does not exist" | Old code querying wrong schema | Already fixed in v4.0 |
| "Not authenticated" | Not logged in or session expired | Clear localStorage, login again |
| Still not working after adding user | RLS policy blocking the query | Check RLS policy on user_dashboards |

---

## 📋 Next Steps

1. **Get your user ID** (Step 1)
2. **Tell me the ID** (Step 2)
3. **I'll insert you into the table** (Step 3)
4. **Refresh and test** (Verify section above)

---

**Your next action**: Run the command in Step 1 (Option A or B) and get your user ID, then let me know.
