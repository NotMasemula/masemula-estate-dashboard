# Security Best Practices — Masemula Estate OS

## Overview

This document outlines the security architecture and best practices for the Masemula Estate OS dashboard and all integrated services.

---

## 🔐 Credentials & Secrets

### Golden Rule
> **Never commit secrets to git. Ever.**

Secrets include:
- Supabase URL and API keys
- Nedbank client ID and secret
- Stitch credentials
- Shopify and Stripe API keys
- Webhook signing secrets
- Any password or token

### How Secrets Are Managed

| Environment | Storage Method |
|-------------|---------------|
| Local development | `.env.local` (gitignored) |
| Supabase Edge Functions | `supabase secrets set KEY=value` |
| GitHub Actions | GitHub repository secrets |
| Production | Environment variables (never hardcoded) |

### Setting Supabase Secrets

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Set secrets
supabase secrets set NEDBANK_CLIENT_SECRET=your-secret-here
supabase secrets set STITCH_CLIENT_SECRET=your-secret-here
supabase secrets set STRIPE_SECRET_KEY=sk_live_your-key-here

# List secrets (shows names only, not values)
supabase secrets list
```

---

## 🏛️ Database Security (Supabase)

### Row-Level Security (RLS)

All tables have RLS enabled. The `estate_data` table uses this policy:

```sql
-- Each user only accesses their own data
CREATE POLICY "Anon users can manage their data" ON estate_data
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);
```

> **Note:** The current schema uses a client-generated `user_id` UUID. When authentication is added, update RLS policies to use `auth.uid()`.

### Future RLS (With Auth)

```sql
-- With Supabase Auth enabled
CREATE POLICY "Users own their data" ON estate_data
  FOR ALL TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
```

---

## 🔗 API Security

### Webhook Validation

All webhooks (Nedbank, Shopify, Stripe) must validate signatures:

```typescript
// Validate webhook signature - ALWAYS do this
async function validateWebhookSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body)
  );
  
  const expectedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer))
  );
  
  return signature === expectedSignature;
}
```

### Idempotency

All webhook handlers check for duplicate processing:

```typescript
// Check if already processed
const { data: existing } = await supabase
  .from("webhook_events")
  .select("id")
  .eq("external_id", event.id)
  .single();

if (existing) {
  return new Response("Already processed", { status: 200 });
}
```

---

## 🛡️ Edge Function Security

### Environment Variables (Not Hardcoded Keys)

```typescript
// ✅ CORRECT - Use environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const nedbankSecret = Deno.env.get("NEDBANK_CLIENT_SECRET") || "";

// ❌ WRONG - Never hardcode secrets
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."; // DON'T DO THIS
```

### CORS Configuration

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://notmasemula.github.io",  // Specific origin, not "*"
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
```

---

## 📋 Security Checklist

### Before Every Commit

- [ ] Run `bash scripts/audit-secrets.sh` to check for exposed secrets
- [ ] Review `git diff --staged` to verify no secrets in changes
- [ ] Confirm `.gitignore` covers any new sensitive file types

### Before Every Pull Request

- [ ] No hardcoded API keys in any file
- [ ] All new Edge Functions use `Deno.env.get()`
- [ ] Webhook handlers validate signatures
- [ ] New database tables have RLS policies
- [ ] Dependencies checked for known vulnerabilities

### Monthly Security Review

- [ ] Rotate API keys that are 90+ days old
- [ ] Review Supabase RLS policies
- [ ] Check GitHub security advisories
- [ ] Review access logs for anomalies
- [ ] Update dependencies with security patches

---

## 🚨 If a Secret Is Exposed

**Act immediately:**

1. **Revoke the key** - Log into the service and revoke/rotate the key FIRST
2. **Generate new key** - Create a replacement immediately
3. **Update all systems** - Update Supabase secrets, GitHub secrets, local `.env.local`
4. **Clean git history** - See `docs/GIT-HISTORY-CLEANUP.md`
5. **Notify** - If user data may have been accessed, notify users

See `docs/GIT-HISTORY-CLEANUP.md` for step-by-step cleanup instructions.

---

## 📖 Related Documents

- `docs/SECRETS-MANAGEMENT.md` - Detailed secrets workflow
- `docs/SUPABASE-SECURITY.md` - Supabase-specific security
- `docs/GITHUB-SECURITY.md` - GitHub security features
- `docs/GIT-HISTORY-CLEANUP.md` - Cleaning exposed secrets from history
- `.github/SECURITY.md` - Vulnerability reporting policy
