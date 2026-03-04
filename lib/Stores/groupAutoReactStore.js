import mongo from "../mongoConn.js";
import config from "../../config.js";

const COLLECTION = "group_auto_reacts";

async function getCollection() {
  const db = await mongo.getDb(config.DB_NAME);
  return db.collection(COLLECTION);
}

// Get group settings
export async function getGroupAutoReact(jid) {
  const col = await getCollection();
  return await col.findOne({ jid });
}

// Enable/disable auto-react for a group
export async function setGroupAutoReactEnabled(jid, enabled) {
  const col = await getCollection();
  const group = await getGroupAutoReact(jid);
  if (!group)
    return await col.insertOne({
      jid,
      enabled,
      emojis: [],
      createdAt: new Date(),
    });
  return await col.updateOne({ jid }, { $set: { enabled } });
}

// Set the emoji list for a group
export async function setGroupEmojis(jid, emojis) {
  const col = await getCollection();
  const group = await getGroupAutoReact(jid);
  if (!group)
    return await col.insertOne({
      jid,
      enabled: true,
      emojis,
      createdAt: new Date(),
    });
  return await col.updateOne({ jid }, { $set: { emojis } });
}

// Utility: get random emoji
export function getRandomEmoji(emojis) {
  return emojis[Math.floor(Math.random() * emojis.length)];
}
