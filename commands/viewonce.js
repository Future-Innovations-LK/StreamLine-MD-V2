// commands/vv.js
import { downloadMediaMessage, sms } from "../lib/msg.js";

export default {
  pattern: "vv",
  alias: ["viewonce"],
  category: "Tools",
  react: "🫣",

  async function(conn, mek, m, ctx) {
    try {
      const msg = await sms(conn, mek);

      const targetMsg = msg.quoted || msg;

      // FIX: Proper JID
      const targetJid = ctx.from || msg.from || mek.key.remoteJid;

      if (!targetMsg) {
        return ctx.reply(
          "Heheee~ please *reply* to the view-once media you want me to save ✨🫶"
        );
      }

      await ctx.reply("Gimme a sec… I’m grabbing it for you 🐾💫");

      const buffer = await downloadMediaMessage(targetMsg);
      const type = targetMsg.type;

      const cuteCaption1 = `✨ *Here Is The View Once Image* ✨
⚡ 𝘚𝘛𝘙𝘌𝘈𝘔 𝘓𝘐𝘕𝘌 𝘔𝘋 (𝘝2) ⚡`;
      const cuteCaption2 = `✨ *Here Is The View Once Video* ✨
⚡ 𝘚𝘛𝘙𝘌𝘈𝘔 𝘓𝘐𝘕𝘌 𝘔𝘋 (𝘝2) ⚡`;

      if (["imageMessage", "viewOnceMessage"].includes(type)) {
        await conn.sendMessage(targetJid, {
          image: buffer,
          caption: cuteCaption1,
        });
      } else if (type === "videoMessage") {
        await conn.sendMessage(targetJid, {
          video: buffer,
          caption: cuteCaption2,
        });
      } else if (type === "audioMessage") {
        await conn.sendMessage(targetJid, {
          audio: buffer,
          mimetype: "audio/mpeg",
        });
      }
    } catch (e) {
      console.log(e);
      ctx.react("❌");
      ctx.reply("something went wrong while saving 😭 please try again?");
    }
  },
};
