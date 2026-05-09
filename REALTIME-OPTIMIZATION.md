# Realtime Listener Optimization Strategy

## Current Implementation Analysis

### What Works
- Real-time listeners are configured on all major tables (masemula_estate, habits_log, vision_board)
- Listeners use PostgREST subscriptions with `postgres_changes` event
- When data changes, `loadFromCloud()` and `renderAllSections()` are triggered
- Cross-device sync works (tested and verified)

### What Could Be Better

#### Problem 1: Refresh Storms
**Current behavior:**
- User is on the dashboard
- Any data change in the table triggers a listener event
- Even if 5 changes occur in 1 second, all 5 trigger full re-renders
- Result: UI flickering, increased CPU usage, battery drain on mobile

**Impact:**
- 100 rapid ledger entries = 100 full re-renders (bad for performance)
- Mobile users see constant screen redraws
- Battery drains faster

**Solution:**
- Add debounce: Wait 500ms after last change, then re-render once
- Reduces 100 renders to 1 render (huge improvement)

#### Problem 2: Listening to All Users' Data
**Current behavior:**
- Listener is on entire `masemula_estate` table
- When User B's data changes, it triggers User A's listener too
- RLS blocks User A from seeing User B's data, but still triggers the listener

**Impact:**
- User A is re-rendering unnecessarily when User B makes changes
- Wasted CPU cycles
- If multiple partners use dashboard, each one triggers others' listeners

**Solution:**
- Add filter to listener: `filter: 'owner_uid=eq.${USER_ID}'`
- Only listen to current user's data changes
- Prevents cross-user interference

#### Problem 3: No Realtime Health Check
**Current behavior:**
- If WebSocket connection drops, listeners silently stop working
- User doesn't know if sync is still active
- Data becomes stale without user noticing

**Impact:**
- User might think changes are syncing but they're not
- Potential data loss if user assumes changes are backed up
- Silent failure is worse than obvious failure

**Solution:**
- Monitor realtime connection health (ping every 30 seconds)
- If stale (no ping response), show warning or reconnect
- Log when connection is healthy vs stale

---

## Implementation Guide

### Step 1: Create Debounce Utility

Add this to your dashboard JavaScript:

```javascript
// Debounce utility (reusable)
function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Example usage:
const debouncedRefresh = debounce(async () => {
  await loadFromCloud();
  renderAllSections();
}, 500);  // Wait 500ms of inactivity before refreshing
```

### Step 2: Filter Realtime Listeners by User

Before:
```javascript
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'masemula_estate'
}, async (payload) => {
  await loadFromCloud();
  renderAllSections();
})
```

After:
```javascript
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'masemula_estate',
  filter: `owner_uid=eq.${USER_ID}`  // Add this filter
}, async (payload) => {
  debouncedRefresh();  // Use debounced version
})
```

### Step 3: Add Realtime Health Check

Add this monitoring code:

```javascript
// Track realtime connection health
let lastRealtimeEvent = Date.now();
let realtimeHealthy = true;

// Check health every 30 seconds
setInterval(() => {
  const timeSinceLastEvent = Date.now() - lastRealtimeEvent;
  const isStale = timeSinceLastEvent > 60000;  // 60 seconds = stale
  
  if (isStale && realtimeHealthy) {
    console.warn('Realtime connection appears stale, last event:', new Date(lastRealtimeEvent));
    realtimeHealthy = false;
    showWarning('Sync may be delayed');
    // Optionally reconnect:
    reconnectRealtime();
  } else if (!isStale && !realtimeHealthy) {
    console.log('Realtime connection restored');
    realtimeHealthy = true;
    hideWarning();
  }
}, 30000);  // Check every 30 seconds

// Update timestamp on every realtime event
function onRealtimeEvent() {
  lastRealtimeEvent = Date.now();
  if (!realtimeHealthy) {
    realtimeHealthy = true;
    hideWarning();
  }
}

// Call this inside your listener callbacks:
.on('postgres_changes', { ... }, (payload) => {
  onRealtimeEvent();  // Track that we received an event
  debouncedRefresh();
})
```

### Step 4: Implement Reconnect Logic

```javascript
async function reconnectRealtime() {
  console.log('Attempting to reconnect realtime listeners...');
  
  // Unsubscribe from old listener
  if (realtimeSubscription) {
    realtimeSubscription.unsubscribe();
  }
  
  // Wait a bit before reconnecting
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Re-establish listeners (exact same code as startup)
  setupRealtimeListeners();
  
  console.log('Realtime listeners re-established');
}
```

---

## Code Changes Required

### Current Listeners Location
The dashboard likely has realtime listeners in these functions:
- `setupRealtimeListeners()` (or similar)
- Or inline in `completeAuthAndLoadDashboard()`

### Changes Needed

1. **Add debounce utility** (lines ~2400):
```javascript
function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
```

2. **Create debounced refresh** (near setup):
```javascript
const debouncedRefresh = debounce(async () => {
  await loadFromCloud();
  renderAllSections();
}, 500);
```

3. **Update listener setup** (find where listeners are created):
```javascript
// Add filter to each listener
filter: `owner_uid=eq.${USER_ID}`

// Call debounced version instead of direct function
debouncedRefresh();  // instead of loadFromCloud(); renderAllSections();
```

4. **Add health monitoring** (near startup):
```javascript
let lastRealtimeEvent = Date.now();
let realtimeHealthy = true;

setInterval(() => {
  const timeSinceLastEvent = Date.now() - lastRealtimeEvent;
  if (timeSinceLastEvent > 60000 && realtimeHealthy) {
    console.warn('Realtime connection stale');
    realtimeHealthy = false;
    // Show UI warning or reconnect
  }
}, 30000);
```

---

## Testing Checklist

### Test 1: Debounce Works
1. Open dashboard in browser
2. Open DevTools Console
3. Add 5 ledger entries rapidly (within 1 second)
4. Expected: Only 1 `loadFromCloud()` call (not 5)
5. Verify: Console logs should show "Refresh triggered" once, not 5 times

### Test 2: Filter Works
1. Open dashboard on Desktop (User A)
2. Open dashboard on Mobile (same User A)
3. On Mobile: Add a new habit
4. On Desktop: Should see the habit appear (listener triggered)
5. Expected: Desktop refreshes once (because filter matches)

### Test 3: Filter Blocks Other Users
1. Open dashboard as User A
2. Open dashboard as User B (different account)
3. As User B: Add a new ledger entry
4. As User A: Monitor console
5. Expected: No listener event for User A (filter blocks it)
6. Verify: User A's screen doesn't refresh

### Test 4: Health Check Works
1. Open dashboard
2. Wait 2 minutes without making any changes
3. Expected: Console shows "Realtime connection appears stale" after 60 seconds
4. Open DevTools Network tab
5. Verify: No WebSocket activity for 60+ seconds

### Test 5: Reconnect Works
1. Open dashboard
2. In DevTools Network tab, find WebSocket connection
3. Throttle network to Slow 3G (DevTools Settings)
4. Add a new entry
5. Wait 60+ seconds
6. Expected: Console shows reconnection attempt
7. Restore network
8. Expected: New data syncs correctly

### Test 6: Performance Improvement
1. Before optimization:
   - Add 20 entries rapidly
   - Monitor UI (count re-renders)
   - Expected: 20 re-renders, slow UI
   
2. After optimization:
   - Add 20 entries rapidly
   - Monitor UI (count re-renders)
   - Expected: 1 re-render, smooth UI

---

## Performance Metrics

### Before Optimization
- 100 rapid changes = 100 listener events = 100 re-renders
- Battery drain: High (constant screen updates)
- CPU usage: Spiky (each event = full re-render)
- User experience: Flickering, laggy

### After Optimization
- 100 rapid changes = 100 listener events = 1 re-render (500ms debounce)
- Battery drain: Low (single re-render)
- CPU usage: Smooth (batched processing)
- User experience: Smooth, responsive

### Estimated Savings
- Mobile battery: 20-30% longer per session
- CPU usage: 90% reduction during bulk sync
- Network: No change (same number of PostgreSQL changes)
- User happiness: Significantly improved

---

## Advanced Optimization (Optional)

### Option 1: Selective Re-render
Instead of re-rendering ALL sections, only update the changed table:

```javascript
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'habits_log',
  filter: `owner_uid=eq.${USER_ID}`
}, async (payload) => {
  // Only reload habits, not entire dashboard
  await loadFromCloud();  // This could be optimized too
  renderRoutineSection();  // Only re-render Routine section
})
```

### Option 2: Batch Events
Instead of waiting 500ms, batch multiple events into one:

```javascript
let pendingEvents = [];
const batchedRefresh = debounce(() => {
  console.log('Batch refresh:', pendingEvents.length, 'changes');
  loadFromCloud();
  renderAllSections();
  pendingEvents = [];
}, 500);

.on('postgres_changes', { ... }, (payload) => {
  pendingEvents.push(payload);
  batchedRefresh();
})
```

### Option 3: Merge Strategy
Track what changed and only fetch those sections:

```javascript
let changedTables = new Set();

.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'habits_log'
}, (payload) => {
  changedTables.add('habits');
  debouncedRefresh();
})

const debouncedRefresh = debounce(async () => {
  // Only fetch changed tables
  if (changedTables.has('habits')) {
    await loadFromCloud('habits');
  }
  // Re-render only changed sections
  changedTables.forEach(table => renderSection(table));
  changedTables.clear();
}, 500);
```

---

## Deployment Steps

1. **Backup current code** (git commit)
2. **Add debounce utility** to dashboard
3. **Update listener setup** with filter and debounce
4. **Add health monitoring** code
5. **Test locally** (use checklist above)
6. **Deploy to GitHub Pages**
7. **Test on production**
8. **Monitor** first 24 hours for any issues
9. **If issues:** Revert to previous version, debug, retry

---

## Troubleshooting

### Listeners not firing after filter added
**Cause:** Filter syntax incorrect
**Fix:** Verify filter format: `owner_uid=eq.${USER_ID}`
**Test:** Log `USER_ID` to console, ensure it's a valid UUID

### Still seeing performance issues
**Cause:** Debounce delay too short
**Fix:** Increase from 500ms to 1000ms
**Trade-off:** Sync appears slightly slower but much smoother

### Reconnect not working
**Cause:** Old listener not unsubscribed
**Fix:** Ensure `unsubscribe()` is called before setting up new listener
**Verify:** Check realtime subscriptions in browser DevTools

### Health check triggering false alarms
**Cause:** 60 second timeout too short for slow networks
**Fix:** Increase to 120 seconds for slower connections
**Test:** Throttle network to Slow 3G and verify no false positives

---

## Success Criteria

✅ Debounce reduces 100 events to 1 re-render
✅ Filter prevents listening to other users' changes
✅ Health check detects connection stale after 60 seconds
✅ Reconnect restores sync automatically
✅ No user-facing errors or console warnings
✅ Mobile performance significantly improved
✅ Desktop performance unchanged or improved

---

## Next Steps

1. Implement Phase 5 changes
2. Run testing checklist
3. Monitor production for 24 hours
4. Gather user feedback on performance
5. Consider advanced optimizations if needed
6. Document final setup in README
