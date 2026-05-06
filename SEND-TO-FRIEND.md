# 🎯 Setup Guide for Your Friend (Blanco Dashboard)

## 📋 Share This With Your Friend

**File to send**: `FRIEND-SETUP-PROMPT.md` from the Masemula Estate Dashboard repo

---

## ⚡ Quick Summary for Your Friend

### Your Details (Already Pre-Configured)
```
Email: whomadeblanco@gmail.com
User ID: b87f5fb4-6327-40f1-84b1-94d06e49262d
Dashboard Key: blanco-enterprise-dashboard
Supabase Project: ribmywnovgzsmtuaxgrn (shared with Masemula)
```

### What to Do (6 Steps)

1. **Create `config/env.js`** with Supabase credentials
2. **Create `dashboard-auth-fix.js`** with auth module (copy-paste from prompt)
3. **Update `index.html`** to load Supabase + auth module
4. **Run SQL in Supabase** to add yourself to user_dashboards table
5. **Commit and push** to GitHub
6. **Test** by refreshing and logging in

### Expected Result
- Login with email works ✅
- Console shows your user ID and dashboard key ✅
- Dashboard loads from Supabase ✅
- RLS enforces data isolation ✅

---

## 📁 Files Needed

Send your friend:
1. **`FRIEND-SETUP-PROMPT.md`** (the full setup guide)
2. **`dashboard-auth-fix.js`** (the auth module file)

They can copy-paste most of the code directly.

---

## 🚀 Time Estimate

- Setup: ~15 minutes
- Testing: ~5 minutes
- **Total**: ~20 minutes

---

## ✅ Verification

After they complete setup, they should see in console:
```
✅ Authenticated user ID: b87f5fb4-6327-40f1-84b1-94d06e49262d
✅ Allowed dashboard keys: ["blanco-enterprise-dashboard"]
✅ Selected dashboard: blanco-enterprise-dashboard
✅ Loaded X items for blanco-enterprise-dashboard
```

---

**Ready to share!** 🎉
