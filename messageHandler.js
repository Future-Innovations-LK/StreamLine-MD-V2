// messageHandler.js
import { jidNormalizedUser, getContentType } from "@whiskeysockets/baileys";
import { sms, downloadMediaMessage } from "./lib/msg.js";
import { getBuffer, getGroupAdmins } from "./lib/functions.js";
import axios from "axios";
import config from "./config.js";
import { loadAllCommands } from "./command.js";
import { getReply } from "./lib/replyStore.js";
import { getSettings } from "./lib/settings.js";

export async function handleMessage(conn, mek, ownerNumbers = []) {
  // normalize message
  const m = await sms(conn, mek);

  const type = getContentType(mek.message);
  const from = mek.key.remoteJid;

  let cachedSettings = null;
  let lastSettingsLoad = 0;

  async function loadSettings() {
    const now = Date.now();

    // refresh every 5 seconds
    if (!cachedSettings || now - lastSettingsLoad > 5000) {
      cachedSettings = await getSettings();
      lastSettingsLoad = now;
    }

    return cachedSettings;
  }

  // get quoted message if exists
  const quoted =
    type === "extendedTextMessage" &&
    mek.message.extendedTextMessage?.contextInfo
      ? mek.message.extendedTextMessage.contextInfo.quotedMessage || []
      : [];

  // get message body
  const body =
    type === "conversation"
      ? mek.message.conversation
      : type === "extendedTextMessage"
      ? mek.message.extendedTextMessage.text
      : type === "imageMessage" && mek.message.imageMessage.caption
      ? mek.message.imageMessage.caption
      : type === "videoMessage" && mek.message.videoMessage.caption
      ? mek.message.videoMessage.caption
      : "";

  const settings = await loadSettings();

  const prefix = settings.prefix || config.PREFIX || ".";
  const isCmd = body.startsWith(prefix);
  const command = isCmd
    ? body.slice(prefix.length).trim().split(" ")[0].toLowerCase()
    : "";
  const args = body.trim().split(/ +/).slice(1);
  const q = args.join(" ");
  const isGroup = from.endsWith("@g.us");

  // ---------------------------
  // Sender Normalization
  // ---------------------------
  let rawSender;
  if (mek.key.fromMe) {
    rawSender = conn.user.id;
  } else if (mek.key.participantAlt) {
    rawSender = mek.key.participantAlt;
  } else {
    rawSender = mek.key.participant || mek.key.remoteJid;
  }

  const sender = jidNormalizedUser(rawSender);
  const senderNumber = sender.split("@")[0];

  const botNumber = conn.user.id.split(":")[0];
  const pushname = mek.pushName || "Unknown";

  const isMe = botNumber.includes(senderNumber);
  const isOwner = ownerNumbers.includes(senderNumber) || isMe;

  // ---------------------------
  // Group info
  // ---------------------------
  const groupMetadata = isGroup
    ? await conn.groupMetadata(from).catch(() => null)
    : null;

  const groupName = groupMetadata?.subject || "";
  const participants = groupMetadata?.participants || [];
  const groupJid = groupMetadata?.id || "";

  const groupAdmins = isGroup ? await getGroupAdmins(participants) : [];
  const botJid = jidNormalizedUser(conn.user.id);

  const isBotAdmins = groupAdmins.includes(botJid);
  const isAdmins = groupAdmins.includes(sender);

  // ---------------------------
  // Reply helper
  // ---------------------------
  const reply = (text) => {
    conn.sendMessage(from, { text }, { quoted: mek });
  };

  // ---------------------------
  // File sender helper
  // ---------------------------
  conn.sendFileUrl = async (
    jid,
    url,
    caption = "",
    quotedMsg = null,
    options = {}
  ) => {
    const head = await axios.head(url).catch(() => null);

    if (!head?.headers?.["content-type"]) {
      const buf = await getBuffer(url);
      return conn.sendMessage(
        jid,
        { document: buf, caption, mimetype: "application/octet-stream" },
        { quoted: quotedMsg }
      );
    }

    const contentType = head.headers["content-type"];
    const [type] = contentType.split("/");

    const buf = await getBuffer(url);

    if (contentType === "image/gif") {
      return conn.sendMessage(
        jid,
        {
          video: buf,
          caption,
          gifPlayback: true,
          mimetype: "video/mp4",
          ...options,
        },
        { quoted: quotedMsg }
      );
    }

    if (type === "image") {
      return conn.sendMessage(
        jid,
        { image: buf, caption, ...options },
        { quoted: quotedMsg }
      );
    }

    if (type === "video") {
      return conn.sendMessage(
        jid,
        { video: buf, caption, mimetype: contentType, ...options },
        { quoted: quotedMsg }
      );
    }

    if (type === "audio") {
      return conn.sendMessage(
        jid,
        { audio: buf, caption, mimetype: contentType, ...options },
        { quoted: quotedMsg }
      );
    }

    return conn.sendMessage(
      jid,
      { document: buf, caption, mimetype: contentType, ...options },
      { quoted: quotedMsg }
    );
  };

  // ====================================================
  // ✅ REPLY LISTENER HANDLING (NEW)
  // ====================================================

  const stanzaId = mek.message?.extendedTextMessage?.contextInfo?.stanzaId;

  if (stanzaId) {
    const replyData = getReply(stanzaId);

    if (replyData?.onReply) {
      try {
        await replyData.onReply(body.trim(), {
          conn,
          mek,
          m,
          from,
          sender,
          senderNumber,
          isOwner,
          reply,
        });
      } catch (err) {
        console.error("[REPLY HANDLER ERROR]", err);
      }

      // ⛔ stop normal command processing
      return;
    }
  }

  // ====================================================
  // ✅ NORMAL COMMAND HANDLING
  // ====================================================
  if (!isCmd) return;

  const commands = await loadAllCommands();

  const cmd =
    commands.find((c) => c.pattern === command) ||
    commands.find((c) => c.alias?.includes(command));

  if (!cmd) return;

  // react to command
  if (cmd.react) {
    await conn.sendMessage(from, {
      react: { text: cmd.react, key: mek.key },
    });
  }

  try {
    await cmd.function(conn, mek, m, {
      from,
      quoted,
      body,
      isCmd,
      command,
      args,
      q,
      isGroup,
      sender,
      senderNumber,
      botNumber,
      botJid,
      pushname,
      isMe,
      isOwner,
      groupMetadata,
      groupName,
      participants,
      groupAdmins,
      isBotAdmins,
      isAdmins,
      reply,
      groupJid,
    });
  } catch (e) {
    console.error("[PLUGIN ERROR]", e);
  }
}
