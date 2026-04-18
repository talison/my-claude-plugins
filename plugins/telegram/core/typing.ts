// SOURCE: nanoclaw@bdec19b931b64ef9449ec53b00b89d5c36c1ad6c src/telegram-core/typing.ts (synced 2026-04-18)
import type { Api } from 'grammy';

export interface WithTypingOpts {
  intervalMs?: number;
  message_thread_id?: number;
  /**
   * Safety cap — if stopTyping is never called, auto-stop after this many ms.
   * Prevents leaks when a caller crashes or forgets to stop. Default 90_000
   * (90s). A reply hung past 90s is genuinely broken; continuing to emit
   * "typing" beyond that is lying to the user. Pass 0 to disable the cap
   * (withTyping does this internally since try/finally guarantees cleanup).
   */
  maxMs?: number;
}

type TypingState = {
  interval: ReturnType<typeof setInterval>;
  safety: ReturnType<typeof setTimeout> | null;
};

const timers = new Map<string, TypingState>();

/**
 * Start the "typing" indicator for chat_id and keep it alive by re-emitting
 * sendChatAction every `intervalMs`. Idempotent — calling again for the same
 * chat_id cancels the previous timer. sendChatAction errors are swallowed
 * (the indicator is best-effort). Call stopTyping to cancel, or rely on the
 * maxMs safety cap to auto-stop.
 *
 * Use this when the receive and reply event handlers are separate — e.g. an
 * MCP stdio plugin where a message arrives in one handler and the eventual
 * reply ships from a different tool-call handler. For in-process code that
 * receives, processes, and replies inside one async function, prefer
 * withTyping — same mechanism, RAII-friendly wrapper.
 */
export function startTyping(
  api: Pick<Api, 'sendChatAction'>,
  chat_id: string | number,
  opts: WithTypingOpts = {},
): void {
  const key = String(chat_id);
  stopTyping(chat_id);

  const intervalMs = opts.intervalMs ?? 4000;
  const maxMs = opts.maxMs ?? 90_000;
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
  const interval = setInterval(fire, intervalMs);
  if (
    typeof (interval as unknown as { unref?: () => void }).unref === 'function'
  ) {
    (interval as unknown as { unref: () => void }).unref();
  }

  let safety: ReturnType<typeof setTimeout> | null = null;
  if (maxMs > 0) {
    safety = setTimeout(() => stopTyping(chat_id), maxMs);
    if (
      typeof (safety as unknown as { unref?: () => void }).unref === 'function'
    ) {
      (safety as unknown as { unref: () => void }).unref();
    }
  }

  timers.set(key, { interval, safety });
}

/**
 * Stop the typing indicator for chat_id. Idempotent — no-op if not started.
 */
export function stopTyping(chat_id: string | number): void {
  const key = String(chat_id);
  const state = timers.get(key);
  if (state) {
    clearInterval(state.interval);
    if (state.safety) clearTimeout(state.safety);
    timers.delete(key);
  }
}

/**
 * Run `fn` while keeping the typing indicator active for chat_id. RAII-style
 * wrapper over startTyping/stopTyping — use when receive-process-reply is one
 * function. For event-driven callers (plugin with inbound/outbound across
 * separate handlers), call startTyping/stopTyping directly.
 */
export async function withTyping<T>(
  api: Pick<Api, 'sendChatAction'>,
  chat_id: string | number,
  fn: () => Promise<T>,
  opts: WithTypingOpts = {},
): Promise<T> {
  // Disable safety cap — try/finally guarantees cleanup regardless of fn duration.
  startTyping(api, chat_id, { ...opts, maxMs: 0 });
  try {
    return await fn();
  } finally {
    stopTyping(chat_id);
  }
}
