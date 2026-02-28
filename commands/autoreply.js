// commands/owner/autoReply.js
import { registerReply } from "../lib/replyStore.js";
import {
  getAutoReplies,
  addAutoReply,
  deleteAutoReply,
} from "../lib/autoReplyStore.js";

export default {
  pattern: "autoreply",
  disc: "Manage Auto Replies",
  category: "Owner",
  react: "💬",
  on: "message",

  async function(conn, mek, m, ctx) {
    if (!ctx.isOwner) {
      m.react("❌");
      m.reply("⛔ Only the owner can use this command.");
      return;
    }

    const autoReplies = await getAutoReplies();
    const list =
      autoReplies
        .map((r, i) => `${i + 1}. "${r.trigger}" → "${r.reply}"`)
        .join("\n") || "No auto replies set.";

    const menu =
      `💬 *AUTO REPLIES*\n\n${list}\n\n` +
      `Reply like:\n*add hello Hello there!* \n*remove 1*`;

    const sent = await conn.sendMessage(
      ctx.from,
      { text: menu },
      { quoted: mek },
    );

    registerReply(sent.key.id, {
      command: "autoreply",
      async onReply(text, ctx2) {
        if (!ctx2.isOwner) return; // double-check owner

        const [cmd, ...rest] = text.trim().split(/\s+/);
        const lowerCmd = cmd.toLowerCase();

        if (lowerCmd === "add") {
          // Ensure proper format
          if (rest.length < 2) {
            return conn.sendMessage(
              ctx2.from,
              { text: "❌ Format: add <trigger> <reply>" },
              { quoted: mek },
            );
          }

          const trigger = rest[0].toLowerCase(); // safe string
          const reply = rest.slice(1).join(" ");

          await addAutoReply(trigger, reply);
          return conn.sendMessage(
            ctx2.from,
            { text: `✅ Auto reply added: "${trigger}" → "${reply}"` },
            { quoted: mek },
          );
        } else if (lowerCmd === "remove") {
          const autoReplies = await getAutoReplies();
          const idx = Number(rest[0]) - 1;

          // validate index
          if (isNaN(idx) || idx < 0 || idx >= autoReplies.length) {
            return conn.sendMessage(
              ctx2.from,
              { text: "❌ Invalid number! Use the list above." },
              { quoted: mek },
            );
          }

          const trigger = autoReplies[idx].trigger; // get string trigger safely
          await deleteAutoReply(trigger);

          return conn.sendMessage(
            ctx2.from,
            { text: `✅ Removed auto reply #${idx + 1}: "${trigger}"` },
            { quoted: mek },
          );
        } else {
          return conn.sendMessage(
            ctx2.from,
            { text: "❌ Unknown command. Use *add* or *remove*." },
            { quoted: mek },
          );
        }

        // re-register for continuous edits
        registerReply(sent.key.id, {
          command: "autoreply",
          onReply: this.onReply,
        });
      },
    });
  },
};
