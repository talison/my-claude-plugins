// SOURCE: nanoclaw@e953bd1226c4707bad3ce6477af46a5fbe0e16b0 src/telegram-core/safe-name.ts (synced 2026-04-18)
/**
 * Sanitize user-supplied filenames and titles so they can't break surrounding
 * delimiters (e.g., breaking out of a <channel> meta tag).
 */
export function safeName(s: string | undefined): string | undefined {
  return s?.replace(/[<>[\]\r\n;]/g, '_');
}
