# Git History Cleanup Guide

## When to Use This Guide

Use this guide **ONLY IF** a secret (API key, password, or token) was accidentally committed to git. This is a last resort — the preferred action is to revoke the key first.

> ⚠️ **Warning:** Cleaning git history is destructive and irreversible. It rewrites history and requires force-pushing. All collaborators will need to re-clone or reset their local copies.

---

## Before You Start

### Step 1: Revoke the Exposed Key FIRST

Before doing anything with git, revoke the key immediately:

| Service | Where to Revoke |
|---------|----------------|
| Supabase | Settings → API → Generate new key |
| Nedbank | Developer portal → Rotate credentials |
| Stitch | Dashboard → API Settings → Rotate |
| Stripe | Dashboard → Developers → API keys → Roll key |
| GitHub Token | Settings → Developer settings → Personal access tokens |

**The git cleanup only prevents future exposure. The key is ALREADY compromised and must be revoked.**

### Step 2: Generate New Key

Get your replacement key ready before proceeding.

---

## Method 1: Using BFG Repo Cleaner (Recommended)

BFG is faster and simpler than `git filter-branch`.

### Install BFG

```bash
# macOS
brew install bfg

# Or download the jar:
# https://rtyley.github.io/bfg-repo-cleaner/
```

### Run Cleanup

```bash
# 1. Clone a fresh mirror of the repository
git clone --mirror https://github.com/NotMasemula/masemula-estate-dashboard.git
cd masemula-estate-dashboard.git

# 2. Create a file with the secrets to remove
# (Replace with actual values to remove - these are examples)
echo 'your-actual-secret-key-here' > /tmp/secrets-to-remove.txt
echo 'your-other-secret-key-here' >> /tmp/secrets-to-remove.txt

# 3. Run BFG to replace secrets with ***REMOVED***
bfg --replace-text /tmp/secrets-to-remove.txt

# 4. Clean up the repository
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. Force push the cleaned history
git push --force

# 6. Delete the temporary secrets file
rm /tmp/secrets-to-remove.txt
shred -u /tmp/secrets-to-remove.txt  # Securely delete if available
```

---

## Method 2: Using git-filter-repo (Alternative)

```bash
# Install
pip install git-filter-repo

# Run in your repository
cd masemula-estate-dashboard

# Remove a specific string
git filter-repo --replace-text <(echo "your-secret-here==>***REMOVED***")

# Force push
git push origin --force --all
git push origin --force --tags
```

---

## Method 3: Manual (Small Repositories)

For very small repositories with few commits:

```bash
# 1. Find commits that contain the secret
git log --all --oneline -S "your-secret-here"

# 2. Use interactive rebase to edit commits
git rebase -i HEAD~N  # N = number of commits to go back

# 3. For each commit with the secret, mark as 'edit'
# Then amend each commit to remove the secret

# 4. Force push
git push origin main --force
```

---

## After Cleanup

### Notify Collaborators

Everyone who has cloned the repository needs to re-clone:

```bash
# They should do this
cd ..
rm -rf masemula-estate-dashboard
git clone https://github.com/NotMasemula/masemula-estate-dashboard.git
```

### Verify the Cleanup

```bash
# Check that the secret is no longer in git history
git log --all --oneline -S "your-old-secret"
# Should return no results

# Check the working directory
grep -r "your-old-secret" .
# Should return no results
```

### Update GitHub Cache

GitHub may cache old data:

1. Go to: `Settings → Danger Zone → Clear cached data`
2. Or contact GitHub Support if needed

---

## Prevention: How to Avoid This in the Future

1. **Run the audit script before every commit:**
   ```bash
   bash scripts/audit-secrets.sh
   ```

2. **Check staged changes:**
   ```bash
   git diff --staged | grep -iE "(api_key|secret|password|token)" 
   ```

3. **Use `.env.local` for all secrets** (already in `.gitignore`)

4. **Enable GitHub secret scanning** with push protection:
   `Settings → Security → Code security → Secret scanning → Push protection`

5. **Use the pre-commit pattern:**
   ```bash
   # Before any commit, run:
   bash scripts/audit-secrets.sh && git add . && git commit -m "your message"
   ```

---

## Emergency Contacts

If the cleanup is causing issues:

1. **GitHub Support:** https://support.github.com
2. **BFG Support:** https://rtyley.github.io/bfg-repo-cleaner/

---

## Post-Incident Checklist

- [ ] Exposed key has been revoked
- [ ] New key has been generated
- [ ] Git history has been cleaned
- [ ] Force push completed
- [ ] Collaborators notified to re-clone
- [ ] All references updated to new key (Supabase secrets, `.env.local`)
- [ ] Monitoring set up for unauthorized use of old key
- [ ] Incident documented (what happened, what was exposed, for how long)
- [ ] `.gitignore` updated if the file wasn't already covered
- [ ] Team debriefed on how to prevent recurrence
