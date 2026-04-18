// SOURCE: nanoclaw@36f92ecd0eaa4a372d96fd22591eb83538f0d222 src/telegram-core/safe-name.ts (synced 2026-04-18)
/**
 * Sanitize user-supplied filenames and titles so they can't break surrounding
 * delimiters (e.g., breaking out of a <channel> meta tag).
 */
export function safeName(s: string | undefined): string | undefined {
  return s?.replace(/[<>[\]\r\n;]/g, '_');
}
