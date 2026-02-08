// commands/viewonce.js
import { downloadMediaMessage, sms } from "../lib/msg.js";

function safeReact(ctx, emoji) {
  try {
    if (ctx && typeof ctx.react === "function") return ctx.react(emoji);
  } catch {}
}

function unwrapViewOnceMessage(message) {
  // Baileys typically wraps view-once like this
  const v2 = message?.viewOnceMessageV2?.message;
  const v2ext = message?.viewOnceMessageV2Extension?.message;
  return v2 || v2ext || message;
}

function getMessageType(messageObj) {
  // messageObj looks like: { imageMessage: {...} } etc.
  if (!messageObj || typeof messageObj !== "object") return null;
  return Object.keys(messageObj)[0] || null;
}

export default {
  pattern: "vv",
  alias: ["viewonce"],
  category: "Tools",
  react: "🫣",

  async function(conn, mek, m, ctx) {
    try {
      const msg = await sms(conn, mek);

      // ✅ MUST be a reply (stop sending without reply)
      const quoted = msg?.quoted;
      if (!quoted) {
        safeReact(ctx, "❗");
        return ctx.reply(
          "Heheee~ please *reply* to the view-once media you want me to save ✨🫶",
        );
      }

      // ✅ Prefer sending back to the same chat, and prefer remoteJidAlt when in LID mode
      const key = mek?.key || {};
      const targetJid =
        key.remoteJidAlt || key.remoteJid || ctx?.from || msg?.from;

      await ctx.reply("Gimme a sec… I’m grabbing it for you 🐾💫");

      // ✅ Unwrap view once for type detection
      // depending on your sms() wrapper, quoted may be:
      // - { message: {...} } OR already the inner message
      const quotedMessage = quoted?.message || quoted;
      const inner = unwrapViewOnceMessage(quotedMessage);

      // If still has `.message`, unwrap again
      const container = inner?.message
        ? unwrapViewOnceMessage(inner.message)
        : inner;

      const type = getMessageType(container);
      if (!type) {
        safeReact(ctx, "❗");
        return ctx.reply(
          "I couldn’t detect the media type 😭 Reply directly to the view-once image/video.",
        );
      }

      // ✅ Download media
      // Some downloadMediaMessage implementations want the whole quoted object (with key),
      // others want the message container. Try quoted first, fallback to inner/container.
      let buffer;
      try {
        buffer = await downloadMediaMessage(quoted);
      } catch {
        try {
          buffer = await downloadMediaMessage(inner);
        } catch {
          buffer = await downloadMediaMessage(container);
        }
      }

      const cuteCaption1 = `✨ *Here Is The View Once Image* ✨
⚡ 𝘚𝘛𝘙𝘌𝘈𝘔 𝘓𝘐𝘕𝘌 𝘔𝘋 (𝘝2) ⚡`;

      const cuteCaption2 = `✨ *Here Is The View Once Video* ✨
⚡ 𝘚𝘛𝘙𝘌𝘈𝘔 𝘓𝘐𝘕𝘌 𝘔𝘋 (𝘝2) ⚡`;

      if (type === "imageMessage") {
        await conn.sendMessage(targetJid, {
          image: buffer,
          caption: cuteCaption1,
        });
      } else if (type === "videoMessage") {
        await conn.sendMessage(targetJid, {
          video: buffer,
          caption: cuteCaption2,
        });
      } else if (type === "audioMessage") {
        await conn.sendMessage(targetJid, {
          audio: buffer,
          mimetype: "audio/mpeg", // adjust if needed
        });
      } else {
        safeReact(ctx, "❗");
        return ctx.reply(`Unsupported media type: *${type}* 😭`);
      }

      safeReact(ctx, "✅");
    } catch (e) {
      console.log(e);
      safeReact(ctx, "❌");
      ctx.reply("something went wrong while saving 😭 please try again?");
    }
  },
};
