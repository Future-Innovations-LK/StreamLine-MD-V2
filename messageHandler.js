// messageHandler.js
import { jidNormalizedUser, getContentType } from "@whiskeysockets/baileys";
import { sms, downloadMediaMessage } from "./lib/msg.js";
import { getBuffer, getGroupAdmins } from "./lib/functions.js";
import axios from "axios";
import config from "./config.js";
import { loadAllCommands } from "./command.js";

export async function handleMessage(conn, mek, ownerNumbers = []) {
  // make sure sms() is awaited (it probably normalizes the message)
  const m = await sms(conn, mek);
  const type = getContentType(mek.message);
  const from = mek.key.remoteJid;

  // quoted message if exists
  const quoted =
    type === "extendedTextMessage" &&
    mek.message.extendedTextMessage?.contextInfo
      ? mek.message.extendedTextMessage.contextInfo.quotedMessage || []
      : [];

  // get the message body
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

  const prefix = config.PREFIX || ".";
  const isCmd = body.startsWith(prefix);
  const command = isCmd
    ? body.slice(prefix.length).trim().split(" ")[0].toLowerCase()
    : "";
  const args = body.trim().split(/ +/).slice(1);
  const q = args.join(" ");
  const isGroup = from && from.endsWith("@g.us");

  // ---------------------------
  // 🔑 Proper sender handling
  // ---------------------------
  let rawSender;

  if (mek.key.fromMe) {
    rawSender = conn.user.id; // bot itself
  } else if (mek.key.participantAlt) {
    rawSender = mek.key.participantAlt; // real number if available
  } else {
    rawSender = mek.key.participant || mek.key.remoteJid; // fallback
  }

  // normalize sender JID to a consistent format
  const sender = jidNormalizedUser(rawSender); // e.g. "9471xxxxx@s.whatsapp.net"
  const senderNumber = sender.split("@")[0]; // always real number

  const botNumber = conn.user.id.split(":")[0];
  const pushname = mek.pushName || "Sin Nombre";
  const isMe = botNumber.includes(senderNumber);
  const isOwner = ownerNumbers.includes(senderNumber) || isMe;

  // ---------------------------
  // Group metadata
  // ---------------------------
  const groupMetadata = isGroup
    ? await conn.groupMetadata(from).catch(() => null)
    : null;
  const groupName = groupMetadata?.subject || "";
  const participants = groupMetadata?.participants || [];
  const groupJid = isGroup ? groupMetadata?.id || "" : "";

  // normalize admin list (getGroupAdmins returns normalized jids)
  const groupAdmins = isGroup ? await getGroupAdmins(participants) : [];
  const botJid = jidNormalizedUser(conn.user.id); // normalized bot JID
  const isBotAdmins = groupAdmins.includes(botJid);
  const isAdmins = groupAdmins.includes(sender);

  // ---------------------------
  // Reply helper
  // ---------------------------
  const reply = (teks) => {
    conn.sendMessage(from, { text: teks }, { quoted: mek });
  };

  // ---------------------------
  // Media sender helper
  // ---------------------------
  conn.sendFileUrl = async (
    jid,
    url,
    caption = "",
    quotedMsg = null,
    options = {}
  ) => {
    // safer content-type parsing (strip charset)
    const head = await axios.head(url).catch(() => null);
    if (!head || !head.headers || !head.headers["content-type"]) {
      // fallback: try to fetch as buffer and send as document
      const buf = await getBuffer(url);
      return conn.sendMessage(
        jid,
        { document: buf, caption, mimetype: "application/octet-stream" },
        { quoted: quotedMsg }
      );
    }
    const contentType = head.headers["content-type"].split(";")[0].trim(); // e.g. "image/gif"
    const [type, subtype] = contentType.split("/");

    const buf = await getBuffer(url);

    if (contentType === "image/gif" || subtype === "gif") {
      return conn.sendMessage(
        jid,
        {
          video: buf,
          caption,
          gifPlayback: true,
          mimetype: "video/mp4",
          ...options,
        },
        { quoted: quotedMsg, ...options }
      );
    }

    if (contentType === "application/pdf") {
      return conn.sendMessage(
        jid,
        { document: buf, mimetype: "application/pdf", caption, ...options },
        { quoted: quotedMsg, ...options }
      );
    }

    if (type === "image") {
      return conn.sendMessage(
        jid,
        { image: buf, caption, ...options },
        { quoted: quotedMsg, ...options }
      );
    }

    if (type === "video") {
      return conn.sendMessage(
        jid,
        { video: buf, caption, mimetype: contentType, ...options },
        { quoted: quotedMsg, ...options }
      );
    }

    if (type === "audio") {
      return conn.sendMessage(
        jid,
        { audio: buf, caption, mimetype: contentType, ...options },
        { quoted: quotedMsg, ...options }
      );
    }

    // default: send as document
    return conn.sendMessage(
      jid,
      { document: buf, caption, mimetype: contentType, ...options },
      { quoted: quotedMsg, ...options }
    );
  };

  // ---------------------------
  // Load and handle commands
  // ---------------------------
  const commands = await loadAllCommands();

  if (isCmd) {
    const cmdObj =
      commands.find((c) => c.pattern === command) ||
      commands.find((c) => c.alias?.includes(command));
    if (cmdObj) {
      if (cmdObj.react)
        await conn.sendMessage(from, {
          react: { text: cmdObj.react, key: mek.key },
        });
      try {
        await cmdObj.function(conn, mek, m, {
          from,
          quoted,
          body,
          isCmd,
          command,
          args,
          q,
          isGroup,
          sender,
          senderNumber, // ✅ always real number now
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
  }
}
