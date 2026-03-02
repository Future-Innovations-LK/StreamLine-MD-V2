import { downloadMediaMessage, sms } from "../lib/msg.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

/* =========================
   Helpers
========================= */

const FOOTER = "\n\n> *Powered By Stream Line MD V2*";

function safeReact(ctx, emoji) {
  try {
    if (ctx && typeof ctx.react === "function") return ctx.react(emoji);
  } catch {}
}

function getMessageType(messageObj) {
  if (!messageObj || typeof messageObj !== "object") return null;

  const allowed = [
    "imageMessage",
    "videoMessage",
    "audioMessage",
    "stickerMessage",
    "documentMessage",
  ];

  return allowed.find((k) => k in messageObj) || null;
}

function normalizeArgs(rawArgs) {
  if (!rawArgs) return [];
  if (Array.isArray(rawArgs))
    return rawArgs.map((a) => String(a).toLowerCase());
  return String(rawArgs)
    .split(/\s+/)
    .map((a) => a.toLowerCase())
    .filter(Boolean);
}

function caption(text) {
  // Demon/edgy vibe in caption
  return `🖤 ${text} 🖤${FOOTER}`;
}

/* =========================
   Command
========================= */

export default {
  pattern: "vv",
  alias: ["viewonce"],
  category: "Tools",
  react: "🫣", // could change to 🩸 for extra vibes

  async function(conn, mek, m, ctx) {
    try {
      const msg = await sms(conn, mek);
      const quoted = msg?.quoted;

      if (!quoted) {
        safeReact(ctx, "❗");
        return ctx.reply(
          "🩸 Reply to a *view-once* media to summon it from the shadows…",
        );
      }

      const args = normalizeArgs(ctx?.args ?? m?.args);
      const usePrivate =
        args.includes("p") || args.includes("-p") || args.includes("--p");

      const chatJid = ctx?.from || mek?.key?.remoteJid || msg?.from;
      const isGroup = String(chatJid || "").endsWith("@g.us");

      const senderJidRaw =
        mek?.key?.participant || msg?.sender || mek?.participant;
      const senderJid = senderJidRaw ? jidNormalizedUser(senderJidRaw) : null;

      const botJidRaw =
        conn?.user?.id || conn?.user?.jid || conn?.user?.user?.id;
      const botJid = botJidRaw ? jidNormalizedUser(botJidRaw) : null;

      let targetJid = chatJid;
      if (usePrivate) {
        if (isGroup) {
          if (!senderJid)
            return ctx.reply(
              "⚠️ Cannot sense the sender's essence in this group…",
            );
          targetJid = senderJid;
        } else {
          if (!botJid) return ctx.reply("⚠️ Cannot summon my powers…");
          targetJid = botJid;
        }
      }

      // Status message
      const statusMsg = await conn.sendMessage(
        chatJid,
        { text: "⏳ Drawing the view-once from the void…" },
        { quoted: mek },
      );

      // Download media
      const buffer = await downloadMediaMessage(quoted);
      const type = quoted?.type || getMessageType(quoted);

      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        safeReact(ctx, "❗");
        return ctx.reply(
          "❌ The media could not be extracted from the shadows.",
        );
      }

      // Send saved media with demon vibe captions
      if (type === "imageMessage" || type === "viewOnceMessage") {
        await conn.sendMessage(
          targetJid,
          { image: buffer, caption: caption("✅ View-once image claimed!") },
          { quoted: mek },
        );
      } else if (type === "videoMessage") {
        await conn.sendMessage(
          targetJid,
          { video: buffer, caption: caption("✅ View-once video claimed!") },
          { quoted: mek },
        );
      } else if (type === "audioMessage") {
        await conn.sendMessage(
          targetJid,
          { audio: buffer, mimetype: "audio/mpeg" },
          { quoted: mek },
        );
      } else if (type === "stickerMessage") {
        await conn.sendMessage(targetJid, { sticker: buffer }, { quoted: mek });
      } else if (type === "documentMessage") {
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
        return ctx.reply("⚠️ Media type lost in the abyss…");
      }

      // Done message
      await conn.sendMessage(chatJid, {
        text: usePrivate
          ? isGroup
            ? "✅ Claimed & sent to sender DM from the shadows."
            : "✅ Claimed & stored in my void."
          : "✅ Media claimed from the abyss.",
        edit: statusMsg.key,
      });

      safeReact(ctx, "✅");
    } catch (e) {
      console.log(e);
      safeReact(ctx, "❌");
      ctx.reply("❌ Failed to extract media from the shadows…");
    }
  },
};
