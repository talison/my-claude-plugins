/**
 * Render a comms-bridge message payload for inclusion as the channel
 * notification's `content` body.
 *
 * The bridge service stores `payload` as JSON of any shape (string, number,
 * object, null). Claude Code wraps the notification's `content` string into the
 * `<channel ...>BODY</channel>` block delivered to Cortex's session.
 *
 * Convention:
 *   - String payloads pass through unchanged (so a `text: "hello"` payload
 *     appears as plain "hello" inside the channel block — readable).
 *   - Numbers/booleans stringify normally.
 *   - null/undefined become an empty string.
 *   - Objects and arrays are pretty-printed JSON, so Cortex can read structured
 *     fields without parsing. Phase 3 (harness side) should mirror this format.
 */

export function renderPayload(payload: unknown): string {
  if (payload == null) return ''
  if (typeof payload === 'string') return payload
  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return String(payload)
  }
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}
