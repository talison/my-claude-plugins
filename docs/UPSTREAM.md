# Monitoring upstream

The telegram plugin in this marketplace is a fork of `anthropics/claude-plugins-official/external_plugins/telegram`. Upstream keeps improving, and we want to absorb their improvements without giving up our shared-core integration.

## Weekly check

```bash
git fetch upstream-cc
git log upstream-cc/main --since='1 week ago' -- external_plugins/telegram/
```

For each commit touching `external_plugins/telegram/`:

1. Open `git show <sha> -- external_plugins/telegram/` and read the diff.
2. If it touches `server.ts` behavior we rely on: cherry-pick manually into `plugins/telegram/server.ts`, run `bun tsc --noEmit`, commit.
3. If it's a refactor we chose not to adopt (e.g., upstream reinlines something we now get from `core/`): note the SHA and rationale in `docs/UPSTREAM_SKIPPED.md`.

## Why a remote instead of a submodule

A submodule would force our fork to track upstream's full tree. A remote is a lightweight read-only reference that lets us `git log`/`git show` against upstream without constraining our directory layout.
