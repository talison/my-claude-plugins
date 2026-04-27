import { describe, expect, test } from 'bun:test'

import { renderPayload } from '../lib/payload.ts'

describe('renderPayload', () => {
  test('passes strings through unchanged', () => {
    expect(renderPayload('hello world')).toBe('hello world')
  })

  test('stringifies numbers and booleans', () => {
    expect(renderPayload(42)).toBe('42')
    expect(renderPayload(true)).toBe('true')
    expect(renderPayload(false)).toBe('false')
  })

  test('treats null and undefined as empty string', () => {
    expect(renderPayload(null)).toBe('')
    expect(renderPayload(undefined)).toBe('')
  })

  test('pretty-prints objects so structured payloads stay readable', () => {
    const out = renderPayload({ action: 'summarize', count: 3 })
    expect(out).toContain('"action": "summarize"')
    expect(out).toContain('"count": 3')
    // Pretty-printed → contains newlines.
    expect(out).toContain('\n')
  })

  test('pretty-prints arrays', () => {
    const out = renderPayload(['a', 'b'])
    expect(out).toContain('"a"')
    expect(out).toContain('"b"')
  })
})
