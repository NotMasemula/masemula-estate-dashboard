#!/usr/bin/env bash
# ==============================================================================
# audit-secrets.sh — Scan repository for accidentally exposed secrets
#
# Usage:
#   bash scripts/audit-secrets.sh
#   bash scripts/audit-secrets.sh --history    # Also scan git history
#   bash scripts/audit-secrets.sh --staged     # Only scan staged changes
#
# This script is non-destructive. It only reads files, never modifies them.
# ==============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCAN_HISTORY=false
SCAN_STAGED=false
FOUND_ISSUES=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --history) SCAN_HISTORY=true ;;
    --staged)  SCAN_STAGED=true ;;
  esac
done

echo ""
echo -e "${BLUE}🔍 Masemula Estate OS — Secrets Audit${NC}"
echo "======================================"
echo ""

# ==============================================================================
# PATTERNS TO SEARCH FOR
# ==============================================================================

# Patterns to detect ACTUAL hardcoded secret values (not just variable names)
# These patterns look for assignment of real secret values, not env var lookups
SECRET_PATTERNS=(
  # Supabase JWT token values (actual base64-encoded JWT structure)
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]+"
  
  # Supabase service role key hardcoded as a value (not just variable name)
  # Detect: service_role.*eyJ  (key value directly adjacent)
  "service_role.*eyJ"
  
  # Stripe live/test secret keys (only actual key values, not placeholders)
  "sk_live_[a-zA-Z0-9]{20,}"
  "sk_test_[a-zA-Z0-9]{20,}"
  "rk_live_[a-zA-Z0-9]{20,}"
  
  # Stripe webhook secrets (actual values)
  "whsec_[a-zA-Z0-9]{20,}"
  
  # AWS access keys
  "AKIA[0-9A-Z]{16}"
  "aws_secret_access_key\s*=\s*[A-Za-z0-9/+]{40}"
  
  # Google API keys
  "AIza[0-9A-Za-z_-]{35}"
  
  # Twilio
  "AC[a-zA-Z0-9]{32}"
)

# Files to skip (false positive sources — docs mention patterns as examples, not real secrets)
SKIP_PATTERNS=(
  ".gitignore"
  "*.example"
  ".example"
  ".md"
  "audit-secrets.sh"
  "secrets-loader.js"
  "SECURITY-CHECKLIST.md"
  "node_modules/"
  ".git/"
  "docs/"
  "banking-guides/"
)

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

check_file_for_secrets() {
  local file="$1"
  local issues_in_file=false
  
  for pattern in "${SECRET_PATTERNS[@]}"; do
    if grep -qiE "$pattern" "$file" 2>/dev/null; then
      if [ "$issues_in_file" = false ]; then
        echo -e "${RED}  ❌ POTENTIAL SECRET FOUND: $file${NC}"
        issues_in_file=true
        FOUND_ISSUES=true
      fi
      matches=$(grep -inE "$pattern" "$file" 2>/dev/null | head -3)
      echo -e "${YELLOW}     Pattern: $pattern${NC}"
      echo "     Matches:"
      while IFS= read -r line; do
        # Mask the actual value for display
        masked=$(echo "$line" | sed 's/\([A-Za-z0-9_-]\{10\}\)[A-Za-z0-9_-]*/\1***/g')
        echo "       $masked"
      done <<< "$matches"
    fi
  done
}

should_skip_file() {
  local file="$1"
  for skip in "${SKIP_PATTERNS[@]}"; do
    if [[ "$file" == *"$skip"* ]]; then
      return 0
    fi
  done
  return 1
}

# ==============================================================================
# SCAN STAGED CHANGES ONLY
# ==============================================================================

if [ "$SCAN_STAGED" = true ]; then
  echo -e "${BLUE}Scanning staged changes only...${NC}"
  echo ""
  
  staged_files=$(git diff --cached --name-only 2>/dev/null || echo "")
  
  if [ -z "$staged_files" ]; then
    echo -e "${GREEN}  ✅ No staged changes to scan${NC}"
  else
    while IFS= read -r file; do
      if [ -f "$file" ] && ! should_skip_file "$file"; then
        git show ":$file" 2>/dev/null | grep -iE "$(IFS='|'; echo "${SECRET_PATTERNS[*]}")" && \
          echo -e "${RED}  ❌ Staged file may contain secrets: $file${NC}" && \
          FOUND_ISSUES=true || true
      fi
    done <<< "$staged_files"
  fi

# ==============================================================================
# SCAN CURRENT FILES
# ==============================================================================

else
  echo "Scanning current files..."
  echo ""
  
  # Scan all tracked and untracked files (except gitignored)
  while IFS= read -r -d '' file; do
    if ! should_skip_file "$file"; then
      check_file_for_secrets "$file"
    fi
  done < <(find . -type f \
    -not -path "./.git/*" \
    -not -path "./node_modules/*" \
    -not -name "*.png" \
    -not -name "*.jpg" \
    -not -name "*.jpeg" \
    -not -name "*.gif" \
    -not -name "*.ico" \
    -not -name "*.woff*" \
    -not -name "*.ttf" \
    -not -name "*.eot" \
    -not -name "*.svg" \
    -not -name "audit-secrets.sh" \
    -print0 2>/dev/null)
  
  if [ "$FOUND_ISSUES" = false ]; then
    echo -e "${GREEN}  ✅ No secrets found in current files${NC}"
  fi

# ==============================================================================
# SCAN GIT HISTORY
# ==============================================================================

  if [ "$SCAN_HISTORY" = true ]; then
    echo ""
    echo "Scanning git history (this may take a while)..."
    echo ""
    
    HISTORY_ISSUES=false
    
    for pattern in "${SECRET_PATTERNS[@]}"; do
      matches=$(git log --all --oneline -S "$pattern" 2>/dev/null | head -5)
      if [ -n "$matches" ]; then
        echo -e "${RED}  ❌ Pattern found in git history: $pattern${NC}"
        echo -e "${YELLOW}     Commits:${NC}"
        echo "$matches" | while IFS= read -r line; do
          echo "       $line"
        done
        HISTORY_ISSUES=true
        FOUND_ISSUES=true
      fi
    done
    
    if [ "$HISTORY_ISSUES" = false ]; then
      echo -e "${GREEN}  ✅ No secrets found in git history${NC}"
    fi
  fi
fi

# ==============================================================================
# SUMMARY
# ==============================================================================

echo ""
echo "======================================"

if [ "$FOUND_ISSUES" = true ]; then
  echo -e "${RED}❌ AUDIT COMPLETE: Issues found!${NC}"
  echo ""
  echo "Immediate actions required:"
  echo "  1. Revoke any exposed keys immediately at the service provider"
  echo "  2. Generate new keys"
  echo "  3. Update Supabase secrets: supabase secrets set KEY=new_value"
  echo "  4. If in git history, run: bash scripts/cleanup-git-history.sh"
  echo "  5. See docs/GIT-HISTORY-CLEANUP.md for detailed instructions"
  echo ""
  exit 1
else
  echo -e "${GREEN}✅ AUDIT COMPLETE: No secrets detected${NC}"
  echo ""
  echo "Good security hygiene:"
  echo "  • All secrets should be in .env.local (gitignored)"
  echo "  • Edge Functions should use Deno.env.get()"
  echo "  • Run this script before every commit"
  echo ""
fi
