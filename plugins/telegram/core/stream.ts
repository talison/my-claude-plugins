// SOURCE: nanoclaw@bdec19b931b64ef9449ec53b00b89d5c36c1ad6c src/telegram-core/stream.ts (synced 2026-04-18)
import type { Api } from 'grammy';
import { sendText, type SendTextOpts } from './send.js';

export interface SendStreamOpts extends SendTextOpts {
  minFlushChars?: number;
  flushOnParagraph?: boolean;
  idleFlushMs?: number;
}

/**
 * Buffer-and-flush streaming: accumulate fragments from an AsyncIterable,
 * flush when a paragraph boundary (`\n\n`) is reached and the buffer has at
 * least `minFlushChars` characters, hard-flush at `chunkLimit`, and perform a
 * final flush when the stream ends. Only the first flush honors `reply_to`.
 */
export async function sendStream(
  api: Pick<Api, 'sendMessage'>,
  chat_id: string | number,
  stream: AsyncIterable<string>,
  opts: SendStreamOpts = {},
): Promise<number[]> {
  const minFlushChars = opts.minFlushChars ?? 120;
  const flushOnParagraph = opts.flushOnParagraph ?? true;
  const chunkLimit = opts.chunkLimit ?? 4096;
  const ids: number[] = [];

  let buffer = '';
  let firstFlush = true;

  const flush = async () => {
    if (!buffer) return;
    const toSend = buffer;
    buffer = '';
    const sendOpts: SendTextOpts = { ...opts };
    if (!firstFlush) {
      sendOpts.reply_to = undefined;
    }
    firstFlush = false;
    const sent = await sendText(api, chat_id, toSend, sendOpts);
    ids.push(...sent);
  };

  for await (const fragment of stream) {
    buffer += fragment;

    // Hard-flush at chunkLimit. Flush clears the buffer entirely, so this
    // only fires once per stream iteration — sendText does any further
    // sub-chunking internally.
    if (buffer.length >= chunkLimit) {
      await flush();
    }

    if (flushOnParagraph && buffer.length >= minFlushChars) {
      const para = buffer.lastIndexOf('\n\n');
      if (para > 0) {
        const toFlush = buffer.slice(0, para);
        const remaining = buffer.slice(para + 2);
        buffer = toFlush;
        await flush();
        buffer = remaining;
      }
    }
  }

  await flush();
  return ids;
}
