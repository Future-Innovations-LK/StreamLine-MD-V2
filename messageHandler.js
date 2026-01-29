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

  // ---------------------------
  // Settings cache
  // ---------------------------
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

  // ---------------------------
  // Helpers (Search All + Match)
  // ---------------------------
  function normalizeOwnerList(list = []) {
    // keep digits only (removes +, spaces, etc)
    return list
      .map((x) => String(x || "").replace(/[^\d]/g, ""))
      .filter(Boolean);
  }

  function extractNumbersFromKey(mek, conn) {
    const possibles = [
      mek?.key?.participantAlt,
      mek?.key?.participant,
      mek?.key?.remoteJid,
      mek?.key?.remoteJidAlt,
      conn?.user?.id,
    ].filter(Boolean);

    const numbers = new Set();

    for (const jid of possibles) {
      try {
        const norm = jidNormalizedUser(jid);
        const num = norm.split("@")[0];
        if (/^\d+$/.test(num)) numbers.add(num);
      } catch {}
    }

    return [...numbers];
  }

  const botJid = jidNormalizedUser(conn.user.id);
  const botNumber = botJid.split("@")[0];

  const foundNumbers = extractNumbersFromKey(mek, conn);

  // pick sender number (prefer not-bot)
  const senderNumber =
    foundNumbers.find((n) => n !== botNumber) || foundNumbers[0] || botNumber;

  const sender = `${senderNumber}@s.whatsapp.net`;

  const cleanedOwners = normalizeOwnerList(ownerNumbers);

  const isMe = foundNumbers.includes(botNumber);

  // ✅ owner = any overlap between foundNumbers and ownerNumbers
  const isOwner = isMe || cleanedOwners.some((own) => foundNumbers.includes(own));

  // ---------------------------
  // "from" (reply target)
  // ---------------------------
  const rawFrom = mek.key.remoteJid;
  const isGroup = rawFrom?.endsWith("@g.us");

  // if group, from must be group jid. if private, send to sender jid
  const from = isGroup ? rawFrom : sender;

  // ---------------------------
  // get quoted message if exists
  // ---------------------------
  const quoted =
    type === "extendedTextMessage" &&
    mek.message.extendedTextMessage?.contextInfo
      ? mek.message.extendedTextMessage.contextInfo.quotedMessage || []
      : [];

  // ---------------------------
  // get message body
  // ---------------------------
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

  const pushname = mek.pushName || "Unknown";

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
    const [mainType] = contentType.split("/");

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

    if (mainType === "image") {
      return conn.sendMessage(
        jid,
        { image: buf, caption, ...options },
        { quoted: quotedMsg }
      );
    }

    if (mainType === "video") {
      return conn.sendMessage(
        jid,
        { video: buf, caption, mimetype: contentType, ...options },
        { quoted: quotedMsg }
      );
    }

    if (mainType === "audio") {
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
  // ✅ REPLY LISTENER HANDLING
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
