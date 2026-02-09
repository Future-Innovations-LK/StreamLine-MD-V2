import {
  proto,
  downloadContentFromMessage,
  getContentType,
} from "@whiskeysockets/baileys";

// -------------------- DOWNLOAD MEDIA --------------------
export const downloadMediaMessage = async (m) => {
  if (!m) return null;

  // Unwrap view-once containers (v1 + v2 + v2 extension)
  const unwrap = (obj) => {
    if (!obj || typeof obj !== "object") return obj;

    if (obj.viewOnceMessage?.message) return obj.viewOnceMessage.message;
    if (obj.viewOnceMessageV2?.message) return obj.viewOnceMessageV2.message;
    if (obj.viewOnceMessageV2Extension?.message)
      return obj.viewOnceMessageV2Extension.message;

    return obj;
  };

  // If m looks like { type, msg } from sms(), use it
  let type = m.type || null;
  let msg = m.msg || null;

  // If it's a raw container like { imageMessage: {...} } or { viewOnceMessageV2: {...} }
  if (!type || !msg) {
    const unwrapped = unwrap(m);
    type = getContentType(unwrapped);
    msg = unwrapped?.[type];
  } else {
    // If sms() left it as view-once type, unwrap it again
    if (
      type === "viewOnceMessage" ||
      type === "viewOnceMessageV2" ||
      type === "viewOnceMessageV2Extension"
    ) {
      const inner = unwrap(m.message || m);
      type = getContentType(inner);
      msg = inner?.[type];
    }
  }

  const typeMap = {
    imageMessage: "image",
    videoMessage: "video",
    audioMessage: "audio",
    stickerMessage: "sticker",
    documentMessage: "document",
  };

  const downloadType = typeMap[type];
  if (!downloadType || !msg) return null;

  const stream = await downloadContentFromMessage(msg, downloadType);

  let buffer = Buffer.from([]);
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

  return buffer.length ? buffer : null;
};

// -------------------- MESSAGE PARSER --------------------
export const sms = (conn, m) => {
  // BASIC META
  if (m.key) {
    m.id = m.key.id;
    m.chat = m.key.remoteJid;
    m.fromMe = m.key.fromMe;
    m.isGroup = m.chat.endsWith("@g.us");
    m.sender = m.fromMe
      ? conn.user.id.split(":")[0] + "@s.whatsapp.net"
      : m.isGroup
        ? m.key.participant
        : m.key.remoteJid;
  }

  const unwrapAnyViewOnce = (obj) => {
    const v1 = obj?.viewOnceMessage?.message;
    const v2 = obj?.viewOnceMessageV2?.message;
    const v2ext = obj?.viewOnceMessageV2Extension?.message;
    return v1 || v2 || v2ext || obj;
  };

  if (m.message) {
    // Detect type
    m.type = getContentType(m.message);

    // Unwrap view-once (v1/v2/v2ext) for msg
    const inner = unwrapAnyViewOnce(
      m.type === "viewOnceMessage" ||
        m.type === "viewOnceMessageV2" ||
        m.type === "viewOnceMessageV2Extension"
        ? m.message[m.type]
        : m.message,
    );

    const innerType = getContentType(inner);
    m.msg = inner?.[innerType] || m.message[m.type];

    // If view-once, normalize type
    if (
      m.type === "viewOnceMessage" ||
      m.type === "viewOnceMessageV2" ||
      m.type === "viewOnceMessageV2Extension"
    ) {
      m.type = innerType; // ✅ normalize
    }

    // Context info
    const ctx = m.msg?.contextInfo || {};
    let mentioned =
      typeof ctx.mentionedJid === "string"
        ? [ctx.mentionedJid]
        : ctx.mentionedJid || [];

    if (ctx.participant) mentioned.push(ctx.participant);
    m.mentionUser = mentioned.filter((x) => x);

    // QUOTED
    m.quoted = ctx.quotedMessage ? Object.assign({}, ctx.quotedMessage) : null;

    if (m.quoted) {
      // unwrap quoted view-once too
      const qInner = unwrapAnyViewOnce(m.quoted);
      const qType = getContentType(qInner);

      m.quoted.type = qType;
      m.quoted.msg = qInner?.[qType];

      m.quoted.id = ctx.stanzaId;
      m.quoted.sender = ctx.participant;
      m.quoted.fromMe = (m.quoted.sender || "").includes(
        conn.user.id.split(":")[0],
      );

      m.quoted.fakeObj = proto.WebMessageInfo.fromObject({
        key: {
          remoteJid: m.chat,
          fromMe: m.quoted.fromMe,
          id: m.quoted.id,
          participant: m.quoted.sender,
        },
        message: m.quoted,
      });

      m.quoted.download = () => downloadMediaMessage(m.quoted);
      m.quoted.delete = () =>
        conn.sendMessage(m.chat, { delete: m.quoted.fakeObj.key });
      m.quoted.react = (emoji) =>
        conn.sendMessage(m.chat, {
          react: { text: emoji, key: m.quoted.fakeObj.key },
        });
    }

    m.download = () => downloadMediaMessage(m);
  }

  // ----- SHORTCUT FUNCTIONS -----
  m.reply = (txt, id = m.chat, opt = { mentions: [m.sender] }) =>
    conn.sendMessage(
      id,
      { text: txt, contextInfo: { mentionedJid: opt.mentions } },
      { quoted: m },
    );

  m.replyImg = (img, txt, id = m.chat) =>
    conn.sendMessage(id, { image: img, caption: txt }, { quoted: m });

  m.replyVid = (vid, txt, id = m.chat) =>
    conn.sendMessage(id, { video: vid, caption: txt }, { quoted: m });

  m.replyAud = (aud, id = m.chat, ptt = false) =>
    conn.sendMessage(
      id,
      { audio: aud, ptt, mimetype: "audio/mpeg" },
      { quoted: m },
    );

  m.react = (emoji) =>
    conn.sendMessage(m.chat, {
      react: { text: emoji, key: m.key },
    });

  return m;
};
