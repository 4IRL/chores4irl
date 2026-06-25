#!/usr/bin/env bash
#
# Apply (create or update) the repository rulesets in this directory to GitHub.
# Idempotent: matches existing rulesets by name and PUTs, otherwise POSTs.
#
# Requires: gh CLI authenticated with admin access to the repo, and jq.
# Usage: ./apply.sh [owner/repo]   (defaults to 4IRL/chores4irl)

set -euo pipefail

REPO="${1:-4IRL/chores4irl}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for ruleset_json in "$DIR"/*.json; do
  name="$(jq -r .name "$ruleset_json")"
  existing_id="$(gh api "repos/$REPO/rulesets" --jq ".[] | select(.name==\"$name\") | .id" | head -n1)"

  if [ -n "$existing_id" ]; then
    echo "Updating ruleset '$name' (#$existing_id) on $REPO..."
    gh api --method PUT "repos/$REPO/rulesets/$existing_id" --input "$ruleset_json" >/dev/null
  else
    echo "Creating ruleset '$name' on $REPO..."
    gh api --method POST "repos/$REPO/rulesets" --input "$ruleset_json" >/dev/null
  fi
  echo "Done: '$name'"
done
