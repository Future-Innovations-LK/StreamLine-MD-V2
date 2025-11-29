import { downloadMediaMessage, sms } from "../lib/msg.js";
import fs from "fs";
import os from "os";
import path from "path";

export default {
  pattern: "setpf",
  alias: ["upf"],
  category: "Owner",
  react: "🖼️",

  async function(conn, mek, m, ctx) {
    const msg = await sms(conn, mek);
    const targetMsg = msg.quoted || msg;
    const { isOwner, isGroup, botJid } = ctx;

    if (isGroup) {
      m.react("❌");
      m.reply(
        "⚡ Oops! This command works only in private chats. For groups, try `.gsetpf`."
      );
      return;
    }

    if (!isOwner) {
      m.react("❌");
      m.reply("⛔ Only the owner can change my profile picture.");
      return;
    }

    if (!targetMsg || !["imageMessage"].includes(targetMsg.type)) {
      m.react("❌");
      m.reply("📷 Please reply to an image to set as my profile picture.");
      return;
    }

    try {
      // Download the image buffer
      const buffer = await downloadMediaMessage(targetMsg);

      // Save it to a temporary file
      const tmpFile = path.join(os.tmpdir(), `pf-${Date.now()}.jpg`);
      fs.writeFileSync(tmpFile, buffer);

      // Update profile picture
      await conn.updateProfilePicture(botJid, { url: tmpFile });

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
