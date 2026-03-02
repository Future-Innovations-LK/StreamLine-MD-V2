// lib/statusStore.js
import mongo from "../mongoConn.js";
import config from "../../config.js";

const COLLECTION_NAME = "statuses";
let ttlEnsured = false;

// ==============================
// GET COLLECTION
// ==============================
async function getCollection() {
  const db = await mongo.getDb(config.DB_NAME);
  const col = db.collection(COLLECTION_NAME);

  // Ensure TTL index only once
  if (!ttlEnsured) {
    await col.createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: 60 * 60 * 24 }, // 24 hours
    );

    ttlEnsured = true;
    console.log("⏳ Status TTL ensured (24h)");
  }

  return col;
}

// ==============================
// SAVE STATUS
// ==============================
export async function saveStatus(mek) {
  try {
    const col = await getCollection();

    await col.updateOne(
      { messageId: mek.key.id },
      {
        $set: {
          messageId: mek.key.id,
          sender: mek.key.participant || mek.key.remoteJid,
          message: mek.message,
          type: Object.keys(mek.message || {})[0],
          timestamp: new Date(),
        },
      },
      { upsert: true },
    );
  } catch (err) {
    console.log("❌ Status save error:", err.message);
  }
}

// ==============================
// GET ALL STATUSES
// ==============================
export async function getAllStatuses(limit = 50) {
  const col = await getCollection();

  return await col.find({}).sort({ timestamp: -1 }).limit(limit).toArray();
}

// ==============================
// GET STATUS BY ID
// ==============================
export async function getStatusById(messageId) {
  const col = await getCollection();
  return await col.findOne({ messageId });
}

// ==============================
// DELETE STATUS MANUALLY
// ==============================
export async function deleteStatus(messageId) {
  const col = await getCollection();
  await col.deleteOne({ messageId });
}
