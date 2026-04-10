# Supabase Security Guide

## Overview

This guide covers Supabase-specific security for the Masemula Estate OS, including Row-Level Security (RLS), secrets management, and Edge Function security.

---

## 🔑 Key Types & What They Can Do

Understanding which key to use and where is critical:

| Key | Access Level | Where to Use | Safe in Browser? |
|-----|-------------|--------------|-----------------|
| **Anon key** | Public read/write (limited by RLS) | Browser/client code | ✅ Yes |
| **Service role key** | Admin - bypasses ALL RLS | Server/Edge Functions ONLY | ❌ NEVER |
| **JWT Secret** | Signs auth tokens | Nowhere in code | ❌ NEVER |

### Finding Your Keys

1. Go to: `https://app.supabase.com/project/YOUR_PROJECT_ID/settings/api`
2. **Anon (public) key** → Safe to use in `index.html`
3. **Service role key** → Store only in Supabase secrets or `.env.local`

---

## 🛡️ Row-Level Security (RLS)

RLS is the most important Supabase security feature. It ensures users can only access their own data.

### Current Setup (`estate_data` table)

```sql
-- Current policy - allows anon users to access data by user_id
CREATE POLICY "Anon users can manage their data" ON estate_data
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);
```

> **Note:** This allows any anon user to read/write, restricted only by the `user_id` they provide client-side. This is acceptable for a personal dashboard.

### Future Setup (When Adding Auth)

```sql
-- With Supabase Auth - users can only access their own rows
ALTER POLICY "Anon users can manage their data" ON estate_data
  RENAME TO "Authenticated users own their data";

CREATE POLICY "Authenticated users own their data" ON estate_data
  FOR ALL TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
```

### RLS for Shared Ventures Tables

```sql
-- Venture members can only see their own ventures
CREATE POLICY "Venture members see their ventures" ON venture_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

-- Transactions: both venture members can see
CREATE POLICY "Venture members see transactions" ON venture_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM venture_members vm
      WHERE vm.venture_id = venture_transactions.venture_id
      AND vm.user_id = auth.uid()::text
    )
  );
```

---

## 🔐 Supabase Secrets (For Edge Functions)

Store sensitive keys in Supabase's encrypted vault:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to your account
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
# Find project ref: Settings → General → Reference ID

# Set secrets (encrypted, never visible after setting)
supabase secrets set NEDBANK_CLIENT_ID=your-client-id
supabase secrets set NEDBANK_CLIENT_SECRET=your-client-secret
supabase secrets set NEDBANK_WEBHOOK_SECRET=your-webhook-secret
supabase secrets set STITCH_CLIENT_SECRET=your-stitch-secret
supabase secrets set STRIPE_SECRET_KEY=sk_live_your-key
supabase secrets set RESEND_API_KEY=re_your-api-key

# List secrets (shows names only, values are hidden)
supabase secrets list

# Remove a secret
supabase secrets unset NEDBANK_CLIENT_SECRET
```

### Using Secrets in Edge Functions

```typescript
// ✅ Always use Deno.env.get() - never hardcode
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // These are loaded from Supabase secrets
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const nedbankSecret = Deno.env.get("NEDBANK_CLIENT_SECRET")!;
  
  if (!supabaseUrl || !supabaseKey) {
    return new Response("Server configuration error", { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  // ... rest of function
});
```

---

## 📊 Database Security Checklist

### Current Tables

- [ ] `estate_data` — RLS enabled ✅

### When Adding New Tables

For every new table, run:

```sql
-- 1. Enable RLS (required)
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- 2. Create appropriate policy
CREATE POLICY "policy name" ON new_table
  FOR ALL TO [anon|authenticated]
  USING (/* condition */)
  WITH CHECK (/* condition */);

-- 3. Verify RLS is working
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### Verify All Tables Have RLS

Run this SQL to check:

```sql
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  CASE WHEN rowsecurity THEN '✅ RLS Enabled' ELSE '❌ RLS DISABLED' END as status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## 🔒 Edge Function Security

### CORS Headers

Only allow requests from your dashboard:

```typescript
const corsHeaders = {
  // ✅ Specific origin (your GitHub Pages URL)
  "Access-Control-Allow-Origin": "https://notmasemula.github.io",
  
  // ❌ Avoid this - allows ANY website to call your function
  // "Access-Control-Allow-Origin": "*",
};
```

### Rate Limiting (Future)

When usage grows, add rate limiting:

```typescript
// Simple rate limiting with Supabase
const { count } = await supabase
  .from("rate_limits")
  .select("count", { count: "exact" })
  .eq("user_id", userId)
  .gte("created_at", new Date(Date.now() - 60000).toISOString()); // Last minute

if (count > 10) {
  return new Response("Rate limit exceeded", { status: 429 });
}
```

---

## 🔍 Supabase Audit Logs

Monitor access to your database:

1. Go to: `Supabase Dashboard → Logs → Database`
2. Check for unexpected queries
3. Set up alerts for anomalies

---

## 🆘 Emergency: Supabase Key Compromised

If your Supabase keys are exposed:

### Anon Key Exposed

1. Go to: `Settings → API → Reveal anon key → Generate new`
2. Update `index.html` with the new anon key
3. Deploy the updated dashboard

### Service Role Key Exposed

**CRITICAL — Act immediately:**

1. Go to: `Settings → API → Reveal service role key → Generate new`
2. Update all Supabase secrets that use the old key:
   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=new_key_here
   ```
3. Redeploy all Edge Functions:
   ```bash
   supabase functions deploy --all
   ```
4. Check audit logs for unauthorized access
5. If user data was accessed, consider notifying affected users

---

## 📋 Migrations Security

Always review migrations before running:

```sql
-- Check what a migration will do
-- Run in Supabase SQL editor with BEGIN; ... ROLLBACK; to preview

BEGIN;
  -- paste migration here
  SELECT * FROM pg_tables WHERE schemaname = 'public';  -- verify
ROLLBACK;  -- don't actually apply yet
```

### Never Run Unknown Migrations

- Only run migrations from this repository
- Review every line before `supabase db push`
- Test in development before production
