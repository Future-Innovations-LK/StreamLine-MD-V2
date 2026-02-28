import makeWASocket, {
  DisconnectReason,
  Browsers,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
} from "@whiskeysockets/baileys";

import P from "pino";
import path from "path";
import { fileURLToPath } from "url";

import { loadPlugins } from "./lib/loader.js";
import { useMongoDBAuthState } from "./lib/auth/mongoAuth.js";
import config from "./config.js";
import { handleMessage } from "./messageHandler.js";
import { getSettings } from "./lib/settings.js";
import { handleBootCommand } from "./lib/bootHandler.js";

import { getAutoReplies } from "./lib/autoReplyStore.js";
import { getAutoReacts } from "./lib/autoReactStore.js";
import { saveMessage, getMessageById } from "./lib/messageStore.js";

// =====================================================
// FILE PATH
// =====================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const number = config.BOT_NUMBER;

let plugins = {};
let pairingRequested = false;

// =====================================================
// SETTINGS CACHE
// =====================================================
let cachedSettings = null;
let lastSettingsLoad = 0;

async function loadSettings() {
  const now = Date.now();
  if (!cachedSettings || now - lastSettingsLoad > 5000) {
    cachedSettings = await getSettings();
    lastSettingsLoad = now;
  }
  return cachedSettings;
}

// =====================================================
// HELPERS
// =====================================================
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// =====================================================
// EMOJI POOL
// =====================================================
const STATUS_REACTS = [
  "❤️",
  "💙",
  "💚",
  "💛",
  "💜",
  "🧡",
  "🩷",
  "🩵",
  "🤍",
  "🤎",
  "💖",
  "💘",
  "💝",
  "💗",
  "💓",
  "💞",
  "💟",
  "😍",
  "🥰",
  "😘",
  "🔥",
  "💯",
  "✨",
  "⚡",
  "🌟",
  "🫶",
  "🙌",
  "👏",
  "😎",
  "🤯",
];

function getRandomReact() {
  return STATUS_REACTS[Math.floor(Math.random() * STATUS_REACTS.length)];
}

// =====================================================
// WA CONNECTOR
// =====================================================
export async function connectToWA() {
  console.log("🧬 Connecting WhatsApp bot...");

  const { state, saveCreds } = await useMongoDBAuthState(
    config.MONGODB_URI,
    config.DB_NAME,
  );

  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    markOnlineOnConnect: true,
    syncFullHistory: false,

    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })),
    },

    version,
    qrTimeout: 0,
    getMessage: async () => ({ conversation: "" }),
  });

  // =====================================================
  // CONNECTION LISTENER
  // =====================================================
  conn.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !pairingRequested) {
      pairingRequested = true;
      try {
        const code = await conn.requestPairingCode(number);
        console.log("🔗 Pairing Code:", code.slice(0, 4) + "-" + code.slice(4));
      } catch (e) {
        console.log("❌ Pairing failed:", e.message);
      }
    }

    if (connection === "open") {
      const botJid = jidNormalizedUser(conn.user.id);
      console.log("✅ Bot Connected");

      await conn.sendMessage(botJid, {
        text: "🤖 Streamline-MD-V2 connected successfully!",
      });

      plugins = await loadPlugins();
      console.log("🔌 Plugins loaded:", Object.keys(plugins).length);

      // ────────────────────────────────────────────────
      //   MIRROR TYPING IN PRIVATE CHATS
      // ────────────────────────────────────────────────
      conn.ev.on("presence.update", async ({ id, presences }) => {
        if (id.endsWith("@g.us") || id === "status@broadcast") return;

        for (const [participant, presence] of Object.entries(presences)) {
          if (participant === conn.user?.id) continue;

          if (presence.lastKnownPresence === "composing") {
            try {
              await conn.presenceSubscribe(id);
              await conn.sendPresenceUpdate("composing", id);
              setTimeout(
                async () => {
                  try {
                    await conn.sendPresenceUpdate("paused", id);
                  } catch {}
                },
                4000 + Math.random() * 3000,
              );
            } catch (err) {
              console.log("[typing mirror error]", err.message);
            }
          }
        }
      });

      console.log("👀 Typing mirror enabled for private chats");
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;

      if (code === 401) {
        console.log("⚠️ Auth failed — login again.");
      } else if (code !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnecting in 3 seconds...");
        pairingRequested = false;
        setTimeout(connectToWA, 3000);
      } else {
        console.log("❌ Logged out of WhatsApp.");
      }
    }
  });

  conn.ev.on("creds.update", saveCreds);

  // =====================================================
  // CALL HANDLER (ANTI-CALL)
  // =====================================================
  conn.ev.on("call", async (callEvents) => {
    const settings = await loadSettings();
    if (!settings.autoRejectCalls) return;

    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const randomInt = (min, max) =>
      Math.floor(Math.random() * (max - min + 1)) + min;

    const getPushName = (jid) => {
      const contact =
        conn?.contacts?.[jid] ||
        conn?.contacts?.get?.(jid) ||
        conn?.store?.contacts?.[jid] ||
        conn?.store?.contacts?.get?.(jid);
      return contact?.notify || contact?.name || contact?.verifiedName || null;
    };

    for (const call of callEvents) {
      if (call.status !== "offer") continue;

      const jid = call.from;
      const name = getPushName(jid) || "bestie";

      const delayMs = randomInt(1000, 4000);
      const brandLine = "⚡ 𝘚𝘛𝘙𝘌𝘈𝘔 𝘓𝘐𝘕𝘌 𝘔𝐃 (𝘝2) ⚡";
      const cuteMsg = `${brandLine}\n\nHey ${name} ✨\nCalls aren’t supported right now 😿\nBut you can totally drop me a text and I’ll reply super fast 💬⚡\n\nThanks for understanding 🫶`;

      try {
        await conn.sendMessage(jid, { text: cuteMsg });
        await sleep(delayMs);
        await conn.rejectCall(call.id, jid);
        console.log(`🚫 Call rejected from: ${jid} (delay ${delayMs}ms)`);
      } catch (err) {
        console.error("❌ [CALL HANDLER ERROR]", err);
      }
    }
  });

  const processedMessages = new Set();

  conn.ev.on("messages.upsert", async ({ messages }) => {
    const mek = messages?.[0];
    if (!mek?.message) return;
    if (mek.message.reactionMessage) return;
    console.log(mek);
    const messageId = mek.key.id;

    // ==============================
    // 🔒 ADVANCED MESSAGE ID PROTECTION
    // ==============================
    if (processedMessages.has(messageId)) return;
    processedMessages.add(messageId);

    // Auto-clean memory after 60s
    setTimeout(() => {
      processedMessages.delete(messageId);
    }, 60000);

    const jid = mek.key.remoteJid;
    const sender = mek.key.participant || jid;

    await saveMessage(mek);

    const settings = await loadSettings();

    if (!settings.botEnabled) {
      const handled = await handleBootCommand(conn, mek);
      if (handled) return;
      return;
    }

    // ==============================
    // ❌ DELETED MESSAGE HANDLER
    // ==============================
    if (mek.message?.protocolMessage?.type === 0) {
      const deletedKey = mek.message.protocolMessage.key;
      const deletedMsg = await getMessageById(deletedKey.id);

      if (deletedMsg) {
        await conn.sendMessage(jid, {
          text: `👀 Message deleted!\n\nSender: ${deletedMsg.sender}\nMessage: ${deletedMsg.text}`,
        });
      }
      return;
    }

    // ==============================
    // 📌 STATUS HANDLER
    // ==============================
    if (jid === "status@broadcast") {
      try {
        if (settings.autoReadStatus) await conn.readMessages([mek.key]);

        if (settings.autoReactStatus) {
          await delay(settings.reactDelayMs || 3000);
          await conn.sendMessage(sender, {
            react: { text: getRandomReact(), key: mek.key },
          });
        }
      } catch (err) {
        console.error("❌ [STATUS ERROR]", err);
      }
      return;
    }

    // ==============================
    // 📝 EXTRACT TEXT
    // ==============================
    let text = "";
    if (mek.message.conversation) text = mek.message.conversation;
    else if (mek.message.extendedTextMessage?.text)
      text = mek.message.extendedTextMessage.text;
    else if (mek.message.imageMessage?.caption)
      text = mek.message.imageMessage.caption;
    else if (mek.message.videoMessage?.caption)
      text = mek.message.videoMessage.caption;

    if (!text.trim()) return;

    // ==============================
    // 🔥 COMMAND FIRST
    // ==============================
    const handled = await handleMessage(conn, mek, config.OWNER_NUMBERS);
    if (handled) return;
    if (mek.key.fromMe) return;

    // ==============================
    // 💬 AUTO REPLIES
    // ==============================
    if (!jid.endsWith("@g.us")) {
      const autoReplies = await getAutoReplies();
      const pushname = mek.pushName || "Friend";

      const match = autoReplies.find((r) =>
        text.toLowerCase().startsWith(r.trigger.toLowerCase()),
      );

      if (match) {
        await conn.sendPresenceUpdate("composing", jid);
        await delay(1000);

        // Replace ${pushname} in the reply text with the actual sender name
        const replyText = match.reply.replace(/\$\{pushname\}/g, pushname);

        await conn.sendMessage(jid, { text: replyText });
        await conn.sendPresenceUpdate("paused", jid);
      }
    }

    // ==============================
    // 😎 AUTO REACT
    // ==============================
    const autoReacts = await getAutoReacts();
    const reactMatch = autoReacts.find((r) =>
      text.toLowerCase().startsWith(r.trigger.toLowerCase()),
    );

    if (reactMatch) {
      await conn.sendMessage(jid, {
        react: { text: reactMatch.emoji, key: mek.key },
      });
    }
  });
  return conn;
}
