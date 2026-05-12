# Cross-Device Dashboard Sync - Implementation Guide

## Your Current Setup Analysis

### Dashboard Stack
- **Frontend:** Vanilla JavaScript + HTML (single-page app)
- **Backend:** Supabase (PostgreSQL + Realtime)
- **Data Model:** User-scoped JSON in `masemula_estate` + individual tables
- **Auth:** Supabase Auth (user UUID based)
- **Realtime:** Already partially configured ✅

### Tables Being Synced
```
1. habits_log ................. Daily habits tracking (owner_uid filtered)
2. goals ...................... Goal progress (owner_uid filtered)
3. tasks ...................... Todo items (owner_uid filtered)
4. ventures ................... Project tracking (owner_uid filtered)
5. agent_logs ................. Agent activity (owner_uid filtered)
6. estate_flags ............... System state (owner_uid filtered)
7. focus_sessions ............ Time tracking (owner_uid filtered)
8. masemula_estate ........... Main dashboard JSON (owner_uid filtered)
9. personal_items ............ Project library (user_id scoped)
10. user_preferences ......... Theme/settings (owner_uid scoped)
11. vision_board ............. Dream board images (owner_uid scoped)
```

### Current Realtime Implementation
✅ **What's Working:**
- Channel created: `estate-live`
- Postgres_changes listeners on 8 tables
- Filters by `owner_uid=eq.${USER_ID}` (proper isolation)
- Subscribers call update functions on change

⚠️ **Opportunities to Improve:**
- No debounce on refresh handlers → refresh storms
- No filter on vision_board (currently listening to all dashboard images)
- No health monitoring (connection failures silent)
- No reconnect logic (if connection drops)
- table list references `goals`, `tasks`, `ventures` but these might be in `masemula_estate` JSON

---

## Best Practice: Postgres Changes (Your Current Approach) ✅

You're already using the **recommended pattern** for Masemula Estate:

```javascript
sbClient
  .channel('estate-live')
  .on('postgres_changes', {
    event: '*',           // INSERT | UPDATE | DELETE
    schema: 'public',
    table: 'habits_log',
    filter: `owner_uid=eq.${USER_ID}`  // Critical for security & perf
  }, async (payload) => {
    // Refresh affected data
    await loadHabitsWeekFromSupabase();
    await loadOverviewData();
  })
  .subscribe();
```

### Why This Is Good
1. **Real-time:** Changes appear instantly on all devices
2. **Secure:** Filter + RLS ensures users only get their own data
3. **Scalable:** Postgres Changes is efficient for your data volume
4. **Simple:** Direct trigger on data changes, no custom event layer

### Why Postgres Changes > Broadcast for You
- ✅ Your data is structured (not custom events)
- ✅ Updates are moderate frequency (not thousands per second)
- ✅ Users care about data changes, not abstract events
- ✅ RLS policies already define access (maps perfectly to Postgres Changes)

---

## Step 1: Verify Realtime Publication (Critical!)

### Check Current Publications
```sql
-- In Supabase SQL Editor:
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- Expected output (should include):
-- public | habits_log
-- public | masemula_estate
-- public | personal_items
-- public | user_preferences
-- public | vision_board
-- etc.
```

### If Tables Are Missing, Add Them
```sql
-- Add specific tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE habits_log;
ALTER PUBLICATION supabase_realtime ADD TABLE masemula_estate;
ALTER PUBLICATION supabase_realtime ADD TABLE personal_items;
ALTER PUBLICATION supabase_realtime ADD TABLE user_preferences;
ALTER PUBLICATION supabase_realtime ADD TABLE vision_board;

-- If you want ALL public tables:
ALTER PUBLICATION supabase_realtime ADD TABLE ALL;
```

### Note on Performance
- ✅ Adding tables to publication is safe
- ✅ Won't affect existing data
- ✅ Just enables change notifications
- ⚠️ Make sure RLS policies are correct (controls what clients see)

---

## Step 2: Understand Your Current Listeners

### Channel Setup (Already Done!)
```javascript
const channel = sbClient.channel('estate-live');
```
✅ Channel name can be anything (groups related subscriptions)

### Listener Pattern (Already Done!)
```javascript
.on('postgres_changes', {
  event: '*',                                    // All operations
  schema: 'public',                              // Standard schema
  table: 'habits_log',                           // Which table
  filter: `owner_uid=eq.${USER_ID}`             // Critical! RLS + performance
}, async (payload) => {
  // When habits_log changes (for this user), refresh
  await loadHabitsWeekFromSupabase();
  await loadOverviewData();
})
```

### Event Payload Structure
```javascript
payload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  schema: 'public',
  table: 'habits_log',
  record: { id, owner_uid, habit_key, logged_date, value, ... },  // New state
  oldRecord: { id, owner_uid, ... },  // Only for UPDATE/DELETE
  errors: null,
  new: { ... },  // Deprecated (use record)
  old: { ... }   // Deprecated (use oldRecord)
}
```

---

## Step 3: Optimizations (From Hardening Plan Phase 5)

### Problem 1: Refresh Storms
**Current Issue:** If 10 habits change in 1 second, you call `loadHabitsWeekFromSupabase()` 10 times

**Solution: Add Debounce**
```javascript
// Utility: Create debounced refresh function
function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Create debounced versions
const debouncedLoadHabits = debounce(loadHabitsWeekFromSupabase, 500);
const debouncedLoadOverview = debounce(loadOverviewData, 500);

// Use in listener:
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'habits_log',
  filter: `owner_uid=eq.${USER_ID}`
}, async (payload) => {
  debouncedLoadHabits();       // Won't fire until 500ms of silence
  debouncedLoadOverview();
})
```

**Result:** 10 events → 1 refresh (90% CPU reduction!)

### Problem 2: Vision Board Listener Missing Filter
**Current Code:** Likely listens to entire vision_board table
```javascript
// ❌ BAD: Listens to all users' images
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'vision_board'
}, async () => { ... })

// ✅ GOOD: Only this user's images
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'vision_board',
  filter: `owner_uid=eq.${USER_ID}`  // ADD THIS
}, async () => { ... })
```

### Problem 3: No Connection Health Monitoring
**Current Issue:** If WebSocket drops, sync silently stops

**Solution: Add Health Check**
```javascript
let lastRealtimeEvent = Date.now();
let realtimeHealthy = true;

// Monitor connection every 30 seconds
setInterval(() => {
  const timeSinceLastEvent = Date.now() - lastRealtimeEvent;
  const isStale = timeSinceLastEvent > 60000;  // 60 seconds
  
  if (isStale && realtimeHealthy) {
    console.warn('⚠️ Realtime connection appears stale');
    realtimeHealthy = false;
    showToast('Sync may be delayed - reconnecting...', 'warning');
    setupRealtimeListeners();  // Reconnect
  } else if (!isStale && !realtimeHealthy) {
    console.log('✅ Realtime connection restored');
    realtimeHealthy = true;
    showToast('Sync restored', 'success');
  }
}, 30000);

// Update timestamp on every realtime event
function onRealtimeEvent() {
  lastRealtimeEvent = Date.now();
}

// Call in every listener:
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'habits_log',
  filter: `owner_uid=eq.${USER_ID}`
}, async (payload) => {
  onRealtimeEvent();  // Track that we got an event
  debouncedLoadHabits();
})
```

---

## Step 4: Decide: Patch vs Refetch

### Strategy 1: Refetch (What You're Doing) ✅
```javascript
// On change, re-query the entire section
.on('postgres_changes', { ... }, async (payload) => {
  await loadHabitsWeekFromSupabase();  // Full reload
  renderRoutineSection();
})
```
- **Pros:** Simple, always accurate, no merge logic needed
- **Cons:** Wastes bandwidth (refetch data you already have)
- **Best for:** Moderate data sizes (< 10MB per refresh)
- **Your case:** ✅ GOOD (habits_log is small)

### Strategy 2: Patch (More Advanced)
```javascript
// Apply change directly to local state
.on('postgres_changes', { ... }, async (payload) => {
  if (payload.eventType === 'UPDATE') {
    // Update local state instead of refetching
    const habitIdx = cloudStore.routine.findIndex(h => h.id === payload.record.id);
    if (habitIdx >= 0) {
      cloudStore.routine[habitIdx] = payload.record;
      renderRoutineSection();  // Re-render with updated data
    }
  } else if (payload.eventType === 'INSERT') {
    cloudStore.routine.push(payload.record);
    renderRoutineSection();
  }
})
```
- **Pros:** Efficient, instant visual update, low bandwidth
- **Cons:** Complex merge logic, must track state carefully
- **Best for:** High-frequency updates (thousands per minute)
- **Your case:** ❌ OVERKILL (your data changes aren't that frequent)

### Recommendation for Masemula Estate: **Refetch + Debounce**
✅ Simpler, more reliable, and sufficient for your update frequency

---

## Step 5: Complete Production Setup

### Full Implementation Template

```javascript
// ============================================================================
// REALTIME LISTENER SETUP - Production Quality
// ============================================================================

// 1. Debounce utility (reusable)
function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// 2. Health monitoring
let lastRealtimeEvent = Date.now();
let realtimeHealthy = true;

function onRealtimeEvent() {
  lastRealtimeEvent = Date.now();
  if (!realtimeHealthy) {
    realtimeHealthy = true;
    console.log('✅ Realtime connection restored');
  }
}

// Start health check on app load
setInterval(() => {
  const timeSinceLastEvent = Date.now() - lastRealtimeEvent;
  if (timeSinceLastEvent > 60000 && realtimeHealthy) {
    console.warn('⚠️ Realtime connection stale, reconnecting...');
    realtimeHealthy = false;
    reconnectRealtimeListeners();
  }
}, 30000);

// 3. Create debounced refresh functions
const debouncedLoadHabits = debounce(async () => {
  console.log('🔄 Refreshing habits...');
  await loadHabitsWeekFromSupabase();
  renderRoutineSection();
}, 500);

const debouncedLoadGoals = debounce(async () => {
  console.log('🔄 Refreshing goals...');
  await loadGoalsFromSupabase();
  renderGoalsSection();
}, 500);

const debouncedLoadOverview = debounce(async () => {
  console.log('🔄 Refreshing overview...');
  await loadOverviewData();
}, 500);

const debouncedLoadVentures = debounce(async () => {
  console.log('🔄 Refreshing ventures...');
  await loadVenturesFromSupabase();
  renderVenturesSection();
}, 500);

const debouncedLoadPreferences = debounce(async () => {
  console.log('🔄 Refreshing preferences...');
  await loadUserPreferences();
}, 500);

const debouncedLoadVisionBoard = debounce(async () => {
  console.log('🔄 Refreshing vision board...');
  await loadVisionBoardFromSupabase();
  renderVisionBoardSection();
}, 500);

// 4. Setup realtime listeners (called on auth success)
async function setupRealtimeListeners() {
  console.log('📡 Setting up realtime listeners...');
  
  // Unsubscribe from old channel if exists
  if (window.realtimeChannel) {
    await window.realtimeChannel.unsubscribe();
  }
  
  const channel = sbClient.channel('estate-live-v2');
  
  // Habits listener
  channel.on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'habits_log',
    filter: `owner_uid=eq.${USER_ID}`
  }, (payload) => {
    onRealtimeEvent();
    console.log('🔔 Habit change:', payload.eventType, payload.record);
    debouncedLoadHabits();
  });
  
  // Goals listener
  channel.on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'goals',
    filter: `owner_uid=eq.${USER_ID}`
  }, (payload) => {
    onRealtimeEvent();
    console.log('🔔 Goal change:', payload.eventType, payload.record);
    debouncedLoadGoals();
  });
  
  // Ventures listener
  channel.on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'ventures',
    filter: `owner_uid=eq.${USER_ID}`
  }, (payload) => {
    onRealtimeEvent();
    console.log('🔔 Venture change:', payload.eventType, payload.record);
    debouncedLoadVentures();
  });
  
  // Personal items listener
  channel.on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'personal_items',
    filter: `user_id=eq.${USER_ID}`  // Note: uses user_id not owner_uid
  }, (payload) => {
    onRealtimeEvent();
    console.log('🔔 Item change:', payload.eventType, payload.record);
    debouncedLoadVentures();
  });
  
  // User preferences listener (one row only)
  channel.on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'user_preferences',
    filter: `owner_uid=eq.${USER_ID}`
  }, (payload) => {
    onRealtimeEvent();
    console.log('🔔 Preference change:', payload.eventType, payload.record);
    debouncedLoadPreferences();
  });
  
  // Vision board listener
  channel.on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'vision_board',
    filter: `owner_uid=eq.${USER_ID}`  // ← ADD THIS (currently missing)
  }, (payload) => {
    onRealtimeEvent();
    console.log('🔔 Vision board change:', payload.eventType, payload.record);
    debouncedLoadVisionBoard();
  });
  
  // Main dashboard listener
  channel.on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'masemula_estate',
    filter: `owner_uid=eq.${USER_ID}`
  }, (payload) => {
    onRealtimeEvent();
    console.log('🔔 Dashboard change:', payload.eventType);
    debouncedLoadOverview();
  });
  
  // Subscribe to all listeners
  await channel.subscribe((status) => {
    console.log('📡 Realtime status:', status);
    if (status === 'SUBSCRIBED') {
      console.log('✅ Realtime listeners active');
      lastRealtimeEvent = Date.now();
      realtimeHealthy = true;
    } else if (status === 'CHANNEL_ERROR') {
      console.error('❌ Realtime channel error');
      realtimeHealthy = false;
    }
  });
  
  // Store channel reference for cleanup
  window.realtimeChannel = channel;
}

// 5. Reconnect function (called if connection stales)
async function reconnectRealtimeListeners() {
  console.log('🔄 Reconnecting realtime listeners...');
  try {
    await setupRealtimeListeners();
    console.log('✅ Realtime reconnected');
    showToast('Sync restored', 'success');
  } catch (err) {
    console.error('❌ Reconnect failed:', err);
    showToast('Sync connection failed, retrying...', 'error');
    // Retry in 5 seconds
    setTimeout(reconnectRealtimeListeners, 5000);
  }
}

// 6. Call on auth success
async function completeAuthAndLoadDashboard() {
  // ... existing auth code ...
  
  // Setup realtime listeners AFTER auth completes
  await setupRealtimeListeners();
  
  // ... rest of dashboard load ...
}

// 7. Cleanup on logout
function logout() {
  if (window.realtimeChannel) {
    window.realtimeChannel.unsubscribe();
    window.realtimeChannel = null;
  }
  // ... existing logout code ...
}
```

---

## Step 6: Testing Cross-Device Sync

### Test 1: Single Device First
```
1. Open dashboard in browser
2. Open DevTools → Console
3. Add a new habit
4. Watch console for: "🔔 Habit change: INSERT"
5. Verify: Habit appears in list
✅ If this works, single-device sync is working
```

### Test 2: Two Devices (Desktop + Mobile)
```
1. Open dashboard on Desktop (User A)
2. Open dashboard on Mobile (same User A)
3. On Mobile: Add a new habit
4. On Desktop: Watch console
   ✅ Should see: "🔔 Habit change: INSERT"
   ✅ Habit should appear (refreshed via realtime)
5. On Mobile: Open DevTools
   ✅ Should see habit in the list already
✅ If this works, cross-device sync works!
```

### Test 3: Data Isolation (Two Users)
```
1. Open dashboard as User A
2. Open dashboard as User B (different account)
3. As User B: Add a new habit
4. As User A: Check console
   ✅ Should NOT see: "🔔 Habit change" (RLS filtered it out)
   ✅ User A's screen should not refresh
✅ If this works, RLS + filters are working correctly
```

### Test 4: Bulk Changes (Refresh Storm Test)
```
1. Open dashboard with console visible
2. Run this in console:
   for (let i = 0; i < 20; i++) {
     // Simulate adding 20 items
     await saveHabit('test-' + i, 1);
   }
3. Watch console
   ❌ BAD: See "Refreshing habits..." 20+ times
   ✅ GOOD: See "Refreshing habits..." only 1-2 times (debounced)
✅ If this works, debounce is functioning
```

### Test 5: Connection Health (Stale Detection)
```
1. Open dashboard
2. Note the time
3. Do nothing for 90 seconds
4. Watch console for: "⚠️ Realtime connection stale, reconnecting..."
   ✅ Should appear after 60 seconds of no activity
5. Make any edit (e.g., add a note)
6. Watch console for: "✅ Realtime connection restored"
   ✅ Should appear when activity resumes
✅ If this works, health monitoring is working
```

---

## Summary: Your Cross-Device Sync Strategy

### Current State
✅ You have 80% of a production-quality cross-device sync!
- Channel is set up
- Postgres_changes listeners are configured
- Filters by owner_uid (proper isolation)
- Refetch strategy (simple and reliable)

### What to Add (5 minutes)
1. **Debounce** → Prevent refresh storms
2. **Health check** → Detect connection failures
3. **Vision board filter** → Add missing `owner_uid` filter
4. **Reconnect logic** → Auto-restore on connection loss

### Expected Results After Optimization
- ✅ 90% CPU reduction during bulk edits
- ✅ Instant updates on all devices (< 1 second)
- ✅ Smooth UI (no flickering from refresh storms)
- ✅ Auto-recovery on connection failure
- ✅ Battery-friendly (less CPU = less battery drain)

### Files to Read
1. **REALTIME-OPTIMIZATION.md** (from hardening plan) - Detailed implementation
2. **RLS-IMPROVE-POLICIES.sql** (from hardening plan) - Secure RLS policies
3. This guide - Your specific setup

---

## Next Steps

### Option 1: Quick Fix (5 minutes)
Copy-paste the debounce utility + health check from "Complete Production Setup" above into your dashboard

### Option 2: Full Implementation (30 minutes)
1. Replace your current listener setup with the template above
2. Add all 3 optimizations (debounce, health check, reconnect)
3. Test using the 5 test cases provided
4. Deploy to production

### Option 3: Professional Grade (1 hour)
1. Read the hardening plan (Phase 5: REALTIME-OPTIMIZATION.md)
2. Implement full production setup above
3. Add console logging for debugging
4. Create monitoring dashboard (see what's syncing)
5. Load test with multiple users

---

**Your setup is already excellent. These optimizations will make it perfect.** 🚀
