/**
 * Persistent cursor for the inbox long-poller.
 *
 * Storage: a single integer in a flat file (no JSON wrapping — easier to
 * inspect with `cat`, no parser surface area). Default location is
 * ~/.cortex/data/comms-bridge.<agent>.cursor; tests override via the constructor.
 *
 * Read errors (missing file, parse failure, permission denied) all silently
 * reset to 0 — the bridge will resend any messages we missed during downtime,
 * which is cheaper than failing closed.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname } from 'path'

export class Cursor {
  constructor(private readonly path: string) {}

  read(): number {
    try {
      const raw = readFileSync(this.path, 'utf8').trim()
      const n = Number.parseInt(raw, 10)
      return Number.isFinite(n) && n >= 0 ? n : 0
    } catch {
      return 0
    }
  }

  /**
   * Atomic write — temp file then rename. If we crash mid-write the old
   * cursor stays valid (vs. a torn write that resets us to 0 on next boot).
   */
  write(value: number): void {
    const dir = dirname(this.path)
    mkdirSync(dir, { recursive: true })
    const tmp = `${this.path}.tmp`
    writeFileSync(tmp, String(Math.max(0, Math.floor(value))) + '\n', { mode: 0o600 })
    renameSync(tmp, this.path)
  }
}
