import { registerReply } from "../lib/replyStore.js";
import {
  getGroupAutoReact,
  addGroupAutoReact,
  removeGroupAutoReact,
  setGroupAutoReactEnabled,
} from "../lib/Stores/groupAutoReactStore.js";

export default {
  pattern: "groupautoreact",
  disc: "Manage Group Auto Reacts",
  category: "Owner",
  react: "💫",
  on: "message",

  async function(conn, mek, m, ctx) {
    if (!ctx.isOwner) return m.reply("⛔ Only owner can use this command.");
    if (!ctx.from.endsWith("@g.us"))
      return m.reply("⚠️ Only usable in groups.");

    const group = await getGroupAutoReact(ctx.from);
    const list =
      group?.triggers
        ?.map((r, i) => `${i + 1}. "${r.trigger}" → "${r.emoji}"`)
        .join("\n") || "No auto reacts set.";

    const menu =
      `💫 *GROUP AUTO REACT*\nEnabled: ${group?.enabled ? "✅" : "❌"}\n\n` +
      `${list}\n\n` +
      `Commands:\n*add <trigger> <emoji>*\n*remove <number>*\n*on/off*`;

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

          await addGroupAutoReact(ctx2.from, trigger, emoji);
          await conn.sendMessage(
            ctx2.from,
            { text: `✅ Added: "${trigger}" → "${emoji}"` },
            { quoted: mek },
          );
        } else if (cmd.toLowerCase() === "remove") {
          const idx = Number(rest[0]) - 1;
          const success = await removeGroupAutoReact(ctx2.from, idx);
          if (!success)
            return conn.sendMessage(
              ctx2.from,
              { text: "❌ Invalid number!" },
              { quoted: mek },
            );
          await conn.sendMessage(
            ctx2.from,
            { text: `✅ Removed auto react #${idx + 1}` },
            { quoted: mek },
          );
        } else if (["on", "off"].includes(cmd.toLowerCase())) {
          await setGroupAutoReactEnabled(ctx2.from, cmd.toLowerCase() === "on");
          await conn.sendMessage(
            ctx2.from,
            {
              text: `✅ Auto-react ${cmd.toLowerCase() === "on" ? "enabled" : "disabled"}!`,
            },
            { quoted: mek },
          );
        } else {
          await conn.sendMessage(
            ctx2.from,
            { text: "❌ Unknown command. Use add/remove/on/off" },
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
