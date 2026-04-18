#!/usr/bin/env bash
# Sync nanoclaw's src/telegram-core/ into plugins/telegram/core/ at a given commit SHA.
# Usage: ./scripts/sync-telegram-core.sh [<nanoclaw-ref>]
# Default ref: main on talison/nanoclaw (override via NANOCLAW_REMOTE env var).
set -euo pipefail

NANOCLAW_REMOTE="${NANOCLAW_REMOTE:-https://github.com/talison/nanoclaw.git}"
NANOCLAW_REF="${1:-main}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$REPO_ROOT/plugins/telegram/core"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "Syncing $NANOCLAW_REMOTE @ $NANOCLAW_REF → plugins/telegram/core/"

# Use git archive to fetch just the telegram-core subtree (no full clone)
git archive --remote="$NANOCLAW_REMOTE" "$NANOCLAW_REF" src/telegram-core 2>/dev/null \
  | tar -x -C "$TMPDIR"

if [[ ! -d "$TMPDIR/src/telegram-core" ]]; then
  echo "ERROR: src/telegram-core/ not found at $NANOCLAW_REF — nothing to sync" >&2
  exit 1
fi

# Resolve the actual SHA for the SOURCE header (git-archive doesn't tell us directly)
SHA="$(git ls-remote "$NANOCLAW_REMOTE" "$NANOCLAW_REF" | awk 'NR==1{print $1}')"
if [[ -z "$SHA" ]]; then
  # Fallback: if ref is already a full SHA, use it as-is
  SHA="$NANOCLAW_REF"
fi
DATE="$(date -u +%Y-%m-%d)"

# Wipe existing core/ and repopulate from scratch
rm -rf "$TARGET"
mkdir -p "$TARGET"

# Copy each .ts file, prepending a SOURCE header; skip test files
for f in "$TMPDIR/src/telegram-core"/*.ts; do
  name="$(basename "$f")"
  case "$name" in
    *.test.ts) continue ;;
  esac
  {
    echo "// SOURCE: nanoclaw@${SHA} src/telegram-core/${name} (synced ${DATE})"
    cat "$f"
  } > "$TARGET/$name"
done

# Metadata file for auditing and upstream-SHA comparison
cat > "$TARGET/.sync-source" <<EOF
remote=$NANOCLAW_REMOTE
ref=$NANOCLAW_REF
sha=$SHA
synced_at=$DATE
EOF

echo
echo "Synced files:"
ls "$TARGET"
echo
echo "Diff against committed tree:"
git -C "$REPO_ROOT" diff --stat -- "$TARGET" || true
