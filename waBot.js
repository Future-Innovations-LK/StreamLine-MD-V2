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

// =====================================================
// PATH SETUP
// =====================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const number = config.BOT_NUMBER;

let plugins = {};
let pairingRequested = false;

// =====================================================
// MASSIVE EMOJI POOL
// =====================================================
const STATUS_REACTS = [
  "❤️","💙","💚","💛","💜","🧡","🩷","🩵","🤍","🤎","💖","💘","💝","💗","💓","💞","💟",
  "😍","🥰","😘","🔥","💯","✨","⚡","🌟","🫶","🙌","👏","😎","🤯","😮","🤩","🤝","👌","👍",
  "💥","🎉","🕺","💃","😂","🤣","😹","😆","😄","😁","😅","😊","🙂","😸","😜","🤪","🤭",
  "👀","😳","😱","🤔","😏","😌","😴","🥹","😋","😶‍🌫️","😐","😑","🙃","😬","🫣","🤗",
  "🌈","🌸","🌼","🌻","🍀","🎨","📸","🎬","🎧","🎶","🍿","☕","🛸","🚀","🐾","🦋",
  "😈","👻","💀","🤡","💩","👽","🫠","🫥","🤖","🎯",
];

function getRandomReact() {
  return STATUS_REACTS[Math.floor(Math.random() * STATUS_REACTS.length)];
}

// =====================================================
// MAIN CONNECT FUNCTION
// =====================================================
export async function connectToWA() {
  console.log("Connecting WhatsApp bot 🧬...");

  const { state, saveCreds } = await useMongoDBAuthState(
    config.MONGODB_URI,
    config.DB_NAME
  );

  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    syncFullHistory: false,
    markOnlineOnConnect: true,

    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })),
    },

    version,
    qrTimeout: 0,
    getMessage: async () => ({ conversation: "" }),
  });

  // =====================================================
  // CONNECTION HANDLER
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
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      if (statusCode === 401) {
        console.log("⚠️ Auth failed. Re-login required.");
      } else if (statusCode !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnecting in 3 seconds...");
        pairingRequested = false;
        setTimeout(connectToWA, 3000);
      } else {
        console.log("❌ Logged out from WhatsApp.");
      }
    }
  });

  conn.ev.on("creds.update", saveCreds);

  // =====================================================
  // MESSAGE HANDLER
  // =====================================================
  conn.ev.on("messages.upsert", async ({ messages }) => {
    const mek = messages?.[0];
    if (!mek?.key || !mek?.message) return;

    // ✅ DO NOT block fromMe messages (fixes commands)
    // if (mek.key.fromMe) return; ❌ NEVER enable for self bots

    // Ignore reactions only
    if (mek.message.reactionMessage) return;

    const jid = mek.key.remoteJid;
    const sender = mek.key.participant || jid;

    // =====================================================
    // STATUS AUTO REACTION
    // =====================================================
    if (jid === "status@broadcast") {
      try {
        if (
          mek.message?.imageMessage ||
          mek.message?.videoMessage ||
          mek.message?.extendedTextMessage
        ) {
          // mark as read
          await conn.readMessages([mek.key]);

          // human delay
          await new Promise((r) => setTimeout(r, 3000));

          await conn.sendMessage(sender, {
            react: {
              text: getRandomReact(),
              key: mek.key,
            },
          });
        }
      } catch {}
      return;
    }

    // =====================================================
    // NORMAL CHAT HANDLING (COMMANDS ✅)
    // =====================================================
    try {
      await handleMessage(conn, mek, config.OWNER_NUMBERS);
    } catch (err) {
      console.error("❌ [HANDLER ERROR]", err);
    }
  });

  return conn;
}
