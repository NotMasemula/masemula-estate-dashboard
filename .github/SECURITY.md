# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | ✅ Supported        |

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

1. **Email:** Send details to the repository owner via GitHub's private vulnerability reporting.
2. **GitHub Security Advisories:** Use the [Report a Vulnerability](../../security/advisories/new) button in the Security tab.

### What to Include

When reporting a security issue, please include:

- **Description** of the vulnerability
- **Steps to reproduce** the issue
- **Potential impact** (what data or functionality could be affected)
- **Suggested fix** (if you have one)

### Response Timeline

- **Acknowledgment:** Within 48 hours
- **Status update:** Within 7 days
- **Fix timeline:** Depends on severity
  - Critical: Within 24-72 hours
  - High: Within 1 week
  - Medium/Low: Within 1 month

### Scope

This policy covers:
- `index.html` - Main dashboard application
- Supabase Edge Functions (`supabase/functions/`)
- Database schema and RLS policies (`supabase-setup.sql`, `supabase/migrations/`)
- Any API integrations (Nedbank, Stitch, Shopify, Stripe)

### Out of Scope

- Third-party services (Supabase, Nedbank, Stitch platforms themselves)
- GitHub infrastructure

### Security Best Practices for Contributors

1. **Never commit secrets** - API keys, passwords, tokens must go in `.env.local` (not committed)
2. **Use environment variables** - All sensitive config via `Deno.env.get()` in Edge Functions
3. **Review the `.gitignore`** - Before committing, verify no secrets are staged
4. **Run the audit script** - `bash scripts/audit-secrets.sh` before creating a PR

### Known Security Measures

- ✅ Row-Level Security (RLS) enabled on all Supabase tables
- ✅ API keys stored as Supabase secrets (environment variables)
- ✅ CODEOWNERS file requiring review for sensitive changes
- ✅ `.gitignore` preventing accidental secret commits
- ✅ Webhook signature validation on all payment webhooks

Thank you for helping keep Masemula Estate OS secure! 🔒
