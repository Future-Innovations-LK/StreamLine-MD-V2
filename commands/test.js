import axios from "axios";
import FormData from "form-data";
import fetch from "node-fetch";

export default {
  pattern: "test",
  alias: ["p"],
  disc: "Check bot speed and test card API",
  category: "Main",
  react: "⚡",

  async function(conn, mek, m, ctx) {
    const start = Date.now();

    try {
      const senderJid = m.sender;

      // ---- Push name ----
      const displayName = m.pushName || "Unknown User";

      // ---- Phone number ----
      const phone = senderJid.split("@")[0];

      // ---- Group name (if in group) ----
      let groupName = "Private Chat";
      if (ctx.isGroup) {
        const meta = await conn.groupMetadata(ctx.from);
        groupName = meta.subject;
      }

      // ---- Theme (example) ----
      const themeKey = "default";

      // ---- Fetch sender profile picture ----
      let avatarBuffer;
      try {
        const avatarUrl = await conn.profilePictureUrl(senderJid, "image");
        const avatarResp = await fetch(avatarUrl);
        avatarBuffer = await avatarResp.buffer();
      } catch {
        // fallback image if user has no profile pic
        const fallbackUrl = "https://img.pyrocdn.com/dbKUgahg.png";
        const fallbackResp = await fetch(fallbackUrl);
        avatarBuffer = await fallbackResp.buffer();
      }

      // ---- FormData ----
      const form = new FormData();
      form.append("profile", avatarBuffer, { filename: "avatar.png" });
      form.append("name", displayName);
      form.append("phone", phone);
      form.append("groupName", groupName);
      form.append("themeKey", themeKey);

      // ---- API call ----
      const apiResponse = await axios.post(
        "http://localhost:3000/generate-card",
        form,
        {
          headers: form.getHeaders(),
          responseType: "arraybuffer",
        }
      );

      const responseTime = (Date.now() - start) / 1000;

      await conn.sendMessage(
        ctx.from,
        {
          image: Buffer.from(apiResponse.data),
          caption: `🔥 ℬ𝓞𝑇 𝓢𝓟𝓔𝓔𝓓: ${responseTime.toFixed(
            2
          )}s\nCard generated for *${displayName}*`,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error(err);
      await conn.sendMessage(
        ctx.from,
        { text: "❌ Failed to generate card." },
        { quoted: mek }
      );
    }
  },
};
