import { downloadMediaMessage, sms } from "../lib/msg.js";
import fs from "fs";
import os from "os";
import path from "path";

export default {
  pattern: "gsetpf",
  alias: ["gupf"],
  category: "Owner",
  react: "🖼️",

  async function(conn, mek, m, ctx) {
    const msg = await sms(conn, mek);
    const targetMsg = msg.quoted || msg;

    const { isOwner, isGroup, isAdmins, isBotAdmins, groupJid } = ctx;
    if (!isGroup) {
      m.react("❌");
      m.reply("⚡ Oops! This command works only in groups.");
      return;
    }

    if (!isOwner && !isAdmins) {
      m.react("❌");
      m.reply("⛔ Only the owner or admins can change Group profile picture.");
      return;
    }
    if (!isBotAdmins) {
      m.react("❌");
      m.reply("⛔ I need to be an admin to change Group profile picture.");
      return;
    }

    if (!targetMsg || !["imageMessage"].includes(targetMsg.type)) {
      m.react("❌");
      m.reply("📷 Please reply to an image to set as Group profile picture.");
      return;
    }
    if (!groupJid) {
      m.react("❌");
      m.reply("⚠️ Unable to retrieve group information. Please try again.");
      return;
    }

    try {
      // Download the image buffer
      const buffer = await downloadMediaMessage(targetMsg);

      // Save it to a temporary file
      const tmpFile = path.join(os.tmpdir(), `pf-${Date.now()}.jpg`);
      fs.writeFileSync(tmpFile, buffer);

      // Update profile picture
      await conn.updateProfilePicture(groupJid, { url: tmpFile });

      // Delete the temporary file
      fs.unlinkSync(tmpFile);

      m.react("✅");
      m.reply("✨ Profile picture updated✨\n⚡ 𝘚𝘛𝘙𝘌𝘈𝘔 𝘓𝘐𝘕𝘌 𝘔𝘋 (𝘝2) ⚡");
    } catch (err) {
      console.error(err);
      m.react("❌");
      m.reply("⚠️ Failed to update profile picture. Please try again!");
    }
  },
};
