-- ═══════════════════════════════════════════════════════════════════════════════
-- CRITICAL FIX: Broadcast Trigger Missing owner_uid Field
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- ISSUE: Cross-device sync fails silently because old broadcast trigger on 
-- masemula_estate table assumes owner_uid field (which doesn't exist)
--
-- ERROR SEEN: "ERROR 42703: record 'old' has no field 'owner_uid'"
--
-- IMPACT: Realtime sync never fires, so changes on one device don't appear 
-- on another until manual refresh (12-second polling kicks in but broadcast is broken)
--
-- SOLUTION: Drop the broken trigger. The modern approach uses supabase.on('broadcast')
-- client-side instead of server-side triggers.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Drop the broken trigger
-- ═══════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS broadcast_changes_masemula_estate ON public.masemula_estate;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Verify the trigger is gone
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name LIKE '%masemula_estate%';

-- Expected: 0 rows returned (no triggers found)

-- ═══════════════════════════════════════════════════════════════════════════════
-- HOW TO RUN THIS FIX:
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- 1. Go to: https://app.supabase.com/project/ribmywnovgzsmtuaxgrn/sql/new
-- 2. Paste this entire file
-- 3. Click "Run" or press Cmd+Enter
-- 4. See result: "0 rows returned" — trigger is gone ✅
-- 5. Test: Make a change on Device A, sync should broadcast to Device B within 1s
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- TESTING CROSS-DEVICE SYNC AFTER FIX:
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- Device A (PC):
--   1. Log in to dashboard
--   2. Add a journal entry: "Testing broadcast sync"
--   3. Click "↻ Sync" button in top right
--   4. Console shows: "☁️ Synced to cloud"
--
-- Device B (Phone):
--   1. Dashboard already open and listening for changes
--   2. Within 1 second: new entry appears (broadcast event)
--   3. If not, polling catches it within 12 seconds
--   4. Console shows: "Received broadcast event"
--
-- If entry does NOT appear:
--   - Click "↻ Sync" button to force manual poll
--   - Check console (F12) for error messages
--   - Verify RLS policy allows auth.uid() access
--
-- ═══════════════════════════════════════════════════════════════════════════════
