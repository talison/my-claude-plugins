import { describe, expect, test } from 'bun:test'

import { Backoff } from '../lib/backoff.ts'

describe('Backoff', () => {
  test('grows exponentially up to the cap', () => {
    // jitterRatio=0 → deterministic
    const b = new Backoff({ baseMs: 100, maxMs: 1000, jitterRatio: 0 })
    expect(b.next()).toBe(100) // attempt 1
    expect(b.next()).toBe(200) // attempt 2
    expect(b.next()).toBe(400) // attempt 3
    expect(b.next()).toBe(800) // attempt 4
    expect(b.next()).toBe(1000) // capped
    expect(b.next()).toBe(1000)
  })

  test('reset() takes us back to the base delay', () => {
    const b = new Backoff({ baseMs: 100, maxMs: 1000, jitterRatio: 0 })
    b.next()
    b.next()
    b.next()
    expect(b.attempts).toBe(3)
    b.reset()
    expect(b.attempts).toBe(0)
    expect(b.next()).toBe(100)
  })

  test('jitter stays within ratio bounds', () => {
    const b = new Backoff({ baseMs: 1000, maxMs: 1000, jitterRatio: 0.5 })
    for (let i = 0; i < 50; i++) {
      const v = b.next()
      // base 1000, ratio 0.5 → window [500, 1500]
      expect(v).toBeGreaterThanOrEqual(500)
      expect(v).toBeLessThanOrEqual(1500)
      b.reset()
    }
  })
})
