import { updateSettings, getSettings } from "./settings.js";
import config from "../config.js";

export async function handleBootCommand(conn, mek) {
  // Fetch settings from DB
  const settings = await getSettings();
  const prefix = settings.prefix || config.PREFIX || ".";

  const body =
    mek.message.conversation || mek.message.extendedTextMessage?.text || "";

  if (!body.startsWith(prefix)) return false;

  const command = body.slice(prefix.length).trim().split(" ")[0].toLowerCase();
  const sender = mek.key.participant || mek.key.remoteJid;
  const senderNumber = sender.split("@")[0];
  const isOwner = (config.OWNER_NUMBERS || []).includes(senderNumber);

  if (!isOwner) {
    mek.react?.("❌");
    mek.reply?.("⛔ Only the owner can boot the bot.");
    return false;
  }

  if (command === "boot" || command === "start") {
    await updateSettings({ botEnabled: true });
    await conn.sendMessage(sender, { text: "✅ Bot is now ONLINE." });
    return true;
  }

  return false;
}
