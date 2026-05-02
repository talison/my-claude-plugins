import { test, expect } from "bun:test"

// Pure helper mirroring the meta-block construction in server.ts handleInbound.
// MUST stay in sync with the inlined version in server.ts — when adding fields
// in production, add them here too. The live notification path itself is
// exercised via the post-fork-publish manual smoke test.
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
    ...((replyTo?.text ?? replyTo?.caption) != null ? { reply_to_message_text: replyTo.text ?? replyTo.caption } : {}),
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

test("channel meta uses reply_to_message.caption when text is absent", () => {
  const ctx = {
    chat: { id: 12345 },
    from: { id: 99, username: "tom" },
    message: {
      message_id: 202,
      date: 1714600200,
      reply_to_message: {
        message_id: 100,
        caption: "Photo of dinner — pasta and wine",
      },
    },
  }
  const meta = buildChannelMeta(ctx)
  expect(meta.reply_to_message_id).toBe("100")
  expect(meta.reply_to_message_text).toBe("Photo of dinner — pasta and wine")
})
