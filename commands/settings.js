import { getSettings, updateSettings } from "../lib/settings.js";
import { registerReply } from "../lib/replyStore.js";

const SETTING_KEYS = [
  "autoReadStatus",
  "autoReactStatus",
  "prefix",
  "autoRejectCalls",
];

function formatSettings(settings) {
  return SETTING_KEYS.map((key, i) => {
    let status;
    if (key === "prefix") {
      status = `\`${settings[key]}\``; // show the actual character
    } else {
      status = settings[key] ? "✅ ON" : "❌ OFF";
    }
    return `${i + 1}. ${key} : ${status}`;
  }).join("\n");
}

export default {
  pattern: "settings",
  disc: "Configure bot settings",
  category: "Owner",
  react: "⚙️",
  on: "message",

  async function(conn, mek, m, ctx) {
    if (!ctx.isOwner) {
      m.react("❌");
      m.reply("⛔ Only the owner can change the settings.");
      return;
    }

    const settings = await getSettings();

    const menu =
      `⚙️ *BOT SETTINGS*\n\n` +
      formatSettings(settings) +
      `\n\nReply like:\n*1 on*, *2 off*, or *3 . (your prefix)*`;

    // Send menu
    const sent = await conn.sendMessage(
      ctx.from,
      { text: menu },
      { quoted: mek }
    );

    // Listen for reply
    registerReply(sent.key.id, {
      command: "settings",

      async onReply(text, ctx2) {
        const input = text.trim();
        const [numStr, ...rest] = input.split(/\s+/);
        const index = Number(numStr) - 1;
        const key = SETTING_KEYS[index];

        if (!ctx2.isOwner) {
          if (ctx2.key)
            await ctx2.conn.sendMessage(ctx2.from, {
              react: { text: "❌", key: ctx2.key },
            });
          await ctx2.conn.sendMessage(
            ctx2.from,
            { text: "⛔ Only the owner can change the settings." },
            { quoted: mek?.key ? mek : undefined }
          );
          return;
        }

        if (isNaN(index) || index < 0 || index >= SETTING_KEYS.length) {
          await ctx2.conn.sendMessage(
            ctx2.from,
            { text: "❌ Invalid option number!" },
            { quoted: mek?.key ? mek : undefined }
          );
          return;
        }

        let newValue;

        if (key === "prefix") {
          if (rest.length !== 1) {
            await ctx2.conn.sendMessage(
              ctx2.from,
              { text: "❌ Invalid prefix!\nReply like: *3 . (your prefix)*" },
              { quoted: mek?.key ? mek : undefined }
            );
            return;
          }
          newValue = rest[0]; // take the prefix character directly
        } else {
          const state = rest[0]?.toLowerCase();
          if (!["on", "off"].includes(state)) {
            await ctx2.conn.sendMessage(
              ctx2.from,
              { text: "❌ Invalid input! Reply like: *1 on* or *2 off*" },
              { quoted: mek?.key ? mek : undefined }
            );
            return;
          }
          newValue = state === "on";
        }

        await updateSettings({ [key]: newValue });
        const updated = await getSettings();

        const newMenu =
          `✅ *UPDATED SETTINGS*\n\n` +
          formatSettings(updated) +
          `\n\nReply again if needed:\n*1 on*, *2 off*, or *3 . (your prefix)*`;

        if (sent?.key) {
          await ctx2.conn.sendMessage(ctx2.from, {
            text: newMenu,
            edit: sent.key,
          });
        } else {
          await ctx2.conn.sendMessage(ctx2.from, { text: newMenu });
        }

        // Re-register reply
        registerReply(sent.key.id, {
          command: "settings",
          onReply: this.onReply,
        });
      },
    });
  },
};
