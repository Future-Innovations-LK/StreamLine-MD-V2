// lib/autoReplyStore.js
import mongo from "./mongoConn.js";
import config from "../config.js";

const COLLECTION = "auto_replies";

async function getCollection() {
  const db = await mongo.getDb(config.DB_NAME);
  return db.collection(COLLECTION);
}

export async function getAutoReplies() {
  const col = await getCollection();
  return await col.find({ enabled: true }).toArray();
}

export async function addAutoReply(trigger, reply) {
  const col = await getCollection();

  return await col.insertOne({
    trigger: trigger.toLowerCase(),
    reply,
    enabled: true,
    createdAt: new Date(),
  });
}

export async function toggleAutoReply(id, enabled) {
  const col = await getCollection();
  return await col.updateOne({ _id: id }, { $set: { enabled } });
}

export async function deleteAutoReply(trigger) {
  const col = await getCollection();
  return await col.deleteOne({ trigger: trigger.toLowerCase() });
}
