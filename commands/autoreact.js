// commands/owner/autoReact.js
import { registerReply } from "../lib/replyStore.js";
import {
  getAutoReacts,
  addAutoReact,
  deleteAutoReact,
} from "../lib/Stores/autoReactStore.js";

export default {
  pattern: "autoreact",
  disc: "Manage Auto Reacts",
  category: "Owner",
  react: "❤️",
  on: "message",

  async function(conn, mek, m, ctx) {
    if (!ctx.isOwner) return m.reply("⛔ Only the owner can use this command.");

    const reacts = await getAutoReacts();
    const list =
      reacts
        .map((r, i) => `${i + 1}. "${r.trigger}" → "${r.emoji}"`)
        .join("\n") || "No auto reacts set.";

    const menu =
      `❤️ *AUTO REACTS*\n\n${list}\n\n` +
      `Reply like:\n*add love ❤️*\n*remove 1*`;

    const sent = await conn.sendMessage(
      ctx.from,
      { text: menu },
      { quoted: mek },
    );

    registerReply(sent.key.id, {
      command: "autoreact",
      async onReply(text, ctx2) {
        const [cmd, ...rest] = text.trim().split(/\s+/);

        if (!ctx2.isOwner) return;

        if (cmd.toLowerCase() === "add") {
          const spaceIdx = text.indexOf(" ");
          const secondSpace = text.indexOf(" ", spaceIdx + 1);
          if (secondSpace === -1)
            return conn.sendMessage(
              ctx2.from,
              { text: "❌ Format: add <trigger> <emoji>" },
              { quoted: mek },
            );

          const trigger = text.slice(spaceIdx + 1, secondSpace).toLowerCase();
          const emoji = text.slice(secondSpace + 1);

          await addAutoReact(trigger, emoji);
          await conn.sendMessage(
            ctx2.from,
            { text: `✅ Auto react added: "${trigger}" → "${emoji}"` },
            { quoted: mek },
          );
        } else if (cmd.toLowerCase() === "remove") {
          const autoReacts = await getAutoReacts();
          const idx = Number(rest[0]) - 1;
          if (isNaN(idx))
            return conn.sendMessage(
              ctx2.from,
              { text: "❌ Provide a valid number to remove!" },
              { quoted: mek },
            );

          const trigger = autoReacts[idx].trigger; // get string trigger safely
          await deleteAutoReact(trigger);
          await conn.sendMessage(
            ctx2.from,
            { text: `✅ Removed auto react #${idx + 1}` },
            { quoted: mek },
          );
        } else {
          await conn.sendMessage(
            ctx2.from,
            { text: "❌ Unknown command. Use *add* or *remove*." },
            { quoted: mek },
          );
        }

        // re-register
        registerReply(sent.key.id, {
          command: "autoreact",
          onReply: this.onReply,
        });
      },
    });
  },
};
