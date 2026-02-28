// lib/messageStore.js
import mongo from "./mongoConn.js";
import config from "../config.js";

const COLLECTION = "messages";

async function getCollection() {
  const db = await mongo.getDb(config.DB_NAME);
  return db.collection(COLLECTION);
}

function extractText(mek) {
  if (mek.message?.conversation) return mek.message.conversation;
  if (mek.message?.extendedTextMessage?.text)
    return mek.message.extendedTextMessage.text;
  return null;
}

export async function saveMessage(mek) {
  const col = await getCollection();

  const text = extractText(mek);
  if (!text) return;

  await col.insertOne({
    messageId: mek.key.id,
    jid: mek.key.remoteJid,
    sender: mek.key.participant || mek.key.remoteJid,
    text,
    timestamp: new Date(),
  });
}

export async function getMessageById(messageId) {
  const col = await getCollection();
  return await col.findOne({ messageId });
}
