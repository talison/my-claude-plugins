import { describe, expect, test } from 'bun:test'

import { BridgeClient, BridgeError } from '../lib/bridge-client.ts'

interface RecordedCall {
  url: string
  init: RequestInit | undefined
}

function fakeFetch(
  responder: (url: string, init: RequestInit | undefined) => Response | Promise<Response>,
): { calls: RecordedCall[]; impl: typeof fetch } {
  const calls: RecordedCall[] = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    calls.push({ url, init })
    return responder(url, init)
  }) as typeof fetch
  return { calls, impl }
}

describe('BridgeClient.inbox', () => {
  test('GETs /inbox with the right query params', async () => {
    const { calls, impl } = fakeFetch(() =>
      new Response(
        JSON.stringify({ messages: [], next_cursor: 5 }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    const client = new BridgeClient({ baseUrl: 'http://test', fetchImpl: impl })
    const out = await client.inbox('cortex', 5, 25)
    expect(out.next_cursor).toBe(5)
    expect(out.messages).toEqual([])
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://test/inbox?agent=cortex&since=5&timeout=25')
  })

  test('throws BridgeError on non-2xx', async () => {
    const { impl } = fakeFetch(() => new Response('boom', { status: 500 }))
    const client = new BridgeClient({ baseUrl: 'http://test', fetchImpl: impl })
    let caught: unknown
    try {
      await client.inbox('cortex', 0, 25)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(BridgeError)
    expect((caught as BridgeError).status).toBe(500)
    expect((caught as BridgeError).body).toBe('boom')
  })

  test('returns parsed messages array', async () => {
    const payloadMessages = [
      {
        id: 7,
        uuid: 'u1',
        from_agent: 'max',
        to_agent: 'cortex',
        kind: 'request',
        payload: { action: 'ping' },
        reply_to_uuid: null,
        created_at: '2026-04-26T00:00:00Z',
      },
    ]
    const { impl } = fakeFetch(() =>
      new Response(
        JSON.stringify({ messages: payloadMessages, next_cursor: 7 }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    const client = new BridgeClient({ baseUrl: 'http://test', fetchImpl: impl })
    const res = await client.inbox('cortex', 0, 25)
    expect(res.next_cursor).toBe(7)
    expect(res.messages).toHaveLength(1)
    expect(res.messages[0].uuid).toBe('u1')
    expect(res.messages[0].from_agent).toBe('max')
  })
})

describe('BridgeClient.send', () => {
  test('POSTs the SendArgs with a JSON body and content-type', async () => {
    const { calls, impl } = fakeFetch(() =>
      new Response(
        JSON.stringify({
          id: 11,
          uuid: 'u1',
          stored_at: '2026-04-26T00:00:00Z',
          duplicate: false,
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    )
    const client = new BridgeClient({ baseUrl: 'http://test', fetchImpl: impl })
    const out = await client.send({
      uuid: 'u1',
      from_agent: 'cortex',
      to_agent: 'max',
      kind: 'notify',
      payload: 'hello',
    })

    expect(out.id).toBe(11)
    expect(out.duplicate).toBe(false)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://test/send')
    expect(calls[0].init?.method).toBe('POST')
    const headers = calls[0].init?.headers as Record<string, string>
    expect(headers['content-type']).toBe('application/json')
    const body = JSON.parse(calls[0].init?.body as string)
    expect(body).toEqual({
      uuid: 'u1',
      from_agent: 'cortex',
      to_agent: 'max',
      kind: 'notify',
      payload: 'hello',
      reply_to_uuid: null,
    })
  })

  test('includes reply_to_uuid when provided', async () => {
    const { calls, impl } = fakeFetch(() =>
      new Response(
        JSON.stringify({
          id: 12,
          uuid: 'u2',
          stored_at: '2026-04-26T00:00:00Z',
          duplicate: false,
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    )
    const client = new BridgeClient({ baseUrl: 'http://test', fetchImpl: impl })
    await client.send({
      uuid: 'u2',
      from_agent: 'cortex',
      to_agent: 'max',
      kind: 'response',
      payload: { ok: true },
      reply_to_uuid: 'orig-uuid',
    })
    const body = JSON.parse(calls[0].init?.body as string)
    expect(body.reply_to_uuid).toBe('orig-uuid')
    expect(body.kind).toBe('response')
  })

  test('throws BridgeError on rate-limit response', async () => {
    const { impl } = fakeFetch(() =>
      new Response('rate limit', { status: 503 }),
    )
    const client = new BridgeClient({ baseUrl: 'http://test', fetchImpl: impl })
    let caught: unknown
    try {
      await client.send({
        uuid: 'u3',
        from_agent: 'cortex',
        to_agent: 'max',
        kind: 'notify',
        payload: 'x',
      })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(BridgeError)
    expect((caught as BridgeError).status).toBe(503)
  })
})

describe('BridgeClient.ack', () => {
  test('POSTs the uuid', async () => {
    const { calls, impl } = fakeFetch(() =>
      new Response(JSON.stringify({ ok: true, updated: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const client = new BridgeClient({ baseUrl: 'http://test', fetchImpl: impl })
    const out = await client.ack('u9')
    expect(out.ok).toBe(true)
    expect(out.updated).toBe(true)
    const body = JSON.parse(calls[0].init?.body as string)
    expect(body).toEqual({ uuid: 'u9' })
  })
})

describe('BridgeClient.baseUrl normalization', () => {
  test('strips trailing slashes', async () => {
    const { calls, impl } = fakeFetch(() =>
      new Response(JSON.stringify({ messages: [], next_cursor: 0 }), {
        status: 200,
      }),
    )
    const client = new BridgeClient({
      baseUrl: 'http://test///',
      fetchImpl: impl,
    })
    await client.inbox('cortex', 0, 25)
    expect(calls[0].url).toBe('http://test/inbox?agent=cortex&since=0&timeout=25')
  })
})
