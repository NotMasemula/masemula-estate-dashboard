#!/usr/bin/env bash
# ==============================================================================
# cleanup-git-history.sh — Remove secrets from git history
#
# ⚠️  WARNING: This is a DESTRUCTIVE operation. It rewrites git history.
#    All collaborators must re-clone after running this.
#    ALWAYS revoke exposed keys BEFORE running this script.
#
# Usage:
#   bash scripts/cleanup-git-history.sh
#
# Prerequisites:
#   - git-filter-repo (pip install git-filter-repo)
#   - OR BFG Repo Cleaner (brew install bfg)
#
# This script will:
#   1. Ask for confirmation before making any changes
#   2. Create a backup branch
#   3. Remove specified secrets from ALL git history
#   4. Force push the cleaned history
# ==============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${RED}⚠️  GIT HISTORY CLEANUP — DESTRUCTIVE OPERATION${NC}"
echo "================================================"
echo ""
echo -e "${YELLOW}This script rewrites your git history to remove secrets."
echo "Once run, this cannot be undone."
echo ""
echo "Before proceeding, confirm you have:"
echo "  1. ✅ Revoked the exposed key at the service provider"
echo "  2. ✅ Generated a new replacement key"
echo "  3. ✅ Notified all collaborators (they must re-clone)"
echo -e "  4. ✅ A backup of your local repository${NC}"
echo ""

read -p "Have you completed all steps above? (type 'YES' to continue): " confirm

if [ "$confirm" != "YES" ]; then
  echo ""
  echo "Cleanup cancelled. Please complete the prerequisite steps first."
  echo "See docs/GIT-HISTORY-CLEANUP.md for detailed instructions."
  exit 0
fi

echo ""
echo -e "${BLUE}Step 1: Enter the secrets to remove${NC}"
echo "Enter each secret on a separate line. Press ENTER twice when done."
echo "(Your input will not be displayed)"
echo ""

SECRETS_FILE=$(mktemp /tmp/secrets-to-remove.XXXXXX)
trap "rm -f $SECRETS_FILE" EXIT

echo "Enter secret #1 (or press ENTER to skip):"
read -rs secret1
[ -n "$secret1" ] && echo "$secret1" >> "$SECRETS_FILE"

echo "Enter secret #2 (or press ENTER to skip):"
read -rs secret2
[ -n "$secret2" ] && echo "$secret2" >> "$SECRETS_FILE"

echo "Enter secret #3 (or press ENTER to skip):"
read -rs secret3
[ -n "$secret3" ] && echo "$secret3" >> "$SECRETS_FILE"

echo "Enter secret #4 (or press ENTER to skip):"
read -rs secret4
[ -n "$secret4" ] && echo "$secret4" >> "$SECRETS_FILE"

if [ ! -s "$SECRETS_FILE" ]; then
  echo ""
  echo "No secrets entered. Nothing to clean."
  exit 0
fi

SECRET_COUNT=$(wc -l < "$SECRETS_FILE")
echo ""
echo -e "${GREEN}  ✓ $SECRET_COUNT secret(s) will be removed${NC}"

# ==============================================================================
# CREATE BACKUP BRANCH
# ==============================================================================

echo ""
echo -e "${BLUE}Step 2: Creating backup branch${NC}"

BACKUP_BRANCH="backup/before-cleanup-$(date +%Y%m%d_%H%M%S)"
git checkout -b "$BACKUP_BRANCH" 2>/dev/null
echo -e "${GREEN}  ✓ Backup created: $BACKUP_BRANCH${NC}"

git checkout - 2>/dev/null  # Return to previous branch

# ==============================================================================
# RUN CLEANUP
# ==============================================================================

echo ""
echo -e "${BLUE}Step 3: Removing secrets from history${NC}"

# Try git-filter-repo first, then BFG, then manual
if command -v git-filter-repo &>/dev/null; then
  echo "Using git-filter-repo..."
  
  # Create replacement expressions file
  REPLACE_FILE=$(mktemp /tmp/replacements.XXXXXX)
  trap "rm -f $SECRETS_FILE $REPLACE_FILE" EXIT
  
  while IFS= read -r secret; do
    echo "${secret}==>***REMOVED***" >> "$REPLACE_FILE"
  done < "$SECRETS_FILE"
  
  git filter-repo --replace-text "$REPLACE_FILE" --force
  
  rm -f "$REPLACE_FILE"
  
elif command -v bfg &>/dev/null || command -v java &>/dev/null; then
  echo "BFG approach - see docs/GIT-HISTORY-CLEANUP.md for manual steps"
  echo ""
  echo -e "${YELLOW}BFG requires running on a mirror clone. Manual steps required:${NC}"
  echo ""
  echo "1. Clone mirror:"
  echo "   git clone --mirror https://github.com/NotMasemula/masemula-estate-dashboard.git"
  echo "   cd masemula-estate-dashboard.git"
  echo ""
  echo "2. Create secrets file at /tmp/secrets.txt with your secrets"
  echo ""
  echo "3. Run BFG:"
  echo "   bfg --replace-text /tmp/secrets.txt"
  echo ""
  echo "4. Clean and push:"
  echo "   git reflog expire --expire=now --all"
  echo "   git gc --prune=now --aggressive"
  echo "   git push --force"
  exit 0
  
else
  echo -e "${RED}Neither git-filter-repo nor BFG found.${NC}"
  echo ""
  echo "Install one of these tools:"
  echo "  pip install git-filter-repo"
  echo "  brew install bfg  (macOS)"
  echo ""
  echo "Then re-run this script."
  exit 1
fi

echo -e "${GREEN}  ✓ Secrets removed from history${NC}"

# ==============================================================================
# FORCE PUSH
# ==============================================================================

echo ""
echo -e "${BLUE}Step 4: Force push cleaned history${NC}"
echo ""

read -p "Push cleaned history to GitHub? (type 'PUSH' to confirm): " push_confirm

if [ "$push_confirm" = "PUSH" ]; then
  git push origin --force --all
  git push origin --force --tags
  echo -e "${GREEN}  ✓ Force push complete${NC}"
else
  echo -e "${YELLOW}  Skipped. To push manually:${NC}"
  echo "  git push origin --force --all"
  echo "  git push origin --force --tags"
fi

# ==============================================================================
# POST-CLEANUP STEPS
# ==============================================================================

echo ""
echo "======================================"
echo -e "${GREEN}✅ CLEANUP COMPLETE${NC}"
echo ""
echo "Required follow-up steps:"
echo "  1. Update .env.local with new keys"
echo "  2. Run: supabase secrets set KEY=new_value (for each rotated key)"
echo "  3. Redeploy Edge Functions: supabase functions deploy --all"
echo "  4. Notify collaborators to re-clone the repository"
echo "  5. Verify cleanup: bash scripts/audit-secrets.sh --history"
echo ""
echo -e "${YELLOW}Your backup is saved as branch: $BACKUP_BRANCH${NC}"
echo "Delete it after confirming everything works:"
echo "  git branch -D $BACKUP_BRANCH"
echo "  git push origin --delete $BACKUP_BRANCH"
echo ""

# Securely delete the secrets file
if command -v shred &>/dev/null; then
  shred -u "$SECRETS_FILE"
else
  rm -f "$SECRETS_FILE"
fi
