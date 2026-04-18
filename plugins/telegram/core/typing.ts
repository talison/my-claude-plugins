// SOURCE: nanoclaw@36f92ecd0eaa4a372d96fd22591eb83538f0d222 src/telegram-core/typing.ts (synced 2026-04-18)
import type { Api } from 'grammy';

export interface WithTypingOpts {
  intervalMs?: number;
  message_thread_id?: number;
}

/**
 * Run `fn` while keeping Telegram's "typing" indicator active. Re-emits the
 * action every `intervalMs` (default 4000) and cancels in `finally`. Errors
 * from sendChatAction are swallowed — the indicator is best-effort.
 */
export async function withTyping<T>(
  api: Pick<Api, 'sendChatAction'>,
  chat_id: string | number,
  fn: () => Promise<T>,
  opts: WithTypingOpts = {},
): Promise<T> {
  const intervalMs = opts.intervalMs ?? 4000;
  const extra =
    opts.message_thread_id != null
      ? { message_thread_id: opts.message_thread_id }
      : undefined;

  const fire = () => {
    const promise = extra
      ? api.sendChatAction(chat_id, 'typing', extra)
      : api.sendChatAction(chat_id, 'typing');
    void Promise.resolve(promise).catch(() => {});
  };

  fire();
  const handle = setInterval(fire, intervalMs);
  if (typeof (handle as any).unref === 'function') (handle as any).unref();
  try {
    return await fn();
  } finally {
    clearInterval(handle);
  }
}
