import {
  proto,
  downloadContentFromMessage,
  getContentType,
} from "@whiskeysockets/baileys";

import fs from "fs";

// -------------------- DOWNLOAD MEDIA --------------------
export const downloadMediaMessage = async (m, filename) => {
  if (m.type === "viewOnceMessage") {
    m.type = m.msg.type;
  }

  const typeMap = {
    imageMessage: "image",
    videoMessage: "video",
    audioMessage: "audio",
    stickerMessage: "sticker",
    documentMessage: "document",
  };

  const downloadType = typeMap[m.type];
  if (!downloadType) return null;

  const extMap = {
    imageMessage: "jpg",
    videoMessage: "mp4",
    audioMessage: "mp3",
    stickerMessage: "webp",
  };

  const ext =
    m.type === "documentMessage"
      ? m.msg.fileName.split(".").pop().toLowerCase()
      : extMap[m.type];

  const fileName = filename ? `${filename}.${ext}` : `undefined.${ext}`;

  const stream = await downloadContentFromMessage(m.msg, downloadType);
  let buffer = Buffer.from([]);

  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }

  fs.writeFileSync(fileName, buffer);
  return fs.readFileSync(fileName);
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
  } // MESSAGE CONTENT

  if (m.message) {
    m.type = getContentType(m.message);
    m.msg =
      m.type === "viewOnceMessage"
        ? m.message[m.type].message[getContentType(m.message[m.type].message)]
        : m.message[m.type]; // HANDLE VIEW ONCE

    if (m.type === "viewOnceMessage") {
      m.msg.type = getContentType(m.message[m.type].message);
    } // MENTIONS // ⚠️ FIX: Use optional chaining to safely access contextInfo

    const ctx = m.msg?.contextInfo || {};
    let mentioned =
      typeof ctx.mentionedJid === "string"
        ? [ctx.mentionedJid]
        : ctx.mentionedJid || [];

    if (ctx.participant) mentioned.push(ctx.participant);
    m.mentionUser = mentioned.filter((x) => x); // BODY TEXT

    m.quoted = ctx.quotedMessage ? Object.assign({}, ctx.quotedMessage) : null;

    if (m.quoted) {
      m.quoted.type = getContentType(m.quoted);
      m.quoted.id = ctx.stanzaId;
      m.quoted.sender = ctx.participant;
      m.quoted.fromMe = m.quoted.sender.includes(conn.user.id.split(":")[0]);

      m.quoted.msg =
        m.quoted.type === "viewOnceMessage"
          ? m.quoted[m.quoted.type].message[
              getContentType(m.quoted[m.quoted.type].message)
            ]
          : m.quoted[m.quoted.type]; // DOWNLOAD / REACT / DELETE for quoted

      m.quoted.fakeObj = proto.WebMessageInfo.fromObject({
        key: {
          remoteJid: m.chat,
          fromMe: m.quoted.fromMe,
          id: m.quoted.id,
          participant: m.quoted.sender,
        },
        message: m.quoted,
      });

      m.quoted.download = (f) => downloadMediaMessage(m.quoted, f);
      m.quoted.delete = () =>
        conn.sendMessage(m.chat, { delete: m.quoted.fakeObj.key });
      m.quoted.react = (emoji) =>
        conn.sendMessage(m.chat, {
          react: { text: emoji, key: m.quoted.fakeObj.key },
        });
    }

    m.download = (f) => downloadMediaMessage(m, f);
  } // ----- CUSTOM SHORTCUT FUNCTIONS -----

  m.reply = (txt, id = m.chat, opt = { mentions: [m.sender] }) =>
    conn.sendMessage(
      id,
      { text: txt, contextInfo: { mentionedJid: opt.mentions } },
      { quoted: m }
    );

  m.replyImg = (img, txt, id = m.chat) =>
    conn.sendMessage(id, { image: img, caption: txt }, { quoted: m });

  m.replyVid = (vid, txt, id = m.chat) =>
    conn.sendMessage(id, { video: vid, caption: txt }, { quoted: m });

  m.replyAud = (aud, id = m.chat, ptt = false) =>
    conn.sendMessage(
      id,
      { audio: aud, ptt, mimetype: "audio/mpeg" },
      { quoted: m }
    );

  m.react = (emoji) =>
    conn.sendMessage(m.chat, {
      react: { text: emoji, key: m.key },
    });

  return m;
};
