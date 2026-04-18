// SOURCE: nanoclaw@bdec19b931b64ef9449ec53b00b89d5c36c1ad6c src/telegram-core/markdown.ts (synced 2026-04-18)
/**
 * Telegram MarkdownV2 reserves these characters: _ * [ ] ( ) ~ ` > # + - = | { } . !
 * Each must be escaped with a backslash when appearing as literal text.
 */
const V2_RESERVED = /[_*[\]()~`>#+\-=|{}.!]/g;

/** Escape all MarkdownV2 reserved characters in a string. */
export function escapeMarkdownV2(text: string): string {
  return text.replace(V2_RESERVED, '\\$&');
}

/**
 * Detect the specific Telegram error that means "your parse_mode content has
 * malformed syntax." We retry such sends without parse_mode.
 */
export function isParseEntitiesError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /can't parse entities/i.test(err.message);
}
