// /commands/ping.js
import fetch from "node-fetch";
import os from "os";
import process from "process";

import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto,
} from "@whiskeysockets/baileys";

//import bail from "@future-innovations-lk/baileys";
import brand from "../lib/Config/brand.js";

//const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = bail;

/* =========================
   CONFIG 🧾✨
========================= */
const UI = {
  footer: "Future Innovations LK 🛸",
  credit: "Made by Pavantha ✨",
  fallbackAliveImage:
    "https://assets.futureinnovations.lk/streamlinemdv2/alive.png",
};

/* =========================
   HELPERS
========================= */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatUptime(sec) {
  sec = Math.floor(sec);
  const s = sec % 60;
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor((sec / 3600) % 24);
  const d = Math.floor(sec / 86400);

  if (d > 0) return `${d}d ${pad2(h)}h ${pad2(m)}m ${pad2(s)}s`;
  return `${h}h ${pad2(m)}m ${pad2(s)}s`;
}

function getTargetJid(mek, ctx) {
  const remote = mek?.key?.remoteJid || "";
  const isGroup = remote.endsWith("@g.us");
  return (
    (isGroup ? remote : null) ||
    mek?.key?.senderLid ||
    mek?.key?.remoteJidAlt ||
    remote ||
    ctx?.from
  );
}

function getBotMeta(ctx) {
  const botName =
    brand?.branding?.botName || process.env.BOT_NAME || "StreamLine MD V2";

  const botNumber =
    brand?.branding?.botNumber ||
    process.env.BOT_NUMBER ||
    (ctx?.botJid ? String(ctx.botJid).split("@")[0] : "Unknown");

  return { botName, botNumber };
}

async function fetchImageBuffer(url) {
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Image fetch failed: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function buildImageMedia(conn, imageUrl) {
  const imgBuf = await fetchImageBuffer(imageUrl);
  return prepareWAMessageMedia(
    { image: imgBuf },
    { upload: conn.waUploadToServer },
  );
}

function buildQuotedContact() {
  // same "quoted vcard trick" vibe as your menu
  return {
    stanzaId: "FAKE_META_ID_ALIVE_001",
    participant: "13135550002@s.whatsapp.net",
    remoteJid: "status@broadcast",
    quotedMessage: {
      contactMessage: {
        displayName: "⚡ BOT STATUS ⚡",
        vcard:
          "BEGIN:VCARD\n" +
          "VERSION:3.0\n" +
          "N:StreamLine;;;;\n" +
          "FN:StreamLine MD V2\n" +
          "TEL;waid=13135550002:+1 313 555 0002\n" +
          "END:VCARD",
      },
    },
  };
}

function getMyUserJid(conn) {
  const myLid = conn?.authState?.creds?.me?.lid || conn?.user?.lid || null;
  return myLid ? `${myLid}@lid` : conn?.user?.id;
}

function buildAliveCaption({ botName, botNumber, host, uptime, ping }) {
  return (
    `✅ *${botName}* is *ALIVE* ⚡\n\n` +
    `📞 *Bot:* ${botNumber}\n` +
    `🖥️ *Host:* ${host}\n` +
    `⏱️ *Uptime:* ${uptime}\n` +
    `⚡ *Speed:* ${ping}s\n\n` +
    `💠 ${UI.credit}`
  );
}

/* =========================
   COMMAND
========================= */
export default {
  pattern: "alive",
  alias: ["a", "ping"],
  disc: "Check if the bot is alive",
  category: "Main",
  react: "⚡",

  function: async (conn, mek, m, ctx) => {
    const targetJid = getTargetJid(mek, ctx);

    // measure "ping" as handler response time
    const t0 = Date.now();

    // optional: show instant feedback (not required)
    // await conn.sendMessage(targetJid, { text: "⚡ Checking..." }, { quoted: mek });

    const ping = ((Date.now() - t0) / 1000).toFixed(2);

    const { botName, botNumber } = getBotMeta(ctx);
    const host = os.hostname();
    const uptime = formatUptime(process.uptime());

    const caption = buildAliveCaption({
      botName,
      botNumber,
      host,
      uptime,
      ping,
    });

    // alive image: use brand first, else fallback
    const aliveImg =
      brand?.branding?.aliveImage ||
      brand?.branding?.menuImage || // fallback to menu image if you want
      UI.fallbackAliveImage;

    // build image media (safe fallback)
    let media;
    try {
      media = await buildImageMedia(conn, aliveImg);
    } catch {
      media = { imageMessage: {} };
    }

    const content = proto.Message.fromObject({
      viewOnceMessage: {
        message: {
          buttonsMessage: {
            imageMessage: {
              ...media.imageMessage,
              caption,
              viewOnce: true,
              contextInfo: buildQuotedContact(),
            },
            contentText: caption,
            footerText: UI.footer,
            headerType: 4,
            buttons: [
              {
                buttonId: "noop",
                buttonText: { displayText: "✅ Alive" },
                type: 1,
              },
            ],
          },
        },
      },
    });

    const msg = generateWAMessageFromContent(targetJid, content, {
      userJid: getMyUserJid(conn),
      quoted: mek,
    });

    await conn.relayMessage(targetJid, msg.message, { messageId: msg.key.id });
  },
};
