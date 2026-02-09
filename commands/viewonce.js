// commands/viewonce.js
import { downloadMediaMessage, sms } from "../lib/msg.js";

function safeReact(ctx, emoji) {
  try {
    if (ctx && typeof ctx.react === "function") return ctx.react(emoji);
  } catch {}
}

function getMessageType(messageObj) {
  if (!messageObj || typeof messageObj !== "object") return null;

  // Only allow media types we can handle
  const allowed = [
    "imageMessage",
    "videoMessage",
    "audioMessage",
    "stickerMessage",
    "documentMessage",
  ];

  return allowed.find((k) => k in messageObj) || null;
}

export default {
  pattern: "vv",
  alias: ["viewonce"],
  category: "Tools",
  react: "🫣",

  async function(conn, mek, m, ctx) {
    try {
      const msg = await sms(conn, mek);

      // ✅ MUST be a reply
      const quoted = msg?.quoted;
      if (!quoted) {
        safeReact(ctx, "❗");
        return ctx.reply(
          "Heheee~ please *reply* to the view-once media you want me to save ✨🫶",
        );
      }

      // ✅ Prefer sending back to same chat
      const key = mek?.key || {};
      const targetJid =
        key.remoteJidAlt || key.remoteJid || ctx?.from || msg?.from;

      await ctx.reply("Gimme a sec… I’m grabbing it for you 🐾💫");

      // ✅ Detect type from quoted container
      // Your sms() sets quoted as raw object like { viewOnceMessageV2: {...} } etc.
      const type = getMessageType(quoted) || quoted?.type;

      // ✅ Download media using robust downloader
      const buffer = await downloadMediaMessage(quoted);

      // ✅ Guard: NEVER send null/empty
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        safeReact(ctx, "❗");
        return ctx.reply(
          "I couldn’t download that media 😭 Try replying directly to the view-once image/video.",
        );
      }

      const cuteCaption1 = `✨ *Here Is The View Once Image* ✨
⚡ 𝘚𝘛𝘙𝘌𝘈𝘔 𝘓𝘐𝘕𝘌 𝘔𝘋 (𝘝2) ⚡`;

      const cuteCaption2 = `✨ *Here Is The View Once Video* ✨
⚡ 𝘚𝘛𝘙𝘌𝘈𝘔 𝘓𝘐𝘕𝘌 𝘔𝘋 (𝘝2) ⚡`;

      // ✅ If sms() already normalized quoted.type, use that.
      // Otherwise, downloader already found the correct inner type.
      const finalType =
        quoted?.type ||
        type ||
        (quoted?.imageMessage
          ? "imageMessage"
          : quoted?.videoMessage
            ? "videoMessage"
            : quoted?.audioMessage
              ? "audioMessage"
              : null);

      if (finalType === "imageMessage") {
        await conn.sendMessage(
          targetJid,
          {
            image: buffer,
            caption: cuteCaption1,
          },
          { quoted: mek },
        );
      } else if (finalType === "videoMessage") {
        await conn.sendMessage(
          targetJid,
          {
            video: buffer,
            caption: cuteCaption2,
          },
          { quoted: mek },
        );
      } else if (finalType === "audioMessage") {
        await conn.sendMessage(
          targetJid,
          {
            audio: buffer,
            mimetype: "audio/mpeg",
          },
          { quoted: mek },
        );
      } else if (finalType === "stickerMessage") {
        await conn.sendMessage(
          targetJid,
          {
            sticker: buffer,
          },
          { quoted: mek },
        );
      } else if (finalType === "documentMessage") {
        await conn.sendMessage(
          targetJid,
          {
            document: buffer,
            mimetype:
              quoted?.msg?.mimetype || quoted?.documentMessage?.mimetype,
            fileName:
              quoted?.msg?.fileName ||
              quoted?.documentMessage?.fileName ||
              "file",
          },
          { quoted: mek },
        );
      } else {
        safeReact(ctx, "❗");
        return ctx.reply(`Unsupported media type 😭`);
      }

      safeReact(ctx, "✅");
    } catch (e) {
      console.log(e);
      safeReact(ctx, "❌");
      ctx.reply("something went wrong while saving 😭 please try again?");
    }
  },
};
