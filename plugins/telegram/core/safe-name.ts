// SOURCE: nanoclaw@bdec19b931b64ef9449ec53b00b89d5c36c1ad6c src/telegram-core/safe-name.ts (synced 2026-04-18)
/**
 * Sanitize user-supplied filenames and titles so they can't break surrounding
 * delimiters (e.g., breaking out of a <channel> meta tag).
 */
export function safeName(s: string | undefined): string | undefined {
  return s?.replace(/[<>[\]\r\n;]/g, '_');
}
