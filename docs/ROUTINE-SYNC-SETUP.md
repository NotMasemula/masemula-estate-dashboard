# Routine Agent Integration — Setup Guide

This guide explains how to configure the routine-sync pipeline so that changes to
`docs/routine-schedule.json` are automatically pushed to Supabase and reflected in
the Estate OS dashboard.

---

## Architecture overview

```
docs/routine-schedule.json  ──push/PR──►  GitHub Actions (sync-routine.yml)
                                                │
                                                │  SUPABASE_SERVICE_ROLE_KEY  (secret)
                                                ▼
                                    Supabase estate_data table
                                    key: ntobeko-masemula-routine
                                                │
                                                ▼
                                    Dashboard (index.html)
                                    loadRoutineScheduleFromCloud()
                                    renders live schedule ☁
```

The dashboard always falls back to its built-in static schedule if the cloud record
is unavailable (e.g. no connection, secrets not yet configured).

---

## 1. Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions** in your repository and add:

| Secret name | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Project URL from Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ…` | **Server-side only.** Never expose in browser code. Found at Settings → API → service_role |
| `ROUTINE_USER_ID` | *(optional)* | Defaults to `ntobeko-masemula-routine` if not set |

> ⚠️ **Security note:** `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security.
> It is only used in the GitHub Actions workflow (server-side) and must never be
> committed to the repository or used in `index.html`.
> The dashboard uses the **anon key** for all browser-side Supabase calls.

---

## 2. Supabase database setup

Run the SQL in `supabase-setup.sql` in your Supabase SQL Editor to:

- Create/verify the `estate_data` table with RLS
- Pre-create the `ntobeko-masemula-routine` row
- Create the `habits_log` table used by the Daily Routine tracker

```bash
# Or via CLI:
supabase db push
```

---

## 3. How the sync works

### Automatic trigger
The workflow runs automatically when:
- `docs/routine-schedule.json` is pushed to any branch
- `docs/time-routine.md` is pushed to any branch
- Daily at 03:00 UTC (scheduled)

### Manual trigger
In GitHub → **Actions** → **Sync Routine to Dashboard** → **Run workflow**.

### What the script does
`scripts/sync-routine.mjs`:
1. Reads `docs/routine-schedule.json`
2. Stamps `metadata.last_updated` with the current UTC time
3. Upserts the JSON into `estate_data` under key `ntobeko-masemula-routine`
   using the service-role key

---

## 4. Updating the routine schedule

Edit `docs/routine-schedule.json` directly.  The structure is:

```jsonc
{
  "metadata": { "last_updated": "…", "sync_version": "1.0" },
  "schedule": {
    "Monday": [
      { "time": "4:00 - 5:30am", "block": "Gym", "category": "Health" },
      …
    ],
    …
  },
  "notes": {
    "Monday": "Light class day, strong business day",
    …
  }
}
```

Valid `category` values that affect the colour-coding in the dashboard:
`Health`, `School`, `Business`, `Creative`, `Growth`, `Admin`, `Personal`, `Recovery`

---

## 5. Dashboard display

Once the record exists in Supabase, the dashboard will:

- Show a **☁ live** badge next to "Today's Schedule" when data was loaded from cloud
- Fall back silently to the built-in static schedule if cloud is unavailable
- Show a **↻** refresh button on the schedule card for manual reload

---

## 6. Running the sync script locally

```bash
export SUPABASE_URL=https://xxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ…    # never commit this
node scripts/sync-routine.mjs
```

---

## 7. Security model summary

| Key | Used in | Stored in |
|---|---|---|
| Anon key (`SUPABASE_ANON_KEY`) | `index.html` browser code, `config/env.js` | Public — safe to commit |
| Service-role key | `sync-routine.mjs` (server-side only) | GitHub Secret — never commit |

See `docs/SUPABASE-SECURITY.md` for full Supabase security guidance.
