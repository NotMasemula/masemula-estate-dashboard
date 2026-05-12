# Cross-Device Sync System Design

## Problem
Changes made on one device sometimes do not appear on another device. The fix must improve cross-device sync without breaking existing dashboard behavior.

## Goals
- Keep current dashboard features intact.
- Make sync reliable on both Masemula Estate and Blanco Enterprise.
- Support each dashboard’s existing data shape.
- Recover from missed realtime events.

## Non-goals
- No UI redesign.
- No schema redesign beyond sync-related safety.
- No change to existing module behavior outside sync.

## Proposed system
Use one shared sync engine with per-dashboard adapters.

### Shared engine responsibilities
- Verify auth and session token.
- Ensure a cloud row exists for the signed-in user.
- Save a full snapshot to Supabase.
- Load the latest snapshot from Supabase.
- Send a broadcast event after successful saves.
- Listen for broadcasts and refresh the dashboard.
- Poll for remote changes as a fallback.

### Dashboard adapters
Each dashboard provides:
- table name
- user key field
- snapshot serializer
- snapshot hydrator
- refresh callback

### Dashboard-specific behavior
- **Masemula Estate**
  - Uses the `public.masemula_estate` blob.
  - Loads and saves the full dashboard snapshot.
  - Refreshes the full dashboard when sync changes arrive.

- **Blanco Enterprise**
  - Uses `public.tshego_estate` and section-based loads.
  - Saves the current dashboard state snapshot.
  - Refreshes the relevant section loaders when sync changes arrive.

## Data flow
1. User signs in.
2. Sync engine checks for the user row.
3. If missing, it creates the row from current local state.
4. On save, the engine writes the snapshot and updates `updated_at`.
5. The engine emits a broadcast for `user:<uid>`.
6. Other devices receive the broadcast and reload.
7. A poller checks `updated_at` and reloads if a broadcast was missed.

## Error handling
- Save failures leave the dashboard usable offline.
- Missing rows are created automatically.
- Broadcast failures do not block persistence.
- Pull failures keep the last known local state visible.

## Testing
- Save on one device and confirm the other reloads.
- Verify both dashboards bootstrap a missing cloud row.
- Verify polling still syncs when broadcast is missed.
- Verify Masemula and Blanco remain independent.

## Rollout
- Keep current UI and dashboard logic.
- Replace only the sync wiring.
- Validate Masemula first, then Blanco, then both together.
