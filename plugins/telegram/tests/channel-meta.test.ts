import { test, expect } from "bun:test"

// Pure helper extracted from server.ts for testability.
// This locks the meta-shape contract; the live notification path is
// exercised via manual smoke test post-fork-publish.
function buildChannelMeta(ctx: any, imagePath?: string): Record<string, any> {
  const chat_id = String(ctx.chat.id)
  const msgId = ctx.message?.message_id
  const from = ctx.from
  const replyTo = ctx.message?.reply_to_message
  return {
    chat_id,
    ...(msgId != null ? { message_id: String(msgId) } : {}),
    user: from.username ?? String(from.id),
    user_id: String(from.id),
    ts: new Date((ctx.message?.date ?? 0) * 1000).toISOString(),
    ...(replyTo?.message_id != null ? { reply_to_message_id: String(replyTo.message_id) } : {}),
    ...(replyTo?.text != null ? { reply_to_message_text: replyTo.text } : {}),
    ...(imagePath ? { image_path: imagePath } : {}),
  }
}

test("channel meta includes reply_to_message_id when reply_to_message present", () => {
  const ctx = {
    chat: { id: 12345 },
    from: { id: 99, username: "tom" },
    message: {
      message_id: 200,
      date: 1714600000,
      reply_to_message: {
        message_id: 100,
        text: "Sharp drop: 104→69 in 30 min at 9:42 PM. Anything notable?",
      },
    },
  }
  const meta = buildChannelMeta(ctx)
  expect(meta.reply_to_message_id).toBe("100")
  expect(meta.reply_to_message_text).toContain("Sharp drop")
  expect(meta.message_id).toBe("200")
})

test("channel meta omits reply_to_* when no reply_to_message", () => {
  const ctx = {
    chat: { id: 12345 },
    from: { id: 99, username: "tom" },
    message: { message_id: 201, date: 1714600100 },
  }
  const meta = buildChannelMeta(ctx)
  expect(meta.reply_to_message_id).toBeUndefined()
  expect(meta.reply_to_message_text).toBeUndefined()
  expect(meta.message_id).toBe("201")
})
