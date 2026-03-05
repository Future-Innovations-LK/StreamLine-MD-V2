import fetch from "node-fetch";
import os from "os";
import process from "process";

import gifted from "gifted-btns";
const { sendButtons } = gifted;
import brand from "../lib/Config/brand.js";

/* =========================
   CONFIG
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
  alias: ["a"],
  disc: "Check if the bot is alive",
  category: "Main",
  react: "⚡",

  function: async (conn, mek, m, ctx) => {
    const targetJid = getTargetJid(mek, ctx);

    const t0 = Date.now();
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

    const aliveImg =
      brand?.branding?.aliveImage ||
      brand?.branding?.menuImage ||
      UI.fallbackAliveImage;

    await sendButtons(conn, targetJid, {
      title: "⚡ BOT STATUS",
      text: caption,
      footer: UI.footer,
      image: { url: aliveImg },
      aimode: true,

      buttons: [
        {
          id: "alive",
          text: "✅ Alive",
        },
        {
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "🌐 Visit Future Innovations",
            url: "https://futureinnovations.lk",
          }),
        },
      ],
    });
  },
};
