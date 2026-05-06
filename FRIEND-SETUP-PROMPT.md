# 📋 Setup Prompt for Blanco Enterprise Dashboard — Supabase Connection

Use this prompt to help your friend connect his dashboard to Supabase:

---

## 🎯 Setup Supabase Connection for Blanco Enterprise Dashboard

**Your Information:**
- **Email**: `whomadeblanco@gmail.com`
- **User ID**: `b87f5fb4-6327-40f1-84b1-94d06e49262d`
- **Dashboard Key**: `blanco-enterprise-dashboard`
- **Supabase Project URL**: `https://ribmywnovgzsmtuaxgrn.supabase.co`
- **Supabase Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpYm15d25vdmd6c210dWF4Z3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjc0OTEsImV4cCI6MjA5MzY0MzQ5MX0.cIOgXx-8T_evKrDVvH6f4O-55RgusS1wKxso0xstLjs`

### 🔧 Implementation Steps

#### Step 1: Update Supabase Credentials

**Create or update `config/env.js`** in your project root:

```javascript
// Blanco Enterprise Dashboard — Supabase Configuration
// Safe to commit: uses anon key (RLS enforced)

window.__ESTATE_ENV = {
  SUPABASE_URL: 'https://ribmywnovgzsmtuaxgrn.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpYm15d25vdmd6c210dWF4Z3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjc0OTEsImV4cCI6MjA5MzY0MzQ5MX0.cIOgXx-8T_evKrDVvH6f4O-55RgusS1wKxso0xstLjs'
};
```

#### Step 2: Create Authentication Module

**Create `dashboard-auth-fix.js`** in your project root:

```javascript
// ═══════════════════════════════════════════════════════════════════════════
// Dashboard Authentication & User-Scoped Data Loading
// ═══════════════════════════════════════════════════════════════════════════
// Blanco Enterprise Dashboard - User-scoped auth with RLS enforcement

let currentUserId = null;           // From auth.uid()
let allowedDashboardKeys = [];      // User's assigned dashboard keys
let selectedDashboardKey = null;    // Currently active dashboard

/**
 * Fetch the list of dashboard keys this user can access
 */
async function fetchUserDashboardKeys() {
  if (!sbClient || !authSession) {
    console.warn('⚠️ fetchUserDashboardKeys: Not authenticated');
    return [];
  }

  try {
    const { data: { user }, error: userErr } = await sbClient.auth.getUser();
    if (userErr || !user) {
      console.error('❌ Could not get current user:', userErr);
      return [];
    }
    currentUserId = user.id;
    console.log('✅ Authenticated user ID:', currentUserId);

    // Query user_dashboards for this user
    const { data, error } = await sbClient
      .from('user_dashboards')
      .select('dashboard_key')
      .eq('user_id', currentUserId);

    if (error) {
      console.error('❌ Failed to fetch dashboard keys:', error.message, error.hint);
      return [];
    }

    allowedDashboardKeys = (data || []).map(row => row.dashboard_key);
    console.log('✅ Allowed dashboard keys:', allowedDashboardKeys);

    return allowedDashboardKeys;
  } catch (err) {
    console.error('❌ Unexpected error in fetchUserDashboardKeys:', err.message);
    return [];
  }
}

/**
 * Select which dashboard this user wants to view
 */
function selectDashboard(preferredKey = 'blanco-enterprise-dashboard') {
  if (!allowedDashboardKeys || allowedDashboardKeys.length === 0) {
    console.warn('⚠️ No dashboard keys available');
    selectedDashboardKey = null;
    return null;
  }

  if (allowedDashboardKeys.includes(preferredKey)) {
    selectedDashboardKey = preferredKey;
    console.log('✅ Selected dashboard:', selectedDashboardKey);
    return selectedDashboardKey;
  }

  selectedDashboardKey = allowedDashboardKeys[0];
  console.warn(`⚠️ Preferred dashboard '${preferredKey}' not found. Using first available:`, selectedDashboardKey);
  return selectedDashboardKey;
}

/**
 * Load dashboard items from public.personal_items
 */
async function loadDashboardItemsAuth() {
  if (!sbClient || !currentUserId || !selectedDashboardKey) {
    console.warn('⚠️ loadDashboardItemsAuth: Missing auth context', {
      sbClient: !!sbClient,
      currentUserId,
      selectedDashboardKey
    });
    return [];
  }

  try {
    console.log('🔄 Loading items for dashboard:', selectedDashboardKey);

    const { data, error } = await sbClient
      .from('personal_items')
      .select('*')
      .eq('dashboard_key', selectedDashboardKey)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Failed to load items:', error.message, error.hint);
      return [];
    }

    console.log('✅ Loaded', (data || []).length, 'items for', selectedDashboardKey);
    return data || [];
  } catch (err) {
    console.error('❌ Unexpected error in loadDashboardItemsAuth:', err.message);
    return [];
  }
}

/**
 * Complete auth flow for dashboard
 */
async function completeAuthAndLoadDashboard() {
  try {
    const keys = await fetchUserDashboardKeys();
    if (keys.length === 0) {
      console.error('❌ User has no assigned dashboards');
      throw new Error('No dashboards assigned to this user');
    }

    selectDashboard('blanco-enterprise-dashboard');
    if (!selectedDashboardKey) {
      console.error('❌ Could not select any dashboard');
      throw new Error('Failed to select dashboard');
    }

    const items = await loadDashboardItemsAuth();

    return {
      success: true,
      currentUserId,
      allowedDashboardKeys,
      selectedDashboardKey,
      itemsLoaded: items.length,
      items
    };
  } catch (err) {
    console.error('❌ Auth and load flow failed:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

// Export for use in dashboard code
window.DashboardAuth = {
  fetchUserDashboardKeys,
  selectDashboard,
  loadDashboardItemsAuth,
  completeAuthAndLoadDashboard,
  getState: () => ({
    currentUserId,
    allowedDashboardKeys,
    selectedDashboardKey
  })
};
```

#### Step 3: Update Your HTML

**In your `index.html` `<head>` section, add:**

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="config/env.js"></script>
<script src="dashboard-auth-fix.js"></script>
```

**In your main `<script>` block, find where you initialize Supabase and update it:**

```javascript
// Load Supabase credentials
const ESTATE_ENV = window.__ESTATE_ENV || {};
const SUPABASE_URL = ESTATE_ENV.SUPABASE_URL || 'https://ribmywnovgzsmtuaxgrn.supabase.co';
const SUPABASE_KEY = ESTATE_ENV.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpYm15d25vdmd6c210dWF4Z3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjc0OTEsImV4cCI6MjA5MzY0MzQ5MX0.cIOgXx-8T_evKrDVvH6f4O-55RgusS1wKxso0xstLjs';

let sbClient = null;
if (window.supabase && SUPABASE_URL && SUPABASE_KEY) {
  try {
    // ✅ IMPORTANT: Do NOT use { db: { schema: 'api' } }
    // ✅ Leave schema as default (public) for proper RLS
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (err) {
    console.error('Supabase client initialization failed:', err);
  }
}
```

**Find your login/auth success handler and add:**

```javascript
// After successful login, load user-scoped dashboard data
if (window.DashboardAuth) {
  const result = await window.DashboardAuth.completeAuthAndLoadDashboard();
  if (!result.success) {
    console.error('Dashboard auth failed:', result.error);
    // Proceed anyway, let user try using localStorage data
  } else {
    console.log('✅ Dashboard authenticated and data loaded');
  }
}
```

#### Step 4: Add to Supabase Database

**Go to:** https://app.supabase.com/project/ribmywnovgzsmtuaxgrn/sql/new

**Run this SQL:**

```sql
INSERT INTO public.user_dashboards (user_id, dashboard_key, created_at)
VALUES ('b87f5fb4-6327-40f1-84b1-94d06e49262d', 'blanco-enterprise-dashboard', now());
```

Expected result: `1 row inserted` ✅

#### Step 5: Commit to GitHub

```bash
git add config/env.js dashboard-auth-fix.js index.html
git commit -m "Setup Supabase authentication for blanco-enterprise-dashboard

- Added Supabase credentials (shared project ribmywnovgzsmtuaxgrn)
- Created dashboard-auth-fix.js for user-scoped auth
- Updated index.html to initialize Supabase client (no schema override)
- Integrated completeAuthAndLoadDashboard() in login flow
- User assigned to blanco-enterprise-dashboard in public.user_dashboards

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

git push
```

#### Step 6: Test

1. **Hard refresh dashboard:** `Ctrl+Shift+F5`
2. **Login** with your email: `whomadeblanco@gmail.com`
3. **Check console** (F12) for:
   ```
   ✅ Authenticated user ID: b87f5fb4-6327-40f1-84b1-94d06e49262d
   ✅ Allowed dashboard keys: ["blanco-enterprise-dashboard"]
   ✅ Selected dashboard: blanco-enterprise-dashboard
   ✅ Loaded X items for blanco-enterprise-dashboard
   ```

### ✨ Success Criteria

- ✅ Supabase client initializes without errors
- ✅ You can login with your email
- ✅ Console shows your user ID and dashboard key
- ✅ Dashboard data loads from Supabase
- ✅ RLS ensures only your data is visible

---

## 📚 Reference Files

- **Masemula Dashboard**: https://github.com/NotMasemula/masemula-estate-dashboard
  - See: `config/env.js`, `dashboard-auth-fix.js`, commits for integration points
- **Blanco Enterprise Dashboard**: https://github.com/WhomadeBlanco/blanco-enterprise-dashboard

---

## ❓ Troubleshooting

| Issue | Solution |
|-------|----------|
| "No dashboards assigned" | SQL INSERT didn't run. Check `public.user_dashboards` table in Supabase |
| Supabase client undefined | Make sure CDN script tag is in `<head>` before other scripts |
| Can't login | Create auth user in Supabase with your email, set password |
| "api.user_dashboards does not exist" | Remove `{ db: { schema: 'api' } }` from createClient() call |

---

**Good luck!** 🚀
