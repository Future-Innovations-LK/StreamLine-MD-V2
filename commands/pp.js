import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { sms } from "../lib/msg.js";

function normalizeArgs(rawArgs) {
  if (!rawArgs) return [];
  if (Array.isArray(rawArgs))
    return rawArgs.map((a) => String(a).toLowerCase());
  return String(rawArgs)
    .split(/\s+/)
    .map((a) => a.toLowerCase())
    .filter(Boolean);
}

function safeReact(ctx, emoji) {
  try {
    if (ctx && typeof ctx.react === "function") return ctx.react(emoji);
  } catch {}
}

export default {
  pattern: "pp",
  alias: ["pfp", "dp", "profilepic"],
  category: "Tools",
  react: "🖼️", // more demon vibes 🖤

  async function(conn, mek, m, ctx) {
    try {
      if (mek?.message?.protocolMessage) return;

      const msg = await sms(conn, mek);
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

      let subjectJid = chatJid;
      const quoted = msg?.quoted;

      if (quoted) {
        const quotedSenderRaw =
          quoted?.sender ||
          quoted?.participant ||
          quoted?.key?.participant ||
          quoted?.msg?.key?.participant;
        if (quotedSenderRaw) subjectJid = jidNormalizedUser(quotedSenderRaw);
      } else if (!isGroup && subjectJid) {
        subjectJid = jidNormalizedUser(subjectJid);
      }

      let targetJid = chatJid;
      if (usePrivate) {
        if (isGroup) {
          if (!senderJid)
            return ctx.reply(
              "⚠️ Cannot detect your demonic essence in this group…",
            );
          targetJid = senderJid;
        } else {
          if (!botJid) return ctx.reply("⚠️ Cannot summon my dark powers…");
          targetJid = botJid;
        }
      }

      const statusMsg = await conn.sendMessage(
        chatJid,
        { text: "🩸 Summoning the shadowy portrait… 🩸" },
        { quoted: mek },
      );

      let ppUrl = null;
      try {
        ppUrl = await conn.profilePictureUrl(subjectJid, "image");
      } catch {
        try {
          ppUrl = await conn.profilePictureUrl(subjectJid);
        } catch {}
      }

      if (!ppUrl) {
        await conn.sendMessage(chatJid, {
          text: "⚠️ No visage found… or it is hidden in the abyss.",
          edit: statusMsg.key,
        });
        return;
      }

      const cap = quoted
        ? "🖤 Behold the cursed profile of the replied soul.\n> *Powerd By Stream Line MD V2*"
        : isGroup
          ? "🖤 Group’s dark aura captured.\n> *Powerd By Stream Line MD V2*"
          : "🖤 Profile portrait revealed…\n> *Powerd By Stream Line MD V2*";

      await conn.sendMessage(
        targetJid,
        { image: { url: ppUrl }, caption: cap },
        { quoted: mek },
      );

      await conn.sendMessage(chatJid, {
        text: usePrivate
          ? isGroup
            ? "✅ Sent the shadow to your DM."
            : "✅ Sent the dark essence to my own void."
          : "✅ The cursed visage has been summoned.",
        edit: statusMsg.key,
      });
    } catch (e) {
      console.log(e);
      safeReact(ctx, "❌");
      try {
        await ctx.reply("❌ Failed to summon the demonic portrait…");
      } catch {}
    }
  },
};
