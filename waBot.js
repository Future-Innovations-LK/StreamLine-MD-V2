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

import { getAutoReplies } from "./lib/Stores/autoReplyStore.js";
import { getAutoReacts } from "./lib/Stores/autoReactStore.js";
import { saveMessage, getMessageById } from "./lib/Stores/messageStore.js";

import { handleDeletedMessage } from "./lib/helpers/antidelete.js";
import { saveStatus } from "./lib/Stores/statusStore.js";
import {
  getGroupAutoReact,
  getRandomEmoji,
} from "./lib/Stores/groupAutoReactStore.js";

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

const getRandomReact = () =>
  STATUS_REACTS[Math.floor(Math.random() * STATUS_REACTS.length)];

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
    syncFullHistory: true,
    shouldSyncHistoryMessage: () => true,

    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })),
    },

    version,
    qrTimeout: 0,
    getMessage: async () => ({ conversation: "" }),
  });

  // =====================================================
  // ✅ BLANK MESSAGE BLOCKER (NEW)
  // =====================================================
  const _sendMessage = conn.sendMessage.bind(conn);

  conn.sendMessage = async (jid, content = {}, options = {}) => {
    try {
      // normalize text
      if (typeof content?.text === "string") {
        const t = content.text.trim();
        if (!t) {
          console.log("🚫 Blocked blank text message", { jid });
          return;
        }
        content.text = t;
      }

      // normalize conversation
      if (typeof content?.conversation === "string") {
        const t = content.conversation.trim();
        if (!t) {
          console.log("🚫 Blocked blank conversation message", { jid });
          return;
        }
        content.conversation = t;
      }

      // block empty payloads
      if (!content || Object.keys(content).length === 0) {
        console.log("🚫 Blocked empty payload sendMessage()", { jid });
        return;
      }

      return await _sendMessage(jid, content, options);
    } catch (err) {
      console.log("❌ sendMessage wrapper error:", err);
      return _sendMessage(jid, content, options);
    }
  };

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
  // CALL HANDLER
  // =====================================================
  conn.ev.on("call", async (callEvents) => {
    const settings = await loadSettings();
    if (!settings.autoRejectCalls) return;

    for (const call of callEvents) {
      if (call.status !== "offer") continue;

      try {
        await conn.sendMessage(call.from, {
          text: "⚡ STREAM LINE MD (V2) ⚡\n\nCalls aren’t supported 😿\nSend a message instead 💬",
        });

        await conn.rejectCall(call.id, call.from);
      } catch (err) {
        console.error("❌ [CALL HANDLER ERROR]", err);
      }
    }
  });

  // =====================================================
  // MESSAGE HANDLER
  // =====================================================
  const processedMessages = new Set();

  conn.ev.on("messages.upsert", async ({ messages }) => {
    const mek = messages?.[0];
    if (!mek?.message) return;
    if (mek.message.reactionMessage) return;

    const messageId = mek.key.id;

    if (processedMessages.has(messageId)) return;
    processedMessages.add(messageId);

    setTimeout(() => processedMessages.delete(messageId), 60000);

    const jid = mek.key.remoteJid;
    const sender = mek.key.participant || jid;

    await saveMessage(mek);

    const settings = await loadSettings();

    if (!settings.botEnabled) {
      await handleBootCommand(conn, mek);
      return;
    }

    // deleted message
    if (mek.message?.protocolMessage?.type === 0) {
      await handleDeletedMessage({
        conn,
        mek,
        getMessageById,
        jidNormalizedUser,
      });
    }

    // STATUS
    if (jid === "status@broadcast") {
      await saveStatus(mek);

      if (settings.autoReadStatus) await conn.readMessages([mek.key]);

      if (settings.autoReactStatus) {
        await delay(settings.reactDelayMs || 3000);
        await conn.sendMessage(sender, {
          react: { text: getRandomReact(), key: mek.key },
        });
      }
      return;
    }

    if (jid.endsWith("@g.us")) {
      const group = await getGroupAutoReact(jid);
      if (group?.enabled && group?.emojis?.length) {
        const emoji = getRandomEmoji(group.emojis);
        await conn.sendMessage(jid, {
          react: { text: emoji, key: mek.key },
        });
      }
    }

    // TEXT EXTRACT
    let text = "";
    if (mek.message.conversation) text = mek.message.conversation;
    else if (mek.message.extendedTextMessage?.text)
      text = mek.message.extendedTextMessage.text;
    else if (mek.message.imageMessage?.caption)
      text = mek.message.imageMessage.caption;
    else if (mek.message.videoMessage?.caption)
      text = mek.message.videoMessage.caption;

    if (!text.trim()) return;

    const handled = await handleMessage(conn, mek, config.OWNER_NUMBERS);
    if (handled || mek.key.fromMe) return;

    // AUTO REPLIES
    if (!jid.endsWith("@g.us")) {
      const autoReplies = await getAutoReplies();
      const pushname = mek.pushName || "Friend";

      const match = autoReplies.find((r) =>
        text.toLowerCase().startsWith(r.trigger.toLowerCase()),
      );

      if (match) {
        await conn.sendPresenceUpdate("composing", jid);
        await delay(1000);

        const replyText = match.reply.replace(/\$\{pushname\}/g, pushname);

        await conn.sendMessage(jid, { text: replyText });
        await conn.sendPresenceUpdate("paused", jid);
      }
    }

    // AUTO REACT
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
