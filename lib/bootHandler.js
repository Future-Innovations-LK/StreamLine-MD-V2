import { updateSettings, getSettings } from "./settings.js";
import config from "../config.js";

export async function handleBootCommand(conn, mek) {
  // Get settings & prefix
  const settings = await getSettings();
  const prefix = settings?.prefix || config.PREFIX || ".";

  // Get message text
  const body =
    mek?.message?.conversation || mek?.message?.extendedTextMessage?.text || "";

  if (!body || !body.startsWith(prefix)) return false;

  // Parse command
  const command = body
    .slice(prefix.length)
    .trim()
    .split(/\s+/)[0]
    .toLowerCase();

  // Resolve sender (LID + group + private safe)
  const senderJid =
    mek?.key?.participantAlt ||
    mek?.key?.remoteJidAlt ||
    mek?.key?.participant ||
    mek?.key?.remoteJid;

  if (!senderJid) return false;

  const senderNumber = senderJid.split("@")[0];

  // Owner check (fromMe override)
  const isOwner =
    mek?.key?.fromMe === true || config.OWNER_NUMBERS.includes(senderNumber);

  if (!isOwner) {
    mek.react?.("❌");
    mek.reply?.("⛔ Only the owner can boot the bot.");
    return false;
  }

  // Boot command
  if (command === "boot" || command === "start") {
    await updateSettings({ botEnabled: true });

    await conn.sendMessage(senderJid, {
      text: "✅ Bot is now ONLINE.",
    });

    return true;
  }

  return false;
}
