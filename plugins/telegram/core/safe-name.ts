// SOURCE: nanoclaw@364c58fda9dc738e9ce12d3f69e6830bb6ef4cdd src/telegram-core/safe-name.ts (synced 2026-04-18)
/**
 * Sanitize user-supplied filenames and titles so they can't break surrounding
 * delimiters (e.g., breaking out of a <channel> meta tag).
 */
export function safeName(s: string | undefined): string | undefined {
  return s?.replace(/[<>[\]\r\n;]/g, '_');
}
