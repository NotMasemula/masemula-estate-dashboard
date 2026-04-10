# Secrets Management Guide

## Overview

This guide explains how to safely manage API keys, passwords, and secrets for the Masemula Estate OS. This is the most important security practice to follow.

---

## 🔑 What Is a Secret?

A **secret** is any piece of information that grants access to a system:

| Type | Example | Where It Lives |
|------|---------|---------------|
| Supabase anon key | `eyJhbGci...` | `.env.local` → Supabase edge function env |
| Supabase service role key | `eyJhbGci...` (different) | Supabase secrets only - NEVER in browser code |
| Nedbank client secret | `abc123xyz...` | Supabase secrets only |
| Stitch client secret | `stitch_secret_...` | Supabase secrets only |
| Stripe secret key | `sk_live_...` | Supabase secrets only - NEVER in browser code |
| Webhook signing secrets | `whsec_...` | Supabase secrets only |

---

## 📂 Where Secrets Live

### For Local Development

```
.env.local   ← Your local secrets (NEVER commit this)
```

Copy `.env.local.example` to `.env.local` and fill in your values:
```bash
cp .env.local.example .env.local
# Edit .env.local with your actual keys
```

### For Edge Functions (Production)

Secrets are stored in Supabase's encrypted vault, never in code:

```bash
# Set a secret
supabase secrets set NEDBANK_CLIENT_SECRET=abc123xyz

# Update a secret
supabase secrets set NEDBANK_CLIENT_SECRET=new_value_here

# List secret names (values are hidden)
supabase secrets list

# Delete a secret
supabase secrets unset NEDBANK_CLIENT_SECRET
```

### For GitHub Actions

Stored in GitHub repository settings:

1. Go to Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add name and value

---

## 🔄 Secrets Lifecycle

### Step 1: Get a New Secret

When you receive an API key from Nedbank, Stitch, etc:
1. **Do NOT** copy it into any code file
2. **Do NOT** paste it in Slack, WhatsApp, or email
3. Store it immediately in Supabase secrets or `.env.local`

### Step 2: Store the Secret

**For local testing:**
```bash
echo "NEDBANK_CLIENT_SECRET=your-secret-here" >> .env.local
```

**For production (Edge Functions):**
```bash
supabase secrets set NEDBANK_CLIENT_SECRET=your-secret-here
```

### Step 3: Use the Secret in Code

**In Edge Functions (TypeScript):**
```typescript
// Always use Deno.env.get() - never hardcode
const nedbankSecret = Deno.env.get("NEDBANK_CLIENT_SECRET");
if (!nedbankSecret) {
  throw new Error("NEDBANK_CLIENT_SECRET not configured");
}
```

**In the Dashboard (index.html):**
```javascript
// Only use PUBLIC keys in browser code (anon key is fine)
// NEVER use service role key or any secret key in browser code
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGci...your-anon-key'; // This is public, that's OK
```

### Step 4: Rotate Secrets Regularly

Rotate secrets every 90 days or immediately if compromised:

1. Generate new key from the service provider
2. Update in Supabase: `supabase secrets set KEY=new_value`
3. Update in `.env.local` (local only)
4. Test that everything still works
5. Delete the old key from the service provider

---

## ⚠️ Common Mistakes to Avoid

### ❌ Hardcoding in Code
```javascript
// NEVER do this
const client = createClient('https://proj.supabase.co', 'eyJhbGci...-secret-key-here');
```

### ❌ Committing .env Files
```bash
# NEVER run this
git add .env.local
git commit -m "add env variables"  # This would commit your secrets!
```

### ❌ Sharing in Chat
```
# NEVER paste secrets in WhatsApp/Slack/email to Tshegofatso
"Hey, here's the API key: sk_live_abc123..."
```

### ❌ Including in Documentation
```markdown
# NEVER include real keys in docs
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real-key-here
```

---

## ✅ Safe Sharing with Tshegofatso

When Tshegofatso needs access to the dashboard:

1. **Create separate Supabase project** for Tshegofatso (free tier)
2. **Share only the anon key** for Tshegofatso's project (public key, safe)
3. **Never share service role keys** (these have admin access)
4. **Use the invitation system** in the ventures module when ready

For detailed setup instructions, see `docs/TSHEGOFATSO-SETUP.md`.

---

## 🔍 Audit Your Repository

Run the audit script to check for exposed secrets:

```bash
bash scripts/audit-secrets.sh
```

This scans:
- Current code for secret patterns
- Git history for accidentally committed secrets
- File names that suggest credential storage

---

## 📞 Emergency: Secret Was Exposed

If a secret was committed to git or shared accidentally:

1. **Immediately revoke the key** at the service provider
2. **Generate a new key** immediately
3. **Update all references** to use the new key
4. **Clean git history** - see `docs/GIT-HISTORY-CLEANUP.md`
5. **Monitor for unauthorized access** in service provider logs

**The key on GitHub is exposed to the internet immediately, even if you delete it within minutes.** Always revoke first.
