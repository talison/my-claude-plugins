# Upstream decisions we skipped or deferred

## Fire-once `sendChatAction('typing')` in `handleInbound`

**Phase 2 decision (2026-04-17):** Leave as-is.

Shared-core offers `withTyping(api, chat_id, fn)` which keeps a typing indicator refreshed every ~4s. The plugin's MCP server has no roundtrip signal from Claude for "I'm done processing this turn," so we cannot bound the `fn` body sensibly. The fire-once call relies on Telegram's natural ~5s typing expiry, which is usually adequate for short tool replies.

Revisit if/when the MCP protocol gains a turn-completion signal.

## `edit_message` tool still uses legacy `format: 'markdownv2'`

**Phase 2 decision (2026-04-17):** Leave as-is.

The `reply` tool's `format` enum was narrowed to `['text', 'claude']`; `edit_message` still advertises `['text', 'markdownv2']`. A future refactor should move `edit_message` onto `editText` from `core/` for consistency. For now, the legacy path (manual MarkdownV2 with `parse_mode`) is preserved for edits only.
