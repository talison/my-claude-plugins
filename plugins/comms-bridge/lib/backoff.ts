/**
 * Exponential backoff for the long-poll loop. Doubles each call up to a cap,
 * with jitter applied so multiple plugin restarts in lockstep don't pound the
 * bridge in sync.
 *
 * Pattern (defaults: 1s base, 30s cap):
 *   attempt 1 →   1s ± 250ms
 *   attempt 2 →   2s ± 500ms
 *   attempt 3 →   4s ± 1s
 *   attempt 4 →   8s ± 2s
 *   attempt 5 →  16s ± 4s
 *   attempt 6+ →  30s ± 7.5s   (capped)
 *
 * `reset()` is called after a successful inbox response so the next failure
 * starts from base again.
 */

export interface BackoffOpts {
  baseMs?: number
  maxMs?: number
  jitterRatio?: number
}

export class Backoff {
  private attempt = 0
  private readonly baseMs: number
  private readonly maxMs: number
  private readonly jitterRatio: number

  constructor(opts: BackoffOpts = {}) {
    this.baseMs = opts.baseMs ?? 1000
    this.maxMs = opts.maxMs ?? 30_000
    this.jitterRatio = opts.jitterRatio ?? 0.25
  }

  next(): number {
    this.attempt += 1
    const exp = Math.min(this.maxMs, this.baseMs * 2 ** (this.attempt - 1))
    const jitter = exp * this.jitterRatio * (Math.random() * 2 - 1)
    return Math.max(0, Math.round(exp + jitter))
  }

  reset(): void {
    this.attempt = 0
  }

  get attempts(): number {
    return this.attempt
  }
}
