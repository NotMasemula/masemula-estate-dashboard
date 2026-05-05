#!/usr/bin/env node
/**
 * sync-routine.mjs
 * Reads docs/routine-schedule.json and upserts it into the Supabase estate_data
 * table under the dedicated routine key.
 *
 * Required environment variables (set as GitHub Secrets):
 *   SUPABASE_URL              – Your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY – Service-role key (server-side only, never expose in browser)
 *   ROUTINE_USER_ID           – (optional) Defaults to 'ntobeko-masemula-routine'
 *
 * Usage:
 *   node scripts/sync-routine.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Validate required environment variables ──────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ROUTINE_USER_ID = process.env.ROUTINE_USER_ID || 'ntobeko-masemula-routine';

if (!SUPABASE_URL) {
  console.error('❌  SUPABASE_URL environment variable is required');
  process.exit(1);
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

// ─── Load routine schedule from docs ─────────────────────────────────────
const schedulePath = resolve(__dirname, '..', 'docs', 'routine-schedule.json');
let scheduleData;
try {
  const raw = readFileSync(schedulePath, 'utf8');
  scheduleData = JSON.parse(raw);
} catch (err) {
  console.error('❌  Failed to read docs/routine-schedule.json:', err.message);
  process.exit(1);
}

// Update last_updated timestamp to reflect this sync
scheduleData.metadata = {
  ...scheduleData.metadata,
  last_updated: new Date().toISOString(),
};

// ─── Upsert to Supabase ───────────────────────────────────────────────────

const payload = {
  user_id: ROUTINE_USER_ID,
  data: scheduleData,
  updated_at: new Date().toISOString(),
};

console.log(`🔄  Syncing routine schedule to Supabase (key: ${ROUTINE_USER_ID}) …`);

let response;
try {
  // Use POST upsert with merge-duplicates to insert or update in a single call
  response = await fetch(`${SUPABASE_URL}/rest/v1/estate_data`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  });
} catch (err) {
  console.error('❌  Network error during upsert:', err.message);
  process.exit(1);
}

if (!response.ok) {
  let body = '';
  try { body = await response.text(); } catch (_) { /* ignore */ }
  console.error(`❌  Supabase returned ${response.status}: ${body}`);
  process.exit(1);
}

console.log(`✅  Routine schedule synced successfully (${new Date().toISOString()})`);
