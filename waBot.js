import makeWASocket, {
  DisconnectReason,
  Browsers,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import P from "pino";
import path from "path";
import { fileURLToPath } from "url";
import { loadPlugins } from "./lib/loader.js";
import { useMongoDBAuthState } from "./lib/auth/mongoAuth.js"; // your mongo auth file
import config from "./config.js";
import { handleMessage } from "./messageHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const number = config.BOT_NUMBER;

let plugins = {};
let pairingRequested = false;

export async function connectToWA() {
  console.log("Connecting WhatsApp bot 🧬...");

  // Use MongoDB for auth state
  const { state, saveCreds } = await useMongoDBAuthState(
    config.MONGODB_URI, // your MongoDB URI
    config.DB_NAME // optional: database name
  );

  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    syncFullHistory: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })),
    },
    version,
    qrTimeout: 0,
    getMessage: async () => ({ conversation: "" }),
    markOnlineOnConnect: true,
  });

  conn.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !pairingRequested) {
      pairingRequested = true;
      try {
        const code = await conn.requestPairingCode(number);
        console.log("Pairing code:", code.slice(0, 4) + "-" + code.slice(4));
      } catch (e) {
        console.log("❌ Pairing code error:", e.message);
      }
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (lastDisconnect?.error?.output?.statusCode === 401) {
        console.log("⚠️ Auth failed! Check MongoDB creds & restart");
      } else if (shouldReconnect) {
        pairingRequested = false;
        console.log("🔄 Reconnecting in 3s...");
        setTimeout(connectToWA, 3000);
      } else {
        console.log("❌ Logged out.");
      }
    }

    if (connection === "open") {
      console.log("✅ Bot connected");
      conn.sendMessage(conn.user.id, {
        text: "🤖 Streamline-MD-V2 Bot connected!",
      });

      plugins = await loadPlugins();
      console.log("🔌 Plugins loaded:", Object.keys(plugins).length);
    }
  });

  conn.ev.on("creds.update", saveCreds);

  conn.ev.on("messages.upsert", async ({ messages }) => {
    const mek = messages[0];
    if (!mek?.message) return;

    // ignore status
    if (mek.key?.remoteJid === "status@broadcast") return;

    try {
      await handleMessage(conn, mek, [
        config.OWNER_NUMBERS, // or array of owners
      ]);
    } catch (err) {
      console.error("[HANDLER ERROR]", err);
    }
  });

  return conn;
}
