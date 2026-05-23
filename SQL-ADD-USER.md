# 🔑 Add User to Dashboard SQL

## Your User ID
```
8cfd23ed-0e88-4ecc-8fe6-a31aa3a48dd9
```

## Run This SQL in Supabase

Go to: https://app.supabase.com/project/ribmywnovgzsmtuaxgrn/sql

Copy and paste this:

```sql
INSERT INTO public.user_dashboards (user_id, dashboard_key, created_at)
VALUES ('8cfd23ed-0e88-4ecc-8fe6-a31aa3a48dd9', 'masemula-estate-dashboard', now());
```

Then click **Run** ▶️

---

## What This Does

- Adds your user ID to `public.user_dashboards`
- Assigns you to `masemula-estate-dashboard`
- Sets creation timestamp to now
- RLS policies will now allow you to see your personal items ✅

---

## ✅ After Running SQL

1. **Refresh dashboard** (Ctrl+F5)
2. **Login** with:
   - Email: `masemula.ntobeko@icloud.com`
   - Password: `W0k$treet72`
3. **Check console** (F12) for:
   ```
   ✅ Authenticated user ID: 8cfd23ed-0e88-4ecc-8fe6-a31aa3a48dd9
   ✅ Allowed dashboard keys: ["masemula-estate-dashboard"]
   ✅ Selected dashboard: masemula-estate-dashboard
   ✅ Loaded X items for masemula-estate-dashboard
   ```
4. **Dashboard loads** with your data ✅

---

## 🧪 Verify It Worked

In Supabase SQL Editor, run:

```sql
SELECT * FROM public.user_dashboards WHERE user_id = '8cfd23ed-0e88-4ecc-8fe6-a31aa3a48dd9';
```

Should return 1 row with your user_id and `masemula-estate-dashboard` ✅

---

**Status**: Ready to execute!  
**Next**: Run the INSERT SQL above, then refresh dashboard and login.
