import mongo from "../mongoConn.js";
import config from "../../config.js";

const COLLECTION = "group_auto_reacts";

async function getCollection() {
  const db = await mongo.getDb(config.DB_NAME);
  return db.collection(COLLECTION);
}

// Get settings for a specific group
export async function getGroupAutoReact(jid) {
  const col = await getCollection();
  return await col.findOne({ jid });
}

// Add or update a trigger for a group
export async function addGroupAutoReact(jid, trigger, emoji) {
  const col = await getCollection();
  const group = await getGroupAutoReact(jid);

  if (!group) {
    return await col.insertOne({
      jid,
      enabled: true,
      triggers: [{ trigger: trigger.toLowerCase(), emoji }],
      createdAt: new Date(),
    });
  }

  // Update existing group
  const triggers = [
    ...(group.triggers || []),
    { trigger: trigger.toLowerCase(), emoji },
  ];
  return await col.updateOne({ jid }, { $set: { triggers } });
}

// Remove a trigger by index
export async function removeGroupAutoReact(jid, index) {
  const col = await getCollection();
  const group = await getGroupAutoReact(jid);
  if (!group || !group.triggers || !group.triggers[index]) return false;

  group.triggers.splice(index, 1);
  await col.updateOne({ jid }, { $set: { triggers: group.triggers } });
  return true;
}

// Enable/disable group auto-react
export async function setGroupAutoReactEnabled(jid, enabled) {
  const col = await getCollection();
  const group = await getGroupAutoReact(jid);
  if (!group) {
    return await col.insertOne({
      jid,
      enabled,
      triggers: [],
      createdAt: new Date(),
    });
  }
  return await col.updateOne({ jid }, { $set: { enabled } });
}
