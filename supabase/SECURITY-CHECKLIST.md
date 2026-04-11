# Supabase Security Checklist & Migration Guide

## Overview

This checklist tracks security measures for the Masemula Estate OS Supabase backend. Use it as a reference when adding new features.

---

## ✅ Current Security Status

### Database

| Table | RLS Enabled | Policy | Status |
|-------|------------|--------|--------|
| `estate_data` | ✅ Yes | Anon users, all ops | ✅ Done |

### Edge Functions

| Function | Uses env vars | Validates signatures | Status |
|----------|--------------|---------------------|--------|
| `shopify-webhook` | ✅ Yes | ✅ Yes | Ready |
| `stripe-webhook` | ✅ Yes | ✅ Yes | Ready |
| `nedbank-webhook` | ✅ Yes | ✅ Yes | Ready |
| `initiate-transfer` | ✅ Yes | N/A | Ready |
| `calculate-settlement` | ✅ Yes | N/A | Ready |
| `send-notifications` | ✅ Yes | N/A | Ready |
| `generate-reports` | ✅ Yes | N/A | Ready |

---

## 📋 Security Checklist Per Feature

### When Adding a New Database Table

```sql
-- REQUIRED: Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- REQUIRED: Create policy
CREATE POLICY "description" ON new_table
  FOR ALL TO [anon|authenticated]
  USING (/* who can read */)
  WITH CHECK (/* who can write */);

-- VERIFY: Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'new_table';
```

### When Adding a New Edge Function

Checklist:
- [ ] Use `Deno.env.get()` for all secrets (not hardcoded)
- [ ] Validate webhook signature (if receiving webhooks)
- [ ] Check for duplicate processing (idempotency)
- [ ] Set appropriate CORS headers
- [ ] Add error handling with appropriate HTTP status codes
- [ ] Log security-relevant events

Template:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Load secrets from environment (set via: supabase secrets set KEY=value)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Only allow requests from your dashboard
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://notmasemula.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    // ... function logic here
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### When Adding API Integration

Checklist:
- [ ] Store API credentials in Supabase secrets
- [ ] Implement webhook signature validation
- [ ] Add idempotency checks
- [ ] Handle rate limiting
- [ ] Add retry logic for transient failures
- [ ] Log all API calls for audit trail

---

## 🔑 Secrets to Configure

Run these commands when you have the credentials:

```bash
# Supabase (already configured in project)
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Nedbank (when API approved)
supabase secrets set NEDBANK_CLIENT_ID=your-client-id
supabase secrets set NEDBANK_CLIENT_SECRET=your-client-secret
supabase secrets set NEDBANK_WEBHOOK_SECRET=your-webhook-secret
supabase secrets set NEDBANK_API_BASE_URL=https://api.nedbank.co.za/apimarket/sandbox

# Stitch (when connected)
supabase secrets set STITCH_CLIENT_ID=your-client-id
supabase secrets set STITCH_CLIENT_SECRET=your-client-secret

# Shopify (when ready)
supabase secrets set SHOPIFY_API_KEY=your-api-key
supabase secrets set SHOPIFY_WEBHOOK_SECRET=your-webhook-secret

# Stripe (when ready)
supabase secrets set STRIPE_SECRET_KEY=sk_live_your-key
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your-secret

# Notifications
supabase secrets set RESEND_API_KEY=re_your-api-key
supabase secrets set NOTIFICATION_FROM_EMAIL=noreply@masemula.co.za
```

---

## 🔄 Transition Roadmap

### Phase 1: Current (No Auth Required)
- Dashboard uses anon key + client-generated user IDs
- RLS allows anon access (limited by user_id)
- Suitable for personal use

### Phase 2: When Sharing with Tshegofatso
- Enable Supabase Auth (email/password or magic link)
- Update RLS to use `auth.uid()`
- Set up invitation system for ventures

### Phase 3: When Nedbank API is Approved
- Set NEDBANK_CLIENT_ID and NEDBANK_CLIENT_SECRET secrets
- Switch transfer_method from 'manual' to 'automated'
- System auto-enables API transfers

### Phase 4: Production Hardening (When Revenue > R10k/month)
- Enable Supabase Pro (for more storage and connections)
- Set up database backups
- Enable point-in-time recovery
- Set up monitoring alerts

---

## 📊 RLS Policy Templates

### Personal Data (Only Owner)
```sql
CREATE POLICY "Users own their data" ON table_name
  FOR ALL TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
```

### Shared Venture Data (Both Members)
```sql
CREATE POLICY "Venture members access" ON venture_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM venture_members vm
      WHERE vm.venture_id = venture_transactions.venture_id
      AND vm.user_id = auth.uid()::text
      AND vm.status = 'active'
    )
  );
```

### Insert Own Data
```sql
CREATE POLICY "Users insert own data" ON table_name
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);
```

### Admin/Service Role Only
```sql
-- No policy = no access for regular users
-- Service role bypasses all RLS
-- Use service role key ONLY in Edge Functions
```

---

## 🆘 Emergency Procedures

### If RLS is Accidentally Disabled

```sql
-- Re-enable immediately
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Verify
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

### If Service Role Key is Exposed

1. `Settings → API → Rotate service role key`
2. `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=new_key`
3. `supabase functions deploy --all`
4. Check audit logs for unauthorized access

---

## 📖 Related Documentation

- `docs/SUPABASE-SECURITY.md` - Detailed Supabase security guide
- `docs/SECRETS-MANAGEMENT.md` - Managing API keys
- `docs/SECURITY.md` - Overall security architecture
- `supabase-setup.sql` - Initial database setup
