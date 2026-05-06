// ═══════════════════════════════════════════════════════════════════════════
// Dashboard Authentication & User-Scoped Data Loading
// ═══════════════════════════════════════════════════════════════════════════
// This module properly implements:
// 1. User authentication via Supabase Auth
// 2. Fetching allowed dashboard keys from public.user_dashboards
// 3. Selecting the masemula-estate-dashboard for this user
// 4. Loading items from public.personal_items with proper RLS/auth context
// ═══════════════════════════════════════════════════════════════════════════

// Global state for dashboard-specific user context
let currentUserId = null;           // From auth.uid() — never expose in UI
let allowedDashboardKeys = [];      // User's assigned dashboard keys
let selectedDashboardKey = null;    // Currently active dashboard (e.g., 'masemula-estate-dashboard')

/**
 * Fetch the list of dashboard keys this user can access
 * Called after successful auth, before loading dashboard
 */
async function fetchUserDashboardKeys() {
  if (!sbClient || !authSession) {
    console.warn('⚠️ fetchUserDashboardKeys: Not authenticated');
    return [];
  }

  try {
    // Get current user's ID
    const { data: { user }, error: userErr } = await sbClient.auth.getUser();
    if (userErr || !user) {
      console.error('❌ Could not get current user:', userErr);
      return [];
    }
    currentUserId = user.id;
    console.log('✅ Authenticated user ID:', currentUserId);

    // Query user_dashboards for this user
    // RLS will automatically filter by auth.uid() = user_id
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
 * For Masemula dashboard, we prioritize 'masemula-estate-dashboard'
 */
function selectDashboard(preferredKey = 'masemula-estate-dashboard') {
  if (!allowedDashboardKeys || allowedDashboardKeys.length === 0) {
    console.warn('⚠️ No dashboard keys available');
    selectedDashboardKey = null;
    return null;
  }

  // Try to use the preferred key if it exists
  if (allowedDashboardKeys.includes(preferredKey)) {
    selectedDashboardKey = preferredKey;
    console.log('✅ Selected dashboard:', selectedDashboardKey);
    return selectedDashboardKey;
  }

  // Fallback: use the first available key
  selectedDashboardKey = allowedDashboardKeys[0];
  console.warn(`⚠️ Preferred dashboard '${preferredKey}' not found. Using first available:`, selectedDashboardKey);
  return selectedDashboardKey;
}

/**
 * Load dashboard items from public.personal_items
 * Uses authenticated user scope + selected dashboard key
 * RLS filters to ensure only this user's data is returned
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
 * Complete auth flow for dashboard:
 * 1. Fetch dashboard keys
 * 2. Select Masemula dashboard
 * 3. Load items
 */
async function completeAuthAndLoadDashboard() {
  try {
    // Step 1: Fetch allowed dashboard keys
    const keys = await fetchUserDashboardKeys();
    if (keys.length === 0) {
      console.error('❌ User has no assigned dashboards');
      throw new Error('No dashboards assigned to this user');
    }

    // Step 2: Select Masemula dashboard
    selectDashboard('masemula-estate-dashboard');
    if (!selectedDashboardKey) {
      console.error('❌ Could not select any dashboard');
      throw new Error('Failed to select dashboard');
    }

    // Step 3: Load items
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

// Export for use in main dashboard code
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
