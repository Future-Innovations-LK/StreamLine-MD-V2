import { registerReply } from "../lib/replyStore.js";
import {
  getGroupAutoReact,
  setGroupAutoReactEnabled,
  setGroupEmojis,
} from "../lib/Stores/groupAutoReactStore.js";

export default {
  pattern: "groupautoreact",
  alias: ["gar"],
  disc: "Manage group auto-react (random emoji every msg)",
  category: "Owner",
  react: "💫",
  on: "message",

  async function(conn, mek, m, ctx) {
    if (!ctx.isOwner && !ctx.isAdmin)
      return m.reply("⛔ Only admins/owner can use this command.");
    if (!ctx.from.endsWith("@g.us"))
      return m.reply("⚠️ Only usable in groups.");

    const group = await getGroupAutoReact(ctx.from);
    const emojiList = group?.emojis?.join(" ") || "No emojis set yet.";
    const menu = `💫 *GROUP AUTO REACT*\nEnabled: ${group?.enabled ? "✅" : "❌"}\nEmojis: ${emojiList}\n\nCommands:\n*on/off*\n*setemojis ❤️🔥✨*`;

    const sent = await conn.sendMessage(
      ctx.from,
      { text: menu },
      { quoted: mek },
    );

    registerReply(sent.key.id, {
      command: "groupautoreact",
      async onReply(text, ctx2) {
        if (!ctx2.isOwner && !ctx2.isAdmin) return;

        const [cmd, ...rest] = text.trim().split(/\s+/);

        if (["on", "off"].includes(cmd.toLowerCase())) {
          await setGroupAutoReactEnabled(ctx2.from, cmd.toLowerCase() === "on");
          await conn.sendMessage(
            ctx2.from,
            {
              text: `✅ Auto-react ${cmd.toLowerCase() === "on" ? "enabled" : "disabled"}!`,
            },
            { quoted: mek },
          );
        } else if (cmd.toLowerCase() === "setemojis") {
          const emojis = rest;
          if (!emojis.length)
            return conn.sendMessage(
              ctx2.from,
              { text: "❌ Provide emojis like: setemojis ❤️🔥✨" },
              { quoted: mek },
            );
          await setGroupEmojis(ctx2.from, emojis);
          await conn.sendMessage(
            ctx2.from,
            { text: `✅ Emoji list updated: ${emojis.join(" ")}` },
            { quoted: mek },
          );
        } else {
          await conn.sendMessage(
            ctx2.from,
            { text: "❌ Unknown command. Use on/off or setemojis" },
            { quoted: mek },
          );
        }

        // re-register
        registerReply(sent.key.id, {
          command: "groupautoreact",
          onReply: this.onReply,
        });
      },
    });
  },
};
