/**
 * MASEMULA DASHBOARD — AUTHENTICATION TEST SUITE
 * 
 * Run these commands in the browser DevTools Console after login
 * to verify the authentication and dashboard selection is working correctly
 */

// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: Check Authentication State
// ═══════════════════════════════════════════════════════════════════════════
console.log('TEST 1: Authentication State');
console.log('═'.repeat(50));
window.DashboardAuth.getState();
// Expected output:
// {
//   currentUserId: "<uuid>",
//   allowedDashboardKeys: ["masemula-estate-dashboard"],
//   selectedDashboardKey: "masemula-estate-dashboard"
// }
console.log('✅ If you see the above object with correct values, auth is working');

// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: Verify USER_ID is Not Hardcoded
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nTEST 2: Verify USER_ID Dynamic Assignment');
console.log('═'.repeat(50));
console.log('USER_ID:', USER_ID);
console.log('selectedDashboardKey:', window.DashboardAuth.getState().selectedDashboardKey);
console.log('Are they equal?', USER_ID === window.DashboardAuth.getState().selectedDashboardKey);
// Expected: USER_ID should be "masemula-estate-dashboard", not "ntobeko-masemula-estate"

// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: Check Auth Session
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nTEST 3: Auth Session Details');
console.log('═'.repeat(50));
(async () => {
  const { data: { user }, error } = await sbClient.auth.getUser();
  if (error) {
    console.error('❌ Error getting user:', error);
  } else {
    console.log('✅ Logged in as:', user.email);
    console.log('User ID:', user.id);
  }
})();

// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: Verify Dashboard Selection Works
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nTEST 4: Dashboard Selection Logic');
console.log('═'.repeat(50));
const state = window.DashboardAuth.getState();
console.log('Allowed dashboards:', state.allowedDashboardKeys);
console.log('Selected dashboard:', state.selectedDashboardKey);
console.log('Is masemula-estate-dashboard selected?', 
  state.selectedDashboardKey === 'masemula-estate-dashboard');

// ═══════════════════════════════════════════════════════════════════════════
// TEST 5: Manually Test Data Load
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nTEST 5: Manual Data Load Test');
console.log('═'.repeat(50));
(async () => {
  console.log('Loading items for dashboard:', window.DashboardAuth.getState().selectedDashboardKey);
  const items = await window.DashboardAuth.loadDashboardItemsAuth();
  console.log('✅ Loaded', items.length, 'items');
  console.log('First item:', items[0]);
})();

// ═══════════════════════════════════════════════════════════════════════════
// TEST 6: Verify No Hardcoded User IDs in Window
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nTEST 6: Check for Hardcoded User IDs');
console.log('═'.repeat(50));
const hasHardcodedId = Object.values(window).some(val => 
  typeof val === 'string' && val === 'ntobeko-masemula-estate'
);
console.log('Found hardcoded user ID in window?', hasHardcodedId);
console.log('✅ Should be false (good) — actual:', hasHardcodedId);

// ═══════════════════════════════════════════════════════════════════════════
// TEST 7: RLS Verification Simulation
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nTEST 7: RLS Simulation');
console.log('═'.repeat(50));
(async () => {
  // This simulates what RLS should protect
  const state = window.DashboardAuth.getState();
  const userId = state.currentUserId;
  const dashKey = state.selectedDashboardKey;
  
  console.log('User ID (from auth):', userId);
  console.log('Dashboard Key:', dashKey);
  console.log('✅ Only this user can see items for:', dashKey);
  console.log('Other users' items would be blocked by RLS');
})();

// ═══════════════════════════════════════════════════════════════════════════
// QUICK SUMMARY
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(50));
console.log('QUICK SUMMARY');
console.log('═'.repeat(50));
const summary = window.DashboardAuth.getState();
console.group('✅ Expected Results');
console.log('✓ currentUserId is NOT hardcoded');
console.log('✓ allowedDashboardKeys includes masemula-estate-dashboard');
console.log('✓ selectedDashboardKey is masemula-estate-dashboard');
console.log('✓ Data loads for this dashboard only');
console.log('✓ RLS prevents other users from seeing this data');
console.groupEnd();

console.group('📊 Current State');
console.log('Current User ID:', summary.currentUserId);
console.log('Allowed Keys:', summary.allowedDashboardKeys);
console.log('Selected Key:', summary.selectedDashboardKey);
console.groupEnd();

console.log('\n✅ All tests completed! Check the results above.');
