import "dotenv/config";

const config = {
  PREFIX: process.env.PREFIX || ".",
  MODE: process.env.MODE || "groups",
  BOT_NUMBER: process.env.BOT_NUMBER,
  OWNER_NUMBERS: process.env.OWNER_NUMBERS?.split(",") || [],
  MONGODB_URI: process.env.MONGODB_URI,
  DB_NAME: process.env.DB_NAME,
};

export default config;
