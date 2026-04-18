// SOURCE: nanoclaw@bdec19b931b64ef9449ec53b00b89d5c36c1ad6c src/telegram-core/mention.ts (synced 2026-04-18)
import type { Context } from 'grammy';

/**
 * Check whether the bot is mentioned in the current inbound message.
 * Matches: @username mentions, text_mentions referencing a bot with the given
 * username, a reply-to-us (implicit mention), and caller-supplied regex patterns.
 */
export function isMentioned(
  ctx: Context,
  extraPatterns: string[] | undefined,
  botUsername: string,
): boolean {
  const text = ctx.message?.text ?? ctx.message?.caption ?? '';
  const entities = ctx.message?.text
    ? (ctx.message.entities ?? [])
    : (ctx.message?.caption_entities ?? []);
  const lowerBot = `@${botUsername}`.toLowerCase();

  for (const e of entities) {
    if (e.type === 'mention') {
      const mentioned = text.slice(e.offset, e.offset + e.length).toLowerCase();
      if (mentioned === lowerBot) return true;
    }
    if (
      e.type === 'text_mention' &&
      (e as any).user?.is_bot &&
      (e as any).user.username === botUsername
    ) {
      return true;
    }
  }

  if (ctx.message?.reply_to_message?.from?.username === botUsername)
    return true;

  for (const pat of extraPatterns ?? []) {
    try {
      if (new RegExp(pat, 'i').test(text)) return true;
    } catch {
      // Invalid user-supplied regex — skip silently (caller may have wired it
      // from a config file).
    }
  }
  return false;
}
