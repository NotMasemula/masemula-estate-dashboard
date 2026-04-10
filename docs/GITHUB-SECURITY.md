# GitHub Security Features Guide

## Overview

GitHub provides powerful built-in security tools. This guide explains how to use them for the Masemula Estate OS repository.

---

## 🔒 Branch Protection Rules

Branch protection prevents accidental force-pushes and ensures code review.

### How to Set Up

1. Go to: `Settings → Branches → Add branch protection rule`
2. Branch name pattern: `main`
3. Enable these settings:
   - ✅ **Require pull request reviews before merging** (1 reviewer)
   - ✅ **Dismiss stale pull request approvals** when new commits are pushed
   - ✅ **Require status checks to pass** (Security Scan workflow)
   - ✅ **Require branches to be up to date** before merging
   - ✅ **Do not allow bypassing** the above settings

### Why This Matters

Without branch protection:
- Code can be pushed directly to `main` without review
- A single mistake could break the live dashboard
- Accidental secret commits could be pushed instantly

---

## 🔍 Secret Scanning

GitHub automatically scans code for known secret patterns from 200+ providers.

### How to Enable

1. Go to: `Settings → Security → Code security and analysis`
2. Enable: **Secret scanning**
3. Enable: **Push protection** (prevents pushes containing secrets)

### What Gets Detected

GitHub can detect:
- Supabase API keys
- Stripe API keys
- Twilio tokens
- GitHub personal access tokens
- AWS access keys
- Google Cloud credentials
- Many more (200+ providers)

### Push Protection

With push protection enabled, if you accidentally try to commit a secret:

```bash
git push origin main
# ERROR: Push rejected. Secret detected: Supabase service role key
# URL: https://github.com/NotMasemula/masemula-estate-dashboard/security/secret-scanning/...
# Either remove the secret and commit again, or allow this secret if it's a false positive.
```

This is the last line of defense — it's better to never stage secrets in the first place.

---

## 🛡️ Dependabot Security Alerts

Dependabot automatically creates issues when your dependencies have known vulnerabilities.

### How to Enable

1. Go to: `Settings → Security → Code security and analysis`
2. Enable: **Dependabot alerts**
3. Enable: **Dependabot security updates** (auto-creates PRs to fix vulnerabilities)

### Dependabot Configuration

The `.github/dependabot.yml` file configures automated dependency updates:

```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "dependencies"
      - "security"
```

---

## 🔑 Repository Secrets (For GitHub Actions)

For GitHub Actions workflows that need API keys:

### How to Add a Secret

1. Go to: `Settings → Secrets and variables → Actions`
2. Click: **New repository secret**
3. Add name: `SUPABASE_SERVICE_ROLE_KEY`
4. Add value: (paste your actual key)
5. Click: **Add secret**

### Recommended Secrets to Add

| Secret Name | What It Is | When to Add |
|-------------|-----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL | Now |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin database key | Now |
| `NEDBANK_CLIENT_SECRET` | Nedbank API secret | When approved |
| `STRIPE_SECRET_KEY` | Stripe secret key | When ready |
| `RESEND_API_KEY` | Email service key | When ready |

### How Secrets Are Used in Workflows

```yaml
# In .github/workflows/deploy.yml
- name: Deploy
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
  run: |
    # These environment variables are available here
    # They are never printed in logs (GitHub masks them)
```

---

## 👥 CODEOWNERS

The `CODEOWNERS` file ensures the right people review sensitive changes.

Current configuration requires `@NotMasemula` to review:
- All files (default)
- Security-sensitive files (`.gitignore`, `.github/`, etc.)
- Database migrations
- Edge Functions

---

## 📋 Security Advisories

For reporting and tracking security vulnerabilities privately:

1. Go to: `Security → Advisories`
2. Click: **New draft security advisory**
3. Fill in details (remains private until you publish)
4. This lets you work on a fix before disclosing

---

## 🔐 Security Overview Dashboard

See all security alerts in one place:

1. Go to: `Security` tab in your repository
2. Review:
   - **Dependabot alerts** — vulnerable dependencies
   - **Secret scanning alerts** — exposed API keys
   - **Code scanning alerts** — code vulnerabilities (if enabled)

---

## 🚀 GitHub Actions Security

Workflows run with least-privilege permissions:

```yaml
permissions:
  contents: read      # Read repository content
  pages: write        # Write to GitHub Pages (only for deploy workflow)
  id-token: write     # OIDC token (for deploy)
```

### Actions Security Best Practices

1. **Pin action versions** using commit SHA:
   ```yaml
   # ✅ Pinned to specific SHA (more secure)
   uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
   
   # ⚠️ Using version tag (could be changed by maintainer)
   uses: actions/checkout@v4
   ```

2. **Review third-party actions** before using them

3. **Use GitHub-provided secrets**, not hardcoded values

---

## Workflow: Security Incident Response

If a security alert is triggered:

```
Alert received
     ↓
Assess severity (Critical/High/Medium/Low)
     ↓
CRITICAL/HIGH: Immediate action
  ├─ Revoke exposed credentials
  ├─ Update to new credentials
  ├─ Check access logs for misuse
  └─ Clean git history if needed (see GIT-HISTORY-CLEANUP.md)
     ↓
MEDIUM/LOW: Schedule fix
  ├─ Create issue for tracking
  ├─ Fix in next sprint
  └─ Update dependencies/code
     ↓
Post-incident review
  ├─ Document what happened
  ├─ Update .gitignore if needed
  └─ Update team knowledge
```
