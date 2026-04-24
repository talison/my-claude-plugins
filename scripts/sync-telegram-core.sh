#!/usr/bin/env bash
# Sync harness's src/telegram-core/ into plugins/telegram/core/ at a given ref.
# Usage: ./scripts/sync-telegram-core.sh [<harness-ref>]
# Default ref: main on talison/harness (override via HARNESS_REMOTE env var).
# (NANOCLAW_REMOTE is still honored for backwards compatibility but deprecated.)
#
# GitHub disables the git-upload-archive service, so `git archive --remote` fails.
# We use a shallow clone into a tmpdir instead.
set -euo pipefail

HARNESS_REMOTE="${HARNESS_REMOTE:-${NANOCLAW_REMOTE:-https://github.com/talison/harness.git}}"
NANOCLAW_REMOTE="$HARNESS_REMOTE"
NANOCLAW_REF="${1:-main}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$REPO_ROOT/plugins/telegram/core"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "Syncing $NANOCLAW_REMOTE @ $NANOCLAW_REF → plugins/telegram/core/"

# Try shallow clone of the named ref (works for branches and tags).
if ! git clone --depth=1 --branch "$NANOCLAW_REF" --quiet "$NANOCLAW_REMOTE" "$TMPDIR/repo" 2>/dev/null; then
  # Fallback: clone default branch, then fetch the SHA explicitly.
  git clone --depth=1 --quiet "$NANOCLAW_REMOTE" "$TMPDIR/repo"
  (cd "$TMPDIR/repo" && git fetch --depth=1 origin "$NANOCLAW_REF" && git checkout --quiet FETCH_HEAD)
fi

SRC="$TMPDIR/repo/src/telegram-core"
if [[ ! -d "$SRC" ]]; then
  echo "ERROR: src/telegram-core/ not found at $NANOCLAW_REF — nothing to sync" >&2
  exit 1
fi

SHA="$(git -C "$TMPDIR/repo" rev-parse HEAD)"
DATE="$(date -u +%Y-%m-%d)"

# Wipe existing core/ and repopulate from scratch.
rm -rf "$TARGET"
mkdir -p "$TARGET"

# Copy each .ts file, prepending a SOURCE header; skip test files.
for f in "$SRC"/*.ts; do
  name="$(basename "$f")"
  case "$name" in
    *.test.ts) continue ;;
  esac
  {
    echo "// SOURCE: harness@${SHA} src/telegram-core/${name} (synced ${DATE})"
    cat "$f"
  } > "$TARGET/$name"
done

# Metadata file for auditing and drift detection.
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
