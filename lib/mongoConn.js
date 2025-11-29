// auth/mongo-connection.js
import { MongoClient } from "mongodb";
import config from "../config.js";

class MongoConnectionManager {
  constructor() {
    this.clients = new Map();
    this.defaultUri = config.MONGODB_URI || "mongodb://localhost:27017/";
  }

  validateUri(uri) {
    if (!uri || typeof uri !== "string") throw new Error("Invalid MongoDB URI");
  }

  validateDbName(dbName) {
    if (!dbName || typeof dbName !== "string")
      throw new Error("Invalid DB name");
  }

  async getClient(uri = this.defaultUri) {
    this.validateUri(uri);
    if (!this.clients.has(uri)) {
      const client = new MongoClient(uri);
      await client.connect();
      console.log(`Connected to MongoDB at ${uri.split("@").pop()}`);
      this.clients.set(uri, client);
    }
    return this.clients.get(uri);
  }

  async getDb(dbName, uri = this.defaultUri) {
    this.validateDbName(dbName);
    const client = await this.getClient(uri);
    return client.db(dbName);
  }

  async closeConnection(uri = this.defaultUri) {
    const client = this.clients.get(uri);
    if (client) {
      await client.close();
      this.clients.delete(uri);
      console.log(`Closed MongoDB connection to ${uri.split("@").pop()}`);
      return true;
    }
    return false;
  }

  async closeAllConnections() {
    await Promise.all(
      [...this.clients.keys()].map((uri) => this.closeConnection(uri))
    );
  }
}

export default new MongoConnectionManager();
