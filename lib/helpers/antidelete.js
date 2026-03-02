import chalk from "chalk";
import { downloadMediaMessage } from "../msg.js";

export async function handleDeletedMessage({
  conn,
  mek,
  getMessageById,
  jidNormalizedUser,
}) {
  try {
    console.log(
      chalk.bgYellow.black(
        "🗑️ [DELETE DETECTED] Processing Deleted Message...",
      ),
    );

    const deletedKey = mek.message?.protocolMessage?.key;
    if (!deletedKey) {
      console.log(
        chalk.red(
          "❌ No deleted message key found in mek.message.protocolMessage.key",
        ),
      );
      return;
    }
    console.log(chalk.blue("🔑 Deleted Key:"), deletedKey);

    // ================================
    // Fetch message from Mongo / DB
    // ================================
    const msg = await getMessageById(deletedKey.id);
    if (!msg || !msg.message) {
      console.log(
        chalk.red("❌ Message not found in DB for id:"),
        deletedKey.id,
      );
      return;
    }
    console.log(chalk.green("✅ Message Found!"));

    const chatJid = msg.key.remoteJid;
    const isGroup = chatJid.endsWith("@g.us");
    const botJid = jidNormalizedUser(conn.user.id);

    const senderJid = isGroup
      ? msg.key.participant || msg.key.remoteJid
      : msg.key.fromMe
        ? msg.key.remoteJid
        : msg.key.participant || msg.key.remoteJid;
    const deleterJid = mek.key.participant || mek.key.remoteJid;

    const messageObj = msg.message;
    const mType = Object.keys(messageObj)[0];
    console.log(chalk.magenta("📝 Message Type:"), mType);

    const content =
      messageObj.conversation ||
      messageObj.extendedTextMessage?.text ||
      messageObj.imageMessage?.caption ||
      messageObj.videoMessage?.caption ||
      "Media Content (No Caption)";
    console.log(chalk.magenta("💬 Content Extracted:"), content);

    // ================================
    // Get Group Info if needed
    // ================================
    let groupName = "";
    if (isGroup) {
      try {
        const metadata = await conn.groupMetadata(chatJid);
        groupName = metadata.subject;
        console.log(chalk.green("🏘️ Group Name:"), groupName);
      } catch (err) {
        groupName = "Unknown Group";
        console.log(chalk.red("❌ Failed to fetch group metadata:"), err);
      }
    }

    // ================================
    // Construct ANTI DELETE HEADER
    // ================================
    let antiDeleteHeader = "╔═══『 🛡️ ANTI DELETE 🛡️ 』═══╗\n";

    antiDeleteHeader += `┃ 💀 *Message Deleted*\n`;
    antiDeleteHeader += `┃ 👁 *Sender:* @${senderJid.split("@")[0]}\n`;
    antiDeleteHeader += `┃ 🩸 *Deleted By:* @${deleterJid.split("@")[0]}\n`;
    antiDeleteHeader += `┃ 🏴 *Chat:* ${isGroup ? groupName : "Private Chat"}\n`;
    antiDeleteHeader += `┃ 📦 *Type:* ${mType.replace("Message", "")}\n`;

    if (
      ![
        "imageMessage",
        "videoMessage",
        "audioMessage",
        "stickerMessage",
        "documentMessage",
      ].includes(mType)
    ) {
      antiDeleteHeader += `┃ 📜 *Content:* ${content}\n`;
    }

    antiDeleteHeader += "╚══════════════════════╝\n";
    antiDeleteHeader += "> *Powerd By Stream Line MD V2*";

    const mentions = [senderJid, deleterJid];

    // ================================
    // Handle Media
    // ================================
    const mediaTypes = [
      "imageMessage",
      "videoMessage",
      "audioMessage",
      "stickerMessage",
      "documentMessage",
    ];
    if (mediaTypes.includes(mType)) {
      console.log(chalk.yellow("📸 Media detected, attempting download..."));
      const buffer = await downloadMediaMessage(messageObj);
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        console.log(chalk.red("❌ Failed to download media buffer!"));
        return;
      }
      console.log(
        chalk.green("✅ Media downloaded successfully, size:"),
        buffer.length,
      );

      switch (mType) {
        case "imageMessage":
          console.log(chalk.blue("🖼 Sending recovered image..."));
          await conn.sendMessage(botJid, {
            image: buffer,
            caption: antiDeleteHeader,
            mentions,
          });
          break;

        case "videoMessage":
          console.log(chalk.blue("🎥 Sending recovered video..."));
          await conn.sendMessage(botJid, {
            video: buffer,
            caption: antiDeleteHeader,
            mentions,
          });
          break;

        case "documentMessage":
          console.log(chalk.blue("📂 Sending recovered document..."));
          await conn.sendMessage(botJid, {
            document: buffer,
            mimetype: messageObj.documentMessage?.mimetype,
            fileName: messageObj.documentMessage?.fileName || "RecoveredFile",
            caption: antiDeleteHeader,
            mentions,
          });
          break;

        case "audioMessage":
          console.log(chalk.blue("🔊 Sending recovered audio..."));
          await conn.sendMessage(botJid, {
            audio: buffer,
            mimetype: messageObj.audioMessage?.mimetype || "audio/mpeg",
          });
          await conn.sendMessage(botJid, { text: antiDeleteHeader, mentions });
          break;

        case "stickerMessage":
          console.log(chalk.blue("🏷 Sending recovered sticker..."));
          await conn.sendMessage(botJid, { sticker: buffer });
          await conn.sendMessage(botJid, { text: antiDeleteHeader, mentions });
          break;
      }
    } else {
      console.log(
        chalk.green("📝 Text message detected, sending recovered text..."),
      );
      await conn.sendMessage(botJid, { text: antiDeleteHeader, mentions });
    }

    console.log(chalk.bgGreen.black("✅ [ANTI DELETE SUCCESS]"));
  } catch (err) {
    console.error(chalk.bgRed.white("🔥 [ANTI DELETE ERROR]"), err);
  }
}
