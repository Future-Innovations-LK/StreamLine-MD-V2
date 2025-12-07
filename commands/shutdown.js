// commands/shutdown.js
import { updateSettings, getSettings } from "../lib/settings.js";

export default {
  pattern: "shutdown",
  alias: ["offline", "stop", "off"],
  disc: "Turn off the bot",
  category: "Owner",
  on: "message",

  async function(conn, mek, m, ctx) {
    if (!ctx.isOwner) {
      m.react("❌");
      m.reply("⛔ Only the owner can shut down the bot.");
      return;
    }

    const settings = await getSettings();
    if (!settings.botEnabled) return ctx.reply("Bot is already offline.");

    await updateSettings({ botEnabled: false });
    ctx.reply(
      "⚠️ Bot has been shut down. Only `.boot` or `.start` will work now."
    );
  },
};
