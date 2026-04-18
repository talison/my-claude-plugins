// SOURCE: nanoclaw@e953bd1226c4707bad3ce6477af46a5fbe0e16b0 src/telegram-core/download.ts (synced 2026-04-18)
import { writeFileSync, mkdirSync } from 'fs';
import { basename, join } from 'path';
import type { Api } from 'grammy';

/**
 * Fetch a Telegram file via `getFile` + HTTP, write it under `destDir` with a
 * unique name, and return the local path. Throws on missing `file_path` or a
 * non-ok HTTP response.
 */
export async function downloadAttachment(
  api: Pick<Api, 'getFile'>,
  token: string,
  file_id: string,
  destDir: string,
): Promise<string> {
  const file = await api.getFile(file_id);
  if (!file.file_path) {
    throw new Error(`Telegram returned no file_path for file_id ${file_id}`);
  }
  // Create destDir eagerly so we fail fast before the HTTP fetch if the
  // target directory is un-creatable.
  mkdirSync(destDir, { recursive: true });

  const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`download failed: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());

  // Use basename to avoid path segments leaking into the ext if Telegram
  // ever returns something unusual.
  const base = basename(file.file_path);
  const ext = base.includes('.') ? base.split('.').pop()! : 'bin';
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
  const uniqueId =
    (file.file_unique_id ?? '').replace(/[^a-zA-Z0-9_-]/g, '') || 'dl';
  const path = join(destDir, `${Date.now()}-${uniqueId}.${safeExt}`);
  writeFileSync(path, buf);
  return path;
}
