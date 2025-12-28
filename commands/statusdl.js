import { downloadContentFromMessage } from "@whiskeysockets/baileys";

export default {
  pattern: "sdl",
  disc: "Download quoted WhatsApp status",
  category: "Download",
  react: "⬇️",

  async function(conn, mek, m, ctx) {
    const chatId = ctx.from;
    const msg = mek.message;

    if (!msg) return;

    const type = Object.keys(msg)[0];
    const contextInfo = msg[type]?.contextInfo;

    // Check if replying to a status
    if (!contextInfo || contextInfo.remoteJid !== "status@broadcast") {
      return await conn.sendMessage(
        chatId,
        { text: "❌ Please reply to a *Status update* to download it." },
        { quoted: mek }
      );
    }

    const quotedMsg = contextInfo.quotedMessage;
    if (!quotedMsg) return;

    try {
      const quotedType = Object.keys(quotedMsg)[0];
      const mediaData = quotedMsg[quotedType];

      // TEXT STATUS
      if (
        quotedType === "conversation" ||
        quotedType === "extendedTextMessage"
      ) {
        const text =
          quotedMsg.conversation || quotedMsg.extendedTextMessage?.text;

        return await conn.sendMessage(
          chatId,
          { text: `📝 *Status Text:*\n\n${text}` },
          { quoted: mek }
        );
      }

      // MEDIA STATUS (image / video)
      const stream = await downloadContentFromMessage(
        mediaData,
        quotedType.replace("Message", "")
      );

      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      if (quotedType === "imageMessage") {
        await conn.sendMessage(
          chatId,
          {
            image: buffer,
            caption: mediaData.caption || "",
          },
          { quoted: mek }
        );
      } else if (quotedType === "videoMessage") {
        await conn.sendMessage(
          chatId,
          {
            video: buffer,
            caption: mediaData.caption || "",
          },
          { quoted: mek }
        );
      }
    } catch (err) {
      console.error("Status Download Error:", err);
      await conn.sendMessage(
        chatId,
        { text: "❌ Failed to download status media." },
        { quoted: mek }
      );
    }
  },
};
