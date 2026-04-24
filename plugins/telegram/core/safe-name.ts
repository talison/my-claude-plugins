// SOURCE: harness@9b67e8012e531063cdfabebe57f62b661ba154aa src/telegram-core/safe-name.ts (synced 2026-04-24)
/**
 * Sanitize user-supplied filenames and titles so they can't break surrounding
 * delimiters (e.g., breaking out of a <channel> meta tag).
 */
export function safeName(s: string | undefined): string | undefined {
  return s?.replace(/[<>[\]\r\n;]/g, '_');
}
