import mongo from "../mongoConn.js";
import config from "../../config.js";

const COLLECTION = "messages";
let ttlEnsured = false;

async function getCollection() {
  const db = await mongo.getDb(config.DB_NAME);
  const col = db.collection(COLLECTION);

  // Ensure TTL index only once
  if (!ttlEnsured) {
    await col.createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: 60 * 60 * 24 * 3 }, // 24 hours
    );

    ttlEnsured = true;
    console.log("⏳ Status TTL ensured 3days");
  }

  return col;
}

// 🔥 Restore Mongo Binary → real Buffer
function restoreBuffers(obj) {
  if (!obj || typeof obj !== "object") return obj;

  for (const key in obj) {
    const value = obj[key];

    // Old Mongo $binary format
    if (
      value &&
      typeof value === "object" &&
      value.$binary &&
      value.$binary.base64
    ) {
      obj[key] = Buffer.from(value.$binary.base64, "base64");
    }

    // New BSON Binary format
    else if (value && value._bsontype === "Binary" && value.buffer) {
      obj[key] = Buffer.from(value.buffer);
    } else if (typeof value === "object") {
      restoreBuffers(value);
    }
  }

  return obj;
}

export async function saveMessage(mek) {
  const col = await getCollection();

  await col.updateOne(
    { messageId: mek.key.id },
    { $set: { ...mek, messageId: mek.key.id, timestamp: new Date() } },
    { upsert: true },
  );
}

export async function getMessageById(messageId) {
  const col = await getCollection();
  const msg = await col.findOne({ messageId });

  if (!msg) return null;

  return restoreBuffers(msg); // 🔥 THIS FIXES YOUR DECRYPT ERROR
}
