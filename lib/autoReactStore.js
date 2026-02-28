// lib/autoReactStore.js
import mongo from "./mongoConn.js";
import config from "../config.js";

const COLLECTION = "auto_reacts";

async function getCollection() {
  const db = await mongo.getDb(config.DB_NAME);
  return db.collection(COLLECTION);
}

export async function getAutoReacts() {
  const col = await getCollection();
  return await col.find({ enabled: true }).toArray();
}

export async function addAutoReact(trigger, emoji) {
  const col = await getCollection();

  return await col.insertOne({
    trigger: trigger.toLowerCase(),
    emoji,
    enabled: true,
    createdAt: new Date(),
  });
}

export async function deleteAutoReact(trigger) {
  const col = await getCollection();
  return await col.deleteOne({ trigger: trigger.toLowerCase() });
}
