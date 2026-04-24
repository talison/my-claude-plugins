// SOURCE: harness@9b67e8012e531063cdfabebe57f62b661ba154aa src/telegram-core/send.ts (synced 2026-04-24)
import type { Api } from 'grammy';
import { chunk, type ChunkMode } from './chunk.js';
import { claudeToTelegramV2 } from './markdown-translate.js';
import { isParseEntitiesError } from './markdown.js';

// Optional diagnostic logger — set by the host at boot. When present, we log
// parse-entities fallback events with enough detail to debug broken markdown.
// Keeping this in telegram-core (not depending on host logger) preserves the
// core's no-host-imports rule.
let diagLog: ((msg: string, ctx: Record<string, unknown>) => void) | undefined;
export function setSendDiagnosticLogger(
  fn: (msg: string, ctx: Record<string, unknown>) => void,
): void {
  diagLog = fn;
}

export type MarkdownFormat = 'text' | 'claude';

export interface SendTextOpts {
  format?: MarkdownFormat;
  reply_to?: number;
  replyToMode?: 'off' | 'first' | 'all';
  chunkMode?: ChunkMode;
  chunkLimit?: number;
  message_thread_id?: number;
}

const MAX_429_RETRIES = 3;

async function sendOneChunk(
  api: Pick<Api, 'sendMessage'>,
  chat_id: string | number,
  preparedText: string,
  originalText: string,
  parseMode: 'MarkdownV2' | undefined,
  extra: Record<string, unknown>,
): Promise<number> {
  let attempt = 0;
  while (true) {
    try {
      const opts = parseMode
        ? { ...extra, parse_mode: parseMode }
        : { ...extra };
      const res: any = await api.sendMessage(chat_id, preparedText, opts);
      return res.message_id;
    } catch (err) {
      if (isParseEntitiesError(err) && parseMode) {
        diagLog?.('Telegram parse_mode fallback triggered', {
          error: (err as Error).message,
          preparedPreview: preparedText.slice(0, 300),
          originalPreview: originalText.slice(0, 300),
        });
        const res: any = await api.sendMessage(chat_id, originalText, {
          ...extra,
        });
        return res.message_id;
      }
      const retryAfter = (err as any)?.parameters?.retry_after;
      if (retryAfter != null && attempt < MAX_429_RETRIES) {
        attempt++;
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Send `text` as one or more Telegram messages. When `format:'claude'`, the
 * text is translated to MarkdownV2 before sending and falls back to the
 * original (no parse_mode) on a parse-entities error. 429s are retried up to
 * MAX_429_RETRIES times, respecting `retry_after`.
 */
export async function sendText(
  api: Pick<Api, 'sendMessage'>,
  chat_id: string | number,
  text: string,
  opts: SendTextOpts = {},
): Promise<number[]> {
  const format = opts.format ?? 'text';
  const replyToMode = opts.replyToMode ?? 'first';
  const chunkMode = opts.chunkMode ?? 'newline';
  const chunkLimit = opts.chunkLimit ?? 4096;

  const prepared = format === 'claude' ? claudeToTelegramV2(text) : text;
  const preparedChunks = chunk(prepared, chunkLimit, chunkMode);
  const originalChunks = chunk(text, chunkLimit, chunkMode);

  const parseMode: 'MarkdownV2' | undefined =
    format === 'claude' ? 'MarkdownV2' : undefined;
  const threadId = opts.message_thread_id;

  const ids: number[] = [];
  for (let i = 0; i < preparedChunks.length; i++) {
    const shouldReplyTo =
      opts.reply_to != null &&
      replyToMode !== 'off' &&
      (replyToMode === 'all' || i === 0);
    const extra: Record<string, unknown> = {};
    if (shouldReplyTo) extra.reply_parameters = { message_id: opts.reply_to };
    if (threadId != null) extra.message_thread_id = threadId;

    const id = await sendOneChunk(
      api,
      chat_id,
      preparedChunks[i]!,
      originalChunks[i] ?? preparedChunks[i]!,
      parseMode,
      extra,
    );
    ids.push(id);
  }
  return ids;
}

/**
 * Edit an existing Telegram message. No chunking — truncates to `chunkLimit`.
 * On parse-entities failure (claude format), retries with the original text
 * and no parse_mode.
 */
export async function editText(
  api: Pick<Api, 'editMessageText'>,
  chat_id: string | number,
  message_id: number,
  text: string,
  opts: Pick<SendTextOpts, 'format' | 'chunkLimit'> = {},
): Promise<void> {
  const format = opts.format ?? 'text';
  const chunkLimit = opts.chunkLimit ?? 4096;
  // Truncate the SOURCE first, then translate — truncating v2 post-translation
  // can split an escape sequence and yield unparseable markup.
  // Note: escaping can inflate translated length by up to ~15% on dense
  // reserved-char content. For 4096-limit edits we may end up a few bytes
  // over. Rare in practice for typical Claude output; fallback handles it.
  const truncatedOriginal =
    text.length > chunkLimit ? text.slice(0, chunkLimit) : text;
  const truncatedPrepared =
    format === 'claude'
      ? claudeToTelegramV2(truncatedOriginal)
      : truncatedOriginal;
  const parseMode: 'MarkdownV2' | undefined =
    format === 'claude' ? 'MarkdownV2' : undefined;
  // editText does not retry on 429. Edit targets are often transient (the
  // message is about to be replaced by a follow-up anyway), so burning
  // retry budget on them isn't worth it. sendText has retries where they
  // matter.
  try {
    const opts2 = parseMode ? { parse_mode: parseMode } : {};
    await api.editMessageText(chat_id, message_id, truncatedPrepared, opts2);
  } catch (err) {
    if (isParseEntitiesError(err) && parseMode) {
      await api.editMessageText(chat_id, message_id, truncatedOriginal, {});
      return;
    }
    throw err;
  }
}
